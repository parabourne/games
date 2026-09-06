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
  blocks,
  key,
  updateDayNightCycle,
  isNight,
  skipToMorning,
} from './world.js';
import { animals, updateAnimals, damageAnimal } from './animals.js';
import {
  zombies,
  spawnNightZombies,
  despawnAllZombies,
  damageZombie,
  updateZombies,
} from './zombies.js';
import { addToInventory, removeFromInventory } from './inventory.js';
import { resolveMovement, isOnGround, EYE_HEIGHT } from './collision.js';
import './craft.js'; // craft panelinin özü DOM listener-lərini burada qurur

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

  // Planşetdə yatmaq üçün toxunma düyməsi (əgər HTML-də varsa)
  const sleepBtn = document.getElementById('sleep-btn');
  if (sleepBtn) {
    sleepBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      attemptSleep();
    }, { passive: false });
  }
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

// ---------- BLOK SINDIRMA / QOYMA + HEYVANA/ZOMBİYƏ VURMA ----------
const raycaster = new THREE.Raycaster();
raycaster.far = 8;
const center = new THREE.Vector2(0, 0);

// Hər blok növü sındırılanda inventara nə düşdüyünü göstərir.
// Xəritədə olmayan blok növü (məs. gələcəkdə əlavə olunan yeni bir tip)
// sındırılanda heç nə düşmür — yeni blok əlavə etsən, bura da bir sətir yaz.
const BLOCK_DROPS = {
  wood: 'wood',
  stone: 'stone',
  coal_ore: 'coal',
  grass: 'dirt', // əsl Minecraft-da olduğu kimi, ot bloku torpaq buraxır
  dirt: 'dirt',
  sand: 'sand',
};

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

// Eyni məntiq, zombi qrupu üçün.
function findZombieRoot(obj) {
  let o = obj;
  while (o) {
    if (o.userData && o.userData.isZombie) return o;
    o = o.parent;
  }
  return null;
}

