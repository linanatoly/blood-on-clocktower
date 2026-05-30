import { EventBus } from './core/EventBus.js';
import { EV, ChatSubType } from './event-constants.js';
import { DataManager } from './dataManager/dataManager.js';
import { PlayerManager } from './PlayerManager.js';
import { ChatManager } from './ChatManager.js';
import { EventLogManager } from './EventLogManager.js';
import { LobbyPage } from './LobbyPage.js';

// UI 组件（懒加载：进入游戏页面时才导入）
import { GameTable } from './uiManager/GameTable.js';
import { SeatPopup } from './uiManager/SeatPopup.js';
import { ChatPanel } from './uiManager/ChatPanel.js';
import { EventLogPanel } from './uiManager/EventLogPanel.js';
import { RoleSelectPopup } from './uiManager/RoleSelectPopup.js';
import { GroupChatPopup } from './uiManager/GroupChatPopup.js';
import { WaitingList } from './uiManager/WaitingList.js';
import { FunctionPanel } from './uiManager/FunctionPanel.js';

class App {
  constructor() {
    this.eventBus = new EventBus();
    this.dm = DataManager.getInstance();
    this.dm.init(this.eventBus);

    this.managers = {};
    this.components = {};
    this.pages = {};
    this.currentPage = 'lobby';
    this._componentsInited = false;

    this._cacheDomElements();
    this._applyViewportScale();
    this._initKeyboardHandler();
    this._initManagers();
    this._initPages();
    this._bindEvents();

    window.addEventListener('resize', () => {
      // 键盘未弹出时才更新全屏高度，避免保存键盘压缩后的高度
      if (!this._keyboardOffset) {
        this._fullViewportHeight = window.innerHeight;
      }
      this._applyViewportScale();
    });
    window.addEventListener('orientationchange', () => {
      setTimeout(() => this._applyViewportScale(), 100);
    });
  }

  // ===================================================================
  // DOM 缓存
  // ===================================================================
  _cacheDomElements() {
    this.els = {
      lobby: document.getElementById('page-lobby'),
      game: document.getElementById('page-game'),
      gameMain: document.getElementById('game-main'),
      panelChat: document.getElementById('panel-chat'),
      panelEventLog: document.getElementById('panel-event-log'),
      panelFunction: document.getElementById('panel-function'),
      overlayAvatar: document.getElementById('overlay-avatar'),
      overlayGroupChat: document.getElementById('overlay-group-chat'),
      overlaySeatPopup: document.getElementById('overlay-seat-popup'),
      overlayWaitingList: document.getElementById('overlay-waiting-list'),
    };
  }

  // ===================================================================
  // 业务逻辑层
  // ===================================================================
  _initManagers() {
    this.managers.playerManager = new PlayerManager(this.eventBus);
    this.managers.chatManager = new ChatManager(this.eventBus, this.dm);
    this.managers.eventLogManager = new EventLogManager(this.eventBus);
  }

  // ===================================================================
  // 页面层
  // ===================================================================
  _initPages() {
    this.pages.lobby = new LobbyPage(this.eventBus, this.els.lobby);
  }

