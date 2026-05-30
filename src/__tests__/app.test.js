import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EV } from '../event-constants.js';

// ===========================================================================
// Mock 工厂（顶层注册，vitest 自动 hoist）
// ===========================================================================
const mockEB = {
  _listeners: new Map(),
  on(event, fn) {
    if (!this._listeners.has(event)) this._listeners.set(event, []);
    this._listeners.get(event).push(fn);
  },
  off(event, fn) {
    const arr = this._listeners.get(event);
    if (!arr) return;
    const i = arr.indexOf(fn);
    if (i !== -1) arr.splice(i, 1);
  },
  emit(event, ...args) {
    const arr = this._listeners.get(event);
    if (arr) arr.forEach(fn => fn(...args));
  },
  removeAllListeners() { this._listeners.clear(); },
};

const mockStore = { current: null };

vi.mock('../core/EventBus.js', () => ({
  EventBus: vi.fn(() => mockEB),
}));

vi.mock('../dataManager/dataManager.js', () => ({
  DataManager: {
    getInstance: () => mockStore.current,
  },
}));

vi.mock('../PlayerManager.js', () => ({
  PlayerManager: vi.fn(() => ({})),
}));

vi.mock('../ChatManager.js', () => ({
  ChatManager: vi.fn(() => ({})),
}));

vi.mock('../EventLogManager.js', () => ({
  EventLogManager: vi.fn(() => ({})),
}));

let lobbyPageInstance = null;
vi.mock('../LobbyPage.js', () => ({
  LobbyPage: vi.fn(function (eb, el) {
    this.eventBus = eb;
    this.el = el;
    this.showReconnecting = vi.fn();
    this.hideReconnecting = vi.fn();
    lobbyPageInstance = this;
  }),
}));

let gameTableInstance = null;
vi.mock('../uiManager/GameTable.js', () => ({
  GameTable: vi.fn(function () {
    this.createSeats = vi.fn();
    this.refresh = vi.fn();
    this.hideAllReadyBadges = vi.fn();
    this.resetReadyBadges = vi.fn();
    gameTableInstance = this;
  }),
}));

let seatPopupInstance = null;
vi.mock('../uiManager/SeatPopup.js', () => ({
  SeatPopup: vi.fn(function () {
    this.show = vi.fn();
    this.hide = vi.fn();
    seatPopupInstance = this;
  }),
}));

let chatPanelInstance = null;
vi.mock('../uiManager/ChatPanel.js', () => ({
  ChatPanel: vi.fn(function () {
    this.show = vi.fn();
    this.hide = vi.fn();
    this.openSession = vi.fn();
    this.renderSessionList = vi.fn();
    this.renderChatMsg = vi.fn();
    this.currentSession = null;
    chatPanelInstance = this;
  }),
}));

let eventLogPanelInstance = null;
vi.mock('../uiManager/EventLogPanel.js', () => ({
  EventLogPanel: vi.fn(function () {
    this.show = vi.fn();
    this.hide = vi.fn();
    eventLogPanelInstance = this;
  }),
}));

vi.mock('../uiManager/RoleSelectPopup.js', () => ({
  RoleSelectPopup: vi.fn(function () { this.show = vi.fn(); this.hide = vi.fn(); }),
}));

vi.mock('../uiManager/GroupChatPopup.js', () => ({
  GroupChatPopup: vi.fn(function () { this.show = vi.fn(); this.hide = vi.fn(); }),
}));

vi.mock('../uiManager/WaitingList.js', () => ({
  WaitingList: vi.fn(function () { this.show = vi.fn(); this.hide = vi.fn(); }),
}));

vi.mock('../uiManager/FunctionPanel.js', () => ({
  FunctionPanel: vi.fn(function () { this.show = vi.fn(); this.hide = vi.fn(); }),
}));

// ===========================================================================
// DOM 辅助
// ===========================================================================
function setupDom() {
  document.body.innerHTML = `
    <div id="app">
      <div id="page-lobby"></div>
      <div id="page-game" class="hidden">
        <div id="game-main"></div>
        <div id="panel-chat"></div>
        <div id="panel-event-log"></div>
        <div id="panel-function"></div>
        <div id="overlay-avatar"></div>
        <div id="overlay-group-chat"></div>
        <div id="overlay-seat-popup"></div>
        <div id="overlay-waiting-list"></div>
      </div>
    </div>
  `;
}

