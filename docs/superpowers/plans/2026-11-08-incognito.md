# Incognito Games Implementation Plan

**Goal:** A create-game option that hides opponents' real names, colors and seat order from
players and spectators until the game ends.

**Architecture:** One server module derives a per-viewer mask: real color to fake color, and real
name to fake label. The mask is computed from the game id and the viewer id on every request, so
nothing new is saved. Every participant-scoped route passes its response through `maskModel` before
`writeJson`. `SelectPlayer` and `SelectDelegate` map fake colors back with `unmaskColor`. The
shared game page gets an alphabetical, colorless player list. The client only translates the
English fake labels and hides the seat markers on GameHome.

**Tech Stack:** TypeScript, Node (Mocha + Chai server tests), Vue 3 Options API (Vitest client tests).

**Spec:** `docs/superpowers/specs/2026-11-08-incognito-design.md`

## Global Constraints

- Branch: tournament only. Base `origin/tournament`. No automa or main port.
- Option name: `incognito` (boolean, default `false`). It is effective only when there are 2+
  players. The server forces it to `false` for solo games.
- Incognito forces `playerPasswords` to true. It is available whether or not the tournament
  expansion is on.
- Hiding is active when `gameOptions.incognito && game.phase !== Phase.END`. The phase is that of the
  live game, never of a replay sandbox.
- Hiding applies to p, s and j ids. The judge is hidden like the spectator (organizer, 2026-11-08).
  The serverId and admin routes always get real data.
- Fake colors are drawn from all 10 `PLAYER_COLORS`. A player's own seat stays real. The spectator
  mapping covers every seat.
- Fake name: the color's English label. `clear` is `"Transparent"`, and every other color is the
  capitalized id ("Red", "Turquoise"). The client translates it. The pl keys already exist in
  `src/locales/pl/ui.json:20-29`.
- Pass these through untouched: `neutral`, `bronze`, `NEUTRAL`.
- Checkbox label: "Incognito (hide opponents' names and colors until the game ends)", with a Polish
  translation in `src/locales/pl/`.
- Commits: one terse line, no trailers, no body (fork convention).
- Run Node 24. Every command below runs from a script that starts with
  `NODE24=$(ls -d ~/.nvm/versions/node/v24.* | sort -V | tail -1); export PATH=$NODE24/bin:$PATH`.

## Review Focus

1. **A real name equal to a fake label.** Say a player is literally named "Red", and the viewer sees
   another opponent as "Red". Names must map in one pass with no chained replacement, and the inbound
   color must still hit the right player. The test goes in Task 2.
2. **A rewind out of END.** A finished game rewound back into play must hide again on the next request.
   The test goes in Task 3.
3. **Replaying an old save.** While the live game runs, the replay view of an old save is masked by
   the live game's state. After END, every replay is real. The test goes in Task 3.
4. **A restart between polls.** The mapping must be identical after serialize and deserialize. A
   `Math.random` mapping would pass a single-request test, so the test goes in Task 2.
5. **Neutral and bronze tiles.** Ares hazards (`bronze`) and neutral city or ocean owners must render
   unchanged in an incognito game. The test goes in Task 2.

---

### Task 1: Option plumbing and seat shuffle on create

**Files:**
- Modify: `src/server/game/GameOptions.ts:54-56,249-250`. Add `incognito: boolean` with a doc
  comment, and a default of `false`.
- Modify: `src/server/Game.ts:1987`. Add `gameOptions.incognito = gameOptions.incognito ?? false;`.
- Modify: `src/common/game/NewGameConfig.ts:50`. Add `incognito?: boolean`.
- Modify: `src/common/models/GameOptionsModel.ts:37` and `src/server/models/ServerModel.ts:530`.
  Add `incognito`.
- Modify: `src/server/routes/ApiCreateGame.ts:124-210`.
- Create: `src/server/incognito/shuffleSeats.ts`
- Test: `tests/incognito/shuffleSeats.spec.ts`, `tests/routes/ApiCreateGame.spec.ts`,
  `tests/TournamentMode.spec.ts:297-331` (add `incognito` to `passthrough`), and
  `tests/Game.spec.ts:1060-1086`, which covers a deserialize of an old save without the key.

