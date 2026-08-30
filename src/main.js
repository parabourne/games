import * as THREE from 'three';

// ---------- TOUCH CİHAZ TƏYİNİ ----------
const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
if (isTouchDevice) document.body.classList.add('touch-device');

// ---------- SƏHNƏ ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 40, 130);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const DEFAULT_FOV = 75;
camera.position.set(10, 16, 10);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.getElementById('app').appendChild(renderer.domElement);

// ---------- İŞIQ ----------
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const sun = new THREE.DirectionalLight(0xffffff, 0.8);
sun.position.set(30, 40, 15);
sun.castShadow = true;
sun.shadow.camera.left = -40;
sun.shadow.camera.right = 40;
sun.shadow.camera.top = 40;
sun.shadow.camera.bottom = -40;
scene.add(sun);

// ---------- BLOK MATERİALLARI ----------
const materials = {
  grass: new THREE.MeshLambertMaterial({ color: 0x4caf50 }),
  dirt: new THREE.MeshLambertMaterial({ color: 0x8b5a2b }),
  stone: new THREE.MeshLambertMaterial({ color: 0x888888 }),
  wood: new THREE.MeshLambertMaterial({ color: 0x6b4423 }),
  sand: new THREE.MeshLambertMaterial({ color: 0xe6d28a }),
};

const boxGeo = new THREE.BoxGeometry(1, 1, 1);

// ---------- DÜNYA ÖLÇÜSÜ ----------
const SIZE = 64;

// ---------- BLOK SİSTEMİ (InstancedMesh — performans üçün) ----------
const capacities = {
  grass: SIZE * SIZE + 1500,
  dirt: SIZE * SIZE + 500,
  stone: SIZE * SIZE + 500,
  wood: 2000,
  sand: 2000,
};

const instancedMeshes = {};
const freeList = {};
const usedCount = {};
const indexToKey = {};
const blocks = new Map(); // key -> { type, index }
const dummy = new THREE.Object3D();

for (const type of Object.keys(materials)) {
  const cap = capacities[type];
  const mesh = new THREE.InstancedMesh(boxGeo, materials[type], cap);
  mesh.count = 0;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.blockType = type;
  scene.add(mesh);
  instancedMeshes[type] = mesh;
  freeList[type] = [];
  usedCount[type] = 0;
  indexToKey[type] = [];
}

function key(x, y, z) {
  return `${x},${y},${z}`;
}
function parseKey(k) {
  return k.split(',').map(Number);
}

function addBlock(x, y, z, type = 'grass') {
  x = Math.round(x); y = Math.round(y); z = Math.round(z);
  const k = key(x, y, z);
  if (blocks.has(k)) return;
  const mesh = instancedMeshes[type];
  if (!mesh) return;

  let index;
  if (freeList[type].length > 0) {
    index = freeList[type].pop();
  } else {
    if (usedCount[type] >= capacities[type]) return; // tutum bitib
    index = usedCount[type]++;
  }

  dummy.position.set(x, y, z);
  dummy.updateMatrix();
  mesh.setMatrixAt(index, dummy.matrix);
  mesh.count = Math.max(mesh.count, index + 1);
  mesh.instanceMatrix.needsUpdate = true;

  indexToKey[type][index] = k;
  blocks.set(k, { type, index });
}

function removeBlockByKey(k) {
  const info = blocks.get(k);
  if (!info) return;
  const mesh = instancedMeshes[info.type];
  dummy.position.set(0, -1000, 0); // gözdən uzaqlaşdır
  dummy.updateMatrix();
  mesh.setMatrixAt(info.index, dummy.matrix);
  mesh.instanceMatrix.needsUpdate = true;
  freeList[info.type].push(info.index);
  indexToKey[info.type][info.index] = null;
  blocks.delete(k);
}

// ---------- YER (torpaq) YARAT ----------
for (let x = -SIZE / 2; x < SIZE / 2; x++) {
  for (let z = -SIZE / 2; z < SIZE / 2; z++) {
    addBlock(x, 0, z, 'grass');
    addBlock(x, -1, z, 'dirt');
    addBlock(x, -2, z, 'stone');
  }
}
const GROUND_TOP = 0.5;

// ---------- DƏNİZ ----------
const waterGeo = new THREE.PlaneGeometry(500, 500);
const waterMat = new THREE.MeshLambertMaterial({
  color: 0x2389da,
  transparent: true,
  opacity: 0.75,
});
const water = new THREE.Mesh(waterGeo, waterMat);
water.rotation.x = -Math.PI / 2;
water.position.y = 0.05; // grass səthindən (0.5) bir az aşağı - ada altında görünmür
scene.add(water);

