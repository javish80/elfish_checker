/**
 * Board geometry & graph.
 *
 * Rows are numbered from White's side:
 *   row 0  = White home oval ("W")
 *   rows 1..5 = circles, widths 4-3-4-3-4
 *   row 6  = Black home oval ("B")
 *
 * Lines only run diagonally between neighbouring rows. Each home oval is
 * linked to all four circles of its nearest row.
 */

export const TEAMS = ['W', 'B'];
export const HOME = { W: 'W', B: 'B' };
export const ENEMY = { W: 'B', B: 'W' };
export const other = (team) => ENEMY[team];

export const VIEW = { w: 600, h: 840 };
export const OVAL = { rx: 100, ry: 44 };

const ROW_WIDTH = [1, 4, 3, 4, 3, 4, 1];
const ROW_Y = [742, 632, 526, 420, 314, 208, 98];
const X4 = [120, 240, 360, 480];
const X3 = [180, 300, 420];

/** @type {Record<string, {id:string,row:number,col:number,x:number,y:number,kind:'oval'|'circle'}>} */
export const NODES = {};
/** Undirected edges as [a, b] pairs (for drawing). */
export const EDGES = [];
const ADJ = {};

const circleId = (row, col) => `${row}-${col}`;

function addNode(id, row, col, x, y, kind) {
  NODES[id] = { id, row, col, x, y, kind };
  ADJ[id] = [];
}
function link(a, b) {
  ADJ[a].push(b);
  ADJ[b].push(a);
  EDGES.push([a, b]);
}

addNode('W', 0, 0, 300, ROW_Y[0], 'oval');
addNode('B', 6, 0, 300, ROW_Y[6], 'oval');
for (let r = 1; r <= 5; r++) {
  const xs = ROW_WIDTH[r] === 4 ? X4 : X3;
  xs.forEach((x, c) => addNode(circleId(r, c), r, c, x, ROW_Y[r], 'circle'));
}

// Ovals ↔ their nearest 4-wide row.
for (let c = 0; c < 4; c++) {
  link('W', circleId(1, c));
  link('B', circleId(5, c));
}
// Diagonals between circle rows.
for (let r = 1; r <= 4; r++) {
  for (let c = 0; c < ROW_WIDTH[r]; c++) {
    const targets = ROW_WIDTH[r] === 4 ? [c - 1, c] : [c, c + 1];
    for (const t of targets) {
      if (t >= 0 && t < ROW_WIDTH[r + 1]) link(circleId(r, c), circleId(r + 1, t));
    }
  }
}

export const isOval = (id) => NODES[id].kind === 'oval';

/** Neighbours of `id` that are one step *forward* for `team`. */
export function forward(id, team) {
  const row = NODES[id].row;
  return ADJ[id].filter((n) => (team === 'W' ? NODES[n].row > row : NODES[n].row < row));
}

/** How far a node is along `team`'s journey (0 = own home, 6 = enemy home). */
export function progress(id, team) {
  const row = NODES[id].row;
  return team === 'W' ? row : 6 - row;
}

/** The 7 starting circles of a team (its first two rows). */
export function startCircles(team) {
  const rows = team === 'W' ? [1, 2] : [5, 4];
  return rows.flatMap((r) => Array.from({ length: ROW_WIDTH[r] }, (_, c) => circleId(r, c)));
}
