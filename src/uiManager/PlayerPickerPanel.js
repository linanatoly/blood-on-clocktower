const STYLE = `
.elp-player-picker-overlay {
  position: absolute; inset: 0;
  background: rgba(0, 0, 0, 0.65);
  z-index: 210;
  display: flex; align-items: center; justify-content: center;
}
.elp-player-picker-box {
  position: relative; z-index: 1;
  background: #1a1a2e;
  border-radius: 12px;
  width: 82%; max-width: 600px;
  max-height: 70%;
  display: flex; flex-direction: column;
  padding: 16px; gap: 12px;
  border: 2px solid #4a4a8a;
}
.elp-player-picker-header {
  display: flex; align-items: center; justify-content: space-between;
}
.elp-player-picker-header h4 {
  color: #FFD700; font-size: 18px; margin: 0;
}
.elp-player-picker-close {
  background: none; border: none;
  color: #aaa; font-size: 24px;
  cursor: pointer; padding: 0 4px; line-height: 1;
}
.elp-player-picker-close:hover { color: #fff; }
.elp-player-picker-list {
  list-style: none; margin: 0; padding: 0;
  overflow-y: auto; flex: 1;
  display: flex; flex-direction: column; gap: 2px;
}
.elp-player-picker-item {
  padding: 12px 14px; font-size: 16px;
  color: #ccc; cursor: pointer;
  border-radius: 6px;
  transition: background 0.15s;
  min-height: var(--touch-min, 44px);
  display: flex; align-items: center;
}
.elp-player-picker-item:hover { background: rgba(255,255,255,0.08); }
.elp-player-picker-item:active { background: rgba(255,255,255,0.12); }
.elp-player-picker-item.selected {
  color: #4CAF50; background: rgba(76,175,80,0.15);
  font-weight: bold;
}
.elp-player-picker-item.is-dead {
  color: #DA3939;
  text-decoration: line-through;
}
.elp-player-picker-item.is-dead.selected {
  color: #DA3939;
  background: rgba(218,57,57,0.15);
}
.elp-player-picker-confirm {
  align-self: center;
  padding: 10px 40px; font-size: 16px;
  min-height: var(--touch-min, 44px);
}
`;

export class PlayerPickerPanel {
  constructor(containerEl) {
    this.el = containerEl;
    this._selectedId = null;
    this._onSelect = null;
    this._buildDom();
    this._bindDomEvents();
  }

  _buildDom() {
    const styleEl = document.createElement('style');
    styleEl.textContent = STYLE;
    this.el.appendChild(styleEl);

    this.el.insertAdjacentHTML('beforeend', `
      <div class="elp-player-picker-overlay hidden">
        <div class="elp-player-picker-box">
          <div class="elp-player-picker-header">
            <h4>选择玩家</h4>
            <button class="elp-player-picker-close">&times;</button>
          </div>
          <ul class="elp-player-picker-list"></ul>
          <button class="btn btn-primary elp-player-picker-confirm">确认</button>
        </div>
      </div>
    `);
    this._overlay = this.el.querySelector('.elp-player-picker-overlay');
    this._listEl = this.el.querySelector('.elp-player-picker-list');
    this._confirmBtn = this.el.querySelector('.elp-player-picker-confirm');
  }

  _bindDomEvents() {
    this.el.querySelector('.elp-player-picker-close').addEventListener('click', () => this.hide());
    this._overlay.addEventListener('click', (e) => {
      if (e.target === this._overlay) this.hide();
    });
    this._confirmBtn.addEventListener('click', () => {
      if (this._selectedId && this._onSelect) {
        this._onSelect(this._selectedId);
        this.hide();
      }
    });
  }

  show(players, onSelect, quickMode, currentSlotValue) {
    this._onSelect = onSelect;
    this._listEl.innerHTML = '';

    // 预选逻辑：quick 模式下高亮当前已选玩家；普通模式下不预选
    if (quickMode && currentSlotValue) {
      this._selectedId = currentSlotValue;
    } else if (!quickMode) {
      this._selectedId = null;
    }

    players.forEach(p => {
      const isDead = p.stateNow && p.stateNow !== 'alive';
      const isSelected = this._selectedId === p.playerId;
      const li = document.createElement('li');
      li.className = 'elp-player-picker-item'
        + (isDead ? ' is-dead' : '')
        + (isSelected ? ' selected' : '');
      li.textContent = `${p.seatNum + 1}号${p.nickName}（${p.roleName}）`;
      li.dataset.playerId = p.playerId;
      li.addEventListener('click', () => {
        this._selectedId = p.playerId;
        this._listEl.querySelectorAll('.elp-player-picker-item').forEach(el => {
          el.classList.toggle('selected', el.dataset.playerId === p.playerId);
        });
      });
      this._listEl.appendChild(li);
    });

    this._overlay.classList.remove('hidden');
  }

  hide() {
    this._overlay.classList.add('hidden');
    this._selectedId = null;
  }

  render(players, quickMode, currentSlotValue) {
    this._listEl.innerHTML = '';
    if (quickMode && currentSlotValue) {
      this._selectedId = currentSlotValue;
    }
    players.forEach(p => {
      const isDead = p.stateNow && p.stateNow !== 'alive';
      const isSelected = this._selectedId === p.playerId;
      const li = document.createElement('li');
      li.className = 'elp-player-picker-item'
        + (isDead ? ' is-dead' : '')
        + (isSelected ? ' selected' : '');
      li.textContent = `${p.seatNum + 1}号${p.nickName}（${p.roleName}）`;
      li.dataset.playerId = p.playerId;
      li.addEventListener('click', () => {
        this._selectedId = p.playerId;
        this._listEl.querySelectorAll('.elp-player-picker-item').forEach(el => {
          el.classList.toggle('selected', el.dataset.playerId === p.playerId);
        });
      });
      this._listEl.appendChild(li);
    });
  }
}
