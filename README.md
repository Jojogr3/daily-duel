# Daily Duel

One puzzle a day. One rival. A mobile game by World Runner Games.

Every day everyone gets the same short puzzle and is matched against another player's recorded attempt near their rank. Word Rush is free; Daily Duel+ unlocks every mode, the archive, unlimited practice and no ads.

**First time here?** See [SETUP.md](SETUP.md) for the step-by-step checklist.

## What's in the repo

| Folder | What it is |
| --- | --- |
| `packages/engine` | Puzzle generation, solving, scoring, ratings, streaks, bots. Shared by app and server, fully tested. |
| `apps/mobile` | The Expo (React Native) app for iOS, Android and web. |
| `functions` | Firebase Cloud Functions: scoring, matchmaking, leaderboards, puzzle scheduling, subscription webhook. |
| `web/public` | Website: landing page, share-link page, privacy policy and terms (drafts). |
| `scripts` | Word list download and the weekly metrics report. |
| `.github/workflows` | CI, backend deploys, app builds, over-the-air updates, weekly report. |

## Everyday commands

```bash
npm install          # install everything
npm test             # engine + backend tests
npm run typecheck    # all packages
npm run app          # run the app (Expo Go / simulator)
npm run app:web      # run the app in a browser
npm run words        # re-download the word list (after editing the blocklist)
```

## How it fits together

- **Fair play:** the app sends only its moves; the server replays them against the puzzle and computes the score. Puzzles are generated from a secret salt, so nobody can see tomorrow's board.
- **Duels are asynchronous:** your rival is a real player's earlier attempt at the same puzzle, chosen near your rating. When nobody near you has played yet, a clearly labelled bot fills in.
- **Offline mode:** with no Firebase keys configured, the app runs on a local backend with the same engine, so it can be played and tested before any accounts exist.

## Credits

- Word list: ENABLE (public domain).
- Offensive-word filter: [LDNOOBW](https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words) (CC BY 4.0).
