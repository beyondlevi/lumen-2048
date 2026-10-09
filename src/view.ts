import {CELLS, SIZE} from './board';
import type {Game, Move, RowId, Screen} from './game';
import {type Strings, fill} from './i18n';
import {type IconName, icon} from './icons';
import {UI, numberSize, tileColors} from './palette';

/** How long the tiles slide, in ms (about 3 frames at the glasses' 30 fps). */
export const SLIDE_MS = 110;
const STEP = 110; // a tile and the gap after it
const INSET = 8; // the board's padding, inside its 2 px border

/** The screens that show over the dimmed board. */
const OVERLAYS: Screen[] = ['menu', 'newgame', 'won', 'over'];

const ROW_ICONS: Record<RowId, IconName> = {undo: 'undo', new: 'new', howto: 'help', start: 'new', keep: 'back', continue: 'play'};

/** Effects for a render right after a move: the merged tiles pop with a ring, the new one grows in. */
interface Effects {
  merged: number[];
  spawned: number;
}

function h<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', html = ''): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (html) el.innerHTML = html;
  return el;
}

function text<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, value: string): HTMLElementTagNameMap[K] {
  const el = h(tag, className);
  el.textContent = value;
  return el;
}

function at(cell: number): string {
  const r = Math.floor(cell / SIZE);
  const c = cell % SIZE;
  return `translate(${INSET + c * STEP}px, ${INSET + r * STEP}px)`;
}

/** A tile face in the design's style for [value]. */
function face(value: number): HTMLElement {
  const colors = tileColors(value);
  const el = h('div', colors.glow ? 'face glow' : 'face');
  el.style.background = colors.fill;
  el.style.borderColor = colors.stroke;
  el.style.color = colors.number;
  if (colors.glow) el.style.setProperty('--glow', colors.stroke);
  const number = text('span', '', String(value));
  number.style.fontSize = `${numberSize(value)}px`;
  el.append(number);
  return el;
}

/** A small tile for the help screen. */
function mini(value: number, size: number): HTMLElement {
  const colors = tileColors(value);
  const el = text('span', 'mini', String(value));
  Object.assign(el.style, {width: `${size}px`, height: `${size}px`, background: colors.fill, borderColor: colors.stroke, color: colors.number});
  return el;
}

/**
 * Draws the game with the DOM. Everything on screen follows from the game's state: [render]
 * rebuilds it, so an animation that never ran (a hidden page, a quick swipe) can't leave a
 * wrong board.
 */
export class View {
  /** Called when a row is clicked (a mouse, in a desktop browser). */
  onActivate: (index: number) => void = () => {};

  private readonly head: HTMLElement;
  private readonly score: HTMLElement;
  private readonly best: HTMLElement;
  private readonly gain: HTMLElement;
  private readonly board: HTMLElement;
  private readonly first: HTMLElement;
  private readonly howto: HTMLElement;
  private readonly foot: HTMLElement;
  private readonly panels: Record<'menu' | 'newgame' | 'won' | 'over', HTMLElement>;
  private readonly rowButtons: Partial<Record<Screen, HTMLButtonElement[]>> = {};
  private readonly newText: HTMLElement;
  private readonly wonText: HTMLElement;
  private readonly overScore: HTMLElement;
  private readonly overBest: HTMLElement;
  private readonly overText: HTMLElement;
  /** The tile elements, by the cell they're drawn in. */
  private tiles: (HTMLElement | null)[] = new Array(CELLS).fill(null);
  private pending: {timer: number; move: Move} | null = null;

