import { DataManager } from './dataManager/dataManager.js';
import { EV } from './event-constants.js';

const CAMP_NAMES = ['村民', '外来者', '爪牙', '恶魔'];

export class LobbyPage {
  constructor(eventBus, containerEl) {
    this.eventBus = eventBus;
    this.el = containerEl;
    this.dm = DataManager.getInstance();

    this.userType = 'god';
    this.currentNum = [3, 0, 1, 1];
    this.totalPlayers = 7;
    this.isWaiting = false;

    this._buildDom();
    this._bindDomEvents();
    this._bindEvents();
    this._autoAssignCamp();
    this._syncValidation();
  }

  _buildDom() {
    this.el.innerHTML = `
      <div class="lobby-container">
        <img class="lobby-bg" src="assets/oproombck.png" alt="">
        <div class="lobby-panel">
          <div class="lobby-tabs">
            <button class="lobby-tab active" data-tab="god">我是上帝</button>
            <button class="lobby-tab" data-tab="player">我是玩家</button>
          </div>
          <div class="lobby-tab-content" data-panel="god">
            <div class="lobby-field">
              <label>房间号：</label>
              <input type="text" data-input="god-room" maxlength="4" inputmode="numeric" pattern="[0-9]*" placeholder="请输入4位房间号">
              <span class="lobby-check" data-check="god-room">✓</span>
            </div>
            <div class="lobby-slider-row">
              <label>选择人数：</label>
              <input type="range" data-input="god-slider" min="5" max="15" value="7">
              <span class="lobby-slider-val" data-val="god-slider">7</span>
            </div>
            <div class="lobby-camp-title">阵营配置</div>
            <div class="lobby-camp-rows" data-camp-rows></div>
            <span class="lobby-camp-msg" data-msg="camp" style="color:#ff6b6b;"></span>
            <button class="lobby-submit" data-action="create-room" disabled>开房间</button>
          </div>
          <div class="lobby-tab-content hidden" data-panel="player">
            <div class="lobby-field">
              <label>房间号：</label>
              <input type="text" data-input="player-room" maxlength="4" inputmode="numeric" pattern="[0-9]*" placeholder="请输入4位房间号">
              <span class="lobby-check" data-check="player-room">✓</span>
            </div>
            <div class="lobby-field-err" data-err="player-room"></div>
            <div class="lobby-field">
              <label>你的昵称：</label>
              <input type="text" data-input="player-name" placeholder="输入昵称" maxlength="10">
              <span class="lobby-check" data-check="player-name">✓</span>
            </div>
            <button class="lobby-submit" data-action="join-room" disabled>进入房间</button>
          </div>
        </div>
        <div class="lobby-reconnect hidden" data-reconnect></div>
      </div>
    `;

    this._els = {
      tabs: this.el.querySelectorAll('.lobby-tab'),
      panels: this.el.querySelectorAll('.lobby-tab-content'),
      godRoom: this.el.querySelector('[data-input="god-room"]'),
      godSlider: this.el.querySelector('[data-input="god-slider"]'),
      godSliderVal: this.el.querySelector('[data-val="god-slider"]'),
      godRoomCheck: this.el.querySelector('[data-check="god-room"]'),
      campRows: this.el.querySelector('[data-camp-rows]'),
      campMsg: this.el.querySelector('[data-msg="camp"]'),
      createBtn: this.el.querySelector('[data-action="create-room"]'),
      playerRoom: this.el.querySelector('[data-input="player-room"]'),
      playerName: this.el.querySelector('[data-input="player-name"]'),
      playerRoomCheck: this.el.querySelector('[data-check="player-room"]'),
      playerRoomErr: this.el.querySelector('[data-err="player-room"]'),
      playerNameCheck: this.el.querySelector('[data-check="player-name"]'),
      joinBtn: this.el.querySelector('[data-action="join-room"]'),
      reconnect: this.el.querySelector('[data-reconnect]'),
    };

    this._buildCampRows();
  }

  _buildCampRows() {
    const rows = this._els.campRows;
    rows.innerHTML = '';
    for (let i = 0; i < 4; i++) {
      const row = document.createElement('div');
      row.className = 'lobby-camp-row';
      const label = document.createElement('span');
      label.textContent = CAMP_NAMES[i] + '：';
      row.appendChild(label);

      const ctrl = document.createElement('div');
      ctrl.className = 'lobby-camp-ctrl';

      if (i < 3) {
        const minus = document.createElement('button');
        minus.className = 'lobby-camp-btn';
        minus.textContent = '-';
        minus.dataset.campIdx = i;
        minus.dataset.action = 'minus';
        ctrl.appendChild(minus);
      }

      const num = document.createElement('span');
      num.className = 'lobby-camp-num';
      num.dataset.campNum = i;
      num.textContent = this.currentNum[i];
      ctrl.appendChild(num);

      if (i < 3) {
        const plus = document.createElement('button');
        plus.className = 'lobby-camp-btn';
        plus.textContent = '+';
        plus.dataset.campIdx = i;
        plus.dataset.action = 'plus';
        ctrl.appendChild(plus);
      }

      row.appendChild(ctrl);
      rows.appendChild(row);
    }
  }

