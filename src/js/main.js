// ====================== 全局配置参数 ======================
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
  usePointer: true,
};
// ====================== DOM缓存（已删除globalLockMask） ======================
const dom = {
  initMask: document.querySelector('.init-mask'),
  initCloseBtn: document.querySelector('.init-close-btn'),
  matchStick: document.getElementById('matchStick'),
  scrollWrap: document.getElementById('scrollWrap'),
  scrollContent: document.querySelector('.scroll-content'),
  spotBtns: document.querySelectorAll('.spot-btn'),
  spotMask: document.querySelector('.spot-mask'),
  spotCard: document.querySelector('.spot-card'),
  spotClose: document.querySelector('.spot-close'),
  officialBtn: document.querySelector('.official-btn'),
  areaSelectBtn: document.querySelector('.area-select-btn'),
  areaMask: document.querySelector('.area-mask'),
  areaPop: document.querySelector('.area-pop'),
  areaItems: document.querySelectorAll('.area-item'),
};
// ====================== 全局状态 ======================
const state = {
  mouseX: 0,
  mouseY: 0,
  stickX: 0,
  stickY: 0,
  smoothedMouseX: 0,
  smoothedMouseY: 0,
  lastMoveTime: 0,
  lastTouchX: 0,
  lastTouchY: 0,
  scrollTimer: null,
  scrollAnimId: null,
  targetScrollLeft: 0,
  isDrag: false,
  isMouseDown: false,
  dragStartX: 0,
  dragStartScrollLeft: 0,
  pageLock: true,
  spotOpen: false,
  areaScrolling: false,
  stickInBtn: false,
  scrollDir: null,
  mouseInsideWindow: true,
  areaAnimId: null,
  awaitMouseMove: false,
  initDialogOpen: true,
};
// ====================== 缓动函数 ======================
function easeInOutCubic(t) {
  if (t < 0.5) {
    return 4 * t * t * t;
  } else {
    return 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
}
// ========== 页面载入：随机生成火柴人初始位置 ==========
function randomStickPosition() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  state.stickX = 60 + Math.random() * (w - 120);
  state.stickY = 60 + Math.random() * (h - 120);
  state.smoothedMouseX = state.stickX;
  state.smoothedMouseY = state.stickY;
  dom.matchStick.style.left = state.stickX + 'px';
  dom.matchStick.style.top = state.stickY + 'px';
}
randomStickPosition();
// ====================== 统一指针移动处理（鼠标/触摸） ======================
function handlePointerMove(clientX, clientY) {
  const now = performance.now();
  state.mouseX = clientX;
  state.mouseY = clientY;
  state.mouseInsideWindow = true;
  // 鼠标位置平滑滤波，消除微小抖动
  state.smoothedMouseX += (clientX - state.smoothedMouseX) * CONFIG.followSmoothing;
  state.smoothedMouseY += (clientY - state.smoothedMouseY) * CONFIG.followSmoothing;
  state.lastMoveTime = now;
  if (state.awaitMouseMove) {
    state.awaitMouseMove = false;
  }
  if (state.isMouseDown && !state.spotOpen && !state.initDialogOpen) {
    state.isDrag = true;
    const dx = clientX - state.dragStartX;
    // 过滤微小拖拽偏移，防止画面左右抖动
    if (Math.abs(dx) < 1.2) return;
    let newScroll = state.dragStartScrollLeft - dx * CONFIG.dragSensitivity;
    const maxScroll = dom.scrollWrap.scrollWidth - dom.scrollWrap.clientWidth;
    newScroll = Math.max(0, Math.min(newScroll, maxScroll));
    dom.scrollWrap.scrollLeft = newScroll;
  } else {
    state.isDrag = false;
  }
}
// 鼠标移动监听
window.addEventListener('mousemove', (e) => {
  handlePointerMove(e.clientX, e.clientY);
});
// 触摸移动监听
window.addEventListener('touchmove', (e) => {
  const touch = e.touches[0];
  const now = performance.now();
  const dx = touch.clientX - state.lastTouchX;
  const dy = touch.clientY - state.lastTouchY;
  const moved = Math.hypot(dx, dy);
  if (moved < CONFIG.touchMoveThreshold && now - state.lastMoveTime < 16) {
    return;
  }
  state.lastTouchX = touch.clientX;
  state.lastTouchY = touch.clientY;
  handlePointerMove(touch.clientX, touch.clientY);
}, { passive: true });
// 触摸抬起
window.addEventListener('touchend', () => {
  state.isMouseDown = false;
  state.isDrag = false;
});
// 鼠标按下
window.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  e.preventDefault();
  state.isMouseDown = true;
  state.dragStartX = e.clientX;
  state.dragStartScrollLeft = dom.scrollWrap.scrollLeft;
});
// 鼠标抬起
window.addEventListener('mouseup', (e) => {
  if (e.button !== 0) return;
  state.isMouseDown = false;
  state.isDrag = false;
});
// 鼠标离开窗口
document.addEventListener('mouseout', (e) => {
  if (!e.relatedTarget) {
    state.mouseInsideWindow = false;
    state.isMouseDown = false;
    state.isDrag = false;
    stopAutoScroll();
  }
});
// 鼠标进入窗口
document.addEventListener('mouseenter', () => {
  state.mouseInsideWindow = true;
});
// ====================== 火柴人跟随动画 ======================
function stickAnimate() {
  const btnRect = dom.areaSelectBtn.getBoundingClientRect();
  const popRect = dom.areaPop.getBoundingClientRect();
  const onAreaBtn =
    state.mouseX >= btnRect.left &&
    state.mouseX <= btnRect.right &&
    state.mouseY >= btnRect.top &&
    state.mouseY <= btnRect.bottom;
  const onAreaPop =
    state.mouseX >= popRect.left &&
    state.mouseX <= popRect.right &&
    state.mouseY >= popRect.top &&
    state.mouseY <= popRect.bottom;
  const shouldFreeze =
    state.spotOpen ||
    !state.mouseInsideWindow ||
    onAreaBtn ||
    onAreaPop ||
    state.areaScrolling ||
    state.awaitMouseMove ||
    state.initDialogOpen;
  if (shouldFreeze) {
    dom.matchStick.style.left = state.stickX + 'px';
    dom.matchStick.style.top = state.stickY + 'px';
    checkScrollSense();
    detectBtnOverlap();
    requestAnimationFrame(stickAnimate);
    return;
  }
  const viewWidth = window.innerWidth;
  const minCenterX = viewWidth * CONFIG.leftBoundaryPercent / 100;
  const maxCenterX = viewWidth * CONFIG.rightBoundaryPercent / 100;
  const targetX = state.smoothedMouseX;
  const targetY = state.smoothedMouseY + CONFIG.mouseOffsetY;
  const dx = targetX - state.stickX;
  const dy = targetY - state.stickY;
  const distance = Math.hypot(dx, dy);
  const now = performance.now();
  const timeSinceLastMove = now - state.lastMoveTime;
  // 鼠标静止时停止微小插值抖动
  if (timeSinceLastMove > 32 && distance < CONFIG.stationaryThreshold) {
    dom.matchStick.style.left = state.stickX + 'px';
    dom.matchStick.style.top = state.stickY + 'px';
    checkScrollSense();
    detectBtnOverlap();
    requestAnimationFrame(stickAnimate);
    return;
  }
  // 极小距离过滤，消除像素级抖动
  if (distance < CONFIG.minMoveDistance) {
    dom.matchStick.style.left = state.stickX + 'px';
    dom.matchStick.style.top = state.stickY + 'px';
    checkScrollSense();
    detectBtnOverlap();
    requestAnimationFrame(stickAnimate);
    return;
  }
  const ease = distance > 60 ? CONFIG.fastEase : CONFIG.slowEase;
  let moveX = dx * ease;
  let moveY = dy * ease;
  const moveDist = Math.hypot(moveX, moveY);
  if (moveDist > CONFIG.maxFollowSpeed) {
    const scale = CONFIG.maxFollowSpeed / moveDist;
    moveX *= scale;
    moveY *= scale;
  }
  state.stickX += moveX;
  state.stickY += moveY;
  state.stickX = Math.max(minCenterX, state.stickX);
  state.stickX = Math.min(maxCenterX, state.stickX);
  dom.matchStick.style.left = state.stickX + 'px';
  dom.matchStick.style.top = state.stickY + 'px';
  checkScrollSense();
  detectBtnOverlap();
  requestAnimationFrame(stickAnimate);
}
stickAnimate();
// ====================== 自定义光标 ======================
const handCursorSvg = `url('/qiqiu.png') 16 16, default`;
document.body.style.cursor = handCursorSvg;
document.querySelectorAll('button').forEach(btn => {
  btn.addEventListener('mouseenter', () => {
    document.body.style.cursor = 'pointer';
  });
  btn.addEventListener('mouseleave', () => {
    document.body.style.cursor = handCursorSvg;
  });
});
// ====================== 边界自动滚动（RAF同帧渲染，解决画面左右抖动） ======================
function checkScrollSense() {
  if (!state.mouseInsideWindow) {
    stopAutoScroll();
    return;
  }
  if (state.initDialogOpen) {
    stopAutoScroll();
    return;
  }
  if (state.pageLock || state.spotOpen || state.areaScrolling || state.isDrag) {
    stopAutoScroll();
    return;
  }
  const btnRect = dom.areaSelectBtn.getBoundingClientRect();
  const popRect = dom.areaPop.getBoundingClientRect();
  const onAreaBtn =
    state.mouseX >= btnRect.left &&
    state.mouseX <= btnRect.right &&
    state.mouseY >= btnRect.top &&
    state.mouseY <= btnRect.bottom;
  const onAreaPop =
    state.mouseX >= popRect.left &&
    state.mouseX <= popRect.right &&
    state.mouseY >= popRect.top &&
    state.mouseY <= popRect.bottom;
  if (onAreaBtn || onAreaPop) {
    stopAutoScroll();
    return;
  }
  const viewWidth = window.innerWidth;
  const leftTrigger = viewWidth * CONFIG.leftBoundaryPercent / 100;
  const rightTrigger = viewWidth * CONFIG.rightBoundaryPercent / 100;
  let targetDir = null;
  if (state.stickX <= leftTrigger) {
    targetDir = 'left';
  } else if (state.stickX >= rightTrigger) {
    targetDir = 'right';
  }
  if (!targetDir) {
    stopAutoScroll();
    return;
  }
  const maxScrollLeft = dom.scrollWrap.scrollWidth - dom.scrollWrap.clientWidth;
  if (targetDir === 'left') {
    state.targetScrollLeft = Math.max(0, dom.scrollWrap.scrollLeft - CONFIG.scrollSpeed);
  } else {
    state.targetScrollLeft = Math.min(maxScrollLeft, dom.scrollWrap.scrollLeft + CONFIG.scrollSpeed);
  }
  if (!state.scrollAnimId) {
    autoScrollLoop();
  }
}
// 滚动动画循环，与火柴人动画共用requestAnimationFrame，消除帧撕裂抖动
function autoScrollLoop() {
  const diff = state.targetScrollLeft - dom.scrollWrap.scrollLeft;
  if (Math.abs(diff) < 0.1) {
    stopAutoScroll();
    return;
  }
  dom.scrollWrap.scrollLeft += diff * 0.4;
  state.scrollAnimId = requestAnimationFrame(autoScrollLoop);
}
// 停止自动滚动
function stopAutoScroll() {
  if (state.scrollAnimId) {
    cancelAnimationFrame(state.scrollAnimId);
    state.scrollAnimId = null;
  }
  state.targetScrollLeft = dom.scrollWrap.scrollLeft;
}
// ====================== 碰撞检测 ======================
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
// ====================== 区域弹窗开关（修复点击外部消失） ======================
dom.areaSelectBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const show = dom.areaPop.style.display === "block";
  dom.areaPop.style.display = show ? "none" : "block";
});
// 点击下拉内部阻止冒泡，弹窗不消失
dom.areaPop.addEventListener('click', (e) => {
  e.stopPropagation();
});
// 点击页面空白处关闭下拉
document.addEventListener('click', () => {
  dom.areaPop.style.display = "none";
});
dom.areaMask.addEventListener('click', () => {
  dom.areaPop.style.display = "none";
});
// ====================== 区域平滑跳转 ======================
dom.areaItems.forEach(item => {
  item.addEventListener('click', () => {
    dom.areaPop.style.display = "none";
    if (state.areaScrolling && state.areaAnimId) {
      cancelAnimationFrame(state.areaAnimId);
    }
    const targetIndex = Number(item.dataset.target);
    const targetBox = document.querySelectorAll('.media-box')[targetIndex];
    const wrap = dom.scrollWrap;
    const startScroll = wrap.scrollLeft;
    const targetLeft = targetBox.offsetLeft;
    const totalDistance = targetLeft - startScroll;
    state.areaScrolling = true;
    const startTime = performance.now();
    const duration = CONFIG.areaScrollDuration;
    function anim(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeP = easeInOutCubic(progress);
      wrap.scrollLeft = startScroll + totalDistance * easeP;
      if (progress < 1) {
        state.areaAnimId = requestAnimationFrame(anim);
      } else {
        state.areaScrolling = false;
        state.awaitMouseMove = true;
        state.areaAnimId = null;
      }
    }
    state.areaAnimId = requestAnimationFrame(anim);
  })
})
// ====================== 关闭初始弹窗解锁页面（修复动画时序卡死） ======================
dom.initCloseBtn.addEventListener('click', () => {
  dom.initMask.style.transition = 'all 0.3s ease';
  dom.initMask.style.transform = 'scale(0)';
  function hideMask() {
    dom.initMask.style.display = 'none';
    dom.areaSelectBtn.classList.remove('disabled');
    state.pageLock = false;
    state.initDialogOpen = false;
    dom.initMask.removeEventListener('transitionend', hideMask);
  }
  // 动画结束执行隐藏
  dom.initMask.addEventListener('transitionend', hideMask);
  // 兜底定时器，防止浏览器不触发动画事件
  setTimeout(hideMask, 500);
});
// ====================== 景点弹窗交互 ======================
function openSpotCard() {
  state.spotOpen = true;
  dom.spotMask.style.display = 'block';
  dom.spotCard.classList.add('active');
  stopAutoScroll();
}
function closeSpotCard() {
  state.spotOpen = false;
  dom.spotMask.style.display = 'none';
  dom.spotCard.classList.remove('active');
}
window.addEventListener('click', (e) => {
  if (state.pageLock) return;
  const target = e.target;
  let tempLink = "";
  const btn = target.closest('.spot-btn');
  if (btn && state.stickInBtn) {
    const spotName = btn.dataset.name || "未知景点";
    const spotDesc = btn.dataset.desc || "暂无景点介绍";
    tempLink = btn.dataset.link || "";
    document.querySelector('.spot-card-title').innerText = spotName;
    document.querySelector('.spot-text-box').innerText = spotDesc;
    const officialBtn = document.querySelector('.official-btn');
    officialBtn.dataset.link = tempLink;
    openSpotCard();
  }
  if (target.closest('.spot-close') || target.closest('.spot-mask')) closeSpotCard();
  if (target.closest('.official-btn')) {
    const link = target.closest('.official-btn').dataset.link;
    if (link) {
      window.open(link, '_blank');
    } else {
      alert("该景点暂无官方网站🏞");
    }
  }
});
