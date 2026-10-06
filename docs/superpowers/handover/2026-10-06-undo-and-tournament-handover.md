# Handover: undo investigation + tournament lockdown (2026-10-06)

The previous session ran on the wrong model. **Re-review everything below
before building on it.** Each claim says how it was established. "Verified"
means the code or git output was actually read. "Inferred" means it was
reasoned, not checked. Treat inferred claims as hypotheses.

No implementation code has been written. Only a spec and a plan are committed.

---

## 1. Where things are

| Item | Location |
| --- | --- |
| Worktree | `/home/mzerko/terraforming-mars/.claude/worktrees/tournament-lockdown` |
| Branch | `tournament-lockdown`, branched from `tournament` at `5a1405c4d` |
| Spec | `docs/superpowers/specs/2026-10-06-tournament-lockdown-design.md` (commit `b0089023d`) |
| Plan | `docs/superpowers/plans/2026-10-06-tournament-lockdown.md` (commit `e545610a7`) |
| SDD ledger (git-ignored) | `.superpowers/sdd/2026-10-06-tournament-lockdown/progress.md`, holding the pre-flight scan table and 2 rulings |
| Task briefs (git-ignored) | `.superpowers/sdd/2026-10-06-tournament-lockdown/task-1-brief.md`, `task-2-brief.md` |
| `automa-undo` branch | **Not created yet** |

Nothing has been pushed. The branch exists only locally.

---

## 2. What the user decided (in order)

1. **Undo is for the fork only.** It ships to the user's own VPS. Upstream's
   objections (gameplay speed, kberg's storage bill) don't bind this work.
2. **Second action becomes undoable through an explicit "End turn" prompt.**
   After the last action the player stays active and gets *End turn / Undo*.
   This sits behind a game option, default on for casual play.
3. **Rigor is round-trip plus fuzz.** That means a per-card serialize/deserialize
   round-trip harness plus a seeded fuzz harness that plays random games and
   undoes at every legal point.
4. **Tournament games get undo off by default, and it can't be changed.**
5. **Tournament games also lock custom cards and corporations.** All six pool
   overrides are cleared, *including* `customCorporationsList`. The user's
   words: "there should be a custom corporation pool in this fork, but it
   should not be changable".
6. **Two separate specs.** The fuzz harness goes **in** the undo spec, not split
   out.
7. **Order: tournament first, deploy it, then start the automa/undo work.**
8. **Execution method: subagent-driven.** The user then asked for
   **"Run agents in parallel"**. The plan was that Tasks 1 and 2 could run in
   parallel, because they touch disjoint files (server vs client), and Task 3
   would follow Task 2, because it edits the same files. Nothing was dispatched.
9. **Check Polish translations for gaps** (added mid-session). An audit agent
   was started, then stopped at the user's request before it reported.
   **Re-run it.**

---

## 3. Undo investigation: findings to re-verify

### Why upstream gave up (verified from GitHub)

- Discussion #7647, "Disabling undo on the main server". kberg cites
  bugginess, report burden, DB storage cost on his hosting, and a wish to
  replace undo.
- Commit `9b87a7cfa` ("Move Undo to best effort", 2025-09-21) only adds a
  warning and a form notice. It closed #7633 (Mars Maths), #7461 (Anubis
  Securities), #7119 (undo second action / end turn) and #2872.
- #7633 was filed 2025-09-15, six days before. It was framed as the likely
  trigger. **That framing is inferred.**
