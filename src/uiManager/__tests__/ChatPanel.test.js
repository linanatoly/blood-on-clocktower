import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '../../core/EventBus.js';
import { ChatPanel } from '../ChatPanel.js';
import { EV } from '../../event-constants.js';

const mockStore = { current: null };

vi.mock('../../dataManager/dataManager.js', () => ({
  DataManager: { getInstance: () => mockStore.current },
}));

function createContainer() {
  const div = document.createElement('div');
  document.body.appendChild(div);
  return div;
}

let eb, container, panel;

beforeEach(() => {
  eb = new EventBus();
  container = createContainer();
  mockStore.current = {
    userId: 'player_1',
    godId: 'god_1',
    userType: 'player',
    chatSessionList: [
      { key: 'private:player_1:player_2', name: '小明', lastMsg: '你好', lastTime: '12:00', unRead: 2, participantIds: ['player_1', 'player_2'] },
    ],
    chatMsgList: [],
    clearSessionUnRead: vi.fn(),
  };
  panel = new ChatPanel(eb, container);
});

describe('ChatPanel', () => {
  it('构造时创建完整 DOM', () => {
    expect(container.querySelector('.chat-panel')).toBeTruthy();
    expect(container.querySelector('.chat-input')).toBeTruthy();
  });

  it('show 显示面板并渲染会话列表', () => {
    panel.show();
    expect(container.querySelector('.chat-panel').classList.contains('hidden')).toBe(false);
    expect(container.querySelectorAll('.chat-session-item').length).toBe(1);
  });

  it('上帝用户显示群聊按钮', () => {
    mockStore.current.userType = 'god';
    const panel2 = new ChatPanel(new EventBus(), createContainer());
    panel2.show();
    expect(panel2.el.querySelector('.chat-group-btn').classList.contains('hidden')).toBe(false);
  });

  it('openSession 打开会话详情', () => {
    const spy = vi.fn();
    eb.on(EV.CHATUI_OPEN_SESSION, spy);
    panel.openSession(mockStore.current.chatSessionList[0]);
    expect(panel.currentSession).toBe(mockStore.current.chatSessionList[0]);
    expect(spy).toHaveBeenCalled();
  });

  it('返回按钮回到列表', () => {
    panel.show();
    panel.openSession(mockStore.current.chatSessionList[0]);
    container.querySelector('.chat-back-btn').click();
    expect(container.querySelector('.chat-list-page').classList.contains('hidden')).toBe(false);
  });

  it('renderChatMsg 渲染消息', () => {
    panel.renderChatMsg([
      { isMe: true, showName: '我', content: '你好' },
      { isMe: false, showName: '小明', content: '嗨' },
    ]);
    expect(container.querySelector('.chat-msg-list').querySelectorAll('.chat-msg-item').length).toBe(2);
  });

  it('发送消息 emit SEND_MSG', () => {
    const spy = vi.fn();
    eb.on(EV.SEND_MSG, spy);
    panel.currentSession = mockStore.current.chatSessionList[0];
    panel._chatInput.value = '测试消息';
    panel._send();
    expect(spy).toHaveBeenCalled();
  });

  it('Enter 键发送消息', () => {
    const spy = vi.fn();
    eb.on(EV.SEND_MSG, spy);
    panel.currentSession = mockStore.current.chatSessionList[0];
    panel._chatInput.value = '回车';
    panel._chatInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(spy).toHaveBeenCalled();
  });

  it('_truncate 截断长文本', () => {
    expect(panel._truncate('12345678901234567890', 18)).toBe('12345678901234567...');
    expect(panel._truncate('short', 18)).toBe('short');
  });

  it('响应 CHAT_DATA_UPDATE', () => {
    panel.show();
    container.querySelector('.chat-session-list').innerHTML = '';
    eb.emit(EV.CHAT_DATA_UPDATE);
    expect(container.querySelectorAll('.chat-session-item').length).toBe(1);
  });

  it('hide 隐藏面板', () => {
    panel.show();
    panel.hide();
    expect(container.querySelector('.chat-panel').classList.contains('hidden')).toBe(true);
  });
});