  constructor(private readonly root: HTMLElement, private readonly game: Game, private readonly strings: Strings, private readonly format: (n: number) => string) {
    for (const [key, value] of Object.entries(UI)) root.style.setProperty(`--${key}`, value);
    const s = strings;

    // Header.
    this.head = h('header', 'head');
    this.score = text('span', 'stat-value', '0');
    this.best = text('span', 'stat-value', '0');
    this.gain = h('span', 'gain');
    const scoreBox = h('div', 'stat');
    scoreBox.append(text('span', 'stat-label', s.score), this.score, this.gain);
    const bestBox = h('div', 'stat');
    bestBox.append(text('span', 'stat-label', s.best), this.best);
    const stats = h('div', 'stats');
    stats.append(scoreBox, bestBox);
    this.head.append(text('span', 'wordmark bungee', '2048'), stats);

    // Board: the 16 empty cells; the tiles go over them.
    this.board = h('div', 'board');
    this.board.tabIndex = -1;
    this.board.setAttribute('aria-label', '2048');
    for (let i = 0; i < CELLS; i++) {
      const cell = h('div', 'cell');
      cell.style.transform = at(i);
      this.board.append(cell);
    }

    // First game: swipe to slide.
    this.first = h('section', 'first');
    this.first.append(
      h('div', 'arrows', `<span></span>${icon('up', 34)}<span></span>${icon('left', 34)}<span class="dot"></span>${icon('right', 34)}<span></span>${icon('down', 34)}<span></span>`),
      text('span', 'first-title bungee', s.firstTitle),
      text('span', 'first-text', s.firstText),
    );

    // How to play.
    this.howto = h('section', 'howto');
    this.howto.tabIndex = -1;
    const how = (iconEl: HTMLElement, title: string, body: string) => {
      const row = h('div', 'how');
      const words = h('div', 'how-words');
      words.append(text('span', 'how-title', title), text('span', 'how-text', body));
      row.append(iconEl, words);
      return row;
    };
    const merge = h('div', 'how-icon merge');
    merge.append(mini(8, 34), mini(8, 34));
    const reach = h('div', 'how-icon');
    reach.append(mini(2048, 52));
    this.howto.append(
      text('span', 'howto-title bungee', s.howTitle),
      how(h('div', 'how-icon', icon('left', 24) + icon('up', 24) + icon('down', 24) + icon('right', 24)), s.howSwipe, s.howSwipeText),
      how(merge, s.howMerge, s.howMergeText),
      how(reach, s.howReach, s.howReachText),
      how(h('div', 'how-icon', icon('new', 30)), s.howOver, s.howOverText),
      h('div', 'rule'),
      text('span', 'howto-controls', s.howControls),
    );

    // Menu and new game.
    const panel = (className: string, title: string, sub?: HTMLElement) => {
      const el = h('section', `panel ${className}`);
      const headEl = h('div', 'panel-head');
      headEl.append(text('span', 'panel-title bungee', title));
      if (sub) headEl.append(sub);
      el.append(headEl);
      return el;
    };
    this.newText = h('span', 'panel-sub');
    const menu = panel('menu', s.menuTitle);
    const newgame = panel('newgame', s.newTitle, this.newText);
    menu.append(this.rows('menu', [['undo', s.undo], ['new', s.newGame], ['howto', s.howToPlay]]));
    newgame.append(this.rows('newgame', [['start', s.startOver], ['keep', s.keepPlaying]]));

    // 2048 reached.
    const won = h('section', 'panel won');
    const wonTile = h('div', 'tile-big');
    wonTile.append(face(2048));
    this.wonText = h('span', 'won-text');
    won.append(wonTile, text('span', 'won-title bungee', s.wonTitle), this.wonText,
      this.rows('won', [['continue', s.keepGoing], ['new', s.newGame]]));

    // No moves left.
    const over = h('section', 'panel over');
    this.overScore = h('span', 'over-score bungee');
    this.overBest = text('span', 'over-best', s.newBest);
    this.overText = h('span', 'over-text');
    over.append(text('span', 'over-title bungee', s.overTitle), this.overScore, this.overBest, this.overText,
      this.rows('over', [['new', s.newGame], ['undo', s.undo]]));

    this.panels = {menu, newgame, won, over};
    this.foot = h('footer', 'foot');
    root.append(this.head, this.board, this.first, this.howto, menu, newgame, won, over, this.foot);
  }

