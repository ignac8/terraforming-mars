# Plan: Fix kberg PR #8001 review — MarsBotCorpTypes refactor

## Context

kberg reviewed PR #8001 and requested changes. His overall comment: "This one is going to need a lot of work... It seems to exemplify the bad code an AI agent might put together without supervision. Its style is vastly different from what we already use."

Three specific comments, but the fixes ripple across the entire automa codebase.

## Comment 1: "What is a corp id? How is it different from CardName?"

**Problem:** `MarsBotCorpId` is a branded string type (`string & { readonly __brand: 'MarsBotCorpId' }`) with custom values like `'C01_CREDICOR'`. But every MarsBot corp already has `name: CardName.CREDICOR`. The `id` and `name` fields are redundant — both identify the same corporation.

**Fix:** Remove `MarsBotCorpId` entirely. Remove the `id` field from `IMarsBotCorp`. Use `name: CardName` as the unique identifier.

**Files affected:**
- `src/common/automa/MarsBotCorpTypes.ts` — remove MarsBotCorpId type, remove `id` from IMarsBotCorp, type `name` as CardName
- `src/server/automa/corps/MarsBotCorpRegistry.ts` — key on `CardName` via `corp.name`
- `src/server/automa/corps/BaseGameCorps.ts` — remove `id:` from all 12 corp definitions
- `src/server/automa/corps/ExpansionCorps.ts` — remove `id:` from all 34 corp definitions
- `src/server/automa/MarsBot.ts` — serialize `corp.name` instead of `corp.id`, restore by name
- `src/server/SerializedGame.ts` — rename `corpId` to `corpName` (or keep corpId typed as CardName)
- All test files referencing MarsBotCorpId or corp IDs

## Comment 2: "This is not common code"

**Problem:** `MarsBotCorpEffect`, `MarsBotCorpContext`, `MarsBotCorpPerGen`, `MarsBotCorpCardRef`, `toCorpCardRef()`, `IMarsBotCorp`, `MarsBotDraftPriority`, `MarsBotTrackCube`, `trackCubeKey()` are all in `src/common/automa/MarsBotCorpTypes.ts` but only used by server code. Zero client imports.

Only `CubeType` is needed by client code (via MarsBotModel.ts).

**Fix:** Move server-only types to a server-side file. Keep only CubeType in common.

**New structure:**
- `src/common/automa/AutomaTypes.ts` — add `CubeType` here (alongside other shared types)
- Delete `src/common/automa/MarsBotCorpTypes.ts` entirely
- Create `src/server/automa/MarsBotCorpTypes.ts` — all corp interfaces, types, utilities
- Update `src/common/models/MarsBotModel.ts` — import CubeType from AutomaTypes
- Update all server imports to use new path

## Comment 3: "This matches what's in MarsBotModel — eliminate duplication"

**Problem:** CubeType defined inline in MarsBotModel.ts AND exported from MarsBotCorpTypes.ts.

**Fix:** Define CubeType once in AutomaTypes.ts (shared), import everywhere. This is resolved by the Comment 2 fix above.

## Implementation order

1. Move CubeType to AutomaTypes.ts
2. Move all other types from common/MarsBotCorpTypes.ts to server/MarsBotCorpTypes.ts
3. Delete common/MarsBotCorpTypes.ts
4. Remove MarsBotCorpId — drop `id` from IMarsBotCorp, use `name: CardName` as key
5. Remove `id:` lines from all 46 corp definitions
6. Update registry, serialization, and all references
7. Update all imports across server + tests
8. Lint + test

## Files to modify

### Common (shared)
- `src/common/automa/AutomaTypes.ts` — add CubeType
- `src/common/models/MarsBotModel.ts` — import CubeType from AutomaTypes
- **Delete** `src/common/automa/MarsBotCorpTypes.ts`

### Server
- **New** `src/server/automa/MarsBotCorpTypes.ts` — all corp types moved here, minus MarsBotCorpId/id field
- `src/server/automa/MarsBot.ts` — update imports, serialize corp.name not corp.id
- `src/server/automa/MarsBotTurnResolver.ts` — update import path
- `src/server/automa/AutomaGameHooks.ts` — update import path
- `src/server/automa/AutomaGameSetup.ts` — update import path if needed
- `src/server/automa/corps/MarsBotCorpRegistry.ts` — key on CardName, update import
- `src/server/automa/corps/MarsBotCorpResolver.ts` — update import
- `src/server/automa/corps/MarsBotDraftResolver.ts` — update import
- `src/server/automa/corps/BaseGameCorps.ts` — remove id lines, update import
- `src/server/automa/corps/ExpansionCorps.ts` — remove id lines, update import
- `src/server/SerializedGame.ts` — corpId type

### Tests
- All test files importing from common/automa/MarsBotCorpTypes → update to server path
- Remove MarsBotCorpId references

## PR branch mapping
- AutomaTypes.ts, MarsBotModel.ts → PR1
- MarsBotCorpTypes.ts (new server location), MarsBot.ts, SerializedGame.ts, stubs → PR2
- MarsBotTurnResolver.ts → PR3
- BonusResolver.ts → PR4
- MarsBotScoring.ts → PR5
- AutomaGameHooks.ts, AutomaGameSetup.ts, corps stubs → PR6
- Corp framework files → PR7
- ExpansionCorps → PR8
- Tests → PR9-12
- Client → PR13

## Architectural assessment: ICard and IPlayer

### MarsBot as IPlayer subtype — NOT RECOMMENDED

IPlayer has 135+ methods including interactive UI methods (`getWaitingFor`, `setWaitingFor`, `process`), card management (7 arrays), payment logic, colonies/turmoil data. MarsBot would need to implement or delegate ALL of them. Player.ts is 1923 lines.

**Current design IS already an IPlayer integration:** MarsBot owns a real `Player` instance and overrides behavior via `MarsBotStock` (Object.defineProperty on resource fields) and `MarsBotTags` (override rawCount). This composition pattern is cleaner than inheritance — it separates AI logic from game state.

### Bonus cards as ICard — PARTIALLY POSSIBLE but poor semantic fit

ICard's `play(player: IPlayer): PlayerInput | undefined` method expects interactive card play. Bonus cards are one-shot effects resolved by the AI. The Behavior system could express simple effects (temperature raise, resource gain) but complex conditional logic (Lobbyists with 4 fallback conditions, Corporate Competition multi-step) would need `bespokePlay()` overrides.

**Key insight:** Bonus cards are NOT reimplementations of existing game cards. They're unique automa mechanics from the physical expansion rulebook:
- Meteor Shower removes plants from the human and self-destructs (NOT like the real Asteroid card)
- Invasive Species removes animal/microbe resources from human's cards (custom automa logic)
- Each bonus card has its own completely custom effect for solo play

The bonus cards already use game engine methods where appropriate (`game.increaseTemperature`, `humanPlayer.stock.deduct`, `game.addCity`). The "duplication" concern doesn't really apply — these are fundamentally different effects from existing cards. Making them ICard would force them into a card resolution pipeline (payment, requirements, behavior executor) that doesn't match their nature as one-shot deck effects.

### Response to kberg

Draft points:
- MarsBot already uses composition with a real Player instance (correct pattern, not inheritance)
- Stock and Tags overrides make the Player behave correctly for automa without subclassing
- Bonus cards are unique automa effects from the physical rulebook — they share names with real cards for flavor but have completely different effects designed for solo play
- ICard's play() semantics (interactive, payment, requirements) don't match bonus card resolution (one-shot AI effects from a separate deck)
- Open to suggestions for further integration if specific areas are identified
