import { UIComponent } from './UIComponent.js';
import { EV } from '../event-constants.js';
import { DataManager } from '../dataManager/dataManager.js';
import { PHASE_LABELS } from '../EventLogManager.js';

export class FunctionPanel extends UIComponent {
  constructor(eventBus, containerEl) {
    super(eventBus, containerEl);
    this.data = DataManager.getInstance();
    this._alive = true;
    this._modeToggleTimeout = null;
    this._buildDom();
    this._bindDomEvents();
    this._bindEvents();
    this._syncAll();
  }

  _buildDom() {
    const topBar = document.getElementById('game-top-bar');
    if (topBar) {
      topBar.innerHTML = '<span class="fn-phase-text"></span><span class="fn-room-code"></span><span class="fn-conn-status"></span>';
    }

    this.el.innerHTML = `
      <div class="fn-toolbar">
        <div class="fn-toolbar-god hidden">
          <div class="fn-toolbar-row">
            <button class="btn fn-btn fn-btn-chat">&#x1F4AC; 聊天<span class="fn-chat-badge hidden"></span></button>
            <button class="btn fn-btn fn-btn-eventlog">&#x1F4CB; 记录</button>
            <button class="btn fn-btn fn-btn-mode-toggle hidden">模式：玩家自选</button>
            <button class="btn fn-btn fn-btn-start-game btn-danger">&#x25B6; 开始游戏</button>
            <button class="btn fn-btn fn-btn-prev hidden">&#x25C0; 上一阶段</button>
            <button class="btn fn-btn fn-btn-next hidden">&#x25B6; 下一阶段</button>
            <button class="btn fn-btn fn-btn-back-pre hidden">&#x21A9; 返回准备</button>
            <button class="btn fn-btn fn-btn-end-game btn-danger hidden">&#x1F3C1; 结束游戏</button>
            <button class="btn fn-btn fn-btn-dismiss hidden">解散房间</button>
          </div>
        </div>
        <div class="fn-toolbar-player hidden">
          <div class="fn-toolbar-row fn-player-row">
            <button class="btn fn-btn fn-btn-chat">&#x1F4AC; 聊天<span class="fn-chat-badge hidden"></span></button>
            <button class="btn fn-btn fn-btn-ready">&#x2705; 准备</button>
            <button class="btn fn-btn fn-btn-notebook hidden">&#x1F4D3; 笔记本</button>
            <button class="btn fn-btn fn-btn-spy hidden">&#x1F575; 间谍模式</button>
            <button class="btn fn-btn fn-btn-leave hidden">退出房间</button>
          </div>
        </div>
      </div>
    `;

    // 解散确认弹窗渲染到 #app 级别，避免被 #panel-function 的层叠上下文限制
    this._dismissOverlay = document.createElement('div');
    this._dismissOverlay.className = 'overlay fn-dismiss-overlay hidden';
    this._dismissOverlay.innerHTML = `
      <div class="fn-dismiss-box">
        <h4>确定要解散房间吗？</h4>
        <p>所有玩家将被移出房间，房间数据将被清除</p>
        <div class="fn-dismiss-actions">
          <button class="btn btn-danger fn-dismiss-confirm">确认解散</button>
          <button class="btn fn-dismiss-cancel">取消</button>
        </div>
      </div>
    `;
    document.getElementById('app')?.appendChild(this._dismissOverlay);

    // 退出房间确认弹窗
    this._leaveOverlay = document.createElement('div');
    this._leaveOverlay.className = 'overlay fn-leave-overlay hidden';
    this._leaveOverlay.innerHTML = `
      <div class="fn-dismiss-box">
        <h4>确定要退出房间吗？</h4>
        <p>你将离开当前房间并返回大厅</p>
        <div class="fn-dismiss-actions">
          <button class="btn fn-leave-confirm">确认退出</button>
          <button class="btn fn-leave-cancel">取消</button>
        </div>
      </div>
    `;
    document.getElementById('app')?.appendChild(this._leaveOverlay);

    this._phaseEl = topBar?.querySelector('.fn-phase-text');
    this._roomCodeEl = topBar?.querySelector('.fn-room-code');
    this._connStatusEl = topBar?.querySelector('.fn-conn-status');
    this._toolbarGod = this.el.querySelector('.fn-toolbar-god');
    this._modeToggleBtn = this.el.querySelector('.fn-btn-mode-toggle');
    this._toolbarPlayer = this.el.querySelector('.fn-toolbar-player');
    this._readyBtn = this.el.querySelector('.fn-btn-ready');
    this._notebookBtn = this.el.querySelector('.fn-btn-notebook');
    this._spyBtn = this.el.querySelector('.fn-btn-spy');
    this._leaveBtn = this.el.querySelector('.fn-btn-leave');
  }

