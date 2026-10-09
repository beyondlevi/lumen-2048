# 2048 for Lumen

The sliding-tiles classic for [Rokid Lumen](https://github.com/beyondlevi/rokid-lumen) glasses,
played with the Meta Neural Band. Swipe to slide every tile on the 4 x 4 board, merge equal tiles
and reach the 2048 tile. The game runs offline and waits, saved, for your return.

| Band | In the game |
| --- | --- |
| Swipe up, down, left, right | Slide the tiles that way (in a menu: up and down move between the rows) |
| Index tap | Menu: undo the last move, new game, how to play (in a menu: choose) |
| Index tap twice | Undo the last move (the menu opens on Undo) |
| Middle tap | Exit (the game is saved); in a menu, back |

## Rules

- Every swipe slides all the tiles as far as they go. Two equal tiles that meet merge into one,
  once per swipe: `2 2 2 2` to the left makes `4 4`, and `4 4 8` makes `8 8`.
- Each merge adds the new tile's value to the score.
- After every swipe that moves something, a new tile comes in on an empty cell: a 2, or a 4 one
  time in ten. A swipe that moves nothing does nothing.
- Reach the 2048 tile to win, then keep going for a bigger one.
- When the board is full and no two neighbours are equal, the game ends. You can undo the last
  move (one level), or start over.
- The best score and the biggest tile stay on the glasses.

## Install on the glasses

Download the `.mrbd.zip` from the latest [release](https://github.com/beyondlevi/lumen-2048/releases)
and add it from the Lumen companion's Apps tab, or push it to the glasses:

```sh
adb push lumen-2048-<version>.mrbd.zip /sdcard/Android/data/dev.lumen.glasses/files/webapps/
```

Lumen installs it the next time its home opens. The game never uses the internet.

## Development

```sh
npm ci
npm run dev        # http://localhost:5173 (arrows, Enter, Escape play it)
npm run typecheck
npm test           # unit tests: the rules, undo, the screens, the saved game, the texts
npm run package    # dist/lumen-2048.mrbd.zip
npm run test:e2e   # after a build: plays it in Chromium (and Firefox, if installed), screenshots in .e2e-output/
```

`CHROME_PATH=/usr/bin/google-chrome E2E_BROWSERS=chromium npm run test:e2e` uses an installed
Chrome. The game draws with the DOM at 600 x 600 CSS px, the square Lumen gives a web app, on a
black background: black is see-through on the glasses, and their green display turns colors into
brightness, so the tiles climb a brightness ramp. The texts are in English and Brazilian
Portuguese (`src/i18n.ts`).

## Credits

2048 was created by Gabriele Cirulli (https://github.com/gabrielecirulli/2048, MIT); this is an
independent implementation for Lumen.

## License

MIT (see [LICENSE](LICENSE)). The fonts, [Bungee](https://github.com/djrrb/Bungee) and
[Chakra Petch](https://github.com/m4rc1e/Chakra-Petch), are under the SIL Open Font License 1.1
(`public/fonts/OFL-*.txt`).
