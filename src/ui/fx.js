/** One-shot visual effects (leaves, bonks, dust, sparkles). All use the Web Animations API. */
import { svg } from './pieces.js';

const LEAF_COLORS = ['hsl(95 45% 58%)', 'hsl(48 78% 64%)', 'hsl(140 38% 46%)', 'hsl(34 72% 58%)', 'hsl(70 50% 55%)'];
const STAR = 'M0,-5 L1.4,-1.4 5,0 1.4,1.4 0,5 -1.4,1.4 -5,0 -1.4,-1.4Z';
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function at(layer, x, y) {
  return svg('g', { transform: `translate(${x} ${y})`, class: 'fx' }, layer);
}
function cleanup(group, anims) {
  Promise.all(anims.map((a) => a.finished.catch(() => {}))).then(() => group.remove());
}

/** A few leaves drift down from the path of a moving elf. */
export function leafTrail(layer, from, to, duration) {
  const count = 4;
  for (let i = 0; i < count; i++) {
    const t = (i + 1) / (count + 1);
    const x = from.x + (to.x - from.x) * t;
    const y = from.y + (to.y - from.y) * t - 10;
    const g = at(layer, x, y);
    const leaf = svg('use', { href: '#leaf', fill: pick(LEAF_COLORS), class: 'fx-leaf' }, g);
    const dx = rand(-14, 14);
    const r0 = rand(0, 360);
    const a = leaf.animate(
      [
        { transform: `translate(0px,0px) rotate(${r0}deg) scale(.4)`, opacity: 0 },
        { transform: `translate(${dx * 0.4}px,6px) rotate(${r0 + 60}deg) scale(.9)`, opacity: 0.95, offset: 0.25 },
        { transform: `translate(${dx}px,30px) rotate(${r0 + 200}deg) scale(.7)`, opacity: 0 },
      ],
      { duration: 1000, delay: duration * t, easing: 'ease-out', fill: 'both' },
    );
    cleanup(g, [a]);
  }
}

/** Troll lands on elves: shock ring, stars and a "BONK!". */
export function bonk(layer, p, count, label = 'BONK!') {
  const g = at(layer, p.x, p.y);
  const anims = [];
  const ring = svg('circle', { r: 14, class: 'fx-ring' }, g);
  anims.push(ring.animate(
    [{ transform: 'scale(.3)', opacity: 1 }, { transform: 'scale(2.8)', opacity: 0 }],
    { duration: 520, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'both' },
  ));
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2 + rand(-0.2, 0.2);
    const d = rand(34, 52);
    const star = svg('path', { d: STAR, class: 'fx-star' }, g);
    anims.push(star.animate(
      [
        { transform: 'translate(0,0) rotate(0deg) scale(.5)', opacity: 1 },
        { transform: `translate(${Math.cos(ang) * d}px,${Math.sin(ang) * d}px) rotate(180deg) scale(1.1)`, opacity: 0 },
      ],
      { duration: 700, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'both' },
    ));
  }
  const text = svg('text', { class: 'fx-bonk', 'text-anchor': 'middle', y: -30 }, g);
  text.textContent = count > 1 ? `${label} ×${count}` : label;
  anims.push(text.animate(
    [
      { transform: 'translateY(8px) scale(.5)', opacity: 0 },
      { transform: 'translateY(0) scale(1.15)', opacity: 1, offset: 0.25 },
      { transform: 'translateY(-6px) scale(1)', opacity: 1, offset: 0.7 },
      { transform: 'translateY(-22px) scale(.95)', opacity: 0 },
    ],
    { duration: 1100, easing: 'ease-out', fill: 'both' },
  ));
  cleanup(g, anims);
}

/** Puff of grey dust (troll landing / troll trudging home). */
export function dust(layer, p, big = false) {
  const g = at(layer, p.x, p.y + (big ? 0 : 16));
  const anims = [];
  const n = big ? 10 : 6;
  for (let i = 0; i < n; i++) {
    const ang = big ? (i / n) * Math.PI * 2 : Math.PI + (i / (n - 1)) * Math.PI;
    const d = big ? rand(18, 34) : rand(12, 22);
    const c = svg('circle', { r: rand(4, big ? 9 : 6), class: 'fx-dust' }, g);
    anims.push(c.animate(
      [
        { transform: 'translate(0,0) scale(.4)', opacity: 0.8 },
        { transform: `translate(${Math.cos(ang) * d}px,${Math.sin(ang) * d - (big ? 10 : 4)}px) scale(1.3)`, opacity: 0 },
      ],
      { duration: big ? 750 : 480, easing: 'ease-out', fill: 'both' },
    ));
  }
  cleanup(g, anims);
}

/** Golden sparkle when an elf reaches the far oval. */
export function sparkle(layer, p) {
  const g = at(layer, p.x, p.y);
  const anims = [];
  const ring = svg('circle', { r: 10, class: 'fx-ring fx-ring--soft' }, g);
  anims.push(ring.animate(
    [{ transform: 'scale(.5)', opacity: 0.9 }, { transform: 'scale(2.6)', opacity: 0 }],
    { duration: 800, easing: 'ease-out', fill: 'both' },
  ));
  for (let i = 0; i < 10; i++) {
    const ang = (i / 10) * Math.PI * 2;
    const d = rand(20, 36);
    const s = svg('path', { d: STAR, class: 'fx-star' }, g);
    anims.push(s.animate(
      [
        { transform: 'translate(0,0) scale(.2)', opacity: 0 },
        { transform: `translate(${Math.cos(ang) * d * 0.6}px,${Math.sin(ang) * d * 0.6}px) scale(.9)`, opacity: 1, offset: 0.4 },
        { transform: `translate(${Math.cos(ang) * d}px,${Math.sin(ang) * d}px) scale(.3)`, opacity: 0 },
      ],
      { duration: 900, delay: i * 18, easing: 'ease-out', fill: 'both' },
    ));
  }
  cleanup(g, anims);
}

/** Victory: a shower of golden & green leaves over the whole board. */
export function leafShower(layer, view, count = 46) {
  for (let i = 0; i < count; i++) {
    const g = at(layer, rand(20, view.w - 20), -20);
    const leaf = svg('use', { href: '#leaf', fill: pick(LEAF_COLORS), class: 'fx-leaf' }, g);
    const sway = rand(20, 60);
    const r0 = rand(0, 360);
    const h = view.h + 40;
    const frames = [0, 0.25, 0.5, 0.75, 1].map((t, k) => ({
      transform: `translate(${Math.sin(t * Math.PI * 3 + i) * sway}px,${t * h}px) rotate(${r0 + t * 540}deg) scale(${1.2 + (k % 2) * 0.3})`,
      opacity: t < 0.85 ? 1 : 0,
    }));
    const a = leaf.animate(frames, { duration: rand(2600, 4600), delay: rand(0, 1600), easing: 'linear', fill: 'both' });
    cleanup(g, [a]);
  }
}
