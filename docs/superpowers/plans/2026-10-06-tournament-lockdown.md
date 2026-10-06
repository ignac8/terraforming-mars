# Tournament Lockdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tournament games always run with undo off and the complete official card
and corporation pools, with no way to override either from the create-game form.

**Architecture:** Two enforcement points, as the codebase already does for roughly
twenty other tournament-locked options. `applyTournamentPreset` in
`src/server/game/GameOptions.ts` overwrites the options server-side and is the
only thing that actually enforces. `CreateGameForm.vue` disables the matching
controls and clears their backing state so the form never displays or posts a
value the server will discard.

**Tech Stack:** TypeScript, Vue 3 Options API, Mocha + Chai (server tests via
`tsx`, client tests via `mochapack` + `@vue/test-utils`).

**Spec:** `docs/superpowers/specs/2026-10-06-tournament-lockdown-design.md`

## Global Constraints

- Branch: `tournament-lockdown`, based on `tournament`. Do not merge or rebase
  onto `automa` or `main`.
- Node: run `nvm use` (or prepend the Node 24 path) before any `npm` command.
  The harness PATH may default to the wrong Node version and npm will fail.
- Commit style for this repo: terse one-line messages, no body, no trailers of
  any kind. No `Co-Authored-By`, no `Claude-Session`.
- Code style: `undefined` not `null`; `type` not `interface`; follow the style of
  the surrounding file.
- Before the final commit of the branch, all three of `npm run lint`,
  `npm run build` and `npm run test` must pass. `build` catches strict
  TypeScript errors that `lint` alone misses.
- Never amend a commit. Add a new commit instead.
- `applyTournamentPreset` is the single server-side enforcement point. Do not add
  a second one, and do not rely on the client for enforcement: the file's own doc
  comment states "the client is not trusted".

## Review Focus

These are the conditions the spec implies that no single task's happy path
exercises. Each one has a test assigned to the task that owns the code.

1. **Saved-settings restore with tournament already on.** `applySettings`
   (`CreateGameForm.vue:782`) applies a stored JSON through a `JSONProcessor`. If
   a saved config has `tournament: true` plus populated custom lists, watcher
   ordering decides whether the lists survive. A user restoring last game's
   settings would expect a tournament game with empty pools. Test in Task 2.
2. **Direct API creation bypassing the form entirely.** A POST to the create-game
   route with `tournamentExpansion: true` and all six arrays populated must come
   out with all six empty. The form is irrelevant here, which is the whole reason
   the server enforces. Test in Task 1.
3. **`customCorporationsList` holding only non-tournament corporations.** Today
   this yields a narrowed (possibly empty) pool. After the change it must be
   ignored outright and five tournament corporations dealt. Asserting the *count*
   is what catches a half-applied change. Test in Task 1.
4. **Toggling tournament off after switching it on.** The watcher only fires on
   `value === true`, so turning tournament off leaves undo disabled and the lists
   empty. That is acceptable and matches how every other locked option already
   behaves, but it must not leave a control disabled while tournament is off —
   that would strand the user. Test in Task 2.
5. **Deserializing a game created before this change with `undoOption: true`.**
   In-flight games carry their own serialized options and must keep working
   untouched; the lock applies to newly created games only. Test in Task 1.

---

### Task 1: Server-side lockdown in `applyTournamentPreset`

**Files:**
- Modify: `src/server/game/GameOptions.ts:80-145` (doc comment and preset body)
- Test: `tests/TournamentMode.spec.ts` (extend line 195 test, rewrite line 46 test)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `applyTournamentPreset(options: GameOptions): void` — unchanged
  signature. After this task it additionally sets `undoOption` to `false` and
  sets `customCorporationsList`, `bannedCards`, `includedCards`,
  `customColoniesList`, `customPreludes` and `customCeos` to `[]`.

- [ ] **Step 1: Extend the preset test with the new assertions**

