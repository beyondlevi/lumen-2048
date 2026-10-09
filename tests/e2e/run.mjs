// Plays the built game in a real browser with the band's keys and saves a screenshot of each
// screen to .e2e-output/. Run after `npm run build`: node tests/e2e/run.mjs.
// CHROME_PATH=/path/to/chrome uses an installed Chrome instead of Playwright's Chromium;
// E2E_BROWSERS=chromium,firefox picks the engines (default: chromium, plus firefox if installed).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {chromium, firefox} from 'playwright';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const dist = path.join(root, 'dist');
const out = path.join(root, '.e2e-output');
fs.mkdirSync(out, {recursive: true});

const TYPES = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain'};
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const file = path.join(dist, decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
  if (!file.startsWith(dist) || !fs.existsSync(file)) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, {'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream'}).end(fs.readFileSync(file));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/`;

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
  if (!ok) failures++;
}

// The palette's text colors (text, sub, hint, accent) and the tiles' number colors.
const TEXT_COLORS = ['#E2FFEE', '#B8FFD6', '#8DF0B5', '#F0FFF6', '#C6FFDD', '#D6FFE6', '#FFFFFF', '#021008', '#000000'];

// One move left on this board (16 + 16, to the left); after it, no move whatever tile comes in.
const LAST_MOVE = [[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 8], [4, 2, 16, 16]];
// Left: 1024 + 1024 makes the design's "2048 reached" board (with one more empty cell, so the game
// can go on after "Keep going": the design's board has no moves left).
const NEAR_WIN = [[2, 4, 8, 0], [4, 16, 32, 8], [16, 64, 256, 2], [8, 128, 1024, 1024]];
// Right: 32 + 32 makes 64, the design's playing board.
const MID = [[0, 2, 4, 16], [2, 8, 32, 32], [0, 4, 128, 256], [0, 2, 16, 512]];
const LATE = [[4096, 2048, 1024, 512], [32, 64, 128, 256], [16, 8, 4, 2], [0, 2, 0, 4]];

async function playIn(browser, name, lang) {
  const context = await browser.newContext({viewport: {width: 600, height: 600}});
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const external = [];
  page.on('request', (r) => { if (!r.url().startsWith(base)) external.push(r.url()); });

  const tag = lang === 'en' ? name : `${name}-pt`;
  const t = (label) => `${tag}: ${label}`;
  const ready = async () => {
    await page.waitForFunction(() => window.__g2048 && document.fonts.status === 'loaded' && !document.getElementById('game').classList.contains('loading'));
    await page.waitForTimeout(200);
  };
  await page.goto(`${base}?test=1&seed=42&lang=${lang === 'en' ? 'en' : 'pt-PT'}`);
  await ready();

  const state = () => page.evaluate(() => window.__g2048.state());
  const shot = (file) => page.screenshot({path: path.join(out, `${tag}-${file}.png`)});
  const key = async (k, wait = 60) => { await page.keyboard.press(k); await page.waitForTimeout(wait); };
  const settle = () => page.waitForTimeout(1100);
  const set = (rows, score) => page.evaluate(([r, s]) => window.__g2048.set(r, s), [rows, score]);
  const text = (selector) => page.evaluate((s) => document.querySelector(s)?.textContent ?? null, selector);
  const visible = (selector) => page.evaluate((s) => { const el = document.querySelector(s); return !!el && el.getClientRects().length > 0; }, selector);
  // Lumen's Back: an Escape keydown and keyup sent to the focused element. True if the page took it.
  const back = () => page.evaluate(() => {
    const target = document.activeElement ?? document.body;
    const init = {key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true, cancelable: true};
    const down = new KeyboardEvent('keydown', init);
    target.dispatchEvent(down);
    target.dispatchEvent(new KeyboardEvent('keyup', init));
    return down.defaultPrevented;
  });
  /** Presses arrows until the board changes; returns whether it did. */
  const anyMove = async () => {
    const before = JSON.stringify((await state()).rows);
    for (const k of ['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp']) {
      await key(k, 150);
      if (JSON.stringify((await state()).rows) !== before) return true;
    }
    return false;
  };
  /** The tiles drawn on screen, as rows, from their places on the board. */
  const drawn = () => page.evaluate(() => {
    const rows = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
    const board = document.querySelector('.board').getBoundingClientRect();
    for (const tile of document.querySelectorAll('.board .tile')) {
      const r = tile.getBoundingClientRect();
      const col = Math.round((r.left - board.left - 10) / 110);
      const row = Math.round((r.top - board.top - 10) / 110);
      if (rows[row]?.[col] === 0) rows[row][col] = Number(tile.dataset.value);
      else rows[0][0] = -1; // two tiles in one cell, or one off the board
    }
    return rows;
  });
  /** Texts under 14 px, out of the 600 x 600 screen, overflowing their box, or in a faint color. */
  const layout = () => page.evaluate((colors) => {
    const hex = (rgb) => '#' + rgb.match(/\d+/g).slice(0, 3).map((n) => Number(n).toString(16).padStart(2, '0')).join('').toUpperCase();
    const problems = [];
    for (const el of document.querySelectorAll('#game *')) {
      if (!el.getClientRects().length) continue;
      const style = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const name = `${el.tagName.toLowerCase()}.${el.className?.baseVal ?? el.className}`;
      if (style.display !== 'inline' && el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1) problems.push(`${name} overflows ${el.scrollWidth} > ${el.clientWidth}`);
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!own) continue;
      if (parseFloat(style.fontSize) < 14) problems.push(`${name} ${style.fontSize}`);
      if (r.left < 0 || r.right > 600 || r.top < 0 || r.bottom > 600) problems.push(`${name} off screen ${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}`);
      // Inside its parent's padding (the +64 gain sits outside the SCORE box on purpose).
      const parent = el.parentElement;
      if (style.position !== 'absolute' && parent && parent.id !== 'game') {
        const p = parent.getBoundingClientRect();
        const ps = getComputedStyle(parent);
        const inner = {
          left: p.left + parseFloat(ps.borderLeftWidth) + parseFloat(ps.paddingLeft) - 1,
          right: p.right - parseFloat(ps.borderRightWidth) - parseFloat(ps.paddingRight) + 1,
        };
        if (r.left < inner.left || r.right > inner.right) problems.push(`${name} outside its parent's padding ${Math.round(r.left)}..${Math.round(r.right)} in ${Math.round(inner.left)}..${Math.round(inner.right)}`);
      }
      if (!colors.includes(hex(style.color))) problems.push(`${name} color ${hex(style.color)}`);
    }
    return problems;
  }, TEXT_COLORS);
  const checkLayout = async (label) => {
    const problems = await layout();
    check(t(`${label}: texts >= 14 px, bright, inside the screen`), problems.length === 0, problems.join('; '));
  };
  const fmt = (n) => new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'pt-BR').format(n);

  // 1. The first game: two tiles and the card, gone with the first swipe.
  let s = await state();
  check(t('a new game, with two tiles and the first card'), s.screen === 'board' && s.firstCard && s.rows.flat().filter(Boolean).length === 2 && await visible('.first'));
  check(t('the board has the focus'), s.active === 'board', s.active);
  const box = await page.evaluate(() => document.getElementById('game').getBoundingClientRect().toJSON());
  check(t('the game fits in 600 x 600'), box.left >= 0 && box.top >= 0 && box.right <= 600 && box.bottom <= 600 && box.width === 600, JSON.stringify(box));
  await checkLayout('first card');
  await shot('01-first');
  const start = JSON.stringify(s.rows);
  await key('ArrowDown', 300);
  s = await state();
  check(t('the first swipe hides the card'), !s.firstCard && !(await visible('.first')));

  // 2. Arrows move the tiles; merges score.
  let moves = JSON.stringify(s.rows) === start ? 0 : 1;
  for (let i = 0; i < 80 && (await state()).score === 0; i++) {
    if (await anyMove()) moves++;
  }
  s = await state();
  check(t('the arrows move the tiles and the score goes up'), moves > 0 && s.score > 0, `score ${s.score} after ${moves} moves`);
  await settle();
  check(t('the tiles on screen are the board'), JSON.stringify(await drawn()) === JSON.stringify(s.rows), JSON.stringify(await drawn()));
  check(t('the header shows the score'), (await text('.stat-value')) === fmt(s.score), await text('.stat-value'));

  // Two swipes at once: the second ends the first's slide, and the screen still matches.
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowRight');
  await settle();
  check(t('quick swipes leave the right board'), JSON.stringify(await drawn()) === JSON.stringify((await state()).rows));
  // Back on screen after a hidden spell: drawn again from the state.
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  check(t('drawn again when visible'), JSON.stringify(await drawn()) === JSON.stringify((await state()).rows));

  // The design's playing board: 32 + 32 just merged into 64 (+64), a new 2 coming in.
  await set(MID, 6780);
  await key('ArrowRight', 260);
  s = await state();
  check(t('32 + 32 makes 64 and 64 points'), s.score === 6844 && s.rows[1][3] === 64, `score ${s.score}`);
  check(t('the gain shows'), (await text('.gain')) === `+64` && await page.evaluate(() => Number(getComputedStyle(document.querySelector('.gain')).opacity) > 0.5));
  check(t('numbers in the language'), (await text('.stat-value')) === (lang === 'en' ? '6,844' : '6.844'), await text('.stat-value'));
  await shot('02-main');
  await settle();
  await checkLayout('board');

  // 3. Back on the board is Lumen's: the app closes (the game is saved).
  check(t('Escape on the board is not prevented'), (await back()) === false && (await state()).screen === 'board');

  // 4. The menu: index tap, the focus on Undo, up and down move it, Back closes it.
  await key('Enter');
  s = await state();
  check(t('Enter opens the menu, focus on Undo'), s.screen === 'menu' && s.active === 'undo' && await visible('.menu'), `${s.screen} ${s.active}`);
  const dim = await page.evaluate(() => [getComputedStyle(document.querySelector('.board')).opacity, getComputedStyle(document.querySelector('.head')).opacity]);
  check(t('the board dims behind it'), dim[0] === '0.14' && dim[1] === '0.22', dim.join(' '));
  await checkLayout('menu');
  await shot('03-menu');
  const path1 = [];
  for (const k of ['ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowUp']) {
    await key(k);
    path1.push((await state()).active);
  }
  check(t('the arrows move the focus through the rows'), path1.join() === 'new,howto,howto,new,new,undo', path1.join());
  check(t('Escape in the menu is prevented and closes it'), (await back()) === true && (await state()).screen === 'board');

  // 5. Undo with two index taps.
  const before = await state();
  check(t('a move to undo'), await anyMove());
  await key('Enter');
  await key('Enter');
  s = await state();
  check(t('two index taps undo the move'), s.screen === 'board' && JSON.stringify(s.rows) === JSON.stringify(before.rows) && s.score === before.score && !s.canUndo);
  await settle();
  check(t('the undone board on screen'), JSON.stringify(await drawn()) === JSON.stringify(s.rows));
  await key('Enter');
  s = await state();
  check(t('then Undo is off ("none yet") and the focus on New game'), s.active === 'new' && await page.evaluate(() => document.querySelector('[data-row="undo"]').disabled) && await visible('.menu .row-note'));
  await checkLayout('menu with no undo');
  await shot('04-menu-no-undo');
  await back();

  // 6. New game? Back goes to the menu; Keep playing keeps the game; Start over starts one.
  await anyMove();
  const score = (await state()).score;
  await key('Enter');
  await key('ArrowDown');
  await key('Enter');
  s = await state();
  check(t('New game asks first'), s.screen === 'newgame' && s.active === 'start' && (await text('.newgame .panel-sub')).includes(fmt(score)), await text('.newgame .panel-sub'));
  await checkLayout('new game');
  await shot('05-newgame');
  check(t('Escape in New game? goes back to the menu'), (await back()) === true && (await state()).screen === 'menu' && (await state()).active === 'new');
  await key('Enter');
  await key('ArrowDown');
  await key('Enter');
  s = await state();
  check(t('Keep playing keeps the game'), s.screen === 'board' && s.score === score);
  await key('Enter');
  await key('ArrowDown');
  await key('Enter');
  await key('Enter');
  s = await state();
  check(t('Start over starts a new game'), s.screen === 'board' && s.score === 0 && s.rows.flat().filter(Boolean).length === 2 && !s.firstCard);

  // 7. How to play, and back to the menu.
  await key('Enter');
  await key('ArrowDown');
  await key('Enter');
  s = await state();
  check(t('How to play'), s.screen === 'howto' && await visible('.howto') && !(await visible('.board')));
  await checkLayout('how to play');
  await shot('06-howto');
  check(t('Escape in How to play goes back to the menu'), (await back()) === true && (await state()).screen === 'menu' && (await state()).active === 'howto');
  await key('Enter');
  await key('Enter');
  check(t('the index tap goes back too'), (await state()).screen === 'menu');
  await back();

  // 8. No moves left (a full board), with NEW BEST.
  await set(LAST_MOVE, 7180);
  await key('ArrowLeft', 1100);
  s = await state();
  check(t('a full board with no moves: No moves left'), s.screen === 'over' && s.active === 'new' && await visible('.over') && s.score === 7212);
  check(t('it is a new best'), await visible('.over-best'));
  await checkLayout('no moves left');
  await shot('07-over');
  check(t('Escape on No moves left is not prevented (exit)'), (await back()) === false && (await state()).screen === 'over');
  await key('ArrowDown');
  await key('Enter');
  s = await state();
  check(t('Undo leaves No moves left'), s.screen === 'board' && JSON.stringify(s.rows) === JSON.stringify(LAST_MOVE) && s.score === 7180);
  await key('ArrowLeft', 400);
  await key('Enter');
  s = await state();
  check(t('New game from No moves left'), s.screen === 'board' && s.score === 0);

  // 9. The 2048 tile: once per game; Back is Keep going.
  await set(NEAR_WIN, 18336);
  await key('ArrowLeft', 1100);
  s = await state();
  check(t('the 2048 tile: You made 2048!'), s.screen === 'won' && s.active === 'continue' && await visible('.won') && s.score === 20384);
  await checkLayout('2048');
  await shot('08-won');
  check(t('Escape on You made 2048! keeps going'), (await back()) === true && (await state()).screen === 'board');
  await anyMove();
  check(t('only once per game'), (await state()).screen === 'board');

  // 10. Every tile at once.
  await set(LATE, 61932);
  await settle();
  check(t('the late game on screen'), JSON.stringify(await drawn()) === JSON.stringify(LATE));
  await checkLayout('late game');
  await shot('09-late');

  // 11. A reload brings the same game back.
  await set(MID, 6780);
  await anyMove();
  await anyMove();
  const kept = await state();
  await page.reload();
  await ready();
  s = await state();
  check(t('a reload keeps the game'), JSON.stringify(s.rows) === JSON.stringify(kept.rows) && s.score === kept.score && s.best === kept.best && s.canUndo === kept.canUndo && !s.firstCard);
  check(t('and draws it'), JSON.stringify(await drawn()) === JSON.stringify(s.rows) && s.active === 'board');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('lumen-2048')));
  check(t('saved under "lumen-2048"'), JSON.stringify(saved.board) === JSON.stringify(s.rows) && saved.firstSeen === true);
  // A broken save starts a new game. It's written from a page of the same origin that isn't the
  // game: the game saves itself when it's hidden, so it would write over it on the way out.
  await page.goto(`${base}fonts/OFL-Bungee.txt`);
  await page.evaluate(() => localStorage.setItem('lumen-2048', '{broken'));
  await page.goto(`${base}?test=1&seed=42&lang=${lang === 'en' ? 'en' : 'pt-PT'}`);
  await ready();
  s = await state();
  check(t('a broken save starts a new game'), s.screen === 'board' && s.score === 0 && s.rows.flat().filter(Boolean).length === 2);

  check(t('no page errors'), errors.length === 0, errors.join(' | '));
  check(t('nothing loaded from outside the package'), external.length === 0, external.join(', '));
  await context.close();
}

async function play(browserType, name) {
  const browser = await browserType.launch(process.env.CHROME_PATH && name === 'chromium' ? {executablePath: process.env.CHROME_PATH} : {});
  try {
    for (const lang of ['en', 'pt']) await playIn(browser, name, lang);
  } finally {
    await browser.close();
  }
}

const wanted = (process.env.E2E_BROWSERS ?? 'chromium,firefox').split(',');
const engines = {chromium, firefox};
for (const name of wanted) {
  try {
    await play(engines[name], name);
  } catch (error) {
    if (name === 'firefox' && !process.env.E2E_BROWSERS && /Executable doesn't exist/.test(String(error))) {
      console.log('skip firefox (not installed)');
      continue;
    }
    console.log(`FAIL ${name}: ${error.message}`);
    failures++;
  }
}
server.close();
console.log(failures ? `${failures} failed` : 'all passed');
process.exit(failures ? 1 : 0);
