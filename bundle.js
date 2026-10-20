// Elfish Checkers — Standalone Bundle (Zero dependencies, works in file:// and http://)
(function() {
  'use strict';

  // ==================== src/game/board.js ====================
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

  const TEAMS = ['W', 'B'];
  const HOME = { W: 'W', B: 'B' };
  const ENEMY = { W: 'B', B: 'W' };
  const other = (team) => ENEMY[team];

  const VIEW = { w: 600, h: 840 };
  const OVAL = { rx: 100, ry: 44 };

  const ROW_WIDTH = [1, 4, 3, 4, 3, 4, 1];
  const ROW_Y = [742, 632, 526, 420, 314, 208, 98];
  const X4 = [120, 240, 360, 480];
  const X3 = [180, 300, 420];

  /** @type {Record<string, {id:string,row:number,col:number,x:number,y:number,kind:'oval'|'circle'}>} */
  const NODES = {};
  /** Undirected edges as [a, b] pairs (for drawing). */
  const EDGES = [];
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

  const isOval = (id) => NODES[id].kind === 'oval';

  /** Neighbours of `id` that are one step *forward* for `team`. */
  function forward(id, team) {
    const row = NODES[id].row;
    return ADJ[id].filter((n) => (team === 'W' ? NODES[n].row > row : NODES[n].row < row));
  }

  /** How far a node is along `team`'s journey (0 = own home, 6 = enemy home). */
  function progress(id, team) {
    const row = NODES[id].row;
    return team === 'W' ? row : 6 - row;
  }

  /** The 7 starting circles of a team (its first two rows). */
  function startCircles(team) {
    const rows = team === 'W' ? [1, 2] : [5, 4];
    return rows.flatMap((r) => Array.from({ length: ROW_WIDTH[r] }, (_, c) => circleId(r, c)));
  }

  // ==================== src/game/rules.js ====================
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

  const ELVES_PER_TEAM = 7;
  const MAX_ELVES_PER_CIRCLE = 2;
  const trollId = (team) => `T${team}`;

  function initialState() {
    const elves = [];
    for (const team of ['W', 'B']) {
      startCircles(team).forEach((node, i) => elves.push({ id: `${team}${i}`, team, node, done: false }));
    }
    return { turn: 'W', trolls: { W: HOME.W, B: HOME.B }, elves, winner: null, ply: 0 };
  }

  function cloneState(s) {
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
  function pieceMoves(s, pieceId) {
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
  function legalMoves(s, { dedupe = false } = {}) {
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
  function applyMove(s0, move) {
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

  const doneCount = (s, team) => s.elves.filter((e) => e.team === team && e.done).length;
  const waitingCount = (s, team) =>
    s.elves.filter((e) => e.team === team && !e.done && e.node === HOME[team]).length;

  // ==================== src/game/ai.js ====================
  /**
   * Simple AI: negamax + alpha-beta with iterative deepening and a time budget.
   */


  const LEVELS = {
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

  function evaluate(s, team) {
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
  function chooseMove(s, level = 'normal') {
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

  // ==================== src/i18n.js ====================
  /** Tiny i18n layer: English + Hebrew (RTL). */

  const LANG_STORE_KEY = 'elfish-checkers:lang';

  const en = {
    docTitle: 'Elfish Checkers — a Tolkien-inspired race of elves & trolls',
    docDesc: "Elfish Checkers: guide your seven elves across the board to the enemy's home while two grumpy trolls stomp about bonking heads. Play with a friend or against the computer.",
    title: 'Elfish Checkers',
    tagline: 'White elves · Black elves · Two very grumpy trolls',
    langSwitch: 'עברית',
    langSwitchLabel: 'החלפה לעברית',
    rules: 'Rules',
    undo: 'Undo',
    undoTitle: 'Undo (U)',
    newGame: 'New game',
    actionsLabel: 'Game actions',
    boardLabel: 'Game board',
    boardSvgLabel: 'Elfish Checkers board',
    team_W: 'White Elves',
    team_B: 'Black Elves',
    sub_W: 'Calaquendi · Elves of the Light',
    sub_B: 'Moriquendi · Elves of the Darkness',
    meta: '<b>{done}</b>/7 arrived · <b>{waiting}</b> waiting at home',
    pipsLabel: '{done} of 7 elves arrived',
    badgeToMove: 'To move',
    badgeYourMove: 'Your move',
    badgeThinking: 'Thinking…',
    roleYou: 'You',
    roleAI: 'Computer',
    modeLabel: 'Game mode',
    modePvp: '2 Players',
    modeAi: 'vs Computer',
    youPlay: 'You play',
    white: 'White',
    black: 'Black',
    difficulty: 'Difficulty',
    easy: 'Easy',
    normal: 'Normal',
    hard: 'Hard',
    statusTurn: '<strong>{team}</strong> to move — choose an elf or your troll.',
    statusThinking: '<strong>{team}</strong> are pondering…',
    statusWon: '<strong>{team}</strong> have won the race!',
    elfA_W: 'A white elf',
    elfA_B: 'A black elf',
    troll_W: 'The white troll',
    troll_B: 'The black troll',
    pieceElf_W: 'White elf',
    pieceElf_B: 'Black elf',
    pieceTroll_W: 'White troll',
    pieceTroll_B: 'Black troll',
    moveHere: 'Move here',
    evElf: '{elf} steps forward.',
    evTroll: '{troll} stomps forward.',
    evFinish: '{elf} reaches the far oval! <strong>{n}/7</strong>',
    evBonk1: '<strong>BONK!</strong> {troll} sends an elf home.',
    evBonkN: '<strong>BONK!</strong> {troll} sends {n} elves home.',
    evReset: '{troll} crossed the board and trudges home.',
    evPass: '{team} have no move and pass.',
    undone: 'Move undone.',
    bonk: 'BONK!',
    rulesTitle: 'How to play',
    rulesLede: "Lead all seven of your elves to the enemy's home before they reach yours.",
    rule1: 'Each side starts with <b>7 elves</b> on its first two rows and a <b>troll</b> in its home oval. White moves first.',
    rule2: 'On your turn, move <b>one piece one step</b> forward along a line: one of your elves <i>or</i> your troll.',
    rule3: 'A circle can hold <b>at most two elves</b>, white and black together is fine. Elves never fight each other.',
    rule4: "An elf may <b>never step onto a troll's circle</b>. Home ovals are always open.",
    rule5: 'When a troll steps onto elves it <b>bonks them on the head</b>, even its own team, and they return to <b>their own home oval</b>, starting again from there.',
    rule6: 'A troll that reaches the enemy oval trudges straight back to its own home.',
    rule7: "The first side to bring <b>all 7 elves into the enemy's home oval</b> wins.",
    gotIt: 'Got it',
    winTitle: 'The {team} are victorious!',
    winTrans_W: 'Hail Eärendil, brightest of stars!',
    winTrans_B: 'The day has come!',
    viewBoard: 'View board',
    playAgain: 'Play again',
  };

  const he = {
    docTitle: 'דמקת האלפים — מרוץ של אלפים וטרולים בהשראת טולקין',
    docDesc: 'דמקת האלפים: הובילו את שבעת האלפים שלכם אל בית היריב, בזמן ששני טרולים רגזנים רוקעים על הלוח ומכים בראשים. שחקו עם חבר או נגד המחשב.',
    title: 'דמקת האלפים',
    tagline: 'אלפים לבנים · אלפים שחורים · שני טרולים רגזנים במיוחד',
    langSwitch: 'English',
    langSwitchLabel: 'Switch to English',
    rules: 'חוקים',
    undo: 'ביטול',
    undoTitle: 'ביטול מהלך (U)',
    newGame: 'משחק חדש',
    actionsLabel: 'פעולות משחק',
    boardLabel: 'לוח המשחק',
    boardSvgLabel: 'לוח דמקת האלפים',
    team_W: 'האלפים הלבנים',
    team_B: 'האלפים השחורים',
    sub_W: 'קָלָקְוֶנְדִי · אלפי האור',
    sub_B: 'מוֹרִיקְוֶנְדִי · אלפי החשכה',
    meta: '<b>{done}</b>/7 הגיעו · <b>{waiting}</b> ממתינים בבית',
    pipsLabel: '{done} מתוך 7 אלפים הגיעו',
    badgeToMove: 'תורם',
    badgeYourMove: 'תורך',
    badgeThinking: 'חושב…',
    roleYou: 'את/ה',
    roleAI: 'מחשב',
    modeLabel: 'מצב משחק',
    modePvp: '2 שחקנים',
    modeAi: 'נגד המחשב',
    youPlay: 'הצד שלך',
    white: 'לבנים',
    black: 'שחורים',
    difficulty: 'רמת קושי',
    easy: 'קל',
    normal: 'רגיל',
    hard: 'קשה',
    statusTurn: 'תור <strong>{team}</strong> — בחרו אלף או את הטרול.',
    statusThinking: '<strong>{team}</strong> שוקלים את צעדם…',
    statusWon: '<strong>{team}</strong> ניצחו במרוץ!',
    elfA_W: 'אלף לבן',
    elfA_B: 'אלף שחור',
    troll_W: 'הטרול הלבן',
    troll_B: 'הטרול השחור',
    pieceElf_W: 'אלף לבן',
    pieceElf_B: 'אלף שחור',
    pieceTroll_W: 'טרול לבן',
    pieceTroll_B: 'טרול שחור',
    moveHere: 'הזזה לכאן',
    evElf: '{elf} צועד קדימה.',
    evTroll: '{troll} רוקע קדימה.',
    evFinish: '{elf} הגיע לאליפסה הרחוקה! <strong>{n}/7</strong>',
    evBonk1: '<strong>טראח!</strong> {troll} שולח אלף הביתה.',
    evBonkN: '<strong>טראח!</strong> {troll} שולח {n} אלפים הביתה.',
    evReset: '{troll} חצה את הלוח ומדדה חזרה הביתה.',
    evPass: 'ל{team} אין מהלך — התור עובר.',
    undone: 'המהלך בוטל.',
    bonk: 'BONK!',
    rulesTitle: 'איך משחקים',
    rulesLede: 'הובילו את כל שבעת האלפים שלכם אל בית היריב לפני שאלפיו יגיעו לביתכם.',
    rule1: 'לכל צד <b>7 אלפים</b> על שתי השורות הראשונות שלו ו<b>טרול</b> באליפסת הבית. הלבנים מתחילים.',
    rule2: 'בכל תור מזיזים <b>כלי אחד צעד אחד</b> קדימה לאורך קו: אחד האלפים שלכם <i>או</i> את הטרול שלכם.',
    rule3: 'בעיגול יכולים לעמוד <b>לכל היותר שני אלפים</b>, גם לבן ושחור יחד. אלפים לעולם אינם נלחמים זה בזה.',
    rule4: 'אלף <b>לעולם לא נכנס לעיגול שבו עומד טרול</b>. אליפסות הבית תמיד פתוחות.',
    rule5: 'כשטרול עולה על אלפים הוא <b>מכה אותם בראש</b>, גם את אלה מהקבוצה שלו, והם חוזרים <b>לאליפסת הבית שלהם</b> ומתחילים משם מחדש.',
    rule6: 'טרול שמגיע לאליפסת היריב חוזר מיד לביתו.',
    rule7: 'הצד הראשון שמביא <b>את כל 7 האלפים לאליפסת הבית של היריב</b> מנצח.',
    gotIt: 'הבנתי',
    winTitle: '{team} ניצחו!',
    winTrans_W: 'שלום לך ארנדיל, הבהיר בכוכבים!',
    winTrans_B: 'היום הגיע!',
    viewBoard: 'צפייה בלוח',
    playAgain: 'משחק נוסף',
  };

  const DICTS = { en, he };
  const listeners = new Set();

  let lang = (() => {
    const fromUrl = new URLSearchParams(location.search).get('lang');
    if (fromUrl && DICTS[fromUrl]) return fromUrl;
    try {
      const saved = localStorage.getItem(LANG_STORE_KEY);
      if (saved && DICTS[saved]) return saved;
    } catch { /* ignore */ }
    return navigator.language?.toLowerCase().startsWith('he') ? 'he' : 'en';
  })();

  const getLang = () => lang;

  function t(key, vars = {}) {
    const str = DICTS[lang][key] ?? en[key] ?? key;
    return str.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
  }

  /** Translate everything marked with data-i18n* attributes and set lang/dir. */
  function applyStatic(root = document) {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
    document.title = t('docTitle');
    document.querySelector('meta[name="description"]')?.setAttribute('content', t('docDesc'));
    for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
    for (const el of root.querySelectorAll('[data-i18n-html]')) el.innerHTML = t(el.dataset.i18nHtml);
    for (const el of root.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria));
    for (const el of root.querySelectorAll('[data-i18n-title]')) el.setAttribute('title', t(el.dataset.i18nTitle));
  }

  function setLang(next) {
    if (!DICTS[next] || next === lang) return;
    lang = next;
    try { localStorage.setItem(LANG_STORE_KEY, lang); } catch { /* ignore */ }
    applyStatic();
    listeners.forEach((fn) => fn(lang));
  }

  const onLangChange = (fn) => listeners.add(fn);

  // ==================== src/ui/pieces.js ====================
  /** SVG helpers and piece artwork (elf + troll tokens). */

  const NS = 'http://www.w3.org/2000/svg';

  function svg(tag, attrs = {}, parent) {
    const node = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (parent) parent.appendChild(node);
    return node;
  }

  /** Shared gradients / symbols. */
  function buildDefs(defs) {
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
  function createElf(team) {
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
    svg('circle', { cx: -3.5, cy: 2, r: 1.5, fill: 'hsl(180, 100%, 80%)' }, body);
    svg('circle', { cx: 3.5, cy: 2, r: 1.5, fill: 'hsl(180, 100%, 80%)' }, body);
    return g;
  }

  /** Troll token: mossy stone face with tusks, rimmed in its team colour. */
  function createTroll(team) {
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
    svg('circle', { class: 'troll-eye', cx: -6, cy: -2.5, r: 3 }, face);
    svg('circle', { cx: -6, cy: -2.5, r: 1.2, fill: '#111' }, face);
    svg('circle', { class: 'troll-eye', cx: 6, cy: -2.5, r: 3 }, face);
    svg('circle', { cx: 6, cy: -2.5, r: 1.2, fill: '#111' }, face);
    svg('path', { class: 'troll-nose', d: 'M-3,0.5 Q0,6 3,0.5' }, face);
    svg('path', { class: 'troll-mouth', d: 'M-10,9 Q0,13.5 10,9' }, face);
    svg('path', { class: 'troll-tusk', d: 'M-8,10 L-6,2 L-3,11 Z' }, face);
    svg('path', { class: 'troll-tusk', d: 'M8,10 L6,2 L3,11 Z' }, face);
    return g;
  }

  // ==================== src/ui/fx.js ====================
  /** One-shot visual effects (leaves, bonks, dust, sparkles). All use the Web Animations API. */

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
  function leafTrail(layer, from, to, duration) {
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
  function bonk(layer, p, count, label = 'BONK!') {
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
  function dust(layer, p, big = false) {
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
  function sparkle(layer, p) {
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
  function leafShower(layer, view, count = 46) {
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

  const fx = { leafTrail, bonk, dust, sparkle, leafShower };

  // ==================== src/ui/renderer.js ====================
  /** SVG board renderer: draws the board, positions pieces and plays move animations. */





  const WAIT_SLOTS = [[-48, -13], [-48, 13], [48, -13], [48, 13], [-74, 0], [74, 0], [0, 30]];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const tr = (p) => `translate(${p.x}px, ${p.y}px)`;

  /** Where every piece should sit for a given state. */
  function computeLayout(state) {
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

  class Renderer {
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
        g.style.opacity = '';
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
      const dx = to.x - from.x;
      for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        const wobble = dx * 0.1 * Math.sin(t * Math.PI);
        frames.push({
          transform: `translate(${from.x + dx * t}px, ${from.y + (to.y - from.y) * t - lift * 4 * t * (1 - t)}px) rotate(${wobble}deg)`,
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
          { transform: `scale(${s * 1.3}, ${s * 0.7})`, offset: 0.3 },
          { transform: `scale(${s * 0.9}, ${s * 1.1})`, offset: 0.65 },
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
          try {
            await g.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, fill: 'forwards' }).finished;
          } catch {}
          const home = final.get(id);
          this.cur.set(id, home);
          g.style.transform = tr(home);
          this.body(id).style.transform = `scale(${home.s})`;
          fx.dust(this.fxLayer, home, true);
          try {
            await g.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, fill: 'forwards' }).finished;
          } catch {}
          g.getAnimations().forEach((a) => a.cancel());
          g.style.opacity = '';
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

  // ==================== src/main.js ====================





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

})();
