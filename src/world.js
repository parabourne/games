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
  // Craft edilən yataq — sadəlik üçün tək-blok rəngli kub kimi göstərilir
  // (əsl Minecraft-dakı 2-hissəli yataq modeli deyil)
  bed: new THREE.MeshLambertMaterial({ color: 0xd9534f }),
};

const boxGeo = new THREE.BoxGeometry(1, 1, 1);

// ---------- DÜNYA ÖLÇÜSÜ ----------
export const SIZE = 64;

// ---------- BLOK SİSTEMİ (InstancedMesh — performans üçün) ----------
const capacities = {
  grass: SIZE * SIZE + 1500,
  dirt: SIZE * SIZE + 500,
  stone: SIZE * SIZE + 500,
  wood: 2000,
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
  const mesh = new THREE.InstancedMesh(boxGeo, materials[type], cap);
  mesh.count = 0;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.blockType = type;

  // ---- BUG FIX: frustum culling ----
  // InstancedMesh-in default bounding sphere-i yalnız geometriyanın öz
  // (kiçik, mərkəzdəki) radiusunu əhatə edir — bütün instansların əhatə
  // etdiyi sahəni YOX. Nəticədə kamera müəyyən bucaqda olanda Three.js
  // bütün mesh-i (yəni bütün həmin tipdəki blokları) səhvən "görüş
  // sahəsindən kənarda" hesab edib render etmirdi — "blok bəzən
  // görünmür" bug-ının əsl səbəbi budur.
  // Dünya nisbətən kiçik olduğu üçün ən sadə və etibarlı həll: bu
  // mesh üçün frustum culling-i tamamilə deaktiv etmək.
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

export function removeBlockByKey(k) {
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
export const GROUND_TOP = 0.5;

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

// ---------- PƏNCƏRƏ ÖLÇÜSÜ ----------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});