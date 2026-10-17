import {
  initialState, pieceMoves, applyMove, doneCount, waitingCount, trollId, ELVES_PER_TEAM,
} from './game/rules.js';
import { chooseMove } from './game/ai.js';
import { Renderer } from './ui/renderer.js';
import { svg, createElf } from './ui/pieces.js';
import { t, applyStatic, setLang, getLang, onLangChange } from './i18n.js';

const STORE_KEY = 'elfish-checkers:v1';
const teamName = (team) => t(`team_${team}`);
const VICTORY_QUOTE = { W: 'Aiya Eärendil Elenion Ancalima!', B: "Utúlie'n aurë!" };
const $ = (sel) => document.querySelector(sel);

/* ---------------- State ---------------- */
let game = { state: initialState(), history: [] };
let settings = { mode: 'pvp', human: 'W', level: 'normal' };
const ui = { selected: null, busy: false, thinking: false, aiToken: 0, message: '', lastEvents: null };

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY));
    if (saved?.state?.elves?.length === 14) game = { state: saved.state, history: saved.history ?? [] };
    if (saved?.settings) settings = { ...settings, ...saved.settings };
  } catch { /* ignore corrupt saves */ }
}
function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ ...game, history: game.history.slice(-300), settings }));
  } catch { /* storage may be unavailable */ }
}

/* ---------------- AI (worker with main-thread fallback) ---------------- */
let worker = null;
const pending = new Map();
try {
  if (typeof window !== 'undefined' && window.Worker && location.protocol !== 'file:') {
    try {
      worker = new Worker('src/game/ai-worker.js', { type: 'module' });
      worker.onmessage = (e) => {
        pending.get(e.data.token)?.(e.data.move);
        pending.delete(e.data.token);
      };
      worker.onerror = () => { worker = null; };
    } catch { worker = null; }
  }
} catch { worker = null; }

function askAI(state, level, token) {
  if (!worker) return new Promise((r) => setTimeout(() => r(chooseMove(state, level)), 0));
  return new Promise((resolve) => {
    pending.set(token, resolve);
    worker.postMessage({ state, level, token });
  });
}

/* ---------------- Helpers ---------------- */
const st = () => game.state;
const isAiTurn = () => settings.mode === 'ai' && st().turn !== settings.human && !st().winner;
const canHumanAct = () => !ui.busy && !st().winner && !isAiTurn();

function movablePieces() {
  const s = st();
  const ids = [trollId(s.turn), ...s.elves.filter((e) => e.team === s.turn && !e.done).map((e) => e.id)];
  return new Set(ids.filter((id) => pieceMoves(s, id).length));
}

/* ---------------- Rendering ---------------- */
let renderer = null;

function setStatus(html) {
  ui.message = html;
  $('#status').innerHTML = html;
}

function defaultStatus() {
  const s = st();
  if (s.winner) return t('statusWon', { team: teamName(s.winner) });
  if (isAiTurn()) return t('statusThinking', { team: teamName(s.turn) });
  return t('statusTurn', { team: teamName(s.turn) });
}

function refresh() {
  const s = st();
  const locked = !canHumanAct();
  const targets = ui.selected && !locked ? pieceMoves(s, ui.selected).map((m) => m.to) : [];
  renderer.setInteraction({
    turn: s.turn,
    movable: locked ? new Set() : movablePieces(),
    selected: locked ? null : ui.selected,
    targets,
    locked: !!s.winner,
  });

  for (const team of ['W', 'B']) {
    const card = $(`#card-${team}`);
    const done = doneCount(s, team);
    card.classList.toggle('is-turn', s.turn === team && !s.winner);
    card.classList.toggle('is-thinking', ui.thinking && s.turn === team);
    card.querySelectorAll('.pip').forEach((pip, i) => pip.classList.toggle('is-filled', i < done));
    card.querySelector('.pips').setAttribute('aria-label', t('pipsLabel', { done }));
    card.querySelector('.player-meta').innerHTML = t('meta', { done, waiting: waitingCount(s, team) });
    const role = card.querySelector('.player-role');
    role.textContent = settings.mode === 'ai' ? t(team === settings.human ? 'roleYou' : 'roleAI') : '';
    card.querySelector('.turn-badge').textContent =
      ui.thinking && s.turn === team ? t('badgeThinking') : settings.mode === 'ai' && team === settings.human ? t('badgeYourMove') : t('badgeToMove');
  }
  $('#btn-undo').disabled = !game.history.length || (ui.busy && !ui.thinking);
  $('#ai-options').hidden = settings.mode !== 'ai';
}

function describe(events) {
  const parts = [];
  for (const ev of events) {
    const elf = ev.team && t(`elfA_${ev.team}`);
    const troll = ev.team && t(`troll_${ev.team}`);
    if (ev.type === 'move' && ev.kind === 'elf' && !events.some((e) => e.type === 'finish')) parts.push(t('evElf', { elf }));
    if (ev.type === 'move' && ev.kind === 'troll' && !events.some((e) => e.type === 'bonk' || e.type === 'trollReset')) parts.push(t('evTroll', { troll }));
    if (ev.type === 'finish') parts.push(t('evFinish', { elf, n: doneCount(st(), ev.team) }));
    if (ev.type === 'bonk') parts.push(t(ev.ids.length > 1 ? 'evBonkN' : 'evBonk1', { troll, n: ev.ids.length }));
    if (ev.type === 'trollReset') parts.push(t('evReset', { troll }));
    if (ev.type === 'pass') parts.push(t('evPass', { team: teamName(ev.team) }));
  }
  return parts.join(' ');
}

