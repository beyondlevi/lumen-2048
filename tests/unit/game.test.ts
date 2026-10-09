import {describe, expect, it} from 'vitest';
import {type Cells, type Dir, canMove, fromRows, slide, toRows} from '../../src/board';
import {Game, STORAGE_KEY, type Store} from '../../src/game';
import {catalogsForTests, fill, numberFormat, stringsFor} from '../../src/i18n';
import {Rng} from '../../src/rng';

function memoryStore(text: string | null = null): Store & {text: string | null} {
  const store = {
    text,
    load: () => store.text,
    save: (t: string) => { store.text = t; },
  };
  return store;
}

function newGame(store = memoryStore(), seed = 7): Game {
  return new Game(new Rng(seed), store);
}

const cells = (rows: number[][]): Cells => fromRows(rows)!;
const after = (rows: number[][], dir: Dir) => toRows(slide(cells(rows), dir).cells);
const tiles = (game: Game) => game.cells.filter((v) => v > 0).length;

describe('a move', () => {
  it('slides every tile as far as it goes and merges equal neighbours once', () => {
    const left = (row: number[]) => after([row, [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], 'left')[0];
    expect(left([2, 2, 2, 2])).toEqual([4, 4, 0, 0]);
    expect(left([4, 4, 8, 0])).toEqual([8, 8, 0, 0]);
    expect(left([2, 2, 4, 0])).toEqual([4, 4, 0, 0]);
    expect(left([0, 2, 0, 2])).toEqual([4, 0, 0, 0]);
    expect(left([2, 0, 0, 4])).toEqual([2, 4, 0, 0]);
    expect(left([4, 2, 2, 0])).toEqual([4, 4, 0, 0]);
    expect(left([8, 8, 8, 0])).toEqual([16, 8, 0, 0]);
  });

  it('works the same way in each direction', () => {
    const board = [
      [2, 0, 2, 4],
      [2, 4, 0, 4],
      [0, 4, 8, 8],
      [2, 0, 8, 0],
    ];
    expect(after(board, 'left')).toEqual([[4, 4, 0, 0], [2, 8, 0, 0], [4, 16, 0, 0], [2, 8, 0, 0]]);
    expect(after(board, 'right')).toEqual([[0, 0, 4, 4], [0, 0, 2, 8], [0, 0, 4, 16], [0, 0, 2, 8]]);
    expect(after(board, 'up')).toEqual([[4, 8, 2, 8], [2, 0, 16, 8], [0, 0, 0, 0], [0, 0, 0, 0]]);
    expect(after(board, 'down')).toEqual([[0, 0, 0, 0], [0, 0, 0, 0], [2, 0, 2, 8], [4, 8, 16, 8]]);
    // [2, 2, 2, 2] in a column, down.
    expect(after([[2, 0, 0, 0], [2, 0, 0, 0], [2, 0, 0, 0], [2, 0, 0, 0]], 'down').map((r) => r[0])).toEqual([0, 0, 4, 4]);
    // [2, 2, 2, 2] to the right.
    expect(after([[2, 2, 2, 2], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], 'right')[0]).toEqual([0, 0, 4, 4]);
  });

  it('scores the value of every merged tile and says where each tile went', () => {
    const result = slide(cells([[2, 2, 2, 2], [4, 4, 8, 0], [0, 0, 0, 0], [0, 0, 0, 0]]), 'left');
    expect(result.gained).toBe(4 + 4 + 8);
    expect(result.merged.sort((a, b) => a - b)).toEqual([0, 1, 4]);
    expect(result.slides).toContainEqual({from: 3, to: 1});
    expect(result.slides).toContainEqual({from: 2, to: 1});
    expect(result.slides).toContainEqual({from: 6, to: 5});
  });

  it('that changes nothing does nothing: no new tile, no undo, nothing saved', () => {
    const store = memoryStore();
    const game = newGame(store);
    game.set([[2, 4, 8, 16], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], 0);
    const saved = store.text;
    expect(slide(game.cells, 'left').moved).toBe(false);
    expect(game.move('left')).toBeNull();
    expect(game.move('up')).toBeNull();
    expect(game.rowsOfCells()[0]).toEqual([2, 4, 8, 16]);
    expect(tiles(game)).toBe(4);
    expect(game.canUndo).toBe(false);
    expect(store.text).toBe(saved);
  });

  it('brings a new tile (2, or 4 one time in ten) only after a real move', () => {
    const game = newGame();
    game.set([[2, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 2]], 0);
    const move = game.move('right')!;
    expect(move).not.toBeNull();
    expect(tiles(game)).toBe(3);
    expect(game.cells[move.spawned]).toBeGreaterThan(0);
    expect(slide(game.undo!.cells, 'right').cells[move.spawned]).toBe(0);

    const rng = new Rng(1);
    const counts = {2: 0, 4: 0};
    for (let i = 0; i < 2000; i++) {
      const g = new Game(rng, memoryStore());
      for (const v of g.cells) if (v) counts[v as 2 | 4]++;
    }
    expect(counts[2] + counts[4]).toBe(4000);
    expect(counts[4] / 4000).toBeGreaterThan(0.07);
    expect(counts[4] / 4000).toBeLessThan(0.13);
  });

  it('a new game starts with two tiles', () => {
    for (let seed = 1; seed < 30; seed++) {
      const game = newGame(memoryStore(), seed);
      expect(tiles(game)).toBe(2);
      expect(game.cells.every((v) => v === 0 || v === 2 || v === 4)).toBe(true);
      expect(game.score).toBe(0);
    }
  });
});

// One move left: 16 + 16, and then the board is full with no equal neighbours, whatever comes in.
const LAST_MOVE = [
  [2, 4, 2, 4],
  [4, 2, 4, 2],
  [2, 4, 2, 8],
  [4, 2, 16, 16],
];

describe('the end', () => {
  it('comes when the board is full and no neighbours are equal', () => {
    expect(canMove(cells([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]]))).toBe(false);
    expect(canMove(cells([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 4]]))).toBe(true);
    expect(canMove(cells([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 2], [4, 2, 4, 8]]))).toBe(true);
    expect(canMove(cells([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 0, 4], [4, 2, 4, 2]]))).toBe(true);
    // Vertical neighbours.
    expect(canMove(cells([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [2, 8, 16, 32]]))).toBe(true);

    const game = newGame();
    game.set(LAST_MOVE, 7180);
    expect(game.screen).toBe('board');
    game.move('left');
    expect(game.screen).toBe('over');
    expect(game.score).toBe(7212);
    expect(game.rows().map((r) => r.id)).toEqual(['new', 'undo']);
    expect(game.focus).toBe(0);
    // Back on "No moves left" leaves the app: the game doesn't take it.
    expect(game.key('Escape').handled).toBe(false);
  });

  it('says NEW BEST only when the game beats the best it started with', () => {
    const store = memoryStore();
    const game = newGame(store);
    game.set(LAST_MOVE, 7180);
    game.move('left');
    expect(game.best).toBe(7212);
    expect(game.newBest).toBe(true);
    game.key('Enter'); // New game
    expect(game.screen).toBe('board');
    expect(game.bestBefore).toBe(7212);
    game.set(LAST_MOVE, 100);
    game.move('left');
    expect(game.screen).toBe('over');
    expect(game.newBest).toBe(false);
    expect(game.best).toBe(7212);
  });
});

