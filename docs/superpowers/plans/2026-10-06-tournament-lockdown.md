# Tournament Lockdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Revision.** This plan replaces the first version, which targeted a stale
> base. Every line number and file below was read on `origin/tournament`
> `ec52b8f39`, which is the base of `tournament-lockdown`.

**Goal:** Tournament games are created with the rulebook's options regardless
of what the create-game form or API request says: undo off, no custom
card/corporation/prelude/CEO/colony lists, TR boost 0, fast mode off, live VP
off, player passwords on.

**Architecture:** The server enforces: `applyTournamentPreset`, the create
route, and tournament dealing in `Game.newInstance`. The client mirrors it
through one `applyTournamentLocks()` method on `CreateGameForm`. That method
runs on first load, on toggle, after restoring saved settings, and after
Reset. Server and client tasks touch disjoint files and can run in parallel.

**Tech Stack:** TypeScript, Vue 3 Options API. Server tests use mocha + chai
via `tsx`. Client tests use vitest + `@vue/test-utils` + chai.

**Spec:** `docs/superpowers/specs/2026-10-06-tournament-lockdown-design.md`

## Global Constraints

- Branch `tournament-lockdown`, based on `origin/tournament` `ec52b8f39`. Do
  not merge, rebase, push or fetch. Commits only.
- Prefix every npm/npx command with
  `source ~/.nvm/nvm.sh && nvm use >/dev/null &&`. The default Node may be
  wrong.
- Commit messages: one terse line, no body, **no trailers of any kind** (no
  `Co-Authored-By`, no `Claude-Session`). Never amend; add a new commit.
- Code style: `undefined` not `null`; `type` not `interface`; match the
  surrounding file.
- `game.gameOptions` is `Readonly`. Never assign to it in tests (TS2540 fails
  `build:test`). Pass options through `testGame(n, {...})` instead.
- Server single-file test:
  `npx mocha --import=tsx --require tests/testing/setup.ts "<file>"`.
  Client single-file test: `npx vitest run <file>`.
- The tournament locks are exactly: `undoOption=false`,
  `fastModeOption=false`, `showOtherPlayersVP=false`, `playerPasswords=true`,
  per-player handicap 0, and these six lists empty: `customCorporationsList`,
  `bannedCards`, `includedCards`, `customColoniesList`, `customPreludes`,
  `customCeos`. Board, first player, timers (`showTimers`) and escape velocity
  stay settable.
- Do not touch cloning (`Cloner`, `seeded-checkbox`) or `/load_game`. Both are
  out of scope by user decision.

## Review Focus

1. **A tournament POST whose config lacks an `expansions` key** (some existing
   route tests post partial configs). The new tournament checks must use
   `gameReq.expansions?.tournament`, or those requests crash with a
   TypeError instead of behaving as before. Test in Task 1.
2. **A tournament POST with a custom corporation list shorter than
   players × starting corporations.** Today it gets a 400 for a list that
   would be thrown away. After the change it must succeed (2xx). Test in Task
   1.
3. **A saved-settings restore in the real nested shape**
   (`expansions: {tournament: true, prelude: true}`) plus undo, handicap and
   custom lists. The user expects a fully locked form. That includes Prelude
   off, because restoring only the new fields would leave Prelude on. Test in
   Task 2.
4. **First load with no saved settings.** The form starts in tournament mode,
   so a non-immediate watcher never fires and `playerPasswords` would show
   greyed out and unticked. The expected state is ticked and disabled. Test in
   Task 2.
5. **An upstream merge adding a new `GameOptions` key** that the preset
   neither forces nor deliberately passes through. The classification test
   must fail and name it. Test in Task 1.

---

### Task 0: Workspace setup (controller, before any dispatch)

The worktree has no `node_modules` and no `src/genfiles`. Run this once,
before Tasks 1 and 2 start. Two parallel implementers running `npm ci` in the
same directory would corrupt it.