In `tests/TournamentMode.spec.ts`, replace the existing test
`applyTournamentPreset forces the regulation options` (line 195) with this
version. It seeds every locked field with a non-default value so each assertion
can actually fail:

```typescript
  it('applyTournamentPreset forces the regulation options', () => {
    const options: GameOptions = {
      ...DEFAULT_GAME_OPTIONS,
      tournamentExpansion: true,
      venusNextExtension: true,
      preludeExtension: true,
      corporateEra: false,
      draftVariant: false,
      initialDraftVariant: false,
      solarPhaseOption: true,
      boardName: BoardName.AMAZONIS,
      undoOption: true,
      customCorporationsList: [CardName.TERACTOR_TOURNAMENT],
      bannedCards: [CardName.MINE],
      includedCards: [CardName.MINE],
      customColoniesList: [ColonyName.EUROPA],
      customPreludes: [CardName.MINE],
      customCeos: [CardName.MINE],
      expansions: {...DEFAULT_GAME_OPTIONS.expansions, venus: true, prelude: true, tournament: true},
    };

    applyTournamentPreset(options);

    expect(options.corporateEra).is.true;
    expect(options.venusNextExtension).is.false;
    expect(options.preludeExtension).is.false;
    expect(options.expansions.venus).is.false;
    expect(options.expansions.prelude).is.false;
    expect(options.expansions.corpera).is.true;
    expect(options.expansions.tournament).is.true;
    expect(options.draftVariant).is.true;
    expect(options.initialDraftVariant).is.true;
    expect(options.solarPhaseOption).is.false;
    expect(options.boardName).to.eq(BoardName.THARSIS);

    expect(options.undoOption).is.false;
    expect(options.customCorporationsList).is.empty;
    expect(options.bannedCards).is.empty;
    expect(options.includedCards).is.empty;
    expect(options.customColoniesList).is.empty;
    expect(options.customPreludes).is.empty;
    expect(options.customCeos).is.empty;
  });
```

Add the `ColonyName` import at the top of the file, next to the existing imports:

```typescript
import {ColonyName} from '../src/common/colonies/ColonyName';
```

- [ ] **Step 2: Add the boundary test for what stays settable**

Add this test immediately after the one from Step 1. It pins the claim the
corrected doc comment makes, so a future change that over-reaches gets caught:

```typescript
  it('applyTournamentPreset leaves player count and timers untouched', () => {
    const options: GameOptions = {
      ...DEFAULT_GAME_OPTIONS,
      tournamentExpansion: true,
      showTimers: false,
      expansions: {...DEFAULT_GAME_OPTIONS.expansions, tournament: true},
    };

    applyTournamentPreset(options);

    expect(options.showTimers).is.false;
  });
```

- [ ] **Step 3: Rewrite the corporation pool test to assert the new behaviour**

Replace the test `customCorporationsList becomes the pool, filtered to tournament
corporations` (line 46) with this. Same subject, inverted claim, and it asserts
the pool *count* so a half-applied change is caught (Review Focus 3):

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

- [ ] **Step 4: Add the non-tournament-only pool test**

Add this immediately after Step 3's test. Previously such a list would have
produced an empty or near-empty pool; now it must be ignored entirely:

```typescript
  it('A customCorporationsList of only non-tournament corporations is ignored', () => {
    const [/* game */, p1] = testGame(2, {
      tournamentExpansion: true,
      customCorporationsList: [CardName.PHOBOLOG, CardName.THORGATE],
    });

    expect(p1.dealtCorporationCards).has.length(5);
    for (const name of p1.dealtCorporationCards.map(toName)) {
      expect(name).to.match(/:tournament$/);
    }
  });
```

- [ ] **Step 5: Add the in-flight game test**

Add this after Step 4's test. It covers Review Focus 5 — a game created before
this change keeps the undo it was created with, because its options are
serialized with it and the preset only runs at creation:

