import * as THREE from 'three';

// ---------- SƏHNƏ ----------
export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 40, 130);

export const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
export const DEFAULT_FOV = 75;
camera.position.set(10, 16, 10);

export const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.getElementById('app').appendChild(renderer.domElement);

// ---------- İŞIQ ----------
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const sun = new THREE.DirectionalLight(0xffffff, 0.8);
sun.position.set(30, 40, 15);
sun.castShadow = true;
sun.shadow.camera.left = -40;
sun.shadow.camera.right = 40;
sun.shadow.camera.top = 40;
sun.shadow.camera.bottom = -40;
scene.add(sun);

// ---------- BLOK GEOMETRİYALARI ----------
const boxGeo = new THREE.BoxGeometry(1, 1, 1);

const BED_HEIGHT = 0.55;
const bedGeo = new THREE.BoxGeometry(1, BED_HEIGHT, 1);
bedGeo.translate(0, -(1 - BED_HEIGHT) / 2, 0);

// ---------- BLOK MATERİALLARI ----------
const grassSideMat = new THREE.MeshLambertMaterial({ color: 0x6f9c52 });
const grassTopMat = new THREE.MeshLambertMaterial({ color: 0x4caf50 });
const grassBottomMat = new THREE.MeshLambertMaterial({ color: 0x8b5a2b });
const grassMaterials = [
  grassSideMat, grassSideMat, // +x, -x
  grassTopMat,                // +y (üst)
  grassBottomMat,             // -y (alt)
  grassSideMat, grassSideMat, // +z, -z
];

export const materials = {
  grass: grassMaterials,
  dirt: new THREE.MeshLambertMaterial({ color: 0x8b5a2b }),
  stone: new THREE.MeshLambertMaterial({ color: 0x888888 }),
  coal_ore: new THREE.MeshLambertMaterial({ color: 0x333333 }),
  wood: new THREE.MeshLambertMaterial({ color: 0x6b4423 }),      // Ağac gövdəsi
  leaves: new THREE.MeshLambertMaterial({ color: 0x2e8b57 }),    // ƏLAVƏ EDİLDİ: Yarpaqlar
  sand: new THREE.MeshLambertMaterial({ color: 0xe6d28a }),
  bed: new THREE.MeshLambertMaterial({ color: 0xd9534f }),
};

function geometryFor(type) {
  return type === 'bed' ? bedGeo : boxGeo;
}

// ---------- DÜNYA ÖLÇÜSÜ ----------
export const SIZE = 128;

// ---------- BLOK SİSTEMİ (InstancedMesh) ----------
const capacities = {
  grass: SIZE * SIZE + 1500,
  dirt: SIZE * SIZE + 500,
  stone: SIZE * SIZE + 500,
  coal_ore: 500,
  wood: 3000,   // ƏLAVƏ EDİLDİ: Ağac gövdələri üçün tutum artırıldı
  leaves: 5000, // ƏLAVƏ EDİLDİ: Yarpaqlar üçün tutum
  sand: 2000,
  bed: 200,
};

export const instancedMeshes = {};
const freeList = {};
const usedCount = {};
export const indexToKey = {};
export const blocks = new Map(); // key -> { type, index }
const dummy = new THREE.Object3D();

for (const type of Object.keys(materials)) {
  const cap = capacities[type];
  const mesh = new THREE.InstancedMesh(geometryFor(type), materials[type], cap);
  mesh.count = 0;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.blockType = type;
  mesh.frustumCulled = false;

  scene.add(mesh);
  instancedMeshes[type] = mesh;
  freeList[type] = [];
  usedCount[type] = 0;
  indexToKey[type] = [];
}

export function key(x, y, z) {
  return `${x},${y},${z}`;
}
export function parseKey(k) {
  return k.split(',').map(Number);
}

