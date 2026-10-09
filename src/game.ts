import {CELLS, type Cells, type Dir, type MoveResult, canMove, emptyCells, fromRows, maxTile, slide, toRows} from './board';
import {Rng} from './rng';

/** Where the game is: the board, or one of the screens over it. */
export type Screen = 'board' | 'menu' | 'newgame' | 'howto' | 'won' | 'over';

/** A row of an overlay's list; the same id means the same action on every screen. */
export type RowId = 'undo' | 'new' | 'howto' | 'start' | 'keep' | 'continue';

export interface Row {
  id: RowId;
  enabled: boolean;
}

/** Where the game is kept: localStorage in the app, memory in the tests. */
export interface Store {
  load(): string | null;
  save(text: string): void;
}

/** What is kept between launches, as JSON under one key. */
export interface Saved {
  v: 1;
  board: number[][];
  score: number;
  best: number;
  /** The best score when this game started: a game over beats it for "NEW BEST". */
  bestBefore: number;
  /** The biggest tile ever made. */
  biggest: number;
  /** The board and the score before the last move, while it can be undone. */
  undo: {board: number[][]; score: number} | null;
  /** Whether this game already showed "You made 2048!". */
  wonShown: boolean;
  /** Whether the "Swipe to slide" card was seen (it shows on the very first game only). */
  firstSeen: boolean;
}

export const STORAGE_KEY = 'lumen-2048';
const WIN = 2048;

/** What a key did: [handled] means the game used it (for Escape: Lumen must not go back). */
export interface KeyResult {
  handled: boolean;
  /** Set when the key slid the tiles. */
  move?: Move;
}

/** A move that changed the board: the slide, and the tile that came in after it. */
export interface Move extends MoveResult {
  spawned: number;
}

