import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '../core/EventBus.js';
import { PlayerManager } from '../PlayerManager.js';

const mockStore = { current: null };

vi.mock('../dataManager/dataManager.js', () => ({
  DataManager: {
    getInstance: () => mockStore.current,
  },
}));

function makePlayers() {
  return [
    { playerId: 'player_1', nickName: '我', seatNum: 0, avatarName: '占卜师', headImgUrl: 'zhanbu', stateNow: 'alive', ready: true, drunk: false, connectState: 'online' },
    { playerId: 'player_2', nickName: '小明', seatNum: 1, avatarName: '士兵', headImgUrl: 'shibing', stateNow: 'alive', ready: false, drunk: false, connectState: 'online' },
    { playerId: 'player_3', nickName: '小红', seatNum: null, avatarName: null, headImgUrl: null, stateNow: 'alive', ready: false, drunk: false, connectState: 'online' },
  ];
}

beforeEach(() => {
  mockStore.current = {
    userId: 'player_1',
    userType: 'player',
    gameState: 'preparing',
    playerList: makePlayers(),
    localRoleNotes: {},
    dataRefresh() {},
  };
});

describe('PlayerManager', () => {
  describe('getPopupButtonConfig()', () => {
    it('空座位应显示"坐这"按钮', () => {
      const pm = new PlayerManager(new EventBus());
      const cfg = pm.getPopupButtonConfig(2);
      expect(cfg.showSitBtn).toBe(true);
      expect(cfg.nickName).toBe('空座位');
      expect(cfg.showChatBtn).toBe(false);
    });

    it('preparing 阶段自己的座位未准备时显示角色选择按钮', () => {
      mockStore.current.playerList[0].ready = false;
      const pm = new PlayerManager(new EventBus());
      const cfg = pm.getPopupButtonConfig(0);
      expect(cfg.showChooseAvatrBtn).toBe(true);
      expect(cfg.chooseModel).toBe('single');
      expect(cfg.showChatBtn).toBe(false);
    });

    it('preparing 阶段他人的座位可聊天', () => {
      const pm = new PlayerManager(new EventBus());
      const cfg = pm.getPopupButtonConfig(1);
      expect(cfg.showChooseAvatrBtn).toBe(false);
      expect(cfg.showChatBtn).toBe(true);
    });

    it('in_gaming 阶段对他人显示聊天按钮', () => {
      mockStore.current.gameState = 'in_gaming';
      const pm = new PlayerManager(new EventBus());
      const cfg = pm.getPopupButtonConfig(1);
      expect(cfg.showChatBtn).toBe(true);
    });

    it('in_gaming 阶段上帝显示死亡/存活按钮', () => {
      mockStore.current.gameState = 'in_gaming';
      mockStore.current.userType = 'god';
      mockStore.current.userId = 'god_1';
      const pm = new PlayerManager(new EventBus());
      const cfg = pm.getPopupButtonConfig(0);
      expect(cfg.showDeadWithTicketBtn).toBe(true);
      expect(cfg.showAliveBtn).toBe(true);
    });

    it('in_gaming 阶段玩家看其他玩家显示角色标注', () => {
      mockStore.current.gameState = 'in_gaming';
      mockStore.current.userType = 'player';
      const pm = new PlayerManager(new EventBus());
      const cfg = pm.getPopupButtonConfig(1);
      expect(cfg.showChooseAvatrBtn).toBe(true);
    });

    it('preparing 阶段上帝对已入座玩家显示酒鬼按钮', () => {
      mockStore.current.userType = 'god';
      mockStore.current.userId = 'god_1';
      const pm = new PlayerManager(new EventBus());
      const cfg = pm.getPopupButtonConfig(0);
      expect(cfg.showDrunkBtn).toBe(true);
    });

    it('返回正确的 targetPlayerId', () => {
      const pm = new PlayerManager(new EventBus());
      const cfg = pm.getPopupButtonConfig(0);
      expect(cfg.targetPlayerId).toBe('player_1');
    });
  });

  describe('sitPlayer()', () => {
    it('空座位直接坐下', () => {
      const pm = new PlayerManager(new EventBus());
      pm.sitPlayer('player_3', 2);
      const p3 = mockStore.current.playerList.find(p => p.playerId === 'player_3');
      expect(p3.seatNum).toBe(2);
    });

    it('有座玩家换到另一个空座位', () => {
      const pm = new PlayerManager(new EventBus());
      const result = pm.sitPlayer('player_1', 2);
      const p1 = mockStore.current.playerList.find(p => p.playerId === 'player_1');
      expect(p1.seatNum).toBe(2);
      expect(result.seatChange).toBe('normal');
    });

    it('和已有人的座位交换', () => {
      const pm = new PlayerManager(new EventBus());
      const result = pm.sitPlayer('player_3', 1);
      expect(result.seatChange).toBe('withPlayer');
      const p3 = mockStore.current.playerList.find(p => p.playerId === 'player_3');
      expect(p3.seatNum).toBe(1);
    });
  });

  describe('chooseAvatr()', () => {
    it('单选更新玩家角色', () => {
      mockStore.current.playerList[2].seatNum = 2;
      const pm = new PlayerManager(new EventBus());
      const result = pm.chooseAvatr('player_3', [{ imgKey: 'shibing', text: '士兵' }]);
      const p3 = mockStore.current.playerList.find(p => p.playerId === 'player_3');
      expect(p3.headImgUrl).toBe('shibing');
      expect(p3.avatarName).toBe('士兵');
      expect(result.length).toBe(1);
    });
  });

  describe('setLocalRoleNote()', () => {
    it('设置本地角色备注', () => {
      const pm = new PlayerManager(new EventBus());
      const result = pm.setLocalRoleNote('player_2', [{ imgKey: 'jiandie', text: '间谍' }]);
      expect(mockStore.current.localRoleNotes['player_2']).toEqual({
        avatarName: '间谍', headImgUrl: 'jiandie',
      });
      expect(result).toBeTruthy();
    });

    it('多选时不设置', () => {
      const pm = new PlayerManager(new EventBus());
      const result = pm.setLocalRoleNote('player_2', [{ imgKey: 'a', text: 'A' }, { imgKey: 'b', text: 'B' }]);
      expect(result).toBeUndefined();
    });
  });

  describe('providePlayList()', () => {
    it('返回玩家列表和 userId', () => {
      const pm = new PlayerManager(new EventBus());
      const result = pm.providePlayList();
      expect(result.playList).toBe(mockStore.current.playerList);
      expect(result.userID).toBe('player_1');
    });
  });
});