  _bindDomEvents() {
    // 可能存在两个 .fn-btn-chat（上帝和玩家各一个），用 querySelectorAll
    this.el.querySelectorAll('.fn-btn-chat').forEach(btn => {
      btn.addEventListener('click', () => {
        this._hideChatBadge();
        this.emit(EV.OPEN_CHAT);
      });
    });

    this.el.querySelector('.fn-btn-eventlog')?.addEventListener('click', () => {
      this.emit(EV.OPEN_EVENT_LOG);
    });

    this._modeToggleBtn?.addEventListener('click', () => {
      const currentMode = this.data.roleAssignmentMode;
      const newMode = currentMode === 'god_assign' ? 'self_select' : 'god_assign';
      console.log(`模式切换按钮点击: 当前=${currentMode}, 目标=${newMode}`);
      // 防止快速双击
      this._modeToggleBtn.disabled = true;
      // 清除之前的超时
      if (this._modeToggleTimeout) clearTimeout(this._modeToggleTimeout);
      // 乐观更新 UI（服务器确认后会通过 ROLE_MODE_CHANGED 事件再次确认）
      this._updateModeToggleBtn(newMode);
      const sent = this.data.sendSetRoleMode(newMode);
      if (!sent) {
        // 发送失败，回滚 UI
        console.warn('模式切换发送失败，回滚 UI');
        this._updateModeToggleBtn(currentMode);
        this._modeToggleBtn.disabled = false;
      } else {
        // 安全超时：5秒后若未收到服务端确认，回滚并重新启用
        this._modeToggleTimeout = setTimeout(() => {
          console.warn('模式切换超时，回滚 UI');
          this._updateModeToggleBtn(currentMode);
          this._modeToggleBtn.disabled = false;
          this._modeToggleTimeout = null;
        }, 5000);
      }
    });

    this.el.querySelector('.fn-btn-start-game')?.addEventListener('click', () => {
      this.emit(EV.ROOM_START_GAME);
    });

    this.el.querySelector('.fn-btn-prev')?.addEventListener('click', () => {
      this.data.sendPhaseChange('prev');
    });

    this.el.querySelector('.fn-btn-next')?.addEventListener('click', () => {
      this.data.sendPhaseChange('next');
    });

    this.el.querySelector('.fn-btn-end-game')?.addEventListener('click', () => {
      this.emit(EV.ROOM_END_GAME);
    });

    this.el.querySelector('.fn-btn-back-pre')?.addEventListener('click', () => {
      this.data.sendBackToPreparing();
    });

    this.el.querySelector('.fn-btn-dismiss')?.addEventListener('click', () => {
      this._showDismissConfirm();
    });

    this.el.querySelector('.fn-btn-ready')?.addEventListener('click', () => {
      const myInfo = this.data.playerList.find(p => p.playerId === this.data.userId);
      if (!myInfo) return;
      if (myInfo.seatNum === null || myInfo.seatNum === undefined) {
        this._flashNotSeated();
        return;
      }
      if (myInfo.ready) {
        this.emit(EV.PLAYER_UNREADY);
      } else if (!myInfo.avatarName || !myInfo.headImgUrl) {
        if (this.data.roleAssignmentMode === 'god_assign') {
          this._flashGodAssignWait();
          return;
        }
        this.emit(EV.AVATAR_OPEN, this.data.userId, 'single', myInfo.seatNum);
      } else {
        this.emit(EV.PLAYER_READY);
      }
    });

    this.el.querySelector('.fn-btn-notebook')?.addEventListener('click', () => {
      this.emit(EV.OPEN_EVENT_LOG);
    });

    this.el.querySelector('.fn-btn-leave')?.addEventListener('click', () => {
      this._leaveOverlay.classList.remove('hidden');
    });

    this.el.querySelector('.fn-btn-spy')?.addEventListener('click', () => {
      if (this.data.spyActive) {
        this.data.spyActive = false;
        this._updateSpyBtn();
        this.emit(EV.SPY_MODE_OFF);
      } else {
        this.data.sendSpyRequest();
      }
    });

    this._dismissOverlay.querySelector('.fn-dismiss-confirm')?.addEventListener('click', () => {
      this._dismissOverlay.classList.add('hidden');
      this.data.sendDismissRoom();
    });

    this._dismissOverlay.querySelector('.fn-dismiss-cancel')?.addEventListener('click', () => {
      this._dismissOverlay.classList.add('hidden');
    });

    this._dismissOverlay.addEventListener('click', (e) => {
      if (e.target === this._dismissOverlay) {
        this._dismissOverlay.classList.add('hidden');
      }
    });

    this._leaveOverlay.querySelector('.fn-leave-confirm')?.addEventListener('click', () => {
      this._leaveOverlay.classList.add('hidden');
      this.data.sendLeaveRoom();
    });

    this._leaveOverlay.querySelector('.fn-leave-cancel')?.addEventListener('click', () => {
      this._leaveOverlay.classList.add('hidden');
    });

    this._leaveOverlay.addEventListener('click', (e) => {
      if (e.target === this._leaveOverlay) {
        this._leaveOverlay.classList.add('hidden');
      }
    });
  }

