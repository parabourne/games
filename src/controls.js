import * as THREE from 'three';
import { camera, renderer, DEFAULT_FOV } from './world.js';
import { resolveMovement, isOnGround, EYE_HEIGHT } from './collision.js';
import { hotbarSlots, getIcon } from './inventory.js';

// ---------- TOUCH CİHAZ TƏYİNİ ----------
export const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
if (isTouchDevice) document.body.classList.add('touch-device');

// ---------- OYUN VƏZİYYƏTİ (gameOver) ----------
let gameOver = false;
export function isGameOver() {
  return gameOver;
}
export function setGameOver(value) {
  gameOver = value;
}

// ---------- HOTBAR ----------
// Slotlar artıq sabit blok növləri deyil — topladığın əşyalar özləri
// slot tutur. Seçilmiş slot boşdursa, getCurrentType() null qaytarır.
const slotEls = document.querySelectorAll('.slot');
let selectedSlotIndex = 0;

export function getCurrentType() {
  const slot = hotbarSlots[selectedSlotIndex];
  return slot ? slot.item : null;
}

function selectSlot(index) {
  selectedSlotIndex = index;
  slotEls.forEach((s, i) => s.classList.toggle('active', i === index));
}

slotEls.forEach((slotEl, index) => {
  slotEl.addEventListener('click', () => selectSlot(index));
  slotEl.addEventListener('touchstart', (e) => {
    e.preventDefault();
    e.stopPropagation();
    selectSlot(index);
  }, { passive: false });
});

document.addEventListener('keydown', (e) => {
  const num = parseInt(e.code.replace('Digit', ''));
  if (num >= 1 && num <= slotEls.length) {
    selectSlot(num - 1);
  }
});

// Hər slot: içində əşya varsa ikon + say göstərir, yoxdursa çərçivə qalır,
// içi boş olur.
function renderHotbar() {
  slotEls.forEach((slotEl, index) => {
    const slot = hotbarSlots[index];
    const iconEl = slotEl.querySelector('.slot-icon');
    const countEl = slotEl.querySelector('.slot-count');
    if (slot) {
      iconEl.textContent = getIcon(slot.item);
      countEl.textContent = slot.count > 1 ? slot.count : '';
    } else {
      iconEl.textContent = '';
      countEl.textContent = '';
    }
  });
}
renderHotbar();
window.addEventListener('inventory-changed', renderHotbar);
selectSlot(0);

// ---------- POINTER LOCK (yalnız masaüstü) ----------
let yaw = 0, pitch = 0;
const PI_2 = Math.PI / 2;

if (!isTouchDevice) {
  renderer.domElement.addEventListener('click', () => {
    if (!gameOver) renderer.domElement.requestPointerLock();
  });

  document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement !== renderer.domElement) return;
    yaw -= e.movementX * 0.002;
    pitch -= e.movementY * 0.002;
    pitch = Math.max(-PI_2, Math.min(PI_2, pitch));
  });

  document.addEventListener('wheel', (e) => {
    if (document.pointerLockElement !== renderer.domElement) return;
    camera.fov += e.deltaY * 0.02;
    camera.fov = Math.max(20, Math.min(DEFAULT_FOV, camera.fov));
    camera.updateProjectionMatrix();
  });
}

// ---------- HƏRƏKƏT (klaviatura) ----------
const keys = {};
document.addEventListener('keydown', (e) => (keys[e.code] = true));
document.addEventListener('keyup', (e) => (keys[e.code] = false));

// ---------- TOXUNMA İDARƏETMƏ (joystick / baxış / tullanma) ----------
const touchMove = { x: 0, y: 0 };
let touchJump = false;

