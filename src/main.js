import * as THREE from 'three';
import { scene, camera, renderer, updateDayNightCycle, isNight } from './world.js';
import { updateAnimals } from './animals.js';
import { spawnNightZombies, despawnAllZombies, updateZombies } from './zombies.js';
import { EYE_HEIGHT } from './collision.js';
import { isTouchDevice, updateMovement, isGameOver, setGameOver } from './controls.js';
import { doAction, isPlayerSheltered, attemptSleep } from './actions.js';
import './craft.js'; // craft panelinin özü DOM listener-lərini burada qurur

// ---------- MASAÜSTÜ: SIÇAN İLƏ SINDIR / QOY ----------
if (!isTouchDevice) {
  renderer.domElement.addEventListener('mousedown', (e) => {
    if (document.pointerLockElement !== renderer.domElement) return;
    if (e.button === 0) doAction('break');
    else if (e.button === 2) doAction('place');
  });
  renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
}

// ---------- TOXUNMA: SINDIR / QOY / YAT DÜYMƏLƏRİ ----------
// Bu düymələr həm controls.js-in qurduğu toxunma zonasına (joystick,
// look-zone), həm də actions.js-in doAction/attemptSleep funksiyalarına
// ehtiyac duyduğu üçün burada, main.js-də bir yerə yığılıb.
if (isTouchDevice) {
  document.getElementById('break-btn').addEventListener('touchstart', (e) => {
    e.preventDefault();
    doAction('break');
  }, { passive: false });

  document.getElementById('place-btn').addEventListener('touchstart', (e) => {
    e.preventDefault();
    doAction('place');
  }, { passive: false });

  // Planşetdə yatmaq üçün toxunma düyməsi (əgər HTML-də varsa)
  const sleepBtn = document.getElementById('sleep-btn');
  if (sleepBtn) {
    sleepBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (attemptSleep()) wasNight = false;
    }, { passive: false });
  }
}

document.addEventListener('keydown', (e) => {
  if (e.code === 'KeyB') {
    if (attemptSleep()) wasNight = false;
  }
});

// ---------- GÜNDÜZ/GECƏ GÖSTƏRİCİSİ ----------
function updateDayNightIndicator(nightNow) {
  const el = document.getElementById('daynight-indicator');
  if (!el) return;
  el.textContent = nightNow ? '🌙 Gecə' : '☀️ Gündüz';
}

// ---------- GAME OVER ----------
function triggerGameOver() {
  if (isGameOver()) return;
  setGameOver(true);
  if (document.pointerLockElement) document.exitPointerLock();
  const screen = document.getElementById('game-over-screen');
  if (screen) screen.classList.remove('hidden');
}

const restartBtn = document.getElementById('restart-btn');
if (restartBtn) {
  restartBtn.addEventListener('click', () => {
    location.reload();
  });
}

// ---------- ANİMASİYA DÖNGÜSÜ ----------
let wasNight = false;
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1);

  if (!isGameOver()) {
    updateMovement(dt);
    updateAnimals(dt);
    updateDayNightCycle(dt);

    const nightNow = isNight();
    if (nightNow && !wasNight) {
      // Gecə başladı — oyunçunun ətrafında zombilər peyda olur
      spawnNightZombies(camera.position.x, camera.position.z, 4 + Math.floor(Math.random() * 3));
      showHintOnNightStart();
    } else if (!nightNow && wasNight) {
      // Gündüz oldu — zombilər yox olur
      despawnAllZombies();
    }
    wasNight = nightNow;
    updateDayNightIndicator(nightNow);

    const feet = {
      x: camera.position.x,
      y: camera.position.y - EYE_HEIGHT,
      z: camera.position.z,
    };
    const sheltered = isPlayerSheltered(feet);
    const caught = updateZombies(dt, feet);
    if (caught && !sheltered) {
      triggerGameOver();
    }
  }

  renderer.render(scene, camera);
}

// showHint actions.js-dədir, amma gecə başlanğıcı mesajı yalnız burada
// lazımdır — ona görə kiçik bir bələdçi funksiya vasitəsilə çağırırıq.
import { showHint } from './actions.js';
function showHintOnNightStart() {
  showHint('Gecə düşdü... zombilər oyandı 🧟');
}

animate();