```typescript
  it('A serialized tournament game keeps the undoOption it was created with', () => {
    const [game] = testGame(2, {tournamentExpansion: true});
    game.gameOptions.undoOption = true;

    const serialized = game.serialize();
    const deserialized = Game.deserialize(serialized);

    expect(deserialized.gameOptions.undoOption).is.true;
  });
```

- [ ] **Step 6: Run the tests to verify they fail**

```bash
nvm use
npx mocha --import=tsx --require tests/testing/setup.ts "tests/TournamentMode.spec.ts"
```

Expected: the Step 1 test FAILS on `expect(options.undoOption).is.false`, and the
Step 3 and Step 4 tests FAIL because the pool is still being narrowed by
`customCorporationsList`. The Step 2 and Step 5 tests should already PASS — they
pin behaviour that this change must not break.

- [ ] **Step 7: Correct the doc comment**

In `src/server/game/GameOptions.ts`, the comment above
`applyTournamentPreset` currently ends:

```typescript
 * Base + Corporate Era only, draft everywhere, an official board, and none
 * of the rule-changing variants. Player count, timers, undo and the
 * corporation pool override stay untouched.
 */
```

Replace those three lines with:

```typescript
 * Base + Corporate Era only, draft everywhere, an official board, undo off,
 * the complete official card and corporation pools, and none of the
 * rule-changing variants. Player count and timers stay untouched.
 */
```

- [ ] **Step 8: Write the implementation**

In the body of `applyTournamentPreset`, immediately after the existing
`options.twoCorpsVariant = false;` line and before the `const officialBoards`
line, insert:

```typescript
  options.undoOption = false;
  options.customCorporationsList = [];
  options.bannedCards = [];
  options.includedCards = [];
  options.customColoniesList = [];
  options.customPreludes = [];
  options.customCeos = [];
```

- [ ] **Step 9: Run the tests to verify they pass**

```bash
npx mocha --import=tsx --require tests/testing/setup.ts "tests/TournamentMode.spec.ts"
```

Expected: PASS, every test in the file including the untouched
`Deals one shared pool of 5 tournament corporations to every player` at line 23,
which is now the load-bearing test for pool behaviour.

- [ ] **Step 10: Commit**

```bash
git add src/server/game/GameOptions.ts tests/TournamentMode.spec.ts
git commit -m "Force undo off and clear custom pools in tournament games"
```

---

### Task 2: Client-side lockdown in the create-game form

**Files:**
- Modify: `src/client/components/create/CreateGameForm.vue` (four `input` tags; the `'expansions.tournament'` watcher at line 656)
- Test: `tests/client/components/create/CreateGameForm.spec.ts`

**Interfaces:**
- Consumes: `applyTournamentPreset` from Task 1 is what actually enforces; this
  task only keeps the form honest about it. No code dependency.
- Produces: no new exported symbols. The component's `'expansions.tournament'`
  watcher additionally sets `undoOption` to `false`, sets the six `show*` flags
  to `false`, and empties the six backing arrays.

- [ ] **Step 1: Write the failing tests**

Add these three tests inside the existing `describe('CreateGameForm', ...)` block
in `tests/client/components/create/CreateGameForm.spec.ts`. The first covers the
main behaviour, the second covers Review Focus 1, the third covers Review
Focus 4:

```typescript
  it('clears undo and custom pools when tournament is switched on', async () => {
    const wrapper = shallowMount(CreateGameForm, {
      ...globalConfig,
    });
    await wrapper.vm.$nextTick();

    const vm = wrapper.vm as any;
    vm.undoOption = true;
    vm.showCorporationList = true;
    vm.showBannedCards = true;
    vm.showIncludedCards = true;
    vm.customCorporations = ['Teractor'];
    vm.bannedCards = ['Mine'];
    vm.includedCards = ['Mine'];
    await wrapper.vm.$nextTick();

    vm.expansions.tournament = true;
    await wrapper.vm.$nextTick();

    expect(vm.undoOption).eq(false);
    expect(vm.showCorporationList).eq(false);
    expect(vm.showBannedCards).eq(false);
    expect(vm.showIncludedCards).eq(false);
    expect(vm.customCorporations).is.empty;
    expect(vm.bannedCards).is.empty;
    expect(vm.includedCards).is.empty;
  });

  it('clears the expansion-specific pools when tournament is switched on', async () => {
    const wrapper = shallowMount(CreateGameForm, {
      ...globalConfig,
    });
    await wrapper.vm.$nextTick();

    const vm = wrapper.vm as any;
    vm.expansions.prelude = true;
    vm.expansions.ceo = true;
    vm.expansions.colonies = true;
    vm.showPreludesList = true;
    vm.showCeosList = true;
    vm.showColoniesList = true;
    vm.customPreludes = ['Mine'];
    vm.customCeos = ['Mine'];
    vm.customColonies = ['Europa'];
    await wrapper.vm.$nextTick();

    vm.expansions.tournament = true;
    await wrapper.vm.$nextTick();

    expect(vm.showPreludesList).eq(false);
    expect(vm.showCeosList).eq(false);
    expect(vm.showColoniesList).eq(false);
    expect(vm.customPreludes).is.empty;
    expect(vm.customCeos).is.empty;
    expect(vm.customColonies).is.empty;
  });

  it('leaves the undo control usable again once tournament is switched off', async () => {
    const wrapper = shallowMount(CreateGameForm, {
      ...globalConfig,
    });
    await wrapper.vm.$nextTick();

    const vm = wrapper.vm as any;
    vm.expansions.tournament = true;
    await wrapper.vm.$nextTick();
    expect(vm.undoOption).eq(false);

    vm.expansions.tournament = false;
    await wrapper.vm.$nextTick();

    vm.undoOption = true;
    await wrapper.vm.$nextTick();
    expect(vm.undoOption).eq(true);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
nvm use
cross-env NODE_ENV=development mochapack --require tests/client/components/setup.ts "tests/client/components/create/CreateGameForm.spec.ts"
```

Expected: the first two tests FAIL (the watcher does not touch `undoOption`, the
`show*` flags or the arrays). The third test should already PASS.

- [ ] **Step 3: Extend the watcher**

In `src/client/components/create/CreateGameForm.vue`, inside the
`'expansions.tournament': function(value: boolean)` watcher (line 656), after the
existing `this.startingCorporations = 5;` line and before the
`if (!this.tournamentBoards.includes(this.board))` block, insert:

```typescript
        this.undoOption = false;
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

Clearing the arrays as well as the flags is required, not belt-and-braces: the
flags only control panel visibility, and `newGameConfig` (line 1258-1269) reads
the arrays directly, so a stale selection would still be posted.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cross-env NODE_ENV=development mochapack --require tests/client/components/setup.ts "tests/client/components/create/CreateGameForm.spec.ts"
```

Expected: PASS, all three new tests plus the pre-existing ones.

- [ ] **Step 5: Disable the four always-rendered controls**

In `src/client/components/create/CreateGameForm.vue`, add
`:disabled="expansions.tournament"` to these four `input` tags. Each line is
given in full, before and after.

Line 243, before:

```html
                            <input type="checkbox" v-model="undoOption" id="undo-checkbox">
```

after:

```html
                            <input type="checkbox" v-model="undoOption" id="undo-checkbox" :disabled="expansions.tournament">
```

Line 308, before:

```html
                            <input type="checkbox" v-model="showCorporationList" id="customCorps-checkbox">
```

after:

```html
                            <input type="checkbox" v-model="showCorporationList" id="customCorps-checkbox" :disabled="expansions.tournament">
```

Line 330, before:

```html
                            <input type="checkbox" v-model="showBannedCards" id="bannedCards-checkbox">
```