- [ ] **Step 1:** `source ~/.nvm/nvm.sh && nvm use >/dev/null && npm ci`
- [ ] **Step 2:** `source ~/.nvm/nvm.sh && nvm use >/dev/null && npm run build`
  (produces `src/genfiles`, which client tests need)
- [ ] **Step 3:** Confirm a baseline: run
  `npx mocha --import=tsx --require tests/testing/setup.ts "tests/TournamentMode.spec.ts"`
  and `npx vitest run tests/client/components/create/CreateGameForm.spec.ts`.
  Both must pass before any change.

---

### Task 1: Server enforcement

**Files:**
- Modify: `src/server/game/GameOptions.ts:88-154` (doc comment + `applyTournamentPreset`)
- Modify: `src/server/Game.ts:390-402` (tournament pool)
- Modify: `src/server/routes/ApiCreateGame.ts:97-112` (`validateCustomLists`), `:133-141` (player construction)
- Modify: `tournament/PLAN.md:119-121` (item 3), `:134-138` (item 6)
- Test: `tests/TournamentMode.spec.ts`, `tests/routes/ApiCreateGame.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `applyTournamentPreset(options: GameOptions): void`. The
  signature is unchanged, and the function now also forces the locks in
  Global Constraints. `ApiCreateGame.validateCustomLists(gameReq)` returns
  early for tournament requests. Tournament dealing in `Game.newInstance` no
  longer reads `customCorporationsList`.

- [ ] **Step 1: Extend the preset test.** In `tests/TournamentMode.spec.ts`,
  in the test `applyTournamentPreset forces the regulation options` (line
  241), add these to the `options` object literal, after `boardName`:

```typescript
      undoOption: true,
      fastModeOption: true,
      showOtherPlayersVP: true,
      playerPasswords: false,
      customCorporationsList: [CardName.TERACTOR_TOURNAMENT],
      bannedCards: [CardName.MINE],
      includedCards: [CardName.MINE],
      customColoniesList: [ColonyName.EUROPA],
      customPreludes: [CardName.DONATION],
      customCeos: [CardName.FLOYD],
```

Then add these assertions after the existing `boardName` assertion:

```typescript
    expect(options.undoOption).is.false;
    expect(options.fastModeOption).is.false;
    expect(options.showOtherPlayersVP).is.false;
    expect(options.playerPasswords).is.true;
    expect(options.customCorporationsList).is.empty;
    expect(options.bannedCards).is.empty;
    expect(options.includedCards).is.empty;
    expect(options.customColoniesList).is.empty;
    expect(options.customPreludes).is.empty;
    expect(options.customCeos).is.empty;
```

Add the import next to the others:
`import {ColonyName} from '../src/common/colonies/ColonyName';`

- [ ] **Step 2: Add the classification test** after
  `applyTournamentPreset keeps escape velocity`:

```typescript
  it('applyTournamentPreset classifies every game option', () => {
    // Every GameOptions key is either forced by the tournament preset or
    // deliberately left to the game creator. A new key in neither list
    // fails here, so an upstream option cannot slip past the preset.
    const forced = [
      'altVenusBoard', 'aresExtension', 'aresExtremeVariant', 'bannedCards',
      'ceoExtension', 'ceosDraftVariant', 'coloniesExtension', 'communityCardsOption',
      'corporateEra', 'customCeos', 'customColoniesList', 'customCorporationsList',
      'customPreludes', 'deltaProjectExpansion', 'draftVariant', 'expansions',
      'fastModeOption', 'includeFanMA', 'includedCards', 'initialDraftVariant',
      'modularMA', 'moonExpansion', 'moonStandardProjectVariant',
      'moonStandardProjectVariant1', 'pathfindersExpansion', 'playerPasswords',
      'politicalAgendasExtension', 'prelude2Expansion', 'preludeDraftVariant',
      'preludeExtension', 'promoCardsOption', 'randomMA', 'requiresMoonTrackCompletion',
      'requiresVenusTrackCompletion', 'showOtherPlayersVP', 'shuffleMapOption',
      'solarPhaseOption', 'starWarsExpansion', 'turmoilExtension', 'twoCorpsVariant',
      'underworldExpansion', 'undoOption', 'venusNextExtension',
    ];
    const passthrough = [
      'aresHazards', // inert: Ares is forced off
      'boardName', // clamped to Tharsis/Hellas/Elysium, otherwise free
      'clonedGamedId', // cloning is out of scope (user decision)
      'escapeVelocity', // tournament games may use the clock
      'removeNegativeGlobalEventsOption', // inert: Turmoil is forced off
      'showTimers',
      'soloTR',
      'startingCeos', // inert: CEOs are forced off
      'startingCorporations', // inert: tournament dealing always uses the pool size
      'startingPreludes', // inert: Prelude is forced off
      'tournamentExpansion',
    ];
    expect([...forced, ...passthrough].sort()).deep.eq(Object.keys(DEFAULT_GAME_OPTIONS).sort());
  });
