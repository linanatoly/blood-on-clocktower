import { QUICK_EVENT_TEMPLATES } from '../event-constants.js';

const STYLE = `
.elp-quick-panel {
  position: absolute; inset: 0;
  background: rgba(0, 0, 0, 0.65);
  z-index: var(--z-modal, 200);
  display: flex; flex-direction: column;
  padding: 20px 16px; gap: 12px;
  background: rgba(0, 0, 0, 1);
}
.elp-quick-header {
  display: flex; align-items: center; justify-content: space-between;
}
.elp-quick-title {
  color: #FFD700; font-size: 25px; margin: 0;
}
.elp-quick-close {
  background: none; border: none;
  color: #aaa; font-size: 24px;
  cursor: pointer; padding: 0 4px; line-height: 1;
}
.elp-quick-close:hover { color: #fff; }
.elp-quick-hint {
  color: #888; font-size: 13px; margin: 0; text-align: center;
}
.elp-quick-preview {
  min-height: 200px;
  background: rgba(255,255,255,0.04);
  border: 1px dashed rgba(255,255,255,0.15);
  border-radius: 8px;
  padding: 12px; display: flex; flex-direction: column;
  align-items: center; gap: 8px;
  justify-content: center;
}
.elp-preview-label {
  color: #FFD700; font-size: 16px; font-weight: bold;
}
.elp-preview-line {
  display: flex; align-items: center; flex-wrap: wrap;
  justify-content: center; gap: 6px;
}
.elp-preview-text {
  color: #ccc; font-size: 20px;
}
.elp-preview-slot {
  display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 6px;
  font-size: 20px; cursor: pointer;
  transition: background 0.15s;
  min-height: var(--touch-min, 44px);
  text-decoration: underline;
  color: #ebe834ff;
}
.elp-preview-slot:hover { background: #283593; }
.elp-preview-slot:active { background: #3949ab; }
.elp-preview-slot.filled {
  text-decoration: underline;
  color: #14ce80ff;
}
.elp-preview-slot.filled:hover { background: #2e7d32; }
.elp-preview-slot.role-slot {
  color: #CE93D8;
}
.elp-preview-slot.role-slot:hover { background: #6a1b9a; }
.elp-preview-slot.role-slot.filled {
  text-decoration: underline;
}
.elp-preview-number {
  display: inline-flex; align-items: center; gap: 4px;
  background: #333; border-radius: 6px; padding: 2px;
}
.elp-num-btn {
  width: 28px; height: 28px; border: none; border-radius: 4px;
  font-size: 16px; cursor: pointer;
  background: #555; color: #fff;
  display: flex; align-items: center; justify-content: center;
  min-width: var(--touch-min, 44px); min-height: var(--touch-min, 44px);
}
.elp-num-btn:hover { background: #777; }
.elp-num-btn:active { background: #999; }
.elp-num-val {
  color: #FFD700; font-size: 18px; font-weight: bold;
  min-width: 24px; text-align: center;
}
.elp-quick-templates {
  flex: 1; overflow-y: auto;
  display: flex; flex-direction: column; gap: 50px;
}
.elp-template-row {
  display: flex; align-items: center; gap: 20px;
}
.elp-template-label {
  color: #888; font-size: 13px;
  min-width: 56px; padding-top: 6px;
  text-align: right; flex-shrink: 0;
}
.elp-template-btns {
  display: flex; flex-wrap: wrap; gap: 30px; flex: 1;
}
.elp-template-btn {
  padding: 6px 14px; font-size: 20px;
  background: #444; color: #ccc;
  border: 2px solid transparent;
  border-radius: 6px; cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  min-height: var(--touch-min, 44px);
}
.elp-template-btn:hover { background: #666; }
.elp-template-btn:active { background: #2ba736ff; }
.elp-template-btn.selected {
  border-color: #FFD700; background: #17771cff;
}
.elp-quick-footer {
  display: flex; align-items: center; justify-content: center;
  gap: 12px;
}
.elp-quick-error {
  color: #DA3939; font-size: 14px;
}
.elp-quick-confirm {
  padding: 10px 40px; font-size: 16px;
  min-height: var(--touch-min, 44px);
}
`;

export class QuickEventPanel {
  constructor(containerEl, mgr, data) {
    this.el = containerEl;
    this.mgr = mgr;
    this.data = data;
    this._selectedTemplate = null;
    this._filledPlayerIds = [];
    this._numberValue = 1;
    this._filledRoleName = '';
    this._editingEventId = null;
    this._onPlayerSlotClick = null;
    this._onRoleSlotClick = null;
    this._confirmHandler = null;
    this._buildDom();
    this._bindDomEvents();
  }

