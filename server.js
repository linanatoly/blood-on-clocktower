import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { join, extname, resolve, relative, normalize } from 'path';
import { WebSocketServer } from 'ws';

// ========== 常量 ==========
const HTTP_PORT = 8080;
const WS_PORT = 8765;
const ROOT_DIR = '.';

// 游戏阶段序列: night_1, day_2, night_2, day_3, ..., night_19, day_19 (共37个)
const PHASE_SEQUENCE = Array.from({ length: 19 }, (_, n) => [
  `night_${n + 1}`,
  `day_${n + 2}`,
]).flat();

function getAdjacentPhase(current, direction) {
  const idx = PHASE_SEQUENCE.indexOf(current);
  if (idx === -1) {
    return direction === 'next' ? PHASE_SEQUENCE[0] : null;
  }
  if (direction === 'next' && idx + 1 < PHASE_SEQUENCE.length) {
    return PHASE_SEQUENCE[idx + 1];
  }
  if (direction === 'prev' && idx - 1 >= 0) {
    return PHASE_SEQUENCE[idx - 1];
  }
  return current;
}

// ========== Room 类 ==========
class Room {
  constructor(roomCode, godId = null) {
    this.roomCode = roomCode;
    this.godId = godId;
    this.gameState = 'preparing';
    this.gamePhase = null;
    this.totalPlayers = 0;
    this.campAssignment = [];
    this.players = {};
    this.seatOwner = {};
    this.events = [];
    this.chats = [];
    this.roleAssignmentMode = 'self_select';
    this.createdAt = Date.now();
  }

  _playersToList() {
    return Object.entries(this.players).map(([pid, info]) => ({
      playerId: pid,
      nickName: info.nickName,
      seatNum: info.seatNum,
      avatarName: info.avatarName || '',
      headImgUrl: info.headImgUrl || '',
      stateNow: info.stateNow || 'alive',
      connectState: info.connectState || 'offline',
      ready: info.ready || false,
      drunk: info.drunk || false,
    }));
  }

  toDict(viewerId = null) {
    let players = this._playersToList();

    if (viewerId !== null && viewerId !== this.godId) {
      if (this.gameState === 'ended') {
        // 复盘阶段所有人可见完整数据
      } else {
        players = players.map((p) =>
          p.playerId !== viewerId
            ? { ...p, avatarName: '', headImgUrl: '', drunk: false }
            : { ...p, drunk: false }
        );
      }
    }

    const result = {
      roomCode: this.roomCode,
      godId: this.godId,
      gameState: this.gameState,
      gamePhase: this.gamePhase,
      totalPlayers: this.totalPlayers,
      campAssignment: this.campAssignment,
      roleAssignmentMode: this.roleAssignmentMode,
      players,
      seatOwner: Object.fromEntries(
        Object.entries(this.seatOwner).map(([k, v]) => [String(k), v])
      ),
    };

    if (viewerId !== null && viewerId === this.godId) {
      result.events = this.events;
    }

    return result;
  }

  static makePlayerInfo(nickName, connectState = 'online') {
    return {
      nickName,
      seatNum: null,
      avatarName: '',
      headImgUrl: '',
      stateNow: 'alive',
      connectState,
      ready: false,
    };
  }
}

// ========== 全局状态 ==========
const serverStartTime = Date.now();
let localIp = '127.0.0.1';
let httpServer = null;     // HTTP 服务器实例（shutdown 用）
let wsInstance = null;     // WebSocket 服务器实例（shutdown 用）
let pingInterval = null;   // 心跳定时器（shutdown 用）
const rooms = {};          // roomCode -> Room
const playerWs = {};       // playerId -> WebSocket
const wsPlayer = new Map(); // WebSocket -> playerId

function findRoomByPlayer(playerId) {
  for (const room of Object.values(rooms)) {
    if (playerId in room.players) {
      return room;
    }
  }
  return null;
}

// ========== 广播/发送辅助函数 ==========

async function sendSingle(ws, message) {
  try {
    await ws.send(message);
  } catch {
    // 静默失败
  }
}

async function broadcastGameMessage(room, subType, data, excludeWs = null) {
  const msg = JSON.stringify({ type: 'game_data', subType, data });
  const tasks = [];

  for (const [pid, ws] of Object.entries(playerWs)) {
    if (!(pid in room.players)) continue;
    if (excludeWs && ws === excludeWs) continue;
    tasks.push(sendSingle(ws, msg));
  }

  // 上帝也广播
  if (room.godId && room.godId in playerWs) {
    const godWs = playerWs[room.godId];
    if (!excludeWs || godWs !== excludeWs) {
      tasks.push(sendSingle(godWs, msg));
    }
  }

  await Promise.allSettled(tasks);
}