```

- [ ] **Step 3: Replace the pool-sampling tests.** Delete
  `customCorporationsList becomes the pool, filtered to tournament corporations`
  (line 68) and `customCorporationsList larger than the pool size is sampled down to 5`
  (line 80). Put this single test in their place:

```typescript
  it('customCorporationsList is ignored under tournament rules', () => {
    const [/* game */, p1, p2, p3] = testGame(3, {
      tournamentExpansion: true,
      customCorporationsList: [CardName.TERACTOR_TOURNAMENT, CardName.ECOLINE_TOURNAMENT, CardName.PHOBOLOG],
    });

    for (const player of [p1, p2, p3]) {
      expect(player.dealtCorporationCards).has.length(5);
      for (const name of player.dealtCorporationCards.map(toName)) {
        expect(name).to.match(/:tournament$/);
      }
    }
  });
```

- [ ] **Step 4: Add the in-flight test** right after it:

```typescript
  it('A serialized tournament game keeps the undoOption it was created with', () => {
    // There is no load-time migration: running games keep their options.
    const [game] = testGame(2, {tournamentExpansion: true, undoOption: true});

    expect(Game.deserialize(game.serialize()).gameOptions.undoOption).is.true;
  });
```

- [ ] **Step 5: Add the create-route tests** to
  `tests/routes/ApiCreateGame.spec.ts`, after the existing
  custom-corporation-list tests. Each uses the file's `newGameConfigForTest()`
  and `postConfig()` helpers:

```typescript
  it('forces tournament locks on a created tournament game', async () => {
    const config = {
      ...newGameConfigForTest(),
      players: [
        {name: 'a', color: 'red', beginner: false, handicap: 3, first: true},
        {name: 'b', color: 'blue', beginner: false, handicap: 5, first: false},
      ],
      expansions: {...newGameConfigForTest().expansions, tournament: true},
      undoOption: true,
      fastModeOption: true,
      showOtherPlayersVP: true,
      playerPasswords: false,
      startingCorporations: 5,
      // Too short for 2 players × 5: must not be rejected, since it is discarded.
      customCorporationsList: [CardName.TERACTOR_TOURNAMENT],
      bannedCards: [CardName.MINE],
      includedCards: [CardName.MINE],
      customPreludes: [CardName.DONATION],
      customCeos: [CardName.FLOYD],
    };
    await postConfig(config);

    expect(res.statusCode).eq(statusCode.ok);
    const model = JSON.parse(res.content) as SimpleGameModel;
    const game = await scaffolding.ctx.gameLoader.getGame(model.id);
    expect(game).is.not.undefined;
    const options = game!.gameOptions;
    expect(options.undoOption).is.false;
    expect(options.fastModeOption).is.false;
    expect(options.showOtherPlayersVP).is.false;
    expect(options.playerPasswords).is.true;
    expect(options.customCorporationsList).is.empty;
    expect(options.bannedCards).is.empty;
    expect(options.includedCards).is.empty;
    expect(options.customPreludes).is.empty;
    expect(options.customCeos).is.empty;
    expect(game!.players.map((p) => p.handicap)).deep.eq([0, 0]);
  });

  it('keeps handicap and custom lists in non-tournament games', async () => {
    const config = {
      ...newGameConfigForTest(),
      players: [{name: 'a', color: 'red', beginner: false, handicap: 3, first: true}],
    };
    await postConfig(config);

    expect(res.statusCode).eq(statusCode.ok);
    const model = JSON.parse(res.content) as SimpleGameModel;
    const game = await scaffolding.ctx.gameLoader.getGame(model.id);
    expect(game!.players[0].handicap).eq(3);
  });
