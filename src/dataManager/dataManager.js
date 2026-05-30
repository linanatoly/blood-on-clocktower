import { ServerMsgType, EV, GameDataSubType } from '../event-constants.js';

// 全局唯一实例（写在类外面，绝对稳定）
let _instance = null;

const STORAGE_KEY = 'blood_clock_session';

// 全局唯一的数据管理器（单例）
export class DataManager {
    constructor() {
        this.eventBus = null;
        // 服务器数据
        this.roomCode = "";
        this.godId = null;
        this.gameState = null;       // preparing | in_gaming | ended
        this.gamePhase = null;       // 游戏阶段
        this.totalPlayers = null;
        this.campNumbers = [];       // 村民/外来者/爪牙/恶魔
        this.roleAssignmentMode = "self_select";  // 角色选择模式
        this.userType = null;
        this.userId = null;
        this.playerList = [];        // 玩家列表（以服务端为准）
        this.localRoleNotes = {};    // 本地角色备注 { targetPlayerId: { avatarName, headImgUrl } }
        this.spyActive = false;      // 间谍模式是否激活
        this.spyData = null;         // 间谍模式服务端数据 { players, events }
        this.eventLogs = [];         // 事件记录（重连时恢复）

        // 本地数据
        this.ws = null;
        this.pendingRegister = null;  // 待处理的注册/加入信息
        this.reconnectTimer = null;
        this.reconnectInterval = 5000;

        // 消息相关数据
        this.chatMsgList = [];
        this.chatSessionList = [];
        this.maxChatCount = 80;
    }

    addChatMsg(msg) {
        this.chatMsgList.push(msg);
        if (this.chatMsgList.length > this.maxChatCount) {
            this.chatMsgList.shift();
        }
    }

