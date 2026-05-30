// 服务器沟通数据类型枚举（全项目统一）
export const ServerMsgType = {
  CHAT:'chat',
  GAME_DATA:'game_data',
};

// 聊天消息的子类型
export const ChatSubType = {
    PRIVATE: 'private',     // 玩家私聊（含上帝）
    GOD_GROUP: 'god_group',  // 上帝群聊
    GROUP_SESSION_CREATED: 'group_session_created'  // 群聊会话创建通知
};

// 游戏数据消息的子类型
export const GameDataSubType = {
    REGISTER: 'register',           // 玩家注册
    SIT_DOWN: 'sit_down',           // 坐下
    PLAYER_LIST_UPDATE: 'player_list_update', // 广播玩家列表
    GAME_STATE_UPDATE: 'game_state_update',   // 游戏状态更新
    AVATAR_SELECT: 'avatar_select',           // 角色选择
    CREATE_ROOM: 'create_room',               // 上帝创建房间
    JOIN_ROOM: 'join_room',                   // 玩家加入房间
    ROOM_STATE: 'room_state',                 // 服务端下发完整房间状态
    PLAYER_READY: 'player_ready',             // 玩家准备/取消准备
    START_GAME: 'start_game',                // 上帝开始游戏
    SET_PLAYER_STATE: 'set_player_state',    // 上帝设置玩家状态
    CHANGE_PHASE: 'change_phase',           // 上帝切换游戏阶段
    EVENT_RECORD: 'event_record',           // 事件记录（创建/修改）
    EVENT_DELETE: 'event_delete',           // 事件删除
    EVENT_SYNC: 'event_sync',              // 服务端下发完整事件列表
    END_GAME: 'end_game',                // 上帝结束游戏
    SPY_REQUEST: 'spy_request',          // 间谍请求上帝数据
    SET_DRUNK: 'set_drunk',              // 上帝设置酒鬼
    BACK_TO_PREPARING: 'back_to_preparing',  // 上帝从复盘返回准备阶段
    DISMISS_ROOM: 'dismiss_room',          // 上帝解散房间
    ROOM_DISMISSED: 'room_dismissed',      // 服务端广播房间已解散
    LEAVE_ROOM: 'leave_room',             // 玩家退出房间
    ROOM_LEFT: 'room_left',              // 服务端通知玩家已退出房间
    CHAT_SYNC: 'chat_sync',             // 服务端下发聊天记录同步
    SET_ROLE_MODE: 'set_role_mode',          // 上帝设置角色选择模式
    ROLE_MODE_CHANGED: 'role_mode_changed',  // 服务端下发模式变更通知
};

/**
 * 全项目事件统一管理中心
 * 规则：
 * 1. 按模块分组
 * 2. 不手写字符串，全部用常量
 * 3. 无循环依赖、无全局挂载、纯字典文件
 */