  _buildDom() {
    const styleEl = document.createElement('style');
    styleEl.textContent = STYLE;
    this.el.appendChild(styleEl);

    this.el.insertAdjacentHTML('beforeend', `
      <div class="elp-quick-panel hidden">
        <div class="elp-quick-header">
          <h4 class="elp-quick-title">快捷事件</h4>
          <button class="elp-quick-close">&times;</button>
        </div>
        <p class="elp-quick-hint">点击下方模板，在上方面板中填充</p>
        <div class="elp-quick-preview"></div>
        <div class="elp-quick-templates"></div>
        <div class="elp-quick-footer">
          <span class="elp-quick-error hidden"></span>
          <button class="btn elp-quick-confirm hidden">确认记录</button>
        </div>
      </div>
    `);
    this._panel = this.el.querySelector('.elp-quick-panel');
    this._previewEl = this.el.querySelector('.elp-quick-preview');
    this._templateEl = this.el.querySelector('.elp-quick-templates');
    this._titleEl = this.el.querySelector('.elp-quick-title');
    this._confirmBtn = this.el.querySelector('.elp-quick-confirm');
    this._errorEl = this.el.querySelector('.elp-quick-error');
  }

  _bindDomEvents() {
    this.el.querySelector('.elp-quick-close').addEventListener('click', () => this.hide());
    this._panel.addEventListener('click', (e) => {
      if (e.target === this._panel) this.hide();
    });
    this._confirmBtn.addEventListener('click', () => {
      if (this._confirmHandler) this._confirmHandler();
    });
  }

  show(title, editingEventId) {
    this._titleEl.textContent = title || '快捷事件';
    this._editingEventId = editingEventId || null;
    if (!editingEventId) {
      this._selectedTemplate = null;
      this._filledPlayerIds = [];
      this._numberValue = 1;
      this._filledRoleName = '';
      this._previewEl.innerHTML = '';
      this._confirmBtn.classList.add('hidden');
    }
    this._renderTemplates();
    this._panel.classList.remove('hidden');
  }

  hide() {
    this._panel.classList.add('hidden');
  }

  _renderTemplates() {
    const categories = [
      { key: 'solo', label: '自身事件', templates: [] },
      { key: 'inter', label: '技能事件', templates: [] },
      { key: 'role', label: '身份事件', templates: [] },
      { key: 'number', label: '数字事件', templates: [] },
      { key: 'general', label: '通用事件', templates: [] },
    ];

    QUICK_EVENT_TEMPLATES.forEach(t => {
      if (t.section === 'general') categories.find(c => c.key === 'general').templates.push(t);
      else if (t.hasNumber) categories.find(c => c.key === 'number').templates.push(t);
      else if (t.section === 'inter') categories.find(c => c.key === 'inter').templates.push(t);
      else if (t.text.includes('{role}')) categories.find(c => c.key === 'role').templates.push(t);
      else if (t.text.includes('{1}')) categories.find(c => c.key === 'inter').templates.push(t);
      else categories.find(c => c.key === 'solo').templates.push(t);
    });

    this._templateEl.innerHTML = '';
    categories.forEach(cat => {
      if (cat.templates.length === 0) return;
      const row = document.createElement('div');
      row.className = 'elp-template-row';
      row.innerHTML = `<span class="elp-template-label">${cat.label}</span>`;
      const btns = document.createElement('div');
      btns.className = 'elp-template-btns';
      cat.templates.forEach(t => {
        const btn = document.createElement('button');
        btn.className = 'btn elp-template-btn';
        btn.dataset.templateId = t.id;
        btn.textContent = t.label;
        if (this._selectedTemplate && this._selectedTemplate.id === t.id) {
          btn.classList.add('selected');
        }
        btn.addEventListener('click', () => this._selectTemplate(t));
        btns.appendChild(btn);
      });
      row.appendChild(btns);
      this._templateEl.appendChild(row);
    });
  }

  _selectTemplate(tpl) {
    this._selectedTemplate = tpl;
    const preFilled0 = this._filledPlayerIds[0];
    this._filledPlayerIds = [];
    if (preFilled0) this._filledPlayerIds[0] = preFilled0;
    this._filledRoleName = '';
    if (tpl.hasNumber) this._numberValue = tpl.numberDefault;
    this._renderPreview();
    this._confirmBtn.classList.remove('hidden');
    this._renderTemplates();
  }

