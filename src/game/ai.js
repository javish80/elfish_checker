/**
 * Simple AI: negamax + alpha-beta with iterative deepening and a time budget.
 */
import { applyMove, legalMoves } from './rules.js';
import { ENEMY, progress, forward, isOval } from './board.js';

export const LEVELS = {
  easy: { timeMs: 60, maxDepth: 1, noise: 3 },
  normal: { timeMs: 450, maxDepth: 5, noise: 0.4 },
  hard: { timeMs: 1400, maxDepth: 14, noise: 0 },
};

const WIN = 10_000;
const TIMEOUT = Symbol('timeout');

function sideScore(s, team) {
  let score = 0;
  const myTroll = s.trolls[team];
  const enemyTroll = s.trolls[ENEMY[team]];
  const enemyTrollReach = new Set(forward(enemyTroll, ENEMY[team]));
  const myTrollProg = progress(myTroll, team);

  for (const e of s.elves) {
    if (e.team === team) {
      if (e.done) {
        score += 14;
        continue;
      }
      const p = progress(e.node, team);
      score += p + p * p * 0.18;
      if (!isOval(e.node) && enemyTrollReach.has(e.node)) score -= 0.35 * (p + 1);
    } else if (!e.done) {
      // Enemy elves still "in front" of my troll can be hit later.
      const theirProgFromMySide = progress(e.node, team);
      if (theirProgFromMySide > myTrollProg) score += 0.2;
    }
  }
  return score;
}

export function evaluate(s, team) {
  return sideScore(s, team) - sideScore(s, ENEMY[team]);
}

function moveHint(s, m) {
  if (m.kind === 'elf') {
    const gain = progress(m.to, m.team) - progress(m.from, m.team);
    return gain + (isOval(m.to) ? 20 : 0) + progress(m.to, m.team) * 0.1;
  }
  let h = 0;
  for (const e of s.elves) {
    if (e.node === m.to && !e.done) h += e.team === m.team ? -12 : 12;
  }
  return h;
}

function ordered(s, moves, first) {
  const scored = moves.map((m) => ({ m, h: moveHint(s, m) + (first && sameMove(m, first) ? 1000 : 0) }));
  scored.sort((a, b) => b.h - a.h);
  return scored.map((x) => x.m);
}

const sameMove = (a, b) => a.kind === b.kind && a.from === b.from && a.to === b.to;

function negamax(s, depth, alpha, beta, ctx) {
  if ((++ctx.nodes & 511) === 0 && performance.now() > ctx.deadline) throw TIMEOUT;
  if (s.winner) return s.winner === s.turn ? WIN + depth : -(WIN + depth);
  if (depth === 0) return evaluate(s, s.turn);

  const moves = ordered(s, legalMoves(s, { dedupe: true }));
  if (!moves.length) return evaluate(s, s.turn);

  let best = -Infinity;
  for (const m of moves) {
    const child = applyMove(s, m).state;
    const v = child.turn === s.turn
      ? negamax(child, depth - 1, alpha, beta, ctx)
      : -negamax(child, depth - 1, -beta, -alpha, ctx);
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}

/** Pick a move for the side to move. */
export function chooseMove(s, level = 'normal') {
  const cfg = LEVELS[level] ?? LEVELS.normal;
  const rootMoves = legalMoves(s, { dedupe: true });
  if (rootMoves.length <= 1) return rootMoves[0] ?? null;

  const ctx = { nodes: 0, deadline: performance.now() + cfg.timeMs };
  let bestMove = ordered(s, rootMoves)[0];

  for (let depth = 1; depth <= cfg.maxDepth; depth++) {
    try {
      let alpha = -Infinity;
      let iterBest = null;
      for (const m of ordered(s, rootMoves, bestMove)) {
        const child = applyMove(s, m).state;
        let v = child.turn === s.turn
          ? negamax(child, depth - 1, alpha, Infinity, ctx)
          : -negamax(child, depth - 1, -Infinity, -alpha, ctx);
        if (cfg.noise) v += (Math.random() * 2 - 1) * cfg.noise;
        if (v > alpha) {
          alpha = v;
          iterBest = m;
        }
      }
      if (iterBest) bestMove = iterBest;
      if (alpha >= WIN) break; // found a forced win
    } catch (err) {
      if (err !== TIMEOUT) throw err;
      break;
    }
  }
  return bestMove;
}