export const EV = {

  // ==========================================
  // 房间 / 开局相关
  // ==========================================
  ROOM_CREATE: 'room:create',             // 创建房间
  ROOM_JOIN: 'room:join',                 // 加入房间
  ROOM_READY: 'room:ready',               // 房间准备
  ROOM_START_GAME: 'room:start-game',     // 开始游戏
  ROOM_END_GAME: 'room:end-game',         // 结束游戏
  ROOM_CLOSE: 'room:close',               // 关闭房间
  ROOM_DISMISSED: 'room:dismissed',         // 房间已解散（返回大厅）
  ROOM_LEFT: 'room:left',                 // 玩家已退出房间（返回大厅）
  ROOM_STATE_RECEIVED: 'room:state-received', // 收到完整房间状态

  // ==========================================
  // 座位相关(SeatManager)
  // ==========================================
  SEAT_CLICK: 'seat:click',               // 点击座位
  SEAT_UPDATE: 'seat:update',             // 更新座位状态
  SEAT_EMPTY: 'seat:empty',               // 清空座位
  SEAT_SITDOWN: 'seat:sitdown',                 // 锁定座位
  SEAT_UNLOCK: 'seat:unlock',             // 解锁座位
  SEAT_CLICK_WITH_ID:'seat:clickWithId',   // 用户点击座位

  // ==========================================
  // 玩家相关(PlayerManager / DataManager)
  // ==========================================
  PLAYER_SIT: 'player:sit',               // 玩家入座
  PLAYER_STAND: 'player:stand',           // 玩家离座
  PLAYER_READY: 'player:ready',           // 玩家准备
  PLAYER_UNREADY: 'player:unready',       // 玩家取消准备
  PLAYER_STATUS_CHANGE: 'player:status-change', // 玩家状态改变
  PLAYER_INFO_UPDATE: 'player:info-update', // 玩家信息更新
  PLAYER_HEAD_CHANGE: 'player:head-change', // 头像更换
  PLAYER_SET_DRUNK: 'player:set-drunk',     // 上帝设置酒鬼

  // ==========================================
  // 弹窗 / UI 控制(UIPopup)
  // ==========================================
  POPUP_OPEN: 'popup:open',               // 打开弹窗
  POPUP_CLOSE: 'popup:close',             // 关闭弹窗
  POPUP_CONFIRM: 'popup:confirm',         // 弹窗确认
  POPUP_CANCEL: 'popup:cancel',           // 弹窗取消

  // ==========================================
  // 角色 / 头像库(UI_avatrLib)
  // ==========================================
  AVATAR_SELECT: 'avatar:select',         // 选择角色头像
  AVATAR_CONFIRM: 'avatar:confirm',       // 确认选择角色
  AVATAR_OPEN: 'avatar:open',           // 关闭角色界面
  AVATAR_CLOSE: 'avatar:close',           // 关闭角色界面

  // ==========================================
  // 等待玩家列表(waitPlayerList)
  // ==========================================
  WAIT_PLAYER_JOIN: 'wait:player-join',   // 玩家加入等待
  WAIT_PLAYER_LEAVE: 'wait:player-leave', // 玩家离开等待
  WAIT_LIST_UPDATE: 'wait:list-update',   // 等待列表刷新

  // ==========================================
  // 消息处理
  // ==========================================
  SEND_MSG: 'send:message',               // 发送消息
  RECEIVE_MSG: 'receive:message',         // 接收消息
  CHAT_DATA_UPDATE: 'chat:data-update',   // 聊天数据更新
  CHAT_SYNC_RECEIVED: 'chat:sync-received', // 收到服务端聊天记录同步
  GET_SERVER_MSG: 'server:msg',           // 获取服务器消息
  START_CHAT: 'start:chat',               // 开始聊天
  CHATUI_CLOSE_SESSION: 'chatUI:close-session',   // 关闭会话详情页
  CHATUI_OPEN_SESSION: 'chatUI:open-session',   // 打开会话详情页

  // ==========================================
  // 全局数据(DataManager 专用)
  // ==========================================
  DATA_UPDATE: 'data:update',             // 数据更新
  DATA_RESET: 'data:reset',               // 数据重置

  // ==========================================
  // 玩家列表 / 房间状态
  // ==========================================
  PLAYER_LIST_UPDATED: 'player:list-updated',   // 玩家列表更新
  RECONNECTING: 'server:reconnecting',          // 正在重连
  WS_CONNECTED: 'ws:connected',                 // WebSocket 已连接
  WS_DISCONNECTED: 'ws:disconnected',           // WebSocket 已断开
  SERVER_ERROR: 'server:error',                 // 服务端错误

  // ==========================================
  // 游戏状态
  // ==========================================
  CHANGE_STATE: 'game:change-state',            // 切换游戏状态
  GAME_PHASE_CHANGED: 'game:phase-changed',      // 游戏阶段变更
  ROLE_MODE_CHANGED: 'role:mode-changed',         // 角色选择模式变更

  // ==========================================
  // 底部操作栏
  // ==========================================
  OPEN_CHAT: 'ui:open-chat',                    // 打开聊天窗口
  CHAT_SHOWN: 'ui:chat-shown',                  // 聊天窗口已显示
  CHAT_HIDDEN: 'ui:chat-hidden',                // 聊天窗口已关闭
  GROUP_CHAT_OPEN: 'chat:group-open',           // 打开群聊选人弹窗
  GROUP_CHAT_CREATE: 'chat:group-create',       // 确认发起群聊
  OPEN_EVENT_LOG: 'ui:open-event-log',          // 打开事件记录器
  EVENT_LOG_SHOWN: 'ui:event-log-shown',        // 事件记录器已显示
  EVENT_LOG_HIDDEN: 'ui:event-log-hidden',      // 事件记录器已关闭

  // ==========================================
  // 事件记录器远程同步
  // ==========================================
  EVENT_REMOTE_RECORD: 'event:remote-record',   // 收到服务端事件记录
  EVENT_REMOTE_DELETE: 'event:remote-delete',   // 收到服务端事件删除
  EVENT_REMOTE_SYNC: 'event:remote-sync',       // 收到服务端完整事件列表

  // ==========================================
  // 间谍模式
  // ==========================================
  SPY_DATA_RECEIVED: 'spy:data-received',       // 收到服务端间谍数据
  SPY_MODE_OFF: 'spy:mode-off',                 // 关闭间谍模式

};

