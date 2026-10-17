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
  bonk: 'טראח!',
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

export const getLang = () => lang;

export function t(key, vars = {}) {
  const str = DICTS[lang][key] ?? en[key] ?? key;
  return str.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}

/** Translate everything marked with data-i18n* attributes and set lang/dir. */
export function applyStatic(root = document) {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
  document.title = t('docTitle');
  document.querySelector('meta[name="description"]')?.setAttribute('content', t('docDesc'));
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll('[data-i18n-html]')) el.innerHTML = t(el.dataset.i18nHtml);
  for (const el of root.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria));
  for (const el of root.querySelectorAll('[data-i18n-title]')) el.setAttribute('title', t(el.dataset.i18nTitle));
}

export function setLang(next) {
  if (!DICTS[next] || next === lang) return;
  lang = next;
  try { localStorage.setItem(LANG_STORE_KEY, lang); } catch { /* ignore */ }
  applyStatic();
  listeners.forEach((fn) => fn(lang));
}

export const onLangChange = (fn) => listeners.add(fn);
