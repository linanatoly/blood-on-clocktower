import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventBus } from '../../core/EventBus.js';
import { EV, GameDataSubType, ServerMsgType } from '../../event-constants.js';

let wsMock = null;

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  constructor(url) {
    this.url = url;
    this.readyState = MockWebSocket.CONNECTING;
    this.onopen = null;
    this.onmessage = null;
    this.onclose = null;
    this.onerror = null;
    this._sent = [];
    wsMock = this;
  }
  send(data) { this._sent.push(data); }
  _open() { this.readyState = MockWebSocket.OPEN; if (this.onopen) this.onopen(); }
  _receive(data) { if (this.onmessage) this.onmessage({ data: JSON.stringify(data) }); }
  _close() { this.readyState = MockWebSocket.CLOSED; if (this.onclose) this.onclose(); }
}

globalThis.WebSocket = MockWebSocket;
globalThis.WebSocket.CONNECTING = 0;
globalThis.WebSocket.OPEN = 1;
globalThis.WebSocket.CLOSING = 2;
globalThis.WebSocket.CLOSED = 3;

let DataManager, dm;

beforeEach(async () => {
  wsMock = null;
  localStorage.clear();
  // 用 vi.resetModules 确保单例重建
  vi.resetModules();
  const mod = await import('../dataManager.js');
  DataManager = mod.DataManager;
  dm = DataManager.getInstance();
});

afterEach(() => {
  localStorage.clear();
});

function initDM(eventBus) {
  const eb = eventBus || new EventBus();
  dm.init(eb);
  if (wsMock) wsMock._open();
  return eb;
}

function makePlayer(id, overrides = {}) {
  return {
    playerId: id, nickName: '玩家' + id, seatNum: null,
    avatarName: null, headImgUrl: null, stateNow: 'alive',
    connectState: 'online', ready: false, drunk: false, ...overrides,
  };
}

