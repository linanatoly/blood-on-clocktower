import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlayerPickerPanel } from '../PlayerPickerPanel.js';

function createContainer() {
  const div = document.createElement('div');
  document.body.appendChild(div);
  return div;
}

const makePlayers = () => [
  { playerId: 'p1', nickName: '小明', roleName: '占卜师', stateNow: 'alive', seatNum: 0 },
  { playerId: 'p2', nickName: '小红', roleName: '士兵', stateNow: 'dead_with_ticket', seatNum: 1 },
  { playerId: 'p3', nickName: '小刚', roleName: '圣女', stateNow: 'alive', seatNum: 2 },
];

describe('PlayerPickerPanel', () => {
  let container, picker;

  beforeEach(() => {
    container = createContainer();
    picker = new PlayerPickerPanel(container);
  });

  it('构造时创建 DOM', () => {
    expect(container.querySelector('.elp-player-picker-overlay')).toBeTruthy();
    expect(container.querySelector('.elp-player-picker-list')).toBeTruthy();
  });

  it('show 渲染玩家列表', () => {
    picker.show(makePlayers(), () => {}, false, null);
    expect(container.querySelector('.elp-player-picker-overlay').classList.contains('hidden')).toBe(false);
    expect(container.querySelectorAll('.elp-player-picker-item').length).toBe(3);
  });

  it('点击玩家选中并高亮', () => {
    picker.show(makePlayers(), () => {}, false, null);
    const items = container.querySelectorAll('.elp-player-picker-item');
    items[0].click();
    expect(items[0].classList.contains('selected')).toBe(true);
    expect(picker._selectedId).toBe('p1');
  });

  it('quick 模式下预选当前值', () => {
    picker.show(makePlayers(), () => {}, true, 'p2');
    const items = container.querySelectorAll('.elp-player-picker-item');
    expect(items[1].classList.contains('selected')).toBe(true);
  });

  it('点击确认调用 onSelect 并隐藏', () => {
    const cb = vi.fn();
    picker.show(makePlayers(), cb, false, null);
    container.querySelectorAll('.elp-player-picker-item')[0].click();
    container.querySelector('.elp-player-picker-confirm').click();
    expect(cb).toHaveBeenCalledWith('p1');
    expect(container.querySelector('.elp-player-picker-overlay').classList.contains('hidden')).toBe(true);
  });

  it('死亡玩家显示死亡样式', () => {
    picker.show(makePlayers(), () => {}, false, null);
    const items = container.querySelectorAll('.elp-player-picker-item');
    expect(items[1].classList.contains('is-dead')).toBe(true);
  });

  it('关闭按钮隐藏', () => {
    picker.show(makePlayers(), () => {}, false, null);
    container.querySelector('.elp-player-picker-close').click();
    expect(container.querySelector('.elp-player-picker-overlay').classList.contains('hidden')).toBe(true);
  });

  it('render 方法复用逻辑', () => {
    picker.render(makePlayers(), true, 'p1');
    expect(container.querySelectorAll('.elp-player-picker-item').length).toBe(3);
    expect(container.querySelector('.elp-player-picker-item.selected')).toBeTruthy();
  });
});