  _renderPreview() {
    this._previewEl.innerHTML = '';
    if (!this._selectedTemplate) return;

    const tpl = this._selectedTemplate;
    const label = document.createElement('div');
    label.className = 'elp-preview-label';
    label.textContent = `「${tpl.label}」`;
    this._previewEl.appendChild(label);

    const parts = [];
    const regex = /\{(\d|n|role)\}/g;
    let match, lastIdx = 0, text = tpl.text;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIdx) parts.push({ type: 'text', value: text.substring(lastIdx, match.index) });
      if (match[1] === 'n') parts.push({ type: 'number' });
      else if (match[1] === 'role') parts.push({ type: 'role' });
      else parts.push({ type: 'slot', index: parseInt(match[1]) });
      lastIdx = match.index + match[0].length;
    }
    if (lastIdx < text.length) parts.push({ type: 'text', value: text.substring(lastIdx) });

    const line = document.createElement('div');
    line.className = 'elp-preview-line';
    parts.forEach(part => {
      if (part.type === 'text') {
        const span = document.createElement('span');
        span.className = 'elp-preview-text';
        span.textContent = part.value;
        line.appendChild(span);
      } else if (part.type === 'slot') {
        const pid = this._filledPlayerIds[part.index];
        const span = document.createElement('span');
        span.className = 'elp-preview-slot' + (pid ? ' filled' : '');
        span.textContent = pid ? this._getShortName(pid) : '点击选人';
        span.dataset.slot = part.index;
        span.addEventListener('click', () => {
          if (this._onPlayerSlotClick) this._onPlayerSlotClick(part.index);
        });
        line.appendChild(span);
      } else if (part.type === 'number') {
        const span = document.createElement('span');
        span.className = 'elp-preview-number';
        span.innerHTML = `
          <button class="elp-num-btn minus">-</button>
          <span class="elp-num-val">${this._numberValue}</span>
          <button class="elp-num-btn plus">+</button>`;
        span.querySelector('.minus').addEventListener('click', () => {
          if (this._numberValue > (tpl.numberMin || 0)) { this._numberValue--; this._renderPreview(); }
        });
        span.querySelector('.plus').addEventListener('click', () => {
          if (this._numberValue < (tpl.numberMax || 99)) { this._numberValue++; this._renderPreview(); }
        });
        line.appendChild(span);
      } else if (part.type === 'role') {
        const span = document.createElement('span');
        span.className = 'elp-preview-slot role-slot' + (this._filledRoleName ? ' filled' : '');
        span.textContent = this._filledRoleName || '点击选角色';
        span.addEventListener('click', () => {
          if (this._onRoleSlotClick) this._onRoleSlotClick(this._selectedTemplate?.id);
        });
        line.appendChild(span);
      }
    });
    this._previewEl.appendChild(line);
  }

  _getShortName(pid) {
    const players = this.mgr.getPlayerDisplayList();
    const p = players.find(pl => pl.playerId === pid);
    if (!p) return '玩家';
    return `${p.seatNum + 1}号${p.nickName}（${p.roleName}）`;
  }

  set slotClickHandler(fn) { this._onPlayerSlotClick = fn; }
  set roleSlotClickHandler(fn) { this._onRoleSlotClick = fn; }
  set confirmHandler(fn) { this._confirmHandler = fn; }
  setPlayerForSlot(slotIdx, playerId) { this._filledPlayerIds[slotIdx] = playerId; this._renderPreview(); }
  setRoleName(name) { this._filledRoleName = name; this._renderPreview(); }
  get template() { return this._selectedTemplate; }
  get filledPlayerIds() { return [...this._filledPlayerIds]; }
  get numberValue() { return this._numberValue; }
  get filledRoleName() { return this._filledRoleName; }
  get editingEventId() { return this._editingEventId; }

  applyEditState(tpl, playerIds, numberValue, roleName) {
    this._selectedTemplate = tpl;
    this._filledPlayerIds = [...(playerIds || [])];
    if (tpl.hasNumber) this._numberValue = numberValue !== undefined ? numberValue : tpl.numberDefault;
    this._filledRoleName = roleName || '';
    this._renderPreview();
    this._confirmBtn.classList.remove('hidden');
    this._renderTemplates();
  }

  flashError(msg) {
    this._errorEl.textContent = msg;
    this._errorEl.classList.remove('hidden');
    setTimeout(() => this._errorEl.classList.add('hidden'), 1200);
  }
}
