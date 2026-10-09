# Working on this game

A [Rokid Lumen](https://github.com/beyondlevi/rokid-lumen) web app: 2048, which Lumen runs offline
on Rokid glasses from a `.mrbd.zip` package. Lumen's guide for apps is
[docs/building-apps.md](https://github.com/beyondlevi/rokid-lumen/blob/main/docs/building-apps.md).
It doesn't use the UI Toolkit for Meta Ray-Ban Display: it follows its own approved design, drawn
with the DOM.

## Rules

- **The band drives it as keys.** Swipes are arrow keys, the index tap is `Enter`, the middle tap
  is Back (`Escape`, sent to the focused element). Call `preventDefault()` on `Escape` only when
  the game used it (to close a menu or a screen): on the board and on "No moves left" it must
  reach Lumen, which closes the app. Ignore repeated keys.
- **Always one focused element**: the board, the help screen, or a row (a real `<button>`).
  Nothing is focused at load.
- **The screen follows the state.** Everything drawn comes from `Game` and is rebuilt by
  `View.render()` (on load, when the page is shown again, after every move); an animation that
  never ran must not leave a wrong board.
- **Save every change.** A hidden app is suspended, and Android may end its page: the game lives
  in `localStorage` under `lumen-2048`, and a broken value starts a new game.
- **Black is see-through on the glasses**, and their display is green: colors become brightness.
  Use the design's Rokid palette (`src/palette.ts`); texts at least 14 px, only in its bright text
  colors.
- **The screen is 600 x 600 CSS px** (Lumen's web app square). Animations run at 30 fps there.
- **Offline.** Fonts and everything else ship in the package; nothing loads from the internet.
  The manifest has no `lumen_internet` and no `lumen_config`.
- **English first, multilingual from the start.** Every text lives in `src/i18n.ts`, English by
  default and Brazilian Portuguese (`pt`, for any `pt-*`) with it; placeholders, never
  concatenation; numbers through `Intl.NumberFormat`. Code, comments, docs and commits in English.
- **GeckoView only** (Firefox 156 on the glasses).

## Commands

- `npm run dev`, `npm run typecheck`, `npm test` (unit), `npm run test:e2e` (after a build: plays
  the game in Chromium and Firefox with the band's keys, screenshots in `.e2e-output/`)
- `npm run package` builds `dist/lumen-2048.mrbd.zip`, the package Lumen installs.