after:

```html
                            <input type="checkbox" v-model="showBannedCards" id="bannedCards-checkbox" :disabled="expansions.tournament">
```

Line 335, before:

```html
                            <input type="checkbox" v-model="showIncludedCards" id="includedCards-checkbox">
```

after:

```html
                            <input type="checkbox" v-model="showIncludedCards" id="includedCards-checkbox" :disabled="expansions.tournament">
```

Do **not** add `:disabled` to `customPreludes-checkbox` (line 315),
`customCeos-checkbox` (line 323) or `customColonies-checkbox` (line 341). Each is
wrapped in a `<template v-if="expansions.prelude">`, `v-if="expansions.ceo"` or
`v-if="expansions.colonies"` block, and the watcher sets all three expansions
false, so those controls are not rendered at all in a tournament game. Adding the
attribute would be dead markup.

- [ ] **Step 6: Verify the form type-checks**

```bash
npm run lint:client
```

Expected: PASS with no new errors. This runs `vue-tsc --noEmit`, which is what
catches a mistyped field name in the watcher.

- [ ] **Step 7: Commit**

```bash
git add src/client/components/create/CreateGameForm.vue tests/client/components/create/CreateGameForm.spec.ts
git commit -m "Lock undo and custom pool controls in tournament games"
```

---

### Task 3: Saved-settings restore path

**Files:**
- Test: `tests/client/components/create/CreateGameForm.spec.ts`
- Modify (only if the test fails): `src/client/components/create/CreateGameForm.vue:782-820` (`applySettings`)

**Interfaces:**
- Consumes: the watcher behaviour from Task 2.
- Produces: no new symbols. Guarantees that restoring a saved config with
  `tournament: true` yields empty pools and undo off.

This task is written as an investigation with a known-good outcome, because
whether a fix is needed depends on Vue's watcher ordering during
`applySettings`, which must be observed rather than assumed.

- [ ] **Step 1: Write the restore test**

Add this test to `tests/client/components/create/CreateGameForm.spec.ts`. It uses
the file's existing `createGameSettings` helper:

```typescript
  it('restoring a saved tournament config clears undo and custom pools', async () => {
    const settingsStorage = new CreateGameSettingsStorage(localStorage);
    settingsStorage.saveSettings(createGameSettings({
      tournamentExpansion: true,
      undoOption: true,
      customCorporations: ['Teractor'],
      bannedCards: ['Mine'],
      includedCards: ['Mine'],
    }));

    const wrapper = shallowMount(CreateGameForm, {
      ...globalConfig,
    });
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    const vm = wrapper.vm as any;
    expect(vm.undoOption).eq(false);
    expect(vm.customCorporations).is.empty;
    expect(vm.bannedCards).is.empty;
    expect(vm.includedCards).is.empty;
  });
```

The two `$nextTick()` calls are deliberate: the first lets `applySettings` run,
the second lets the `'expansions.tournament'` watcher it triggers settle.

The JSON key names here are not arbitrary and must not be "corrected" to match
the component's field names. `JSONProcessor` reads the constants in
`src/client/components/create/json.ts`: tournament arrives as the flat key
`tournamentExpansion` (mapped to `model.expansions.tournament` at
`JSONProcessor.ts:91-97`), and the corporation list arrives as
`customCorporations`, with `customCorporationsList` accepted as a legacy
fallback. Using `expansions: {tournament: true}` instead would not exercise the
restore path at all, and the test would pass without proving anything.

Note also `JSONProcessor.ts:72-73`, which sets
`this.model.showBannedCards = this.bannedCards.length > 0` during restore. That
is the specific mechanism by which a restore could resurrect a `show*` flag after
the watcher cleared it, and it is why this task exists as its own task rather
than an assumption folded into Task 2.

- [ ] **Step 2: Run the test and record which way it goes**