async function sendRoomState(ws, room, viewerId = null) {
  const msg = JSON.stringify({
    type: 'game_data',
    subType: 'room_state',
    data: room.toDict(viewerId),
  });
  await ws.send(msg);
}

async function broadcastPlayerList(room, revealAll = false) {
  const fullList = room._playersToList();
  const isReveal = revealAll || room.gameState === 'ended';

  for (const [pid, ws] of Object.entries(playerWs)) {
    if (!(pid in room.players)) continue;

    let data;
    if (isReveal || pid === room.godId) {
      data = { players: fullList };
    } else {
      data = {
        players: fullList.map((p) =>
          p.playerId !== pid
            ? { ...p, avatarName: '', headImgUrl: '', drunk: false }
            : { ...p, drunk: false }
        ),
      };
    }

    const msg = JSON.stringify({
      type: 'game_data',
      subType: 'player_list_update',
      data,
    });
    await sendSingle(ws, msg);
  }

  // 确保上帝也收到
  if (room.godId && room.godId in playerWs) {
    const godWs = playerWs[room.godId];
    const msg = JSON.stringify({
      type: 'game_data',
      subType: 'player_list_update',
      data: { players: fullList },
    });
    await sendSingle(godWs, msg);
  }
}

async function sendChatSync(ws, room, playerId) {
  const msgs = room.chats.filter((m) => {
    if (m.subType === 'private') {
      return m.senderId === playerId || m.targetId === playerId;
    }
    if (m.subType === 'god_group') {
      return (m.targetIds || []).includes(playerId) || m.senderId === playerId || room.godId === playerId;
    }
    return false;
  });
  const msg = JSON.stringify({
    type: 'game_data',
    subType: 'chat_sync',
    data: { chats: msgs },
  });
  await sendSingle(ws, msg);
}

// ========== 聊天消息处理 ==========
async function handleChatMessage(data, senderWs, senderId) {
  const msg = JSON.stringify(data);
  const tasks = [];
  const subType = data.subType;
  const targetId = data.targetId;
  const targetIds = data.targetIds || [];

  console.log(
    `[Chat] sender=${senderId} subType=${subType} targetId=${targetId} targetIds=${targetIds} content=${(data.content || '').substring(0, 50)}`
  );

  // 提前查找房间，避免重复遍历
  const room = senderId ? findRoomByPlayer(senderId) : null;

  if (subType === 'private') {
    if (targetId && targetId in playerWs) {
      console.log(`[Chat]   -> 发送给 target ${targetId}`);
      tasks.push(sendSingle(playerWs[targetId], msg));
    } else {
      console.log(`[Chat]   -> target ${targetId} 不在线或不存在`);
    }
    if (senderWs) {
      tasks.push(sendSingle(senderWs, msg));
    }
  } else if (subType === 'god_group') {
    let delivered = 0;
    for (const tid of targetIds) {
      if (tid !== senderId && tid in playerWs) {
        tasks.push(sendSingle(playerWs[tid], msg));
        delivered++;
      }
    }
    // 额外转发给上帝
    if (room && room.godId && room.godId in playerWs && room.godId !== senderId) {
      tasks.push(sendSingle(playerWs[room.godId], msg));
    }
    console.log(`[Chat]   -> 群聊消息已发送给 ${delivered} 个目标 (total targetIds=${targetIds.length})`);
    if (senderWs) {
      tasks.push(sendSingle(senderWs, msg));
    }
  } else if (subType === 'group_session_created') {
    let delivered = 0;
    for (const tid of targetIds) {
      if (tid !== senderId && tid in playerWs) {
        tasks.push(sendSingle(playerWs[tid], msg));
        delivered++;
      }
    }
    console.log(`[Chat]   -> 群聊会话创建通知已发送给 ${delivered} 个目标`);
  } else {
    console.log(`[Chat]   -> 未知 subType: ${subType}，消息被忽略`);
  }

  if (tasks.length) {
    await Promise.allSettled(tasks);
  } else {
    console.log(`[Chat]   -> 无消息发送任务`);
  }

  // 存储聊天记录（忽略控制类消息）
  if (senderId && (subType === 'private' || subType === 'god_group')) {
    if (room) {
      room.chats.push({ ...data, targetIds: [...(data.targetIds || [])] });
      // 限制最多 2000 条，防止异常刷屏撑爆内存
      while (room.chats.length > 2000) {
        room.chats.shift();
      }
    }
  }
}