**Interfaces:**
- Produces: `GameOptions.incognito: boolean`, `GameOptionsModel.incognito: boolean`, and
  `shuffleSeats<T>(seats: ReadonlyArray<T>, random: Random): Array<T>` (Fisher-Yates, new array).

- [ ] **Step 1: Write failing tests**
  - `shuffleSeats.spec.ts`: with `new SeededRandom(1)` the result is a permutation of the input. Two
    different seeds give different orders for a 6-element input. The input array is not mutated.
  - `ApiCreateGame.spec.ts`, "incognito forces passwords":
    - POST 2 players with `incognito: true, playerPasswords: false`.
    - Load the game from the GameLoader.
    - Expect `gameOptions.incognito === true` and `gameOptions.playerPasswords === true`.
  - "incognito is off for solo": 1 player with `incognito: true`, expect `gameOptions.incognito === false`.
  - "incognito ignores the form's first player": mark player index 2 `first: true`, and expect
    `game.first` to be `game.playersInGenerationOrder[0]`, the shuffled seat 0, not necessarily the
    marked player.
  - "incognito shuffles seats": create the same 4-player incognito game 20 times, and expect at least
    2 distinct seat orders by name. The handler uses `UnseededRandom`, so no seed injection is
    needed.
  - `Game.spec.ts`: a serialized game with `incognito` deleted from `gameOptions` deserializes to
    `false`.

- [ ] **Step 2: Run them and confirm they fail**

  Run: `npx mocha --import=tsx --require tests/testing/setup.ts tests/incognito/shuffleSeats.spec.ts tests/routes/ApiCreateGame.spec.ts tests/Game.spec.ts tests/TournamentMode.spec.ts`

  Expected: FAIL. The module is missing, `incognito` is undefined, and the TournamentMode key list fails
  on the unknown key once the option exists.

- [ ] **Step 3: Implement**

  In ApiCreateGame:
  - Set `const incognito = gameReq.incognito === true && players.length > 1;`.
  - Put `incognito` in `gameOptions`.
  - OR it into `playerPasswords`, alongside the undo clause.
  - When `incognito`, replace `players` with `shuffleSeats(players, UnseededRandom.INSTANCE)` before
    building the game. Set `firstPlayerIdx = 0`, because the form's `first` flag is ignored. If the
    creator picked who goes first, the in-game "1st" marker would tell them that person's fake
    color. Both the `Cloner.clone` path and the `Game.newInstance` path must get the shuffled
    order.

- [ ] **Step 4: Run the same command and expect PASS**

- [ ] **Step 5: Commit** `git commit -m "Add incognito game option"`

---

### Task 2: Mask core

**Files:**
- Create: `src/common/models/colorKeys.ts`. Move `COLOR_KEYS` here from
  `src/client/utils/localColors.ts:13-19`, and have localColors import it. The behavior stays the same.
- Modify: `src/common/Color.ts`. Add `export type PlayerColor = typeof PLAYER_COLORS[number];` (no
  such type exists yet) and `PLAYER_COLOR_LABELS: Readonly<Record<PlayerColor, string>>`, with
  `clear: 'Transparent'`.
- Create: `src/server/incognito/IncognitoMask.ts`
- Test: `tests/incognito/IncognitoMask.spec.ts`

**Interfaces:**
- Consumes: `GameOptions.incognito` (Task 1).
- Produces:
  ```ts
  export type IncognitoMask = {
    readonly colors: ReadonlyMap<Color, Color>;   // real -> fake, opponents only (all seats for a spectator)
    readonly reverse: ReadonlyMap<Color, Color>;  // fake -> real
    readonly names: ReadonlyMap<string, string>;  // real name -> fake label
  };
  export function incognitoMask(game: IGame, viewerId: PlayerId | SpectatorId): IncognitoMask | undefined;
  export function maskModel<T>(value: T, mask: IncognitoMask | undefined): T;
  export function maskText(text: string, mask: IncognitoMask | undefined): string;
  export function unmaskColor<T extends string>(color: T, mask: IncognitoMask | undefined): T;
  ```
  `incognitoMask` returns `undefined` when the option is off, when `phase === END`, or when the
  viewer is unknown. The spectator and the judge get a mask over every seat. A `mask` of `undefined`
  makes the other three functions return their input unchanged.