  // ===================================================================
  // 全局事件绑定（App 级编排）
  // ===================================================================
  _bindEvents() {
    const eb = this.eventBus;

    // --- 页面路由 ---
    eb.on(EV.ROOM_STATE_RECEIVED, () => this._navigateTo('game'));
    const returnToLobby = () => {
      this.dm.clearSession();
      this._navigateTo('lobby');
    };
    eb.on(EV.ROOM_DISMISSED, returnToLobby);
    eb.on(EV.ROOM_LEFT, returnToLobby);
    eb.on(EV.RECONNECTING, (msg) => this._showReconnecting(msg));

    // --- 座位点击 → 弹窗 ---
    eb.on(EV.SEAT_CLICK_WITH_ID, (seatIndex) => {
      const cfg = this.managers.playerManager.getPopupButtonConfig(seatIndex);
      if (cfg.showPopup === false) return;
      if (this.components.seatPopup) {
        this.components.seatPopup.show(seatIndex, cfg);
      }
    });

    // --- 入座 ---
    eb.on(EV.SEAT_SITDOWN, (playerId, seatNum) => {
      this.dm.sendSitDown(playerId, seatNum);
      if (this.components.seatPopup) this.components.seatPopup.hide();
    });

    // --- 座位/玩家列表刷新 ---
    eb.on(EV.PLAYER_LIST_UPDATED, (playerList) => {
      if (this.components.gameTable) {
        this.components.gameTable.refresh(playerList);
      }
    });
    eb.on(EV.ROOM_STATE_RECEIVED, (roomState) => {
      if (this.currentPage === 'game' && this.components.gameTable) {
        this.components.gameTable.refresh(roomState.players || []);
      }
    });

    // --- 角色选择模式变更 → 关闭弹窗（避免按钮显示过时） ---
    eb.on(EV.ROLE_MODE_CHANGED, () => {
      if (this.components.seatPopup) this.components.seatPopup.hide();
      if (this.components.roleSelectPopup) this.components.roleSelectPopup.hide();
    });

    // --- 角色选择弹窗 ---
    eb.on(EV.AVATAR_OPEN, (playerId, chooseModel, seatNum) => {
      if (this.components.roleSelectPopup) {
        this.components.roleSelectPopup.show(playerId, chooseModel, seatNum);
      }
    });

    // --- 角色确认完成 ---
    eb.on(EV.AVATAR_CONFIRM, (playerId, chooseList, seatNum) => {
      const pm = this.managers.playerManager;
      const targetPlayer = this.dm.playerList.find(p => p.seatNum === seatNum);
      const isInGameOther = this.dm.gameState === 'in_gaming'
        && this.dm.userType !== 'god'
        && targetPlayer
        && targetPlayer.playerId !== this.dm.userId;

      if (isInGameOther) {
        const noted = pm.setLocalRoleNote(targetPlayer.playerId, chooseList);
        if (noted && this.components.gameTable) {
          this.components.gameTable.refresh(this.dm.playerList);
        }
      } else {
        const needToRefresh = pm.chooseAvatr(playerId, chooseList);
        if (needToRefresh && needToRefresh.length > 0) {
          this.dm.sendAvatarSelect(playerId, chooseList[0], seatNum);
        }
        if (this.components.gameTable) {
          this.components.gameTable.refresh(this.dm.playerList);
        }
      }
    });

    // --- 私聊 ---
    eb.on(EV.START_CHAT, (seatNum) => {
      const cm = this.managers.chatManager;
      const session = cm.getOrCreatePrivateSession(seatNum);
      if (session && this.components.chatPanel) {
        this.components.chatPanel.show();
        this.components.chatPanel.openSession(session);
      }
    });

    // --- 聊天数据更新 → 刷新会话列表 ---
    eb.on(EV.CHAT_DATA_UPDATE, () => {
      if (this.components.chatPanel) {
        this.components.chatPanel.renderSessionList();
      }
    });

    // --- 服务端聊天记录同步 → 重建会话 ---
    eb.on(EV.CHAT_SYNC_RECEIVED, (messages) => {
      this.managers.chatManager.syncFromServer(messages);
    });

    // --- 会话详情页打开/关闭 ---
    eb.on(EV.CHATUI_OPEN_SESSION, (session) => {
      this.dm.clearSessionUnRead(session.key);
      const msgs = this.managers.chatManager.getSessionMsg(session.key);
      if (this.components.chatPanel) {
        this.components.chatPanel.renderChatMsg(msgs);
      }
    });

    // --- 发送消息 ---
    eb.on(EV.SEND_MSG, (content, session) => {
      if (!content || !session) return;
      this.managers.chatManager.sendMessage(session.key, content);
      const panel = this.components.chatPanel;
      if (panel && panel.currentSession && panel.currentSession.key === session.key) {
        const msgs = this.managers.chatManager.getSessionMsg(session.key);
        panel.renderChatMsg(msgs);
      }
    });

    // --- 收到服务端消息 ---
    eb.on(EV.GET_SERVER_MSG, (msg) => {
      const cm = this.managers.chatManager;
      const panel = this.components.chatPanel;
      if (msg.subType === ChatSubType.PRIVATE || msg.subType === ChatSubType.GOD_GROUP) {
        cm.receiveMessage(msg);
        if (panel && panel.currentSession) {
          panel.renderChatMsg(cm.getSessionMsg(panel.currentSession.key));
        }
      } else if (msg.subType === ChatSubType.GROUP_SESSION_CREATED) {
        cm.receiveMessage(msg);
      }
    });

    // --- 游戏状态切换 ---
    eb.on(EV.CHANGE_STATE, (newState) => {
      if (newState === 'in_gaming') {
        if (this.components.waitingList) this.components.waitingList.hide();
        if (this.components.gameTable) this.components.gameTable.hideAllReadyBadges();
      }
      if (newState === 'preparing') {
        if (this.components.gameTable) this.components.gameTable.resetReadyBadges();
        if (this.components.waitingList) this.components.waitingList.show();
      }
    });

    // --- 群聊 ---
    eb.on(EV.GROUP_CHAT_OPEN, () => {
      if (this.components.groupChatPopup) {
        this.components.groupChatPopup.show();
      }
    });
    eb.on(EV.GROUP_CHAT_CREATE, (playerIds) => {
      const session = this.managers.chatManager.getOrCreateGroupSession(playerIds);
      if (session && this.components.chatPanel) {
        this.components.chatPanel.show();
        this.components.chatPanel.openSession(session);
      }
    });

    // --- 底部栏：打开聊天 ---
    eb.on(EV.OPEN_CHAT, () => {
      if (this.components.chatPanel) {
        this.components.chatPanel.show();
      }
    });

    // --- 底部栏：打开事件记录器 ---
    eb.on(EV.OPEN_EVENT_LOG, () => {
      if (this.components.eventLogPanel) {
        this.components.eventLogPanel.show();
      }
    });

    // --- 服务端同步事件（非上帝自动打开） ---
    eb.on(EV.EVENT_REMOTE_SYNC, () => {
      if (this.dm.userType !== 'god' && this.components.eventLogPanel) {
        this.components.eventLogPanel.show();
      }
    });

    // --- 间谍模式 ---
    eb.on(EV.SPY_DATA_RECEIVED, (payload) => {
      this.managers.eventLogManager.setSpyEvents(payload.events || []);
      if (this.components.gameTable) {
        this.components.gameTable.refresh(this.dm.playerList);
      }
    });
    eb.on(EV.SPY_MODE_OFF, () => {
      this.managers.eventLogManager._spyEvents = null;
      if (this.components.gameTable) {
        this.components.gameTable.refresh(this.dm.playerList);
      }
    });

    // --- 准备/取消准备 → 转发到服务端 ---
    eb.on(EV.PLAYER_READY, () => this.dm.sendPlayerReady(this.dm.userId));
    eb.on(EV.PLAYER_UNREADY, () => this.dm.sendPlayerReady(this.dm.userId));

    // --- 上帝设置玩家状态 ---
    eb.on(EV.PLAYER_STATUS_CHANGE, ({ targetPlayerId, newState }) => {
      const target = this.dm.playerList.find(p => p.playerId === targetPlayerId);
      if (target && target.seatNum !== null && this.components.gameTable) {
        target.stateNow = newState;
        this.components.gameTable.refresh(this.dm.playerList);
      }
      this.dm.sendPlayerStateChange(targetPlayerId, newState);
    });

    // --- 上帝设置酒鬼 ---
    eb.on(EV.PLAYER_SET_DRUNK, ({ targetPlayerId }) => {
      const target = this.dm.playerList.find(p => p.playerId === targetPlayerId);
      if (target) {
        if (!target.drunk) {
          this.dm.playerList.forEach(p => {
            if (p.drunk && p.playerId !== targetPlayerId) p.drunk = false;
          });
        }
        target.drunk = !target.drunk;
        if (this.components.gameTable) {
          this.components.gameTable.refresh(this.dm.playerList);
        }
      }
      this.dm.sendSetDrunk(targetPlayerId);
    });

    // --- 上帝开始/结束游戏 ---
    eb.on(EV.ROOM_START_GAME, () => {
      if (this.dm.userType !== 'god') return;
      const result = this.dm.sendStartGame();
      if (!result.allReady) {
        if (result.reason === 'no_players') {
          this._showToast('没有玩家入座，无法开始游戏');
        } else if (result.reason === 'no_connection') {
          this._showToast('WebSocket 未连接，无法开始游戏');
        } else {
          this._showToast('以下玩家尚未准备: ' + result.unreadyNames.join(', '));
        }
      }
    });
    eb.on(EV.ROOM_END_GAME, () => {
      if (this.dm.userType !== 'god') return;
      this.dm.sendEndGame();
    });

    // --- 服务端错误 toast ---
    eb.on(EV.SERVER_ERROR, (errorMsg) => {
      if (this.currentPage === 'lobby') {
        this.dm.clearSession();
        return; // 大厅页的错误由 LobbyPage 内联显示，不弹 toast
      }
      this._showToast(errorMsg);
    });
  }

