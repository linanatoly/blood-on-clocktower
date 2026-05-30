import { UIComponent } from './UIComponent.js';
import { EV, QUICK_EVENT_TEMPLATES, QUICK_EVENT_TYPE_MAP, ROLE_LIST } from '../event-constants.js';
import { PHASE_LABELS, PHASE_SEQUENCE } from '../EventLogManager.js';
import { DataManager } from '../dataManager/dataManager.js';
import { PlayerPickerPanel } from './PlayerPickerPanel.js';
import { QuickEventPanel } from './QuickEventPanel.js';

const TYPE_COLORS = {
  death: '#DA3939',
  alive: '#4CAF50',
  phase_change: '#FFD700',
  game_start: '#2196F3',
  custom: '#9c27b0',
};

const TYPE_LABELS = {
  death: '死亡',
  alive: '复活',
  phase_change: '阶段',
  game_start: '开局',
  custom: '记录',
};

const STYLE = `
.event-log-panel {
  position: absolute; inset: 0;
  background: var(--color-bg-panel, rgba(10,10,40,0.92));
  display: flex; flex-direction: column;
  padding: 12px 16px; gap: 8px;
}
.event-log-header {
  display: flex; align-items: center; justify-content: center; gap: 12px;
  flex-shrink: 0;
}
.el-phase-title {
  color: #FFD700; font-size: 34px; margin: 0;
  text-align: center;
}
.el-nav-btn {
  font-size: 18px; padding: 6px 12px;
  background: none;
}
.el-close-btn {
  position: absolute; top: 12px; right: 16px;
  font-size: 18px; padding: 6px 12px;
}
.el-event-list {
  flex: 1; overflow-y: auto;
  display: flex; flex-direction: column; gap: 4px;
  transition: opacity 0.12s;
}
.el-event-item {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 10px; border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
  flex-wrap: wrap;
  min-height: 24px;
}
.el-event-item:hover { background: rgba(255,255,255,0.06); }
.el-event-item:active { background: rgba(255,255,255,0.12); }
.el-event-item.selected {
  background: rgba(51,51,102,0.6);
}
.el-event-tag {
  font-size: 14px; font-weight: bold;
  white-space: nowrap; flex-shrink: 0;
}
.el-event-desc {
  font-size: 16px; flex: 1;
  display: inline-flex; flex-wrap: wrap; gap: 2px;
}
.el-desc-player { color: #64B5F6; }
.el-desc-number { color: #FFD700; }
.el-desc-role { color: #CE93D8; }
.el-desc-text { color: #ccc; }
.el-event-actions {
  display: flex; gap: 6px; flex-shrink: 0;
  margin-left: auto;
}
.el-action-edit {
  padding: 4px 12px; font-size: 13px;
  background: #2196F3; color: #fff;
  min-height: var(--touch-min, 44px);
}
.el-action-edit:active { background: #42a5f5; }
.el-action-delete {
  padding: 4px 12px; font-size: 13px;
  background: #DA3939; color: #fff;
  min-height: var(--touch-min, 44px);
}
.el-action-delete:active { background: #ef5350; }
.el-bottom-bar {
  flex-shrink: 0;
  display: flex; justify-content: center;
  padding: 8px 0;
}
.el-record-btn {
  padding: 10px 40px; font-size: 16px;
  min-height: var(--touch-min, 44px);
}
.el-record-btn:disabled {
  opacity: 0.5; cursor: not-allowed;
}
.el-empty {
  color: #666; font-size: 16px; text-align: center;
  padding: 40px 0;
}
.el-sub-panel-container {
  position: absolute; inset: 0;
  pointer-events: none;
}
.el-sub-panel-container > * {
  pointer-events: auto;
}
.elp-role-picker-overlay {
  position: absolute; inset: 0;
  background: rgba(0,0,0,0.6);
  z-index: 210;
  display: flex; align-items: center; justify-content: center;
}
.elp-role-picker-box {
  background: #1a1a2e; border-radius: 12px;
  width: 85%; max-width: 500px;
  padding: 16px; display: flex; flex-direction: column;
  gap: 12px; border: 2px solid #4a4a8a;
  min-height: 50%;
}
.elp-role-picker-box h4 {
  color: #FFD700; font-size: 18px; margin: 0; text-align: center;
}
.elp-role-grid {
  display: flex; flex-wrap: wrap; gap: 8px;
  justify-content: center;
  max-height: 455px; overflow-y: auto;
}
.elp-role-btn {
  padding: 8px 14px; font-size: 14px;
  background: #5a5a9a; color: #fff;
  border: none; border-radius: 6px; cursor: pointer;
  transition: background 0.15s;
  min-height: var(--touch-min, 44px);
}
.elp-role-btn:hover { background: #7a7aba; }
.elp-role-btn:active { background: #9a9ada; }
.elp-role-picker-close-btn {
  align-self: center; margin-top: 4px;
}
`;

