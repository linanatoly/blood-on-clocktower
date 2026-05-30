import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '../../core/EventBus.js';
import { WaitingList } from '../WaitingList.js';
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

beforeEach(() => {
  mockStore.current = {
    userId: 'player_1',
    godId: 'god_1',
    playerList: [
      { playerId: 'player_1', nickName: '我', seatNum: 0 },
      { playerId: 'player_2', nickName: '小明', seatNum: null },
      { playerId: 'player_3', nickName: '小红', seatNum: null },
      { playerId: 'god_1', seatNum: null },
    ],
  };
});

describe('WaitingList', () => {
  it('构造时创建 DOM 结构', () => {
    const eb = new EventBus();
    const container = createContainer();
    const wl = new WaitingList(eb, container);
    expect(container.querySelector('.waiting-list')).toBeTruthy();
  });

  it('refresh 过滤未入座的玩家（排除上帝）', () => {
    const eb = new EventBus();
    const container = createContainer();
    const wl = new WaitingList(eb, container);
    wl.refresh(mockStore.current.playerList);
    const items = container.querySelectorAll('.waiting-item');
    expect(items.length).toBe(2); // 小明 + 小红（排除上帝和已入座的我）
  });

  it('列表为空时显示占位提示', () => {
    const eb = new EventBus();
    const container = createContainer();
    const wl = new WaitingList(eb, container);
    wl.refresh([]);
    expect(container.querySelector('.waiting-empty')).toBeTruthy();
  });

  it('自己的条目显示"我"标记', () => {
    const eb = new EventBus();
    const container = createContainer();
    const wl = new WaitingList(eb, container);
    // player_1 已有座位，等待列表里不会显示
    // 修改 mock 数据，让 player_1 没入座
    mockStore.current.userId = 'player_2';
    mockStore.current.playerList = [
      { playerId: 'player_2', nickName: '小明', seatNum: null },
      { playerId: 'player_3', nickName: '小红', seatNum: null },
    ];
    wl.refresh(mockStore.current.playerList);
    const myItem = container.querySelector('.is-me');
    expect(myItem).toBeTruthy();
    expect(myItem.querySelector('.badge-me')).toBeTruthy();
  });

  it('show/hide 控制显示', () => {
    const eb = new EventBus();
    const container = createContainer();
    const wl = new WaitingList(eb, container);
    wl.show();
    expect(container.querySelector('.waiting-list').classList.contains('hidden')).toBe(false);
    wl.hide();
    expect(container.querySelector('.waiting-list').classList.contains('hidden')).toBe(true);
  });

  it('响应 PLAYER_LIST_UPDATED 事件', () => {
    const eb = new EventBus();
    const container = createContainer();
    const wl = new WaitingList(eb, container);
    eb.emit(EV.PLAYER_LIST_UPDATED, [
      { playerId: 'p_new', nickName: '新人', seatNum: null },
    ]);
    const items = container.querySelectorAll('.waiting-item');
    expect(items.length).toBe(1);
  });
});