// ========== 游戏数据消息处理 ==========
async function handleGameMessage(data, ws, senderId) {
  const subType = data.subType;
  const gameData = data.data || {};

  if (subType === 'create_room') {
    const { roomCode, playerId, totalPlayers = 5, campAssignment = [3, 0, 1, 1] } = gameData;

    if (!roomCode || !playerId) {
      ws.send(JSON.stringify({ type: 'error', message: '缺少房间号或玩家ID' }));
      return;
    }
    if (roomCode in rooms) {
      ws.send(JSON.stringify({ type: 'error', message: '房间号已存在' }));
      return;
    }

    const room = new Room(roomCode, playerId);
    room.totalPlayers = totalPlayers;
    room.campAssignment = campAssignment;
    rooms[roomCode] = room;

    room.players[playerId] = Room.makePlayerInfo('上帝');
    playerWs[playerId] = ws;
    wsPlayer.set(ws, playerId);
    room.seatOwner = {};

    console.log(`[Room] 房间 ${roomCode} 已创建，上帝ID: ${playerId}`);
    await sendRoomState(ws, room);
    return;
  }

  if (subType === 'join_room') {
    const { roomCode, playerId, nickName = '玩家' } = gameData;

    if (!roomCode || !playerId) {
      ws.send(JSON.stringify({ type: 'error', message: '缺少房间号或玩家ID' }));
      return;
    }
    if (!(roomCode in rooms)) {
      ws.send(JSON.stringify({ type: 'error', message: '房间号不存在' }));
      return;
    }

    const room = rooms[roomCode];
    const isReconnect = playerId in room.players;

    if (isReconnect) {
      room.players[playerId].connectState = 'online';
      const oldSeat = room.players[playerId].seatNum;
      if (oldSeat != null) {
        room.seatOwner[oldSeat] = playerId;
      }
      console.log(`[Room] 玩家 ${playerId}(${nickName}) 重连到房间 ${roomCode}`);
    } else {
      room.players[playerId] = Room.makePlayerInfo(nickName);
      console.log(`[Room] 玩家 ${playerId}(${nickName}) 加入房间 ${roomCode}`);
    }

    playerWs[playerId] = ws;
    wsPlayer.set(ws, playerId);

    await sendRoomState(ws, room, playerId);
    await Promise.all([
      sendChatSync(ws, room, playerId),
      broadcastPlayerList(room),
    ]);
    return;
  }

  if (subType === 'register') {
    const { playerId, nickName } = gameData;
    if (playerId) {
      const room = findRoomByPlayer(playerId);
      if (room && playerId in room.players) {
        room.players[playerId].connectState = 'online';
        room.players[playerId].nickName = nickName || room.players[playerId].nickName;
        const oldSeat = room.players[playerId].seatNum;
        if (oldSeat != null) {
          room.seatOwner[oldSeat] = playerId;
        }
        playerWs[playerId] = ws;
        wsPlayer.set(ws, playerId);
        await sendRoomState(ws, room, playerId);
        await Promise.all([
          sendChatSync(ws, room, playerId),
          broadcastPlayerList(room),
        ]);
      }
    }
    return;
  }

  if (subType === 'sit_down') {
    const { playerId, seatNum } = gameData;
    if (playerId && seatNum != null) {
      if (senderId && playerId !== senderId) {
        ws.send(JSON.stringify({ type: 'error', message: '无权操作' }));
        return;
      }
      const room = findRoomByPlayer(playerId);
      if (!room) {
        ws.send(JSON.stringify({ type: 'error', message: '玩家不在任何房间' }));
        return;
      }
      if (seatNum in room.seatOwner && room.seatOwner[seatNum] !== playerId) {
        ws.send(JSON.stringify({ type: 'error', message: '座位已被占' }));
        return;
      }
      if (playerId in room.players) {
        const oldSeat = room.players[playerId].seatNum;
        if (oldSeat != null && oldSeat in room.seatOwner) {
          delete room.seatOwner[oldSeat];
        }
        room.players[playerId].seatNum = seatNum;
        room.seatOwner[seatNum] = playerId;
      }
      await broadcastPlayerList(room);
    }
    return;
  }

  if (subType === 'player_ready') {
    const { playerId } = gameData;
    if (playerId) {
      if (senderId && playerId !== senderId) {
        ws.send(JSON.stringify({ type: 'error', message: '无权操作' }));
        return;
      }
      const room = findRoomByPlayer(playerId);
      if (room && playerId in room.players) {
        room.players[playerId].ready = !room.players[playerId].ready;
        await broadcastPlayerList(room);
      }
    }
    return;
  }

  if (subType === 'set_role_mode') {
    const { roomCode, mode } = gameData;

    if (!roomCode || !(roomCode in rooms)) {
      ws.send(JSON.stringify({ type: 'error', message: '房间号不存在' }));
      return;
    }

    const room = rooms[roomCode];

    if (senderId !== room.godId) {
      ws.send(JSON.stringify({ type: 'error', message: '只有上帝可以切换角色选择模式' }));
      return;
    }

    if (mode !== 'self_select' && mode !== 'god_assign') {
      ws.send(JSON.stringify({ type: 'error', message: '无效的角色选择模式' }));
      return;
    }

    room.roleAssignmentMode = mode;
    console.log(`[Room] 房间 ${roomCode} 角色选择模式变更为: ${mode}`);

    // 广播模式变更给所有玩家
    await broadcastGameMessage(room, 'role_mode_changed', {
      mode: mode,
    });
    return;
  }

  if (subType === 'start_game') {
    const { roomCode, playerId } = gameData;

    if (!roomCode || !playerId) {
      ws.send(JSON.stringify({ type: 'error', message: '缺少房间号或玩家ID' }));
      return;
    }
    if (!(roomCode in rooms)) {
      ws.send(JSON.stringify({ type: 'error', message: '房间号不存在' }));
      return;
    }

    const room = rooms[roomCode];

    if (senderId !== room.godId) {
      ws.send(JSON.stringify({ type: 'error', message: '只有上帝可以开始游戏' }));
      return;
    }
    if (room.gameState !== 'preparing') {
      ws.send(JSON.stringify({ type: 'error', message: '当前不在准备阶段，无法开始游戏' }));
      return;
    }

    const seatedPlayers = Object.entries(room.players).filter(
      ([pid, info]) => pid !== room.godId && info.seatNum != null
    );

    if (seatedPlayers.length === 0) {
      ws.send(JSON.stringify({ type: 'error', message: '没有玩家入座，无法开始游戏' }));
      return;
    }

    const unready = seatedPlayers
      .filter(([, info]) => !info.ready)
      .map(([, info]) => info.nickName);

    if (unready.length > 0) {
      ws.send(
        JSON.stringify({
          type: 'error',
          message: '以下玩家尚未准备: ' + unready.join(', '),
        })
      );
      return;
    }

    room.gameState = 'in_gaming';
    room.gamePhase = 'night_1';
    room.events = [];
    console.log(`[Room] 房间 ${roomCode} 游戏开始！`);
    await sendRoomState(ws, room);
    await broadcastGameMessage(room, 'game_state_update', {
      gameState: 'in_gaming',
      gamePhase: room.gamePhase,
    });
    return;
  }

  if (subType === 'change_phase') {
    const { roomCode, playerId, direction } = gameData;

    if (!roomCode || !playerId || !direction) {
      ws.send(JSON.stringify({ type: 'error', message: '缺少参数' }));
      return;
    }
    if (!(roomCode in rooms)) {
      ws.send(JSON.stringify({ type: 'error', message: '房间号不存在' }));
      return;
    }

    const room = rooms[roomCode];

    if (senderId !== room.godId) {
      ws.send(JSON.stringify({ type: 'error', message: '只有上帝可以切换阶段' }));
      return;
    }
    if (room.gameState !== 'in_gaming') {
      ws.send(JSON.stringify({ type: 'error', message: '游戏未开始' }));
      return;
    }

    const newPhase = getAdjacentPhase(room.gamePhase, direction);
    if (newPhase === room.gamePhase) {
      ws.send(JSON.stringify({ type: 'error', message: '已是边界阶段，无法继续切换' }));
      return;
    }

    room.gamePhase = newPhase;
    console.log(`[Room] 房间 ${roomCode} 阶段变更为 ${newPhase}`);
    await broadcastGameMessage(room, 'game_state_update', { gamePhase: newPhase });
    return;
  }

  if (subType === 'set_player_state') {
    const { roomCode, playerId, targetPlayerId, newState } = gameData;

    if (!roomCode || !playerId || !targetPlayerId || !newState) {
      ws.send(JSON.stringify({ type: 'error', message: '参数不完整' }));
      return;
    }
    if (!(roomCode in rooms)) {
      ws.send(JSON.stringify({ type: 'error', message: '房间号不存在' }));
      return;
    }

    const room = rooms[roomCode];

    if (senderId !== room.godId) {
      ws.send(JSON.stringify({ type: 'error', message: '只有上帝可以设置状态' }));
      return;
    }
    if (!(targetPlayerId in room.players)) {
      ws.send(JSON.stringify({ type: 'error', message: '目标玩家不存在' }));
      return;
    }
    if (!['alive', 'dead_with_ticket', 'dead_without_ticket'].includes(newState)) {
      ws.send(JSON.stringify({ type: 'error', message: '无效的状态值' }));
      return;
    }

    room.players[targetPlayerId].stateNow = newState;
    console.log(`[Room] 房间 ${roomCode} 玩家 ${targetPlayerId} 状态变更为 ${newState}`);
    await broadcastPlayerList(room);
    return;
  }

  if (subType === 'set_drunk') {
    const { playerId, targetPlayerId } = gameData;

    if (!playerId || !targetPlayerId) {
      ws.send(JSON.stringify({ type: 'error', message: '参数不完整' }));
      return;
    }

    const room = findRoomByPlayer(playerId);
    if (!room) {
      ws.send(JSON.stringify({ type: 'error', message: '房间号不存在' }));
      return;
    }
    if (senderId !== room.godId) {
      ws.send(JSON.stringify({ type: 'error', message: '只有上帝可以设置酒鬼' }));
      return;
    }
    if (!(targetPlayerId in room.players)) {
      ws.send(JSON.stringify({ type: 'error', message: '目标玩家不存在' }));
      return;
    }
    if (!['preparing', 'in_gaming'].includes(room.gameState)) {
      ws.send(JSON.stringify({ type: 'error', message: '当前阶段无法设置酒鬼' }));
      return;
    }

    const wasDrunk = room.players[targetPlayerId].drunk || false;
    if (!wasDrunk) {
      // 互斥：清除所有玩家的酒鬼状态
      for (const pid of Object.keys(room.players)) {
        room.players[pid].drunk = false;
      }
    }
    room.players[targetPlayerId].drunk = !wasDrunk;
    console.log(`[Room] 房间 ${room.roomCode} 玩家 ${targetPlayerId} 酒鬼状态变更为 ${room.players[targetPlayerId].drunk}`);
    await broadcastPlayerList(room);
    return;
  }

  if (subType === 'avatar_select') {
    const { playerId, avatarName, headImgUrl, seatNum } = gameData;

    if (playerId && avatarName && headImgUrl) {
      // 权限校验：玩家可以为自己选角色，上帝在准备阶段可以为房间内玩家分配角色
      const roomByPlayer = findRoomByPlayer(playerId);
      const isGodAssigning = roomByPlayer
        && senderId === roomByPlayer.godId
        && roomByPlayer.gameState === 'preparing';
      if (senderId && playerId !== senderId && !isGodAssigning) {
        ws.send(JSON.stringify({ type: 'error', message: '无权操作' }));
        return;
      }
      const room = roomByPlayer;
      if (!room) {
        ws.send(JSON.stringify({ type: 'error', message: '玩家不在任何房间' }));
        return;
      }
      if (playerId in room.players) {
        room.players[playerId].avatarName = avatarName;
        room.players[playerId].headImgUrl = headImgUrl;
        if (seatNum != null) {
          room.players[playerId].seatNum = seatNum;
          room.seatOwner[seatNum] = playerId;
        }
        await broadcastPlayerList(room);
      } else {
        ws.send(JSON.stringify({ type: 'error', message: '玩家不存在' }));
      }
    }
    return;
  }

  if (subType === 'event_record') {
    const { roomCode, event: eventData } = gameData;

    if (!roomCode || !eventData) {
      ws.send(JSON.stringify({ type: 'error', message: '参数不完整' }));
      return;
    }
    if (!(roomCode in rooms)) {
      ws.send(JSON.stringify({ type: 'error', message: '房间号不存在' }));
      return;
    }

    const room = rooms[roomCode];

    if (senderId !== room.godId) {
      ws.send(JSON.stringify({ type: 'error', message: '只有上帝可以记录事件' }));
      return;
    }

    const evtId = eventData.id;
    if (!evtId) {
      ws.send(JSON.stringify({ type: 'error', message: '事件缺少id' }));
      return;
    }

    const idx = room.events.findIndex((e) => e.id === evtId);
    if (idx >= 0) {
      room.events[idx] = eventData;
    } else {
      room.events.push(eventData);
    }
    console.log(`[Room] 房间 ${roomCode} 事件${idx >= 0 ? '更新' : '记录'}: ${evtId}`);
    return;
  }

  if (subType === 'event_delete') {
    const { roomCode, eventId } = gameData;

    if (!roomCode || !eventId) {
      ws.send(JSON.stringify({ type: 'error', message: '参数不完整' }));
      return;
    }
    if (!(roomCode in rooms)) {
      ws.send(JSON.stringify({ type: 'error', message: '房间号不存在' }));
      return;
    }

    const room = rooms[roomCode];

    if (senderId !== room.godId) {
      ws.send(JSON.stringify({ type: 'error', message: '只有上帝可以删除事件' }));
      return;
    }

    room.events = room.events.filter((e) => e.id !== eventId);
    console.log(`[Room] 房间 ${roomCode} 事件删除: ${eventId}`);
    return;
  }

  if (subType === 'end_game') {
    const { roomCode } = gameData;

    if (!roomCode) {
      ws.send(JSON.stringify({ type: 'error', message: '缺少房间号' }));
      return;
    }
    if (!(roomCode in rooms)) {
      ws.send(JSON.stringify({ type: 'error', message: '房间号不存在' }));
      return;
    }

    const room = rooms[roomCode];

    if (senderId !== room.godId) {
      ws.send(JSON.stringify({ type: 'error', message: '只有上帝可以结束游戏' }));
      return;
    }
    if (room.gameState !== 'in_gaming') {
      ws.send(JSON.stringify({ type: 'error', message: '游戏未开始' }));
      return;
    }

    room.gameState = 'ended';
    room.gamePhase = null;
    console.log(`[Room] 房间 ${roomCode} 游戏结束，进入复盘阶段`);
    await broadcastGameMessage(room, 'game_state_update', {
      gameState: 'ended',
      gamePhase: null,
    });
    await broadcastPlayerList(room, true);
    await broadcastGameMessage(room, 'event_sync', { events: room.events });
    return;
  }

  if (subType === 'back_to_preparing') {
    const { roomCode } = gameData;

    if (!roomCode || !(roomCode in rooms)) {
      ws.send(JSON.stringify({ type: 'error', message: '房间号不存在' }));
      return;
    }

    const room = rooms[roomCode];

    if (senderId !== room.godId) {
      ws.send(JSON.stringify({ type: 'error', message: '只有上帝可以返回准备阶段' }));
      return;
    }
    if (room.gameState !== 'ended') {
      ws.send(JSON.stringify({ type: 'error', message: '当前不在复盘阶段' }));
      return;
    }

    room.gameState = 'preparing';
    for (const pid of Object.keys(room.players)) {
      room.players[pid].ready = false;
      room.players[pid].avatarName = '';
      room.players[pid].headImgUrl = '';
      room.players[pid].stateNow = 'alive';
      room.players[pid].drunk = false;
    }
    console.log(`[Room] 房间 ${roomCode} 回到准备状态`);
    await broadcastGameMessage(room, 'game_state_update', {
      gameState: 'preparing',
      gamePhase: null,
    });
    await broadcastPlayerList(room);
    return;
  }

  if (subType === 'dismiss_room') {
    const { roomCode, playerId } = gameData;

    if (!roomCode || !(roomCode in rooms)) {
      ws.send(JSON.stringify({ type: 'error', message: '房间号不存在' }));
      return;
    }

    const room = rooms[roomCode];

    if (senderId !== room.godId) {
      ws.send(JSON.stringify({ type: 'error', message: '只有上帝可以解散房间' }));
      return;
    }
    if (room.gameState !== 'preparing') {
      ws.send(JSON.stringify({ type: 'error', message: '只能在准备阶段解散房间' }));
      return;
    }

    console.log(`[Room] 房间 ${roomCode} 被上帝解散`);

    // 广播解散消息
    const dismissMsg = JSON.stringify({
      type: 'game_data',
      subType: 'room_dismissed',
      data: { message: '房间已被上帝解散' },
    });

    const tasks = [];
    for (const [pid, pws] of Object.entries(playerWs)) {
      if (pid in room.players || pid === room.godId) {
        tasks.push(sendSingle(pws, dismissMsg));
      }
    }
    if (tasks.length) {
      await Promise.allSettled(tasks);
    }

    // 清理 playerWs
    for (const pid of Object.keys(room.players)) {
      if (pid in playerWs) {
        delete playerWs[pid];
      }
    }
    if (room.godId && room.godId in playerWs) {
      delete playerWs[room.godId];
    }

    // 清理 wsPlayer
    for (const [pws, pid] of wsPlayer.entries()) {
      if (pid in room.players || pid === room.godId) {
        wsPlayer.delete(pws);
      }
    }

    delete rooms[roomCode];
    console.log(`[Room] 房间 ${roomCode} 数据已清除，当前 rooms 数量: ${Object.keys(rooms).length}`);
    return;
  }

  if (subType === 'leave_room') {
    const { roomCode, playerId } = gameData;

    if (!roomCode || !playerId) {
      ws.send(JSON.stringify({ type: 'error', message: '参数不完整' }));
      return;
    }
    if (senderId && playerId !== senderId) {
      ws.send(JSON.stringify({ type: 'error', message: '无权操作' }));
      return;
    }
    if (!(roomCode in rooms)) {
      ws.send(JSON.stringify({ type: 'error', message: '房间号不存在' }));
      return;
    }

    const room = rooms[roomCode];
    if (!(playerId in room.players)) {
      ws.send(JSON.stringify({ type: 'error', message: '你不在这个房间' }));
      return;
    }
    if (room.gameState !== 'preparing') {
      ws.send(JSON.stringify({ type: 'error', message: '只能在准备阶段退出房间' }));
      return;
    }
    if (playerId === room.godId) {
      ws.send(JSON.stringify({ type: 'error', message: '上帝请使用解散房间' }));
      return;
    }

    const seatNum = room.players[playerId].seatNum;
    if (seatNum != null && room.seatOwner[seatNum] === playerId) {
      delete room.seatOwner[seatNum];
    }

    delete room.players[playerId];
    if (playerId in playerWs) {
      delete playerWs[playerId];
    }
    wsPlayer.delete(ws);

    console.log(`[Room] 玩家 ${playerId} 退出房间 ${roomCode}`);

    const leftMsg = JSON.stringify({
      type: 'game_data',
      subType: 'room_left',
      data: { message: '你已退出房间' },
    });
    await sendSingle(ws, leftMsg);

    await broadcastPlayerList(room);

    const hasPlayers = Object.keys(room.players).some(
      (pid) => pid !== room.godId
    );
    if (!hasPlayers && !(room.godId && room.godId in playerWs)) {
      for (const [pws, pid] of wsPlayer.entries()) {
        if (pid === room.godId) {
          wsPlayer.delete(pws);
        }
      }
      if (room.godId && room.godId in playerWs) {
        delete playerWs[room.godId];
      }
      delete rooms[roomCode];
      console.log(`[Room] 房间 ${roomCode} 无玩家在线，自动清理`);
    }
    return;
  }

  if (subType === 'spy_request') {
    const { roomCode } = gameData;

    if (!roomCode || !(roomCode in rooms)) {
      return;
    }

    const room = rooms[roomCode];
    const player = room.players[senderId];

    if (!player || player.avatarName !== '间谍') {
      ws.send(JSON.stringify({ type: 'error', message: '你不是间谍' }));
      return;
    }

    const spyData = room.toDict(room.godId);
    await sendSingle(
      ws,
      JSON.stringify({
        type: 'game_data',
        subType: 'spy_data',
        data: spyData,
      })
    );
    console.log(`[Room] 房间 ${roomCode} 间谍 ${senderId} 请求上帝数据`);
    return;
  }
}