// ===========================================================================
// 测试
// ===========================================================================
describe('App', () => {
  beforeEach(() => {
    vi.resetModules();
    mockEB._listeners.clear();
    lobbyPageInstance = null;
    gameTableInstance = null;
    seatPopupInstance = null;
    chatPanelInstance = null;
    eventLogPanelInstance = null;
    setupDom();
    mockStore.current = {
      init: vi.fn(),
      clearSession: vi.fn(),
      gameState: null,
      totalPlayers: 12,
      playerList: [],
      userId: null,
      userType: null,
      saveSession: vi.fn(),
      loadSession: vi.fn(() => null),
      registerPlayer: vi.fn(),
      sendSitDown: vi.fn(),
      sendAvatarSelect: vi.fn(),
      sendPlayerReady: vi.fn(),
      sendPlayerStateChange: vi.fn(),
      sendSetDrunk: vi.fn(),
      sendStartGame: vi.fn(() => ({ allReady: true })),
      sendEndGame: vi.fn(),
      clearSessionUnRead: vi.fn(),
    };
  });

  afterEach(() => {
    document.body.innerHTML = '';
    delete window.__bloodclock;
  });

  async function createApp() {
    const mod = await import('../app.js');
    return { App: mod.App, app: mod.app };
  }

  describe('构造初始化', () => {
    it('创建 EventBus 并初始化 DataManager', async () => {
      const { app } = await createApp();
      expect(app.eventBus).toBe(mockEB);
      expect(mockStore.current.init).toHaveBeenCalledWith(mockEB);
    });

    it('创建三个业务 Manager', async () => {
      const { app } = await createApp();
      expect(app.managers.playerManager).toBeDefined();
      expect(app.managers.chatManager).toBeDefined();
      expect(app.managers.eventLogManager).toBeDefined();
    });

    it('缓存关键 DOM 元素', async () => {
      const { app } = await createApp();
      expect(app.els.lobby).toBeInstanceOf(HTMLElement);
      expect(app.els.game).toBeInstanceOf(HTMLElement);
      expect(app.els.gameMain).toBeInstanceOf(HTMLElement);
      expect(app.currentPage).toBe('lobby');
    });

    it('初始化 LobbyPage', async () => {
      const { LobbyPage } = await import('../LobbyPage.js');
      await createApp();
      expect(LobbyPage).toHaveBeenCalled();
    });

    it('绑定 resize / orientationchange 事件', async () => {
      const addSpy = vi.spyOn(window, 'addEventListener');
      await createApp();
      expect(addSpy).toHaveBeenCalledWith('resize', expect.any(Function));
      expect(addSpy).toHaveBeenCalledWith('orientationchange', expect.any(Function));
      addSpy.mockRestore();
    });

    it('导出全局引用 window.__bloodclock', async () => {
      const { app } = await createApp();
      expect(window.__bloodclock).toBeDefined();
      expect(window.__bloodclock.app).toBe(app);
      expect(window.__bloodclock.dm).toBe(mockStore.current);
    });
  });

  describe('页面路由', () => {
    it('ROOM_STATE_RECEIVED 切换到 game 页面', async () => {
      const { app } = await createApp();
      app.currentPage = 'lobby';
      app.els.game.classList.add('hidden');
      app.els.lobby.classList.remove('hidden');

      mockEB.emit(EV.ROOM_STATE_RECEIVED, { players: [] });

      expect(app.els.lobby.classList.contains('hidden')).toBe(true);
      expect(app.els.game.classList.contains('hidden')).toBe(false);
      expect(app.currentPage).toBe('game');
    });

    it('ROOM_DISMISSED 清除 session 并切回 lobby', async () => {
      const { app } = await createApp();
      app.currentPage = 'game';
      app.els.lobby.classList.add('hidden');
      app.els.game.classList.remove('hidden');

      mockEB.emit(EV.ROOM_DISMISSED);

      expect(mockStore.current.clearSession).toHaveBeenCalled();
      expect(app.els.game.classList.contains('hidden')).toBe(true);
      expect(app.els.lobby.classList.contains('hidden')).toBe(false);
      expect(app.currentPage).toBe('lobby');
    });

    it('_navigateTo 同页面不重复切换', async () => {
      const { app } = await createApp();
      app.currentPage = 'game';
      app.els.game.classList.remove('hidden');
      app._navigateTo('game');
      expect(app.els.game.classList.contains('hidden')).toBe(false);
    });

    it('RECONNECTING 事件显示重连提示', async () => {
      const { app } = await createApp();
      mockEB.emit(EV.RECONNECTING, '正在重连...');
      expect(lobbyPageInstance.showReconnecting).toHaveBeenCalledWith('正在重连...');
    });
  });

  describe('懒初始化游戏组件', () => {
    it('首次进入 game 页面时创建所有组件', async () => {
      const { app } = await createApp();
      expect(app._componentsInited).toBe(false);

      app._navigateTo('game');

      expect(app._componentsInited).toBe(true);
      expect(app.components.gameTable).toBeDefined();
      expect(app.components.seatPopup).toBeDefined();
      expect(app.components.roleSelectPopup).toBeDefined();
      expect(app.components.groupChatPopup).toBeDefined();
      expect(app.components.chatPanel).toBeDefined();
      expect(app.components.eventLogPanel).toBeDefined();
      expect(app.components.waitingList).toBeDefined();
      expect(app.components.functionPanel).toBeDefined();
    });

    it('再次进入时不重复创建组件', async () => {
      const { GameTable } = await import('../uiManager/GameTable.js');
      const { app } = await createApp();
      app._navigateTo('game');
      const callCount = GameTable.mock.calls.length;
      app._navigateTo('lobby');
      app._navigateTo('game');
      expect(GameTable.mock.calls.length).toBe(callCount);
    });

    it('根据 totalPlayers 创建座位', async () => {
      mockStore.current.totalPlayers = 8;
      const { app } = await createApp();
      app._navigateTo('game');
      expect(gameTableInstance.createSeats).toHaveBeenCalledWith(8);
    });
  });

  describe('_showToast', () => {
    it('创建 toast 并 3 秒后自动移除', async () => {
      vi.useFakeTimers();
      const { app } = await createApp();
      const appEl = document.getElementById('app');

      app._showToast('错误信息');
      expect(appEl.querySelector('.app-toast')).toBeTruthy();
      expect(appEl.querySelector('.app-toast').textContent).toBe('错误信息');

      vi.advanceTimersByTime(3100);
      expect(appEl.querySelector('.app-toast')).toBeNull();

      vi.useRealTimers();
    });
  });

  describe('事件编排', () => {
    it('PLAYER_LIST_UPDATED 刷新 GameTable', async () => {
      const { app } = await createApp();
      app._navigateTo('game');
      const players = [{ playerId: 'p1', nickName: 'test' }];
      mockEB.emit(EV.PLAYER_LIST_UPDATED, players);
      expect(gameTableInstance.refresh).toHaveBeenCalledWith(players);
    });

    it('CHANGE_STATE → in_gaming 隐藏等待列表和准备标记', async () => {
      const { app } = await createApp();
      app._navigateTo('game');
      mockEB.emit(EV.CHANGE_STATE, 'in_gaming');
      expect(app.components.waitingList.hide).toHaveBeenCalled();
      expect(gameTableInstance.hideAllReadyBadges).toHaveBeenCalled();
    });

    it('CHANGE_STATE → preparing 重置准备标记', async () => {
      const { app } = await createApp();
      app._navigateTo('game');
      mockEB.emit(EV.CHANGE_STATE, 'preparing');
      expect(gameTableInstance.resetReadyBadges).toHaveBeenCalled();
    });

    it('SERVER_ERROR 显示 toast', async () => {
      vi.useFakeTimers();
      const { app } = await createApp();
      mockEB.emit(EV.SERVER_ERROR, '房间不存在');
      expect(document.querySelector('.app-toast').textContent).toBe('房间不存在');
      vi.advanceTimersByTime(3100);
      vi.useRealTimers();
    });

    it('ROOM_START_GAME 未准备时显示 toast', async () => {
      vi.useFakeTimers();
      mockStore.current.userType = 'god';
      mockStore.current.sendStartGame = vi.fn(() => ({
        allReady: false,
        reason: 'some_unready',
        unreadyNames: ['小明', '小红'],
      }));
      const { app } = await createApp();
      mockEB.emit(EV.ROOM_START_GAME);
      expect(document.querySelector('.app-toast').textContent).toContain('小明');
      vi.advanceTimersByTime(3100);
      vi.useRealTimers();
    });

    it('非上帝用户 ROOM_START_GAME 不处理', async () => {
      mockStore.current.userType = 'player';
      const { app } = await createApp();
      mockEB.emit(EV.ROOM_START_GAME);
      expect(mockStore.current.sendStartGame).not.toHaveBeenCalled();
    });

    it('ROOM_END_GAME 非上帝不处理', async () => {
      mockStore.current.userType = 'player';
      const { app } = await createApp();
      mockEB.emit(EV.ROOM_END_GAME);
      expect(mockStore.current.sendEndGame).not.toHaveBeenCalled();
    });

    it('OPEN_EVENT_LOG 打开事件记录器', async () => {
      const { app } = await createApp();
      app._navigateTo('game');
      mockEB.emit(EV.OPEN_EVENT_LOG);
      expect(eventLogPanelInstance.show).toHaveBeenCalled();
    });

    it('OPEN_CHAT 打开聊天面板', async () => {
      const { app } = await createApp();
      app._navigateTo('game');
      mockEB.emit(EV.OPEN_CHAT);
      expect(chatPanelInstance.show).toHaveBeenCalled();
    });
  });

  describe('视口缩放', () => {
    it('_applyViewportScale 设置 CSS 变量', async () => {
      const { app } = await createApp();
      app._applyViewportScale();
      const style = document.documentElement.style;
      expect(style.getPropertyValue('--viewport-scale')).toBeTruthy();
      expect(style.getPropertyValue('--rs')).toBeTruthy();
    });

    it('无 #app 元素时不抛错', async () => {
      document.getElementById('app').remove();
      const { app } = await createApp();
      expect(() => app._applyViewportScale()).not.toThrow();
    });
  });
});
