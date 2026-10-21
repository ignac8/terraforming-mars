# Tournament Judge View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tournament games created with the new "Judge link" option get one password-protected,
read-only judge page that shows every player's hidden information and keeps itself current,
including during drafts.

**Architecture:**
- A third participant id type (`j...`) lives on the game, next to the spectator id. It is
  generated in `Game.newInstance` before the first save and stored in the participant tables
  of all three databases.
- Three server routes serve it, all behind one judge password check modeled on the player seat
  check:
  - `api/judge`: a judge model, which is the spectator model plus every player's private fields.
  - `api/waitingfor`: a judge branch that compares a change signature.
  - `api/game/logs`: a judge branch that returns every line, with private lines tagged by color.
- The client gets a `judge` page. It reuses SpectatorHome's layout and the hidden WaitingFor
  poller, plus one read-only block per player.

**Tech Stack:** TypeScript, Node (server, mocha + chai tests), Vue 3 Options API (client, vitest +
@vue/test-utils), PostgreSQL / SQLite / LocalFilesystem backends.

**Spec:** `docs/superpowers/specs/2026-10-21-judge-view-design.md` (branch `judge-view`). Read it
first. This plan only adds the names, files and tests.

## Before Task 1

- [ ] The spectator freeze fix must be on `origin/tournament`. Check with
  `git merge-base --is-ancestor eac02a280 refs/remotes/origin/tournament`. If it isn't there, stop
  and ask Marcin to push `port-polling-tournament`.
- [ ] Bring the fix in: `git merge refs/remotes/origin/tournament` on `judge-view`. Use a merge, not
  a rebase, and don't force-push. Afterwards `App.update()` returns `Promise<boolean>` and
  `WaitingFor.vue` has `pollAgainUnlessUpdated` and `pollFailed`.
- [ ] Symlink `node_modules` from a worktree whose `package-lock.json` matches (`sha1sum`), use Node
  24 (`nvm use`), and run `npx tsx src/tools/make_static_json.ts` once.
- [ ] Ask Marcin whether the new Vue components should get feature-rich tests or the sanity and
  behavior tests listed below. The repo's CLAUDE.md requires asking. If he wants more, add them to
  Task 7 and Task 8.

## Global Constraints

- The work lands on the tournament branch only (`judge-view`, merged into `tournament` later). No
  upstream PR.
- Commit messages are one short imperative line, with no body and no trailers of any kind.
- Code comments describe current behavior. Don't narrate the change ("previously ..."). No em or
  en dashes anywhere in new text.
- UI strings are English source text. Add Polish to `src/locales/pl/*.json` (`ui.json` or
  `game_setting.json`). Don't edit other locales. `npm run lint:i18n` must pass.
- Id prefix `j`, page path `judge`, model route `api/judge`, game option `judgeLink` (default
  `false`).
- The judge id and judge password never appear in `GameModel`, `PlayerViewModel`, `SpectatorModel`
  or the player and spectator pages. The only exception is `SimpleGameModel` on the organizer's
  game page.
- Judge payloads (model, poll, logs) never contain a player's `password`. While the game runs they
  never contain a player id either.
- New serialized fields are optional, so existing saved games load unchanged.
- Every test must fail when its change is reverted (check by reverting). Build tests from existing
  helpers: `testGame`, `TestPlayer`, `RouteTestScaffolding`, `MockResponse`, `globalConfig`.
  Don't test log or console text.
- Before each commit: `npm run lint`, `npm run build`, and the affected test files. In Task 10, run
  the full suites plus the PostgreSQL integration tests.

## Review Focus

1. **The judge link after a restart or cache eviction.** The game reloads from the database and
   the judge link still opens it, on every backend. Test: Task 2 database suite and GameLoader
   tests.
2. **Player and spectator pages never leak the judge.** `getPlayerModel`, `getSpectatorModel` and
   `getGameModel` contain neither `judgeId` nor `judgePassword`, even for a judge game. Test:
   Task 3.
3. **Setup-phase choices.** During initial drafting and corporation selection a player's pending
   input is a nested `initialCards` or `or` model. The judge block shows the cards inside it and
   doesn't crash. Test: Task 7.
4. **Game end.** A judge page whose game reaches `END` stays on the judge screen. It is not sent to
   `the-end` and shows no "Bad id URL parameter" alert. Test: Task 9.
5. **Opening the judge page never touches a player seat.** After any number of judge requests,
   every `player.password` is still `undefined`. A judge request with the wrong password gets 401.
   Test: Task 4.

