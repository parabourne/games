import { blocks, key } from './world.js';

export const PLAYER_WIDTH = 0.6;
export const PLAYER_HEIGHT = 1.8;

// Kameranın, ayaqların (yerin ÜST SƏTHİ) ilə müqayisədə hündürlüyü.
export const EYE_HEIGHT = 1.2;

const HALF_W = PLAYER_WIDTH / 2;

export function isSolid(x, y, z) {
  const bx = Math.round(x);
  const by = Math.round(y);
  const bz = Math.round(z);
  return blocks.has(key(bx, by, bz));
}

const BODY_OFFSETS = [
  [-HALF_W, -HALF_W],
  [-HALF_W, HALF_W],
  [HALF_W, -HALF_W],
  [HALF_W, HALF_W],
  [0, 0],
];

function collidesAt(feetPos) {
  const { x, y, z } = feetPos;
  const heights = [0.1, PLAYER_HEIGHT / 2, PLAYER_HEIGHT - 0.1];

  for (const h of heights) {
    for (const [ox, oz] of BODY_OFFSETS) {
      if (isSolid(x + ox, y + h, z + oz)) {
        return true;
      }
    }
  }
  return false;
}

// Ayağın bir az aşağısında solid blok varmı? (yerdəyəm sualı)
const GROUND_PROBE = 0.15;

export function isOnGround(feetPos) {
  const { x, y, z } = feetPos;
  const checkY = y - GROUND_PROBE;
  for (const [ox, oz] of BODY_OFFSETS) {
    if (isSolid(x + ox, checkY, z + oz)) {
      return true;
    }
  }
  return false;
}

/**
 * BUG FIX: Sürətli düşmədə (böyük dt/velocity) bir framedə edilən yerdəyişmə
 * çox böyük ola bilər (məs. 0.9-dan 0.1-ə). Əvvəlki kod bunu aşkar edəndə
 * oyunçunu köhnə mövqedə DONDURURDU — bu mövqe real yerdən (blockTop-dan)
 * xeyli yuxarıda qala bilirdi, ona görə "yerdəyəm" yoxlaması bəzən yalan
 * nəticə verir və tullanma işləmirdi.
 *
 * Həll: kolliziya aşkarlananda ikili axtarışla (binary search) DƏQİQ
 * sərhədi tapırıq və oyunçunu HƏMİŞƏ eyni, konkret nöqtəyə "yapışdırırıq" —
 * sürətdən/frame vaxtından asılı olmayaraq.
 */
function resolveY(x, y, z, deltaY) {
  const targetY = y + deltaY;
  if (!collidesAt({ x, y: targetY, z })) {
    return { y: targetY, collided: false };
  }

  // y (kolliziyasız) ilə targetY (kolliziyalı) arasında dəqiq sərhədi tap
  let lo = y;
  let hi = targetY;
  for (let i = 0; i < 15; i++) {
    const mid = (lo + hi) / 2;
    if (collidesAt({ x, y: mid, z })) {
      hi = mid;
    } else {
      lo = mid;
    }
  }
  return { y: lo, collided: true };
}

/**
 * Hərəkəti X, Y, Z oxları üzrə AYRI-AYRI yoxlayıb tətbiq edir (wall-sliding).
 * currentFeet: {x, y, z} — indiki ayaq mövqeyi
 * delta: {x, y, z} — bu framedə edilmək istənən yerdəyişmə
 * qaytarır: { position: {x,y,z}, collided: {x, y, z} }
 */
export function resolveMovement(currentFeet, delta) {
  let { x, y, z } = currentFeet;
  const collided = { x: false, y: false, z: false };

  if (delta.x !== 0) {
    const nx = x + delta.x;
    if (!collidesAt({ x: nx, y, z })) {
      x = nx;
    } else {
      collided.x = true;
    }
  }

  if (delta.z !== 0) {
    const nz = z + delta.z;
    if (!collidesAt({ x, y, z: nz })) {
      z = nz;
    } else {
      collided.z = true;
    }
  }

  if (delta.y !== 0) {
    const result = resolveY(x, y, z, delta.y);
    y = result.y;
    collided.y = result.collided;
  }

  return { position: { x, y, z }, collided };
}