  /** A screen's list of rows: real buttons, so a click works too. */
  private rows(screen: Screen, items: [RowId, string][]): HTMLElement {
    const list = h('div', 'rows');
    const buttons = items.map(([id, label], index) => {
      const button = h('button', 'row', icon(ROW_ICONS[id]));
      button.type = 'button';
      button.dataset.row = id;
      button.append(text('span', 'row-label', label));
      if (id === 'undo') button.append(text('span', 'row-note', this.strings.undoNone));
      button.addEventListener('click', () => this.onActivate(index));
      return button;
    });
    list.append(...buttons);
    this.rowButtons[screen] = buttons;
    return list;
  }

  /** Draws the whole state, with no slide. */
  render(effects?: Effects): void {
    this.pending = null;
    const game = this.game;
    const s = this.strings;
    const f = this.format;
    const screen = game.screen;
    const overlay = OVERLAYS.includes(screen);

    this.score.textContent = f(game.score);
    this.best.textContent = f(game.best);
    this.renderTiles(effects);

    this.head.hidden = this.board.hidden = screen === 'howto';
    this.root.classList.toggle('dim', overlay);
    this.first.hidden = !game.firstCard;
    this.howto.hidden = screen !== 'howto';
    for (const [name, el] of Object.entries(this.panels)) el.hidden = name !== screen;
    this.foot.textContent = screen === 'howto' ? s.howHint : screen === 'over' ? s.overHint : overlay ? s.listHint : s.boardHint;

    this.newText.textContent = fill(s.newText, {points: f(game.score)});
    this.wonText.textContent = fill(s.wonText, {score: f(game.score), best: f(game.best)});
    this.overScore.textContent = f(game.score);
    this.overBest.hidden = !game.newBest;
    this.overText.textContent = fill(game.newBest ? s.overTextRecord : s.overText,
      {tile: game.maxTile, best: f(game.newBest ? game.bestBefore : game.best)});

    // The rows: which ones work, and which one has the focus.
    const rows = game.rows();
    const buttons = this.rowButtons[screen] ?? [];
    buttons.forEach((button, i) => {
      const enabled = rows[i]?.enabled ?? false;
      button.disabled = !enabled;
      button.classList.toggle('is-focus', i === game.focus && enabled);
      const note = button.querySelector<HTMLElement>('.row-note');
      if (note) note.hidden = enabled;
    });
    this.focus();
  }

  /** Puts the focus where the keys belong: the focused row, else the screen. Never nowhere. */
  focus(): void {
    const screen = this.game.screen;
    const target = this.rowButtons[screen]?.[this.game.focus] ?? (screen === 'howto' ? this.howto : this.board);
    if (document.activeElement !== target) target.focus({preventScroll: true});
  }

  /** Slides the tiles of the board on screen to where [move] took them, then draws the new state. */
  play(move: Move): void {
    // The tiles on screen must be the board before [move]: the caller flushed the last slide.
    if (this.pending) clearTimeout(this.pending.timer);
    this.score.textContent = this.format(this.game.score);
    this.best.textContent = this.format(this.game.best);
    this.first.hidden = !this.game.firstCard;
    if (move.gained > 0) {
      this.gain.textContent = fill(this.strings.gain, {points: this.format(move.gained)});
      this.gain.classList.remove('show');
      void this.gain.offsetWidth; // restart the fade
      this.gain.classList.add('show');
    }
    for (const {from, to} of move.slides) {
      const tile = this.tiles[from];
      if (tile) tile.style.transform = at(to);
    }
    const timer = window.setTimeout(() => this.render({merged: move.merged, spawned: move.spawned}), SLIDE_MS);
    this.pending = {timer, move};
  }

  /** Ends a slide still running: draws its end at once. */
  flush(): void {
    if (!this.pending) return;
    clearTimeout(this.pending.timer);
    this.render();
  }

  private renderTiles(effects?: Effects): void {
    for (const tile of this.tiles) tile?.remove();
    this.tiles = this.game.cells.map((value, cell) => {
      if (!value) return null;
      const tile = h('div', 'tile');
      tile.style.transform = at(cell);
      const el = face(value);
      if (effects?.merged.includes(cell)) el.classList.add('merged');
      else if (effects?.spawned === cell) el.classList.add('spawned');
      tile.dataset.value = String(value);
      tile.append(el);
      this.board.append(tile);
      return tile;
    });
  }
}