  // ===================================================================
  // 页面路由
  // ===================================================================
  _navigateTo(page) {
    if (page === this.currentPage) return;
    this.currentPage = page;

    if (page === 'game') {
      this.els.lobby.classList.add('hidden');
      this.els.game.classList.remove('hidden');
      if (this.els.overlayWaitingList) this.els.overlayWaitingList.classList.remove('hidden');
      this._hideReconnecting();
      if (!this._componentsInited) {
        this._initGameComponents();
      } else if (this.components.gameTable) {
        this.components.gameTable.createSeats(this.dm.totalPlayers || 12);
      }
    } else {
      this.els.game.classList.add('hidden');
      this.els.lobby.classList.remove('hidden');
      if (this.els.overlayWaitingList) this.els.overlayWaitingList.classList.add('hidden');
    }
  }

  // ===================================================================
  // 游戏组件懒初始化（首次进入 game 页面时调用，替代 Start.create）
  // ===================================================================
  _initGameComponents() {
    const eb = this.eventBus;

    this.components.gameTable = new GameTable(eb, this.els.gameMain);
    this.components.seatPopup = new SeatPopup(eb, this.els.overlaySeatPopup);
    this.components.roleSelectPopup = new RoleSelectPopup(eb, this.els.overlayAvatar);
    this.components.groupChatPopup = new GroupChatPopup(eb, this.els.overlayGroupChat);
    this.components.chatPanel = new ChatPanel(eb, this.els.panelChat);
    this.components.eventLogPanel = new EventLogPanel(eb, this.els.panelEventLog, this.managers.eventLogManager);
    this.components.waitingList = new WaitingList(eb, this.els.overlayWaitingList);
    this.components.functionPanel = new FunctionPanel(eb, this.els.panelFunction);

    // 防御性触发：重连场景下 CHANGE_STATE 可能在组件初始化前已发射
    if (this.dm.gameState) {
      eb.emit(EV.CHANGE_STATE, this.dm.gameState);
    }

    // 创建座位
    const seatCount = this.dm.totalPlayers || 12;
    this.components.gameTable.createSeats(seatCount);

    // 延迟处理（注册 + 刷新初始状态）
    setTimeout(() => {
      // 玩家模式下自动注册
      if (this.dm.userType === 'player' && this.dm.userId) {
        const myInfo = this.dm.playerList.find(p => p.playerId === this.dm.userId);
        if (!myInfo) {
          this.dm.registerPlayer('玩家');
        }
      }

      // 隐藏等待列表（游戏中/复盘）
      const curPlayers = this.dm.playerList || [];
      if (curPlayers.length > 0 && this.components.gameTable) {
        this.components.gameTable.refresh(curPlayers);
      }
      if (this.dm.gameState === 'in_gaming' || this.dm.gameState === 'ended') {
        if (this.components.waitingList) this.components.waitingList.hide();
        if (this.components.gameTable) this.components.gameTable.hideAllReadyBadges();
      } else {
        if (this.components.waitingList) this.components.waitingList.show();
      }
    }, 10);

    // 背景图
    this._setupGameBackground();

    this._componentsInited = true;
  }