if (isTouchDevice) {
  const joystickZone = document.getElementById('joystick-zone');
  const joystickKnob = document.getElementById('joystick-knob');
  let joyTouchId = null;
  const JOY_RADIUS = 55;

  joystickZone.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0];
    joyTouchId = t.identifier;
    e.preventDefault();
  }, { passive: false });

  joystickZone.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier !== joyTouchId) continue;
      const rect = joystickZone.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = t.clientX - cx;
      let dy = t.clientY - cy;
      const dist = Math.min(Math.hypot(dx, dy), JOY_RADIUS);
      const angle = Math.atan2(dy, dx);
      dx = Math.cos(angle) * dist;
      dy = Math.sin(angle) * dist;
      joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
      touchMove.x = dx / JOY_RADIUS;
      touchMove.y = dy / JOY_RADIUS;
    }
    e.preventDefault();
  }, { passive: false });

  function resetJoystick(e) {
    for (const t of e.changedTouches) {
      if (t.identifier !== joyTouchId) continue;
      joyTouchId = null;
      touchMove.x = 0;
      touchMove.y = 0;
      joystickKnob.style.transform = `translate(0px, 0px)`;
    }
  }
  joystickZone.addEventListener('touchend', resetJoystick);
  joystickZone.addEventListener('touchcancel', resetJoystick);

  const lookZone = document.getElementById('look-zone');
  let lookTouchId = null;
  let lastX = 0, lastY = 0;

  lookZone.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0];
    lookTouchId = t.identifier;
    lastX = t.clientX;
    lastY = t.clientY;
    e.preventDefault();
  }, { passive: false });

  lookZone.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier !== lookTouchId) continue;
      const dx = t.clientX - lastX;
      const dy = t.clientY - lastY;
      lastX = t.clientX;
      lastY = t.clientY;
      yaw -= dx * 0.004;
      pitch -= dy * 0.004;
      pitch = Math.max(-PI_2, Math.min(PI_2, pitch));
    }
    e.preventDefault();
  }, { passive: false });

  lookZone.addEventListener('touchend', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === lookTouchId) lookTouchId = null;
    }
  });

  const jumpBtn = document.getElementById('jump-btn');
  jumpBtn.addEventListener('touchstart', (e) => {
    touchJump = true;
    e.preventDefault();
  }, { passive: false });
  jumpBtn.addEventListener('touchend', (e) => {
    touchJump = false;
    e.preventDefault();
  }, { passive: false });
}

// ---------- HƏRƏKƏT HESABLAMASI ----------
const velocity = new THREE.Vector3();
const GRAVITY = -20;
const JUMP_SPEED = 8;
const MOVE_SPEED = 6;

const VOID_Y = -30;
const RESPAWN_FEET = { x: 0, y: 5, z: 0 };

export function updateMovement(dt) {
  const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  const right = new THREE.Vector3(Math.sin(yaw + PI_2), 0, Math.cos(yaw + PI_2));

  const move = new THREE.Vector3();

  if (keys['KeyW']) move.sub(forward);
  if (keys['KeyS']) move.add(forward);
  if (keys['KeyA']) move.sub(right);
  if (keys['KeyD']) move.add(right);

  if (touchMove.x !== 0 || touchMove.y !== 0) {
    move.add(forward.clone().multiplyScalar(touchMove.y));
    move.add(right.clone().multiplyScalar(touchMove.x));
  }

  if (move.lengthSq() > 0) {
    if (move.length() > 1) move.normalize();
    move.multiplyScalar(MOVE_SPEED);
  }

  velocity.x = move.x;
  velocity.z = move.z;
  velocity.y += GRAVITY * dt;

  const feet = {
    x: camera.position.x,
    y: camera.position.y - EYE_HEIGHT,
    z: camera.position.z,
  };

  const delta = {
    x: velocity.x * dt,
    y: velocity.y * dt,
    z: velocity.z * dt,
  };

  const result = resolveMovement(feet, delta);
  let finalFeet = result.position;

  const grounded = isOnGround(finalFeet);

  if (result.collided.y && velocity.y > 0) {
    velocity.y = 0;
  }

  if ((keys['Space'] || touchJump) && grounded) {
    velocity.y = JUMP_SPEED;
  } else if (grounded && velocity.y < 0) {
    velocity.y = 0;
  }

  if (finalFeet.y < VOID_Y) {
    finalFeet = { ...RESPAWN_FEET };
    velocity.set(0, 0, 0);
  }

  camera.position.x = finalFeet.x;
  camera.position.y = finalFeet.y + EYE_HEIGHT;
  camera.position.z = finalFeet.z;

  camera.rotation.order = 'YXZ';
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;
}