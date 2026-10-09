import './style.css';
import type {Dir} from './board';
import {Game, STORAGE_KEY, type Store} from './game';
import {languageFor, numberFormat, stringsFor} from './i18n';
import {Rng} from './rng';
import {View} from './view';

/**
 * The game, kept on the device after every change (each Lumen app has its own origin and
 * storage). A hidden app is suspended and Android may end its page; it comes back from here.
 */
const store: Store = {
  load() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  },
  save(text) {
    try {
      localStorage.setItem(STORAGE_KEY, text);
    } catch {
      // Private mode or full storage: the game lasts for this session.
    }
  },
};

const params = new URLSearchParams(location.search);
const language = languageFor(params.get('lang') ?? navigator.language);
const strings = stringsFor(language);
document.documentElement.lang = language === 'pt' ? 'pt-BR' : 'en';
const seed = Number(params.get('seed')) || (Date.now() & 0x7fffffff);

const root = document.getElementById('game')!;
const game = new Game(new Rng(seed), store);
const view = new View(root, game, strings, numberFormat(language));

/** Runs [key] like the band's: arrows, Enter (index tap), Escape (middle tap). True if the game used it. */
function press(key: string): boolean {
  view.flush();
  const result = game.key(key);
  if (result.move) view.play(result.move);
  else view.render();
  return result.handled;
}

// The band arrives as keys. Escape is Lumen's Back: prevented only when the game used it (to close
// a screen); on the board and on "No moves left" it goes through and Lumen closes the app.
document.addEventListener('keydown', (event) => {
  if (event.repeat) {
    if (event.key === 'Escape' && game.screen !== 'board' && game.screen !== 'over') event.preventDefault();
    return;
  }
  if (press(event.key)) event.preventDefault();
});

view.onActivate = (index) => {
  view.flush();
  game.activate(index);
  view.render();
};

/** Shrinks the 600 x 600 screen into a smaller window (a desktop browser); on the glasses it's 1:1. */
function fit(): void {
  const scale = Math.min(1, innerWidth / 600, innerHeight / 600);
  root.style.transform = scale < 1 ? `scale(${scale})` : '';
}
addEventListener('resize', fit);
fit();

// Hidden (the display off, another screen in front): the page is suspended, maybe ended. The game
// is saved already; back on screen, it's drawn again from its state.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    view.flush();
    game.save();
  } else {
    view.render();
  }
});
addEventListener('pageshow', () => view.render());
addEventListener('focus', () => view.focus());

async function start(): Promise<void> {
  view.render();
  const fonts = [
    new FontFace('Bungee', 'url(fonts/Bungee-Regular-latin.woff2)'),
    new FontFace('Chakra Petch', 'url(fonts/ChakraPetch-SemiBold-latin.woff2)', {weight: '500 600'}),
    new FontFace('Chakra Petch', 'url(fonts/ChakraPetch-Bold-latin.woff2)', {weight: '700'}),
  ];
  await Promise.all(fonts.map(async (font) => {
    try {
      document.fonts.add(await font.load());
    } catch {
      // A font that doesn't load falls back to the system's.
    }
  }));
  root.classList.remove('loading');
  view.render();
}

// The e2e test's hook, only with ?test=1.
if (params.get('test') === '1') {
  (window as unknown as {__g2048: unknown}).__g2048 = {
    state: () => ({
      screen: game.screen,
      rows: game.rowsOfCells(),
      score: game.score,
      best: game.best,
      bestBefore: game.bestBefore,
      biggest: game.biggest,
      canUndo: game.canUndo,
      focusRow: game.rows()[game.focus]?.id ?? null,
      firstCard: game.firstCard,
      wonShown: game.wonShown,
      active: (document.activeElement as HTMLElement | null)?.dataset.row ?? document.activeElement?.className ?? null,
    }),
    set: (rows: number[][], score?: number) => {
      view.flush();
      const ok = game.set(rows, score);
      view.render();
      return ok;
    },
    move: (dir: Dir) => press({up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight'}[dir]),
    key: (key: string) => press(key),
  };
}

void start();
