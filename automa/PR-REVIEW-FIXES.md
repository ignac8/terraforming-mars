# PR #7994 Review Fixes - kberg's Feedback

22 inline comments from kberg (upstream maintainer). These need to be applied across the entire automa codebase, not just PR1.

## AutomaTypes.ts

### 1. Prefer undefined to null (line 17)
- Change `TrackLayout = ReadonlyArray<TrackAction | null>` to `TrackAction | undefined`
- Update all layout arrays in TharsisMarsBot.ts: `null` -> `undefined`
- Update MarsBotBoard.ts advance() return type and checks
- **Cascade**: TharsisMarsBot.ts, MarsBotBoard.ts, MarsBotTurnResolver.ts, MarsBotModel.ts, MarsBotPanel.vue, MarsBotMilestoneAwardEval.ts

### 2. Type productions to Resource (line 23)
- Change `productions: ReadonlyArray<string>` to `ReadonlyArray<Resource>`
- **Cascade**: AutomaTypes.ts, TharsisMarsBot.ts, MarsBotStock.ts

### 3. Type award/milestone record keys (line 30)
- Use `Partial<Record<AwardName, string>>` and `Partial<Record<MilestoneName, string>>`
- **Cascade**: AutomaTypes.ts, TharsisMarsBot.ts

### 4. Prelude2 without prelude (line 100)
- Fix `isAutomaPreludeGame`: prelude2 alone doesn't have a prelude phase
- Change to `return preludeExtension` (prelude2 always requires prelude1)

### 5. Move getMcPerVP to server (line 126)
- Move `getMcPerVP`, `buildMcToVpTable`, `MC_TO_VP_TABLE`, `MC_TO_VP_TABLE_PRELUDE` to server-side
- **Cascade**: MarsBot.ts, MarsBotScoring.ts imports

## MarsBotModel.ts

### 6. Move to common/models (line 7)
- Move `src/common/automa/MarsBotModel.ts` to `src/common/models/MarsBotModel.ts`
- **Cascade**: MarsBot.ts, AutomaGameHooks.ts, ServerModel.ts, MarsBotPanel.vue, GameEnd.vue, PlayerHome.vue

### 7. Tag type for tagNames (line 9)
- Change `tagNames: ReadonlyArray<string>` to `ReadonlyArray<Tag>`
- Update MarsBot.toModel() to not cast

### 8. Clarify maxPosition (line 11)
- Remove or rename - it's always 18 (MARSBOT_MAX_TRACK_POSITION)

### 9. type not interface (line 7)
- Change all `interface` to `type` for data shapes (MarsBotTrackModel, MarsBotVPModel, MarsBotModel)

### 10. Remove obvious comment, make vpBreakdown required (line 37)
- Remove comment, remove `?` since it's always populated

### 11-12. Corporation ID/name (lines 41-42)
- Remove corpId, keep only corpName typed as CardName

## TharsisMarsBot.ts

### 13. Better typed board data (line 64)
- Type award/milestone keys properly (see #3)

### 14. Remove num from TrackDefinition (line 5)
- It's just array index + 1, derivable
- **Cascade**: All code referencing track.definition.num

## MarsBotBoard.ts

### 15. Clearer advance() return type (line 24)
- Return discriminated union or separate maxed case from no-action case

### 16. Remove redundant ?? null (lines 32, 46)
- After undefined switch, these are unnecessary

### 17. Remove 1-based getTrack(), use 0-based indexing (line 71)
- **BIGGEST CHANGE** - cascades to:
  - MarsBotTurnResolver.ts (all getTrack(N) calls)
  - MarsBotScoring.ts
  - MarsBotBonusResolver.ts (CC helpers)
  - MarsBotMilestoneAwardEval.ts (trackPos function)
  - BaseGameCorps.ts (trackCube positions)
  - ExpansionCorps.ts (trackCube positions)
  - MarsBotCorpResolver.ts (onTrackAdvanced)
  - AutomaGameSetup.ts (placeColonyCubes)
  - MarsBotPanel.vue (track display)
  - ALL test files

### 18. Clarify "topmost/lowest" comment (line 80)
- Rename to "first index if tied" or "lowest index if tied"

### 19. Rename peekNextAction to peek (line 44)

## Tests

### 20. Curly braces on for loops (line 86)
- Add `{}` to all single-line for loops

### 21. Add regression test for advance (line 93)
- Test: advance returns action, regress, re-advance returns undefined (skipped)

### 22. Test peek after regression (line 109)
- Document and test peek behavior after track regression

## Execution Order
1. Apply all changes on automa branch first
2. For PR1 (open PR): add new commits, no force push
3. For PR2-13 (no open PRs): can rebase on updated PR1