---

### Task 1: The judge id and the game option

**Files:**
- Modify: `src/common/Types.ts`
- Modify: `src/server/routes/UrlParams.ts`
- Modify: `src/server/game/GameOptions.ts` (field and default only; `applyTournamentPreset` is
  unchanged)
- Modify: `src/common/game/NewGameConfig.ts`
- Modify: `src/server/routes/ApiCreateGame.ts`
- Modify: `src/server/IGame.ts`, `src/server/SerializedGame.ts`, `src/server/Game.ts`
- Modify: `src/server/database/Cloner.ts`
- Test: `tests/routes/ApiCreateGame.spec.ts`, `tests/database/Cloner.spec.ts`, `tests/Game.spec.ts`

**Interfaces:**
- Produces:
  - `type JudgeId = \`j${string}\``
  - `isJudgeId(object: string): object is JudgeId`
  - `ParticipantId = PlayerId | SpectatorId | JudgeId`
  - `UrlParams.participantId(name): PlayerId | SpectatorId` (narrowed return type, same checks)
  - `UrlParams.judgeId(name): JudgeId` (400 `'invalid judge id'`)
  - `GameOptions.judgeLink: boolean`
  - `NewGameConfig.judgeLink?: boolean`
  - `IGame.judgeId: JudgeId | undefined`
  - `IGame.judgePassword: Password | undefined`
  - `SerializedGame.judgeId?: JudgeId`
  - `SerializedGame.judgePassword?: Password`

- [ ] **Step 1: Write the failing tests**
  - `ApiCreateGame.spec.ts`, `it('gives a tournament game a judge id only when asked')`. Post three
    configs: tournament with `judgeLink: true`, tournament without it, and non-tournament with
    `judgeLink: true`. For each, load the game with `scaffolding.ctx.gameLoader.getGame(model.id)`
    and expect:
    - first: `isJudgeId(game.judgeId)` is true;
    - second and third: `game.judgeId` is undefined.
  - `Cloner.spec.ts`, `it('gives a cloned judge game a new judge id and no judge password')`.
    Serialize a game created with `{judgeLink: true}` and set `judgePassword = 'abc'` on the
    serialized copy. After `Cloner.clone(...)`, expect `clone.judgeId` to be a judge id different
    from the source's, and `clone.judgePassword` to be undefined.
  - `Game.spec.ts`, `it('keeps the judge id and password through serialization')`.
    `Game.deserialize(game.serialize())` keeps both. A serialized game without those keys
    deserializes with both undefined.
- [ ] **Step 2: Run them and see them fail.**
  `npx mocha --import=tsx --require tests/testing/setup.ts tests/routes/ApiCreateGame.spec.ts tests/database/Cloner.spec.ts tests/Game.spec.ts`
  Expect failures on the missing `judgeId`.
- [ ] **Step 3: Implement.**
  - **ApiCreateGame:** set `judgeLink: tournament && gameReq.judgeLink === true` in the
    `gameOptions` literal.
  - **Game.newInstance:** right after `new Game(...)`, set
    `game.judgeId = gameOptions.judgeLink ? safeCast(generateRandomId('j'), isJudgeId) : undefined`.
    This has to happen before anything saves, because PostgreSQL writes participants only on the
    first save.
  - **Game serialize/deserialize:** carry both fields.
  - **Cloner:** after the id rewrite, `if (serialized.judgeId !== undefined)`, generate a new judge
    id and delete `judgePassword`.
- [ ] **Step 4: Run the tests again.** Expect PASS. Also run `npm run build:server` to catch
  narrowing errors from the wider `ParticipantId`.
- [ ] **Step 5: Commit** `Add an opt-in judge id to tournament games`.

### Task 2: Look up and persist judge ids

**Files:**
- Modify: `src/server/database/GameLoader.ts` (`add`, `getGame` signature)
- Modify: `src/server/database/IGameLoader.ts`
- Modify: `src/server/database/PostgreSQL.ts` (participants list on the first save)
- Modify: `src/server/database/SQLite.ts` (participants list on the first save; `getGameId`)
- Modify: `src/server/database/LocalFilesystem.ts` (`getParticipants`)
- Modify: `tests/testing/InMemoryDatabase.ts` and `tests/testing/FakeGameLoader.ts` only if they
  build participant lists themselves
- Test: `tests/database/databaseSuite.ts`, `tests/database/GameLoader.spec.ts`

