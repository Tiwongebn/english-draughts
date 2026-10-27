/* Animation timing, synthesised sound effects (Web Audio) and win confetti. */

const ANIM_MS = 320;
const REDUCED_MOTION = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ----- sound effects (synthesised with Web Audio, no files needed) ----- */
let soundOn = true;
let audioCtx = null;
function tone(freq, dur, type, vol, delay, slide) {
  if (!soundOn) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t = audioCtx.currentTime + (delay || 0);
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    g.gain.setValueAtTime(vol || 0.08, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(t); o.stop(t + dur + 0.03);
  } catch (e) { /* audio unavailable: stay silent */ }
}
const sfx = {
  move()    { tone(260, 0.09, 'triangle', 0.14, 0, 0.55); tone(130, 0.07, 'sine', 0.12, 0.03); },
  capture() { tone(170, 0.16, 'square', 0.06, 0, 0.5); tone(85, 0.22, 'sine', 0.2, 0.02); },
  king()    { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.2, 'triangle', 0.09, i * 0.08)); },
  win()     { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, 0.22, 'triangle', 0.1, i * 0.11)); },
  lose()    { [392, 349, 311, 262].forEach((f, i) => tone(f, 0.28, 'sawtooth', 0.05, i * 0.16)); }
};
function playMoveSound(anim) {
  if (anim.cap) sfx.capture(); else sfx.move();
  if (anim.promoted) setTimeout(() => sfx.king(), ANIM_MS);
}

/* ----- confetti for a win ----- */
function confetti() {
  if (REDUCED_MOTION) return;
  const box = document.createElement('div');
  box.className = 'confetti';
  const colors = ['#f1c76a', '#e0524a', '#f6efe0', '#4fc3a1', '#7fb3ff', '#ff9ec7'];
  for (let i = 0; i < 90; i++) {
    const p = document.createElement('i');
    p.style.left = Math.random() * 100 + '%';
    p.style.background = colors[i % colors.length];
    p.style.animationDuration = (2.4 + Math.random() * 2.4) + 's';
    p.style.animationDelay = (Math.random() * 0.8) + 's';
    p.style.transform = 'rotate(' + Math.floor(Math.random() * 360) + 'deg)';
    box.appendChild(p);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 6500);
}
