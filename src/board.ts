/** The 4 x 4 board and the rules of a move, with no state and no DOM. */
export const SIZE = 4;
export const CELLS = SIZE * SIZE;

export type Dir = 'up' | 'down' | 'left' | 'right';

/** 16 values, row by row; 0 is an empty cell. */
export type Cells = number[];

/** A tile that went from one cell to another in a move (both the same when it stayed). */
export interface Slide {
  from: number;
  to: number;
}

export interface MoveResult {
  /** The board after the move, before a new tile comes in. */
  cells: Cells;
  /** False when nothing slid or merged: such a move does nothing. */
  moved: boolean;
  /** The points of this move: the value of every merged tile. */
  gained: number;
  /** Where each tile of the old board went. Two tiles that merged share their `to`. */
  slides: Slide[];
  /** The cells that hold a tile made by a merge. */
  merged: number[];
}

export const DIRS: Dir[] = ['up', 'down', 'left', 'right'];

/** The cell indexes of each line along [dir], each starting at the edge the tiles slide to. */
export function lines(dir: Dir): number[][] {
  const result: number[][] = [];
  for (let i = 0; i < SIZE; i++) {
    const line: number[] = [];
    for (let j = 0; j < SIZE; j++) {
      switch (dir) {
        case 'left': line.push(i * SIZE + j); break;
        case 'right': line.push(i * SIZE + (SIZE - 1 - j)); break;
        case 'up': line.push(j * SIZE + i); break;
        case 'down': line.push((SIZE - 1 - j) * SIZE + i); break;
      }
    }
    result.push(line);
  }
  return result;
}

/**
 * Slides every tile as far as it goes toward [dir]. Two equal neighbours merge into one, once per
 * move: [2, 2, 2, 2] to the left is [4, 4, _, _], and [4, 4, 8, _] is [8, 8, _, _].
 */
export function slide(cells: Cells, dir: Dir): MoveResult {
  const out: Cells = new Array(CELLS).fill(0);
  const slides: Slide[] = [];
  const merged: number[] = [];
  let gained = 0;
  for (const line of lines(dir)) {
    let next = 0;
    let open = false; // whether the last placed tile of this line may still merge
    for (const from of line) {
      const value = cells[from];
      if (!value) continue;
      const last = next > 0 ? line[next - 1] : -1;
      if (open && out[last] === value) {
        out[last] = value * 2;
        gained += value * 2;
        merged.push(last);
        slides.push({from, to: last});
        open = false;
      } else {
        const to = line[next++];
        out[to] = value;
        slides.push({from, to});
        open = true;
      }
    }
  }
  const moved = slides.some((s) => s.from !== s.to);
  return {cells: out, moved, gained, slides, merged};
}

export function emptyCells(cells: Cells): number[] {
  const result: number[] = [];
  cells.forEach((value, index) => { if (!value) result.push(index); });
  return result;
}

/** Whether any move changes the board: an empty cell, or two equal neighbours. */
export function canMove(cells: Cells): boolean {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const value = cells[r * SIZE + c];
      if (!value) return true;
      if (c + 1 < SIZE && cells[r * SIZE + c + 1] === value) return true;
      if (r + 1 < SIZE && cells[(r + 1) * SIZE + c] === value) return true;
    }
  }
  return false;
}

export function maxTile(cells: Cells): number {
  return cells.reduce((max, value) => Math.max(max, value), 0);
}

export function toRows(cells: Cells): number[][] {
  const rows: number[][] = [];
  for (let r = 0; r < SIZE; r++) rows.push(cells.slice(r * SIZE, r * SIZE + SIZE));
  return rows;
}

/** The cells of 4 rows of 4 values, or null when [rows] isn't a valid board. */
export function fromRows(rows: unknown): Cells | null {
  if (!Array.isArray(rows) || rows.length !== SIZE) return null;
  const cells: Cells = [];
  for (const row of rows) {
    if (!Array.isArray(row) || row.length !== SIZE) return null;
    for (const value of row) {
      if (!isTileValue(value)) return null;
      cells.push(value);
    }
  }
  return cells;
}

/** 0 (empty) or a power of two from 2 to 2^17, the biggest tile a 4 x 4 board can make. */
export function isTileValue(value: unknown): value is number {
  if (value === 0) return true;
  return typeof value === 'number' && Number.isInteger(value) && value >= 2 && value <= 131072 && (value & (value - 1)) === 0;
}