```bash
cross-env NODE_ENV=development mochapack --require tests/client/components/setup.ts "tests/client/components/create/CreateGameForm.spec.ts"
```

Two possible outcomes, and they lead to different next steps:

- **PASS** — the watcher fires after the processor assigns, so restore is already
  safe. Skip Step 3 and go to Step 4. The test stays as a regression guard.
- **FAIL** — the processor assigns the lists after the watcher clears them.
  Do Step 3.

- [ ] **Step 3: Only if Step 2 failed — clear the pools after applying settings**

In `applySettings` (line 782), after the processor has finished assigning and
before the method returns its `JSONProcessor`, add an explicit re-application so
the stored values cannot outlive the watcher:

```typescript
      if (this.expansions.tournament === true) {
        this.undoOption = false;
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
      }
```

Then re-run the command from Step 2 and confirm PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/client/components/create/CreateGameForm.spec.ts src/client/components/create/CreateGameForm.vue
git commit -m "Clear tournament-locked options when restoring saved settings"
```

If Step 3 was skipped, drop `src/client/components/create/CreateGameForm.vue`
from the `git add` and use the message
`"Test that restoring a tournament config clears locked options"`.

---

### Task 4: Full verification

**Files:** none modified. This task only runs the gate.

**Interfaces:**
- Consumes: all of Tasks 1-3.
- Produces: the evidence needed before deploying.

- [ ] **Step 1: Lint**

```bash
nvm use
npm run lint
```

Expected: PASS. This runs eslint, the i18n audit and `vue-tsc`. No new user-facing
strings were added by this branch, so the i18n audit must not report new misses.

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: PASS. This is the step that catches strict TypeScript errors lint
misses, which is why it is not optional.

- [ ] **Step 3: Full test suite**

```bash
npm run test
```

Expected: PASS, server and client. Roughly 6700 server tests, so expect this to
take a while. If anything outside `TournamentMode.spec.ts` or
`CreateGameForm.spec.ts` fails, stop: it means the preset change reached further
than intended, and the failure must be understood before deploying.

- [ ] **Step 4: Report the evidence**

Paste the actual tail of each of the three commands. Do not summarise them as
"all green" without the output — the standing rule on this project is evidence
before assertions.

---

### Task 5: Deploy to the tournament site

**Files:** none in this repo. Deployment is driven from
`ignac8/terraforming-mars-deploy` on the Hetzner VPS.

**Interfaces:**
- Consumes: a green Task 4.
- Produces: the lockdown live on the tournament subdomain.

- [ ] **Step 1: Confirm before touching production**

Deployment is outward-facing and affects live games. Confirm with the user
immediately before deploying, even though the work was authorised in advance.
Specifically confirm:

- No tournament round is currently in progress.
- The organisers have been told the three things the spec flags: this reverses a
  documented decision, prescribing a corporation pool is no longer possible, and
  banning cards by convention is no longer possible.

- [ ] **Step 2: Push the branch**

```bash
git push -u origin tournament-lockdown
```

Never push to `main` or `master`, never force-push, never merge.

- [ ] **Step 3: Deploy**

Follow the existing deploy procedure in `ignac8/terraforming-mars-deploy`. Do not
invent a new one. If the procedure is unclear, stop and ask rather than
improvising against a live server.

- [ ] **Step 4: Verify on the live site**

Open the create-game form on the tournament subdomain and confirm, with
tournament rules selected:

- The "Allow undo" checkbox is disabled and unchecked.
- "Custom Corporation list", "Exclude some cards" and "Include some cards" are
  disabled and unchecked.
- Creating a tournament game succeeds and the game has no undo option available.

- [ ] **Step 5: Note what was not changed**

Games already in progress keep the `undoOption` they were created with, because
each game carries its own serialized `GameOptions`. If existing tournament games
must also lose undo, that is a separate data migration and is out of scope here.
Say so explicitly in the deploy report rather than leaving it implied.
