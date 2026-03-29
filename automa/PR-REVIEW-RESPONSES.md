# PR #7994 Review Responses to kberg

**1. AutomaTypes.ts:17 — "Prefer undefined to null"**
> Fixed, switched to undefined throughout.

**2. AutomaTypes.ts:23 — "If this is a resource this can be typed to Resource"**
> Good call, changed to `ReadonlyArray<Resource>`.

**3. AutomaTypes.ts:30 — "What are the keys and values? I bet they can be typed"**
> Typed as `Partial<Record<AwardName, string>>` and `Partial<Record<MilestoneName, string>>`. The values are human-readable descriptions of how MarsBot evaluates each award/milestone.

**4. AutomaTypes.ts:100 — "Prelude2 without prelude does not have a prelude phase"**
> Right, simplified to just check `preludeExtension`. Prelude 2 always requires prelude to be enabled.

**5. AutomaTypes.ts:126 — "Unless this is called on the client side, move this out of here"**
> Moved to `MarsBotScoring.ts` on the server side. It's only called from `MarsBot.toModel()`.

**6. MarsBotModel.ts:7 — "This goes on common/models"**
> Moved to `src/common/models/MarsBotModel.ts`.

**7. MarsBotModel.ts:9 — "s/string/Tag?"**
> Changed to `ReadonlyArray<Tag>`.

**8. MarsBotModel.ts:11 — "What is maxPosition?"**
> Removed it. It was always the constant 18 - the client can use that directly.

**9. MarsBotModel.ts:7 — "interface for class, type otherwise"**
> Changed all model types to `type`. Kept `interface` only for things that are implemented (like `IMarsBotCorp`, `MarsBotCorpEffect`, `MarsBotCorpContext`).

**10. MarsBotModel.ts:37 — "Unnecessary comment. Why optional if always populated?"**
> Removed the comment and made `vpBreakdown` required.

**11. MarsBotModel.ts:41 — "What's a Corporation ID?"**
> Removed it. It was a separate internal ID for the automa corp system, but the name is sufficient as a unique identifier.

**12. MarsBotModel.ts:42 — "ID and name should be typed. Why both?"**
> Removed the ID, kept only `corpName` typed as `CardName`.

**13. TharsisMarsBot.ts:64 — "Better typed"**
> Typed with `AwardName` and `MilestoneName` keys.

**14. TharsisMarsBot.ts:5 — "What's the point of num?"**
> Removed. It was just the array index. Track names in logs now come from the first tag (e.g. "Building track to 5").

**15. MarsBotBoard.ts:24 — "How is caller supposed to know to trigger failed action?"**
> Changed `advance()` to return a discriminated union: `{type: 'action', action} | {type: 'none'} | {type: 'maxed'}`. Caller can match on `type` to decide what to do.

**16. MarsBotBoard.ts:32,46 — "Why is ?? null necessary?"**
> Removed. With undefined instead of null, the values are already the right type.

**17. MarsBotBoard.ts:71 — "Don't do that. Just use the zero index."**
> Removed `getTrack()`. Everything uses 0-based `tracks[index]` now. Track display names in the UI come from the first tag.

**18. MarsBotBoard.ts:80 — "What does topmost/lowest mean?"**
> Clarified to "first index if tied".

**19. MarsBotBoard.ts:44 — "Can be shortened to peek"**
> Renamed to `peek()`.

**20. MarsBotBoard.spec.ts:86 — "Be more liberal with curly braces"**
> Added curly braces to all for loops across all test files.

**21. MarsBotBoard.spec.ts:93 — "Add a test for advance/regress"**
> Added: "advance returns action, regress and re-advance skips it".

**22. MarsBotBoard.spec.ts:109 — "What is peek behavior after regression?"**
> Added test: "peek after regression still shows the layout action". Peek returns the raw layout value regardless of regression markers - it doesn't check if the position was regressed from.

**23. MarsBotBoard.ts:44 — "Minor: can be shortened to peek"**
> Done (same as #19).