**Interfaces:**
- Consumes: `IGame.judgeId`, `isJudgeId` (Task 1).
- Produces: `GameLoader.getGame(id: GameId | ParticipantId, forceLoad?: boolean)` resolves judge
  ids.

- [ ] **Step 1: Write the failing tests**
  - `databaseSuite.ts`, `it('stores the judge id as a participant')`. Create a game with
    `{judgeLink: true}` and `await db.lastSaveGamePromise`. Expect:
    - `(await db.getParticipants())` has an entry for the game whose `participantIds` include
      `game.judgeId`;
    - `await db.getGameId(game.judgeId!)` equals `game.id`.
  - `GameLoader.spec.ts`, `it('finds a game by its judge id')`. After `add`,
    `getGame(game.judgeId!)` returns the game.
- [ ] **Step 2: Run them and see them fail**, with `tests/database/SQLite.spec.ts` (which runs the
  suite) and `tests/database/GameLoader.spec.ts`.
- [ ] **Step 3: Implement.**
  - In each of the three participant-list builders, push `game.judgeId` next to the existing
    `game.spectatorId` push.
  - `GameLoader.add`: map the judge id too.
  - SQLite `getGameId`: let `j` ids use the participants table instead of throwing.
- [ ] **Step 4: Run the tests again.** Expect PASS. Then run the PostgreSQL integration suite
  (Docker `postgres:18-alpine` recipe) with the same suite case.
- [ ] **Step 5: Commit** `Store judge ids as participants`.

### Task 3: The judge model and change signature

**Files:**
- Modify: `src/common/models/PlayerModel.ts` (add `PrivatePlayerFields`)
- Create: `src/common/models/JudgeModel.ts`
- Modify: `src/server/models/ServerModel.ts`
- Test: `tests/models/ServerModel.spec.ts`

**Interfaces:**
- Produces:
  - `type PrivatePlayerFields = Pick<PlayerViewModel, 'cardsInHand' | 'ceoCardsInHand' | 'dealtCorporationCards' | 'dealtPreludeCards' | 'dealtCeoCards' | 'dealtProjectCards' | 'draftedCards' | 'pickedCorporationCard' | 'preludeCardsInHand' | 'waitingFor'>`
  - `type JudgePlayerModel = PrivatePlayerFields & {color: Color}`
  - `interface JudgeModel extends ViewModel {id: JudgeId; color: 'neutral'; password: Password | undefined; signature: string; privates: Array<JudgePlayerModel>}`.
    `password` is the judge's own, so `passwordParam()` keeps working.
  - `Server.getPrivateFields(player: IPlayer): PrivatePlayerFields`. `getPlayerModel` spreads it,
    with no behavior change.
  - `Server.getJudgeModel(game: IGame): JudgeModel`. It throws when `game.judgeId` is undefined.
    It uses `players: playersInGenerationOrder.map((p) => getPlayer(p, true))`,
    `thisPlayer: undefined`, and `privates` in the same order.
  - `Server.getJudgeSignature(game: IGame): string`. Built from `lastSaveId`, `gameAge`,
    `undoCount` and each player's `getWaitingFor()?.requestId` (use `'-'` when there is none).

- [ ] **Step 1: Write the failing tests** in `ServerModel.spec.ts`:
  - `it('judge model shows every player\'s hand and no player secrets')`. 2 players, game created
    with `{judgeLink: true, playerPasswords: true}`. Give each player a different card in hand and
    set `player.password`. Expect `privates.map((p) => p.cardsInHand.map(toName))` to list both
    cards, and expect `JSON.stringify(model)` to include neither player's password nor player id.
  - `it('player and spectator models never carry the judge id')`. `JSON.stringify` of
    `getPlayerModel(player)` and `getSpectatorModel(game)` doesn't contain `game.judgeId`, and
    `judgePassword` set to `'secret'` doesn't appear either. (Review Focus 2.)
  - `it('a draft pick changes the judge signature')`. Use the `tests/drafting.spec.ts` setup
    (`testGame(2, {draftVariant: true, judgeLink: true})`, `game.generation = 1`,
    `finishGeneration(game)`). Take the signature, have one player pick a card the way that spec's
    `selectCard` helper does, and expect a different signature.
- [ ] **Step 2: Run them and see them fail.**
- [ ] **Step 3: Implement** the types and the three server functions.
- [ ] **Step 4: Run the tests again**, plus all of `tests/models/ServerModel.spec.ts`. Expect PASS.
- [ ] **Step 5: Commit** `Build a judge model from every player's private fields`.

### Task 4: The judge password and the `api/judge` route

