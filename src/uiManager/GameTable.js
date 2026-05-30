import { UIComponent } from './UIComponent.js';
import { EV } from '../event-constants.js';
import { DataManager } from '../dataManager/dataManager.js';

function getHeadImgPath(imgKey) {
  if (!imgKey) return null;
  const midGuy = ['guanjia', 'jiugui', 'shengtu', 'yinshi'];
  const badGuy = ['xiadu', 'jiandie', 'meimo', 'nanjue', 'xiaoemo'];
  if (midGuy.includes(imgKey)) return `assets/identity/midguy/${imgKey}.png`;
  if (badGuy.includes(imgKey)) return `assets/identity/badguy/${imgKey}.png`;
  return `assets/identity/${imgKey}.png`;
}

export class GameTable extends UIComponent {
  constructor(eventBus, containerEl) {
    super(eventBus, containerEl);
    this.data = DataManager.getInstance();
    this._seats = [];
    this._godSeat = null;
    this._gameStarted = false;
  }

  _clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
  }

  _colPos(i, leftCount, rightCount, leftX, rightX, colTopY, colGap, availH) {
    if (i < leftCount) {
      const y = leftCount <= 1
        ? colTopY + availH / 2
        : colTopY + colGap * (leftCount - 1 - i);
      return { x: leftX, y };
    } else {
      const ri = i - leftCount;
      const row = rightCount - 1 - ri;
      const y = rightCount <= 1
        ? colTopY + availH / 2
        : colTopY + colGap * (rightCount - 1 - row);
      return { x: rightX, y };
    }
  }

  _calcLayout(sw, sh, total) {
    const leftX = sw * 0.13;
    const rightX = sw * 0.87;
    const cx = sw / 2;
    const topMargin = sh * 0.08;
    const bottomMargin = sh * 0.10;
    const availH = sh - topMargin - bottomMargin;

    const colLeft = Math.ceil(total / 2);
    const colRight = total - colLeft;
    const colMax = Math.max(colLeft, colRight);
    const colGap = colMax > 1 ? availH / (colMax - 1) : 0;
    const colTopY = topMargin;

    const avatarD = this._clamp(sw / (total * 0.4+4), sw / 14, sw / 6.5);
    const avatarR = avatarD / 2;
    const s = sw / 750;

    let arcParams = null;
    let leftCount = colLeft;
    let rightCount = colRight;
    let arcCount = 0;
    let finalColGap = colGap;
    let finalColTopY = colTopY;
    let belowH = availH;

    if (total % 2 === 1) {
      const mid = Math.floor(total / 2);
      const arcStart = mid - 2;
      const arcEnd = mid + 2;
      arcCount = arcEnd - arcStart + 1;

      const pA = this._colPos(arcStart, colLeft, colRight, leftX, rightX, colTopY, colGap, availH);
      const pB = this._colPos(arcEnd, colLeft, colRight, leftX, rightX, colTopY, colGap, availH);

      const chordY = Math.min(pA.y, pB.y);
      const halfDx = (pB.x - pA.x) / 2;
      const chordMidX = (pA.x + pB.x) / 2;
      const targetY = topMargin + 14 * s;

      const dy = targetY - chordY;
      const h = (halfDx * halfDx - dy * dy) / (-2 * dy);
      const arcR = Math.sqrt(halfDx * halfDx + h * h);
      const arcCy = chordY + h;
      const thetaMax = Math.atan2(halfDx, h);

      arcParams = { arcStart, arcEnd, chordMidX, arcR, arcCy, thetaMax };

      leftCount = arcStart;
      rightCount = total - arcEnd - 1;
      if (leftCount > 0 || rightCount > 0) {
        finalColTopY = chordY + avatarD * 2.5;
        belowH = (topMargin + availH) - finalColTopY;
        const newMax = Math.max(leftCount, rightCount);
        const preferredGap = avatarD * 2.5;
        const needH = preferredGap * (newMax - 1);
        finalColGap = newMax > 1
          ? (needH <= belowH ? preferredGap : belowH / (newMax - 1))
          : 0;
      }
    }

    return {
      leftX, rightX, cx, topMargin, bottomMargin, availH, belowH,
      leftCount, rightCount, arcCount, colGap: finalColGap, colTopY: finalColTopY,
      avatarD, avatarR, arcParams, scale: s,
    };
  }

  _getPosition(i, total, sw, sh) {
    const L = this._calcLayout(sw, sh, total);

    if (L.arcParams) {
      const { arcStart, arcEnd, chordMidX, arcR, arcCy, thetaMax } = L.arcParams;
      if (i >= arcStart && i <= arcEnd) {
        const t = (i - arcStart) / (arcEnd - arcStart);
        const theta = -thetaMax + t * 2 * thetaMax;
        return {
          x: chordMidX + arcR * Math.sin(theta),
          y: arcCy - arcR * Math.cos(theta),
        };
      }
    }

    if (i < L.leftCount) {
      const y = L.leftCount <= 1
        ? L.colTopY + L.belowH / 2
        : L.colTopY + L.colGap * (L.leftCount - 1 - i);
      return { x: L.leftX, y };
    }
    const ri = i - (total - L.rightCount);
    const row = L.rightCount - 1 - ri;
    const y = L.rightCount <= 1
      ? L.colTopY + L.belowH / 2
      : L.colTopY + L.colGap * (L.rightCount - 1 - row);
    return { x: L.rightX, y };
  }

  _buildSeatsDOM(total) {
    this.el.innerHTML = '<div class="seats-container"></div>';
    const container = this.el.querySelector('.seats-container');
    // 强制重排后读取实际容器尺寸，fallback 用 #app 推算
    void this.el.offsetHeight;
    let sw = this.el.clientWidth;
    let sh = this.el.clientHeight;
    if (!sw || !sh) {
      const app = document.getElementById('app');
      sw = (app && app.clientWidth) || 750;
      sh = (app && app.clientHeight) || 1334;
      const topBar = document.getElementById('game-top-bar');
      const fnPanel = document.getElementById('panel-function');
      if (topBar) sh -= topBar.offsetHeight;
      if (fnPanel) sh -= fnPanel.offsetHeight;
    }

    for (let i = 0; i < total; i++) {
      const { x, y } = this._getPosition(i, total, sw, sh);
      const card = document.createElement('div');
      card.className = 'seat-card';
      card.dataset.seat = i;
      card.style.left = x + 'px';
      card.style.top = y + 'px';
      card.innerHTML = `
        <div class="seat-avatar-wrap">
          <div class="seat-glow"></div>
          <div class="seat-avatar-inner">
            <img class="seat-avatar" src="assets/empty.png" alt="">
            <img class="seat-avatar-dead hidden" src="assets/state_dead.png" alt="">
            <img class="seat-avatar-respect hidden" src="assets/show_respect.png" alt="">
          </div>
          <img class="seat-avatar-drunk hidden" src="assets/identity/midguy/jiugui.png" alt="">
        </div>
        <span class="seat-role-name">???</span>
        <span class="seat-player-name">等待玩家</span>
        <span class="seat-number">${i + 1}</span>
        <span class="seat-ready-badge hidden">已准备</span>
        <div class="seat-death-line hidden"></div>
      `;

      card.addEventListener('click', () => {
        this.emit(EV.SEAT_CLICK_WITH_ID, i);
      });

      container.appendChild(card);
      this._seats.push({
        card,
        avatar: card.querySelector('.seat-avatar'),
        drunkAvatar: card.querySelector('.seat-avatar-drunk'),
        deadOverlay: card.querySelector('.seat-avatar-dead'),
        respectOverlay: card.querySelector('.seat-avatar-respect'),
        roleName: card.querySelector('.seat-role-name'),
        playerName: card.querySelector('.seat-player-name'),
        number: card.querySelector('.seat-number'),
        readyBadge: card.querySelector('.seat-ready-badge'),
        deathLine: card.querySelector('.seat-death-line'),
        glow: card.querySelector('.seat-glow'),
      });
    }

    // 创建上帝专属座位
    this._buildGodSeat(container, sw, sh);
  }

  _buildGodSeat(container, sw, sh) {
    const card = document.createElement('div');
    card.className = 'seat-card god-seat';
    card.dataset.seat = 'god';
    card.style.position = 'absolute';
    card.style.bottom = '-55.32px';
    card.style.left = '50%';
    card.style.transform = 'translate(-50%, -50%)';
    card.innerHTML = `
      <div class="seat-avatar-wrap">
        <div class="seat-glow"></div>
        <div class="seat-avatar-inner">
          <img class="seat-avatar" src="assets/god_head.png" alt="">
          <img class="seat-avatar-dead hidden" src="assets/state_dead.png" alt="">
          <img class="seat-avatar-respect hidden" src="assets/show_respect.png" alt="">
        </div>
        <img class="seat-avatar-drunk hidden" src="assets/identity/midguy/jiugui.png" alt="">
      </div>
      <span class="seat-role-name">上帝</span>
      <span class="seat-player-name"></span>
      <span class="seat-number"></span>
      <span class="seat-ready-badge hidden"></span>
      <div class="seat-death-line hidden"></div>
    `;

    card.addEventListener('click', () => {
      this.emit(EV.SEAT_CLICK_WITH_ID, 'god');
    });

    container.appendChild(card);
    this._godSeat = {
      card,
      avatar: card.querySelector('.seat-avatar'),
      drunkAvatar: card.querySelector('.seat-avatar-drunk'),
      deadOverlay: card.querySelector('.seat-avatar-dead'),
      respectOverlay: card.querySelector('.seat-avatar-respect'),
      roleName: card.querySelector('.seat-role-name'),
      playerName: card.querySelector('.seat-player-name'),
      number: card.querySelector('.seat-number'),
      readyBadge: card.querySelector('.seat-ready-badge'),
      deathLine: card.querySelector('.seat-death-line'),
      glow: card.querySelector('.seat-glow'),
    };
  }

  createSeats(total) {
    this._seats = [];
    this._godSeat = null;
    this._gameStarted = false;
    this._buildSeatsDOM(total);
  }

  refresh(playerList) {
    if (!playerList || this._seats.length === 0) return;
    const isGod = this.data.userType === 'god';
    const myId = this.data.userId;
    const spyActive = this.data.spyActive;

    playerList.forEach(p => {
      if (p.seatNum === null || p.seatNum === undefined) return;
      const seat = this._seats[p.seatNum];
      if (!seat) return;

      let effectiveAvatarName = p.avatarName;
      let effectiveHeadImgUrl = p.headImgUrl;

      if (spyActive && this.data.spyData) {
        const spyP = this.data.spyData.players.find(sp => sp.playerId === p.playerId);
        if (spyP) {
          effectiveAvatarName = spyP.avatarName;
          effectiveHeadImgUrl = spyP.headImgUrl;
        }
      }

      seat.avatar.src = getHeadImgPath(effectiveHeadImgUrl) || 'assets/empty.png';

      seat.playerName.textContent = p.nickName || '玩家';

      if (effectiveAvatarName && (isGod || p.playerId === myId || spyActive)) {
        seat.roleName.textContent = effectiveAvatarName;
      } else if (this.data.localRoleNotes[p.playerId]) {
        seat.roleName.textContent = this.data.localRoleNotes[p.playerId].avatarName;
      } else {
        seat.roleName.textContent = '???';
      }

      const isDead = p.stateNow && p.stateNow.startsWith('dead');
      seat.deadOverlay.classList.toggle('hidden', p.stateNow !== 'dead_with_ticket');
      seat.respectOverlay.classList.toggle('hidden', p.stateNow !== 'dead_without_ticket');
      seat.roleName.classList.toggle('dead', isDead);
      seat.playerName.classList.toggle('dead', isDead);
      seat.glow.classList.toggle('hidden', isDead);

      if (p.connectState === 'offline') {
        seat.card.classList.add('offline');
      } else {
        seat.card.classList.remove('offline');
      }

      if (p.playerId === myId) {
        seat.glow.classList.add('is-self');
      } else {
        seat.glow.classList.remove('is-self');
      }

      const isEnded = this.data.gameState === 'ended';
      if ((isGod || isEnded || spyActive) && p.drunk) {
        seat.drunkAvatar.classList.remove('hidden');
      } else {
        seat.drunkAvatar.classList.add('hidden');
      }

      if (p.connectState === 'offline') {
        seat.readyBadge.textContent = '断线';
        seat.readyBadge.style.color = '#FFD700';
        seat.readyBadge.classList.remove('hidden');
      } else if (p.ready && !this._gameStarted) {
        seat.readyBadge.textContent = '已准备';
        seat.readyBadge.style.color = '#4CAF50';
        seat.readyBadge.classList.remove('hidden');
      } else {
        seat.readyBadge.classList.add('hidden');
      }
    });

    // 刷新上帝座位
    this._refreshGodSeat(playerList);
  }

  _refreshGodSeat(playerList) {
    if (!this._godSeat) return;
    const gs = this._godSeat;
    const godPlayer = playerList.find(p => p.playerId === this.data.godId);

    if (godPlayer) {
      gs.avatar.src = 'assets/god_head.png';
      gs.roleName.textContent = '上帝';

      if (godPlayer.connectState === 'offline') {
        gs.card.classList.add('offline');
        gs.readyBadge.textContent = '断线';
        gs.readyBadge.style.color = '#FFD700';
        gs.readyBadge.classList.remove('hidden');
      } else {
        gs.card.classList.remove('offline');
        gs.readyBadge.classList.add('hidden');
      }
    }
  }

  hideAllReadyBadges() {
    this._gameStarted = true;
    this._seats.forEach(s => s.readyBadge.classList.add('hidden'));
  }

  resetReadyBadges() {
    this._gameStarted = false;
  }
}
