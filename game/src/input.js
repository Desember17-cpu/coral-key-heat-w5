// Keyboard and mouse input. Held keys are a set; one-shot actions are a bitmask the game loop
// drains once per frame, so a tap between frames is never lost. The canvas also accepts a
// pointer for aiming and firing while on foot.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_MAP = 8;
export const ACTION_STATS = 16;
export const ACTION_RADIO = 32;
export const ACTION_CREW1 = 64;
export const ACTION_CREW2 = 128;
export const ACTION_CREW3 = 256;
export const ACTION_SHOP = 512;
export const ACTION_SAVE = 1024;

const KEY_ACTIONS = {
  Enter: ACTION_CONFIRM,
  Space: ACTION_CONFIRM,
  Escape: ACTION_PAUSE,
  KeyP: ACTION_PAUSE,
  KeyE: ACTION_ENTER,
  KeyF: ACTION_ENTER,
  KeyM: ACTION_MAP,
  Tab: ACTION_STATS,
  KeyR: ACTION_RADIO,
  KeyZ: ACTION_CREW1,
  KeyX: ACTION_CREW2,
  KeyC: ACTION_CREW3,
  KeyB: ACTION_SHOP,
  F5: ACTION_SAVE,
};

export function createInput(canvas) {
  const held = new Set();
  let pending = 0;
  let pointerX = 0;
  let pointerY = 0;
  let pointerDown = false;

  window.addEventListener('keydown', (event) => {
    if (event.code === 'Tab') event.preventDefault();
    held.add(event.code);
    const action = KEY_ACTIONS[event.code];
    if (action !== undefined && !event.repeat) pending |= action;
    if (event.code.startsWith('Digit')) pending |= 0; // weapon keys read from `held` edges below
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  window.addEventListener('blur', () => {
    held.clear();
    pointerDown = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    pointerX = ((event.clientX - rect.left) / rect.width) * canvas.width;
    pointerY = ((event.clientY - rect.top) / rect.height) * canvas.height;
  });
  canvas.addEventListener('pointerdown', (event) => {
    pointerDown = true;
    pending |= ACTION_CONFIRM;
    const rect = canvas.getBoundingClientRect();
    pointerX = ((event.clientX - rect.left) / rect.width) * canvas.width;
    pointerY = ((event.clientY - rect.top) / rect.height) * canvas.height;
  });
  window.addEventListener('pointerup', () => {
    pointerDown = false;
  });

  let lastWeapon = 0;
  return {
    /** Movement axes in [-1, 1] from WASD / arrows. */
    axes() {
      let x = 0;
      let y = 0;
      if (held.has('KeyA') || held.has('ArrowLeft')) x -= 1;
      if (held.has('KeyD') || held.has('ArrowRight')) x += 1;
      if (held.has('KeyW') || held.has('ArrowUp')) y -= 1;
      if (held.has('KeyS') || held.has('ArrowDown')) y += 1;
      return { x, y };
    },
    sprint() {
      return held.has('ShiftLeft') || held.has('ShiftRight');
    },
    brake() {
      return held.has('Space');
    },
    /** Weapon slot 1..6 when its digit key was newly pressed since the last call. */
    weaponEdge() {
      let slot = 0;
      for (let i = 1; i <= 6; i += 1) {
        if (held.has('Digit' + i)) slot = i;
      }
      const edge = slot !== 0 && slot !== lastWeapon ? slot : 0;
      lastWeapon = slot;
      return edge;
    },
    pointer() {
      return { x: pointerX, y: pointerY, down: pointerDown };
    },
    /** Drain the one-shot action bitmask. */
    takeActions() {
      const out = pending;
      pending = 0;
      return out;
    },
  };
}
