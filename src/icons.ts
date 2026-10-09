/** The design's stroke icons (24 x 24 viewBox), as SVG markup. */
const PATHS = {
  undo: '<path d="M9 7 L4 12 L9 17"/><path d="M4 12 H14 C17.3 12 20 14.7 20 18 V19"/>',
  new: '<path d="M20 12 A8 8 0 1 1 17.7 6.3"/><path d="M20 4 V8.5 H15.5"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5 C9.5 7.5 14.5 7.5 14.5 10 C14.5 12 12 12 12 14"/><circle cx="12" cy="17.2" r="0.6"/>',
  play: '<path d="M8 5 L19 12 L8 19 Z"/>',
  back: '<path d="M15 6 L9 12 L15 18"/>',
  up: '<path d="M6 15 L12 9 L18 15"/>',
  down: '<path d="M6 9 L12 15 L18 9"/>',
  left: '<path d="M15 6 L9 12 L15 18"/>',
  right: '<path d="M9 6 L15 12 L9 18"/>',
};

export type IconName = keyof typeof PATHS;

/** An icon drawn in `currentColor`, so it follows its row's text color. */
export function icon(name: IconName, size = 26): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ` +
    `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name]}</svg>`;
}
