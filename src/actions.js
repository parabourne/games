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
import { getCurrentType, PLACE_REQUIRES, isGameOver } from './controls.js';

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
    // Bütün bloklar inventar tələb edir. Hansı itemin çıxılacağı
    // PLACE_REQUIRES xəritəsindən götürülür (grass -> dirt istisnası
    // daxil olmaqla).
    const currentType = getCurrentType();
    const requiredItem = PLACE_REQUIRES[currentType] || currentType;
    if (!removeFromInventory(requiredItem, 1)) {
      showHint('Kifayət qədər material yoxdur ❌');
      return;
    }
    addBlock(bx + normal.x, by + normal.y, bz + normal.z, currentType);
  }
}

// ---------- GİZLƏNMƏ (BAĞLI SAHƏ) YOXLAMASI ----------
// Sadə həndəsi yoxlama: oyunçunun 4 üfüqi tərəfindən (ayaq VƏ ya baş
// səviyyəsində) divar olmalı, üstündə isə 3 blok məsafədə bir tavan
// olmalıdır. Bu, tam qapalı kiçik bir daxma/otaq daxilində olmaq deməkdir.
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
export function showHint(text) {
  const el = document.getElementById('hint');
  if (!el) return;
  el.textContent = text;
  el.classList.remove('hidden');
  clearTimeout(hintTimeout);
  hintTimeout = setTimeout(() => el.classList.add('hidden'), 2500);
}

// ---------- YATMAQ ----------
// Uğurlu olub-olmadığını qaytarır ki, main.js (animasiya döngüsündəki
// wasNight bayrağını idarə edən) yalnız HƏQİQƏTƏN yatıldıqda müvafiq
// vəziyyəti sıfırlasın.
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