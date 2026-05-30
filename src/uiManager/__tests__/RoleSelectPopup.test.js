import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '../../core/EventBus.js';
import { RoleSelectPopup } from '../RoleSelectPopup.js';
import { EV } from '../../event-constants.js';

function createContainer() {
  const div = document.createElement('div');
  document.body.appendChild(div);
  return div;
}

describe('RoleSelectPopup', () => {
  let eb, container, popup;

  beforeEach(() => {
    eb = new EventBus();
    container = createContainer();
    popup = new RoleSelectPopup(eb, container);
  });

  it('构造时创建角色选择 DOM', () => {
    expect(container.querySelector('.role-select-overlay')).toBeTruthy();
    expect(container.querySelectorAll('.role-card').length).toBeGreaterThan(0);
  });

  it('show 显示弹窗（single 模式）', () => {
    popup.show('player_1', 'single', 0);
    const overlay = container.querySelector('.role-select-overlay');
    expect(overlay.classList.contains('hidden')).toBe(false);
    expect(popup._playerId).toBe('player_1');
    expect(popup._chooseMode).toBe('single');
  });

  it('single 模式：点击一个角色选中，之前选中取消', () => {
    popup.show('p1', 'single', 0);
    const cards = container.querySelectorAll('.role-card');
    cards[0].click();
    expect(cards[0].classList.contains('selected')).toBe(true);

    cards[1].click();
    expect(cards[0].classList.contains('selected')).toBe(false);
    expect(cards[1].classList.contains('selected')).toBe(true);
    expect(popup._chooseList.length).toBe(1);
  });

  it('确认选择发送 AVATAR_CONFIRM 事件', () => {
    const spy = vi.fn();
    eb.on(EV.AVATAR_CONFIRM, spy);
    popup.show('p1', 'single', 2);

    const card = container.querySelector('.role-card');
    card.click();
    container.querySelector('.role-select-confirm').click();

    expect(spy).toHaveBeenCalled();
    const args = spy.mock.calls[0];
    expect(args[0]).toBe('p1');
    expect(args[2]).toBe(2);
  });

  it('quick 模式点击确认执行回调', () => {
    const cb = vi.fn();
    popup.show('p1', 'single', 0, cb);

    const card = container.querySelector('.role-card');
    card.click();
    container.querySelector('.role-select-confirm').click();

    expect(cb).toHaveBeenCalled();
    expect(container.querySelector('.role-select-overlay').classList.contains('hidden')).toBe(true);
  });

  it('未选角色点击确认不发送事件', () => {
    const spy = vi.fn();
    eb.on(EV.AVATAR_CONFIRM, spy);
    popup.show('p1', 'single', 0);
    container.querySelector('.role-select-confirm').click();
    expect(spy).not.toHaveBeenCalled();
  });

  it('关闭按钮隐藏弹窗', () => {
    popup.show('p1', 'single', 0);
    container.querySelector('.role-select-close').click();
    expect(container.querySelector('.role-select-overlay').classList.contains('hidden')).toBe(true);
  });
});