**Files:**
- Modify: `src/server/routes/Handler.ts`
- Create: `src/server/routes/ApiJudge.ts`
- Modify: `src/common/app/paths.ts` (`API_JUDGE: 'api/judge'`, `JUDGE: 'judge'`)
- Modify: `src/server/server/requestProcessor.ts` (`[paths.API_JUDGE, ApiJudge.INSTANCE]`,
  `[paths.JUDGE, ServeApp.INSTANCE]`)
- Test: create `tests/routes/JudgePasswords.spec.ts` (same scaffolding as
  `PlayerPasswords.spec.ts`)

**Interfaces:**
- Consumes: `Server.getJudgeModel` (Task 3), `UrlParams.judgeId` (Task 1).
- Produces:
  - `Handler.checkJudgePassword(game: IGame, ctx: Context): void`. It claims a random
    `PASSWORD_BYTES` password on the first call and requires `?password=` after that (with
    `safeEquals`). Mismatch gives `RouteError.unauthorized()`. `isServerIdValid` passes. There is
    no exemption for solo games, `END`, or `playerPasswords`.
  - `Handler.loadJudgeGame(ctx: Context): Promise<IGame>`. It reads `judgeId('id')`, loads the
    game, and returns 404 unless `game.judgeId === id`. Then it calls `checkJudgePassword`.
  - `GET api/judge?id=j...[&password=...]` returns `Server.getJudgeModel(game)`, with
    `password: game.judgePassword`.

