import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '../../core/EventBus.js';
import { FunctionPanel } from '../FunctionPanel.js';
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

function setupTestDom() {
  // #game-top-bar 由 FunctionPanel._buildDom 写入阶段和房间号
  if (!document.getElementById('game-top-bar')) {
    const topBar = document.createElement('div');
    topBar.id = 'game-top-bar';
    document.body.appendChild(topBar);
  }
  // #app 用于解散弹窗挂载
  if (!document.getElementById('app')) {
    const app = document.createElement('div');
    app.id = 'app';
    document.body.appendChild(app);
  }
}

let eb, container, panel;

beforeEach(() => {
  setupTestDom();
  eb = new EventBus();
  container = createContainer();
  mockStore.current = {
    userId: 'god_1',
    userType: 'god',
    gameState: 'preparing',
    gamePhase: null,
    roomCode: '1234',
    playerList: [
      { playerId: 'god_1', nickName: '上帝', seatNum: null },
      { playerId: 'player_1', nickName: '小明', seatNum: 0, ready: true, avatarName: '占卜师', headImgUrl: 'zhanbu' },
    ],
    spyActive: false,
    sendPhaseChange: vi.fn(),
    sendBackToPreparing: vi.fn(),
    sendDismissRoom: vi.fn(),
    sendSpyRequest: vi.fn(),
  };
  panel = new FunctionPanel(eb, container);
});

describe('FunctionPanel', () => {
  it('构造时创建完整 DOM', () => {
    expect(container.querySelector('.fn-toolbar')).toBeTruthy();
    expect(document.getElementById('game-top-bar').querySelector('.fn-phase-text')).toBeTruthy();
  });

  it('上帝显示上帝工具栏', () => {
    const godEl = panel.el.querySelector('.fn-toolbar-god');
    const playerEl = panel.el.querySelector('.fn-toolbar-player');
    expect(godEl.classList.contains('hidden')).toBe(false);
    expect(playerEl.classList.contains('hidden')).toBe(true);
  });

  it('玩家显示玩家工具栏', () => {
    mockStore.current.userType = 'player';
    mockStore.current.userId = 'player_1';
    const fp = new FunctionPanel(new EventBus(), createContainer());
    const godEl = fp.el.querySelector('.fn-toolbar-god');
    const playerEl = fp.el.querySelector('.fn-toolbar-player');
    expect(godEl.classList.contains('hidden')).toBe(true);
    expect(playerEl.classList.contains('hidden')).toBe(false);
  });

  it('点击聊天按钮发送 OPEN_CHAT', () => {
    const spy = vi.fn();
    eb.on(EV.OPEN_CHAT, spy);
    panel.el.querySelectorAll('.fn-btn-chat')[0]?.click();
    expect(spy).toHaveBeenCalled();
  });

  it('in_gaming 状态显示游戏阶段按钮', () => {
    mockStore.current.gameState = 'in_gaming';
    mockStore.current.gamePhase = 'night_1';
    const fp = new FunctionPanel(new EventBus(), createContainer());
    expect(fp.el.querySelector('.fn-btn-next').classList.contains('hidden')).toBe(false);
    expect(fp.el.querySelector('.fn-btn-prev').classList.contains('hidden')).toBe(false);
  });

  it('显示房间号', () => {
    mockStore.current.roomCode = 'ABCD';
    const fp = new FunctionPanel(new EventBus(), createContainer());
    expect(document.getElementById('game-top-bar').querySelector('.fn-room-code').textContent).toContain('ABCD');
  });

  it('响应 GAME_PHASE_CHANGED 更新阶段显示', () => {
    mockStore.current.gameState = 'in_gaming';
    const fp = new FunctionPanel(new EventBus(), createContainer());
    fp.eventBus.emit(EV.GAME_PHASE_CHANGED, 'day_2');
    expect(document.getElementById('game-top-bar').querySelector('.fn-phase-text').textContent).toContain('日');
  });

  it('destroy 设置 _alive=false', () => {
    panel.destroy();
    expect(panel._alive).toBe(false);
  });
});
