// 全局配置
const CONFIG = {
  maxFollowSpeed: 6.5,
  slowEase: 0.032,
  fastEase: 0.085,
  minMoveDistance: 1.8,
  mouseOffsetY: -35,
  leftBoundaryPercent: 9,
  rightBoundaryPercent: 91,
  scrollSpeed: 15,
  dragSensitivity: 1.0,
  stickSize: 60,
  areaScrollDuration: 4000,
  followSmoothing: 0.65,
  stationaryThreshold: 0.08,
  touchMoveThreshold: 8,
};

// DOM缓存
const dom = {
  matchStick: document.getElementById('matchStick'),
  stickImg: document.getElementById('stickImg'),
  scrollWrap: document.getElementById('scrollWrap'),
  scrollContent: document.querySelector('.scroll-content'),
  spotBtns: document.querySelectorAll('.spot-btn'),
  spotMask: document.querySelector('.spot-mask'),
  spotCard: document.querySelector('.spot-card'),
  spotClose: document.querySelector('.spot-close'),
  officialBtn: document.querySelector('.official-btn'),
  areaSelectBtn: document.querySelector('.area-select-btn'),
  areaPop: document.querySelector('.area-pop'),
  areaItems: document.querySelectorAll('.area-item'),
  initMask: document.querySelector('.init-mask'),
  initCloseBtn: document.querySelector('.init-close-btn'),
};

// 全局状态（新增awaitMouseMove标记：区域跳转后等待鼠标移动才恢复跟随）
const state = {
  mouseX: window.innerWidth / 2,
  mouseY: window.innerHeight / 2,
  smoothedMouseX: window.innerWidth / 2,
  smoothedMouseY: window.innerHeight / 2,
  stickX: 0,
  stickY: 0,
  lastMoveTime: 0,
  lastCarSrc: "/zxche.gif",
  scrollAnimId: null,
  targetScrollLeft: 0,
  isDrag: false,
  dragStartX: 0,
  dragStartScrollLeft: 0,
  pageLock: true,
  spotOpen: false,
  areaScrolling: false,
  stickInBtn: false,
  mouseInsideWindow: true,
  initDialogOpen: true,
  awaitMouseMove: false, // 核心标记：切换区域后等待鼠标移动
};

// 缓动函数
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// 页面加载随机生成小车初始坐标
function randomStickPos() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const minX = w * CONFIG.leftBoundaryPercent / 100;
  const maxX = w * CONFIG.rightBoundaryPercent / 100;
  state.stickX = minX + Math.random() * (maxX - minX);
  state.stickY = 80 + Math.random() * (h - 160);
  state.smoothedMouseX = state.stickX;
  state.smoothedMouseY = state.stickY;
  dom.matchStick.style.left = state.stickX + "px";
  dom.matchStick.style.top = state.stickY + "px";
  updateCarImg(state.stickX);
}

// 根据X切换左右小车
function updateCarImg(x) {
  const mid = window.innerWidth / 2;
  const src = x < mid ? "/zxche.gif" : "/yxche.gif";
  if (state.lastCarSrc !== src) {
    dom.stickImg.src = src;
    state.lastCarSrc = src;
  }
}

// 鼠标坐标更新（只要鼠标一动，解除awaitMouseMove锁定）
function handleMousePos(x, y) {
  state.mouseX = x;
  state.mouseY = y;
  state.mouseInsideWindow = true;
  updateCarImg(x);
  state.smoothedMouseX += (x - state.smoothedMouseX) * CONFIG.followSmoothing;
  state.smoothedMouseY += (y - state.smoothedMouseY) * CONFIG.followSmoothing;
  state.lastMoveTime = performance.now();
  // 鼠标产生移动，取消等待标记，小车恢复跟随
  state.awaitMouseMove = false;
}

window.addEventListener('mousemove', e => handleMousePos(e.clientX, e.clientY));
window.addEventListener('touchmove', e => {
  const t = e.touches[0];
  handleMousePos(t.clientX, t.clientY);
}, { passive: true });

