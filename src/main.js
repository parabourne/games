import * as THREE from 'three';

// ---------- SƏHNƏ ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 20, 60);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const DEFAULT_FOV = 75;
camera.position.set(8, 10, 8);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.getElementById('app').appendChild(renderer.domElement);

// ---------- İŞIQ ----------
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const sun = new THREE.DirectionalLight(0xffffff, 0.8);
sun.position.set(20, 30, 10);
sun.castShadow = true;
sun.shadow.camera.left = -30;
sun.shadow.camera.right = 30;
sun.shadow.camera.top = 30;
sun.shadow.camera.bottom = -30;
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
const blocks = new Map();

function key(x, y, z) {
  return `${x},${y},${z}`;
}

function addBlock(x, y, z, type = 'grass') {
  x = Math.round(x); y = Math.round(y); z = Math.round(z);
  const k = key(x, y, z);
  if (blocks.has(k)) return;
  const mesh = new THREE.Mesh(boxGeo, materials[type]);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  blocks.set(k, mesh);
}

function removeBlock(mesh) {
  const k = key(mesh.position.x, mesh.position.y, mesh.position.z);
  blocks.delete(k);
  scene.remove(mesh);
}

// ---------- DÜNYA ----------
const SIZE = 16;
for (let x = -SIZE / 2; x < SIZE / 2; x++) {
  for (let z = -SIZE / 2; z < SIZE / 2; z++) {
    addBlock(x, 0, z, 'grass');
    addBlock(x, -1, z, 'dirt');
    addBlock(x, -2, z, 'stone');
  }
}

// ---------- HOTBAR / İNVENTAR ----------
let currentType = 'grass';
const slots = document.querySelectorAll('.slot');
slots.forEach((slot) => {
  slot.addEventListener('click', () => selectSlot(slot));
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

// ---------- POINTER LOCK ----------
let yaw = 0, pitch = 0;
const PI_2 = Math.PI / 2;

renderer.domElement.addEventListener('click', () => {
  renderer.domElement.requestPointerLock();
});

document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== renderer.domElement) return;
  yaw -= e.movementX * 0.002;
  pitch -= e.movementY * 0.002;
  pitch = Math.max(-PI_2, Math.min(PI_2, pitch));
});

// ---------- ZOOM (siçan təkəri) ----------
document.addEventListener('wheel', (e) => {
  if (document.pointerLockElement !== renderer.domElement) return;
  camera.fov += e.deltaY * 0.02;
  camera.fov = Math.max(20, Math.min(DEFAULT_FOV, camera.fov));
  camera.updateProjectionMatrix();
});

// ---------- HƏRƏKƏT ----------
const keys = {};
document.addEventListener('keydown', (e) => (keys[e.code] = true));
document.addEventListener('keyup', (e) => (keys[e.code] = false));

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
  if (move.lengthSq() > 0) move.normalize().multiplyScalar(MOVE_SPEED);

  velocity.x = move.x;
  velocity.z = move.z;
  velocity.y += GRAVITY * dt;

  if (keys['Space'] && canJump) {
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

renderer.domElement.addEventListener('mousedown', (e) => {
  if (document.pointerLockElement !== renderer.domElement) return;

  raycaster.setFromCamera(center, camera);
  const intersects = raycaster.intersectObjects([...blocks.values()]);
  if (intersects.length === 0) return;

  const hit = intersects[0];

  if (e.button === 0) {
    removeBlock(hit.object);
  } else if (e.button === 2) {
    const normal = hit.face.normal;
    const pos = hit.object.position.clone().add(normal);
    addBlock(pos.x, pos.y, pos.z, currentType);
  }
});

renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

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
  renderer.render(scene, camera);
}
animate();