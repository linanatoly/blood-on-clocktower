import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '../core/EventBus.js';
import { EV } from '../event-constants.js';

const mockStore = { current: null };

vi.mock('../dataManager/dataManager.js', () => ({
  DataManager: { getInstance: () => mockStore.current },
}));

let eventBus;

beforeEach(() => {
  eventBus = new EventBus();
  mockStore.current = {
    userId: 'god_1',
    userType: 'god',
    gameState: 'preparing',
    gamePhase: 'night_1',
    playerList: [
      { playerId: 'p1', nickName: '小明', seatNum: 0, avatarName: '占卜师', stateNow: 'alive' },
      { playerId: 'p2', nickName: '小红', seatNum: 1, avatarName: '士兵', stateNow: 'alive' },
    ],
    eventLogs: [],
    spyActive: false,
    localRoleNotes: {},
    sendEventRecord: vi.fn(),
    sendEventDelete: vi.fn(),
  };
});

async function createELM() {
  const { EventLogManager } = await import('../EventLogManager.js');
  return new EventLogManager(eventBus);
}

describe('EventLogManager', () => {
  describe('构造与初始化', () => {
    it('从 data.eventLogs 初始化', async () => {
      mockStore.current.eventLogs = [{ id: 'e1', phase: 'night_1', type: 'custom', description: 'test' }];
      const mgr = await createELM();
      expect(mgr.events.length).toBeGreaterThanOrEqual(1);
    });

    it('currentViewPhase 默认为 data.gamePhase', async () => {
      const mgr = await createELM();
      expect(mgr.currentViewPhase).toBe('night_1');
    });
  });

  describe('自动记录事件', () => {
    it('玩家状态变更自动记录死亡', async () => {
      const mgr = await createELM();
      const before = mgr.events.length;
      eventBus.emit(EV.PLAYER_STATUS_CHANGE, { targetPlayerId: 'p1', newState: 'dead_with_ticket' });
      expect(mgr.events.length).toBe(before + 1);
      expect(mgr.events.some(e => e.type === 'death')).toBe(true);
    });

    it('复活事件 type 为 alive', async () => {
      const mgr = await createELM();
      eventBus.emit(EV.PLAYER_STATUS_CHANGE, { targetPlayerId: 'p1', newState: 'alive' });
      const evt = mgr.events.find(e => e.type === 'alive');
      expect(evt).toBeTruthy();
    });

    it('阶段切换自动记录', async () => {
      const mgr = await createELM();
      eventBus.emit(EV.GAME_PHASE_CHANGED, 'day_2');
      expect(mgr.events.some(e => e.type === 'phase_change')).toBe(true);
    });

    it('游戏结束自动记录', async () => {
      mockStore.current.gameState = 'in_gaming';
      const mgr = await createELM();
      mgr._lastGameState = 'in_gaming';
      eventBus.emit(EV.CHANGE_STATE, 'ended');
      expect(mgr.events.some(e => e.type === 'game_end')).toBe(true);
    });
  });

  describe('CRUD 操作', () => {
    it('recordQuickEvent 创建快捷事件', async () => {
      const mgr = await createELM();
      const desc = mgr.recordQuickEvent('death', ['p1'], undefined, undefined);
      expect(desc).toContain('死亡');
      expect(mockStore.current.sendEventRecord).toHaveBeenCalled();
    });

    it('deleteEvent 删除事件', async () => {
      const mgr = await createELM();
      mgr.events = [{ id: 'to_delete', phase: 'night_1', type: 'custom' }];
      mgr.deleteEvent('to_delete');
      expect(mgr.events.length).toBe(0);
      expect(mockStore.current.sendEventDelete).toHaveBeenCalledWith('to_delete');
    });

    it('getEventsByPhase 按阶段筛选', async () => {
      const mgr = await createELM();
      mgr.events = [
        { id: 'e1', phase: 'night_1', type: 'custom' },
        { id: 'e2', phase: 'day_2', type: 'custom' },
      ];
      expect(mgr.getEventsByPhase('night_1').length).toBe(1);
    });

    it('getEventById 查找事件', async () => {
      const mgr = await createELM();
      mgr.events = [{ id: 'find_me', phase: 'night_1', type: 'custom' }];
      expect(mgr.getEventById('find_me')).toBeTruthy();
      expect(mgr.getEventById('nope')).toBeUndefined();
    });
  });

  describe('getPlayerDisplayList()', () => {
    it('上帝模式显示所有角色名', async () => {
      const mgr = await createELM();
      const list = mgr.getPlayerDisplayList();
      expect(list.length).toBeGreaterThanOrEqual(2);
      expect(list[0].roleName).toBe('占卜师');
    });

    it('非上帝模式隐藏他人角色', async () => {
      mockStore.current.userType = 'player';
      mockStore.current.userId = 'p1';
      const mgr = await createELM();
      const list = mgr.getPlayerDisplayList();
      const other = list.find(p => p.playerId === 'p2');
      expect(other.roleName).toBe('???');
    });
  });

  describe('navigatePhase()', () => {
    it('next 前进到下一阶段', async () => {
      const mgr = await createELM();
      mgr.currentViewPhase = 'night_1';
      mgr.navigatePhase('next');
      expect(mgr.currentViewPhase).toBe('day_2');
    });

    it('边界不溢出', async () => {
      const mgr = await createELM();
      mgr.currentViewPhase = 'night_1';
      mgr.navigatePhase('prev');
      expect(mgr.currentViewPhase).toBe('night_1');
    });
  });

  describe('destroy', () => {
    it('destroy 取消所有事件绑定', async () => {
      const mgr = await createELM();
      mgr.destroy();
      expect(() => eventBus.emit(EV.CHANGE_STATE, 'ended')).not.toThrow();
    });
  });
});
