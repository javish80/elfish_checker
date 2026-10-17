/** SVG board renderer: draws the board, positions pieces and plays move animations. */
import { NODES, EDGES, VIEW, OVAL, HOME, isOval } from '../game/board.js';
import { trollId } from '../game/rules.js';
import { svg, buildDefs, createElf, createTroll } from './pieces.js';
import * as fx from './fx.js';
import { t } from '../i18n.js';

const WAIT_SLOTS = [[-48, -13], [-48, 13], [48, -13], [48, 13], [-74, 0], [74, 0], [0, 30]];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tr = (p) => `translate(${p.x}px, ${p.y}px)`;

/** Where every piece should sit for a given state. */
export function computeLayout(state) {
  const pos = new Map();
  const byNode = new Map();
  for (const e of [...state.elves].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!byNode.has(e.node)) byNode.set(e.node, []);
    byNode.get(e.node).push(e);
  }
  for (const [nodeId, list] of byNode) {
    const n = NODES[nodeId];
    if (!isOval(nodeId)) {
      if (list.length === 1) pos.set(list[0].id, { x: n.x, y: n.y, s: 1 });
      else list.forEach((e, i) => pos.set(e.id, { x: n.x + (i ? 13 : -13), y: n.y, s: 0.8 }));
      continue;
    }
    const outward = nodeId === HOME.W ? 1 : -1;
    const waiting = list.filter((e) => !e.done);
    const done = list.filter((e) => e.done);
    waiting.forEach((e, i) => {
      const [dx, dy] = WAIT_SLOTS[i % WAIT_SLOTS.length];
      pos.set(e.id, { x: n.x + dx, y: n.y + dy * outward, s: 0.66 });
    });
    done.forEach((e, i) => {
      pos.set(e.id, { x: n.x + (i - (done.length - 1) / 2) * 25, y: n.y + outward * (OVAL.ry + 20), s: 0.6 });
    });
  }
  for (const t of ['W', 'B']) {
    const n = NODES[state.trolls[t]];
    pos.set(trollId(t), { x: n.x, y: n.y, s: isOval(n.id) ? 0.92 : 1 });
  }
  return pos;
}

export class Renderer {
  constructor(svgEl, { onPiece, onNode }) {
    this.svg = svgEl;
    this.onPiece = onPiece;
    this.onNode = onNode;
    this.pieces = new Map();
    this.cur = new Map();
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    this.build();
  }

  get motion() {
    return !this.reducedMotion.matches;
  }