// ==========================================
// 快捷事件模板（事件记录器内使用）
// ==========================================
export const QUICK_EVENT_TEMPLATES = [
  // 单玩家事件（1个占位符 {0}）
  { id: 'death',       label: '死亡',       text: '{0} 死亡' },
  { id: 'execution',   label: '被处决',     text: '{0} 被处决' },
  { id: 'revive',      label: '没有死亡',   text: '{0} 没有死亡' },
  { id: 'no_outsider', label: '无外来者',   text: '{0}得知没有外来者。', section: 'inter' },

  // 双玩家事件（2个占位符 {0}, {1}）
  { id: 'attack',      label: '攻击',       text: '{0} 攻击 {1}' },
  { id: 'poison',      label: '下毒',       text: '{0} 对 {1} 下毒' },
  { id: 'protect',     label: '保护',       text: '{0} 保护 {1}' },
  { id: 'investigate', label: '调查',       text: '{0}调查了{1}，得知ta是{role}', section: 'inter' },
  { id: 'kill',        label: '开枪',       text: '{0} 开枪 {1}' },
  { id: 'nominate',    label: '提名',       text: '{0} 提名 {1}', section: 'general' },
  { id: 'fortune',     label: '占卜',       text: '{0} 占卜 {1} {2}' },
  { id: 'choose',      label: '选择',       text: '{0}选择了{1}' },

  // 单玩家 + 数字（{0} 玩家占位符，{n} 数字选择器）
  { id: 'received_votes', label: '得票',
    text: '{0} 获得 {n} 票',
    hasNumber: true, numberMin: 0, numberMax: 15, numberDefault: 1 },
  { id: 'get_number', label: '获得数字',
    text: '{0} 获得数字 {n}',
    hasNumber: true, numberMin: 0, numberMax: 2, numberDefault: 1 },

  // 身份事件（{0} 玩家占位符，{role} 角色选择器）
  { id: 'seen_as',  label: '被视为', text: '{0} 被视为 {role}' },
  { id: 'become',   label: '变成',   text: '{0} 变成 {role}' },

  // 多玩家 + 角色（{0} {1} {2} 玩家占位符，{role} 角色选择器）
  { id: 'one_of_has_role', label: '得知了', text: '{0}得知了{1}和{2}里有一个{role}', section: 'inter' },
];

// 角色列表（事件记录器角色选择器用）
export const ROLE_LIST = [
  '洗衣妇', '图书管理员', '调查员', '厨师', '共情者', '占卜师',
  '掘墓人', '僧侣', '守鸦人', '圣女', '杀手', '士兵', '市长',
  '管家', '酒鬼', '圣徒', '隐士',
  '下毒者', '间谍', '魅魔', '男爵',
  '小恶魔',
  '克星',
];

// 快捷事件模板 → event type 映射（对应事件记录器的 TYPE_COLORS/TYPE_LABELS）
export const QUICK_EVENT_TYPE_MAP = {
  death: 'death',
  execution: 'death',
  revive: 'alive',
  no_outsider: 'custom',
  kill: 'death',
  attack: 'custom',
  poison: 'custom',
  protect: 'custom',
  investigate: 'custom',
  nominate: 'custom',
  fortune: 'custom',
  received_votes: 'custom',
  get_number: 'custom',
  seen_as: 'custom',
  become: 'custom',
  choose: 'custom',
  one_of_has_role: 'custom',
};
