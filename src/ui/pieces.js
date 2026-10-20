/** SVG helpers and piece artwork (elf + troll tokens). */

export const NS = 'http://www.w3.org/2000/svg';

export function svg(tag, attrs = {}, parent) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (parent) parent.appendChild(node);
  return node;
}

/** Shared gradients / symbols. */
export function buildDefs(defs) {
  defs.innerHTML = `
    <radialGradient id="g-elf-W" cx="38%" cy="32%" r="75%">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset=".55" stop-color="#e9ecef"/>
      <stop offset="1" stop-color="#b9c4cc"/>
    </radialGradient>
    <radialGradient id="g-elf-B" cx="38%" cy="32%" r="75%">
      <stop offset="0" stop-color="#4a4160"/>
      <stop offset=".55" stop-color="#1d1828"/>
      <stop offset="1" stop-color="#0b0910"/>
    </radialGradient>
    <radialGradient id="g-troll" cx="40%" cy="30%" r="80%">
      <stop offset="0" stop-color="#9aa58c"/>
      <stop offset=".6" stop-color="#66705c"/>
      <stop offset="1" stop-color="#3e4538"/>
    </radialGradient>
    <linearGradient id="g-board" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="hsl(176 52% 33%)"/>
      <stop offset=".5" stop-color="hsl(176 50% 30%)"/>
      <stop offset="1" stop-color="hsl(178 54% 25%)"/>
    </linearGradient>
    <radialGradient id="g-node" cx="45%" cy="38%" r="70%">
      <stop offset="0" stop-color="hsl(180 45% 20%)"/>
      <stop offset="1" stop-color="hsl(182 55% 12%)"/>
    </radialGradient>
    <filter id="f-fabric" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed="7" result="n"/>
      <feColorMatrix in="n" type="matrix"
        values="0 0 0 0 0  0 0 0 0 0.1  0 0 0 0 0.1  0 0 0 .09 0" result="tint"/>
      <feComposite in="tint" in2="SourceGraphic" operator="in"/>
    </filter>
    <filter id="f-shadow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="3" stdDeviation="2.5" flood-color="#021412" flood-opacity=".55"/>
    </filter>
    <symbol id="knot" viewBox="-20 -20 40 40" overflow="visible">
      <g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
        <circle r="15"/>
        <ellipse rx="4.6" ry="12" transform="rotate(45)"/>
        <ellipse rx="4.6" ry="12" transform="rotate(-45)"/>
        <rect x="-6" y="-6" width="12" height="12" rx="3" transform="rotate(45)"/>
      </g>
    </symbol>
    <symbol id="knot-oval" viewBox="-40 -20 80 40" overflow="visible">
      <g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <rect x="-12" y="-12" width="24" height="24" rx="6" transform="translate(-13 0) rotate(45)"/>
        <rect x="-12" y="-12" width="24" height="24" rx="6" transform="translate(13 0) rotate(45)"/>
        <rect x="-6" y="-6" width="12" height="12" rx="3" transform="rotate(45)"/>
      </g>
    </symbol>
    <path id="leaf" d="M0,-6 C4.5,-2.5 4.5,2.5 0,6 C-4.5,2.5 -4.5,-2.5 0,-6Z"/>
  `;
}

/** Elf token: hooded head with pointed ears and a golden circlet. */
export function createElf(team) {
  const g = svg('g', { class: `piece elf elf--${team}` });
  const body = svg('g', { class: 'piece-body' }, g);
  svg('circle', { class: 'piece-halo', r: 22 }, body);
  svg('circle', { class: 'token', r: 17, fill: `url(#g-elf-${team})`, filter: 'url(#f-shadow)' }, body);
  svg('ellipse', { class: 'token-highlight', cx: -3, cy: -6, rx: 9, ry: 5, fill: 'white', opacity: 0.15, transform: 'rotate(-30)' }, body);
  svg('circle', { class: 'token-rim', r: 14.5 }, body);
  const glyph = svg('g', { class: 'elf-glyph' }, body);
  svg('path', { d: 'M-4.6,-2.2 L-12.5,-7.5 L-5.2,2.2 Z' }, glyph);
  svg('path', { d: 'M4.6,-2.2 L12.5,-7.5 L5.2,2.2 Z' }, glyph);
  svg('ellipse', { cx: 0, cy: -1, rx: 5.2, ry: 6.2 }, glyph);
  svg('path', { d: 'M-9.5,12.5 C-8.5,6.5 -4.5,5.2 0,5.2 C4.5,5.2 8.5,6.5 9.5,12.5 Z' }, glyph);
  svg('path', { class: 'circlet', d: 'M-5.4,-4.2 Q0,-7 5.4,-4.2' }, body);
  svg('circle', { class: 'circlet-gem', cx: 0, cy: -5.6, r: 1.2 }, body);
  return g;
}

/** Troll token: mossy stone face with tusks, rimmed in its team colour. */
export function createTroll(team) {
  const g = svg('g', { class: `piece troll troll--${team}` });
  const body = svg('g', { class: 'piece-body' }, g);
  svg('circle', { class: 'piece-halo', r: 30 }, body);
  svg('circle', { class: 'token', r: 23, fill: 'url(#g-troll)', filter: 'url(#f-shadow)' }, body);
  svg('ellipse', { class: 'token-highlight', cx: -4, cy: -8, rx: 12, ry: 6, fill: 'white', opacity: 0.1, transform: 'rotate(-20)' }, body);
  svg('circle', { class: 'troll-rim', r: 23 }, body);
  const face = svg('g', { class: 'troll-face' }, body);
  svg('circle', { class: 'troll-ear', cx: -19, cy: -3, r: 4 }, face);
  svg('circle', { class: 'troll-ear', cx: 19, cy: -3, r: 4 }, face);
  svg('path', { class: 'troll-brow', d: 'M-12,-7 Q-6,-11 -1,-6 M1,-6 Q6,-11 12,-7' }, face);
  svg('circle', { class: 'troll-eye', cx: -6, cy: -2.5, r: 2.3 }, face);
  svg('circle', { class: 'troll-eye', cx: 6, cy: -2.5, r: 2.3 }, face);
  svg('path', { class: 'troll-nose', d: 'M-3,0.5 Q0,6 3,0.5' }, face);
  svg('path', { class: 'troll-mouth', d: 'M-10,9 Q0,13.5 10,9' }, face);
  svg('path', { class: 'troll-tusk', d: 'M-7,9.6 L-5.6,3.6 L-3.6,10.6 Z' }, face);
  svg('path', { class: 'troll-tusk', d: 'M7,9.6 L5.6,3.6 L3.6,10.6 Z' }, face);
  return g;
}
