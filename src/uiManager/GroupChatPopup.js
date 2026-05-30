import { UIComponent } from './UIComponent.js';
import { EV } from '../event-constants.js';
import { DataManager } from '../dataManager/dataManager.js';

export class GroupChatPopup extends UIComponent {
  constructor(eventBus, containerEl) {
    super(eventBus, containerEl);
    this.data = DataManager.getInstance();
    this._selectedIds = [];
    this._buildDom();
    this._bindDomEvents();
  }

  _buildDom() {
    this.el.innerHTML = `
      <div class="overlay group-chat-overlay hidden">
        <div class="group-chat-panel">
          <div class="group-chat-header">
            <h3>发起群聊</h3>
            <button class="group-chat-close">&times;</button>
          </div>
          <ul class="group-chat-player-list"></ul>
          <div class="group-chat-footer">
            <p class="group-chat-hint hidden">至少选择1人以开始聊天</p>
            <button class="btn btn-primary group-chat-confirm">确定发起</button>
          </div>
        </div>
      </div>
    `;

    this._overlay = this.el.querySelector('.group-chat-overlay');
    this._playerListEl = this.el.querySelector('.group-chat-player-list');
    this._hintEl = this.el.querySelector('.group-chat-hint');
  }

  _bindDomEvents() {
    this.el.querySelector('.group-chat-close').addEventListener('click', () => this.hide());
    this._overlay.addEventListener('click', (e) => {
      if (e.target === this._overlay) this.hide();
    });

    this.el.querySelector('.group-chat-confirm').addEventListener('click', () => {
      this._confirm();
    });
  }

  _renderPlayerList() {
    this._selectedIds = [];
    this._playerListEl.innerHTML = '';

    const players = this.data.playerList.filter(
      p => p.playerId !== this.data.godId && p.seatNum !== null
    );

    players.forEach(p => {
      const li = document.createElement('li');
      li.className = 'group-chat-player-item';
      li.dataset.playerId = p.playerId;
      li.textContent = p.nickName || '玩家';

      li.addEventListener('click', () => {
        const pid = p.playerId;
        if (this._selectedIds.includes(pid)) {
          this._selectedIds = this._selectedIds.filter(id => id !== pid);
          li.classList.remove('selected');
        } else {
          this._selectedIds.push(pid);
          li.classList.add('selected');
        }
      });

      this._playerListEl.appendChild(li);
    });
  }

  _confirm() {
    if (this._selectedIds.length >= 2) {
      this.emit(EV.GROUP_CHAT_CREATE, [...this._selectedIds]);
      this.hide();
    } else if (this._selectedIds.length === 1) {
      const player = this.data.playerList.find(p => p.playerId === this._selectedIds[0]);
      if (player && player.seatNum !== null) {
        this.emit(EV.START_CHAT, player.seatNum);
        this.hide();
      }
    } else {
      this._hintEl.classList.remove('hidden');
      setTimeout(() => this._hintEl.classList.add('hidden'), 2000);
    }
  }

  show() {
    this._renderPlayerList();
    this.el.classList.remove('hidden');
    this._overlay.classList.remove('hidden');
  }

  hide() {
    this._overlay.classList.add('hidden');
    this.el.classList.add('hidden');
  }

  destroy() {
    this._overlay = null;
    this._playerListEl = null;
    this._hintEl = null;
    this._selectedIds = [];
    super.destroy();
  }
}
