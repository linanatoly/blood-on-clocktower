import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '../../core/EventBus.js';
import { GameTable } from '../GameTable.js';
import { EV } from '../../event-constants.js';

const mockData = {
  userId: 'player_1',
  userType: 'player',
  gameState: 'preparing',
  spyActive: false,
  spyData: null,
  localRoleNotes: {},
};

vi.mock('../../dataManager/dataManager.js', () => ({
  DataManager: { getInstance: () => mockData },
}));

function createContainer(w = 750, h = 1334) {
  const div = document.createElement('div');
  Object.defineProperty(div, 'clientWidth', { value: w, writable: true, configurable: true });
  Object.defineProperty(div, 'clientHeight', { value: h, writable: true, configurable: true });
  document.body.appendChild(div);
  return div;
}

describe('GameTable', () => {
  describe('_calcLayout', () => {
    it('偶数玩家布局正确', () => {
      const eb = new EventBus();
      const container = createContainer();
      const gt = new GameTable(eb, container);
      const layout = gt._calcLayout(750, 1334, 6);
      expect(layout.leftCount).toBe(3);
      expect(layout.rightCount).toBe(3);
      expect(layout.arcCount).toBe(0);
      expect(layout.avatarD).toBeGreaterThan(0);
    });

    it('奇数玩家生成弧形布局', () => {
      const eb = new EventBus();
      const container = createContainer();
      const gt = new GameTable(eb, container);
      const layout = gt._calcLayout(750, 1334, 7);
      expect(layout.arcParams).toBeTruthy();
    });

    it('单列时 colGap 为 0', () => {
      const eb = new EventBus();
      const container = createContainer();
      const gt = new GameTable(eb, container);
      const layout = gt._calcLayout(750, 1334, 2);
      expect(layout.colGap).toBe(0);
    });
  });

  describe('_clamp', () => {
    it('数值钳制', () => {
      const eb = new EventBus();
      const gt = new GameTable(eb, createContainer());
      expect(gt._clamp(5, 1, 10)).toBe(5);
      expect(gt._clamp(0, 1, 10)).toBe(1);
      expect(gt._clamp(15, 1, 10)).toBe(10);
    });
  });

  describe('createSeats', () => {
    it('创建指定数量的座位', () => {
      const eb = new EventBus();
      const container = createContainer();
      const gt = new GameTable(eb, container);
      gt.createSeats(5);
      expect(gt._seats.length).toBe(5);
    });

    it('座位点击发送 SEAT_CLICK_WITH_ID', () => {
      const eb = new EventBus();
      const spy = vi.fn();
      eb.on(EV.SEAT_CLICK_WITH_ID, spy);
      const gt2 = new GameTable(eb, createContainer());
      gt2.createSeats(3);
      gt2._seats[0].card.click();
      expect(spy).toHaveBeenCalledWith(0);
    });

    it('createSeats 重置状态', () => {
      const eb = new EventBus();
      const gt = new GameTable(eb, createContainer());
      gt._gameStarted = true;
      gt._seats = [{ card: document.createElement('div') }];
      gt.createSeats(3);
      expect(gt._gameStarted).toBe(false);
      expect(gt._seats.length).toBe(3);
    });
  });

  describe('refresh', () => {
    it('刷新座位上的玩家信息', () => {
      const eb = new EventBus();
      const container = createContainer();
      const gt = new GameTable(eb, container);
      gt.createSeats(3);

      // 用 god 身份确保可以看到角色名
      mockData.userType = 'god';
      gt.refresh([
        { playerId: 'p1', seatNum: 0, nickName: '小明', avatarName: '占卜师', headImgUrl: 'zhanbu', stateNow: 'alive', ready: false, drunk: false, connectState: 'online' },
      ]);
      expect(gt._seats[0].playerName.textContent).toBe('小明');
      expect(gt._seats[0].roleName.textContent).toBe('占卜师');
    });

    it('死亡玩家显示死亡覆盖图', () => {
      const eb = new EventBus();
      const container = createContainer();
      const gt = new GameTable(eb, container);
      gt.createSeats(2);

      gt.refresh([
        { playerId: 'p1', seatNum: 0, nickName: '小明', avatarName: '占卜师', headImgUrl: 'zhanbu', stateNow: 'dead_with_ticket', ready: false, drunk: false, connectState: 'online' },
      ]);
      expect(gt._seats[0].deadOverlay.classList.contains('hidden')).toBe(false);
    });

    it('hideAllReadyBadges / resetReadyBadges', () => {
      const eb = new EventBus();
      const container = createContainer();
      const gt = new GameTable(eb, container);
      gt.createSeats(2);
      gt.refresh([
        { playerId: 'p1', seatNum: 0, nickName: 'p1', avatarName: 'a', stateNow: 'alive', ready: true, drunk: false, connectState: 'online' },
      ]);
      gt.hideAllReadyBadges();
      expect(gt._seats[0].readyBadge.classList.contains('hidden')).toBe(true);
      expect(gt._gameStarted).toBe(true);

      gt.resetReadyBadges();
      expect(gt._gameStarted).toBe(false);
    });
  });
});