- [ ] **Step 1: Write failing tests** (a 3-player game from `testGame(3, {incognito: true})`. Extend
  `testGame`'s options if it does not pass `incognito` through.)
  - `"opponents get distinct fake colors, own seat untouched"`: for player 0, `colors` has 2 entries,
    neither key is player 0's color, and the values are distinct members of `PLAYER_COLORS` that
    differ from player 0's color.
  - `"spectator mask covers every seat"`: 3 entries.
  - `"stable across calls and a serialize round trip"`: `incognitoMask(game, p.id)` deep-equals the
    same call on `Game.deserialize(game.serialize())`.
  - `"different viewers get independent mappings"`: assert the mask is seeded per viewer. Use a seed
    where the two masks differ for the same opponent.
  - `"undefined when off, at END, or for an id of no seat"`, and `"judge mask covers every seat"`.
  - `"maskModel rewrites color keys, PLAYER log data, player names and playerName"`: on a hand-built
    object:
    ```ts
    {players: [{color: 'red', name: 'Alice'}], spaces: [{color: 'red'}, {color: 'neutral'}, {color: 'bronze'}],
     milestones: [{playerName: 'Alice', color: 'red'}], card: {name: 'Ants'},
     log: {data: [{type: LogMessageDataType.PLAYER, value: 'red'}]}}
    ```
    `red` maps to its fake color, `Alice` maps to the fake label, `Ants`, `neutral` and `bronze` are
    unchanged, and the input object is not mutated.
  - `"maskModel rewrites VP detail args and 'name: ' runs in message strings"`:
    `{messageArgs: ['1st', 'Miner', 'Alice']}` maps `Alice`, and a STRING datum
    `'Alice: 3 / Bob: 1'` becomes `'<fakeA>: 3 / <fakeB>: 1'`.
  - Review Focus 1, `"a real name equal to a fake label is not double-mapped"`: name one player `Red`.
    Every player name maps exactly once, and `unmaskColor(fake, mask)` returns the real color of the
    intended player.
  - `"maskText replaces opponent names in free text"`: `'This space is land claimed by Alice'`.

- [ ] **Step 2: Run the tests and confirm they fail.** Run `npx mocha --import=tsx --require tests/testing/setup.ts tests/incognito/IncognitoMask.spec.ts`. Expected: FAIL because the module is missing.

- [ ] **Step 3: Implement**
  - **Seed:** a SHA-256 of `` `${game.id}:${viewerId}` ``, with the first 4 bytes read as a uint32.
    Divide by 2^32 to get the `SeededRandom` seed.
  - **Fake pool:** for a player, `PLAYER_COLORS` minus the viewer's own color, shuffled with
    `shuffleSeats`, then assigned to opponents in `game.players` order. For a spectator, the whole
    pool is shuffled over all seats.
  - **Name rules for the walker:**
    - `name` in an object that has a string `color` key that is a real player color in the mask
    - any `playerName`
    - strings inside a `messageArgs` array that exactly equal a real name
    - inside Message data of type STRING or RAW_STRING, replace each occurrence of `` `${realName}: ` ``
  - **Color rules:** use the shared `COLOR_KEYS`, plus `value` of PLAYER-type log data.
  - **One pass:** build the output by looking up the original value. Never re-map an output.

- [ ] **Step 4: Run the tests again and expect PASS**

- [ ] **Step 5: Commit** `git commit -m "Add incognito mask"`

---

### Task 3: Mask every participant-scoped route

**Files (modify):**
- `src/server/routes/ApiPlayer.ts:46`
- `src/server/routes/PlayerInput.ts:87,113`, plus the catch branch at `:115-119`. When a mask
  applies, rewrite the error message with `maskText` before `responses.badInputRequest`.
- `src/server/routes/ApiRewind.ts:52`
- `src/server/routes/ApiRewindVote.ts:52,75`
- `src/server/routes/ApiSpectator.ts:22`
- `src/server/routes/ApiWaitingFor.ts:94,112` (the spectator and player branches only)
- `src/server/routes/ApiGameLogs.ts:43`
- `src/server/routes/ApiReplayMoves.ts:58`
- `src/server/routes/ApiReplayView.ts:31-33,77`. Map `viewAs` with `unmaskColor` before validating
  it against the player's color. Compute the mask from the live `game`, not the sandbox.
- `src/server/inputs/SelectPlayer.ts:27` and `src/server/inputs/SelectDelegate.ts:31-35`. Map
  `input.player` with `unmaskColor(input.player, incognitoMask(player.game, player.id))` before
  matching.
- `src/server/delta/DeltaProjectExpansion.ts:46`. Change the message to `'No Delta Project progress
  for a player'`.

**Test:** `tests/routes/Incognito.spec.ts`. Follow the existing route spec helpers (MockResponse,
`ctx` from `tests/routes/HttpMocks.ts`, or whatever `ApiPlayer.spec.ts` uses).

**Interfaces:**
- Consumes: `incognitoMask`, `maskModel`, `maskText` and `unmaskColor` (Task 2).

- [ ] **Step 1: Write failing tests** with 3 players named `Zzalice`, `Zzbob` and `Zzcarol`,
  incognito on. Give them colors, tiles, a claimed milestone, a funded award, a colony visit if colonies
  are enabled, and log lines that mention each player.
  - `"no opponent name in any player or spectator body"`: for each route above (as player 0, and as
    the spectator), `JSON.stringify(body)` contains neither `Zzbob` nor `Zzcarol`. Player 0's own
    name may appear. For the spectator, none of the 3 names may appear.
  - `"every color field equals the viewer's mapping"`: compare the masked body to
    `maskModel(unmaskedBody, mask)` built by the test from `Server.getPlayerModel` /
    `getSpectatorModel` directly. This catches a route that forgot to mask.
  - `"SelectPlayer answered with a fake color hits the real player"`:
    - Give player 0 a pending `SelectPlayer` over players 1 and 2.
    - POST `{type: 'player', player: fakeOf(player1)}`.
    - Expect the callback received player 1.
  - `"SelectPlayer nested in OrOptions"`: the same, wrapped in an `or` response.
  - Review Focus 2, `"rewind out of END hides again"`:
    - Set the phase to END and assert the names are visible.
    - Set the phase back to ACTION, fetch again, and assert they are hidden.
  - Review Focus 3, `"replay view of an old save follows the live game"`:
    - While running, `api/replay/view` as player 0 at save 0 hides opponents.
    - After END (with `isFinished` true), it shows real names.
  - `"incognito-off games unchanged"`: an incognito-off game's body deep-equals the unmasked model,
    for the judge as for everyone else.
  - `"land-claim error is masked"`: player 0 tries a space land-claimed by player 1, and the error
    body contains no `Zzbob`.

- [ ] **Step 2: Run the tests and confirm they fail.** Run `npx mocha --import=tsx --require tests/testing/setup.ts tests/routes/Incognito.spec.ts`. Expected: FAIL, with real names in the bodies.

- [ ] **Step 3: Wrap each listed `writeJson` payload in `maskModel(payload, incognitoMask(game, id))`,
  and apply `unmaskColor` at the inbound points listed above.**

- [ ] **Step 4: Run the tests again and expect PASS. Then run the whole server suite: `npm run test:server`.**

- [ ] **Step 5: Commit** `git commit -m "Hide opponents in incognito games"`

---

### Task 4: Shared game page and creator response

**Files:**
- Modify: `src/server/models/ServerModel.ts:34-51`. When `incognito && phase !== END`,
  `getSimpleGameModel` returns `players` sorted by `name` (`localeCompare`), every `color` set to
  `'neutral'`, and `activePlayer: 'neutral'`. Ids are kept. The admin routes that need real
  seat order (LoadGame) call a new `Server.getSimpleGameModel(game, {real: true})`.
- Modify: `src/client/components/GameHome.vue:7-9`. Key the list by `player.id`. When
  `game.gameOptions.incognito && game.phase !== 'end'`, hide `.turn-order` and the color square.
- Test: `tests/models/ServerModel.spec.ts` and `tests/client/components/GameHome.spec.ts`. Create
  the client spec if it doesn't exist.

**Interfaces:**
- Consumes: `GameOptionsModel.incognito` (Task 1).

- [ ] **Step 1: Write failing tests**
  - Server, `"incognito simple model is alphabetical and colorless"`: with players `Zed`, `Amy` and
    `Kim`, names come out `['Amy', 'Kim', 'Zed']`, and every color is `'neutral'`. With the option off,
    the order is the generation order and the colors are real. At END, the data is real.
  - `ApiCreateGame.spec.ts`, `"creator response is the masked model"`: POST an incognito game, and the
    response players are alphabetical with `'neutral'` colors.
  - Client: with an incognito game in phase `'action'`, no `.turn-order` text and no color class is
    rendered, and the names and links are present. With the option off, the output is unchanged.

- [ ] **Step 2: Run the tests and confirm they fail.**

- [ ] **Step 3: Implement as described in Files.**

- [ ] **Step 4: Run the tests again and expect PASS.** Run `npx vitest run tests/client/components/GameHome.spec.ts`
  plus the mocha files.

- [ ] **Step 5: Commit** `git commit -m "Hide seat order on the incognito game page"`

---

### Task 5: Create form checkbox and translated fake names

**Files:**
- Modify: `src/client/components/create/CreateGameForm.vue`:
  - a checkbox `incognito-checkbox`, shown when `playersCount > 1`, next to the passwords option
    (`:427`)
  - add `incognito` to the `undoNeedsPasswords` style lock (`:740-746`), with a tooltip
  - `newGameConfig` sends `incognito: this.incognito && this.playersCount > 1` (`:775`)
- Modify: `CreateGameModel.ts:58`, `defaultCreateGameModel.ts:29` (`incognito: false`), and
  `JSONProcessor.ts`. Add the key so that loading saved settings does not warn.
- Create: `src/client/utils/incognitoNames.ts`. It exports
  `translateFakeNames<T extends ViewModel>(model: T): T`. It does nothing unless
  `model.game.gameOptions.incognito && model.game.phase !== 'end'`. Otherwise it walks the model and
  rewrites a player `name` (an object with a `color` key) or a `playerName` with `translateText(value)`
  when all of these hold:
  - the value is one of `PLAYER_COLOR_LABELS`'s values
  - the value is not `model.thisPlayer?.name`

  This way, a real player named "Red" is never translated in their own view or after the end.
- Modify: the model ingestion points. Call it next to `localPlayerView` and `localColors`:
  - `App.vue:267` and the spectator branch (`:331-353`)
  - `WaitingFor.vue:192,270,324`
  - `fetchReplay.ts:32`
- Modify: `src/locales/pl/*.json`. Add the checkbox label and tooltip.
- Test: `tests/client/components/create/CreateGameForm.spec.ts`,
  `tests/client/components/create/JSONProcessor.spec.ts:122,206`,
  `tests/client/utils/incognitoNames.spec.ts`.

**Interfaces:**
- Consumes: `PLAYER_COLOR_LABELS` (Task 2), `NewGameConfig.incognito` (Task 1).

- [ ] **Step 1: Write failing tests**
  - Form: checking incognito with 2 players sends `incognito: true` and `playerPasswords: true`, and
    the passwords box is disabled. With 1 player, the box is hidden and `incognito: false` is sent.
  - JSONProcessor: a template with `incognito` loads without an "Unknown property" warning.
  - `incognitoNames`: with `setTranslationsForTest({Red: 'Czerwony'})` and an incognito game in
    phase `'action'`, an opponent `{color: 'blue', name: 'Red'}` and a milestone `playerName: 'Red'`
    are translated, and a card `{name: 'Red'}` is left alone. With `thisPlayer.name === 'Red'`, the
    viewer's own entry stays "Red". At phase `'end'`, or with the option off, nothing changes.

- [ ] **Step 2: Run the tests and confirm they fail.** Run `npx vitest run tests/client/components/create tests/client/utils/incognitoNames.spec.ts`.

- [ ] **Step 3: Implement as described in Files.**

- [ ] **Step 4: Run the tests again and expect PASS.**

- [ ] **Step 5: Commit** `git commit -m "Add incognito checkbox"`

---

### Final verification

- [ ] `npm run lint && npm run build && npm run test`. All pass.
- [ ] Local run: `mkdir -p db/files`, then `PORT=18765 LOCAL_FS_DB=1 node build/src/server/server.js`.
  Create a 3-player incognito game in the form, then open each player link and the spectator link in
  headless Chrome or Playwright. Confirm that:
  - each viewer sees different fake colors
  - Polish UI shows "Czerwony"-style names
  - GameHome is alphabetical and has no colors
  - after forcing END through the admin, real names appear
- [ ] Whole-branch review against the spec's anti-goals.