// 长按拖拽逻辑
dom.scrollWrap.addEventListener('mousedown', (e) => {
  if (state.initDialogOpen || state.spotOpen) return;
  e.preventDefault();
  state.isDrag = true;
  state.dragStartX = e.clientX;
  state.dragStartScrollLeft = dom.scrollWrap.scrollLeft;
});
document.addEventListener('mousemove', () => {
  if (!state.isDrag || state.initDialogOpen || state.spotOpen) return;
  const offset = event.clientX - state.dragStartX;
  const maxS = dom.scrollWrap.scrollWidth - dom.scrollWrap.clientWidth;
  dom.scrollWrap.scrollLeft = Math.max(0, state.dragStartScrollLeft - offset * CONFIG.dragSensitivity);
});
document.addEventListener('mouseup', () => state.isDrag = false);
document.addEventListener('mouseleave', () => {
  state.isDrag = false;
  state.mouseInsideWindow = false;
});
document.addEventListener('mouseenter', () => state.mouseInsideWindow = true);
window.addEventListener('resize', () => updateCarImg(state.stickX));

// 小车跟随主循环（新增awaitMouseMove冻结判断）
function animateStick() {
  // 冻结条件：弹窗、区域滚动、页面锁定、鼠标离开、【切换区域等待鼠标移动】
  const freeze = state.spotOpen || state.initDialogOpen || state.areaScrolling || !state.mouseInsideWindow || state.awaitMouseMove;
  if (freeze) {
    dom.matchStick.style.left = state.stickX + "px";
    dom.matchStick.style.top = state.stickY + "px";
    detectBtnOverlap();
    requestAnimationFrame(animateStick);
    return;
  }

  const targetX = state.smoothedMouseX;
  const targetY = state.smoothedMouseY + CONFIG.mouseOffsetY;
  const dx = targetX - state.stickX;
  const dy = targetY - state.stickY;
  const dist = Math.hypot(dx, dy);
  const idle = performance.now() - state.lastMoveTime > 32 && dist < CONFIG.stationaryThreshold;

  if (idle || dist < CONFIG.minMoveDistance) {
    dom.matchStick.style.left = state.stickX + "px";
    dom.matchStick.style.top = state.stickY + "px";
    detectBtnOverlap();
    requestAnimationFrame(animateStick);
    return;
  }

  const ease = dist > 60 ? CONFIG.fastEase : CONFIG.slowEase;
  let moveX = dx * ease;
  let moveY = dy * ease;
  const moveLen = Math.hypot(moveX, moveY);
  if (moveLen > CONFIG.maxFollowSpeed) {
    const scale = CONFIG.maxFollowSpeed / moveLen;
    moveX *= scale;
    moveY *= scale;
  }

  state.stickX += moveX;
  state.stickY += moveY;
  const winW = window.innerWidth;
  const minX = winW * CONFIG.leftBoundaryPercent / 100;
  const maxX = winW * CONFIG.rightBoundaryPercent / 100;
  state.stickX = Math.max(minX, Math.min(maxX, state.stickX));

  dom.matchStick.style.left = state.stickX + "px";
  dom.matchStick.style.top = state.stickY + "px";

  detectBtnOverlap();
  requestAnimationFrame(animateStick);
}

// 检测小车是否碰到景点按钮
function detectBtnOverlap() {
  const half = CONFIG.stickSize / 2;
  const stickRect = {
    left: state.stickX - half,
    right: state.stickX + half,
    top: state.stickY - half,
    bottom: state.stickY + half,
  };
  state.stickInBtn = false;
  dom.spotBtns.forEach(btn => {
    const rect = btn.getBoundingClientRect();
    if (stickRect.right > rect.left && stickRect.left < rect.right
      && stickRect.bottom > rect.top && stickRect.top < rect.bottom) {
      state.stickInBtn = true;
    }
  });
}

