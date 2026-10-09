/**
 * Every text the game shows. English is the default; Brazilian Portuguese for any pt-* (the
 * glasses run pt-PT). `{name}` is a placeholder, filled with [fill]; `\n` breaks a line.
 */
const en = {
  score: 'SCORE',
  best: 'BEST',
  gain: '+{points}',
  boardHint: 'Index tap: menu · Middle tap: exit (the game is saved)',
  listHint: 'Swipe up or down · Index tap: choose · Middle tap: back',
  overHint: 'Swipe up or down · Index tap: choose · Middle tap: exit',
  firstTitle: 'SWIPE TO SLIDE',
  firstText: 'Two equal tiles merge into one.\nReach the 2048 tile.',
  howTitle: 'HOW TO PLAY',
  howSwipe: 'Swipe any way',
  howSwipeText: 'Every tile slides as far as it can.',
  howMerge: 'Equal tiles merge',
  howMergeText: '8 and 8 make 16, and 16 goes to your score.',
  howReach: 'Reach 2048',
  howReachText: 'Then keep going for a bigger tile.',
  howOver: 'No moves left',
  howOverText: 'The game ends. Undo the last move, or start over.',
  howControls: 'Index tap: menu (undo, new game)\nMiddle tap: exit. The game waits, saved, for your return.',
  howHint: 'Index tap or middle tap: back',
  menuTitle: 'MENU',
  undo: 'Undo last move',
  undoNone: 'none yet',
  newGame: 'New game',
  howToPlay: 'How to play',
  newTitle: 'NEW GAME?',
  newText: 'This game ends with {points} points.',
  startOver: 'Start over',
  keepPlaying: 'Keep playing',
  wonTitle: 'YOU MADE 2048!',
  wonText: 'Score {score} · best {best}',
  keepGoing: 'Keep going',
  overTitle: 'NO MOVES LEFT',
  newBest: 'NEW BEST',
  overText: 'Biggest tile {tile} · best {best}',
  overTextRecord: 'Biggest tile {tile} · previous best {best}',
};

export type Strings = typeof en;

const pt: Strings = {
  score: 'PONTOS',
  best: 'RECORDE',
  gain: '+{points}',
  boardHint: 'Indicador: menu · Médio: sair (o jogo fica salvo)',
  listHint: 'Deslize para cima ou baixo · Indicador: escolher · Médio: voltar',
  overHint: 'Deslize para cima ou baixo · Indicador: escolher · Médio: sair',
  firstTitle: 'DESLIZE PARA MOVER',
  firstText: 'Duas peças iguais viram uma só.\nChegue à peça 2048.',
  howTitle: 'COMO JOGAR',
  howSwipe: 'Deslize para qualquer lado',
  howSwipeText: 'Todas as peças vão até onde der.',
  howMerge: 'Peças iguais se juntam',
  howMergeText: '8 e 8 viram 16, e você ganha 16 pontos.',
  howReach: 'Chegue a 2048',
  howReachText: 'Depois, continue rumo a uma peça maior.',
  howOver: 'Sem jogadas',
  howOverText: 'O jogo acaba. Desfaça a última jogada ou comece de novo.',
  howControls: 'Indicador: menu (desfazer, novo jogo)\nMédio: sair. O jogo fica salvo esperando você voltar.',
  howHint: 'Indicador ou médio: voltar',
  menuTitle: 'MENU',
  undo: 'Desfazer jogada',
  undoNone: 'ainda não',
  newGame: 'Novo jogo',
  howToPlay: 'Como jogar',
  newTitle: 'NOVO JOGO?',
  newText: 'Este jogo termina com {points} pontos.',
  startOver: 'Começar de novo',
  keepPlaying: 'Continuar jogando',
  wonTitle: 'VOCÊ FEZ 2048!',
  wonText: '{score} pontos · recorde {best}',
  keepGoing: 'Continuar',
  overTitle: 'SEM JOGADAS',
  newBest: 'NOVO RECORDE',
  overText: 'Maior peça {tile} · recorde {best}',
  overTextRecord: 'Maior peça {tile} · recorde anterior {best}',
};

const catalogs: Record<string, Strings> = {en, pt};

/** The base language used for [language] (a BCP 47 tag): one with a catalog, else English. */
export function languageFor(language: string | undefined): 'en' | 'pt' {
  const base = (language ?? 'en').toLowerCase().split('-')[0];
  return base === 'pt' ? 'pt' : 'en';
}

/** The strings for [language]: its base language if there is a catalog, else English. */
export function stringsFor(language: string | undefined): Strings {
  return catalogs[languageFor(language)] ?? en;
}

/** Formats a number for [language]: 6,844 in English, 6.844 in Brazilian Portuguese. */
export function numberFormat(language: string | undefined): (n: number) => string {
  const format = new Intl.NumberFormat(languageFor(language) === 'pt' ? 'pt-BR' : 'en-US');
  return (n) => format.format(n);
}

/** Fills `{name}` placeholders. */
export function fill(text: string, values: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
}

export const catalogsForTests = {en, pt};