// ========== MIME 类型映射 ==========
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
};

// ========== HTTP 服务器 ==========
async function serveStaticFile(res, filePath) {
  try {
    const content = await readFile(filePath);
    const ext = extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
    });
    res.end(content);
  } catch (err) {
    if (err.code === 'ENOENT') {
      res.writeHead(404, { 'Access-Control-Allow-Origin': '*' });
      res.end('Not Found');
    } else if (err.code === 'EISDIR') {
      // 目录请求，尝试 index.html
      await serveStaticFile(res, join(filePath, 'index.html'));
    } else {
      res.writeHead(500, { 'Access-Control-Allow-Origin': '*' });
      res.end('Internal Server Error');
    }
  }
}

function createHttpServer() {
  const server = createServer((req, res) => {
    // ---------- API 路由 ----------
    const urlPath = req.url.split('?')[0];

    if (urlPath === '/api/status') {
      const uptime = Math.floor((Date.now() - serverStartTime) / 1000);
      const roomsStatus = {};
      for (const [code, room] of Object.entries(rooms)) {
        roomsStatus[code] = {
          gameState: room.gameState,
          gamePhase: room.gamePhase,
          playerCount: Object.keys(room.players).length,
          totalPlayers: room.totalPlayers,
          roleAssignmentMode: room.roleAssignmentMode,
        };
      }
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(JSON.stringify({
        running: true,
        httpPort: HTTP_PORT,
        wsPort: WS_PORT,
        localIp,
        uptime,
        rooms: roomsStatus,
        totalConnections: wsInstance ? wsInstance.clients.size : 0,
      }, null, 2));
      return;
    }

    if (urlPath === '/api/shutdown' && req.method === 'POST') {
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(JSON.stringify({ ok: true, message: '服务器正在关闭...' }));

      // 优雅关闭
      console.log('[Shutdown] 收到关闭请求，正在停止服务...');
      gracefulShutdown();
      return;
    }

    // ---------- 静态文件 ----------
    if (req.method !== 'GET') {
      res.writeHead(405, { 'Access-Control-Allow-Origin': '*' });
      res.end('Method Not Allowed');
      return;
    }

    if (req.url === '/favicon.ico') {
      res.writeHead(204, { 'Access-Control-Allow-Origin': '*' });
      res.end();
      return;
    }

    let filePath = normalize(req.url.split('?')[0]);
    if (filePath === '/') {
      filePath = '/index.html';
    }

    // 安全检查：防止目录遍历
    const safePath = resolve(join(ROOT_DIR, filePath));
    const rootAbs = resolve(ROOT_DIR);
    const rel = relative(rootAbs, safePath);
    if (rel.startsWith('..')) {
      res.writeHead(403, { 'Access-Control-Allow-Origin': '*' });
      res.end('Forbidden');
      return;
    }

    serveStaticFile(res, safePath);
  });

  server.listen(HTTP_PORT);
  return server;
}