describe('2048', () => {
  it('shows "You made 2048!" once per game', () => {
    const game = newGame();
    game.set([[1024, 1024, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 2]], 18000);
    game.move('left');
    expect(game.maxTile).toBe(2048);
    expect(game.screen).toBe('won');
    expect(game.rows().map((r) => r.id)).toEqual(['continue', 'new']);
    // Back is "Keep going".
    expect(game.key('Escape').handled).toBe(true);
    expect(game.screen).toBe('board');
    expect(game.wonShown).toBe(true);
    // Another 2048 in the same game: no second time.
    game.set([[2048, 0, 0, 0], [1024, 1024, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
    game.move('right');
    expect(game.screen).toBe('board');
    // A new game shows it again.
    game.newGame();
    expect(game.wonShown).toBe(false);
    game.set([[1024, 1024, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], 0);
    game.move('left');
    expect(game.screen).toBe('won');
    game.key('ArrowDown');
    game.key('Enter'); // New game, at once
    expect(game.screen).toBe('board');
    expect(game.score).toBe(0);
    expect(tiles(game)).toBe(2);
  });
});

describe('undo', () => {
  it('restores the board and the score before the last move, once', () => {
    const game = newGame();
    game.set([[2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 4, 0], [0, 0, 0, 0]], 40);
    const before = game.rowsOfCells();
    expect(game.canUndo).toBe(false);
    game.move('left');
    expect(game.score).toBe(44);
    expect(game.canUndo).toBe(true);
    expect(game.undoMove()).toBe(true);
    expect(game.rowsOfCells()).toEqual(before);
    expect(game.score).toBe(40);
    expect(game.canUndo).toBe(false);
    expect(game.undoMove()).toBe(false);
    expect(game.rowsOfCells()).toEqual(before);
    // The next move makes it available again.
    game.move('right');
    expect(game.canUndo).toBe(true);
  });

  it('leaves "No moves left"', () => {
    const game = newGame();
    game.set(LAST_MOVE, 7180);
    game.move('left');
    expect(game.screen).toBe('over');
    game.key('ArrowDown');
    expect(game.rows()[game.focus].id).toBe('undo');
    game.key('Enter');
    expect(game.screen).toBe('board');
    expect(game.rowsOfCells()).toEqual(LAST_MOVE);
    expect(game.score).toBe(7180);
    expect(game.canUndo).toBe(false);
  });
});

describe('the keys', () => {
  it('open the menu on the board, with the focus on Undo when there is a move to undo', () => {
    const game = newGame();
    expect(game.key('Enter').handled).toBe(true);
    expect(game.screen).toBe('menu');
    // No move yet: Undo is off and the focus starts on New game.
    expect(game.rows()[0]).toEqual({id: 'undo', enabled: false});
    expect(game.rows()[game.focus].id).toBe('new');
    game.key('ArrowUp');
    expect(game.rows()[game.focus].id).toBe('new');
    expect(game.key('Escape').handled).toBe(true);
    expect(game.screen).toBe('board');

    game.set([[2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], 0);
    game.key('ArrowLeft');
    const moved = game.rowsOfCells();
    game.key('Enter');
    expect(game.rows()[game.focus].id).toBe('undo');
    game.key('ArrowDown');
    game.key('ArrowDown');
    game.key('ArrowDown');
    expect(game.rows()[game.focus].id).toBe('howto');
    game.key('ArrowLeft');
    game.key('ArrowRight');
    expect(game.screen).toBe('menu');
    expect(game.rows()[game.focus].id).toBe('howto');
    game.key('ArrowUp');
    game.key('ArrowUp');
    expect(game.rows()[game.focus].id).toBe('undo');
    // Two index taps: undo.
    game.key('Enter');
    expect(game.screen).toBe('board');
    expect(game.rowsOfCells()).not.toEqual(moved);
    expect(game.score).toBe(0);
  });

  it('go through New game? and How to play, and back', () => {
    const game = newGame();
    game.set([[2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], 96);
    game.key('ArrowLeft');
    game.key('Enter');
    game.key('ArrowDown');
    game.key('Enter');
    expect(game.screen).toBe('newgame');
    expect(game.rows()[game.focus].id).toBe('start');
    expect(game.key('Escape').handled).toBe(true);
    expect(game.screen).toBe('menu');
    expect(game.rows()[game.focus].id).toBe('new');
    game.key('Enter');
    game.key('ArrowDown');
    game.key('Enter'); // Keep playing
    expect(game.screen).toBe('board');
    expect(game.score).toBe(100);

    game.key('Enter');
    game.key('ArrowDown');
    game.key('ArrowDown');
    game.key('Enter');
    expect(game.screen).toBe('howto');
    expect(game.key('ArrowDown').handled).toBe(true);
    expect(game.screen).toBe('howto');
    expect(game.key('Escape').handled).toBe(true);
    expect(game.screen).toBe('menu');
    expect(game.rows()[game.focus].id).toBe('howto');
    game.key('Enter');
    game.key('Enter'); // the index tap goes back too
    expect(game.screen).toBe('menu');

    game.key('ArrowUp');
    game.key('Enter');
    game.key('Enter'); // Start over
    expect(game.screen).toBe('board');
    expect(game.score).toBe(0);
    expect(game.best).toBe(100);
    expect(tiles(game)).toBe(2);
  });

  it('leave Escape to Lumen on the board, where the game is already saved', () => {
    const store = memoryStore();
    const game = newGame(store);
    expect(game.key('Escape').handled).toBe(false);
    expect(JSON.parse(store.text!).board).toEqual(game.rowsOfCells());
  });

  it('hide the first game card with the first swipe, for good', () => {
    const store = memoryStore();
    const game = newGame(store);
    expect(game.firstCard).toBe(true);
    game.key('Enter');
    expect(game.firstCard).toBe(false); // not over the menu
    game.key('Escape');
    expect(game.firstCard).toBe(true);
    game.key('ArrowUp');
    game.key('ArrowDown');
    expect(game.firstCard).toBe(false);
    expect(newGame(store).firstCard).toBe(false);
    game.newGame();
    expect(game.firstCard).toBe(false);
  });
});

describe('the saved game', () => {
  it('comes back as it was', () => {
    const store = memoryStore();
    const game = newGame(store, 3);
    game.set([[2, 2, 4, 0], [0, 4, 0, 0], [0, 0, 0, 0], [8, 0, 0, 0]], 120);
    game.move('left');
    game.move('up');
    game.key('ArrowDown');
    const text = store.text!;
    expect(JSON.parse(text)).toMatchObject({v: 1, score: game.score, best: game.best, firstSeen: true, wonShown: false});

    const again = newGame(store, 99);
    expect(again.rowsOfCells()).toEqual(game.rowsOfCells());
    expect(again.score).toBe(game.score);
    expect(again.best).toBe(game.best);
    expect(again.biggest).toBe(game.biggest);
    expect(again.bestBefore).toBe(game.bestBefore);
    expect(again.undo).toEqual(game.undo);
    expect(again.firstSeen).toBe(true);
    expect(again.screen).toBe('board');
    // The undo works after the reload too.
    again.undoMove();
    expect(again.canUndo).toBe(false);
  });

  it('keeps the screen that follows from the board: 2048 not yet shown, no moves left', () => {
    const store = memoryStore();
    const game = newGame(store);
    game.set([[1024, 1024, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], 0);
    game.move('left');
    expect(newGame(store).screen).toBe('won');
    game.key('Enter'); // Keep going
    expect(newGame(store).screen).toBe('board');
    game.set(LAST_MOVE, 0);
    game.move('left');
    expect(newGame(store).screen).toBe('over');
  });

  it('starts a new game when broken, keeping the records it can read', () => {
    for (const text of ['not json', '"text"', '42', 'null', '{"board": "x"}', '{"board": [[2,2,2,2]], "score": 1}',
      '{"board": [[3,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]], "score": 0}',
      '{"board": [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]], "score": 0}',
      '{"board": [[2,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]], "score": -5}']) {
      const game = newGame(memoryStore(text));
      expect(tiles(game)).toBe(2);
      expect(game.score).toBe(0);
      expect(game.screen).toBe('board');
    }
    const kept = newGame(memoryStore('{"board": null, "best": 5000, "biggest": 512, "firstSeen": true}'));
    expect(kept.best).toBe(5000);
    expect(kept.biggest).toBe(512);
    expect(kept.bestBefore).toBe(5000);
    expect(kept.firstCard).toBe(false);
    // A broken undo is dropped, the board is kept.
    const noUndo = newGame(memoryStore('{"board": [[2,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,4]], "score": 8, "undo": {"board": 1}}'));
    expect(noUndo.score).toBe(8);
    expect(noUndo.canUndo).toBe(false);
  });

  it('lives under one key', () => {
    expect(STORAGE_KEY).toBe('lumen-2048');
  });
});

describe('texts', () => {
  it('have the same keys and placeholders in English and Portuguese', () => {
    const {en, pt} = catalogsForTests;
    expect(Object.keys(pt).sort()).toEqual(Object.keys(en).sort());
    const holes = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(holes(pt[key]), key).toBe(holes(en[key]));
      expect(pt[key].split('\n').length, key).toBe(en[key].split('\n').length);
    }
    expect(stringsFor('pt-PT').undo).toBe(pt.undo);
    expect(stringsFor('pt-BR').undo).toBe(pt.undo);
    expect(stringsFor('fr-FR').undo).toBe(en.undo);
    expect(stringsFor(undefined).undo).toBe(en.undo);
    expect(fill('{a} points', {a: 3})).toBe('3 points');
  });

  it('are Brazilian Portuguese, not from Portugal', () => {
    const all = Object.values(catalogsForTests.pt).join('\n');
    expect(all).not.toMatch(/\ba sua\b|\bo seu\b|\bsalta|ecrã|telemóvel|\bregisto\b|utilizador/i);
  });

  it('format numbers for the language', () => {
    expect(numberFormat('en')(6844)).toBe('6,844');
    expect(numberFormat('pt-PT')(6844)).toBe('6.844');
    expect(numberFormat('pt-BR')(21560)).toBe('21.560');
    expect(numberFormat('en-US')(512)).toBe('512');
  });
});