function doAction(actionType) {
  if (gameOver) return;
  raycaster.setFromCamera(center, camera);

  const blockMeshList = Object.values(instancedMeshes);
  const animalMeshList = animals.map((a) => a.mesh);
  const zombieMeshList = zombies.map((z) => z.mesh);
  const intersects = raycaster.intersectObjects(
    [...blockMeshList, ...animalMeshList, ...zombieMeshList],
    true
  );
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

  // ---- Zombiyə vurma ----
  const zombieRoot = findZombieRoot(hit.object);
  if (zombieRoot) {
    if (actionType === 'break') {
      const record = zombieRoot.userData.zombieRef;
      damageZombie(record, 1);
    }
    return; // zombiyə dəyibsə, blok məntiqinə keçmirik
  }

  // ---- Blok sındırma / qoyma ----
  if (hit.instanceId === undefined || hit.instanceId === null) return;

  const blockType = hit.object.userData.blockType;
  const k = indexToKey[blockType][hit.instanceId];
  if (!k) return;
  const [bx, by, bz] = parseKey(k);

  if (actionType === 'break') {
    removeBlockByKey(k);
    // Blok sındırılanda müvafiq resursu inventara əlavə et
    const dropItem = BLOCK_DROPS[blockType];
    if (dropItem) addToInventory(dropItem, 1);
  } else if (actionType === 'place') {
    const normal = hit.face.normal;
    // Yataq craft edilmiş item olduğu üçün, qoymazdan əvvəl inventarda
    // olub-olmadığını yoxlayırıq; digər bloklar (grass/dirt/stone/wood/sand)
    // əvvəlki kimi limitsizdir.
    if (currentType === 'bed') {
      if (!removeFromInventory('bed', 1)) return;
    }
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

// ---------- GİZLƏNMƏ (BAĞLI SAHƏ) YOXLAMASI ----------
// Sadə həndəsi yoxlama: oyunçunun 4 üfüqi tərəfindən (ayaq VƏ ya baş
// səviyyəsində) divar olmalı, üstündə isə 3 blok məsafədə bir tavan
// olmalıdır. Bu, tam qapalı kiçik bir daxma/otaq daxilində olmaq deməkdir.
function isPlayerSheltered(feet) {
  const fx = Math.round(feet.x);
  const fy = Math.round(feet.y);
  const fz = Math.round(feet.z);

  const hasBlock = (x, y, z) => blocks.has(key(x, y, z));

  let hasRoof = false;
  for (let dy = 1; dy <= 3; dy++) {
    if (hasBlock(fx, fy + dy, fz)) {
      hasRoof = true;
      break;
    }
  }
  if (!hasRoof) return false;

  const dirs = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
  ];
  for (const [dx, dz] of dirs) {
    const wallFeet = hasBlock(fx + dx, fy, fz + dz);
    const wallHead = hasBlock(fx + dx, fy + 1, fz + dz);
    if (!wallFeet && !wallHead) return false; // bu tərəf açıqdır
  }
  return true;
}

// ---------- YATAQ YAXINLIĞI ----------
function isNearBed(feet, radius = 3) {
  for (const [k, info] of blocks) {
    if (info.type !== 'bed') continue;
    const [bx, by, bz] = parseKey(k);
    const dist = Math.hypot(bx - feet.x, by - feet.y, bz - feet.z);
    if (dist <= radius) return true;
  }
  return false;
}

// ---------- MÜVƏQQƏTİ İPUCU MESAJI ----------
let hintTimeout = null;
function showHint(text) {
  const el = document.getElementById('hint');
  if (!el) return;
  el.textContent = text;
  el.classList.remove('hidden');
  clearTimeout(hintTimeout);
  hintTimeout = setTimeout(() => el.classList.add('hidden'), 2500);
}

function attemptSleep() {
  if (gameOver) return;
  if (!isNight()) {
    showHint('Yatmaq üçün gecəni gözlə 🌙');
    return;
  }
  const feet = {
    x: camera.position.x,
    y: camera.position.y - EYE_HEIGHT,
    z: camera.position.z,
  };
  if (!isNearBed(feet)) {
    showHint('Yatmaq üçün yaxınlıqda yataq olmalıdır 🛏️');
    return;
  }
  skipToMorning();
  despawnAllZombies();
  wasNight = false;
  showHint('Gündüz oldu ☀️');
}

document.addEventListener('keydown', (e) => {
  if (e.code === 'KeyB') attemptSleep();
});

// ---------- GÜNDÜZ/GECƏ GÖSTƏRİCİSİ ----------
function updateDayNightIndicator(nightNow) {
  const el = document.getElementById('daynight-indicator');
  if (!el) return;
  el.textContent = nightNow ? '🌙 Gecə' : '☀️ Gündüz';
}

// ---------- GAME OVER ----------
let gameOver = false;

function triggerGameOver() {
  if (gameOver) return;
  gameOver = true;
  if (document.pointerLockElement) document.exitPointerLock();
  const screen = document.getElementById('game-over-screen');
  if (screen) screen.classList.remove('hidden');
}

const restartBtn = document.getElementById('restart-btn');
if (restartBtn) {
  restartBtn.addEventListener('click', () => {
    location.reload();
  });
}

// ---------- ANİMASİYA DÖNGÜSÜ ----------
let wasNight = false;
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1);

  if (!gameOver) {
    updateMovement(dt);
    updateAnimals(dt);
    updateDayNightCycle(dt);

    const nightNow = isNight();
    if (nightNow && !wasNight) {
      // Gecə başladı — oyunçunun ətrafında zombilər peyda olur
      spawnNightZombies(camera.position.x, camera.position.z, 4 + Math.floor(Math.random() * 3));
      showHint('Gecə düşdü... zombilər oyandı 🧟');
    } else if (!nightNow && wasNight) {
      // Gündüz oldu — zombilər yox olur
      despawnAllZombies();
    }
    wasNight = nightNow;
    updateDayNightIndicator(nightNow);

    const feet = {
      x: camera.position.x,
      y: camera.position.y - EYE_HEIGHT,
      z: camera.position.z,
    };
    const sheltered = isPlayerSheltered(feet);
    const caught = updateZombies(dt, feet);
    if (caught && !sheltered) {
      triggerGameOver();
    }
  }

  renderer.render(scene, camera);
}
animate();