    // 初始化：设置场景引用 + 按需连接 WebSocket
    init(eventBus) {
        this.eventBus = eventBus;
        if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
            console.log("🔧 DataManager init，准备连接服务器");
            this.connectServer();
        }
    }

    // ========== 房间操作 ==========

    createRoom(roomCode, totalPlayers, campAssignment) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error("❌ WebSocket 未连接，无法创建房间");
            return;
        }
        // 上帝需要 playerId 用于通信
        if (!this.userId) {
            this.userId = "god_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
        }
        const msg = {
            type: ServerMsgType.GAME_DATA,
            subType: GameDataSubType.CREATE_ROOM,
            data: {
                roomCode: roomCode,
                playerId: this.userId,
                totalPlayers: totalPlayers,
                campAssignment: campAssignment
            }
        };
        this.ws.send(JSON.stringify(msg));
        console.log("📤 创建房间消息已发送:", msg);
    }

    joinRoom(roomCode, playerId, nickName) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error("❌ WebSocket 未连接，无法加入房间");
            // 保存待加入信息，等连接成功后再发
            this.pendingRegister = { action: 'join', roomCode, playerId, nickName };
            return;
        }
        this.userId = playerId;
        this.roomCode = roomCode;
        const msg = {
            type: ServerMsgType.GAME_DATA,
            subType: GameDataSubType.JOIN_ROOM,
            data: {
                roomCode: roomCode,
                playerId: playerId,
                nickName: nickName
            }
        };
        this.ws.send(JSON.stringify(msg));
        console.log("📤 加入房间消息已发送:", msg);
    }

    // ========== 持久化（重连恢复） ==========

    saveSession() {
        if (this.userId && this.roomCode) {
            const session = { playerId: this.userId, roomCode: this.roomCode, userType: this.userType };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
            console.log("💾 会话已保存:", session);
        }
    }

    loadSession() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const session = JSON.parse(raw);
                if (session.playerId && session.roomCode) {
                    return session;
                }
            }
        } catch (e) {
            console.warn("⚠️ 读取会话失败:", e);
        }
        return null;
    }

    clearSession() {
        localStorage.removeItem(STORAGE_KEY);
    }

    _resetRoomState() {
        this.clearSession();
        this.roomCode = "";
        this.godId = null;
        this.gameState = null;
        this.gamePhase = null;
        this.playerList = [];
        this.chatMsgList = [];
        this.chatSessionList = [];
        this.spyActive = false;
        this.spyData = null;
    }

    // ========== 处理服务端消息 ==========

    handleRoomState(data) {
        console.log("🏠 收到房间状态:", data);
        // 更新所有本地数据
        this.roomCode = data.roomCode;
        this.godId = data.godId;
        this.gameState = data.gameState;
        this.gamePhase = data.gamePhase;
        this.totalPlayers = data.totalPlayers;
        this.campNumbers = data.campAssignment || [];

        // 如果自己是上帝
        if (this.userId === this.godId) {
            this.userType = 'god';
        } else {
            this.userType = 'player';
        }

        // 更新玩家列表
        this.playerList = data.players || [];
        if (data.roleAssignmentMode !== undefined) {
            this.roleAssignmentMode = data.roleAssignmentMode;
        }
        console.log("✅ 玩家列表已更新:", this.playerList);

        // 持久化
        this.saveSession();

        // 通知场景
        if (this.eventBus) {
            this.eventBus.emit(EV.ROOM_STATE_RECEIVED, data);
            this.eventBus.emit(EV.CHANGE_STATE, this.gameState);
            if (data.events !== undefined) {
                this.eventLogs = data.events;
                if (data.events.length > 0) {
                    this.eventBus.emit(EV.EVENT_REMOTE_SYNC, data.events);
                }
            }
        }
    }

    // ========== WebSocket 连接 ==========

    connectServer() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log("⚠️ WebSocket 已连接，跳过重复连接");
            return;
        }
        const hostname = window.location.hostname || 'localhost';
        console.log("🌐 连接到 WebSocket：ws://" + hostname + ":8765");
        this.ws = new WebSocket(`ws://${hostname}:8765`);

        this.ws.onopen = () => {
            console.log("✅ WebSocket 已连接");
            this.stopReconnect();
            this._startHeartbeat();
            if (this.eventBus) {
                this.eventBus.emit(EV.WS_CONNECTED);
            }

            // 检查是否有待处理的注册信息
            if (this.pendingRegister) {
                const pending = this.pendingRegister;
                this.pendingRegister = null;
                if (pending.action === 'join') {
                    this.joinRoom(pending.roomCode, pending.playerId, pending.nickName);
                    return;
                }
                if (pending.action === 'register') {
                    this.registerPlayer(pending.nickName);
                    return;
                }
            }

            // 检查是否有之前的会话（重连恢复）
            const session = this.loadSession();
            if (session && session.playerId && session.roomCode) {
                console.log("🔄 检测到之前会话，尝试重连:", session);
                this.userId = session.playerId;
                this.userType = session.userType || 'player';
                this.roomCode = session.roomCode;
                // 通知场景显示重连提示
                if (this.eventBus) {
                    this.eventBus.emit(EV.RECONNECTING, '检测到已在游戏中，正在重连...');
                }
                this.joinRoom(session.roomCode, session.playerId, session.nickName || '玩家');
            }
        };

        this.ws.onmessage = (evt) => {
            const data = JSON.parse(evt.data);
            console.log("📩 收到消息：", data);

            // 处理错误消息
            if (data.type === 'error') {
                console.error("❌ 服务器错误:", data.message);
                if (this.eventBus) {
                    this.eventBus.emit(EV.SERVER_ERROR, data.message);
                }
                return;
            }

            // 处理游戏数据消息
            if (data.type === ServerMsgType.GAME_DATA) {
                const subType = data.subType;
                const gameData = data.data;

                if (subType === GameDataSubType.ROOM_STATE) {
                    this.handleRoomState(gameData);
                    return;
                }

                if (subType === GameDataSubType.PLAYER_LIST_UPDATE) {
                    this.playerList = gameData.players;
                    console.log("✅ 更新 playerList：", this.playerList);
                    if (this.eventBus) {
                        this.eventBus.emit(EV.PLAYER_LIST_UPDATED, this.playerList);
                    }
                    return;
                }

                if (subType === GameDataSubType.GAME_STATE_UPDATE) {
                    const oldState = this.gameState;
                    const oldPhase = this.gamePhase;
                    if (gameData.gameState) {
                        this.gameState = gameData.gameState;
                    }
                    if (gameData.gamePhase !== undefined) {
                        this.gamePhase = gameData.gamePhase;
                    }
                    console.log(`游戏状态变更: ${oldState} → ${this.gameState}, 阶段: ${oldPhase} → ${this.gamePhase}`);
                    if (this.eventBus) {
                        if (this.gameState !== oldState) {
                            this.eventBus.emit(EV.CHANGE_STATE, this.gameState);
                        }
                        if (this.gamePhase !== oldPhase) {
                            this.eventBus.emit(EV.GAME_PHASE_CHANGED, this.gamePhase);
                        }
                    }
                    return;
                }

                if (subType === GameDataSubType.EVENT_RECORD) {
                    if (this.eventBus) {
                        this.eventBus.emit(EV.EVENT_REMOTE_RECORD, gameData.event);
                    }
                    return;
                }

                if (subType === GameDataSubType.EVENT_DELETE) {
                    if (this.eventBus) {
                        this.eventBus.emit(EV.EVENT_REMOTE_DELETE, gameData.eventId);
                    }
                    return;
                }

                if (subType === GameDataSubType.EVENT_SYNC) {
                    this.eventLogs = gameData.events || [];
                    if (this.eventBus) {
                        this.eventBus.emit(EV.EVENT_REMOTE_SYNC, gameData.events || []);
                    }
                    return;
                }

                if (subType === 'spy_data') {
                    this.spyData = gameData;
                    this.spyActive = true;
                    if (this.eventBus) {
                        this.eventBus.emit(EV.SPY_DATA_RECEIVED, gameData);
                    }
                    return;
                }

                if (subType === GameDataSubType.ROOM_DISMISSED) {
                    console.log("房间已解散，清除会话并返回大厅");
                    this._resetRoomState();
                    if (this.eventBus) {
                        this.eventBus.emit(EV.ROOM_DISMISSED, gameData.message || '房间已被解散');
                    }
                    return;
                }

                if (subType === GameDataSubType.ROOM_LEFT) {
                    console.log("已退出房间，清除会话并返回大厅");
                    this._resetRoomState();
                    if (this.eventBus) {
                        this.eventBus.emit(EV.ROOM_LEFT);
                    }
                    return;
                }

                if (subType === GameDataSubType.CHAT_SYNC) {
                    const chats = gameData.chats || [];
                    this.chatMsgList = chats;
                    console.log(`收到聊天记录同步: ${chats.length} 条`);
                    if (this.eventBus) {
                        this.eventBus.emit(EV.CHAT_SYNC_RECEIVED, chats);
                    }
                    return;
                }

                if (subType === GameDataSubType.SET_ROLE_MODE) {
                    return;
                }
                if (subType === GameDataSubType.ROLE_MODE_CHANGED) {
                    this.roleAssignmentMode = gameData.mode;
                    console.log(`角色选择模式变更为: ${gameData.mode}`);
                    if (this.eventBus) {
                        this.eventBus.emit(EV.ROLE_MODE_CHANGED, gameData.mode);
                    }
                    return;
                }
                return;
            }

            // 处理聊天消息
            if (data.type === ServerMsgType.CHAT) {
                if (data.senderId !== this.userId && data.subType !== 'group_session_created') {
                    this.addChatMsg(data);
                }
                this.eventBus?.emit(EV.GET_SERVER_MSG, data);
            }
        };

        this.ws.onclose = () => {
            console.log("❌ WebSocket 断开连接");
            this._stopHeartbeat();
            if (this.eventBus) {
                this.eventBus.emit(EV.WS_DISCONNECTED);
            }
            this.startReconnect();
        };

        this.ws.onerror = (error) => {
            console.error("❌ WebSocket 错误:", error);
        };
    }

    _startHeartbeat() {
        this._stopHeartbeat();
        this._heartbeatTimer = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ type: 'ping' }));
            }
        }, 25000);
    }

    _stopHeartbeat() {
        if (this._heartbeatTimer) {
            clearInterval(this._heartbeatTimer);
            this._heartbeatTimer = null;
        }
    }

    startReconnect() {
        if (this.reconnectTimer) return;
        console.log(`⏳ 开始断线重连，每${this.reconnectInterval / 1000}秒尝试一次...`);
        this.reconnectTimer = setInterval(() => {
            console.log("🔄 尝试重新连接服务器...");
            this.connectServer();
        }, this.reconnectInterval);
    }

    stopReconnect() {
        if (this.reconnectTimer) {
            clearInterval(this.reconnectTimer);
            this.reconnectTimer = null;
            console.log("✅ 停止重连");
        }
    }

    // ========== 玩家操作 ==========

    registerPlayer(nickName) {
        console.log("📝 准备注册玩家，nickName:", nickName);
        if (!this.userId) return;

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const msg = {
                type: ServerMsgType.GAME_DATA,
                subType: GameDataSubType.REGISTER,
                data: {
                    playerId: this.userId,
                    nickName: nickName || '玩家'
                }
            };
            console.log("📤 发送注册消息：", JSON.stringify(msg));
            this.ws.send(JSON.stringify(msg));
        } else {
            console.log("⏳ WebSocket 未就绪，保存注册信息等待连接成功后发送");
            this.pendingRegister = { action: 'register', nickName: nickName || '玩家' };
        }
    }

    sendSitDown(playerId, seatNum) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        const msg = {
            type: ServerMsgType.GAME_DATA,
            subType: GameDataSubType.SIT_DOWN,
            data: { playerId: playerId, seatNum: seatNum }
        };
        this.ws.send(JSON.stringify(msg));
    }

    sendAvatarSelect(playerId, avatarInfo, seatNum) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        const msg = {
            type: ServerMsgType.GAME_DATA,
            subType: GameDataSubType.AVATAR_SELECT,
            data: {
                playerId: playerId,
                avatarName: avatarInfo.text,
                headImgUrl: avatarInfo.imgKey,
                seatNum: seatNum
            }
        };
        this.ws.send(JSON.stringify(msg));
    }

    sendPlayerReady(playerId) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        const msg = {
            type: ServerMsgType.GAME_DATA,
            subType: GameDataSubType.PLAYER_READY,
            data: { playerId }
        };
        this.ws.send(JSON.stringify(msg));
    }

    allPlayersReady() {
        const seatedPlayers = this.playerList.filter(
            p => p.seatNum !== null && p.playerId !== this.godId
        );
        if (seatedPlayers.length === 0) {
            return { allReady: false, unreadyNames: [], reason: 'no_players' };
        }
        const unready = seatedPlayers.filter(p => !p.ready);
        return {
            allReady: unready.length === 0,
            unreadyNames: unready.map(p => p.nickName || '玩家'),
            reason: unready.length > 0 ? 'unready' : null
        };
    }

    sendStartGame() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error("WebSocket 未连接，无法开始游戏");
            return { allReady: false, unreadyNames: [], reason: 'no_connection' };
        }
        const validation = this.allPlayersReady();
        if (!validation.allReady) {
            return validation;
        }
        const msg = {
            type: ServerMsgType.GAME_DATA,
            subType: GameDataSubType.START_GAME,
            data: {
                roomCode: this.roomCode,
                playerId: this.userId
            }
        };
        this.ws.send(JSON.stringify(msg));
        console.log("开始游戏请求已发送:", msg);
        return { allReady: true, unreadyNames: [] };
    }

    sendPlayerStateChange(targetPlayerId, newState) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        const msg = {
            type: ServerMsgType.GAME_DATA,
            subType: GameDataSubType.SET_PLAYER_STATE,
            data: {
                roomCode: this.roomCode,
                playerId: this.userId,
                targetPlayerId: targetPlayerId,
                newState: newState
            }
        };
        this.ws.send(JSON.stringify(msg));
        console.log("玩家状态变更请求已发送:", msg);
    }

    sendSetDrunk(targetPlayerId) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        const msg = {
            type: ServerMsgType.GAME_DATA,
            subType: GameDataSubType.SET_DRUNK,
            data: {
                targetPlayerId: targetPlayerId,
                playerId: this.userId
            }
        };
        this.ws.send(JSON.stringify(msg));
        console.log("设置酒鬼请求已发送:", msg);
    }

    sendPhaseChange(direction) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        const msg = {
            type: ServerMsgType.GAME_DATA,
            subType: GameDataSubType.CHANGE_PHASE,
            data: {
                roomCode: this.roomCode,
                playerId: this.userId,
                direction: direction
            }
        };
        this.ws.send(JSON.stringify(msg));
        console.log("阶段切换请求已发送:", direction);
    }

    sendEndGame() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        const msg = {
            type: ServerMsgType.GAME_DATA,
            subType: GameDataSubType.END_GAME,
            data: {
                roomCode: this.roomCode,
                playerId: this.userId
            }
        };
        this.ws.send(JSON.stringify(msg));
        console.log("结束游戏请求已发送");
    }

    sendBackToPreparing() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        const msg = {
            type: ServerMsgType.GAME_DATA,
            subType: GameDataSubType.BACK_TO_PREPARING,
            data: {
                roomCode: this.roomCode,
                playerId: this.userId
            }
        };
        this.ws.send(JSON.stringify(msg));
        console.log("返回准备阶段请求已发送");
    }

    sendSetRoleMode(mode) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.warn("WebSocket 未连接，无法发送模式切换请求");
            return false;
        }
        const msg = {
            type: ServerMsgType.GAME_DATA,
            subType: GameDataSubType.SET_ROLE_MODE,
            data: {
                roomCode: this.roomCode,
                mode: mode
            }
        };
        this.ws.send(JSON.stringify(msg));
        console.log("角色选择模式切换请求已发送:", mode);
        return true;
    }

    sendDismissRoom() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        const msg = {
            type: ServerMsgType.GAME_DATA,
            subType: GameDataSubType.DISMISS_ROOM,
            data: {
                roomCode: this.roomCode,
                playerId: this.userId
            }
        };
        this.ws.send(JSON.stringify(msg));
        console.log("解散房间请求已发送");
    }

    sendLeaveRoom() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        const msg = {
            type: ServerMsgType.GAME_DATA,
            subType: GameDataSubType.LEAVE_ROOM,
            data: {
                roomCode: this.roomCode,
                playerId: this.userId
            }
        };
        this.ws.send(JSON.stringify(msg));
        console.log("退出房间请求已发送");
    }

    sendSpyRequest() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        const msg = {
            type: ServerMsgType.GAME_DATA,
            subType: GameDataSubType.SPY_REQUEST,
            data: {
                roomCode: this.roomCode,
                playerId: this.userId
            }
        };
        this.ws.send(JSON.stringify(msg));
        console.log("间谍模式数据请求已发送");
    }

    sendChatMessage(subType, payload) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        const msg = {
            type: ServerMsgType.CHAT,
            subType: subType,
            ...payload
        };
        this.ws.send(JSON.stringify(msg));
    }

    sendEventRecord(eventData) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        const msg = {
            type: ServerMsgType.GAME_DATA,
            subType: GameDataSubType.EVENT_RECORD,
            data: {
                roomCode: this.roomCode,
                playerId: this.userId,
                event: eventData
            }
        };
        this.ws.send(JSON.stringify(msg));
    }

    sendEventDelete(eventId) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        const msg = {
            type: ServerMsgType.GAME_DATA,
            subType: GameDataSubType.EVENT_DELETE,
            data: {
                roomCode: this.roomCode,
                playerId: this.userId,
                eventId: eventId
            }
        };
        this.ws.send(JSON.stringify(msg));
    }

    // ========== 辅助方法 ==========

    clearSessionUnRead(sessionKey) {
        const session = this.chatSessionList.find(s => s.key === sessionKey);
        if (session) session.unRead = 0;
    }

    setNewData(data) {
        if (data.sceneName === 'openroom') {
            this.userType = data.userType;
            if (this.userType === 'god') {
                this.roomCode = data.roomNum;
                this.totalPlayers = data.godData.totalPlayerNum;
                this.campNumbers = data.godData.campAssignment;
            } else {
                // 玩家模式：保存 playerId（不再手动 push 到 playerList，由服务端管理）
                this.userId = data.playerData.playerId;
            }
        } else if (data.sceneName === 'main') {
            if (this.gameState == null) {
                this.gameState = data.gameStateNow;
            }
        }
        this.dataRefresh();
    }

    dataRefresh() {
        console.log("数据更新",
            "房间号:", this.roomCode,
            "总人数:", this.totalPlayers,
            "阵营:", this.campNumbers,
            "用户类型:", this.userType,
            "用户ID:", this.userId,
            "玩家列表:", this.playerList,
        );
    }

    static getInstance() {
        if (!_instance) {
            _instance = new DataManager();
        }
        return _instance;
    }
}
