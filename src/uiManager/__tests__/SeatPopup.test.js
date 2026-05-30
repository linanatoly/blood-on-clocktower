import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '../../core/EventBus.js';
import { SeatPopup } from '../SeatPopup.js';
import { EV } from '../../event-constants.js';

function createContainer() {
  const div = document.createElement('div');
  document.body.appendChild(div);
  return div;
}

describe('SeatPopup', () => {
  let eb, container, popup;

  beforeEach(() => {
    eb = new EventBus();
    container = createContainer();
    popup = new SeatPopup(eb, container);
  });

  it('构造时创建 DOM 结构', () => {
    expect(container.querySelector('.seat-popup-overlay')).toBeTruthy();
    expect(container.querySelector('.seat-popup-title')).toBeTruthy();
    expect(container.querySelectorAll('.btn-action').length).toBe(7);
  });

  it('show 显示弹窗并设置标题', () => {
    popup.show(0, {
      targetPlayerId: 'p1',
      player_ID: 'controller_1',
      nickName: '小明',
      showSitBtn: true,
      showChooseAvatrBtn: false,
      showChatBtn: false,
      showDeadWithTicketBtn: false,
      showDeadWithoutTicketBtn: false,
      showAliveBtn: false,
      showDrunkBtn: false,
      chooseModel: 'single',
    });

    const overlay = container.querySelector('.seat-popup-overlay');
    expect(overlay.classList.contains('hidden')).toBe(false);
    expect(container.querySelector('.seat-popup-title').textContent).toContain('小明');
  });

  it('空座位显示"空座位"', () => {
    popup.show(0, {
      targetPlayerId: null,
      player_ID: 'c1',
      nickName: '空座位',
      showSitBtn: true,
      showChooseAvatrBtn: false,
      showChatBtn: false,
      showDeadWithTicketBtn: false,
      showDeadWithoutTicketBtn: false,
      showAliveBtn: false,
      showDrunkBtn: false,
      chooseModel: null,
    });

    expect(container.querySelector('.seat-popup-title').textContent).toBe('空座位');
  });

  it('点击"坐这"按钮发送 SEAT_SITDOWN 事件并隐藏弹窗', () => {
    const spy = vi.fn();
    eb.on(EV.SEAT_SITDOWN, spy);

    popup.show(3, {
      targetPlayerId: null,
      player_ID: 'c1',
      nickName: '空座位',
      showSitBtn: true,
      showChooseAvatrBtn: false,
      showChatBtn: false,
      showDeadWithTicketBtn: false,
      showDeadWithoutTicketBtn: false,
      showAliveBtn: false,
      showDrunkBtn: false,
      chooseModel: null,
    });

    const sitBtn = container.querySelector('[data-action="sit"]');
    sitBtn.click();

    expect(spy).toHaveBeenCalledWith('c1', 3);
    expect(container.querySelector('.seat-popup-overlay').classList.contains('hidden')).toBe(true);
  });

  it('点击"聊天"按钮发送 START_CHAT 事件', () => {
    const spy = vi.fn();
    eb.on(EV.START_CHAT, spy);

    popup.show(1, {
      targetPlayerId: 'p2',
      player_ID: 'c1',
      nickName: '玩家',
      showSitBtn: false,
      showChooseAvatrBtn: false,
      showChatBtn: true,
      showDeadWithTicketBtn: false,
      showDeadWithoutTicketBtn: false,
      showAliveBtn: false,
      showDrunkBtn: false,
    });

    container.querySelector('[data-action="chat"]').click();
    expect(spy).toHaveBeenCalledWith(1);
  });

  it('只有可见按钮显示，其他隐藏', () => {
    popup.show(0, {
      targetPlayerId: 'p1',
      player_ID: 'c1',
      nickName: '玩家',
      showSitBtn: false,
      showChooseAvatrBtn: true,
      showChatBtn: false,
      showDeadWithTicketBtn: false,
      showDeadWithoutTicketBtn: false,
      showAliveBtn: false,
      showDrunkBtn: false,
    });

    const sitBtn = container.querySelector('[data-action="sit"]');
    const roleBtn = container.querySelector('[data-action="setRole"]');
    expect(sitBtn.style.display).toBe('none');
    expect(roleBtn.style.display).not.toBe('none');
  });

  it('点击关闭按钮隐藏', () => {
    popup.show(0, {
      targetPlayerId: null,
      player_ID: 'c1',
      nickName: '空座位',
      showSitBtn: true,
      showChooseAvatrBtn: false,
      showChatBtn: false,
      showDeadWithTicketBtn: false,
      showDeadWithoutTicketBtn: false,
      showAliveBtn: false,
      showDrunkBtn: false,
    });

    container.querySelector('.seat-popup-close').click();
    expect(container.querySelector('.seat-popup-overlay').classList.contains('hidden')).toBe(true);
  });
});