export class EventLogPanel extends UIComponent {
  constructor(eventBus, containerEl, eventLogMgr) {
    super(eventBus, containerEl);
    this.mgr = eventLogMgr;
    this.data = DataManager.getInstance();
    this._selectedEventId = null;
    this._buildDom();
    this._initSubPanels();
    this._bindDomEvents();
    this._bindEvents();
  }

  _buildDom() {
    const styleEl = document.createElement('style');
    styleEl.textContent = STYLE;
    this.el.appendChild(styleEl);

    this.el.insertAdjacentHTML('beforeend', `
      <div class="event-log-panel hidden">
        <div class="event-log-header">
          <button class="btn el-nav-btn el-prev-btn">◀</button>
          <h3 class="el-phase-title">准备阶段</h3>
          <button class="btn el-nav-btn el-next-btn">▶</button>
        </div>
        <button class="btn el-close-btn">✕</button>
        <div class="el-event-list"></div>
        <div class="el-bottom-bar">
          <button class="btn btn-primary el-record-btn">记录事件</button>
        </div>
      </div>
    `);

    this._panel = this.el.querySelector('.event-log-panel');
    this._phaseTitle = this.el.querySelector('.el-phase-title');
    this._eventListEl = this.el.querySelector('.el-event-list');
    this._prevBtn = this.el.querySelector('.el-prev-btn');
    this._nextBtn = this.el.querySelector('.el-next-btn');
    this._recordBtn = this.el.querySelector('.el-record-btn');
  }

  _initSubPanels() {
    const pickerEl = document.createElement('div');
    pickerEl.className = 'el-sub-panel-container';
    this.el.appendChild(pickerEl);
    this.playerPicker = new PlayerPickerPanel(pickerEl);

    const quickEl = document.createElement('div');
    quickEl.className = 'el-sub-panel-container';
    this.el.appendChild(quickEl);
    this.quickPanel = new QuickEventPanel(quickEl, this.mgr, this.data);

    const rolePickerEl = document.createElement('div');
    rolePickerEl.className = 'el-sub-panel-container';
    this.el.appendChild(rolePickerEl);
    this._buildRoleQuickPicker(rolePickerEl);

    this.quickPanel.slotClickHandler = (slotIdx) => {
      const players = this.mgr.getPlayerDisplayList();
      this.playerPicker.show(players, (pid) => {
        this.quickPanel.setPlayerForSlot(slotIdx, pid);
      }, true, this.quickPanel.filledPlayerIds[slotIdx]);
    };

    this.quickPanel.roleSlotClickHandler = (templateId) => {
      this._showRoleQuickPicker(templateId === 'seen_as');
    };

    this.quickPanel.confirmHandler = () => this._confirmQuickEvent();
  }

  _buildRoleQuickPicker(el) {
    el.insertAdjacentHTML('beforeend', `
      <div class="elp-role-picker-overlay hidden">
        <div class="elp-role-picker-box">
          <h4>选择角色</h4>
          <div class="elp-role-grid"></div>
          <button class="btn elp-role-picker-close-btn">取消</button>
        </div>
      </div>
    `);
    this._rolePickerOverlay = el.querySelector('.elp-role-picker-overlay');
    this._roleBtns = {};
    const grid = el.querySelector('.elp-role-grid');
    ROLE_LIST.forEach(role => {
      const btn = document.createElement('button');
      btn.className = 'btn elp-role-btn';
      btn.textContent = role;
      btn.dataset.role = role;
      this._roleBtns[role] = btn;
      btn.addEventListener('click', () => {
        this.quickPanel.setRoleName(role);
        this._rolePickerOverlay.classList.add('hidden');
      });
      grid.appendChild(btn);
    });
    el.querySelector('.elp-role-picker-close-btn').addEventListener('click', () => {
      this._rolePickerOverlay.classList.add('hidden');
    });
    this._rolePickerOverlay.addEventListener('click', (e) => {
      if (e.target === this._rolePickerOverlay) {
        this._rolePickerOverlay.classList.add('hidden');
      }
    });
  }

