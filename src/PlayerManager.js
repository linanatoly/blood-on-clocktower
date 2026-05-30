import {DataManager} from './dataManager/dataManager.js';

export class PlayerManager {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.data = DataManager.getInstance();
  }
  getPopupButtonConfig(seatIndex) {
    const playerID = this.data.userId;
    const userType = this.data.userType;
    const gameState = this.data.gameState;

    // 上帝座位：特殊处理
    if (seatIndex === 'god') {
      const godPlayer = this.data.playerList.find(p => p.playerId === this.data.godId);
      return {
        player_ID: playerID,
        nickName: godPlayer ? (godPlayer.nickName || '上帝') : '上帝',
        showSitBtn: false,
        showChooseAvatrBtn: false,
        showChatBtn: userType === 'player' && !!godPlayer && godPlayer.playerId !== playerID,
        showDeadWithTicketBtn: false,
        showDeadWithoutTicketBtn: false,
        showAliveBtn: false,
        showDrunkBtn: false,
        isDrunk: false,
        targetPlayerId: godPlayer ? godPlayer.playerId : null,
        chooseModel: null,
        gameState: gameState,
        showPopup: userType === 'player' && !!godPlayer,
      };
    }

    const seatedPlayer = this.data.playerList.find(item => item.seatNum === seatIndex);
    const isGamePre = userType === 'player' && gameState === 'preparing';

    let showMyAvatrChoose = false;
    let avatrChooseModel = null;

    if (seatedPlayer) {
      const isSelf = seatedPlayer.playerId === playerID;
      if (gameState === 'preparing') {
        if (this.data.roleAssignmentMode === 'god_assign') {
          // 上帝指定模式：上帝为已入座玩家选择角色
          if (userType === 'god') {
            showMyAvatrChoose = true;
            avatrChooseModel = 'single';
          }
          // 玩家在上帝指定模式下不能自己选角色（保持 false）
        } else {
          // 默认：玩家自选模式
          if (isSelf && !seatedPlayer.ready) {
            showMyAvatrChoose = true;
            avatrChooseModel = 'single';
          }
        }
      } else if (gameState === 'in_gaming') {
        showMyAvatrChoose = !isSelf && userType !== 'god';
      }
    }

    const showChatBtn = !!seatedPlayer && seatedPlayer.playerId !== playerID;
    const isGodInGame = userType === 'god' && gameState === 'in_gaming';
    const showDeadBtns = isGodInGame && !!seatedPlayer;
    const isGodCanDrunk = userType === 'god' && (gameState === 'preparing' || gameState === 'in_gaming');
    const showDrunkBtn = isGodCanDrunk && !!seatedPlayer;

    return {
      player_ID: (userType === 'god' && gameState === 'preparing' &&
                 this.data.roleAssignmentMode === 'god_assign' && seatedPlayer)
                ? seatedPlayer.playerId : playerID,
      nickName: seatedPlayer ? (seatedPlayer.nickName || '等待玩家') : '空座位',
      showSitBtn: isGamePre && !seatedPlayer,
      showChooseAvatrBtn: showMyAvatrChoose,
      showChatBtn: showChatBtn,
      showDeadWithTicketBtn: showDeadBtns,
      showDeadWithoutTicketBtn: showDeadBtns,
      showAliveBtn: showDeadBtns,
      showDrunkBtn: showDrunkBtn,
      isDrunk: seatedPlayer ? !!seatedPlayer.drunk : false,
      targetPlayerId: seatedPlayer ? seatedPlayer.playerId : null,
      chooseModel: avatrChooseModel,
      gameState: gameState,
    }
  }  
  // 入座逻辑
  sitPlayer(playerId,inputSeatNum) {
    //判断座位有没有人
    let whoSitHere = this.data.playerList.find(item => item.seatNum === inputSeatNum);
    console.log(whoSitHere)
    const target = this.data.playerList.find(p => p.playerId === playerId);
    let nowSeatNum = '';
    let changeSeatType = '';
    let needFreshList = [];
    //如果点击的座位是空的
    if(!whoSitHere){
      if(target.seatNum !== null){
        //将之前坐的位置号赋予
        nowSeatNum = target.seatNum;
        // 根据 playerId 修改座位号（最安全，不靠下标）
        target.seatNum = inputSeatNum;
        changeSeatType = 'normal';
        console.log('✅换座成功，新座位：', inputSeatNum);
      }else{
        target.seatNum = inputSeatNum;
        console.log('直接坐下');
      }
    }else{
      //原来座位有人的换座
      //老座位号赋予给被换座位的人
      nowSeatNum = target.seatNum;
      whoSitHere.seatNum = nowSeatNum;
      target.seatNum = inputSeatNum;
      changeSeatType = 'withPlayer';
      console.log('✅和玩家换座成功，新座位：', inputSeatNum);      
    }
    const playListAfterSit = this.data.playerList;
    needFreshList.push(target);
    this.data.dataRefresh();

    return {playerData:needFreshList,seatChange:changeSeatType,oldSeatNum:nowSeatNum,playerList:playListAfterSit,whoBeChanged:whoSitHere}
  }

  //角色选择窗逻辑
  chooseAvatr(playerId,chooseList){
    console.log('plm get',chooseList);
    const refreshList = [];
    //单选逻辑
    if(chooseList.length===1){
      let whoChoose = this.data.playerList.find(item => item.playerId === playerId);
      whoChoose.headImgUrl = chooseList[0].imgKey;
      whoChoose.avatarName = chooseList[0].text;
      refreshList.push(whoChoose);
      console.log('plm put',refreshList);
      return refreshList;
    }
  }

  // 本地角色备注（仅限游戏中对其他玩家的标注，不发送服务端）
  setLocalRoleNote(targetPlayerId, chooseList) {
    if (chooseList.length === 1) {
      this.data.localRoleNotes[targetPlayerId] = {
        avatarName: chooseList[0].text,
        headImgUrl: chooseList[0].imgKey
      };
      return this.data.playerList.find(item => item.playerId === targetPlayerId);
    }
  }

  providePlayList(){
    return {playList:this.data.playerList,userID:this.data.userId}
  }
}