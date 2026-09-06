import * as THREE from 'three';
import { camera, renderer, DEFAULT_FOV } from './world.js';
import { resolveMovement, isOnGround, EYE_HEIGHT } from './collision.js';
import { inventory } from './inventory.js';

// ---------- TOUCH CİHAZ TƏYİNİ ----------
export const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
if (isTouchDevice) document.body.classList.add('touch-device');

// ---------- OYUN VƏZİYYƏTİ (gameOver) ----------
// main.js bu bayrağı idarə edir (setGameOver), amma pointer lock (bu fayl)
// və doAction (actions.js) onu oxumalıdır — ona görə burada saxlanılır.
let gameOver = false;
export function isGameOver() {
  return gameOver;
}
export function setGameOver(value) {
  gameOver = value;
}

// ---------- HOTBAR / İNVENTAR ----------
let currentType = 'grass';
export function getCurrentType() {
  return currentType;
}

const slots = document.querySelectorAll('.slot');

// Hər slot-un orijinal ikonunu (HTML-dəki emoji) yadda saxlayırıq ki,
// material əldə ediləndə əsl ikonu geri qaytara bilək.
slots.forEach((slot) => {
  slot.dataset.icon = slot.textContent;
});

slots.forEach((slot) => {
  slot.addEventListener('click', () => selectSlot(slot));
  slot.addEventListener('touchstart', (e) => {
    e.preventDefault();
    e.stopPropagation();
    selectSlot(slot);
  }, { passive: false });
});
function selectSlot(slot) {
  slots.forEach((s) => s.classList.remove('active'));
  slot.classList.add('active');
  currentType = slot.dataset.type;
}
document.addEventListener('keydown', (e) => {
  const num = parseInt(e.code.replace('Digit', ''));
  if (num >= 1 && num <= slots.length) {
    selectSlot(slots[num - 1]);
  }
});

// Hotbar-dan bir blok QOYULARKƏN inventardan hansı itemin çıxılacağını
// göstərir (grass -> dirt istisnası daxil olmaqla). actions.js da eyni
// xəritəni doAction-da istifadə edir.
export const PLACE_REQUIRES = {
  grass: 'dirt',
  dirt: 'dirt',
  stone: 'stone',
  wood: 'wood',
  sand: 'sand',
  bed: 'bed',
};

// ---------- HOTBAR İKONLARININ GÖRÜNMƏSİ ----------
// Slotun çərçivəsi həmişə qalır, amma o slot üçün lazım olan material
// inventarda yoxdursa, içindəki ikon gizlədilir.
function updateHotbarAvailability() {
  slots.forEach((slot) => {
    const type = slot.dataset.type;
    const requiredItem = PLACE_REQUIRES[type] || type;
    const hasMaterial = (inventory[requiredItem] || 0) > 0;
    slot.textContent = hasMaterial ? slot.dataset.icon : '';
  });
}
updateHotbarAvailability();
window.addEventListener('inventory-changed', updateHotbarAvailability);

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
// Diqqət: sındır/qoy/yat düymələri burada YOXDUR — onlar doAction və
// attemptSleep-ə (actions.js) ehtiyac duyduqları üçün main.js-də qurulur.
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

// Dünyanın "boşluğuna" (heç bir blok olmayan yerə) düşərsə, oyunçunu
// təhlükəsiz nöqtəyə qaytarmaq üçün sadə mühafizə
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

  // Ayaq (feet) mövqeyi kameradan hesablanır
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

  // BUG FIX: 'başım bloka dəydimi' yoxlaması tullanma təyinatından ƏVVƏL
  // olmalıdır. Əvvəlki sıralamada bu yoxlama tullanmadan SONRA gəlirdi və
  // result.collided.y yerdə dayananda da true olduğu üçün, təzəcə təyin
  // olunan JUMP_SPEED (müsbət) dərhal 0-a sıfırlanırdı — tullanma öz-özünü
  // ləğv edirdi. İndi bu yoxlama yalnız BU FRAME-in artıq baş vermiş
  // (tullanmadan əvvəlki) hərəkətinə aiddir.
  if (result.collided.y && velocity.y > 0) {
    velocity.y = 0;
  }

  // Tullanma — yalnız yerdə olanda
  if ((keys['Space'] || touchJump) && grounded) {
    velocity.y = JUMP_SPEED;
  } else if (grounded && velocity.y < 0) {
    // Blokla toqquşub yerdə olanda düşmə sürətini sıfırla
    velocity.y = 0;
  }

  // Boşluğa düşübsə, təhlükəsiz nöqtəyə qaytar
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