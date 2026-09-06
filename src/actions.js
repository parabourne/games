import * as THREE from 'three';
import {
  camera,
  instancedMeshes,
  indexToKey,
  addBlock,
  removeBlockByKey,
  parseKey,
  blocks,
  key,
  isNight,
  skipToMorning,
} from './world.js';
import { animals, damageAnimal } from './animals.js';
import { zombies, despawnAllZombies, damageZombie } from './zombies.js';
import { addToInventory, removeFromInventory } from './inventory.js';
import { EYE_HEIGHT } from './collision.js';
import { getCurrentType, isGameOver } from './controls.js';

// ---------- BLOK SINDIRMA / QOYMA + HEYVANA/ZOMBİYƏ VURMA ----------
const raycaster = new THREE.Raycaster();
raycaster.far = 8;
const center = new THREE.Vector2(0, 0);

const BLOCK_DROPS = {
  wood: 'wood',
  stone: 'stone',
  coal_ore: 'coal',
  grass: 'dirt',
  dirt: 'dirt',
  sand: 'sand',
  crafting_table: 'crafting_table',
};

// Hotbar-dan yalnız BU itemlər blok kimi yerə qoyula bilər. Bunun xaricində
// olan itemlər (meat, coal, tools və s.) qoyula bilməz.
const PLACEABLE_BLOCKS = new Set(['dirt', 'stone', 'wood', 'sand', 'bed', 'crafting_table']);

function findAnimalRoot(obj) {
  let o = obj;
  while (o) {
    if (o.userData && o.userData.isAnimal) return o;
    o = o.parent;
  }
  return null;
}

function findZombieRoot(obj) {
  let o = obj;
  while (o) {
    if (o.userData && o.userData.isZombie) return o;
    o = o.parent;
  }
  return null;
}

export function doAction(actionType) {
  if (isGameOver()) return;
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
        for (const d of drops) {
          const added = addToInventory(d.item, d.count);
          if (!added) showHint('Hotbar dolu — əşya yerdə qaldı 📦');
        }
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
    const dropItem = BLOCK_DROPS[blockType];
    if (dropItem) {
      const added = addToInventory(dropItem, 1);
      if (!added) showHint('Hotbar dolu — əşya yerdə qaldı 📦');
    }
  } else if (actionType === 'place') {
    const normal = hit.face.normal;
    const currentType = getCurrentType();
    if (!currentType) {
      showHint('Seçili slot boşdur');
      return;
    }
    if (!PLACEABLE_BLOCKS.has(currentType)) {
      showHint('Bu əşyanı qoymaq olmaz ❌');
      return;
    }
    if (!removeFromInventory(currentType, 1)) {
      showHint('Kifayət qədər material yoxdur ❌');
      return;
    }
    addBlock(bx + normal.x, by + normal.y, bz + normal.z, currentType);
  }
}

// ---------- GİZLƏNMƏ (BAĞLI SAHƏ) YOXLAMASI ----------
export function isPlayerSheltered(feet) {
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
    if (!wallFeet && !wallHead) return false;
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

// ---------- ƏŞYA YAPMA MASASI YAXINLIĞI ----------
export function isNearCraftingTable(feet, radius = 3) {
  for (const [k, info] of blocks) {
    if (info.type !== 'crafting_table') continue;
    const [bx, by, bz] = parseKey(k);
    const dist = Math.hypot(bx - feet.x, by - feet.y, bz - feet.z);
    if (dist <= radius) return true;
  }
  return false;
}

// ---------- MÜVƏQQƏTİ İPUCU MESAJI ----------
let hintTimeout = null;
export function showHint(text) {
  const el = document.getElementById('hint');
  if (!el) return;
  el.textContent = text;
  el.classList.remove('hidden');
  clearTimeout(hintTimeout);
  hintTimeout = setTimeout(() => el.classList.add('hidden'), 2500);
}

// ---------- YATMAQ ----------
export function attemptSleep() {
  if (isGameOver()) return false;
  if (!isNight()) {
    showHint('Yatmaq üçün gecəni gözlə 🌙');
    return false;
  }
  const feet = {
    x: camera.position.x,
    y: camera.position.y - EYE_HEIGHT,
    z: camera.position.z,
  };
  if (!isNearBed(feet)) {
    showHint('Yatmaq üçün yaxınlıqda yataq olmalıdır 🛏️');
    return false;
  }
  skipToMorning();
  despawnAllZombies();
  showHint('Gündüz oldu ☀️');
  return true;
}