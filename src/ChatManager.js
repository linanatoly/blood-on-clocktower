import { ServerMsgType, ChatSubType } from './event-constants.js';
import { EV } from './event-constants.js';


export class ChatManager {
    constructor(eventBus, data) {
        this.eventBus = eventBus;
        this.data = data;
    }

    // ========== 统一处理：收到新消息 ==========

    syncFromServer(messages) {
        // 保存空会话 key（无消息的会话服务端无记录但前端已创建）
        const emptySessions = this.data.chatSessionList
            .filter(s => !messages.some(m => this._getMsgSessionKey(m) === s.key))
            .map(s => ({ ...s, unRead: 0 }));

        this.data.chatSessionList = [];
        for (const msg of messages) {
            this._updateSessionList(msg);
        }

        // 恢复空会话
        for (const es of emptySessions) {
            if (!this.data.chatSessionList.find(s => s.key === es.key)) {
                this.data.chatSessionList.push(es);
            }
        }

        // 同步完成后重置所有未读计数（历史消息不应计为未读）
        for (const session of this.data.chatSessionList) {
            session.unRead = 0;
        }

        this.eventBus.emit(EV.CHAT_DATA_UPDATE);
    }

    receiveMessage(msg) {
        // 服务端通知：创建群聊会话
        if (msg.subType === ChatSubType.GROUP_SESSION_CREATED) {
            if (msg.senderId === this.data.userId) return;  // 不处理自己的通知
            const otherIds = (msg.targetIds || []).filter(
                id => id !== this.data.userId && id !== this.data.godId
            );
            if (otherIds.length >= 1) {
                this.getOrCreateGroupSession(otherIds);
                this.eventBus.emit(EV.CHAT_DATA_UPDATE);
            }
            return;
        }

        // 如果是自己发送的消息，替换临时消息
        if (msg.senderId === this.data.userId && this._pendingMessages) {
            const chatMsgList = this.data.chatMsgList;
            for (let i = chatMsgList.length - 1; i >= 0; i--) {
                const tempMsg = chatMsgList[i];
                if (tempMsg._tempId && tempMsg.content.endsWith('（发送中）')) {
                    // 替换临时消息为服务器回传的消息
                    chatMsgList[i] = { ...msg };
                    // 删除临时消息记录
                    delete this._pendingMessages[tempMsg._tempId];
                    break;
                }
            }
        }
        
        this._updateSessionList(msg);
        this.eventBus.emit(EV.CHAT_DATA_UPDATE);
    }


  // ========== 统一发送消息 ==========
    sendMessage(sessionKey, content) {
        console.log('sendMessage 收到的 sessionKey:', sessionKey);
        if (!content.trim() || !sessionKey) return;
        
        const myInfo = this.data.playerList.find(p => p.playerId === this.data.userId);
        const msg = {
            content: content.trim(),
            time: new Date().toLocaleTimeString(),
            senderId: this.data.userId,
            senderName: myInfo?.nickName || '我',
            type: ServerMsgType.CHAT
        };

        // 然后调用 dataManager.sendChatMessage 发送
        let subType;
        if (sessionKey.startsWith('private:')) subType = ChatSubType.PRIVATE;
        else if (sessionKey.startsWith('group_')) subType = ChatSubType.GOD_GROUP;
        else return;

        const payload = {
            subType: subType,
            senderId: this.data.userId,
            senderName: myInfo?.nickName || '我',
            content: content,
            time: new Date().toLocaleTimeString()
        };
        if (subType === ChatSubType.PRIVATE) {
            const parts = sessionKey.slice(8).split(':');
            payload.targetId = parts[0] === this.data.userId ? parts[1] : parts[0];
        } else if (subType === ChatSubType.GOD_GROUP) {
            const session = this.data.chatSessionList.find(s => s.key === sessionKey);
            if (session && session.participantIds) {
                // 排除上帝ID，保证所有客户端的会话key一致性
                payload.targetIds = session.participantIds.filter(id => id !== this.data.godId);
            }
        }

        // 乐观更新：立即添加到本地消息列表（显示"发送中"）
        const tempMsg = {
            ...payload,
            content: content + '（发送中）',
            _tempId: Date.now() + Math.random().toString(36).slice(2, 11)
        };
        this.data.addChatMsg(tempMsg);

        // 保存临时消息信息，用于后续替换
        if (!this._pendingMessages) this._pendingMessages = {};
        this._pendingMessages[tempMsg._tempId] = {
            sessionKey: sessionKey,
            payload: payload
        };

        this.data.sendChatMessage(subType, payload);
    }

