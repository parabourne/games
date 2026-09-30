import * as THREE from 'three';
import { scene, SIZE, WATER_LEVEL, getSurfaceY, isSolid } from './world.js';

// ---------- HEYVANLAR ----------
// Qeyd: hər heyvan qrupunun mənşəyi (origin) AYAQLARIN ALTINDADIR (y = 0),
// ona görə mesh.position.y birbaşa yerin səth hündürlüyünə bərabər qoyulur.
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

function createSheep() {
  const group = new THREE.Group();
  const woolMat = new THREE.MeshLambertMaterial({ color: 0xf5f5f0 });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x3a3a3a });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.55, 0.5), woolMat);
  body.position.y = 0.5;
  body.castShadow = true;
  group.add(body);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), darkMat);
  head.position.set(0.55, 0.55, 0);
  head.castShadow = true;
  group.add(head);

  const legGeo = new THREE.BoxGeometry(0.13, 0.3, 0.13);
  const legPositions = [
    [0.28, 0.15, 0.18], [0.28, 0.15, -0.18],
    [-0.28, 0.15, 0.18], [-0.28, 0.15, -0.18],
  ];
  legPositions.forEach((p) => {
    const leg = new THREE.Mesh(legGeo, darkMat);
    leg.position.set(...p);
    group.add(leg);
  });

  return group;
}

const BUILDERS = { pig: createPig, cow: createCow, sheep: createSheep };

// ---------- CAN VƏ DROP CƏDVƏLİ ----------
const HEALTH = { pig: 3, cow: 4, sheep: 2 };

const DROPS = {
  pig: [{ item: 'meat', min: 1, max: 2 }],
  cow: [
    { item: 'meat', min: 1, max: 3 },
    { item: 'leather', min: 0, max: 1 },
  ],
  sheep: [{ item: 'wool', min: 1, max: 2 }],
};

function rollDrops(type) {
  const table = DROPS[type] || [];
  const drops = [];
  for (const d of table) {
    const count = Math.floor(Math.random() * (d.max - d.min + 1)) + d.min;
    if (count > 0) drops.push({ item: d.item, count });
  }
  return drops;
}

export const animals = [];

// ---------- YER HÜNDÜRLÜYÜ QAYDALARI ----------
const MAX_STEP_UP = 1.01;   // heyvan maksimum 1 blok yuxarı çıxa bilər
const MAX_STEP_DOWN = 3;    // 3 blokdan dərin çuxura getmir
const GRAVITY = 20;

// Nöqtə heyvan üçün yararlıdırmı (su deyil, boşluq deyil)?
function isWalkableGround(groundY) {
  return groundY !== null && groundY >= WATER_LEVEL + 0.5;
}

// YENİ: Spawn artıq real səth hündürlüyündən istifadə edir.
// Uyğun yer tapılmasa (su/boşluq) false qaytarır.
function spawnAnimal(type, x, z) {
  const groundY = getSurfaceY(x, z);
  if (!isWalkableGround(groundY)) return false;

  const builder = BUILDERS[type] || createPig;
  const mesh = builder();
  mesh.position.set(x, groundY, z);
  mesh.rotation.y = Math.random() * Math.PI * 2;
  mesh.userData.isAnimal = true;
  scene.add(mesh);

  const record = {
    mesh,
    type,
    health: HEALTH[type] ?? 3,
    state: 'idle',
    stateTimer: Math.random() * 2,
    walkAngle: Math.random() * Math.PI * 2,
    vy: 0,
  };
  mesh.userData.animalRef = record;

  animals.push(record);
  return true;
}

function randomSpawnPos() {
  const x = (Math.random() - 0.5) * (SIZE - 4);
  const z = (Math.random() - 0.5) * (SIZE - 4);
  return { x, z };
}

// Uyğun yer tapana qədər bir neçə dəfə cəhd edir.
function spawnAnimalSomewhere(type, attempts = 30) {
  for (let i = 0; i < attempts; i++) {
    const { x, z } = randomSpawnPos();
    if (spawnAnimal(type, x, z)) return true;
  }
  return false;
}

// ---------- İLK POPULYASİYA ----------
const TARGET_COUNTS = { pig: 12, cow: 10, sheep: 10 };

for (const [type, count] of Object.entries(TARGET_COUNTS)) {
  for (let i = 0; i < count; i++) {
    spawnAnimalSomewhere(type);
  }
}

const ANIMAL_SPEED = 1.2;
const WORLD_HALF = SIZE / 2 - 0.6;

// ---------- HEYVAN RESPAWN (BƏRPA) SİSTEMİ ----------
const RESPAWN_INTERVAL = 8; // saniyə
let respawnTimer = RESPAWN_INTERVAL;

function tryRespawn() {
  for (const [type, target] of Object.entries(TARGET_COUNTS)) {
    const current = animals.filter((a) => a.type === type).length;
    if (current < target) {
      spawnAnimalSomewhere(type);
      break; // hər çağırışda maksimum 1 heyvan
    }
  }
}

export function updateAnimals(dt) {
  respawnTimer -= dt;
  if (respawnTimer <= 0) {
    respawnTimer = RESPAWN_INTERVAL;
    tryRespawn();
  }

  for (const a of animals) {
    const p = a.mesh.position;

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
      const nx = p.x + Math.sin(a.walkAngle) * ANIMAL_SPEED * dt;
      const nz = p.z + Math.cos(a.walkAngle) * ANIMAL_SPEED * dt;

      let blocked = false;

      if (nx > WORLD_HALF || nx < -WORLD_HALF || nz > WORLD_HALF || nz < -WORLD_HALF) {
        blocked = true;
      } else {
        // Hədəf nöqtənin yerini yoxla (cari hündürlükdən 1.5 yuxarıdan başla)
        const targetY = getSurfaceY(nx, nz, p.y + 1.5);

        if (!isWalkableGround(targetY)) {
          blocked = true;                                  // su və ya boşluq
        } else if (targetY - p.y > MAX_STEP_UP) {
          blocked = true;                                  // çox hündür divar
        } else if (p.y - targetY > MAX_STEP_DOWN) {
          blocked = true;                                  // çox dərin çuxur
        } else if (isSolid(nx, targetY + 0.5, nz)) {
          blocked = true;                                  // ağac gövdəsi / yarpaq
        }
      }

      if (blocked) {
        a.walkAngle += Math.PI / 2 + Math.random() * Math.PI; // başqa istiqamətə dön
      } else {
        p.x = nx;
        p.z = nz;
      }
      a.mesh.rotation.y = -a.walkAngle + Math.PI / 2;
    }

    // ---------- YENİ: Həqiqi yerə oturma (cazibə + pilləkən) ----------
    const groundY = getSurfaceY(p.x, p.z, p.y + 1.5);
    if (groundY !== null) {
      if (p.y > groundY + 0.001) {
        // Havadadır (məs. altındakı blok qırılıb) -> düşür
        a.vy -= GRAVITY * dt;
        p.y = Math.max(groundY, p.y + a.vy * dt);
        if (p.y === groundY) a.vy = 0;
      } else {
        // Yer yuxarıdadır (pillə) -> hamar qalxır
        a.vy = 0;
        const diff = groundY - p.y;
        p.y = diff < 0.05 ? groundY : p.y + diff * Math.min(1, dt * 15);
      }
    }
  }
}

// ---------- HEYVANA ZƏRBƏ ----------
export function damageAnimal(record, amount = 1) {
  record.health -= amount;
  if (record.health > 0) return null;

  scene.remove(record.mesh);
  const idx = animals.indexOf(record);
  if (idx !== -1) animals.splice(idx, 1);

  return rollDrops(record.type);
}