  _bindEvents() {
    this.on(EV.GAME_PHASE_CHANGED, (phase) => {
      if (!this._alive) return;
      if (phase) this._phaseEl.textContent = PHASE_LABELS[phase] || phase;
    });

    this.on(EV.ROLE_MODE_CHANGED, (mode) => {
      if (!this._alive) return;
      // 清除安全超时
      if (this._modeToggleTimeout) {
        clearTimeout(this._modeToggleTimeout);
        this._modeToggleTimeout = null;
      }
      this._updateModeToggleBtn(mode);
      // 服务端确认后重新启用按钮
      if (this._modeToggleBtn) this._modeToggleBtn.disabled = false;
      this._updateReadyBtn();
    });

    this.on(EV.CHAT_SHOWN, () => {
      this.el.classList.add('hidden');
      this._hideChatBadge();
    });
    this.on(EV.CHAT_HIDDEN, () => { this.el.classList.remove('hidden'); });

    this.on(EV.CHAT_DATA_UPDATE, () => {
      if (!this._alive) return;
      this._showChatBadge();
    });
    this.on(EV.EVENT_LOG_SHOWN, () => { this.el.classList.add('hidden'); });
    this.on(EV.EVENT_LOG_HIDDEN, () => { this.el.classList.remove('hidden'); });

    this.on(EV.CHANGE_STATE, () => {
      if (!this._alive) return;
      if (this.data.gameState !== 'in_gaming' && this.data.spyActive) {
        this.data.spyActive = false;
        this.emit(EV.SPY_MODE_OFF);
      }
      this._syncAll();
    });

    this.on(EV.PLAYER_LIST_UPDATED, () => {
      if (!this._alive) return;
      this._updateReadyBtn();
    });

    this.on(EV.SPY_DATA_RECEIVED, () => {
      if (!this._alive) return;
      this._spyBtn.textContent = '\u{1F575} 间谍模式(开)';
      this._spyBtn.classList.add('spy-on');
    });

    this.on(EV.SPY_MODE_OFF, () => {
      if (!this._alive) return;
      this._updateSpyBtn();
    });

    this.on(EV.WS_CONNECTED, () => {
      if (!this._alive || !this._connStatusEl) return;
      this._connStatusEl.textContent = '已连接';
      this._connStatusEl.classList.remove('disconnected');
    });

    this.on(EV.WS_DISCONNECTED, () => {
      if (!this._alive || !this._connStatusEl) return;
      this._connStatusEl.textContent = '尝试重连中';
      this._connStatusEl.classList.add('disconnected');
    });
  }

  _syncAll() {
    const isGod = this.data.userType === 'god';
    this._toolbarGod.classList.toggle('hidden', !isGod);
    this._toolbarPlayer.classList.toggle('hidden', isGod);

    if (this.data.roomCode) {
      this._roomCodeEl.textContent = '房间: ' + this.data.roomCode;
    }

    this._updateConnStatus();

    if (isGod) {
      this._syncGodState();
    } else {
      this._syncPlayerState();
    }
    this._updatePhaseDisplay();
  }