  build() {
    const root = this.svg;
    root.setAttribute('viewBox', `0 0 ${VIEW.w} ${VIEW.h}`);
    buildDefs(svg('defs', {}, root));
    this.stage = svg('g', { class: 'stage' }, root);

    // Board cloth
    const board = svg('g', { class: 'board' }, this.stage);
    svg('rect', { x: 10, y: 10, width: VIEW.w - 20, height: VIEW.h - 20, rx: 34, fill: 'url(#g-board)' }, board);
    svg('rect', { x: 10, y: 10, width: VIEW.w - 20, height: VIEW.h - 20, rx: 34, fill: '#fff', filter: 'url(#f-fabric)' }, board);
    svg('rect', { class: 'board-border', x: 24, y: 24, width: VIEW.w - 48, height: VIEW.h - 48, rx: 24 }, board);
    this.boardTitles = [];
    for (const [x, rot] of [[44, -90], [VIEW.w - 44, 90]]) {
      const tx = svg('text', { class: 'board-title', x, y: VIEW.h / 2, transform: `rotate(${rot} ${x} ${VIEW.h / 2})`, 'text-anchor': 'middle' }, board);
      this.boardTitles.push(tx);
    }

    // Lines + leaf arrows
    const lines = svg('g', { class: 'edges' }, board);
    for (const [a, b] of EDGES) {
      const A = NODES[a];
      const B = NODES[b];
      svg('line', { x1: A.x, y1: A.y, x2: B.x, y2: B.y, class: 'edge' }, lines);
      const ang = (Math.atan2(B.y - A.y, B.x - A.x) * 180) / Math.PI + 90;
      const mx = (A.x + B.x) / 2;
      const my = (A.y + B.y) / 2;
      svg('use', { href: '#leaf', class: 'edge-leaf', transform: `translate(${mx} ${my}) rotate(${ang}) scale(1.5 1.9)` }, lines);
    }

    // Nodes
    this.nodeEls = {};
    const nodes = svg('g', { class: 'nodes' }, board);
    for (const n of Object.values(NODES)) {
      const g = svg('g', { class: `node node--${n.kind}`, transform: `translate(${n.x} ${n.y})`, 'data-node': n.id }, nodes);
      if (n.kind === 'oval') {
        svg('ellipse', { class: 'node-glow', rx: OVAL.rx + 10, ry: OVAL.ry + 10 }, g);
        svg('ellipse', { class: 'node-shape', rx: OVAL.rx, ry: OVAL.ry, fill: 'url(#g-node)' }, g);
        svg('ellipse', { class: 'node-inner', rx: OVAL.rx - 7, ry: OVAL.ry - 6 }, g);
        svg('use', { href: '#knot-oval', class: 'knot knot--oval', x: -40, y: -20, width: 80, height: 40 }, g);
      } else {
        svg('circle', { class: 'node-shape', r: 27, fill: 'url(#g-node)' }, g);
        svg('use', { href: '#knot', class: 'knot', x: -18, y: -18, width: 36, height: 36 }, g);
      }
      g.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onNode(n.id);
      });
      this.nodeEls[n.id] = g;
    }

    this.hintLayer = svg('g', { class: 'hints' }, this.stage);
    this.pieceLayer = svg('g', { class: 'pieces' }, this.stage);
    this.fxLayer = svg('g', { class: 'fx-layer', 'pointer-events': 'none' }, this.stage);

    for (const team of ['W', 'B']) {
      this.addPiece(trollId(team), createTroll(team));
      for (let i = 0; i < 7; i++) this.addPiece(`${team}${i}`, createElf(team));
    }

    root.addEventListener('click', () => this.onNode(null));
  }

  /** Re-apply all language-dependent text. */
  relabel() {
    this.boardTitles.forEach((el) => (el.textContent = t('title')));
    for (const [id, g] of this.pieces) {
      const team = id.startsWith('T') ? id[1] : id[0];
      g.setAttribute('aria-label', t(id.startsWith('T') ? `pieceTroll_${team}` : `pieceElf_${team}`));
    }
    this.hintLayer.querySelectorAll('.hint').forEach((h) => h.setAttribute('aria-label', t('moveHere')));
  }

  addPiece(id, g) {
    g.dataset.id = id;
    g.setAttribute('role', 'button');
    g.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onPiece(id);
    });
    g.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.onPiece(id);
      }
    });
    this.pieceLayer.appendChild(g);
    this.pieces.set(id, g);
  }

  body(id) {
    return this.pieces.get(id).querySelector('.piece-body');
  }

  raise(id) {
    this.pieceLayer.appendChild(this.pieces.get(id));
  }

  /** Snap or tween every piece to its place for `state`. */
  layout(state, { animate = true, duration = 280 } = {}) {
    const target = computeLayout(state);
    const anims = [];
    for (const [id, p] of target) {
      const g = this.pieces.get(id);
      const prev = this.cur.get(id);
      this.cur.set(id, p);
      g.style.transform = tr(p);
      this.body(id).style.transform = `scale(${p.s})`;
      if (animate && this.motion && prev && (prev.x !== p.x || prev.y !== p.y)) {
        anims.push(g.animate([{ transform: tr(prev) }, { transform: tr(p) }], {
          duration,
          easing: 'cubic-bezier(.3,.7,.4,1)',
        }).finished.catch(() => {}));
      }
    }
    return Promise.all(anims);
  }

  /** Arc-shaped hop from the current spot to `to`. */
  hop(id, to, { lift = 22, duration = 420, spin = 0 } = {}) {
    const g = this.pieces.get(id);
    const from = this.cur.get(id);
    this.cur.set(id, to);
    g.style.transform = tr(to);
    this.body(id).style.transform = `scale(${to.s})`;
    if (!this.motion) return Promise.resolve();
    const frames = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      frames.push({
        transform: `translate(${from.x + (to.x - from.x) * t}px, ${from.y + (to.y - from.y) * t - lift * 4 * t * (1 - t)}px)`,
      });
    }
    const anims = [g.animate(frames, { duration, easing: 'cubic-bezier(.45,.05,.55,.95)' }).finished];
    if (spin) {
      anims.push(this.body(id).animate(
        [{ transform: `scale(${from.s}) rotate(0deg)` }, { transform: `scale(${to.s}) rotate(${spin}deg)` }],
        { duration, easing: 'ease-out' },
      ).finished);
    }
    return Promise.all(anims).catch(() => {});
  }

  squash(id) {
    if (!this.motion) return;
    const s = this.cur.get(id).s;
    this.body(id).animate(
      [
        { transform: `scale(${s})` },
        { transform: `scale(${s * 1.18}, ${s * 0.82})`, offset: 0.3 },
        { transform: `scale(${s * 0.95}, ${s * 1.05})`, offset: 0.65 },
        { transform: `scale(${s})` },
      ],
      { duration: 340, easing: 'ease-out' },
    );
  }

  shake(strength = 5) {
    if (!this.motion) return;
    this.stage.animate(
      [0, -1, 0.8, -0.6, 0.4, 0].map((k) => ({ transform: `translate(${k * strength}px, ${Math.abs(k) * 2}px)` })),
      { duration: 380, easing: 'ease-out' },
    );
  }

  /** Play the events produced by applyMove, ending in `finalState`. */
  async play(events, finalState) {
    if (!this.motion) {
      await this.layout(finalState, { animate: false });
      return;
    }
    const final = computeLayout(finalState);
    const hasBonk = events.some((e) => e.type === 'bonk');
    const hasReset = events.some((e) => e.type === 'trollReset');

    for (const ev of events) {
      if (ev.type === 'move') {
        this.raise(ev.id);
        if (ev.kind === 'troll') {
          const n = NODES[ev.to];
          const target = hasReset ? { x: n.x, y: n.y, s: 0.92 } : final.get(ev.id);
          await this.hop(ev.id, target, { lift: 40, duration: 560 });
          this.squash(ev.id);
          if (!hasBonk) {
            fx.dust(this.fxLayer, target);
            this.shake(2);
          }
        } else {
          const target = final.get(ev.id);
          fx.leafTrail(this.fxLayer, this.cur.get(ev.id), target, 430);
          await this.hop(ev.id, target, { lift: 24, duration: 430 });
        }
      } else if (ev.type === 'bonk') {
        const n = NODES[ev.at];
        fx.bonk(this.fxLayer, n, ev.ids.length, t('bonk'));
        this.shake(6);
        await sleep(160);
        await Promise.all(ev.ids.map((id) => {
          this.raise(id);
          return this.hop(id, final.get(id), { lift: 90, duration: 820, spin: 720 });
        }));
      } else if (ev.type === 'trollReset') {
        const id = trollId(ev.team);
        const g = this.pieces.get(id);
        await sleep(120);
        fx.dust(this.fxLayer, this.cur.get(id), true);
        await g.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, fill: 'forwards' }).finished;
        const home = final.get(id);
        this.cur.set(id, home);
        g.style.transform = tr(home);
        this.body(id).style.transform = `scale(${home.s})`;
        fx.dust(this.fxLayer, home, true);
        await g.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, fill: 'forwards' }).finished;
        g.getAnimations().forEach((a) => a.cancel());
      } else if (ev.type === 'finish') {
        fx.sparkle(this.fxLayer, final.get(ev.id));
      }
    }
    await this.layout(finalState);
  }

  celebrate() {
    if (this.motion) fx.leafShower(this.fxLayer, VIEW);
  }

  /** Highlight whose turn it is, which pieces can move, the selection and its targets. */
  setInteraction({ turn, movable, selected, targets, locked }) {
    for (const [id, g] of this.pieces) {
      const canMove = !locked && movable.has(id);
      g.classList.toggle('is-movable', canMove);
      g.classList.toggle('is-selected', id === selected);
      g.setAttribute('tabindex', canMove ? '0' : '-1');
      g.setAttribute('aria-pressed', String(id === selected));
    }
    for (const team of ['W', 'B']) this.nodeEls[HOME[team]].classList.toggle('is-turn', team === turn && !locked);

    this.hintLayer.replaceChildren();
    for (const nodeId of targets) {
      const n = NODES[nodeId];
      const g = svg('g', { class: 'hint', transform: `translate(${n.x} ${n.y})`, role: 'button', tabindex: '0', 'aria-label': t('moveHere') }, this.hintLayer);
      if (isOval(nodeId)) svg('ellipse', { rx: OVAL.rx + 6, ry: OVAL.ry + 6 }, g);
      else svg('circle', { r: 31 }, g);
      const go = (e) => {
        e.stopPropagation();
        this.onNode(nodeId);
      };
      g.addEventListener('click', go);
      g.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && go(e));
    }
    // Hints sit above the pieces only while a selection is active.
    if (targets.length) this.stage.appendChild(this.hintLayer);
    else this.stage.insertBefore(this.hintLayer, this.pieceLayer);
    this.stage.appendChild(this.fxLayer);
  }
}