// 自动滚动循环（左右边界计算统一修复版）
function autoScrollLoop() {
  if (state.isDrag || state.initDialogOpen || state.spotOpen || state.areaScrolling || !state.mouseInsideWindow) {
    if (state.scrollAnimId) cancelAnimationFrame(state.scrollAnimId);
    state.scrollAnimId = null;
    requestAnimationFrame(autoScrollLoop);
    return;
  }
  const winW = window.innerWidth;
  const leftEdge = winW * CONFIG.leftBoundaryPercent / 100;
  const rightEdge = winW * CONFIG.rightBoundaryPercent / 100;
  let direction = null;
  if (state.stickX <= leftEdge) direction = "left";
  if (state.stickX >= rightEdge) direction = "right";
  if (!direction) {
    if (state.scrollAnimId) cancelAnimationFrame(state.scrollAnimId);
    state.scrollAnimId = null;
    requestAnimationFrame(autoScrollLoop);
    return;
  }
  const maxS = dom.scrollWrap.scrollWidth - dom.scrollWrap.clientWidth;
  if (direction === "left") {
    state.targetScrollLeft = Math.max(0, dom.scrollWrap.scrollLeft - CONFIG.scrollSpeed);
  } else {
    state.targetScrollLeft = Math.min(maxS, dom.scrollWrap.scrollLeft + CONFIG.scrollSpeed);
  }

  function scrollRun() {
    const diff = state.targetScrollLeft - dom.scrollWrap.scrollLeft;
    if (Math.abs(diff) < 0.1) {
      state.scrollAnimId = null;
      return;
    }
    dom.scrollWrap.scrollLeft += diff * 0.4;
    state.scrollAnimId = requestAnimationFrame(scrollRun);
  }
  if (!state.scrollAnimId) scrollRun();
  requestAnimationFrame(autoScrollLoop);
}

// 区域按钮点击逻辑
dom.areaSelectBtn.addEventListener('click', e => {
  e.stopPropagation();
  if (state.initDialogOpen) return;
  dom.areaPop.style.display = dom.areaPop.style.display === "block" ? "none" : "block";
});
document.addEventListener('click', () => dom.areaPop.style.display = "none");
dom.areaPop.addEventListener('click', e => e.stopPropagation());

// 区域平滑跳转【核心改动：跳转结束开启awaitMouseMove】
dom.areaItems.forEach(item => {
  item.addEventListener('click', () => {
    dom.areaPop.style.display = "none";
    const idx = Number(item.dataset.target);
    const box = document.querySelectorAll('.media-box')[idx];
    const start = dom.scrollWrap.scrollLeft;
    const target = box.offsetLeft;
    const diff = target - start;
    state.areaScrolling = true;
    const startT = performance.now();
    function anim(t) {
      const p = Math.min((t - startT) / CONFIG.areaScrollDuration, 1);
      dom.scrollWrap.scrollLeft = start + diff * easeInOutCubic(p);
      if (p < 1) {
        requestAnimationFrame(anim);
      } else {
        state.areaScrolling = false;
        state.awaitMouseMove = true; // 跳转完成，标记等待鼠标移动
      }
    }
    requestAnimationFrame(anim);
  });
});

// 关闭初始弹窗解锁页面
dom.initCloseBtn.addEventListener('click', () => {
  dom.initMask.style.transition = 'all 0.3s ease';
  dom.initMask.style.transform = 'scale(0)';
  setTimeout(() => {
    dom.initMask.style.display = 'none';
    dom.areaSelectBtn.classList.remove('disabled');
    state.pageLock = false;
    state.initDialogOpen = false;
  }, 300);
});

// 景点弹窗：仅小车靠近按钮才可点击
function openSpot() {
  state.spotOpen = true;
  dom.spotMask.style.display = 'block';
  dom.spotCard.classList.add('active');
}
function closeSpot() {
  state.spotOpen = false;
  dom.spotMask.style.display = 'none';
  dom.spotCard.classList.remove('active');
}
window.addEventListener('click', e => {
  if (state.pageLock) return;
  const spotBtn = e.target.closest('.spot-btn');
  if (spotBtn && state.stickInBtn) {
    document.querySelector('.spot-card-title').innerText = spotBtn.dataset.name;
    document.querySelector('.spot-text-box').innerText = spotBtn.dataset.desc;
    document.querySelector('.official-btn').dataset.link = spotBtn.dataset.link;
    openSpot();
  }
  if (e.target.closest('.spot-close') || e.target.closest('.spot-mask')) closeSpot();
  if (e.target.closest('.official-btn')) {
    const link = document.querySelector('.official-btn').dataset.link;
    link && window.open(link, '_blank');
  }
});

// 自定义鼠标光标
const customCursor = `url('/qiqiu.png') 16 16, default`;
document.body.style.cursor = customCursor;
document.querySelectorAll('button').forEach(btn => {
  btn.addEventListener('mouseenter', () => document.body.style.cursor = 'pointer');
  btn.addEventListener('mouseleave', () => document.body.style.cursor = customCursor);
});

// 页面载入随机小车位置 + 双动画启动
randomStickPos();
animateStick();
autoScrollLoop();