- [ ] **Step 1: Write the failing tests** in `JudgePasswords.spec.ts`:
  - The first visitor claims the judge password and gets it back in `model.password`.
  - A later visitor without it, or with `&password=deadbeef`, gets `statusCode.unauthorized`.
  - With the password, the visitor gets 200.
  - A solo game and a game at `Phase.END` still require the password.
  - `&serverId=1` (the scaffolding's server id) gets through, as in `PlayerPasswords.spec.ts`.
  - `it('judge requests never claim a player seat')`. After two judge GETs, every
    `player.password` is still undefined. (Review Focus 5.)
  - A spectator or player id on `api/judge` gets 400.
- [ ] **Step 2: Run them and see them fail.**
- [ ] **Step 3: Implement** the handler methods, the route, the paths and the route table entries.
- [ ] **Step 4: Run the tests again**, plus `tests/routes/PlayerPasswords.spec.ts`. Expect PASS.
- [ ] **Step 5: Commit** `Serve the judge model behind a judge password`.

### Task 5: Judge branch in the waiting-for poll

**Files:**
- Modify: `src/server/routes/ApiWaitingFor.ts`
- Test: `tests/routes/ApiWaitingFor.spec.ts`

**Interfaces:**
- Consumes: `Handler.loadJudgeGame`, `Server.getJudgeSignature`.
- Produces: `GET api/waitingfor?id=j...&signature=...[&password=...]`. It returns
  `{result: 'REFRESH', waitingFor}` when `signature !== getJudgeSignature(game)`, and
  `{result: 'WAIT', waitingFor}` otherwise. The branch runs before `participantId('id')` is read.

- [ ] **Step 1: Write the failing tests:**
  - The current signature gives `WAIT`. A stale one gives `REFRESH`.
  - Without the claimed password the poll gets 401.
- [ ] **Step 2: Run them and see them fail.**
- [ ] **Step 3: Implement:** branch on `isJudgeId(ctx.urlParams.get('id'))`.
- [ ] **Step 4: Run the tests again.** Expect PASS.
- [ ] **Step 5: Commit** `Poll judge pages on a change signature`.

### Task 6: Judge branch in the game logs

**Files:**
- Modify: `src/common/logs/LogMessage.ts` (`public owner?: Color`)
- Modify: `src/server/routes/GameLogs.ts`
- Modify: `src/server/routes/ApiGameLogs.ts`
- Test: `tests/routes/ApiGameLogs.spec.ts`

**Interfaces:**
- Produces:
  - `GameLogs.getLogsForJudge(game: IGame, generation: number | undefined): Array<LogMessage>`.
    It keeps the same generation and last-50 slicing as `getLogsForGameView`, keeps every line,
    and returns copies. In each copy with a `playerId`, `playerId` is deleted and `owner` is set
    to that player's color.
  - `ApiGameLogs` serves it for `j` ids after `loadJudgeGame`.

- [ ] **Step 1: Write the failing test.**
  `it('judge logs include private lines tagged with their owner')`. Log one private line for each
  of two players with `{reservedFor: player}`. The judge response contains both, with
  `owner === player.color`, and no line has a `playerId`.
- [ ] **Step 2: Run it and see it fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the test again**, plus the existing `ApiGameLogs` tests. Expect PASS.
- [ ] **Step 5: Commit** `Show judges every log line with its owner`.

### Task 7: Read-only pending choice

**Files:**
- Create: `src/client/components/judge/JudgePendingChoice.vue` (prop `input: PlayerInputModel`)
- Test: create `tests/client/components/judge/JudgePendingChoice.spec.ts`

**Interfaces:**
- Produces: a recursive, read-only rendering.
  - It shows the translated `title`, then the `cards` as `Card` components when the model has
    them.
  - For `type` `or`, `and` or `initialCards` it renders each entry of `options` with the same
    component.
  - It has no buttons and sends nothing to the server.
  - It doesn't use `PlayerInputFactory`, whose inputs read `playerView.thisPlayer`, which is
    undefined on a judge page.

- [ ] **Step 1: Write the failing test.**
  `it('shows the cards inside a nested setup choice')`. Use an `initialCards` model whose `options`
  are two `card` models holding a corporation and a project card. Expect both card names in the
  text, and no `button`. (Review Focus 3.)
- [ ] **Step 2: Run it and see it fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the test again.** Expect PASS.
- [ ] **Step 5: Commit** `Show each player's pending choice to the judge`.

### Task 8: The judge page

**Files:**
- Create: `src/client/components/judge/JudgeHome.vue` (prop `judge: JudgeModel`)
- Create: `src/client/components/judge/JudgePlayerPanel.vue` (props `privates: JudgePlayerModel`,
  `player: PublicPlayerModel`)
- Modify: `src/client/components/logpanel/LogPanel.vue` (shows `owner` as a player-color marker on
  the line)
- Test: create `tests/client/components/judge/JudgeHome.spec.ts`. Extend
  `tests/client/components/logpanel/*` for the owner marker.

**Interfaces:**
- Consumes: `JudgeModel`, `JudgePlayerModel`, `JudgePendingChoice` (Task 7).
- Produces:
  - `JudgeHome`: the SpectatorHome layout (Sidebar, LogPanel, PlayersOverview, GameBoardView,
    Colonies) plus one `JudgePlayerPanel` per `privates` entry, matched to `players` by color.
    It also has `<WaitingFor v-show="false" :playerView="judge" :waitingfor="undefined"/>`, and no
    spectator or judge link on the page.
  - `JudgePlayerPanel`: titled sections for hand, drafted cards, dealt corporations, preludes,
    CEOs and project cards, the picked corporation, and preludes and CEOs in hand. Empty sections
    are hidden. It also shows `<JudgePendingChoice :input="privates.waitingFor"/>` when one is
    pending.
  - Cards render with plain `Card` loops, not `SortableCards`, whose order storage is keyed by
    player id.

- [ ] **Step 1: Write the failing tests:**
  - `JudgeHome.spec.ts`, `it('shows one hidden-info block per player')`. Mount with a 2-player
    judge model whose `privates` each hold one hand card. Expect two `JudgePlayerPanel`s and both
    card names in the text.
  - LogPanel: a message with `owner: 'red'` renders an element with class
    `playerColorClass('red', 'bg')` on that line. A message without `owner` renders none.
- [ ] **Step 2: Run them and see them fail.**
- [ ] **Step 3: Implement.** Section titles are new UI strings, so add Polish entries.
- [ ] **Step 4: Run the tests again**, plus `npm run lint:i18n` and `npm run lint:client`. Expect
  PASS.
- [ ] **Step 5: Commit** `Add the judge page`.

### Task 9: Client plumbing for the judge page

**Files:**
- Modify: `src/client/components/App.vue`
- Modify: `src/client/components/WaitingFor.vue`
- Modify: `src/client/utils/playerPassword.ts` (doc comment only: judge models carry a password
  too)
- Test: `tests/client/components/WaitingFor.spec.ts`, `tests/client/components/App.spec.ts`

**Interfaces:**
- Consumes: `JudgeModel`, `paths.JUDGE`, `paths.API_JUDGE`.
- Produces:
  - App data `judge: JudgeModel | undefined`.
  - Screen `'judge-home'`, rendering `JudgeHome` (Task 8) with `:judge="judge"`.
  - `updateJudge(): Promise<boolean>`.
  - `update(path: typeof paths.PLAYER | typeof paths.SPECTATOR | typeof paths.JUDGE)`. For
    `JUDGE` it stores the model in `judge`, keeps `&password=` in the address bar the way player
    pages do, and skips the `the-end` redirect.
  - In WaitingFor, when `isJudgeId(playerView.id)`, the poll query is
    `'&signature=' + encodeURIComponent((playerView as JudgeModel).signature)` instead of
    `gameAge`/`undoCount`, and `REFRESH` calls `root.updateJudge().then(pollAgainUnlessUpdated)`.

- [ ] **Step 1: Write the failing tests:**
  - `WaitingFor.spec.ts`, `it('polls a judge page with its signature and refreshes it')`. Use the
    existing `stubPolls` and `mountSpectator` helpers, with a judge-shaped view
    (`id: 'j-judge-id'`, `signature: 'sig-1'`) and `mocks: {updateJudge: vi.fn(async () => true)}`.
    Expect the poll URL to contain `signature=sig-1`, and `updateJudge` to have been called once.
  - `App.spec.ts`, `it('keeps a finished judge game on the judge screen')`. Set
    `window.history.replaceState({}, '', '/judge?id=j1')` and stub `fetch` with a judge model at
    `phase: 'end'`. Mount, flush, and expect the screen to be `'judge-home'`, with no `alert`.
    (Review Focus 4.)
- [ ] **Step 2: Run them and see them fail.**
  `npx vitest run tests/client/components/WaitingFor.spec.ts tests/client/components/App.spec.ts`
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the tests again.** Expect PASS. Then run `npm run lint:client`.
- [ ] **Step 5: Commit** `Route judge pages through App and WaitingFor`.

### Task 10: The organizer's game page and the create form

**Files:**
- Modify: `src/common/models/SimpleGameModel.ts` (`judgeId?: JudgeId`)
- Modify: `src/server/models/ServerModel.ts` (`getSimpleGameModel` sets `judgeId`)
- Modify: `src/client/components/GameHome.vue`. Add a "Judge" row after the spectator row, only
  when `game.judgeId` is set, with a copy button. Under it, the hint "Open the judge link now,
  before you share this page. The first person to open it receives its password." `getHref` maps
  judge ids to `judge?id=`.
- Modify: `src/client/components/create/CreateGameModel.ts` (`judgeLink: boolean`) and
  `defaultCreateGameModel.ts` (`judgeLink: false`).
- Modify: `src/client/components/create/CreateGameForm.vue`:
  - a checkbox `id="judgeLink-checkbox"`, label "Judge link", next to the player passwords
    checkbox, shown with `v-if="expansions.tournament"`;
  - `judgeLink: this.expansions.tournament && this.judgeLink` in the `newGameConfig` computed.
- Modify: `src/locales/pl/game_setting.json` (Polish for "Judge", "Judge link" and the hint).
- Test: `tests/client/components/GameHome.spec.ts`,
  `tests/client/components/create/CreateGameForm.spec.ts`

**Interfaces:**
- Consumes: `IGame.judgeId`, `NewGameConfig.judgeLink` (Task 1).

- [ ] **Step 1: Write the failing tests:**
  - `GameHome.spec.ts`: with `judgeId: 'j1'` the page has a link `judge?id=j1`. Without it, no
    judge link.
  - `CreateGameForm.spec.ts`, `it('sends the judge option only for tournament games')`:
    - tournament on and judge checked: `newGameConfig.judgeLink === true`;
    - tournament off: `false`;
    - the checkbox is absent when tournament is off.
- [ ] **Step 2: Run them and see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the tests again**, plus `npm run lint:i18n`. Expect PASS.
- [ ] **Step 5: Commit** `Offer a judge link when creating tournament games`.

### Task 11: Full verification and a real run

- [ ] Run `npm run lint`, `npm run build`, `npm run test:client` and `npm run test:server`. All must
  exit 0. Record the pass counts.
- [ ] Run the PostgreSQL integration suite (Docker recipe). All pass.
- [ ] Real run: `npm run build`, then start the server locally on LocalFilesystem.
  1. Create a 2-player tournament game with "Judge link" checked.
  2. Open the judge link, then the two player links in two other browser profiles.
  3. Make one draft pick and watch the judge page update within about 2 seconds without a reload.
  4. Restart the server and check that the judge link with its password still opens.
  5. Note what you saw. That note goes in the hand-off message.
- [ ] Hand off: fetch, check that `judge-view` fast-forwards from `origin/tournament`, and give
  Marcin the push line. Auto mode blocks deploy pushes.