```

`postConfig` is declared inside the `describe` block. Place these tests after
its declaration (after the line `const twoPlayers = ...`).

- [ ] **Step 6: Run the tests and confirm they fail.**

```bash
source ~/.nvm/nvm.sh && nvm use >/dev/null && npx mocha --import=tsx --require tests/testing/setup.ts "tests/TournamentMode.spec.ts" "tests/routes/ApiCreateGame.spec.ts"
```

Expected failures: the extended preset test (`undoOption`), the
classification test, `customCorporationsList is ignored…` (2 corporations
dealt, not 5), and `forces tournament locks…` (400 for the short list, or
undo still true). Expected passes: the in-flight test and
`keeps handicap…`.

- [ ] **Step 7: Implement the preset.** In `src/server/game/GameOptions.ts`,
  insert after `options.twoCorpsVariant = false;` (line 149):

```typescript
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

Replace the doc comment body lines 93-95 (from `* Base + Corporate Era only`
through `* corporation pool override stay untouched.`) with:

```typescript
 * Base + Corporate Era only, draft everywhere, an official board, none of
 * the rule-changing variants, undo and fast mode off, other players' VP
 * hidden, player passwords on, and no custom card, corporation, prelude, CEO
 * or colony lists. Board choice, timers and escape velocity stay with the
 * game creator. Per-player TR boost is zeroed in ApiCreateGame, since it is
 * not a game option.
```

- [ ] **Step 8: Remove custom pool sampling.** In `src/server/Game.ts`, replace
  lines 395-399:

```typescript
    if (gameOptions.tournamentExpansion) {
      const tournamentCorps = CardManifest.keys(TOURNAMENT_CARD_MANIFEST.corporationCards);
      const custom = [...new Set(gameOptions.customCorporationsList)].filter((name) => tournamentCorps.includes(name));
      const candidates = custom.length > 0 ? custom : [...tournamentCorps];
      inplaceShuffle(candidates, rng);
```

with:

```typescript
    if (gameOptions.tournamentExpansion) {
      // The pool is always drawn from every tournament corporation; game
      // creators cannot narrow it.
      const candidates = [...CardManifest.keys(TOURNAMENT_CARD_MANIFEST.corporationCards)];
      inplaceShuffle(candidates, rng);
```

Keep the following `tournamentPool = …` and `game.log(…)` lines unchanged.

- [ ] **Step 9: Implement the route changes.** In
  `src/server/routes/ApiCreateGame.ts`, make `validateCustomLists` return
  early. Insert as the first statement of its body (line 98):

```typescript
    // Tournament games discard every custom list, so there is nothing to validate.
    if (gameReq.expansions?.tournament === true) {
      return;
    }
```

Then, in `post`, replace the player construction (lines 133-141):

```typescript
      const players = gameReq.players.map((p) => {
        return new Player(
          p.name,
          p.color,
          p.beginner,
          Number(p.handicap), // For some reason handicap is coming up a string.
          safeCast(generateRandomId('p'), isPlayerId),
        );
      });
```

with:

```typescript
      // TR boost is per player, so applyTournamentPreset cannot reach it.
      const tournament = gameReq.expansions?.tournament === true;
      const players = gameReq.players.map((p) => {
        return new Player(
          p.name,
          p.color,
          p.beginner,
          tournament ? 0 : Number(p.handicap), // For some reason handicap is coming up a string.
          safeCast(generateRandomId('p'), isPlayerId),
        );
      });
```

