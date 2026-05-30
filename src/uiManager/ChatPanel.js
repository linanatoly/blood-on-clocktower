import { UIComponent } from './UIComponent.js';
import { EV } from '../event-constants.js';
import { DataManager } from '../dataManager/dataManager.js';

export class ChatPanel extends UIComponent {
  constructor(eventBus, containerEl) {
    super(eventBus, containerEl);
    this.data = DataManager.getInstance();
    this.currentSession = null;
    this._buildDom();
    this._bindDomEvents();
    this._bindEvents();
  }

  _buildDom() {
    this.el.innerHTML = `
      <div class="chat-panel hidden">
        <div class="chat-page chat-list-page">
          <div class="chat-header">
            <h3>聊天列表</h3>
            <button class="btn chat-group-btn hidden">发起群聊</button>
            <button class="btn chat-close-btn">&#x2715;</button>
          </div>
          <div class="chat-session-list"></div>
        </div>
        <div class="chat-page chat-detail-page hidden">
          <div class="chat-header">
            <button class="btn chat-back-btn">&larr; 返回</button>
            <h3 class="chat-detail-title"></h3>
          </div>
          <div class="chat-msg-list"></div>
          <div class="chat-input-bar">
            <input type="text" class="chat-input" placeholder="输入消息" autocomplete="off">
            <button class="btn btn-primary chat-send-btn">发送</button>
          </div>
        </div>
      </div>
    `;

    this._panel = this.el.querySelector('.chat-panel');
    this._listPage = this.el.querySelector('.chat-list-page');
    this._detailPage = this.el.querySelector('.chat-detail-page');
    this._sessionListEl = this.el.querySelector('.chat-session-list');
    this._msgListEl = this.el.querySelector('.chat-msg-list');
    this._chatInput = this.el.querySelector('.chat-input');
    this._detailTitle = this.el.querySelector('.chat-detail-title');
    this._groupBtn = this.el.querySelector('.chat-group-btn');
  }

  _bindDomEvents() {
    this.el.querySelector('.chat-back-btn').addEventListener('click', () => this._backToList());
    this.el.querySelector('.chat-send-btn').addEventListener('click', () => this._send());
    this.el.querySelector('.chat-close-btn').addEventListener('click', () => this.hide());
    this._chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._send();
    });
    this._groupBtn.addEventListener('click', () => {
      this.emit(EV.GROUP_CHAT_OPEN);
    });
  }

  _bindEvents() {
    this.on(EV.CHAT_DATA_UPDATE, () => {
      if (this._listPage.classList.contains('hidden')) return;
      this.renderSessionList();
    });
  }

  _send() {
    const content = this._chatInput.value.trim();
    if (!content || !this.currentSession) return;
    this.emit(EV.SEND_MSG, content, this.currentSession);
    this._chatInput.value = '';
  }

  renderSessionList() {
    this._sessionListEl.innerHTML = '';
    const sessions = this.data.chatSessionList;

    sessions.forEach(ses => {
      const item = document.createElement('div');
      item.className = 'chat-session-item';
      item.innerHTML = `
        <span class="chat-session-name">${ses.name}</span>
        <span class="chat-session-last">${this._truncate(ses.lastMsg, 18) || '暂无消息'}</span>
        ${ses.unRead > 0 ? `<span class="chat-unread-badge">${ses.unRead}</span>` : ''}
      `;
      item.addEventListener('click', () => this.openSession(ses));
      this._sessionListEl.appendChild(item);
    });
  }

  renderChatMsg(msgList) {
    this._msgListEl.innerHTML = '';
    msgList.forEach(msg => {
      const isMe = msg.isMe;
      const div = document.createElement('div');
      div.className = 'chat-msg-item ' + (isMe ? 'msg-self' : 'msg-other');
      div.innerHTML = `
        <span class="chat-msg-sender">${msg.showName}</span>
        <div class="chat-msg-bubble">${msg.content}</div>
      `;
      this._msgListEl.appendChild(div);
    });
    this._msgListEl.scrollTop = this._msgListEl.scrollHeight;
  }

  openSession(session) {
    this.currentSession = session;
    this._detailTitle.textContent = session.name;
    this._listPage.classList.add('hidden');
    this._detailPage.classList.remove('hidden');

    const msgs = this.data.chatSessionList.find ? [] : [];
    this.emit(EV.CHATUI_OPEN_SESSION, session);

    this._chatInput.value = '';
  }

  _backToList() {
    this._detailPage.classList.add('hidden');
    this._listPage.classList.remove('hidden');
    this.currentSession = null;
    this.renderSessionList();
    this.emit(EV.CHATUI_CLOSE_SESSION);
  }

  _truncate(text, max) {
    if (!text) return '';
    return text.length > max ? text.substring(0, max - 1) + '...' : text;
  }

  show() {
    this.el.classList.remove('hidden');
    this._panel.classList.remove('hidden');
    this._listPage.classList.remove('hidden');
    this._detailPage.classList.add('hidden');

    const isGod = this.data.userType === 'god';
    this._groupBtn.classList.toggle('hidden', !isGod);

    this.renderSessionList();
    this.emit(EV.CHAT_SHOWN);
  }

  hide() {
    this._panel.classList.add('hidden');
    this.el.classList.add('hidden');
    this._chatInput.value = '';
    this.emit(EV.CHAT_HIDDEN);
  }
}
