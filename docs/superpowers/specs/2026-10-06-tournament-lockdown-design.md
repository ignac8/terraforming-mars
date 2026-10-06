# Tournament lockdown: enforce tournament rules on game creation

Date: 2026-10-06 (revised the same day after an independent review)
Branch: `tournament-lockdown`, based on `origin/tournament` at `ec52b8f39` (2026-10-05)

> **Revision note.** The first version of this spec was written against local
> `tournament` (`5a1405c4d`, 2026-07-19), which was 279 commits behind
> `origin/tournament`. That is the branch the VPS deploys. An independent
> review found that version stale and wrong in several places. This version is
> re-derived from current code. Every line number below refers to `ec52b8f39`.

## Intent

The tournament rules already fix undo, the card and corporation pools, and the
other options listed below. This change adds no new rules. It stops whoever
fills in the create-game form, or calls the API, from overriding rules that are
already set. So no organizer confirmation is needed (user decision, 2026-10-06).

## Decisions (user, 2026-10-06)

| Option | Tournament games |
| --- | --- |
| Undo (`undoOption`) | forced **off** |
| Corporation pool | 5 drawn at random from the fork's full tournament corporation set. The July "draw 5 from an organizer-supplied list" feature (`558fc6ca4`) is **removed** |
| `customCorporationsList` | forced empty, and ignored by tournament dealing |
| `bannedCards`, `includedCards` | forced empty: the full Base + Corporate Era deck, no bans |
| `customPreludes`, `customCeos`, `customColoniesList` | forced empty |
| TR boost (per-player `handicap`) | forced **0** |
| Fast mode (`fastModeOption`) | forced **off** |
| Show other players' VP (`showOtherPlayersVP`) | forced **off** |
| Player passwords (`playerPasswords`) | forced **on** |
| Board, first player, timers, escape velocity, player count | stay settable |
| Cloned / seeded games ("Set Predefined Game") | **left as is** (known bypass, accepted) |
| `PUT /load_game` rollback bypass | **out of scope**. It gets a separate fix for all games |
| Non-tournament games on the tournament site | still allowed (the checkbox stays free) |

## Why this is also a fix, not only hardening

The first spec claimed `customPreludes`, `customCeos` and `includedCards` are
inert when their expansion is off. That is false. The review ran
`testGame(2, {tournamentExpansion: true, customPreludes: [DONATION],
customCeos: [FLOYD], includedCards: [ADVERTISING]})` and found Donation in the
prelude deck, Floyd in the CEO deck and the promo card Advertising in the
project deck. So a game creator can put arbitrary cards into a tournament game
**today**. Only `customColoniesList` really is inert: colony dealing sits
behind `coloniesExtension`. All six are cleared anyway, so that safety doesn't
depend on any other option.

## Design

There are two enforcement layers, as for the existing tournament options:

- The **server is authoritative**. It covers `applyTournamentPreset`, the create
  route, and tournament dealing in `Game.newInstance`.
- The **client mirrors the server** so the form never shows a value the server
  will replace. The preset's doc comment says it: "the client is not trusted".

### Server

**1. `applyTournamentPreset`** (`src/server/game/GameOptions.ts:97-154`). Add
these lines after `options.twoCorpsVariant = false;`:

```ts
options.undoOption = false;
options.fastModeOption = false;
options.showOtherPlayersVP = false;
options.playerPasswords = true;
options.customCorporationsList = [];
options.bannedCards = [];
options.includedCards = [];
options.customColoniesList = [];
options.customPreludes = [];
options.customCeos = [];
```

Correct the doc comment above the function (lines 88-96) so it lists what is
forced. Drop the "stay untouched" claims for undo and the corporation pool.

**2. Remove custom pool sampling from tournament dealing**
(`src/server/Game.ts:394-402`). Today `custom` filters `customCorporationsList`
down to tournament corporations and uses it when non-empty. Replace that with
"candidates are always every tournament corporation". Then the capability no
longer exists below the preset, and `testGame` and any future code path can't
reintroduce it. Leave the log line ("Tournament corporation pool: …") as is.

**3. The create route** (`src/server/routes/ApiCreateGame.ts`) needs two
changes.

- `validateCustomLists` (line 97) runs at line 126, *before* the preset at line
  210. So a tournament request with a short custom list gets a 400 for a list
  that would be thrown away anyway. Return early from `validateCustomLists`
  when `gameReq.expansions.tournament === true`.
- Handicap is per player, not a `GameOptions` field, so the preset can't reach
  it. In the player construction (lines 133-141), pass `0` instead of
  `Number(p.handicap)` when `gameReq.expansions.tournament === true`.

### Client: `src/client/components/create/CreateGameForm.vue`

**4. Disable the locked controls** with `:disabled="expansions.tournament"`,
matching the roughly twenty controls already locked this way:

| Line | Control |
| --- | --- |
| 238 | `undo-checkbox` |
| 303 | `customCorps-checkbox` |
| 325 | `bannedCards-checkbox` |
| 330 | `includedCards-checkbox` |
| 437 | `realTimeVP-checkbox` (show other players' VP) |
| 442 | `fastMode-checkbox` |
| 447 | `playerPasswords-checkbox` |
| 483 | per-player `player-handicap` number input |

The prelude, CEO and colony list toggles sit inside
`<template v-if="expansions.prelude|ceo|colonies">` blocks that the tournament
locks turn off, so they aren't rendered and need no attribute.

**5. One lock method, applied on every path that sets form state.** Move the
whole body of the `'expansions.tournament'` watcher (lines 674-704) into a
method `applyTournamentLocks()`. Add the new fields to it:

```ts
this.undoOption = false;
this.fastModeOption = false;
this.showOtherPlayersVP = false;
this.playerPasswords = true;
for (const player of this.players) {
  player.handicap = 0;
}
this.showCorporationList = false;
this.showPreludesList = false;
this.showColoniesList = false;
this.showCeosList = false;
this.showBannedCards = false;
this.showIncludedCards = false;
this.customCorporations = [];
this.customPreludes = [];
this.customColonies = [];
this.customCeos = [];
this.bannedCards = [];
this.includedCards = [];
```

The watcher alone is not enough. The review checked all three paths below. Each
calls `applyTournamentLocks()` when `expansions.tournament` is true:

| Path | Why the watcher misses it | Hook |
| --- | --- | --- |
| First load | `defaultCreateGameModel` starts with `tournament: true`, and a non-immediate watcher never fires. Without a hook, the defaults would show `playerPasswords: false` greyed out | make the watcher `immediate: true` |
| Restore saved settings (`applySettings`, line 889) | `JSONProcessor` writes the saved shape (`expansions: {tournament: true, prelude: true, …}`, `undoOption: true`, custom lists) straight in. The watcher doesn't fire, and the later `nextTick` callback resets `solarPhaseOption` again | call at the end of the existing `nextTick` callback, after the `solarPhaseOption` line |
| Reset (`resetSettings`, line 926) | `Object.assign` with the defaults keeps `tournament` true, so the watcher doesn't fire | call inside the existing `nextTick` callback |

The restore path must re-apply the **whole** lock set, including
`expansions.prelude` and the other expansions. Re-applying only the new fields
would leave a restored tournament form with Prelude still on.

### Docs: `tournament/PLAN.md`

Items 3 and 6 still say the corporation pool override and undo "stay free".
Update them to match this spec.

## Testing

Server tests use mocha (`tests/TournamentMode.spec.ts`,
`tests/routes/ApiCreateGame.spec.ts`). Client tests use vitest
(`npm run test:client`).

1. **Preset forces the new fields.** Extend
   `applyTournamentPreset forces the regulation options` (line 241). Seed every
   newly locked field with a non-default value and assert each forced value.
2. **Classify every option.** Add a test that lists every `GameOptions` key as
   either *forced* or *passthrough*. It fails when a new key appears in neither
   list. That catches upstream merges that add an option the preset silently
   lets through. `playerPasswords` was exactly such a case.
3. **Pool sampling removed.** Replace
   `customCorporationsList becomes the pool…` (line 68) and
   `…sampled down to 5` (line 80) with one test,
   `customCorporationsList is ignored under tournament rules`. Calling
   `testGame` directly, it checks that every player is dealt 5 corporations,
   all `:tournament`, regardless of the list. This works because dealing no
   longer reads the list.
4. **Create route, end to end.** In `tests/routes/ApiCreateGame.spec.ts`, POST
   a tournament game with `undoOption: true`, fast mode, VP, passwords off, a
   handicap of 3, and all six lists populated, including a too-short
   `customCorporationsList`. Assert a 2xx, then assert the created game's
   options and each player's handicap. This is the only test that catches the
   preset call being moved or skipped.
5. **In-flight games.** `testGame(2, {tournamentExpansion: true,
   undoOption: true})`, then serialize and deserialize, keeps `undoOption`.
   This pins "no migration on load". Don't assign to `game.gameOptions`: it is
   `Readonly` and fails `build:test`.
6. **Client: first load.** Mount the form with no saved settings. Assert
   `playerPasswords` is true, `undoOption` false, and the `disabled` attribute
   is present on `#undo-checkbox`, `#playerPasswords-checkbox` and
   `#fastMode-checkbox`.
7. **Client: toggle.** Set tournament false, then true. Asserting `true` on
   something already `true` never fires the watcher. Seed every locked field
   first, then assert all are cleared and forced, including handicaps.
8. **Client: toggle off.** With tournament off, the `disabled` attribute is
   absent from `#undo-checkbox`, so the control is usable again.
9. **Client: restore.** Save settings in the real shape, then mount and assert
   the locks: `expansions: {...DEFAULT_EXPANSIONS, tournament: true,
   prelude: true}`, `undoOption: true`, and populated `customCorporationsList`,
   `customPreludes`, `bannedCards` and `includedCards`. Assert
   `expansions.prelude === false` as well. Add a second case with only the
   legacy flat `tournamentExpansion: true` key and no `expansions` key, which
   is the upload format.
10. **Client: reset.** With tournament on, call `resetSettings()` and assert
    the locks.

## Verification

The worktree has no `node_modules` or `src/genfiles`. Run `npm ci` and one
`npm run build` before any test. After that, per the project rule, run
`npm run lint`, `npm run build` and `npm run test` before the final commit.

## Delivery

- The VPS auto-deploys `origin/tournament` about a minute after a push. Pushing
  `tournament-lockdown` deploys nothing. Delivery means merging
  `tournament-lockdown` into `tournament` and pushing. That step needs explicit
  user approval at the time, and a check that no tournament round is in
  progress.
- Games already running keep the options they were created with. There is no
  migration.
- The UX text "Undo is now in best effort support…" is `v-if="undoOption"`, so
  it disappears once undo is forced off.

## Out of scope

- **`PUT /load_game` with `rollbackCount`.** It needs no auth and accepts a
  spectator id, so anyone can roll any game back. It gets a separate fix for
  all games: require the server id.
- **Cloned / seeded tournament games.** `Cloner.clone` uses the source game's
  options and skips the preset. The user chose to leave this as is.
- **The undo redesign.** That lives on `automa-undo`, after this change ships.