describe('DataManager', () => {
  describe('单例模式', () => {
    it('getInstance() 返回同一实例', () => {
      const a = DataManager.getInstance();
      const b = DataManager.getInstance();
      expect(a).toBe(b);
    });

    it('构造时 eventBus 为 null', () => {
      const fresh = new DataManager();
      expect(fresh.eventBus).toBeNull();
    });
  });

  describe('init()', () => {
    it('设置 eventBus 并调用 connectServer', async () => {
      const eb = new EventBus();
      dm.init(eb);
      expect(dm.eventBus).toBe(eb);
      expect(wsMock).not.toBeNull();
      expect(wsMock.url).toContain('8765');
    });

    it('不重复创建 WebSocket（已 OPEN 时）', async () => {
      await initDM();
      const firstWs = dm.ws;
      const eb = new EventBus();
      dm.init(new EventBus());
      expect(dm.ws).toBe(firstWs);
    });

    it('WebSocket CLOSED 时重新连接', async () => {
      await initDM();
      const firstWs = dm.ws;
      firstWs._close();
      const eb = new EventBus();
      dm.init(new EventBus());
      expect(dm.ws).not.toBe(firstWs);
    });
  });

  describe('createRoom()', () => {
    it('发送正确的 create_room 消息', async () => {
      await initDM();
      dm.userId = 'god_test';
      dm.createRoom('1234', 7, [3, 0, 1, 1]);
      const sent = JSON.parse(wsMock._sent[0]);
      expect(sent.type).toBe(ServerMsgType.GAME_DATA);
      expect(sent.subType).toBe(GameDataSubType.CREATE_ROOM);
      expect(sent.data.roomCode).toBe('1234');
      expect(sent.data.totalPlayers).toBe(7);
    });

    it('无 userId 时自动生成', async () => {
      await initDM();
      dm.userId = null;
      dm.createRoom('5678', 5, [3, 1, 1, 0]);
      expect(dm.userId).toBeTruthy();
      expect(dm.userId.startsWith('god_')).toBe(true);
    });

    it('WebSocket 未连接时不发送', async () => {
      const eb = new EventBus();
      dm.init(eb);
      dm.userId = 'g1';
      dm.createRoom('1111', 6, [3, 1, 1, 1]);
      expect(wsMock._sent.length).toBe(0);
    });
  });

  describe('joinRoom()', () => {
    it('发送正确的 join_room 消息', async () => {
      await initDM();
      dm.joinRoom('9999', 'player_x', '小明');
      const sent = JSON.parse(wsMock._sent[0]);
      expect(sent.type).toBe(ServerMsgType.GAME_DATA);
      expect(sent.subType).toBe(GameDataSubType.JOIN_ROOM);
      expect(sent.data.roomCode).toBe('9999');
      expect(sent.data.playerId).toBe('player_x');
    });

    it('WebSocket 未连接时保存到 pendingRegister', async () => {
      const eb = new EventBus();
      dm.init(eb);
      dm.joinRoom('1111', 'p1', '测试');
      expect(dm.pendingRegister).toEqual({
        action: 'join', roomCode: '1111', playerId: 'p1', nickName: '测试',
      });
    });
  });

  describe('Session 持久化', () => {
    it('saveSession 写入 localStorage', () => {
      dm.userId = 'u1'; dm.roomCode = '1234'; dm.userType = 'player';
      dm.saveSession();
      const raw = localStorage.getItem('blood_clock_session');
      expect(JSON.parse(raw)).toEqual({ playerId: 'u1', roomCode: '1234', userType: 'player' });
    });

    it('saveSession 缺少必要字段时不写入', () => {
      dm.userId = null; dm.roomCode = null;
      dm.saveSession();
      expect(localStorage.getItem('blood_clock_session')).toBeNull();
    });

    it('loadSession 返回已保存的会话', () => {
      localStorage.setItem('blood_clock_session', JSON.stringify({ playerId: 'u2', roomCode: '5678', userType: 'god' }));
      expect(dm.loadSession()).toEqual({ playerId: 'u2', roomCode: '5678', userType: 'god' });
    });

    it('loadSession 无数据时返回 null', () => {
      expect(dm.loadSession()).toBeNull();
    });

    it('loadSession JSON 损坏时不抛异常', () => {
      localStorage.setItem('blood_clock_session', 'bad json{{{');
      expect(dm.loadSession()).toBeNull();
    });

    it('clearSession 清除 localStorage', () => {
      localStorage.setItem('blood_clock_session', '{}');
      dm.clearSession();
      expect(localStorage.getItem('blood_clock_session')).toBeNull();
    });
  });

  describe('handleRoomState()', () => {
    it('更新所有房间状态字段', async () => {
      await initDM();
      dm.userId = 'god_1';
      dm.handleRoomState({
        roomCode: 'ABCD', godId: 'god_1', gameState: 'preparing',
        gamePhase: 'night_1', totalPlayers: 7, campAssignment: [3, 0, 1, 1],
        players: [makePlayer('p1', { nickName: 'A' })], events: [],
      });
      expect(dm.roomCode).toBe('ABCD');
      expect(dm.gameState).toBe('preparing');
      expect(dm.totalPlayers).toBe(7);
      expect(dm.playerList.length).toBe(1);
      expect(dm.userType).toBe('god');
    });

    it('识别玩家类型', async () => {
      await initDM();
      dm.userId = 'player_x';
      dm.handleRoomState({
        roomCode: 'ABCD', godId: 'god_z', gameState: 'preparing',
        gamePhase: null, totalPlayers: 5, campAssignment: [], players: [], events: [],
      });
      expect(dm.userType).toBe('player');
    });

    it('发送 ROOM_STATE_RECEIVED 事件', async () => {
      const eb = new EventBus();
      const spy = vi.fn();
      eb.on(EV.ROOM_STATE_RECEIVED, spy);
      await initDM(eb);
      dm.userId = 'g1';
      dm.handleRoomState({
        roomCode: 'X', godId: 'g1', gameState: 'preparing',
        gamePhase: null, totalPlayers: 5, campAssignment: [], players: [], events: [],
      });
      expect(spy).toHaveBeenCalledOnce();
    });

    it('有事件时发送 EVENT_REMOTE_SYNC', async () => {
      const eb = new EventBus();
      const spy = vi.fn();
      eb.on(EV.EVENT_REMOTE_SYNC, spy);
      await initDM(eb);
      dm.userId = 'g1';
      dm.handleRoomState({
        roomCode: 'X', godId: 'g1', gameState: 'preparing',
        gamePhase: null, totalPlayers: 5, campAssignment: [],
        players: [], events: [{ id: 'e1' }],
      });
      expect(spy).toHaveBeenCalledWith([{ id: 'e1' }]);
    });

    it('空事件数组不发送 EVENT_REMOTE_SYNC', async () => {
      const eb = new EventBus();
      const spy = vi.fn();
      eb.on(EV.EVENT_REMOTE_SYNC, spy);
      await initDM(eb);
      dm.userId = 'g1';
      dm.handleRoomState({
        roomCode: 'X', godId: 'g1', gameState: 'preparing',
        gamePhase: null, totalPlayers: 5, campAssignment: [], players: [], events: [],
      });
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('WebSocket onmessage', () => {
    it('ROOM_STATE 调用 handleRoomState', async () => {
      const eb = new EventBus();
      const spy = vi.fn();
      eb.on(EV.ROOM_STATE_RECEIVED, spy);
      await initDM(eb);
      dm.userId = 'g1';
      wsMock._receive({
        type: ServerMsgType.GAME_DATA,
        subType: GameDataSubType.ROOM_STATE,
        data: { roomCode: 'OK', godId: 'g1', gameState: 'preparing', gamePhase: null, totalPlayers: 5, campAssignment: [], players: [], events: [] },
      });
      expect(spy).toHaveBeenCalledOnce();
    });

    it('PLAYER_LIST_UPDATE 更新 playerList', async () => {
      const eb = new EventBus();
      const spy = vi.fn();
      eb.on(EV.PLAYER_LIST_UPDATED, spy);
      await initDM(eb);
      wsMock._receive({
        type: ServerMsgType.GAME_DATA,
        subType: GameDataSubType.PLAYER_LIST_UPDATE,
        data: { players: [makePlayer('p1'), makePlayer('p2')] },
      });
      expect(dm.playerList.length).toBe(2);
      expect(spy).toHaveBeenCalled();
    });

    it('ERROR 消息发送 SERVER_ERROR', async () => {
      const eb = new EventBus();
      const spy = vi.fn();
      eb.on(EV.SERVER_ERROR, spy);
      await initDM(eb);
      wsMock._receive({ type: 'error', message: '房间不存在' });
      expect(spy).toHaveBeenCalledWith('房间不存在');
    });

    it('聊天消息发送 GET_SERVER_MSG', async () => {
      const eb = new EventBus();
      const spy = vi.fn();
      eb.on(EV.GET_SERVER_MSG, spy);
      await initDM(eb);
      dm.userId = 'me';
      wsMock._receive({ type: ServerMsgType.CHAT, subType: 'private', senderId: 'other', content: '你好' });
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('重连机制', () => {
    it('WebSocket onclose 启动重连定时器', async () => {
      vi.useFakeTimers();
      await initDM();
      wsMock._close();
      expect(dm.reconnectTimer).not.toBeNull();
      vi.useRealTimers();
    });

    it('stopReconnect 清除定时器', async () => {
      vi.useFakeTimers();
      await initDM();
      wsMock._close();
      dm.stopReconnect();
      expect(dm.reconnectTimer).toBeNull();
      vi.useRealTimers();
    });

    it('WebSocket onopen 自动重连已有会话', async () => {
      localStorage.setItem('blood_clock_session', JSON.stringify({ playerId: 'old_p', roomCode: '5678', userType: 'player' }));
      const eb = new EventBus();
      const spy = vi.fn();
      eb.on(EV.RECONNECTING, spy);
      dm.init(eb);
      wsMock._open();
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('玩家操作消息发送', () => {
    beforeEach(async () => { await initDM(); });

    it('registerPlayer 发送注册消息', () => {
      dm.userId = 'p1';
      dm.registerPlayer('小明');
      const sent = JSON.parse(wsMock._sent[wsMock._sent.length - 1]);
      expect(sent.subType).toBe(GameDataSubType.REGISTER);
    });

    it('sendPlayerStateChange 发送状态变更', () => {
      dm.sendPlayerStateChange('p_target', 'dead_with_ticket');
      const sent = JSON.parse(wsMock._sent[wsMock._sent.length - 1]);
      expect(sent.subType).toBe(GameDataSubType.SET_PLAYER_STATE);
    });

    it('sendPhaseChange 发送阶段切换', () => {
      dm.sendPhaseChange('next');
      const sent = JSON.parse(wsMock._sent[wsMock._sent.length - 1]);
      expect(sent.subType).toBe(GameDataSubType.CHANGE_PHASE);
    });
  });

  describe('allPlayersReady()', () => {
    it('无已入座玩家时返回 allReady: false', async () => {
      await initDM();
      dm.playerList = [];
      const result = dm.allPlayersReady();
      expect(result.allReady).toBe(false);
      expect(result.reason).toBe('no_players');
    });

    it('所有已入座玩家准备时返回 true', async () => {
      await initDM();
      dm.godId = 'god_1';
      dm.playerList = [
        makePlayer('p1', { seatNum: 0, ready: true }),
        makePlayer('p2', { seatNum: 1, ready: true }),
        makePlayer('god_1', { seatNum: null }),
      ];
      expect(dm.allPlayersReady().allReady).toBe(true);
    });

    it('有未准备玩家时返回 false', async () => {
      await initDM();
      dm.godId = 'god_1';
      dm.playerList = [
        makePlayer('p1', { seatNum: 0, ready: true, nickName: 'A' }),
        makePlayer('p2', { seatNum: 1, ready: false, nickName: 'B' }),
      ];
      const result = dm.allPlayersReady();
      expect(result.allReady).toBe(false);
      expect(result.unreadyNames).toContain('B');
    });
  });

  describe('辅助方法', () => {
    it('clearSessionUnRead 清零未读数', () => {
      dm.chatSessionList = [{ key: 's1', unRead: 5 }];
      dm.clearSessionUnRead('s1');
      expect(dm.chatSessionList[0].unRead).toBe(0);
    });

    it('addChatMsg 添加消息并限制最大条数', () => {
      dm.chatMsgList = [];
      dm.maxChatCount = 3;
      dm.addChatMsg({ content: 'a' });
      dm.addChatMsg({ content: 'b' });
      dm.addChatMsg({ content: 'c' });
      dm.addChatMsg({ content: 'd' });
      expect(dm.chatMsgList.length).toBe(3);
      expect(dm.chatMsgList[0].content).toBe('b');
    });

    it('setNewData openroom god 模式', () => {
      dm.setNewData({
        sceneName: 'openroom', userType: 'god', roomNum: '9999',
        godData: { totalPlayerNum: 8, campAssignment: [4, 2, 1, 1] },
      });
      expect(dm.userType).toBe('god');
      expect(dm.roomCode).toBe('9999');
      expect(dm.totalPlayers).toBe(8);
    });
  });
});
