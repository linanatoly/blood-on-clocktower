import { UIComponent } from './UIComponent.js';
import { EV } from '../event-constants.js';

export class SeatPopup extends UIComponent {
  constructor(eventBus, containerEl) {
    super(eventBus, containerEl);
    this._seatNum = null;
    this._targetPlayerId = null;
    this._controllerId = null;
    this._chooseMod = null;
    this._buildDom();
    this._bindDomEvents();
    // 角色选择模式变更时自动关闭弹窗（避免按钮显示过时）
    this.on(EV.ROLE_MODE_CHANGED, () => this.hide());
  }

  _buildDom() {
    this.el.innerHTML = `
      <div class="overlay seat-popup-overlay hidden">
        <div class="seat-popup-box">
          <button class="seat-popup-close">&times;</button>
          <h3 class="seat-popup-title">空座位</h3>
          <div class="seat-popup-actions">
            <button class="btn-action" data-action="sit"       data-label="坐这">坐这</button>
            <button class="btn-action" data-action="setRole"   data-label="设置角色">设置角色</button>
            <button class="btn-action" data-action="chat"      data-label="聊天">聊天</button>
            <button class="btn-action" data-action="deadTicket"    data-label="死亡有票">死亡有票</button>
            <button class="btn-action" data-action="deadNoTicket"  data-label="死亡无票">死亡无票</button>
            <button class="btn-action" data-action="alive"     data-label="存活">存活</button>
            <button class="btn-action" data-action="drunk"     data-label="他是酒鬼">他是酒鬼</button>
          </div>
        </div>
      </div>
    `;
    this._overlay = this.el.querySelector('.seat-popup-overlay');
    this._titleEl = this.el.querySelector('.seat-popup-title');
    this._actionBtns = this.el.querySelectorAll('.btn-action');
    this._drunkBtn = this.el.querySelector('[data-action="drunk"]');
  }

  _bindDomEvents() {
    this.el.querySelector('.seat-popup-close').addEventListener('click', () => this.hide());
    this._overlay.addEventListener('click', (e) => {
      if (e.target === this._overlay) this.hide();
    });

    const handlers = {
      sit: () => { this.hide(); this.emit(EV.SEAT_SITDOWN, this._controllerId, this._seatNum); },
      setRole: () => { this.hide(); this.emit(EV.AVATAR_OPEN, this._controllerId, this._chooseMod, this._seatNum); },
      chat: () => { this.hide(); this.emit(EV.START_CHAT, this._seatNum); },
      deadTicket: () => { this.hide(); this.emit(EV.PLAYER_STATUS_CHANGE, { targetPlayerId: this._targetPlayerId, newState: 'dead_with_ticket' }); },
      deadNoTicket: () => { this.hide(); this.emit(EV.PLAYER_STATUS_CHANGE, { targetPlayerId: this._targetPlayerId, newState: 'dead_without_ticket' }); },
      alive: () => { this.hide(); this.emit(EV.PLAYER_STATUS_CHANGE, { targetPlayerId: this._targetPlayerId, newState: 'alive' }); },
      drunk: () => { this.hide(); this.emit(EV.PLAYER_SET_DRUNK, { targetPlayerId: this._targetPlayerId, seatNum: this._seatNum }); },
    };

    this._actionBtns.forEach(btn => {
      const action = btn.dataset.action;
      if (handlers[action]) {
        btn.addEventListener('click', handlers[action]);
      }
    });
  }

  show(seatNum, comeBackData) {
    this._seatNum = seatNum;
    this._targetPlayerId = comeBackData.targetPlayerId || null;
    this._controllerId = comeBackData.player_ID;
    this._chooseMod = comeBackData.chooseModel;

    const name = comeBackData.nickName || '空座位';
    this._titleEl.textContent = name === '空座位' ? '空座位' : `玩家 ${name} 功能面板`;

    const vis = {
      sit: comeBackData.showSitBtn,
      setRole: comeBackData.showChooseAvatrBtn,
      chat: comeBackData.showChatBtn,
      deadTicket: comeBackData.showDeadWithTicketBtn,
      deadNoTicket: comeBackData.showDeadWithoutTicketBtn,
      alive: comeBackData.showAliveBtn,
      drunk: comeBackData.showDrunkBtn,
    };

    this._actionBtns.forEach(btn => {
      const action = btn.dataset.action;
      btn.style.display = vis[action] ? '' : 'none';
    });

    if (this._drunkBtn) {
      this._drunkBtn.textContent = comeBackData.isDrunk ? '取消酒鬼' : '他是酒鬼';
    }

    this._overlay.classList.remove('hidden');
  }

  hide() {
    this._overlay.classList.add('hidden');
  }

  destroy() {
    this._overlay = null;
    this._titleEl = null;
    this._actionBtns = null;
    super.destroy();
  }
}
