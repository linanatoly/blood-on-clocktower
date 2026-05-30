import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '../core/EventBus.js';
import { ChatManager } from '../ChatManager.js';
import { ChatSubType } from '../event-constants.js';

const mockStore = { current: null };

vi.mock('../dataManager/dataManager.js', () => ({
  DataManager: { getInstance: () => mockStore.current },
}));

let eventBus, cm;

beforeEach(() => {
  eventBus = new EventBus();
  mockStore.current = {
    userId: 'player_1',
    godId: 'god_1',
    chatMsgList: [],
    chatSessionList: [],
    playerList: [
      { playerId: 'player_1', nickName: '我', seatNum: 0, avatarName: '占卜师' },
      { playerId: 'player_2', nickName: '小明', seatNum: 1, avatarName: '士兵' },
    ],
    ws: { readyState: 1, send: vi.fn() },
    sendChatMessage: vi.fn(),
    addChatMsg(msg) { this.chatMsgList.push(msg); },
  };
  cm = new ChatManager(eventBus, mockStore.current);
});

describe('ChatManager', () => {
  describe('receiveMessage()', () => {
    it('私聊消息应更新会话列表', () => {
      const spy = vi.fn();
      eventBus.on('chat:data-update', spy);
      cm.receiveMessage({
        subType: ChatSubType.PRIVATE, senderId: 'player_2', targetId: 'player_1',
        content: '你好', time: '12:00',
      });
      expect(spy).toHaveBeenCalled();
      expect(mockStore.current.chatSessionList.length).toBe(1);
    });

    it('群聊创建通知应创建群会话', () => {
      // 需要至少 2 个"其他人"（排除自己和上帝）
      mockStore.current.playerList.push({ playerId: 'player_3', nickName: '小刚', seatNum: 2, avatarName: '圣女' });
      const spy = vi.fn();
      eventBus.on('chat:data-update', spy);
      cm.receiveMessage({
        subType: ChatSubType.GROUP_SESSION_CREATED,
        senderId: 'god_1', targetIds: ['player_1', 'player_2', 'player_3'],
      });
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('sendMessage()', () => {
    it('私聊发送消息', () => {
      cm.sendMessage('private:player_1:player_2', '你好小明');
      expect(mockStore.current.sendChatMessage).toHaveBeenCalled();
      const callArgs = mockStore.current.sendChatMessage.mock.calls[0];
      expect(callArgs[0]).toBe(ChatSubType.PRIVATE);
    });

    it('空消息不发送', () => {
      cm.sendMessage('private:a:b', '   ');
      expect(mockStore.current.sendChatMessage).not.toHaveBeenCalled();
    });

    it('无效 sessionKey 不发送', () => {
      cm.sendMessage('invalid_key', 'hello');
      expect(mockStore.current.sendChatMessage).not.toHaveBeenCalled();
    });
  });

  describe('getOrCreatePrivateSession()', () => {
    it('创建新的私聊会话', () => {
      const session = cm.getOrCreatePrivateSession(1);
      expect(session).toBeTruthy();
      expect(session.name).toBe('小明');
    });

    it('返回已有的私聊会话', () => {
      const key = 'private:player_1:player_2';
      mockStore.current.chatSessionList = [{ key, name: '小明', unRead: 3, participantIds: ['player_1', 'player_2'] }];
      const session = cm.getOrCreatePrivateSession(1);
      expect(session.unRead).toBe(3);
    });

    it('空座位返回 null', () => {
      expect(cm.getOrCreatePrivateSession(99)).toBeNull();
    });
  });

  describe('getOrCreateGroupSession()', () => {
    it('少于2人时返回 null', () => {
      expect(cm.getOrCreateGroupSession(['player_2'])).toBeNull();
    });
  });

  describe('getSessionMsg()', () => {
    it('获取私聊会话消息', () => {
      mockStore.current.chatMsgList = [
        { senderId: 'player_1', targetId: 'player_2', content: 'hi', time: '12:00', senderName: '我' },
        { senderId: 'player_2', targetId: 'player_1', content: 'hello', time: '12:01', senderName: '小明' },
      ];
      expect(cm.getSessionMsg('private:player_1:player_2').length).toBe(2);
    });

    it('无效 sessionKey 返回空数组', () => {
      expect(cm.getSessionMsg('private:only_one_part')).toEqual([]);
    });
  });

  describe('_formatMsg()', () => {
    it('自己消息 isMe=true', () => {
      const msg = { senderId: 'player_1', content: 'hi', senderName: '我' };
      expect(cm._formatMsg(msg).isMe).toBe(true);
      expect(cm._formatMsg(msg).showName).toBe('我');
    });

    it('上帝消息 isGod=true', () => {
      const msg = { senderId: 'god_1', content: 'test', senderName: '上帝' };
      expect(cm._formatMsg(msg).isGod).toBe(true);
      expect(cm._formatMsg(msg).showName).toBe('上帝');
    });
  });
});