  // ===================================================================
  // 游戏背景 + 淡入
  // ===================================================================
  _setupGameBackground() {
    const bg = document.createElement('img');
    bg.src = 'assets/bck.png';
    bg.className = 'game-bg';
    Object.assign(bg.style, {
      position: 'absolute', inset: '0',
      width: '100%', height: '100%', objectFit: 'cover', zIndex: '0',
    });
    this.els.game.insertBefore(bg, this.els.game.firstChild);

    // 淡入效果
    const fade = document.createElement('div');
    fade.className = 'game-fade-overlay';
    Object.assign(fade.style, {
      position: 'absolute', inset: '0', background: '#000', zIndex: '1',
      transition: 'opacity 3s ease', opacity: '1',
    });
    this.els.game.appendChild(fade);
    requestAnimationFrame(() => {
      fade.style.opacity = '0';
    });
    setTimeout(() => {
      if (fade.parentNode) fade.parentNode.removeChild(fade);
    }, 3100);
  }

  // ===================================================================
  // 重连提示
  // ===================================================================
  _showReconnecting(msg) {
    if (this.pages.lobby) {
      this.pages.lobby.showReconnecting(msg);
    }
  }

  _hideReconnecting() {
    if (this.pages.lobby) {
      this.pages.lobby.hideReconnecting();
    }
  }