// ---------- HEYVANLAR ----------
function createPig() {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0xf5a9b8 });
  const snoutMat = new THREE.MeshLambertMaterial({ color: 0xe888a0 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.5), bodyMat);
  body.position.y = 0.5;
  body.castShadow = true;
  group.add(body);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), bodyMat);
  head.position.set(0.65, 0.55, 0);
  head.castShadow = true;
  group.add(head);

  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.2, 0.3), snoutMat);
  snout.position.set(0.9, 0.5, 0);
  group.add(snout);

  const legGeo = new THREE.BoxGeometry(0.15, 0.35, 0.15);
  const legPositions = [
    [0.3, 0.17, 0.2], [0.3, 0.17, -0.2],
    [-0.3, 0.17, 0.2], [-0.3, 0.17, -0.2],
  ];
  legPositions.forEach((p) => {
    const leg = new THREE.Mesh(legGeo, bodyMat);
    leg.position.set(...p);
    group.add(leg);
  });

  return group;
}

function createCow() {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x3a2a1a });
  const spotMat = new THREE.MeshLambertMaterial({ color: 0xffffff });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.75, 0.6), bodyMat);
  body.position.y = 0.65;
  body.castShadow = true;
  group.add(body);

  const spot = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.62), spotMat);
  spot.position.set(-0.2, 0.7, 0);
  group.add(spot);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), bodyMat);
  head.position.set(0.75, 0.7, 0);
  head.castShadow = true;
  group.add(head);

  const legGeo = new THREE.BoxGeometry(0.18, 0.45, 0.18);
  const legPositions = [
    [0.35, 0.22, 0.2], [0.35, 0.22, -0.2],
    [-0.35, 0.22, 0.2], [-0.35, 0.22, -0.2],
  ];
  legPositions.forEach((p) => {
    const leg = new THREE.Mesh(legGeo, bodyMat);
    leg.position.set(...p);
    group.add(leg);
  });

  return group;
}

const animals = [];

function spawnAnimal(type, x, z) {
  const mesh = type === 'pig' ? createPig() : createCow();
  mesh.position.set(x, GROUND_TOP, z);
  mesh.rotation.y = Math.random() * Math.PI * 2;
  scene.add(mesh);

  animals.push({
    mesh,
    type,
    state: 'idle',
    stateTimer: Math.random() * 2,
    walkAngle: Math.random() * Math.PI * 2,
  });
}

for (let i = 0; i < 12; i++) {
  const x = (Math.random() - 0.5) * (SIZE - 4);
  const z = (Math.random() - 0.5) * (SIZE - 4);
  spawnAnimal('pig', x, z);
}
for (let i = 0; i < 10; i++) {
  const x = (Math.random() - 0.5) * (SIZE - 4);
  const z = (Math.random() - 0.5) * (SIZE - 4);
  spawnAnimal('cow', x, z);
}

const ANIMAL_SPEED = 1.2;
const WORLD_HALF = SIZE / 2 - 0.6;

function updateAnimals(dt) {
  for (const a of animals) {
    a.stateTimer -= dt;
    if (a.stateTimer <= 0) {
      if (a.state === 'idle') {
        a.state = 'walk';
        a.walkAngle = Math.random() * Math.PI * 2;
        a.stateTimer = 1.5 + Math.random() * 2.5;
      } else {
        a.state = 'idle';
        a.stateTimer = 1 + Math.random() * 2;
      }
    }

    if (a.state === 'walk') {
      const dx = Math.sin(a.walkAngle) * ANIMAL_SPEED * dt;
      const dz = Math.cos(a.walkAngle) * ANIMAL_SPEED * dt;
      let nx = a.mesh.position.x + dx;
      let nz = a.mesh.position.z + dz;

      if (nx > WORLD_HALF || nx < -WORLD_HALF || nz > WORLD_HALF || nz < -WORLD_HALF) {
        a.walkAngle += Math.PI;
      } else {
        a.mesh.position.x = nx;
        a.mesh.position.z = nz;
      }
      a.mesh.rotation.y = -a.walkAngle + Math.PI / 2;
    }

    a.mesh.position.y = GROUND_TOP;
  }
}

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

// ---------- BLOK SINDIRMA / QOYMA ----------
const raycaster = new THREE.Raycaster();
raycaster.far = 8;
const center = new THREE.Vector2(0, 0);

function doAction(actionType) {
  raycaster.setFromCamera(center, camera);
  const meshList = Object.values(instancedMeshes);
  const intersects = raycaster.intersectObjects(meshList);
  if (intersects.length === 0) return;

  const hit = intersects[0];
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

// ---------- PƏNCƏRƏ ÖLÇÜSÜ ----------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

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