  _showRoleQuickPicker(showBane) {
    if (this._roleBtns['克星']) {
      this._roleBtns['克星'].style.display = showBane ? '' : 'none';
    }
    this._rolePickerOverlay.classList.remove('hidden');
  }

  _bindDomEvents() {
    this._prevBtn.addEventListener('click', () => this._navigate('prev'));
    this._nextBtn.addEventListener('click', () => this._navigate('next'));
    this.el.querySelector('.el-close-btn').addEventListener('click', () => this.hide());
    this._recordBtn.addEventListener('click', () => this._openRecordFlow());
  }

  _bindEvents() {
    this.on(EV.EVENT_REMOTE_RECORD, () => this._renderEventList());
    this.on(EV.EVENT_REMOTE_DELETE, () => this._renderEventList());
    this.on(EV.EVENT_REMOTE_SYNC, () => this._renderEventList());
  }

  _isReadOnly() {
    return this.data.gameState !== 'in_gaming' || this.data.spyActive;
  }

  _canEditEvent(evt) {
    if (this.data.userType === 'god') return true;
    return !evt.autoGenerated && evt.localOnly;
  }

  _navigate(dir) {
    const currentPhase = this.mgr.currentViewPhase;
    const idx = PHASE_SEQUENCE.indexOf(currentPhase);
    let newIdx = idx;
    if (dir === 'prev' && idx > 0) newIdx = idx - 1;
    else if (dir === 'next' && idx < PHASE_SEQUENCE.length - 1) newIdx = idx + 1;
    if (newIdx === idx) return;

    const phase = PHASE_SEQUENCE[newIdx];
    this._eventListEl.style.opacity = '0';
    setTimeout(() => {
      this._phaseTitle.textContent = PHASE_LABELS[phase] || phase;
      this.mgr.setViewPhase(phase);
      this._selectedEventId = null;
      this._renderEventList();
      this._updateArrows();
      this._eventListEl.style.opacity = '1';
    }, 120);
  }

  _updateArrows() {
    const idx = PHASE_SEQUENCE.indexOf(this.mgr.currentViewPhase);
    this._prevBtn.style.opacity = idx <= 0 ? '0.3' : '1';
    this._nextBtn.style.opacity = idx >= PHASE_SEQUENCE.length - 1 ? '0.3' : '1';
  }

  _renderEventList() {
    this._updateRecordBtn();
    const events = this.mgr.getEventsByPhase(this.mgr.currentViewPhase);
    this._eventListEl.innerHTML = '';

    if (events.length === 0) {
      this._eventListEl.innerHTML = '<p class="el-empty">暂无事件记录</p>';
      return;
    }

    events.forEach(evt => {
      const isSelected = this._selectedEventId === evt.id;
      const color = TYPE_COLORS[evt.type] || '#888';
      const label = TYPE_LABELS[evt.type] || evt.type;

      const row = document.createElement('div');
      row.className = 'el-event-item' + (isSelected ? ' selected' : '');
      row.dataset.eventId = evt.id;

      const tag = document.createElement('span');
      tag.className = 'el-event-tag';
      tag.style.color = color;
      tag.textContent = `[${label}]`;
      row.appendChild(tag);

      if (evt.descParts && evt.descParts.length > 0) {
        const descSpan = document.createElement('span');
        descSpan.className = 'el-event-desc';
        evt.descParts.forEach(part => {
          const s = document.createElement('span');
          s.className = 'el-desc-' + (part.type || 'text');
          s.textContent = part.value;
          descSpan.appendChild(s);
        });
        row.appendChild(descSpan);
      } else {
        const desc = document.createElement('span');
        desc.className = 'el-event-desc';
        desc.style.color = evt.autoGenerated ? '#bbb' : '#64B5F6';
        desc.textContent = evt.description;
        row.appendChild(desc);
      }

      if (isSelected && !this._isReadOnly() && this._canEditEvent(evt)) {
        const actions = document.createElement('span');
        actions.className = 'el-event-actions';
        actions.innerHTML = `
          <button class="btn el-action-edit">修改</button>
          <button class="btn el-action-delete">删除</button>`;
        actions.querySelector('.el-action-edit').addEventListener('click', (e) => {
          e.stopPropagation();
          this._editEvent(evt.id);
        });
        actions.querySelector('.el-action-delete').addEventListener('click', (e) => {
          e.stopPropagation();
          this._deleteEvent(evt.id);
        });
        row.appendChild(actions);
      }

      row.addEventListener('click', () => {
        if (this._isReadOnly() || !this._canEditEvent(evt)) return;
        this._selectedEventId = this._selectedEventId === evt.id ? null : evt.id;
        this._renderEventList();
      });

      this._eventListEl.appendChild(row);
    });
  }