  // ===================================================================
  // 视口缩放：将固定 750×1334 设计稿适配到任意屏幕
  // ===================================================================
  _applyViewportScale() {
    const appEl = document.getElementById('app');
    if (!appEl) return;

    const designW = 750;
    const designH = 1334;
    const vw = window.innerWidth;
    // 始终用无键盘时的全屏高度计算 scale，避免键盘弹出时页面缩小
    const vh = this._fullViewportHeight || window.innerHeight;

    const scale = Math.min(vw / designW, vh / designH);
    this._currentScale = scale;
    this._applyTransform();

    // 注入反向缩放因子到 CSS 变量，子元素可用 calc(原值 * var(--rs)) 补偿缩放
    const rs = (1 / scale).toFixed(3);
    const docEl = document.documentElement;
    docEl.style.setProperty('--viewport-scale', scale.toFixed(3));
    docEl.style.setProperty('--rs', rs);
    docEl.style.setProperty('--touch-min', Math.max(44, Math.ceil(44 / scale)) + 'px');
    docEl.style.setProperty('--font-base', Math.max(16, Math.ceil(16 / scale)) + 'px');
  }

  _applyTransform() {
    const appEl = document.getElementById('app');
    if (!appEl || !this._currentScale) return;
    const s = this._currentScale;

    if (this._keyboardOffset > 0) {
      // 键盘打开：顶部对齐 + 顶部为缩放原点，translateY 精确上推
      appEl.style.transformOrigin = 'top center';
      const y = -(this._keyboardOffset / s);
      const yRounded = Math.round(y * 100) / 100;
      appEl.style.transform = `translateY(${yRounded}px) scale(${s})`;
    } else {
      // 正常：居中缩放
      appEl.style.transformOrigin = '';
      appEl.style.transform = `scale(${s})`;
    }
  }

  // ===================================================================
  // 键盘处理
  // 核心：键盘弹出时 body 改为顶部对齐 + translateY 上推 app
  //       键盘收起时恢复居中 + 清除 translateY
  // ===================================================================
  _initKeyboardHandler() {
    this._keyboardOffset = 0;
    this._fullViewportHeight = window.innerHeight;

    const vv = window.visualViewport;
    const body = document.body;

    // 横竖屏切换：重置基准高度
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        this._keyboardOffset = 0;
        this._fullViewportHeight = window.innerHeight;
        body.style.justifyContent = '';
        this._applyViewportScale();
      }, 300);
    });

    // 主检测：window.innerHeight 变化 → 键盘开/关
    window.addEventListener('resize', () => {
      const heightDrop = this._fullViewportHeight - window.innerHeight;

      if (heightDrop > 50) {
        // 键盘弹出：body 顶部对齐 + translateY 上推
        this._keyboardOffset = Math.round(heightDrop / 2);
        body.style.justifyContent = 'flex-start';
      } else {
        // 键盘收起
        if (this._keyboardOffset > 0) {
          this._keyboardOffset = 0;
          this._fullViewportHeight = window.innerHeight;
          body.style.justifyContent = '';
        } else {
          // 普通 resize：更新基准高度
          this._fullViewportHeight = window.innerHeight;
        }
      }

      this._applyViewportScale();
    });

    // vv.resize 仅作辅助
    if (vv) {
      vv.addEventListener('resize', () => {
        if (this._keyboardOffset > 0) {
          this._applyViewportScale();
        }
      }, { passive: true });
    }
  }

  // ===================================================================
  // Toast 错误提示
  // ===================================================================
  _showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'app-toast';
    Object.assign(toast.style, {
      position: 'absolute', bottom: '160px', left: '50%', transform: 'translateX(-50%)',
      padding: '10px 20px', background: 'rgba(26,26,26,0.95)', color: '#ff6b6b',
      fontSize: '16px', borderRadius: '8px', zIndex: '400',
      maxWidth: '90%', textAlign: 'center', whiteSpace: 'pre-wrap',
    });
    toast.textContent = message;
    document.getElementById('app').appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 3000);
  }
}

const app = new App();
// E2E 测试用全局引用
window.__bloodclock = { app, dm: app.dm };
export { App, app };