export function addBlock(x, y, z, type = 'grass') {
  x = Math.round(x); y = Math.round(y); z = Math.round(z);
  const k = key(x, y, z);
  if (blocks.has(k)) return;
  const mesh = instancedMeshes[type];
  if (!mesh) return;

  let index;
  if (freeList[type].length > 0) {
    index = freeList[type].pop();
  } else {
    if (usedCount[type] >= capacities[type]) return;
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

export function removeBlockByKey(k) {
  const info = blocks.get(k);
  if (!info) return;
  const mesh = instancedMeshes[info.type];
  dummy.position.set(0, -1000, 0);
  dummy.updateMatrix();
  mesh.setMatrixAt(info.index, dummy.matrix);
  mesh.instanceMatrix.needsUpdate = true;
  freeList[info.type].push(info.index);
  indexToKey[info.type][info.index] = null;
  blocks.delete(k);
}

// ---------- YER (torpaq) YARAT ----------
const COAL_CHANCE = 0.08;

for (let x = -SIZE / 2; x < SIZE / 2; x++) {
  for (let z = -SIZE / 2; z < SIZE / 2; z++) {
    addBlock(x, 0, z, 'grass');
    addBlock(x, -1, z, 'dirt');
    const stoneType = Math.random() < COAL_CHANCE ? 'coal_ore' : 'stone';
    addBlock(x, -2, z, stoneType);
  }
}
export const GROUND_TOP = 0.5;

// ---------- ƏLAVƏ EDİLDİ: AĞAC GENERASİYASI ----------
function generateTrees() {
  const treeCount = 60; // Xəritədə yaranacaq təsadüfi ağac sayı
  const minDist = 4;    // Ağaclar arasında minimum məsafə

  for (let i = 0; i < treeCount; i++) {
    const x = Math.floor(Math.random() * (SIZE - 20)) - (SIZE / 2 - 10);
    const z = Math.floor(Math.random() * (SIZE - 20)) - (SIZE / 2 - 10);
    
    // Şəhər mərkəzində və ya təsadüfi eyni yerdə ağacların düşməməsi üçün:
    if (Math.abs(x) < 5 && Math.abs(z) < 5) continue;

    const trunkHeight = 4 + Math.floor(Math.random() * 2); // 4-5 blok hündürlükdə gövdə

    // 1. Ağac gövdəsini yarat
    for (let y = 1; y <= trunkHeight; y++) {
      addBlock(x, y, z, 'wood');
    }

    // 2. Yarpaqları yarat (gövdənin yuxarısına baş kəsiyində)
    for (let lx = -2; lx <= 2; lx++) {
      for (let lz = -2; lz <= 2; lz++) {
        for (let ly = trunkHeight - 1; ly <= trunkHeight + 1; ly++) {
          // Bucaqların kəsilməsi (kürəvi/təbii görünüş üçün)
          if (Math.abs(lx) === 2 && Math.abs(lz) === 2 && ly !== trunkHeight) continue;
          
          const targetKey = key(x + lx, ly, z + lz);
          if (!blocks.has(targetKey)) {
            addBlock(x + lx, ly, z + lz, 'leaves');
          }
        }
      }
    }
  }
}

// Dünyanı yaradarkən ağacları da avtomatik generasiya et
generateTrees();

// ---------- DƏNİZ ----------
const waterGeo = new THREE.PlaneGeometry(500, 500);
const waterMat = new THREE.MeshLambertMaterial({
  color: 0x2389da,
  transparent: true,
  opacity: 0.75,
});
const water = new THREE.Mesh(waterGeo, waterMat);
water.rotation.x = -Math.PI / 2;
water.position.y = 0.05;
scene.add(water);

// ---------- GECƏ-GÜNDÜZ DÖVRÜ ----------
export const DAY_LENGTH = 180;
const DAY_FRACTION = 0.7;
const TRANSITION = 0.05;

export let dayTime = DAY_LENGTH * 0.05;
let _isNight = false;

const DAY_SKY = new THREE.Color(0x87ceeb);
const NIGHT_SKY = new THREE.Color(0x0b1026);
const DAY_FOG_NEAR = 40, DAY_FOG_FAR = 130;
const NIGHT_FOG_NEAR = 12, NIGHT_FOG_FAR = 45;
const _mixColor = new THREE.Color();

export function isNight() {
  return _isNight;
}

export function skipToMorning() {
  dayTime = DAY_LENGTH * 0.05;
  applyDayNightVisuals();
  _isNight = false;
}

function applyDayNightVisuals() {
  const t = dayTime / DAY_LENGTH;

  let mix;
  if (t < DAY_FRACTION - TRANSITION) {
    mix = 0;
  } else if (t < DAY_FRACTION + TRANSITION) {
    mix = (t - (DAY_FRACTION - TRANSITION)) / (TRANSITION * 2);
  } else if (t < 1 - TRANSITION) {
    mix = 1;
  } else {
    mix = 1 - (t - (1 - TRANSITION)) / TRANSITION;
  }
  mix = Math.max(0, Math.min(1, mix));

  _mixColor.copy(DAY_SKY).lerp(NIGHT_SKY, mix);
  scene.background = _mixColor.clone();
  scene.fog.color = _mixColor;
  scene.fog.near = DAY_FOG_NEAR + (NIGHT_FOG_NEAR - DAY_FOG_NEAR) * mix;
  scene.fog.far = DAY_FOG_FAR + (NIGHT_FOG_FAR - DAY_FOG_FAR) * mix;

  sun.intensity = 0.8 - 0.65 * mix;
  ambientLight.intensity = 0.6 - 0.45 * mix;
}

export function updateDayNightCycle(dt) {
  dayTime = (dayTime + dt) % DAY_LENGTH;
  const t = dayTime / DAY_LENGTH;
  _isNight = t > DAY_FRACTION;
  applyDayNightVisuals();
}

// ---------- PƏNCƏRƏ ÖLÇÜSÜ ----------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});