const ARROWS: Record<string, Dir> = {ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right'};

export class Game {
  cells: Cells = new Array(CELLS).fill(0);
  score = 0;
  best = 0;
  bestBefore = 0;
  biggest = 0;
  undo: {cells: Cells; score: number} | null = null;
  wonShown = false;
  firstSeen = false;
  screen: Screen = 'board';
  /** The focused row of the screen's list. */
  focus = 0;
  /** The screen the help was opened from, and goes back to. */
  private howFrom: Screen = 'menu';

  constructor(private readonly rng: Rng, private readonly store: Store) {
    if (!this.restore()) this.newGame();
  }

  get canUndo(): boolean {
    return this.undo !== null;
  }

  /** The "Swipe to slide" card: on the very first game, on the board, until the first swipe. */
  get firstCard(): boolean {
    return !this.firstSeen && this.screen === 'board';
  }

  get maxTile(): number {
    return maxTile(this.cells);
  }

  /** Whether this game's score beats the best from before it started. */
  get newBest(): boolean {
    return this.score > 0 && this.score > this.bestBefore;
  }

  /** The list of the current screen. */
  rows(): Row[] {
    switch (this.screen) {
      case 'menu': return [{id: 'undo', enabled: this.canUndo}, {id: 'new', enabled: true}, {id: 'howto', enabled: true}];
      case 'newgame': return [{id: 'start', enabled: true}, {id: 'keep', enabled: true}];
      case 'won': return [{id: 'continue', enabled: true}, {id: 'new', enabled: true}];
      case 'over': return [{id: 'new', enabled: true}, {id: 'undo', enabled: this.canUndo}];
      default: return [];
    }
  }

  /** Starts over: an empty board with two tiles. The best score and the biggest tile stay. */
  newGame(): void {
    this.cells = new Array(CELLS).fill(0);
    this.spawn();
    this.spawn();
    this.score = 0;
    this.bestBefore = this.best;
    this.undo = null;
    this.wonShown = false;
    this.show('board');
    this.save();
  }

  /**
   * Slides the tiles toward [dir]. A move that changes nothing does nothing: no new tile, no
   * undo. Returns the move, or null for no move.
   */
  move(dir: Dir): Move | null {
    const result = slide(this.cells, dir);
    if (!result.moved) return null;
    this.undo = {cells: this.cells, score: this.score};
    this.cells = result.cells.slice();
    this.score += result.gained;
    const spawned = this.spawn();
    this.best = Math.max(this.best, this.score);
    this.biggest = Math.max(this.biggest, this.maxTile);
    this.show(this.settled());
    this.save();
    return {...result, spawned};
  }

  /** Goes back to the board and the score before the last move, once. */
  undoMove(): boolean {
    if (!this.undo) return false;
    this.cells = this.undo.cells.slice();
    this.score = this.undo.score;
    this.undo = null;
    this.show(this.settled());
    this.save();
    return true;
  }

  /** The band's keys: arrows, Enter (index tap) and Escape (middle tap, Lumen's Back). */
  key(key: string): KeyResult {
    const dir = ARROWS[key];
    if (this.screen === 'board') {
      if (dir) {
        if (!this.firstSeen) {
          this.firstSeen = true;
          this.save();
        }
        return {handled: true, move: this.move(dir) ?? undefined};
      }
      if (key === 'Enter') {
        this.show('menu');
        return {handled: true};
      }
      // Escape: Lumen closes the app. The game is already saved.
      return {handled: false};
    }
    if (this.screen === 'howto') {
      if (key === 'Enter' || key === 'Escape') {
        this.show(this.howFrom, 'howto');
        return {handled: true};
      }
      return {handled: !!dir};
    }
    if (key === 'ArrowUp' || key === 'ArrowDown') {
      this.moveFocus(key === 'ArrowUp' ? -1 : 1);
      return {handled: true};
    }
    if (key === 'Enter') {
      this.activate(this.focus);
      return {handled: true};
    }
    if (key === 'Escape') {
      switch (this.screen) {
        case 'menu': this.show('board'); return {handled: true};
        case 'newgame': this.show('menu', 'new'); return {handled: true};
        case 'won': this.keepGoing(); return {handled: true};
        // No moves left: Back exits the app, as the footer says.
        default: return {handled: false};
      }
    }
    // Left and right do nothing on a list.
    return {handled: !!dir};
  }

  /** Runs the row at [index] of the current screen's list. */
  activate(index: number): void {
    const row = this.rows()[index];
    if (!row?.enabled) return;
    switch (`${this.screen}:${row.id}`) {
      case 'menu:undo':
      case 'over:undo':
        this.undoMove();
        break;
      case 'menu:new':
        this.show('newgame');
        break;
      case 'menu:howto':
        this.howFrom = 'menu';
        this.show('howto');
        break;
      case 'newgame:start':
      case 'won:new':
      case 'over:new':
        this.newGame();
        break;
      case 'newgame:keep':
        this.show('board');
        break;
      case 'won:continue':
        this.keepGoing();
        break;
    }
  }

  /** Puts the board in the given state (the e2e test hook), then shows what follows from it. */
  set(rows: number[][], score = this.score): boolean {
    const cells = fromRows(rows);
    if (!cells) return false;
    this.cells = cells;
    this.score = Math.max(0, Math.floor(score));
    this.best = Math.max(this.best, this.score);
    this.biggest = Math.max(this.biggest, this.maxTile);
    this.firstSeen = true;
    this.show(this.settled());
    this.save();
    return true;
  }

  /** The screen a board leads to: "You made 2048!" once per game, then "No moves left". */
  private settled(): Screen {
    if (!this.wonShown && this.maxTile >= WIN) return 'won';
    return canMove(this.cells) ? 'board' : 'over';
  }

  private keepGoing(): void {
    this.wonShown = true;
    this.save();
    this.show(this.settled());
  }

  /** Shows [screen] with the focus on row [on], else on its first enabled row. */
  private show(screen: Screen, on?: RowId): void {
    this.screen = screen;
    const rows = this.rows();
    const at = on ? rows.findIndex((r) => r.id === on && r.enabled) : -1;
    this.focus = at >= 0 ? at : Math.max(0, rows.findIndex((r) => r.enabled));
  }

  /** Moves the focus to the next enabled row up or down; it stops at the ends. */
  private moveFocus(step: number): void {
    const rows = this.rows();
    for (let i = this.focus + step; i >= 0 && i < rows.length; i += step) {
      if (rows[i].enabled) {
        this.focus = i;
        return;
      }
    }
  }

  /** A 2 (or a 4, one time in ten) in a random empty cell. Returns the cell, or -1. */
  private spawn(): number {
    const empty = emptyCells(this.cells);
    if (!empty.length) return -1;
    const cell = empty[this.rng.int(empty.length)];
    this.cells[cell] = this.rng.chance(0.9) ? 2 : 4;
    return cell;
  }

  save(): void {
    const saved: Saved = {
      v: 1,
      board: toRows(this.cells),
      score: this.score,
      best: this.best,
      bestBefore: this.bestBefore,
      biggest: this.biggest,
      undo: this.undo ? {board: toRows(this.undo.cells), score: this.undo.score} : null,
      wonShown: this.wonShown,
      firstSeen: this.firstSeen,
    };
    this.store.save(JSON.stringify(saved));
  }

  /** Loads the saved game. False when there is none or it is broken: then a new game starts. */
  private restore(): boolean {
    let data: Partial<Saved> | null;
    try {
      data = JSON.parse(this.store.load() ?? 'null') as Partial<Saved> | null;
    } catch {
      return false;
    }
    if (!data || typeof data !== 'object') return false;
    // The records are worth keeping even when the board isn't.
    this.best = count(data.best);
    this.biggest = count(data.biggest);
    this.firstSeen = data.firstSeen === true;
    const cells = fromRows(data.board);
    if (!cells || !cells.some((v) => v > 0) || !isCount(data.score)) return false;
    this.cells = cells;
    this.score = data.score;
    this.best = Math.max(this.best, this.score);
    this.bestBefore = Math.min(count(data.bestBefore), this.best);
    this.biggest = Math.max(this.biggest, this.maxTile);
    const undo = data.undo ? fromRows(data.undo.board) : null;
    this.undo = undo && isCount(data.undo?.score) ? {cells: undo, score: data.undo!.score} : null;
    this.wonShown = data.wonShown === true;
    this.show(this.settled());
    return true;
  }

  /** For the tests and the test hook. */
  rowsOfCells(): number[][] {
    return toRows(this.cells);
  }
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < 1e9;
}

function count(value: unknown): number {
  return isCount(value) ? value : 0;
}