// ========== 优雅关闭 ==========
function gracefulShutdown() {
  if (pingInterval) clearInterval(pingInterval);

  if (wsInstance) {
    wsInstance.clients.forEach((ws) => {
      try { ws.close(); } catch {}
    });
    wsInstance.close();
  }

  if (httpServer) {
    httpServer.close();
  }

  console.log('[Shutdown] 服务器已关闭。');
  process.exit(0);
}

// ========== 主入口 ==========
async function main() {
  // 获取本机 IP
  const os = await import('os');
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        localIp = net.address;
        break;
      }
    }
    if (localIp !== '127.0.0.1') break;
  }

  console.log('='.repeat(50));
  console.log(`Game page: http://${localIp}:${HTTP_PORT}/`);
  console.log(`Launcher:  http://${localIp}:${HTTP_PORT}/launcher.html`);
  console.log('='.repeat(50));

  // 启动 HTTP 服务器
  httpServer = createHttpServer();
  console.log(`HTTP service: http://${localIp}:${HTTP_PORT}`);

  // 启动 WebSocket 服务器
  wsInstance = new WebSocketServer({ port: WS_PORT });
  console.log(`WebSocket service: ws://${localIp}:${WS_PORT}`);

  // 心跳检测
  pingInterval = setInterval(() => {
    wsInstance.clients.forEach((ws) => {
      if (ws._isAlive === false) {
        ws.terminate();
        return;
      }
      ws._isAlive = false;
      ws.ping();
    });
  }, 20000);

  wsInstance.on('connection', (ws) => {
    ws._isAlive = true;

    ws.on('pong', () => {
      ws._isAlive = true;
    });

    ws.on('message', (raw) => {
      (async () => {
        let parsed;
        try {
          parsed = JSON.parse(raw.toString());
        } catch {
          return;
        }

        const msgType = parsed.type;
        if (msgType === 'chat') {
          const senderId = wsPlayer.get(ws);
          await handleChatMessage(parsed, ws, senderId);
        } else if (msgType === 'game_data') {
          const senderId = wsPlayer.get(ws);
          await handleGameMessage(parsed, ws, senderId);
        }
        // ping 心跳忽略
      })().catch(err => console.error('[ws error]', err));
    });

    ws.on('close', async () => {
      const playerId = wsPlayer.get(ws);
      let room = null;

      if (playerId) {
        room = findRoomByPlayer(playerId);
        if (room && playerId in room.players) {
          room.players[playerId].connectState = 'offline';
          console.log(`[Cleanup] 玩家 ${playerId} 标记为离线, 房间 ${room.roomCode}`);
        }
      }

      if (playerId in playerWs) {
        delete playerWs[playerId];
      }
      wsPlayer.delete(ws);

      if (room) {
        await broadcastPlayerList(room);
      }
    });
  });

  wsInstance.on('close', () => {
    clearInterval(pingInterval);
  });

  console.log('Server is running. Press Ctrl+C to stop.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
