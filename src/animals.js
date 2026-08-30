import * as THREE from 'three';
import { scene, GROUND_TOP, SIZE } from './world.js';

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

// ---------- YENİ: QOYUN ----------
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

// hər item üçün { item, min, max } - ölüncə bu aralıqda təsadüfi say düşür
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

function spawnAnimal(type, x, z) {
  const builder = BUILDERS[type] || createPig;
  const mesh = builder();
  mesh.position.set(x, GROUND_TOP, z);
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
  };
  // Raycast heyvana dəyəndə mesh-dən birbaşa record-a çatmaq üçün:
  mesh.userData.animalRef = record;

  animals.push(record);
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
for (let i = 0; i < 10; i++) {
  const x = (Math.random() - 0.5) * (SIZE - 4);
  const z = (Math.random() - 0.5) * (SIZE - 4);
  spawnAnimal('sheep', x, z);
}

const ANIMAL_SPEED = 1.2;
const WORLD_HALF = SIZE / 2 - 0.6;

export function updateAnimals(dt) {
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

// ---------- YENİ: HEYVANA ZƏRBƏ ----------
// record: animals[] içindəki obyekt, amount: neçə can azalsın
// Qayıdış: heyvan ölübsə drop siyahısı ([{item, count}]), yox əgər sağdırsa null
export function damageAnimal(record, amount = 1) {
  record.health -= amount;
  if (record.health > 0) return null;

  scene.remove(record.mesh);
  const idx = animals.indexOf(record);
  if (idx !== -1) animals.splice(idx, 1);

  return rollDrops(record.type);
}