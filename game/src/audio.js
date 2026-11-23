// Procedural WebAudio: no samples, everything is oscillators and filtered noise. The engine is
// a sawtooth whose pitch follows the car's speed, the siren is two detuned triangles sweeping
// against each other, gunfire is a noise burst through a low-pass, and the radio plays a slow
// bass figure per station. All of it is best-effort: if the browser has no AudioContext the
// game simply runs silent.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOscA = null;
  let sirenOscB = null;
  let sirenGain = null;
  let radioTimer = 0;
  let radioStep = 0;
  let station = 0;
  let muted = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    gain.gain.setValueAtTime(vol || 0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, vol, cutoff) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff || 1800;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t);
  }

  return {
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume();
    },
    setMuted(value) {
      muted = value;
    },
    ui() {
      blip(660, 0.07, 'square', 0.08, 880);
    },
    confirm() {
      blip(520, 0.09, 'square', 0.1, 780);
      setTimeout(() => blip(780, 0.12, 'square', 0.09, 1040), 60);
    },
    deny() {
      blip(180, 0.16, 'sawtooth', 0.1, 120);
    },
    cash() {
      blip(990, 0.08, 'triangle', 0.14, 1320);
      setTimeout(() => blip(1320, 0.14, 'triangle', 0.12, 1760), 70);
    },
    shot() {
      noise(0.09, 0.22, 2600);
      blip(140, 0.08, 'sawtooth', 0.1, 60);
    },
    hit() {
      noise(0.05, 0.12, 900);
    },
    crash(intensity) {
      noise(0.22, Math.min(0.4, 0.12 + intensity * 0.3), 700);
      blip(90, 0.2, 'sawtooth', 0.12, 40);
    },
    splash() {
      noise(0.4, 0.16, 500);
    },
    pickup() {
      blip(740, 0.07, 'sine', 0.14, 1180);
    },
    missionPass() {
      const notes = [523, 659, 784, 1046];
      notes.forEach((n, i) => setTimeout(() => blip(n, 0.22, 'triangle', 0.13), i * 95));
    },
    missionFail() {
      const notes = [392, 330, 262];
      notes.forEach((n, i) => setTimeout(() => blip(n, 0.24, 'triangle', 0.12), i * 120));
    },
    starUp() {
      blip(1180, 0.1, 'square', 0.1, 1180);
      setTimeout(() => blip(1180, 0.1, 'square', 0.1), 140);
    },
    /** Continuous engine hum; call every frame with speed 0..1 and whether a car is driven. */
    engine(speed, active) {
      if (!ensure()) return;
      if (active && !engineOsc) {
        engineOsc = ctx.createOscillator();
        engineGain = ctx.createGain();
        engineOsc.type = 'sawtooth';
        engineGain.gain.value = 0.0;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 420;
        engineOsc.connect(filter);
        filter.connect(engineGain);
        engineGain.connect(master);
        engineOsc.start();
      }
      if (engineOsc) {
        const target = active ? 0.05 + speed * 0.05 : 0.0;
        engineGain.gain.setTargetAtTime(muted ? 0 : target, ctx.currentTime, 0.08);
        engineOsc.frequency.setTargetAtTime(55 + speed * 165, ctx.currentTime, 0.05);
      }
    },
    /** Continuous patrol siren; level follows the nearest unit's distance. */
    siren(level) {
      if (!ensure()) return;
      if (level > 0.01 && !sirenOscA) {
        sirenOscA = ctx.createOscillator();
        sirenOscB = ctx.createOscillator();
        sirenGain = ctx.createGain();
        sirenOscA.type = 'triangle';
        sirenOscB.type = 'triangle';
        sirenGain.gain.value = 0;
        sirenOscA.connect(sirenGain);
        sirenOscB.connect(sirenGain);
        sirenGain.connect(master);
        sirenOscA.start();
        sirenOscB.start();
      }
      if (sirenOscA) {
        const t = ctx.currentTime;
        const sweep = 620 + Math.sin(t * 2.4) * 180;
        sirenOscA.frequency.setTargetAtTime(sweep, t, 0.03);
        sirenOscB.frequency.setTargetAtTime(sweep * 1.007 + 30, t, 0.03);
        sirenGain.gain.setTargetAtTime(muted ? 0 : level * 0.055, t, 0.1);
      }
    },
    /** Radio bass figure; advance with dt while the player is in a car. */
    radio(dt, inCar, stationIndex) {
      station = stationIndex;
      if (!inCar || station >= 2) return;
      radioTimer -= dt;
      if (radioTimer > 0) return;
      radioTimer = 0.42;
      radioStep = (radioStep + 1) % 8;
      const roots = station === 0 ? [110, 110, 131, 98] : [98, 98, 117, 87];
      const root = roots[Math.floor(radioStep / 2) % 4];
      const pattern = [1, 1, 1.5, 1, 2, 1, 1.5, 1.25];
      blip(root * pattern[radioStep], 0.3, 'triangle', 0.055);
    },
  };
}
