import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '../../core/EventBus.js';
import { GroupChatPopup } from '../GroupChatPopup.js';
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

let eb, container, popup;

beforeEach(() => {
  eb = new EventBus();
  container = createContainer();
  mockStore.current = {
    userId: 'god_1',
    godId: 'god_1',
    playerList: [
      { playerId: 'god_1', nickName: '上帝', seatNum: null },
      { playerId: 'player_1', nickName: '小明', seatNum: 0 },
      { playerId: 'player_2', nickName: '小红', seatNum: 1 },
      { playerId: 'player_3', nickName: '小刚', seatNum: 2 },
    ],
  };
  popup = new GroupChatPopup(eb, container);
});

describe('GroupChatPopup', () => {
  it('构造时创建 DOM', () => {
    expect(container.querySelector('.group-chat-overlay')).toBeTruthy();
  });

  it('show 渲染玩家列表（排除上帝）', () => {
    popup.show();
    expect(container.querySelectorAll('.group-chat-player-item').length).toBe(3);
  });

  it('选择至少2个玩家触发群聊', () => {
    const spy = vi.fn();
    eb.on(EV.GROUP_CHAT_CREATE, spy);
    popup.show();
    const items = container.querySelectorAll('.group-chat-player-item');
    items[0].click(); items[1].click();
    container.querySelector('.group-chat-confirm').click();
    expect(spy).toHaveBeenCalled();
  });

  it('选择1个玩家时发起私聊', () => {
    const spy = vi.fn();
    eb.on(EV.START_CHAT, spy);
    popup.show();
    container.querySelectorAll('.group-chat-player-item')[0].click();
    container.querySelector('.group-chat-confirm').click();
    expect(spy).toHaveBeenCalledWith(0);
  });

  it('未选玩家点击确定显示提示', () => {
    popup.show();
    container.querySelector('.group-chat-confirm').click();
    expect(container.querySelector('.group-chat-hint').classList.contains('hidden')).toBe(false);
  });

  it('hide 隐藏弹窗', () => {
    popup.show();
    popup.hide();
    expect(container.querySelector('.group-chat-overlay').classList.contains('hidden')).toBe(true);
  });
});
