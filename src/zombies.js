import * as THREE from 'three';
import { scene } from './world.js';

// ---------- TƏNZİMLƏMƏLƏR ----------
const ZOMBIE_SPEED = 2.0;
const ZOMBIE_DETECT_RADIUS = 16; // bu məsafədən yaxın olan oyunçunu "hiss edir"
const ZOMBIE_KILL_RADIUS = 1.0; // bu məsafəyə çatanda oyunçunu tutur
const ZOMBIE_HEALTH = 3;
const MAX_ZOMBIES = 10;
const SPAWN_RADIUS_MIN = 16;
const SPAWN_RADIUS_MAX = 28;

export const zombies = [];

// ---------- GÖRÜNÜŞ ----------
const bodyMat = new THREE.MeshLambertMaterial({ color: 0x3b5e3b });
const headMat = new THREE.MeshLambertMaterial({ color: 0x577d57 });

function buildZombieMesh() {
  const group = new THREE.Group();

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.35), bodyMat);
  body.position.y = 0.9;
  group.add(body);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), headMat);
  head.position.y = 1.6;
  group.add(head);

  const legGeo = new THREE.BoxGeometry(0.22, 0.7, 0.22);
  const legL = new THREE.Mesh(legGeo, bodyMat);
  legL.position.set(-0.15, 0.35, 0);
  const legR = new THREE.Mesh(legGeo, bodyMat);
  legR.position.set(0.15, 0.35, 0);
  group.add(legL, legR);

  const armGeo = new THREE.BoxGeometry(0.18, 0.7, 0.18);
  const armL = new THREE.Mesh(armGeo, bodyMat);
  armL.position.set(-0.42, 0.9, 0);
  const armR = new THREE.Mesh(armGeo, bodyMat);
  armR.position.set(0.42, 0.9, 0);
  group.add(armL, armR);

  group.traverse((obj) => {
    obj.castShadow = true;
  });
  group.userData.isZombie = true;
  return group;
}

// ---------- YARATMA / SİLMƏ ----------
export function spawnZombie(centerX, centerZ) {
  if (zombies.length >= MAX_ZOMBIES) return;

  const angle = Math.random() * Math.PI * 2;
  const dist = SPAWN_RADIUS_MIN + Math.random() * (SPAWN_RADIUS_MAX - SPAWN_RADIUS_MIN);
  const x = centerX + Math.cos(angle) * dist;
  const z = centerZ + Math.sin(angle) * dist;

  const mesh = buildZombieMesh();
  mesh.position.set(x, 0, z);
  scene.add(mesh);

  const record = { mesh, health: ZOMBIE_HEALTH };
  mesh.userData.zombieRef = record;
  zombies.push(record);
}

export function spawnNightZombies(centerX, centerZ, count = 4) {
  for (let i = 0; i < count; i++) spawnZombie(centerX, centerZ);
}

export function despawnAllZombies() {
  for (const z of zombies) scene.remove(z.mesh);
  zombies.length = 0;
}

// Qaytarır: zombi öldürülübsə true
export function damageZombie(record, amount = 1) {
  record.health -= amount;
  if (record.health <= 0) {
    scene.remove(record.mesh);
    const idx = zombies.indexOf(record);
    if (idx !== -1) zombies.splice(idx, 1);
    return true;
  }
  return false;
}

// ---------- HƏRƏKƏT / TUTMA ----------
// Hər frame-də bütün zombiləri oyunçuya doğru hərəkət etdirir.
// playerFeet: { x, y, z }. Qaytarır: oyunçunu tutan zombi varmı (true/false).
export function updateZombies(dt, playerFeet, killRadius = ZOMBIE_KILL_RADIUS) {
  let playerCaught = false;

  for (const z of zombies) {
    const dx = playerFeet.x - z.mesh.position.x;
    const dz = playerFeet.z - z.mesh.position.z;
    const dist = Math.hypot(dx, dz);

    if (dist > 0.001 && dist < ZOMBIE_DETECT_RADIUS) {
      const nx = dx / dist;
      const nz = dz / dist;
      z.mesh.position.x += nx * ZOMBIE_SPEED * dt;
      z.mesh.position.z += nz * ZOMBIE_SPEED * dt;
      z.mesh.rotation.y = Math.atan2(nx, nz);
    }

    if (dist < killRadius) playerCaught = true;
  }

  return playerCaught;
}