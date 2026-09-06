import * as THREE from 'three';

// ---------- SƏHNƏ ----------
export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 40, 130);

export const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
export const DEFAULT_FOV = 75;
camera.position.set(0, 25, 0); // Oyunçunun başlanğıc mövqeyi yuxarı qaldırıldı

export const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.getElementById('app').appendChild(renderer.domElement);

// ---------- İŞIQ ----------
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const sun = new THREE.DirectionalLight(0xffffff, 0.8);
sun.position.set(30, 50, 15);
sun.castShadow = true;
sun.shadow.camera.left = -60;
sun.shadow.camera.right = 60;
sun.shadow.camera.top = 60;
sun.shadow.camera.bottom = -60;
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
  grassSideMat, grassSideMat,
  grassTopMat, grassBottomMat,
  grassSideMat, grassSideMat,
];

export const materials = {
  grass: grassMaterials,
  dirt: new THREE.MeshLambertMaterial({ color: 0x8b5a2b }),
  stone: new THREE.MeshLambertMaterial({ color: 0x888888 }),
  coal_ore: new THREE.MeshLambertMaterial({ color: 0x333333 }),
  wood: new THREE.MeshLambertMaterial({ color: 0x6b4423 }),
  leaves: new THREE.MeshLambertMaterial({ color: 0x2e8b57 }),
  sand: new THREE.MeshLambertMaterial({ color: 0xe6d28a }),
  bed: new THREE.MeshLambertMaterial({ color: 0xd9534f }),
  crafting_table: new THREE.MeshLambertMaterial({ color: 0x7a5230 }),
};

function geometryFor(type) {
  return type === 'bed' ? bedGeo : boxGeo;
}

// ---------- DÜNYA ÖLÇÜSÜ ----------
export const SIZE = 128;

// ---------- BLOK SİSTEMİ (InstancedMesh) ----------
const capacities = {
  grass: SIZE * SIZE * 2,
  dirt: SIZE * SIZE * 4,
  stone: SIZE * SIZE * 8,
  coal_ore: 1200,
  wood: 4000,
  leaves: 8000,
  sand: SIZE * SIZE,
  bed: 200,
  crafting_table: 200,
};

export const instancedMeshes = {};
const freeList = {};
const usedCount = {};
export const indexToKey = {};
export const blocks = new Map();
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

export function key(x, y, z) { return `${x},${y},${z}`; }
export function parseKey(k) { return k.split(',').map(Number); }

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

// ---------- DAĞLAR VƏ RELİYEF GENERASİYASI ----------
// Sadə dalğa alqoritmi vasitəsilə dağlar/vadilər hesablanır
function getTerrainHeight(x, z) {
  const scale1 = 0.03;
  const scale2 = 0.08;
  
  const wave1 = Math.sin(x * scale1) * Math.cos(z * scale1) * 8;
  const wave2 = Math.sin(x * scale2 + 1.5) * Math.cos(z * scale2 + 1.5) * 4;
  const wave3 = Math.sin((x + z) * 0.02) * 6;

  // Hündürlüyü 2 ilə 18 blok arasında təyin edirik
  return Math.floor(wave1 + wave2 + wave3 + 6);
}

const COAL_CHANCE = 0.08;
const WATER_LEVEL = 2; // Su səviyyəsi

// Dünyanı yaratmaq
for (let x = -SIZE / 2; x < SIZE / 2; x++) {
  for (let z = -SIZE / 2; z < SIZE / 2; z++) {
    const height = getTerrainHeight(x, z);

    // Ən üst blok növü (Hündürlüyə görə dəyişir)
    let topBlock = 'grass';
    if (height <= WATER_LEVEL + 1) {
      topBlock = 'sand'; // Suya yaxın yerlər qumluqdur
    } else if (height > 12) {
      topBlock = 'stone'; // Çox uca dağ zirvələri daşlıqdır
    }

    // Ən üst blok
    addBlock(x, height, z, topBlock);

    // Torpaq təbəqəsi (Altındakı 2-3 blok)
    for (let y = height - 1; y >= height - 3; y--) {
      const subType = (topBlock === 'stone') ? 'stone' : 'dirt';
      addBlock(x, y, z, subType);
    }

    // Dərinliklər (Daşlar və Kömür filizləri)
    for (let y = height - 4; y >= -4; y--) {
      const stoneType = Math.random() < COAL_CHANCE ? 'coal_ore' : 'stone';
      addBlock(x, y, z, stoneType);
    }
  }
}

// ---------- AĞACLARI DAĞLARA UYĞUN OLARAQ EKMƏK ----------
function generateTrees() {
  const treeCount = 70;

  for (let i = 0; i < treeCount; i++) {
    const x = Math.floor(Math.random() * (SIZE - 20)) - (SIZE / 2 - 10);
    const z = Math.floor(Math.random() * (SIZE - 20)) - (SIZE / 2 - 10);
    const groundHeight = getTerrainHeight(x, z);

    // Ağaclar yalnız otluqda bitir (suda/qumda və dağ zirvələrində bitmir)
    if (groundHeight <= WATER_LEVEL + 1 || groundHeight > 12) continue;

    const trunkHeight = 4 + Math.floor(Math.random() * 2);

    // Gövdə
    for (let y = 1; y <= trunkHeight; y++) {
      addBlock(x, groundHeight + y, z, 'wood');
    }

    // Yarpaqlar
    for (let lx = -2; lx <= 2; lx++) {
      for (let lz = -2; lz <= 2; lz++) {
        for (let ly = trunkHeight - 1; ly <= trunkHeight + 1; ly++) {
          if (Math.abs(lx) === 2 && Math.abs(lz) === 2 && ly !== trunkHeight) continue;
          
          const leafY = groundHeight + ly;
          const targetKey = key(x + lx, leafY, z + lz);
          if (!blocks.has(targetKey)) {
            addBlock(x + lx, leafY, z + lz, 'leaves');
          }
        }
      }
    }
  }
}

generateTrees();

// ---------- DƏNİZ ----------
const waterGeo = new THREE.PlaneGeometry(SIZE * 2, SIZE * 2);
const waterMat = new THREE.MeshLambertMaterial({
  color: 0x2389da,
  transparent: true,
  opacity: 0.7,
});
const water = new THREE.Mesh(waterGeo, waterMat);
water.rotation.x = -Math.PI / 2;
water.position.y = WATER_LEVEL + 0.4;
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

export function isNight() { return _isNight; }

export function skipToMorning() {
  dayTime = DAY_LENGTH * 0.05;
  applyDayNightVisuals();
  _isNight = false;
}

function applyDayNightVisuals() {
  const t = dayTime / DAY_LENGTH;
  let mix;
  if (t < DAY_FRACTION - TRANSITION) { mix = 0; }
  else if (t < DAY_FRACTION + TRANSITION) { mix = (t - (DAY_FRACTION - TRANSITION)) / (TRANSITION * 2); }
  else if (t < 1 - TRANSITION) { mix = 1; }
  else { mix = 1 - (t - (1 - TRANSITION)) / TRANSITION; }
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

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});