- [ ] **Step 10: Update `tournament/PLAN.md`.** In item 3 (lines 119-121),
  replace `draw 5\n   tournament corps once (or use `customCorporationsList` as the pool if set — creator\n   override), then give`
  with `draw 5\n   tournament corps once from the full tournament set (no creator override), then give`.
  In item 6 (lines 136-137), replace
  `player count, colors, undo, timers and the\n   corporation pool override stay free.`
  with
  `player count, colors, board, timers and escape\n   velocity stay free; undo, fast mode, other players' VP, player passwords (forced on),\n   TR boost and every custom card/corporation/prelude/CEO/colony list are forced and locked.`.
  Keep the surrounding lines unchanged.

- [ ] **Step 11: Run the tests and confirm they pass.** Run the same command
  as Step 6. Expected: everything passes in both files. That includes the
  untouched `Deals one shared pool of 5 tournament corporations to every player`.
  Then type-check the tests: `npm run build:test`. It must report no errors.

- [ ] **Step 12: Commit.**

```bash
git add src/server/game/GameOptions.ts src/server/Game.ts src/server/routes/ApiCreateGame.ts tournament/PLAN.md tests/TournamentMode.spec.ts tests/routes/ApiCreateGame.spec.ts
git commit -m "Force tournament rules on the server and drop the custom corporation pool"
```

---

### Task 2: Client form locks

**Files:**
- Modify: `src/client/components/create/CreateGameForm.vue`. Template lines:
  238, 303, 325, 330, 437, 442, 447, 483. Script: the `'expansions.tournament'`
  watcher at 674-705, `applySettings` at 889, `resetSettings` at 926.
- Test: `tests/client/components/create/CreateGameForm.spec.ts`

**Interfaces:**
- Consumes: nothing from Task 1. The client only mirrors the server.
- Produces: a component method `applyTournamentLocks(): void`.

- [ ] **Step 1: Write the failing tests.** Add these inside the existing
  `describe('CreateGameForm', …)` block. They use the file's existing
  `localStorage`, `globalConfig`, `CreateGameSettingsStorage` and
  `DEFAULT_EXPANSIONS`:

```typescript
  function expectTournamentLocks(vm: any) {
    expect(vm.undoOption).eq(false);
    expect(vm.fastModeOption).eq(false);
    expect(vm.showOtherPlayersVP).eq(false);
    expect(vm.playerPasswords).eq(true);
    for (const player of vm.players) {
      expect(player.handicap).eq(0);
    }
    for (const flag of ['showCorporationList', 'showPreludesList', 'showColoniesList',
      'showCeosList', 'showBannedCards', 'showIncludedCards']) {
      expect(vm[flag], flag).eq(false);
    }
    for (const list of ['customCorporations', 'customPreludes', 'customColonies',
      'customCeos', 'bannedCards', 'includedCards']) {
      expect(vm[list], list).is.empty;
    }
    expect(vm.expansions.prelude).eq(false);
  }

  function seedLockedFields(vm: any) {
    vm.undoOption = true;
    vm.fastModeOption = true;
    vm.showOtherPlayersVP = true;
    vm.playerPasswords = false;
    vm.players[0].handicap = 4;
    vm.showCorporationList = true;
    vm.showBannedCards = true;
    vm.showIncludedCards = true;
    vm.customCorporations = ['Teractor'];
    vm.customPreludes = ['Donation'];
    vm.customColonies = ['Europa'];
    vm.customCeos = ['Floyd'];
    vm.bannedCards = ['Mine'];
    vm.includedCards = ['Mine'];
  }

  it('applies tournament locks on first load', async () => {
    const wrapper = shallowMount(CreateGameForm, {...globalConfig});
    await wrapper.vm.$nextTick();

    expectTournamentLocks(wrapper.vm as any);
    for (const id of ['#undo-checkbox', '#customCorps-checkbox', '#bannedCards-checkbox',
      '#includedCards-checkbox', '#realTimeVP-checkbox', '#fastMode-checkbox',
      '#playerPasswords-checkbox']) {
      expect(wrapper.find(id).attributes('disabled'), id).is.not.undefined;
    }
  });

  it('applies tournament locks when tournament is switched back on', async () => {
    const wrapper = shallowMount(CreateGameForm, {...globalConfig});
    await wrapper.vm.$nextTick();
    const vm = wrapper.vm as any;

    vm.expansions.tournament = false;
    await wrapper.vm.$nextTick();
    vm.expansions.prelude = true;
    seedLockedFields(vm);
    await wrapper.vm.$nextTick();

    vm.expansions.tournament = true;
    await wrapper.vm.$nextTick();

    expectTournamentLocks(vm);
  });

  it('re-enables the undo control when tournament is switched off', async () => {
    const wrapper = shallowMount(CreateGameForm, {...globalConfig});
    await wrapper.vm.$nextTick();
    expect(wrapper.find('#undo-checkbox').attributes('disabled')).is.not.undefined;

    (wrapper.vm as any).expansions.tournament = false;
    await wrapper.vm.$nextTick();

    expect(wrapper.find('#undo-checkbox').attributes('disabled')).is.undefined;
  });

  it('applies tournament locks when restoring saved tournament settings', async () => {
    new CreateGameSettingsStorage(localStorage).saveSettings(createNewGameConfig({
      players: [
        {name: 'Alice', color: 'red', beginner: false, handicap: 3, first: false},
        {name: 'Bob', color: 'blue', beginner: false, handicap: 0, first: true},
      ],
      expansions: {...DEFAULT_EXPANSIONS, tournament: true, prelude: true},
      undoOption: true,
      fastModeOption: true,
      showOtherPlayersVP: true,
      playerPasswords: false,
      customCorporationsList: ['Teractor'],
      customPreludes: ['Donation'],
      bannedCards: ['Mine'],
      includedCards: ['Mine'],
    }));

    const wrapper = shallowMount(CreateGameForm, {...globalConfig});
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    expectTournamentLocks(wrapper.vm as any);
  });

  it('applies tournament locks when restoring the legacy flat tournament key', async () => {
    new CreateGameSettingsStorage(localStorage).saveSettings({
      players: [
        {name: 'Alice', color: 'red', beginner: false, handicap: 3, first: true},
        {name: 'Bob', color: 'blue', beginner: false, handicap: 0, first: false},
      ],
      tournamentExpansion: true,
      undoOption: true,
      customCorporationsList: ['Teractor'],
    });

    const wrapper = shallowMount(CreateGameForm, {...globalConfig});
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    const vm = wrapper.vm as any;
    expect(vm.expansions.tournament).eq(true);
    expectTournamentLocks(vm);
  });

  it('applies tournament locks after Reset', async () => {
    const wrapper = shallowMount(CreateGameForm, {...globalConfig});
    await wrapper.vm.$nextTick();
    const vm = wrapper.vm as any;
    seedLockedFields(vm);

    vm.resetSettings();
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    expectTournamentLocks(vm);
  });
```

- [ ] **Step 2: Run them and confirm they fail.**

```bash
source ~/.nvm/nvm.sh && nvm use >/dev/null && npx vitest run tests/client/components/create/CreateGameForm.spec.ts
```