    // ========== 会话管理 ==========
    _updateSessionList(msg) {
        console.log('_updateSessionList 处理消息:', msg);
        
        let sessionKey, sessionName, sortedIds;
        const myId = this.data.userId;

        // 根据消息内容判断类型
        if (msg.targetIds && msg.targetIds.length > 0) {
            // 群聊：排除上帝ID以保证会话key一致性
            const participantIds = [...msg.targetIds].filter(id => id !== this.data.godId);
            if (!participantIds.includes(msg.senderId) && msg.senderId !== this.data.godId) {
                participantIds.push(msg.senderId);
            }
            sortedIds = participantIds.sort();
            sessionKey = `group_${sortedIds.join('_')}`;

            const playerNames = sortedIds.map(id => {
                if (id === this.data.godId) return '上帝';
                const player = this.data.playerList.find(p => p.playerId === id);
                return player?.nickName || '玩家';
            });
            sessionName = playerNames.join(', ');
            console.log('识别为群聊:', sessionKey);
        }
        else if (msg.targetId) {
            sortedIds = [String(msg.senderId), String(msg.targetId)].sort();
            sessionKey = `private:${sortedIds[0]}:${sortedIds[1]}`;
            const targetPlayer = this.data.playerList.find(p => p.playerId === msg.targetId);
            sessionName = msg.senderId === myId ? (targetPlayer?.nickName || '玩家') : msg.senderName;
        }
        else {
            console.warn('无法识别消息类型:', msg);
            return;
        }

        // 查找或创建会话
        let session = this.data.chatSessionList.find(s => s.key === sessionKey);
        if (!session) {
            console.log('创建新会话:', sessionKey);
            session = {
                key: sessionKey,
                name: sessionName,
                lastMsg: '',
                lastTime: '',
                unRead: 0,
                participantIds: [...sortedIds]
            };
            this.data.chatSessionList.push(session);
        } else {
            console.log('更新已有会话:', sessionKey);
        }

        // 更新会话的最后消息
        session.lastMsg = msg.content;
        session.lastTime = msg.time;
        if (msg.senderId !== myId) {
            session.unRead += 1;
            console.log('未读消息+1，当前未读:', session.unRead);
        }

        // 排序
        this.data.chatSessionList.sort((a, b) => b.lastTime.localeCompare(a.lastTime));
        
        console.log('会话更新完成:', session);
    }

    // 根据消息获取会话 key（纯函数，无副作用）
    _getMsgSessionKey(msg) {
        if (msg.targetIds && msg.targetIds.length > 0) {
            const participantIds = [...msg.targetIds].filter(id => id !== this.data.godId);
            if (!participantIds.includes(msg.senderId) && msg.senderId !== this.data.godId) {
                participantIds.push(msg.senderId);
            }
            return `group_${participantIds.sort().join('_')}`;
        }
        if (msg.targetId) {
            const ids = [String(msg.senderId), String(msg.targetId)].sort();
            return `private:${ids[0]}:${ids[1]}`;
        }
        return null;
    }

    // 辅助方法：获取会话成员
    _getChatMembers(msg) {
        const myId = this.data.userId;
        if (msg.type === ServerMsgType.GOD_TO_ONE) {
            return [myId, this.data.godId];
        } else if (msg.type === ServerMsgType.GOD_GROUP) {
            const members = [...msg.targetIds];
            if (!members.includes(msg.senderId)) members.push(msg.senderId);
            return members;
        } else if (msg.type === ServerMsgType.PLAYER_PRIVATE) {
            return [msg.senderId, msg.targetId];
        }
        return [];
    }

