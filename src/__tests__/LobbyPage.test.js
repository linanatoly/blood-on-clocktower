import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '../core/EventBus.js';
import { EV } from '../event-constants.js';

const mockStore = { current: null };

vi.mock('../dataManager/dataManager.js', () => ({
  DataManager: { getInstance: () => mockStore.current },
}));

function createContainer() {
  const div = document.createElement('div');
  div.id = 'page-lobby';
  document.body.appendChild(div);
  return div;
}

let eb, container, page;

beforeEach(async () => {
  eb = new EventBus();
  container = createContainer();
  mockStore.current = {
    userId: null,
    userType: null,
    createRoom: vi.fn(),
    joinRoom: vi.fn(),
    clearSession: vi.fn(),
  };
  const { LobbyPage } = await import('../LobbyPage.js');
  page = new LobbyPage(eb, container);
});

describe('LobbyPage', () => {
  it('构造时创建完整 DOM', () => {
    expect(container.querySelector('[data-tab="god"]')).toBeTruthy();
    expect(container.querySelector('[data-tab="player"]')).toBeTruthy();
    expect(container.querySelector('[data-input="god-room"]')).toBeTruthy();
  });

  it('默认显示上帝 Tab', () => {
    expect(page.userType).toBe('god');
  });

  it('切换到玩家 Tab', () => {
    container.querySelector('[data-tab="player"]').click();
    expect(page.userType).toBe('player');
    expect(container.querySelector('[data-panel="god"]').classList.contains('hidden')).toBe(true);
    expect(container.querySelector('[data-panel="player"]').classList.contains('hidden')).toBe(false);
  });

  it('上帝侧：4 位数字校验通过', () => {
    page._els.godRoom.value = '1234';
    page._syncValidation();
    expect(page._els.createBtn.disabled).toBe(false);
  });

  it('上帝侧：非 4 位数字校验失败', () => {
    page._els.godRoom.value = '12';
    page._syncValidation();
    expect(page._els.createBtn.disabled).toBe(true);
  });

  it('玩家侧：房间号和昵称都填写后按钮可用', () => {
    page._els.playerRoom.value = '1234';
    page._els.playerName.value = '测试玩家';
    page._syncValidation();
    expect(page._els.joinBtn.disabled).toBe(false);
  });

  it('点击"开房间"发送 createRoom', () => {
    page._els.godRoom.value = '1234';
    page._syncValidation();
    page._els.createBtn.click();
    expect(mockStore.current.createRoom).toHaveBeenCalledWith('1234', page.totalPlayers, expect.any(Array));
  });

  it('isWaiting 时不重复提交', () => {
    page.isWaiting = true;
    page._els.createBtn.click();
    expect(mockStore.current.createRoom).not.toHaveBeenCalled();
  });

  it('收到 ROOM_STATE_RECEIVED 清除等待', () => {
    page.isWaiting = true;
    eb.emit(EV.ROOM_STATE_RECEIVED, {});
    expect(page.isWaiting).toBe(false);
  });

  it('阵营人数警告显示', () => {
    page.totalPlayers = 10;
    page.currentNum = [5, 1, 1, 1]; // sum=8
    page._syncValidation();
    expect(page._els.campMsg.textContent).toContain('阵营人数总和');
  });

  it('阵营 +/- 按钮', () => {
    const init = page.currentNum[0];
    const plusBtn = container.querySelector('[data-camp-idx="0"][data-action="plus"]');
    if (plusBtn) plusBtn.click();
    expect(page.currentNum[0]).toBe(init + 1);
  });

  it('显示/隐藏重连提示', () => {
    page.showReconnecting('正在重连...');
    expect(page._els.reconnect.classList.contains('hidden')).toBe(false);
    page.hideReconnecting();
    expect(page._els.reconnect.classList.contains('hidden')).toBe(true);
  });
});