Expected: every new test fails except
`re-enables the undo control when tournament is switched off`, which fails
on its first assertion (undo isn't disabled yet). On first load,
`playerPasswords` is false. The pre-existing tests still pass.

If the legacy-flat-key test fails only because `expansions.tournament` stays
false after restore, `JSONProcessor`'s handling of a missing `expansions` key
differs from what this plan assumes. Report it as `DONE_WITH_CONCERNS` with
the observed value. Don't change `JSONProcessor`.

- [ ] **Step 3: Extract the lock method.** In the component's `methods`,
  add `applyTournamentLocks()`. Move the **entire** current body of the
  `if (value === true) { … }` block from the `'expansions.tournament'`
  watcher (lines 676-703, `this.allOfficialExpansions = false;` through the
  board check) into it unchanged. Then append:

```typescript
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

Replace the watcher with an immediate one that calls the method:

```typescript
    'expansions.tournament': {
      handler(value: boolean) {
        if (value === true) {
          this.applyTournamentLocks();
        }
      },
      immediate: true,
    },
```

- [ ] **Step 4: Hook the restore and reset paths.**
  - In `applySettings` (line 889), inside the existing `nextTick(() => { try { … } finally { … } })`
    callback, add this as the **last** statement of the `try` block, after
    `component.solarPhaseOption = Boolean(processor.solarPhaseOption);`:

```typescript
          if (component.expansions.tournament) {
            this.applyTournamentLocks();
          }
```

  - In `resetSettings` (line 926), add the same three lines as the last
    statement inside its `nextTick(() => { … })` callback.

- [ ] **Step 5: Disable the controls.** Add `:disabled="expansions.tournament"`
  to each of these existing tags. Only the attribute changes:
  - line 238 `<input type="checkbox" v-model="undoOption" id="undo-checkbox">`
  - line 303 `<input type="checkbox" v-model="showCorporationList" id="customCorps-checkbox">`
  - line 325 `<input type="checkbox" v-model="showBannedCards" id="bannedCards-checkbox">`
  - line 330 `<input type="checkbox" v-model="showIncludedCards" id="includedCards-checkbox">`
  - line 437 `<input type="checkbox" name="showOtherPlayersVP" v-model="showOtherPlayersVP" id="realTimeVP-checkbox">`
  - line 442 `<input type="checkbox" v-model="fastModeOption" id="fastMode-checkbox">`
  - line 447 `<input type="checkbox" name="playerPasswords" v-model="playerPasswords" id="playerPasswords-checkbox">`
  - line 483, the per-player `player-handicap` number input (inside the
    player `v-for`)

Leave `customPreludes-checkbox`, `customCeos-checkbox` and
`customColonies-checkbox` alone. Their `v-if="expansions.prelude|ceo|colonies"`
templates hide them in tournament games.

- [ ] **Step 6: Run the tests and confirm they pass.** Run the Step 2
  command. Expected: all tests pass, new and pre-existing. Then run
  `npm run lint:client` (vue-tsc). It must report no errors.

- [ ] **Step 7: Commit.**

```bash
git add src/client/components/create/CreateGameForm.vue tests/client/components/create/CreateGameForm.spec.ts
git commit -m "Lock tournament options in the create game form"
```

---

### Task 3: Full verification (controller)

- [ ] `source ~/.nvm/nvm.sh && nvm use >/dev/null && npm run lint`, expect
  PASS. Its last stage is `build:test`.
- [ ] `npm run build`, expect PASS.
- [ ] `npm run test`, expect PASS for both server (mocha) and client
  (vitest). If anything outside the four test files touched by Tasks 1-2
  fails, stop and investigate before delivery.
- [ ] Record the tail of each command's output in the ledger.

---

### Task 4: Delivery (controller, needs explicit user approval)

The VPS cron resets the deployed checkout to `origin/$GIT_BRANCH` every
minute. So delivering means merging into `tournament` and pushing.

- [ ] **Confirm the target.** Over ssh, read `GIT_BRANCH` for the tournament
  instance (read-only; see memory `vps-access`). Expect `tournament`.
- [ ] **Ask the user.** Request approval to merge and push, and confirm no
  tournament round is in progress.
- [ ] **On approval,** fast-forward `tournament` to `tournament-lockdown`
  (`git push origin tournament-lockdown:tournament`). Never force-push. If
  `origin/tournament` has moved since `ec52b8f39`, stop and ask instead of
  rebasing.
- [ ] **Verify live.** About a minute later, on the tournament site's create
  form, all eight controls should be disabled, with player passwords ticked.
  A created tournament game should show no Undo option.