  _updateRecordBtn() {
    if (this._isReadOnly()) {
      const label = this.data.gameState === 'ended' ? '查看复盘中' : '查看事件中';
      this._recordBtn.textContent = label;
      this._recordBtn.disabled = true;
    } else {
      this._recordBtn.textContent = '记录事件';
      this._recordBtn.disabled = false;
    }
  }

  _openRecordFlow() {
    if (this._isReadOnly()) return;
    const players = this.mgr.getPlayerDisplayList();
    this.playerPicker.show(players, (pid) => {
      const p = players.find(pl => pl.playerId === pid);
      const name = p ? p.nickName : '玩家';
      this.quickPanel.show(name + '要做什么', null);
      this.quickPanel.setPlayerForSlot(0, pid);
    }, false, null);
  }

  _editEvent(eventId) {
    const evt = this.mgr.getEventById(eventId);
    if (!evt) return;
    this.quickPanel.show('修改事件', eventId);
    if (evt.templateId) {
      const tpl = QUICK_EVENT_TEMPLATES.find(t => t.id === evt.templateId);
      if (tpl) {
        this.quickPanel.applyEditState(
          tpl,
          evt.playerIds || [],
          evt.quickNumberValue,
          evt.quickRoleName
        );
      }
    }
  }

  _deleteEvent(eventId) {
    this.mgr.deleteEvent(eventId);
    this._selectedEventId = null;
    this._renderEventList();
  }

  _confirmQuickEvent() {
    const tpl = this.quickPanel.template;
    if (!tpl) return;

    const slotCount = tpl.text.includes('{2}') ? 3
      : (tpl.text.includes('{1}') ? 2
      : (tpl.text.includes('{0}') ? 1 : 0));
    for (let i = 0; i < slotCount; i++) {
      if (!this.quickPanel.filledPlayerIds[i]) {
        this.quickPanel.flashError('请先填完所有玩家');
        return;
      }
    }
    if (tpl.text.includes('{role}') && !this.quickPanel.filledRoleName) {
      this.quickPanel.flashError('请先选择角色');
      return;
    }

    const eid = this.quickPanel.editingEventId;
    if (eid) {
      this.mgr.updateQuickEvent(eid, tpl.id,
        this.quickPanel.filledPlayerIds,
        tpl.hasNumber ? this.quickPanel.numberValue : undefined,
        this.quickPanel.filledRoleName || undefined);
    } else {
      this.mgr.recordQuickEvent(tpl.id,
        this.quickPanel.filledPlayerIds,
        tpl.hasNumber ? this.quickPanel.numberValue : undefined,
        this.quickPanel.filledRoleName || undefined);
    }

    this.quickPanel.hide();
    this._selectedEventId = null;
    this._renderEventList();
  }

  show() {
    const gamePhase = this.data.gamePhase || PHASE_SEQUENCE[0];
    this.mgr.setViewPhase(gamePhase);
    this._phaseTitle.textContent = PHASE_LABELS[gamePhase] || gamePhase;
    this._selectedEventId = null;
    this._updateArrows();
    this._renderEventList();
    this.el.classList.remove('hidden');
    this._panel.classList.remove('hidden');
    this.emit(EV.EVENT_LOG_SHOWN);
  }

  hide() {
    this._panel.classList.add('hidden');
    this.el.classList.add('hidden');
    this._selectedEventId = null;
    this.quickPanel.hide();
    this._rolePickerOverlay?.classList.add('hidden');
    this.emit(EV.EVENT_LOG_HIDDEN);
  }

  destroy() {
    super.destroy();
  }
}