  _getCampNumEls() {
    return this._els.campRows.querySelectorAll('[data-camp-num]');
  }

  _updateCampDisplay() {
    const els = this._getCampNumEls();
    els.forEach(el => {
      el.textContent = this.currentNum[parseInt(el.dataset.campNum)];
    });
  }

  _bindDomEvents() {
    // Tab 切换
    this._els.tabs.forEach(tab => {
      tab.addEventListener('click', () => this._switchTab(tab.dataset.tab));
    });

    // 上帝房间号输入
    this._els.godRoom.addEventListener('input', () => {
      this._syncValidation();
    });

    // 滑块变化
    this._els.godSlider.addEventListener('input', () => {
      this.totalPlayers = parseInt(this._els.godSlider.value);
      this._els.godSliderVal.textContent = this.totalPlayers;
      this._autoAssignCamp();
      this._syncValidation();
    });

    // 阵营 +/- 按钮
    this._els.campRows.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn || !btn.dataset.campIdx) return;
      const idx = parseInt(btn.dataset.campIdx);
      if (btn.dataset.action === 'plus' && this.currentNum[idx] < 15) {
        this.currentNum[idx]++;
      } else if (btn.dataset.action === 'minus' && this.currentNum[idx] > 0) {
        this.currentNum[idx]--;
      } else {
        return;
      }
      this._updateCampDisplay();
      this._syncValidation();
    });

    // 创建房间
    this._els.createBtn.addEventListener('click', () => {
      if (this.isWaiting) return;
      const ok = this._validateGod();
      if (!ok) return;
      const roomCode = this._els.godRoom.value.trim();
      this.isWaiting = true;
      this._setGodInputsDisabled(true);
      this._els.createBtn.textContent = '创建中...';
      this.dm.createRoom(roomCode, this.totalPlayers, [...this.currentNum]);
    });

    // 玩家房间号输入
    this._els.playerRoom.addEventListener('input', () => {
      this._clearPlayerRoomError();
      this._syncValidation();
    });
    this._els.playerRoom.addEventListener('blur', () => {
      this._validatePlayerRoomOnBlur();
    });

    // 玩家昵称输入
    this._els.playerName.addEventListener('input', () => {
      this._syncValidation();
    });

    // 加入房间
    this._els.joinBtn.addEventListener('click', () => {
      if (this.isWaiting) return;
      const ok = this._validatePlayer();
      if (!ok) return;
      const roomCode = this._els.playerRoom.value.trim();
      const nickName = this._els.playerName.value.trim();
      const uniqueId = 'player_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      this.isWaiting = true;
      this._setPlayerInputsDisabled(true);
      this._els.joinBtn.textContent = '加入中...';
      this.dm.joinRoom(roomCode, uniqueId, nickName);
    });
  }

  _bindEvents() {
    this._reconnectTimer = null;

    this._onReconnecting = (msg) => {
      // 延迟显示重连提示，避免服务器重启后旧 session 导致的闪现
      this._reconnectTimer = setTimeout(() => {
        this._els.reconnect.textContent = typeof msg === 'string' ? msg : '检测到已在游戏中，正在重连...';
        this._els.reconnect.classList.remove('hidden');
      }, 800);
    };
    this._onServerError = (errorMsg) => {
      this._clearReconnectTimer();
      if (!this.isWaiting) return;
      this.isWaiting = false;
      this._resetButtons();
      this._setGodInputsDisabled(false);
      this._setPlayerInputsDisabled(false);

      // 玩家房间号错误：显示 ✗ + 内联错误消息
      if (this.userType === 'player' && errorMsg) {
        this._els.playerRoomCheck.textContent = '✗';
        this._els.playerRoomCheck.classList.add('visible', 'lobby-check-err');
        this._els.playerRoomErr.textContent = errorMsg;
      }
    };
    this._onRoomState = () => {
      this._clearReconnectTimer();
      this._els.reconnect.classList.add('hidden');
      this.isWaiting = false;
    };
    this._onDismissed = () => {
      this._clearReconnectTimer();
      this.isWaiting = false;
      this._resetButtons();
      this._setGodInputsDisabled(false);
      this._setPlayerInputsDisabled(false);
    };

    this.eventBus.on(EV.RECONNECTING, this._onReconnecting);
    this.eventBus.on(EV.SERVER_ERROR, this._onServerError);
    this.eventBus.on(EV.ROOM_STATE_RECEIVED, this._onRoomState);
    this.eventBus.on(EV.ROOM_DISMISSED, this._onDismissed);
  }

  _switchTab(tab) {
    const isGod = tab === 'god';
    this.userType = isGod ? 'god' : 'player';

    this._els.tabs.forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tab);
    });
    this._els.panels.forEach(p => {
      p.classList.toggle('hidden', p.dataset.panel !== tab);
    });
    this._syncValidation();
  }

  _autoAssignCamp() {
    const total = this.totalPlayers;
    if (total < 7) {
      this.currentNum = [3, total - 5, 1, 1];
    } else if (total < 10) {
      this.currentNum = [5, total - 7, 1, 1];
    } else if (total < 13) {
      this.currentNum = [7, total - 10, 2, 1];
    } else {
      this.currentNum = [7, total - 11, 3, 1];
    }
    this._updateCampDisplay();
  }

  _validateGod() {
    const roomValid = /^\d{4}$/.test(this._els.godRoom.value.trim());
    const total = this.currentNum.reduce((s, n) => s + n, 0);
    const campOk = total === this.totalPlayers;
    if (!campOk) {
      this._els.campMsg.textContent = '阵营人数总和需等于总人数(' + this.totalPlayers + ')';
    } else {
      this._els.campMsg.textContent = '';
    }
    return roomValid && campOk;
  }

  _validatePlayer() {
    const roomValid = /^\d{4}$/.test(this._els.playerRoom.value.trim());
    const nameValid = this._els.playerName.value.trim().length > 0;
    return roomValid && nameValid;
  }

  _syncValidation() {
    // 上帝侧
    const godRoomOk = /^\d{4}$/.test(this._els.godRoom.value.trim());
    this._els.godRoomCheck.classList.toggle('visible', godRoomOk);
    const total = this.currentNum.reduce((s, n) => s + n, 0);
    const campOk = total === this.totalPlayers;
    if (!campOk) {
      this._els.campMsg.textContent = '阵营人数总和需等于总人数(' + this.totalPlayers + ')';
    } else {
      this._els.campMsg.textContent = '';
    }
    const godOk = godRoomOk && campOk && !this.isWaiting;
    this._els.createBtn.disabled = !godOk;
    this._els.createBtn.style.background = godOk ? '#4a8a4a' : '#8a8a8a';

    // 玩家侧
    const playerRoomOk = /^\d{4}$/.test(this._els.playerRoom.value.trim());
    const nameOk = this._els.playerName.value.trim().length > 0;
    this._els.playerRoomCheck.classList.toggle('visible', playerRoomOk);
    this._els.playerNameCheck.classList.toggle('visible', nameOk);
    const playerOk = playerRoomOk && nameOk && !this.isWaiting;
    this._els.joinBtn.disabled = !playerOk;
    this._els.joinBtn.style.background = playerOk ? '#4a8a4a' : '#8a8a8a';
  }

  _validatePlayerRoomOnBlur() {
    const val = this._els.playerRoom.value.trim();
    if (!val) return;
    const check = this._els.playerRoomCheck;
    if (/^\d{4}$/.test(val)) {
      check.textContent = '✓';
      check.classList.remove('lobby-check-err');
      check.classList.add('visible');
      this._els.playerRoomErr.textContent = '';
    } else {
      check.textContent = '✗';
      check.classList.add('visible', 'lobby-check-err');
      this._els.playerRoomErr.textContent = '请输入4位房间号';
    }
  }

  _clearReconnectTimer() {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    this._els.reconnect.classList.add('hidden');
  }

  _clearPlayerRoomError() {
    this._els.playerRoomCheck.textContent = '✓';
    this._els.playerRoomCheck.classList.remove('lobby-check-err');
    this._els.playerRoomErr.textContent = '';
  }

  _setGodInputsDisabled(disabled) {
    this._els.godRoom.disabled = disabled;
    this._els.godSlider.disabled = disabled;
  }

  _setPlayerInputsDisabled(disabled) {
    this._els.playerRoom.disabled = disabled;
    this._els.playerName.disabled = disabled;
  }

  _resetButtons() {
    this._els.createBtn.textContent = '开房间';
    this._els.joinBtn.textContent = '进入房间';
  }

  showReconnecting(msg) {
    this._els.reconnect.textContent = msg || '正在重连...';
    this._els.reconnect.classList.remove('hidden');
  }

  hideReconnecting() {
    this._els.reconnect.classList.add('hidden');
  }

  destroy() {
    this._clearReconnectTimer();
    this.eventBus.off(EV.RECONNECTING, this._onReconnecting);
    this.eventBus.off(EV.SERVER_ERROR, this._onServerError);
    this.eventBus.off(EV.ROOM_STATE_RECEIVED, this._onRoomState);
    this.eventBus.off(EV.ROOM_DISMISSED, this._onDismissed);
    this.el.innerHTML = '';
  }
}
