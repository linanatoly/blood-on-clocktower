import { UIComponent } from './UIComponent.js';
import { EV } from '../event-constants.js';

const ROLE_TABLE = {
  campTitle: ['村民', '外来者', '爪牙', '恶魔'],
  goodGuy: [
    { imgKey: 'xiyifu', text: '洗衣妇' },
    { imgKey: 'tushuguanli', text: '图书管理员' },
    { imgKey: 'diaocha', text: '调查员' },
    { imgKey: 'chushi', text: '厨师' },
    { imgKey: 'gongqing', text: '共情者' },
    { imgKey: 'zhanpu', text: '占卜师' },
    { imgKey: 'juemu', text: '掘墓人' },
    { imgKey: 'senlv', text: '僧侣' },
    { imgKey: 'shouya', text: '守鸦人' },
    { imgKey: 'shengnv', text: '圣女' },
    { imgKey: 'shashou', text: '杀手' },
    { imgKey: 'shibing', text: '士兵' },
    { imgKey: 'shizhang', text: '市长' },
  ],
  midGuy: [
    { imgKey: 'guanjia', text: '管家' },
    { imgKey: 'jiugui', text: '酒鬼' },
    { imgKey: 'shengtu', text: '圣徒' },
    { imgKey: 'yinshi', text: '隐士' },
  ],
  badGuy: [
    { imgKey: 'xiadu', text: '下毒者' },
    { imgKey: 'jiandie', text: '间谍' },
    { imgKey: 'meimo', text: '魅魔' },
    { imgKey: 'nanjue', text: '男爵' },
  ],
  xiaoDemo: [
    { imgKey: 'xiaoemo', text: '小恶魔' },
  ],
};

const IMG_PATH = {
  goodGuy: 'assets/identity/',
  midGuy: 'assets/identity/midguy/',
  badGuy: 'assets/identity/badguy/',
  xiaoDemo: 'assets/identity/badguy/',
};

export class RoleSelectPopup extends UIComponent {
  constructor(eventBus, containerEl) {
    super(eventBus, containerEl);
    this._playerId = null;
    this._seatNum = null;
    this._chooseMode = 'single';
    this._chooseList = [];
    this._quickCallback = null;
    this._buildDom();
    this._bindDomEvents();
  }

  _buildDom() {
    const campKeys = Object.keys(ROLE_TABLE).filter(k => k !== 'campTitle');
    let gridHtml = '';
    ROLE_TABLE.campTitle.forEach((title, i) => {
      const key = campKeys[i];
      if (!key || !ROLE_TABLE[key]) return;
      gridHtml += `<div class="role-category"><h4>${title}</h4><div class="role-cards">`;
      ROLE_TABLE[key].forEach(role => {
        const imgSrc = IMG_PATH[key] + role.imgKey + '.png';
        gridHtml += `
          <button class="role-card" data-img="${role.imgKey}" data-text="${role.text}" data-camp="${key}">
            <img src="${imgSrc}" alt="${role.text}">
            <span>${role.text}</span>
          </button>`;
      });
      gridHtml += '</div></div>';
    });

    this.el.innerHTML = `
      <div class="overlay role-select-overlay hidden">
        <div class="role-select-panel">
          <div class="role-select-header">
            <h3>选择角色</h3>
            <button class="role-select-close">&times;</button>
          </div>
          <div class="role-select-grid">${gridHtml}</div>
          <div class="role-select-footer">
            <button class="btn btn-primary role-select-confirm">确认选择</button>
          </div>
        </div>
      </div>
    `;

    this._overlay = this.el.querySelector('.role-select-overlay');
    this._cardEls = this.el.querySelectorAll('.role-card');
  }

  _bindDomEvents() {
    this.el.querySelector('.role-select-close').addEventListener('click', () => {
      this._quickCallback = null;
      this.hide();
    });
    this._overlay.addEventListener('click', (e) => {
      if (e.target === this._overlay) { this._quickCallback = null; this.hide(); }
    });

    this._cardEls.forEach(card => {
      card.addEventListener('click', () => {
        if (this._chooseMode === 'single') {
          this._cardEls.forEach(c => c.classList.remove('selected'));
          this._chooseList = [];
        }
        if (card.classList.contains('selected')) {
          card.classList.remove('selected');
          this._chooseList = this._chooseList.filter(
            r => !(r.imgKey === card.dataset.img && r.text === card.dataset.text)
          );
        } else {
          card.classList.add('selected');
          this._chooseList.push({ imgKey: card.dataset.img, text: card.dataset.text });
        }
      });
    });

    this.el.querySelector('.role-select-confirm').addEventListener('click', () => {
      if (this._quickCallback && this._chooseList.length > 0) {
        const roleName = this._chooseList[0].text;
        const cb = this._quickCallback;
        this._quickCallback = null;
        this.hide();
        cb(roleName);
        return;
      }
      if (this._chooseList.length > 0) {
        this.emit(EV.AVATAR_CONFIRM, this._playerId, this._chooseList, this._seatNum);
      }
      this.hide();
    });
  }

  show(playerId, chooseModel, seatNum, onRoleSelected) {
    this._playerId = playerId;
    this._seatNum = seatNum;
    this._chooseMode = chooseModel || 'single';
    this._quickCallback = onRoleSelected || null;
    this._chooseList = [];

    this._cardEls.forEach(c => c.classList.remove('selected'));
    this.el.classList.remove('hidden');
    this._overlay.classList.remove('hidden');
  }

  hide() {
    this._overlay.classList.add('hidden');
    this.el.classList.add('hidden');
  }

  destroy() {
    this._overlay = null;
    this._cardEls = null;
    this._quickCallback = null;
    this._chooseList = [];
    super.destroy();
  }
}