    // ========== 获取会话消息 ==========
    getSessionMsg(sessionKey) {
        console.log('getSessionMsg 查询会话:', sessionKey);
        const myId = this.data.userId;
        const list = this.data.chatMsgList;
        
        let filtered = [];

        if (sessionKey.startsWith('private:')) {
            const parts = sessionKey.slice(8).split(':');
            if (parts.length !== 2) {
                console.error('会话 key 无效:', sessionKey);
                return [];
            }
            const sessionIds = [parts[0], parts[1]].sort();
            filtered = this.data.chatMsgList.filter(m => {
                if (!m.targetId) return false;
                const msgIds = [String(m.senderId), String(m.targetId)].sort();
                return msgIds[0] === sessionIds[0] && msgIds[1] === sessionIds[1];
            });
        }
        else if (sessionKey.startsWith('group_')) {
            const session = this.data.chatSessionList.find(s => s.key === sessionKey);
            if (session && session.participantIds) {
                const pids = session.participantIds;
                filtered = list.filter(m => {
                    return m.content && m.targetIds && m.targetIds.length === pids.length &&
                        m.targetIds.every(id => pids.includes(id));
                });
            }
        }
        
        console.log(`找到 ${filtered.length} 条消息`);
        return filtered.map(m => this._formatMsg(m));
    }

    _formatMsg(msg) {
        return {
        isMe: msg.senderId === this.data.userId,
        isGod: msg.senderId === this.data.godId,
        showName: msg.senderId === this.data.godId ? '上帝' :
                    (msg.senderId === this.data.userId ? '我' : msg.senderName),
        content: msg.content
        };
    }
    // 获取或创建私聊会话（根据对方玩家ID）
    getOrCreatePrivateSession(seatNum) {
        const myId = this.data.userId;

        // 上帝座位：直接通过 godId 查找
        let targetId;
        if (seatNum === 'god') {
          targetId = this.data.godId;
          if (!targetId || targetId === myId) return null;
        } else {
          const seated = this.data.playerList.find(item => item.seatNum === seatNum);
          if (!seated || !myId || seated.playerId === myId) return null;
          targetId = seated.playerId;
        }
        
        // 确保 ID 作为字符串排序
        const ids = [String(myId), String(targetId)].sort();
        const sessionKey = `private:${ids[0]}:${ids[1]}`;
        
        console.log('生成 sessionKey:', { myId, targetId, ids, sessionKey });
        
        // 查找是否已存在
        let session = this.data.chatSessionList.find(s => s.key === sessionKey);
        if (session) {
            console.log('找到已有会话:', session);
            return session;
        }
        
        // 获取对方信息
        const targetPlayer = this.data.playerList.find(p => p.playerId === targetId);
        const targetName = targetPlayer?.nickName || '玩家';
        
        // 创建新会话
        session = {
            key: sessionKey,
            name: targetName,
            lastMsg: '',
            lastTime: '',
            unRead: 0,
            participantIds: [String(myId), String(targetId)]
        };
        this.data.chatSessionList.push(session);

        console.log('创建新会话:', session);
        return session;
    }

    // 上帝发起群聊：根据选中的玩家 ID 列表创建/获取群会话
    getOrCreateGroupSession(playerIds) {
        const myId = this.data.userId;
        if (!myId || !playerIds || playerIds.length < 2) return null;

        // 排除上帝ID以保证所有客户端的会话key一致
        const allIds = [...playerIds, myId].filter(id => id !== this.data.godId).sort();
        if (allIds.length < 2) return null;
        const sessionKey = `group_${allIds.join('_')}`;

        let session = this.data.chatSessionList.find(s => s.key === sessionKey);
        if (session) return session;

        const names = allIds.map(id => {
            const p = this.data.playerList.find(pl => pl.playerId === id);
            return p?.nickName || '玩家';
        });

        session = {
            key: sessionKey,
            name: names.join(', '),
            lastMsg: '',
            lastTime: '',
            unRead: 0,
            participantIds: [...allIds]
        };
        this.data.chatSessionList.push(session);

        // 通知服务端向所有参与者广播会话创建
        if (this.data.ws && this.data.ws.readyState === WebSocket.OPEN) {
            const notifyMsg = {
                type: 'chat',
                subType: ChatSubType.GROUP_SESSION_CREATED,
                senderId: this.data.userId,
                targetIds: [...allIds]
            };
            this.data.ws.send(JSON.stringify(notifyMsg));
        }

        return session;
    }
}