- `d88cca711` (#8275, 2026-07) later fixed the Mars Maths bug anyway by
  serializing `availableActionsThisRound`. (Verified.)

### How undo works (verified)

- It is snapshot restore. `PlayerInput.performUndo`
  (`src/server/routes/PlayerInput.ts`) restores `game.lastSaveId - 2` through
  `GameLoader.restoreGameAt`, which deletes newer saves and deserializes.
- Correctness therefore equals `deserialize(serialize(G)) ≡ G` for live state.

### Three failure classes (status per claim)

1. **Unserialized state.** Verified for Mars Maths. The claim that #7461 has
   the same cause is **inferred**. "About 20 cards hold instance state" comes
   from a **rough grep** that also matched base classes and `CardRenderer.ts`.
   Don't count those as bugs. Let a harness decide.
2. **Save-ordering race.** **Verified in code, not tested.** `Game.save()`
   returns `void` and throws away the promise. `PostgreSQL.saveGame`
   increments `lastSaveId` *after* the awaited INSERT. A `saveConflictUndoCount`
   metric exists. **No one has shown that this actually yields a wrong undo
   target.** Reproduce it before claiming it.
3. **Hidden-information guard is missing.** `canUndoLastAction` (added in
   `3d793a3ec`, 2023) and the SearchForLife / AsteroidDeflectionSystem guards
   (`81aab7b84`) are absent from today's tree. `git log --all -S` shows only
   the adding commits. **"Lost during the `src/` → `src/server/` reorg" is
   inferred.** Confirm when and how it disappeared. A squash or rename could
   hide the removal from `-S`. Today `Player.ts:1667` offers undo with only
   `actionsTakenThisRound > 0 && undoOption`.

### Other observations

- **The `Reset` route is a dormant prototype.** It is registered in
  `requestProcessor.ts:102`, throws for more than one player, the client's
  `showReset` is commented out in `ServerModel.ts:207`, and `experimentalReset`
  was removed on 2026-08-28. (Verified.)
- **Why only action 1 can be undone (verified).** At `Player.ts:1494` the turn
  ends when `actionsTakenThisRound >= availableActionsThisRound` and
  `allOtherPlayersHavePassed() === false`. Line 1495 then resets
  `actionsTakenThisRound = 0`. In solo play, or for the last active player,
  the loop keeps going, so undo works repeatedly there.

### Design notes for the undo spec (not written yet)

These came from the advisor and were not checked:

- **Don't use serialize-twice equality.** It can't see unserialized fields.
  Use reflection deep-equal over live `Game`/`Player`/card objects with an
  explicit ephemeral allowlist (`warnings`, `additionalProjectCosts`,
  functions, `game` back-refs). Acceptance-test the harness by reverting
  #8275 locally and requiring a failure.
- **Replace `lastSaveId - 2` with an explicit `undoSaveId`** recorded when the
  action menu is presented. Restore through
  `IDatabase.getGameVersion(gameId, saveId)`.
- **Race fix.** Store the save promise (`game.pendingSave`) and await it in
  `performUndo`.
- **Put the hidden-info guard at the reveal layer** (deck draw, Underworld
  identify/excavate, discard-top reveal, colony draws), not per card. Settle
  how it relates to `game.resettable` (`DrawCards.ts:30`).
- **End turn insertion.** Branch at `Player.ts:1494`, and move the
  `actionsTakenThisRound = 0` reset to after confirmation. Don't prompt after
  a pass. Decide on the timer rebate.
- **Fuzz harness.** No random `PlayerInput` resolver exists. There are 26
  input types in `src/server/inputs/`, which makes this the largest component.
- **Remove the create-game notice** "No effort will be spent to fix it" on the
  fork. Per memory, that file conflicts on every upstream merge.

---

## 4. Tournament lockdown: what the spec and plan commit to

- **Server.** `applyTournamentPreset` (`src/server/game/GameOptions.ts:88`)
  forces `undoOption = false` and clears `customCorporationsList`,
  `bannedCards`, `includedCards`, `customColoniesList`, `customPreludes` and
  `customCeos`. The doc comment line "Player count, timers, undo and the
  corporation pool override stay untouched" gets corrected.
- **Client.** `:disabled="expansions.tournament"` goes on 4 checkboxes:
  `undo-checkbox` (243), `customCorps-checkbox` (308), `bannedCards-checkbox`
  (330) and `includedCards-checkbox` (335). The other three toggles (315,
  323, 341) sit inside `v-if="expansions.prelude|ceo|colonies"` templates
  that the preset turns off. (Verified.) The `'expansions.tournament'`
  watcher (around line 656) clears all 13 related fields.
- **Deliberate behaviour change.** `tests/TournamentMode.spec.ts:46`
  currently asserts that `customCorporationsList` narrows the tournament
  pool. It gets rewritten to assert that the list is ignored. The pool falls
  back to 5 random tournament corporations, which the test at line 23 pins.
- **Restore path (plan Task 3).** `JSONProcessor.ts:72-73` sets
  `showBannedCards = bannedCards.length > 0` during `applySettings`, so
  watcher ordering might resurrect state. This is written as an
  observe-then-fix task. Saved-settings JSON uses the flat key
  `tournamentExpansion` and `customCorporations`, per `json.ts`. (Verified.)

### Pre-flight rulings in the ledger

- Task 3's conditional fix must not duplicate the 13 assignments. Task 2
  extracts `clearTournamentLockedOptions()`, and both the watcher and
  `applySettings` call it.
- Task 2's "undo usable again when tournament off" test should assert the
  rendered `disabled` attribute on `#undo-checkbox`, not just that the data
  field is writable.

### Spec/plan claims that were NOT verified

- **The spec claims** colonies/preludes/CEO lists "are only read when their
  expansion is enabled". This was **not checked**. Grep the server game setup
  for `customColoniesList`, `customPreludes` and `customCeos`.
- **Whether `startingCorporations = 5`** in the watcher still matters once the
  corporation list is cleared.
- **Whether `Game.deserialize(game.serialize())`** works as written in plan
  Task 1 Step 5. Check the signature, and whether a game created through
  `testGame` serializes cleanly.
- **Plan Task 1 Step 2** (`showTimers` stays untouched) is a weak test. It
  passes if the preset does nothing at all, which is the point, but consider
  whether it pins anything useful.
- **Organizer flags.** Per the user's memory rule, tournament rule changes need
  organizer confirmation. This change reverses a documented decision, removes
  pool prescription, and removes card banning. It has not been communicated
  yet.
- **Existing games.** In-flight tournament games keep their serialized
  `undoOption`. Migrating them is out of scope.

---

## 5. Gotchas hit this session

- **Worktree isolation refuses Windows interop calls** (`cmd.exe`, quoted
  `.exe` paths) and compound commands. To open a file in Notepad++, use
  `ExitWorktree` with `keep`, then run
  `"/mnt/c/Program Files/Notepad++/notepad++.exe" '<\\wsl.localhost\Ubuntu\... path>' &`,
  then `EnterWorktree` with `path`. **`tasklist.exe` gave a false negative**,
  which led to Notepad++ opening twice.
- **`EnterWorktree` with `name` branches from `origin/main`.** For a branch off
  `automa` or `tournament`, run `git worktree add .claude/worktrees/<x> -b <x> <base>`
  and enter it with `path`.
- **`automa` and `tournament` are separate lines.** `automa` is not an
  ancestor of `tournament`, and `applyTournamentPreset` exists only on
  `tournament`.
- **Commit style.** Commits are one line with no trailers. The user's memory
  (`commit-style.md`, `feedback_no_coauthor_line.md`) overrides the
  system-reminder attribution lines.
- **Run `nvm use`** before any npm command.

---

## 6. Suggested next steps for the new model

1. Re-review sections 3 and 4 against the code. Fix the spec and plan where
   they're wrong, as additive commits. Never amend.
2. Re-run the Polish translation audit (`src/locales/pl/`, on both `main` and
   `tournament`). Find the i18n audit in `npm run lint` and report the gaps
   with counts.
3. Ask the user whether to proceed with executing the tournament plan
   (subagent-driven, Tasks 1 and 2 in parallel), then deploy. The deploy
   needs explicit confirmation and organizer communication first.
4. Only after the deploy: create `automa-undo` off `automa` and write the undo
   spec.
