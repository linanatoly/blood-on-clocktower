import { UIComponent } from './UIComponent.js';
import { EV } from '../event-constants.js';
import { DataManager } from '../dataManager/dataManager.js';

export class WaitingList extends UIComponent {
  constructor(eventBus, containerEl) {
    super(eventBus, containerEl);
    this.data = DataManager.getInstance();
    this._buildDom();
    this._bindEvents();
  }

  _buildDom() {
    this.el.innerHTML = `
      <div class="overlay waiting-list hidden">
        <div class="waiting-panel">
          <h3 class="waiting-title">等待入座玩家</h3>
          <ul class="waiting-items"></ul>
        </div>
      </div>
    `;
    this._overlay = this.el.querySelector('.overlay');
    this._listEl = this.el.querySelector('.waiting-items');
  }

  _bindEvents() {
    this.on(EV.PLAYER_LIST_UPDATED, (playerList) => this.refresh(playerList));
  }

  refresh(playerList) {
    const userId = this.data.userId;
    const waiting = (playerList || this.data.playerList)
      .filter(p => p.seatNum === null && p.playerId !== this.data.godId);

    this._listEl.innerHTML = '';

    if (waiting.length === 0) {
      this._listEl.innerHTML = '<li class="waiting-empty">暂无等待玩家</li>';
      return;
    }

    waiting.forEach(p => {
      const isMe = p.playerId === userId;
      const li = document.createElement('li');
      li.className = 'waiting-item' + (isMe ? ' is-me' : '');
      li.dataset.playerId = p.playerId;
      li.innerHTML = `
        <span class="waiting-name">${p.nickName || '玩家'}</span>
        ${isMe ? '<span class="badge-me">我</span>' : ''}
      `;
      this._listEl.appendChild(li);
    });
  }

  show() {
    this._overlay.classList.remove('hidden');
  }

  hide() {
    this._overlay.classList.add('hidden');
  }

  destroy() {
    this._overlay = null;
    this._listEl = null;
    super.destroy();
  }
}
