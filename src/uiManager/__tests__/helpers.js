import { EventBus } from '../../core/EventBus.js';

const WebSocketMock = class {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  constructor(url) {
    this.url = url;
    this.readyState = WebSocketMock.CONNECTING;
    this.onopen = null;
    this.onmessage = null;
    this.onclose = null;
    this.onerror = null;
    this._sentMessages = [];
  }

  send(data) {
    this._sentMessages.push(data);
  }

  _open() {
    this.readyState = WebSocketMock.OPEN;
    if (this.onopen) this.onopen();
  }

  _receive(data) {
    if (this.onmessage) this.onmessage({ data: JSON.stringify(data) });
  }

  _close() {
    this.readyState = WebSocketMock.CLOSED;
    if (this.onclose) this.onclose();
  }

  _error() {
    if (this.onerror) this.onerror(new Error('mock error'));
    this._close();
  }
};

let _wsMock = null;

export function installWebSocketMock() {
  _wsMock = null;
  globalThis.WebSocket = class extends WebSocketMock {
    constructor(url) {
      super(url);
      _wsMock = this;
      return this;
    }
  };
  globalThis.WebSocket.CONNECTING = WebSocketMock.CONNECTING;
  globalThis.WebSocket.OPEN = WebSocketMock.OPEN;
  globalThis.WebSocket.CLOSING = WebSocketMock.CLOSING;
  globalThis.WebSocket.CLOSED = WebSocketMock.CLOSED;
  return { getWsMock: () => _wsMock };
}

export function createTestContainer() {
  const div = document.createElement('div');
  div.id = 'test-container';
  document.body.appendChild(div);
  return div;
}

export function createMockEventBus() {
  return new EventBus();
}

export function createMockDataManager(overrides = {}) {
  return {
    userId: 'p1',
    userType: 'player',
    gameState: 'preparing',
    gamePhase: 'night_1',
    godId: 'god_1',
    roomCode: '1234',
    totalPlayers: 7,
    campNumbers: [3, 0, 1, 1],
    playerList: [],
    chatSessionList: [],
    chatMsgList: [],
    eventLogs: [],
    localRoleNotes: {},
    spyActive: false,
    spyData: null,
    ws: { readyState: 1, send: () => {} },
    sendChatMessage: () => {},
    sendEventRecord: () => {},
    sendEventDelete: () => {},
    clearSessionUnRead: () => {},
    addChatMsg(msg) { this.chatMsgList.push(msg); },
    ...overrides,
  };
}

export function cleanupComponent(container) {
  if (container && container.parentNode) {
    container.parentNode.removeChild(container);
  }
  document.body.innerHTML = '';
}

export function setupFakeTimers() {
  return vi.useFakeTimers();
}

import { vi } from 'vitest';