/* ---------------- Game flow ---------------- */
async function doMove(move) {
  const prev = st();
  game.history.push(prev);
  ui.selected = null;
  ui.busy = true;
  const { state: next, events } = applyMove(prev, move);
  refresh();
  await renderer.play(events, next);
  game.state = next;
  ui.busy = false;
  ui.lastEvents = events;
  save();
  setStatus(describe(events) || defaultStatus());
  refresh();
  if (next.winner) return showWin(next.winner);
  setTimeout(() => {
    if (!ui.busy && st() === next) {
      ui.lastEvents = null;
      setStatus(defaultStatus());
    }
  }, 2600);
  maybeAI();
}

async function maybeAI() {
  if (!isAiTurn() || ui.busy) return;
  const token = ++ui.aiToken;
  ui.busy = true;
  ui.thinking = true;
  setStatus(defaultStatus());
  refresh();
  const started = performance.now();
  const move = await askAI(st(), settings.level, token);
  const wait = Math.max(0, 550 - (performance.now() - started));
  await new Promise((r) => setTimeout(r, wait));
  if (token !== ui.aiToken) return; // cancelled (undo / new game)
  ui.thinking = false;
  ui.busy = false;
  if (move) doMove(move);
  else refresh();
}

function cancelAI() {
  ui.aiToken++;
  ui.thinking = false;
  ui.busy = false;
}

function onPiece(id) {
  if (!canHumanAct()) return;
  if (movablePieces().has(id)) {
    ui.selected = ui.selected === id ? null : id;
  } else {
    ui.selected = null;
  }
  refresh();
}

function onNode(nodeId) {
  if (!canHumanAct()) return;
  if (ui.selected && nodeId) {
    const move = pieceMoves(st(), ui.selected).find((m) => m.to === nodeId);
    if (move) return void doMove(move);
  }
  if (ui.selected) {
    ui.selected = null;
    refresh();
  }
}

function undo() {
  if (!game.history.length || (ui.busy && !ui.thinking)) return;
  cancelAI();
  $('#win-dialog').open && $('#win-dialog').close();
  do {
    game.state = game.history.pop();
  } while (settings.mode === 'ai' && game.history.length && st().turn !== settings.human);
  ui.selected = null;
  renderer.layout(st());
  save();
  ui.lastEvents = null;
  setStatus(t('undone'));
  refresh();
  maybeAI();
}

function newGame() {
  cancelAI();
  $('#win-dialog').open && $('#win-dialog').close();
  game = { state: initialState(), history: [] };
  ui.selected = null;
  ui.lastEvents = null;
  renderer.layout(st());
  save();
  setStatus(defaultStatus());
  refresh();
  maybeAI();
}

function fillWinDialog(team) {
  $('#win-title').textContent = t('winTitle', { team: teamName(team) });
  $('#win-quote').textContent = VICTORY_QUOTE[team];
  $('#win-trans').textContent = `“${t(`winTrans_${team}`)}”`;
}

function showWin(team) {
  renderer.celebrate();
  fillWinDialog(team);
  $('#win-token').replaceChildren(miniElf(team));
  setTimeout(() => $('#win-dialog').showModal(), 900);
}

function miniElf(team) {
  const s = svg('svg', { viewBox: '-24 -24 48 48', 'aria-hidden': 'true' });
  s.appendChild(createElf(team));
  return s;
}

/* ---------------- Wiring ---------------- */
function initUI() {
  for (const team of ['W', 'B']) {
    const card = $(`#card-${team}`);
    card.querySelector('.player-token').appendChild(miniElf(team));
    const pips = card.querySelector('.pips');
    for (let i = 0; i < ELVES_PER_TEAM; i++) pips.appendChild(Object.assign(document.createElement('span'), { className: 'pip' }));
  }

  $('#btn-new').addEventListener('click', newGame);
  $('#btn-undo').addEventListener('click', undo);
  $('#btn-rules').addEventListener('click', () => $('#rules-dialog').showModal());
  $('#btn-again').addEventListener('click', newGame);
  $('#btn-lang').addEventListener('click', () => setLang(getLang() === 'he' ? 'en' : 'he'));
  onLangChange(() => {
    renderer.relabel();
    setStatus(ui.lastEvents ? describe(ui.lastEvents) : defaultStatus());
    if (st().winner) fillWinDialog(st().winner);
    refresh();
  });

  // Click on the backdrop closes a dialog (the dialog body fills the box, so
  // a click whose target is the <dialog> itself must be on the backdrop).
  for (const dlg of document.querySelectorAll('dialog')) {
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg) dlg.close();
    });
  }

  document.querySelectorAll('input[name="mode"]').forEach((input) => {
    input.checked = input.value === settings.mode;
    input.addEventListener('change', () => {
      settings.mode = input.value;
      changeSettings();
    });
  });
  $('#side').value = settings.human;
  $('#level').value = settings.level;
  $('#side').addEventListener('change', (e) => {
    settings.human = e.target.value;
    changeSettings();
  });
  $('#level').addEventListener('change', (e) => {
    settings.level = e.target.value;
    save();
  });

  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, select, dialog')) return;
    if (e.key === 'Escape' && ui.selected) {
      ui.selected = null;
      refresh();
    } else if ((e.key === 'z' && (e.metaKey || e.ctrlKey)) || e.key === 'u') {
      e.preventDefault();
      undo();
    }
  });
}

function changeSettings() {
  cancelAI();
  ui.selected = null;
  save();
  setStatus(defaultStatus());
  refresh();
  maybeAI();
}

function boot() {
  load();
  applyStatic();
  renderer = new Renderer($('#board'), { onPiece, onNode });
  renderer.relabel();
  initUI();
  renderer.layout(st(), { animate: false });
  setStatus(defaultStatus());
  refresh();
  if (st().winner) setStatus(defaultStatus());
  else maybeAI();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
