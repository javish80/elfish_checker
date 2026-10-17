/**
 * Pure game rules for Elfish Checkers. No DOM access — safe to use in workers/tests.
 *
 * State shape:
 * {
 *   turn: 'W' | 'B',
 *   trolls: { W: nodeId, B: nodeId },
 *   elves: [{ id, team, node, done }],
 *   winner: null | 'W' | 'B',
 *   ply: number
 * }
 */
import { HOME, ENEMY, NODES, forward, isOval, startCircles } from './board.js';

export const ELVES_PER_TEAM = 7;
export const MAX_ELVES_PER_CIRCLE = 2;
export const trollId = (team) => `T${team}`;

export function initialState() {
  const elves = [];
  for (const team of ['W', 'B']) {
    startCircles(team).forEach((node, i) => elves.push({ id: `${team}${i}`, team, node, done: false }));
  }
  return { turn: 'W', trolls: { W: HOME.W, B: HOME.B }, elves, winner: null, ply: 0 };
}

export function cloneState(s) {
  return {
    turn: s.turn,
    trolls: { W: s.trolls.W, B: s.trolls.B },
    elves: s.elves.map((e) => ({ id: e.id, team: e.team, node: e.node, done: e.done })),
    winner: s.winner,
    ply: s.ply,
  };
}

const elvesOn = (s, node) => s.elves.filter((e) => e.node === node && !e.done);

/** Team whose troll stands on a *circle* `node`, or null. Ovals never block. */
function trollOnCircle(s, node) {
  if (isOval(node)) return null;
  if (s.trolls.W === node) return 'W';
  if (s.trolls.B === node) return 'B';
  return null;
}

function canElfEnter(s, node, team) {
  if (isOval(node)) return node === HOME[ENEMY[team]]; // only the enemy oval is ever "forward"
  if (trollOnCircle(s, node)) return false; // no elf may step onto a troll
  return elvesOn(s, node).length < MAX_ELVES_PER_CIRCLE;
}

function canTrollEnter(s, node, team) {
  return trollOnCircle(s, node) !== ENEMY[team]; // trolls never share a circle
}

/** Legal moves for one piece (by id). */
export function pieceMoves(s, pieceId) {
  if (s.winner) return [];
  const team = s.turn;
  if (pieceId === trollId(team)) {
    const from = s.trolls[team];
    return forward(from, team)
      .filter((to) => canTrollEnter(s, to, team))
      .map((to) => ({ kind: 'troll', id: pieceId, team, from, to }));
  }
  const elf = s.elves.find((e) => e.id === pieceId);
  if (!elf || elf.team !== team || elf.done) return [];
  return forward(elf.node, team)
    .filter((to) => canElfEnter(s, to, team))
    .map((to) => ({ kind: 'elf', id: elf.id, team, from: elf.node, to }));
}

/**
 * All legal moves for the side to move.
 * With `dedupe`, identical elf moves (same from → to) are collapsed — handy for the AI.
 */
export function legalMoves(s, { dedupe = false } = {}) {
  if (s.winner) return [];
  const team = s.turn;
  const moves = pieceMoves(s, trollId(team));
  const seen = new Set();
  for (const e of s.elves) {
    if (e.team !== team || e.done) continue;
    if (dedupe) {
      if (seen.has(e.node)) continue;
      seen.add(e.node);
    }
    moves.push(...pieceMoves(s, e.id));
  }
  return moves;
}

/**
 * Apply a move. Returns { state, events } where events describe what happened
 * (used by the UI to animate): move, bonk, trollReset, finish, pass, win.
 */
export function applyMove(s0, move) {
  const s = cloneState(s0);
  const team = s.turn;
  const events = [{ type: 'move', id: move.id, kind: move.kind, team, from: move.from, to: move.to }];

  if (move.kind === 'elf') {
    const elf = s.elves.find((e) => e.id === move.id);
    elf.node = move.to;
    if (move.to === HOME[ENEMY[team]]) {
      elf.done = true;
      events.push({ type: 'finish', id: elf.id, team });
    }
  } else {
    s.trolls[team] = move.to;
    if (!isOval(move.to)) {
      const hit = elvesOn(s, move.to);
      if (hit.length) {
        hit.forEach((e) => (e.node = HOME[e.team]));
        events.push({ type: 'bonk', at: move.to, team, ids: hit.map((e) => e.id) });
      }
    } else if (move.to === HOME[ENEMY[team]]) {
      s.trolls[team] = HOME[team];
      events.push({ type: 'trollReset', team, from: move.to, to: HOME[team] });
    }
  }

  if (s.elves.filter((e) => e.team === team && e.done).length === ELVES_PER_TEAM) {
    s.winner = team;
    events.push({ type: 'win', team });
  }

  s.ply += 1;
  s.turn = ENEMY[team];
  if (!s.winner && legalMoves(s).length === 0) {
    events.push({ type: 'pass', team: s.turn });
    s.turn = team;
  }
  return { state: s, events };
}

export const doneCount = (s, team) => s.elves.filter((e) => e.team === team && e.done).length;
export const waitingCount = (s, team) =>
  s.elves.filter((e) => e.team === team && !e.done && e.node === HOME[team]).length;

export { NODES };
