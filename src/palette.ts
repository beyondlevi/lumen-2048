/**
 * The approved design's "Rokid" palette. The glasses' display is green only and additive: black
 * is see-through and every color is a brightness, so the tiles climb a brightness ramp.
 */
export const UI = {
  bg: '#000000',
  text: '#E2FFEE',
  sub: '#B8FFD6',
  hint: '#8DF0B5',
  line: '#2E7D50',
  cell: '#0B2416',
  board: '#04140B',
  panel: '#03100A',
  ring: '#F0FFF6',
  accent: '#F0FFF6',
  focus: '#123A24',
} as const;

/** Fill, stroke and number color of each tile value. */
export const TILES: Record<number, readonly [fill: string, stroke: string, number: string]> = {
  2: ['#0A2215', '#3E9E66', '#B8FFD6'],
  4: ['#0F2F1D', '#4FBF7E', '#C6FFDD'],
  8: ['#154027', '#5CD890', '#D6FFE6'],
  16: ['#1C5233', '#6BE69C', '#E2FFEE'],
  32: ['#256840', '#7CEAA9', '#F0FFF6'],
  64: ['#2F8050', '#8DF0B5', '#FFFFFF'],
  128: ['#4FBF7E', '#9DFFC4', '#021008'],
  256: ['#5CD890', '#B8FFD6', '#021008'],
  512: ['#6BE69C', '#C6FFDD', '#021008'],
  1024: ['#8DF0B5', '#D6FFE6', '#021008'],
  2048: ['#B8FFD6', '#F0FFF6', '#000000'],
  4096: ['#E2FFEE', '#FFFFFF', '#000000'],
};

/** The style of a tile: values above 4096 look like 4096. */
export function tileColors(value: number): {fill: string; stroke: string; number: string; glow: boolean} {
  const key = TILES[value] ? value : 4096;
  const [fill, stroke, number] = TILES[key];
  return {fill, stroke, number, glow: key >= 2048};
}

/** The number's size by its digits, as in the design. */
export function numberSize(value: number): number {
  return ({1: 52, 2: 48, 3: 40, 4: 32} as Record<number, number>)[String(value).length] ?? 26;
}