  _updateConnStatus() {
    if (!this._connStatusEl) return;
    const ws = this.data.ws;
    if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
      this._connStatusEl.textContent = '尝试重连中';
      this._connStatusEl.classList.add('disconnected');
    } else {
      this._connStatusEl.textContent = '已连接';
      this._connStatusEl.classList.remove('disconnected');
    }
  }

  _updatePhaseDisplay() {
    const state = this.data.gameState;
    if (state === 'preparing') {
      this._phaseEl.textContent = '准备阶段';
    } else if (state === 'ended') {
      this._phaseEl.textContent = '复盘阶段';
    } else if (state === 'in_gaming' && this.data.gamePhase) {
      this._phaseEl.textContent = PHASE_LABELS[this.data.gamePhase] || this.data.gamePhase;
    } else {
      this._phaseEl.textContent = '';
    }
  }

  _syncGodState() {
    const state = this.data.gameState;
    const inGame = state === 'in_gaming';
    const isEnded = state === 'ended';
    const isPre = state === 'preparing';

    const startBtn = this.el.querySelector('.fn-btn-start-game');
    const prevBtn = this.el.querySelector('.fn-btn-prev');
    const nextBtn = this.el.querySelector('.fn-btn-next');
    const endBtn = this.el.querySelector('.fn-btn-end-game');
    const backBtn = this.el.querySelector('.fn-btn-back-pre');
    const dismissBtn = this.el.querySelector('.fn-btn-dismiss');

    if (startBtn) startBtn.classList.toggle('hidden', inGame || isEnded);
    if (prevBtn) prevBtn.classList.toggle('hidden', !inGame);
    if (nextBtn) nextBtn.classList.toggle('hidden', !inGame);
    if (endBtn) endBtn.classList.toggle('hidden', !inGame);
    if (backBtn) backBtn.classList.toggle('hidden', !isEnded);
    if (dismissBtn) dismissBtn.classList.toggle('hidden', !isPre);
    if (this._modeToggleBtn) {
      this._modeToggleBtn.classList.toggle('hidden', !isPre);
      this._updateModeToggleBtn(this.data.roleAssignmentMode);
    }
  }

  _updateModeToggleBtn(mode) {
    if (!this._modeToggleBtn) return;
    if (mode === 'god_assign') {
      this._modeToggleBtn.textContent = '模式：上帝指定';
      this._modeToggleBtn.classList.add('mode-god-assign');
    } else {
      this._modeToggleBtn.textContent = '模式：玩家自选';
      this._modeToggleBtn.classList.remove('mode-god-assign');
    }
  }

  _syncPlayerState() {
    const state = this.data.gameState;
    const isPre = state === 'preparing';
    const isEnded = state === 'ended';

    this._readyBtn.classList.toggle('hidden', !isPre);
    this._notebookBtn.classList.toggle('hidden', isPre);
    this._leaveBtn.classList.toggle('hidden', !isPre);

    if (isPre) {
      this._updateReadyBtn();
    }

    if (!isPre && !isEnded) {
      const myInfo = this.data.playerList.find(p => p.playerId === this.data.userId);
      const isSpy = myInfo && myInfo.avatarName === '间谍';
      this._spyBtn.classList.toggle('hidden', !isSpy);
      if (!isSpy && this.data.spyActive) {
        this.data.spyActive = false;
        this.emit(EV.SPY_MODE_OFF);
      }
    } else {
      this._spyBtn.classList.add('hidden');
    }
  }

  _updateReadyBtn() {
    const myInfo = this.data.playerList.find(p => p.playerId === this.data.userId);
    if (myInfo && myInfo.ready) {
      this._readyBtn.textContent = '✔ 取消准备';
    } else if (myInfo && myInfo.avatarName && myInfo.headImgUrl) {
      this._readyBtn.textContent = '✅ 准备';
    } else if (this.data.roleAssignmentMode === 'god_assign') {
      this._readyBtn.textContent = '等待上帝分配角色';
    } else {
      this._readyBtn.textContent = '请选择角色';
    }
  }

  _updateSpyBtn() {
    this._spyBtn.textContent = '\u{1F575} 间谍模式';
    this._spyBtn.classList.remove('spy-on');
  }

  _showChatBadge() {
    this.el.querySelectorAll('.fn-chat-badge').forEach(b => b.classList.remove('hidden'));
  }

  _hideChatBadge() {
    this.el.querySelectorAll('.fn-chat-badge').forEach(b => b.classList.add('hidden'));
  }

  _flashNotSeated() {
    if (!this._alive) return;
    this._readyBtn.textContent = '请先入座';
    setTimeout(() => {
      if (!this._alive) return;
      this._updateReadyBtn();
    }, 1500);
  }

  _flashGodAssignWait() {
    if (!this._alive) return;
    this._readyBtn.textContent = '等待上帝分配角色';
    setTimeout(() => {
      if (!this._alive) return;
      this._updateReadyBtn();
    }, 1500);
  }

  _showDismissConfirm() {
    this._dismissOverlay.classList.remove('hidden');
  }

  show() {
    this.el.classList.remove('hidden');
  }

  hide() {
    this.el.classList.add('hidden');
  }

  destroy() {
    this._alive = false;
    if (this._modeToggleTimeout) {
      clearTimeout(this._modeToggleTimeout);
      this._modeToggleTimeout = null;
    }
    if (this._dismissOverlay) {
      this._dismissOverlay.remove();
      this._dismissOverlay = null;
    }
    if (this._leaveOverlay) {
      this._leaveOverlay.remove();
      this._leaveOverlay = null;
    }
    super.destroy();
  }
}
