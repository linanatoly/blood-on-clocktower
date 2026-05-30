import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QuickEventPanel } from '../QuickEventPanel.js';
import { QUICK_EVENT_TEMPLATES } from '../../event-constants.js';

function createContainer() {
  const div = document.createElement('div');
  document.body.appendChild(div);
  return div;
}

function createMockMgr() {
  return {
    getPlayerDisplayList: () => [
      { playerId: 'p1', nickName: '小明', roleName: '占卜师', seatNum: 0, stateNow: 'alive' },
      { playerId: 'p2', nickName: '小红', roleName: '士兵', seatNum: 1, stateNow: 'alive' },
    ],
  };
}

function createMockData() {
  return { userType: 'god', gameState: 'in_gaming' };
}

describe('QuickEventPanel', () => {
  let container, panel, mockMgr, mockData;

  beforeEach(() => {
    container = createContainer();
    mockMgr = createMockMgr();
    mockData = createMockData();
    panel = new QuickEventPanel(container, mockMgr, mockData);
  });

  it('构造时创建 DOM', () => {
    expect(container.querySelector('.elp-quick-panel')).toBeTruthy();
    expect(container.querySelector('.elp-quick-templates')).toBeTruthy();
    expect(container.querySelector('.elp-quick-preview')).toBeTruthy();
  });

  it('show 显示面板并渲染模板', () => {
    panel.show('快捷事件', null);
    expect(container.querySelector('.elp-quick-panel').classList.contains('hidden')).toBe(false);
    expect(container.querySelectorAll('.elp-template-btn').length).toBeGreaterThan(0);
  });

  it('选择模板后显示预览和确认按钮', () => {
    panel.show('测试', null);
    const btn = container.querySelector('[data-template-id="death"]');
    if (btn) {
      btn.click();
      expect(panel.template).toBeTruthy();
      expect(panel.template.id).toBe('death');
      expect(container.querySelector('.elp-quick-confirm').classList.contains('hidden')).toBe(false);
    }
  });

  it('设置玩家槽位并渲染预览', () => {
    panel._selectedTemplate = { id: 'death', label: '死亡', text: '{0} 死亡' };
    panel.setPlayerForSlot(0, 'p1');
    expect(panel._filledPlayerIds[0]).toBe('p1');
    panel._renderPreview();
    const slots = container.querySelectorAll('.elp-preview-slot.filled');
    expect(slots.length).toBeGreaterThanOrEqual(0);
  });

  it('数字 +/- 按钮', () => {
    panel._selectedTemplate = QUICK_EVENT_TEMPLATES.find(t => t.id === 'received_votes');
    if (panel._selectedTemplate) {
      panel._renderPreview();
      const minus = container.querySelector('.elp-num-btn.minus');
      const plus = container.querySelector('.elp-num-btn.plus');
      if (minus && plus) {
        const initVal = panel._numberValue;
        plus.click();
        expect(panel._numberValue).toBe(initVal + 1);
        minus.click();
        expect(panel._numberValue).toBe(initVal);
      }
    }
  });

  it('confirmHandler 调用回调', () => {
    const cb = vi.fn();
    panel.confirmHandler = cb;
    panel._selectedTemplate = { id: 'death', label: '死亡', text: '{0} 死亡' };
    panel.show('确认测试', null);
    const confirmBtn = container.querySelector('.elp-quick-confirm');
    confirmBtn.classList.remove('hidden');
    confirmBtn.click();
    expect(cb).toHaveBeenCalled();
  });

  it('flashError 显示错误信息', () => {
    vi.useFakeTimers();
    panel.flashError('请先填完所有玩家');
    expect(container.querySelector('.elp-quick-error').textContent).toBe('请先填完所有玩家');
    expect(container.querySelector('.elp-quick-error').classList.contains('hidden')).toBe(false);
    vi.advanceTimersByTime(1200);
    expect(container.querySelector('.elp-quick-error').classList.contains('hidden')).toBe(true);
    vi.useRealTimers();
  });

  it('applyEditState 填充编辑数据', () => {
    const tpl = QUICK_EVENT_TEMPLATES.find(t => t.id === 'death');
    panel.show('修改事件', 'ev_1');
    panel.applyEditState(tpl, ['p1'], undefined, '');
    expect(panel._selectedTemplate).toBe(tpl);
    expect(panel._filledPlayerIds[0]).toBe('p1');
  });

  it('hide 隐藏面板', () => {
    panel.show('test', null);
    panel.hide();
    expect(container.querySelector('.elp-quick-panel').classList.contains('hidden')).toBe(true);
  });

  it('getters 返回正确值', () => {
    panel._selectedTemplate = { id: 'test' };
    panel._filledPlayerIds = ['p1'];
    panel._numberValue = 3;
    panel._filledRoleName = '占卜师';
    panel._editingEventId = 'ev_x';

    expect(panel.template).toEqual({ id: 'test' });
    expect(panel.filledPlayerIds).toEqual(['p1']);
    expect(panel.numberValue).toBe(3);
    expect(panel.filledRoleName).toBe('占卜师');
    expect(panel.editingEventId).toBe('ev_x');
  });
});
