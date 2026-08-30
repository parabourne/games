import * as THREE from 'three';
import {
  scene,
  camera,
  renderer,
  DEFAULT_FOV,
  instancedMeshes,
  indexToKey,
  addBlock,
  removeBlockByKey,
  parseKey,
} from './world.js';
import { animals, updateAnimals, damageAnimal } from './animals.js';
import { addToInventory } from './inventory.js';

// ---------- TOUCH CİHAZ TƏYİNİ ----------
const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
if (isTouchDevice) document.body.classList.add('touch-device');

// ---------- HOTBAR / İNVENTAR ----------
let currentType = 'grass';
const slots = document.querySelectorAll('.slot');
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

// ---------- POINTER LOCK (yalnız masaüstü) ----------
let yaw = 0, pitch = 0;
const PI_2 = Math.PI / 2;

if (!isTouchDevice) {
  renderer.domElement.addEventListener('click', () => {
    renderer.domElement.requestPointerLock();
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

// ---------- TOXUNMA İDARƏETMƏ ----------
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

  document.getElementById('break-btn').addEventListener('touchstart', (e) => {
    e.preventDefault();
    doAction('break');
  }, { passive: false });

  document.getElementById('place-btn').addEventListener('touchstart', (e) => {
    e.preventDefault();
    doAction('place');
  }, { passive: false });
}

// ---------- HƏRƏKƏT HESABLAMASI ----------
const velocity = new THREE.Vector3();
let canJump = false;
const GRAVITY = -20;
const JUMP_SPEED = 8;
const MOVE_SPEED = 6;

function updateMovement(dt) {
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

  if ((keys['Space'] || touchJump) && canJump) {
    velocity.y = JUMP_SPEED;
    canJump = false;
  }

  camera.position.x += velocity.x * dt;
  camera.position.z += velocity.z * dt;
  camera.position.y += velocity.y * dt;

  const groundY = 0 + 1.7;
  if (camera.position.y <= groundY) {
    camera.position.y = groundY;
    velocity.y = 0;
    canJump = true;
  }

  camera.rotation.order = 'YXZ';
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;
}

// ---------- BLOK SINDIRMA / QOYMA + HEYVANA VURMA ----------
const raycaster = new THREE.Raycaster();
raycaster.far = 8;
const center = new THREE.Vector2(0, 0);

// Raycast bir heyvanın alt-mesh-inə (body/head/leg) dəysə, qrupun özünə
// qədər yuxarı çıxıb userData.isAnimal işarəsini axtarırıq.
function findAnimalRoot(obj) {
  let o = obj;
  while (o) {
    if (o.userData && o.userData.isAnimal) return o;
    o = o.parent;
  }
  return null;
}

function doAction(actionType) {
  raycaster.setFromCamera(center, camera);

  const blockMeshList = Object.values(instancedMeshes);
  const animalMeshList = animals.map((a) => a.mesh);
  const intersects = raycaster.intersectObjects([...blockMeshList, ...animalMeshList], true);
  if (intersects.length === 0) return;

  const hit = intersects[0];

  // ---- Heyvana vurma ----
  const animalRoot = findAnimalRoot(hit.object);
  if (animalRoot) {
    if (actionType === 'break') {
      const record = animalRoot.userData.animalRef;
      const drops = damageAnimal(record, 1);
      if (drops) {
        for (const d of drops) addToInventory(d.item, d.count);
      }
    }
    return; // heyvana dəyibsə, blok məntiqinə keçmirik
  }

  // ---- Blok sındırma / qoyma ----
  if (hit.instanceId === undefined || hit.instanceId === null) return;

  const blockType = hit.object.userData.blockType;
  const k = indexToKey[blockType][hit.instanceId];
  if (!k) return;
  const [bx, by, bz] = parseKey(k);

  if (actionType === 'break') {
    removeBlockByKey(k);
  } else if (actionType === 'place') {
    const normal = hit.face.normal;
    addBlock(bx + normal.x, by + normal.y, bz + normal.z, currentType);
  }
}

if (!isTouchDevice) {
  renderer.domElement.addEventListener('mousedown', (e) => {
    if (document.pointerLockElement !== renderer.domElement) return;
    if (e.button === 0) doAction('break');
    else if (e.button === 2) doAction('place');
  });
  renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
}

// ---------- ANİMASİYA DÖNGÜSÜ ----------
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1);
  updateMovement(dt);
  updateAnimals(dt);
  renderer.render(scene, camera);
}
animate();