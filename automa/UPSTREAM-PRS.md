# Upstream PR tracker

State of the one-file-at-a-time PR series against `terraforming-mars/terraforming-mars`,
agreed after #8001 was deemed too big to review. Last updated: 2026-08-03.

## Merged

| PR | Contents |
|----|----------|
| [#7994](https://github.com/terraforming-mars/terraforming-mars/pull/7994) | Foundation: `AutomaTypes`, `MarsBotTracks` (was `MarsBotBoard`), `TharsisMarsBot`, `MarsBotModel`, `MarsBotMADescriptions`, board spec |
| [#8203](https://github.com/terraforming-mars/terraforming-mars/pull/8203) | `MarsBotBonusCard.ts` — bonus card type + base set (squash-merged 2026-07-20) |
| [#8204](https://github.com/terraforming-mars/terraforming-mars/pull/8204) | `MarsBotTags.ts` + spec |
| [#8205](https://github.com/terraforming-mars/terraforming-mars/pull/8205) | Venus track layout, `AutomaTypes` floater/floater2 + `tag_${string}` actions |
| [#8206](https://github.com/terraforming-mars/terraforming-mars/pull/8206) | `MarsBotBonusDeck.ts` extending `Deck<MarsBotBonusCard>` + spec, kberg's `b5c7df0cf` (`AUTOMA_*` CardNames, `Deck<Named<CardName>>`) riding along (squash-merged 2026-07-28 as `27bd8b963`). His approval note: many of the deck tests duplicate `Deck.spec.ts` now — #8342 trims them. Automa divergence stays: id-based serde in `MarsBot.ts` (no save migration), expansion deck factories, `findAndRemove`/`removeById`, `bonusCardDisplayName()` (now a `split(':')[0]`) |
| [#8207](https://github.com/terraforming-mars/terraforming-mars/pull/8207) | `MarsBotCorpTypes.ts` + `CubeType` in `AutomaTypes` (squash-merged 2026-07-31 as `8d8e335d8`). Approved with questions still open, answered and fixed in #8353 |
| [#8342](https://github.com/terraforming-mars/terraforming-mars/pull/8342) | Trims the 3 bonus deck tests that duplicate `Deck.spec.ts` (merged 2026-07-28 as `740d79ef6`). Automa keeps its adapted 4-test spec (id-based deserialize, no name round trip) |
| [#8208](https://github.com/terraforming-mars/terraforming-mars/pull/8208) | `MarsBotTilePlacer.ts` + spec (squash-merged 2026-08-03 as `b9ddb4063`). Three review rounds: `Board.ownedBy` filters, `drawOrThrow`, duplicated adjacency scorer collapsed; spec rewritten so no test can pass without asserting, then flattened to one `describe` with `cast(x, undefined)` and 17 tests naming the spaces they expect. `findExpediteConstructionCitySpace` renamed after the Expedited Construction card. Pushed back successfully on `maxOutOceans`: it stops at the 9-ocean cap, leaving 3 of Tharsis's 12 reserved spaces free |
| [#8209](https://github.com/terraforming-mars/terraforming-mars/pull/8209) | `MarsBotDraftResolver.ts` + spec (squash-merged 2026-08-04 as `d3eed6478`). Four rounds; round 4 found two rule bugs behind kberg's "magic incantation" note: tag priority became lexicographic on per-tag counts, and the post-draft discard now removes the first card without a priority tag, with Credicor, Spire and Aridor saving what they drafted for. His parting note that ranking by score exists in more than one place became the `rankedTiers` PR |

## Open

#8001 stays open as the discussion thread (kberg closes it when he wants).
The ICard / MarsBot-as-IPlayer-subtype question raised there got its answer in the
#8207 review (2026-07-28): corp handlers take an IPlayer-style `IMarsBot` (own state
plus a `game` reference installed at load), and card hooks take the real
`IProjectCard`. Phase 2 can build on that shape.

| PR | Branch | Contents | Divergence from automa branch |
|----|--------|----------|-------------------------------|
| [#8353](https://github.com/terraforming-mars/terraforming-mars/pull/8353) | `marsbot-postmerge-fixes` | Follow-ups to the merged #8206 and #8207: `Automa: X` card names to the `X:automa` suffix form (the client keeps what precedes the colon, so all eight rendered as "Automa"), `mcSupply`/`floaterCount` to `megacredits`/`floaters`, hook comments, and `MarsBotBoard` to `MarsBotTracks` with its array as `all`. **Round 1 addressed (2026-08-03):** the three `drawAndResolve*` methods return nothing and carry a `maybe` prefix, since no caller read the boolean. Answered without a change: the eight automa card names collide with nothing in the enum. **Round 2 addressed (2026-08-04):** kberg reversed himself on the tracks naming after a closer read, so the class went back to `MarsBotBoard` with a `tracks` array (`marsBotBoard` as the variable name, per his ask), `data` became `definitions`, and `tagToTrack` is a public `Partial<Record<Tag, number>>` with both accessor methods gone | Automa keeps the old `mcSupply`/`floaterCount` save keys and reads either; automa's board keeps `regress(): boolean` and `getLeastAdvancedTrackIndex(excludeVenus)` |
| [#8210](https://github.com/terraforming-mars/terraforming-mars/pull/8210) | `marsbot-ma-eval` | `MarsBotMilestoneAwardEval.ts` + spec. **Round 2 addressed (2026-08-03):** `MarsBotMAContext` dropped, evals take `IMarsBot` and read the game like the real milestones. Fixed two bugs it exposed: Hydrologist counted owners of ocean tiles, which the engine never sets, so it could never be claimed; Visionary counted the Venus track twice | `@/` imports -> relative. 2 integration tests dropped (Terraformer29 filtering, Briber MC deduction) - re-add with game integration PRs |
| [#8211](https://github.com/terraforming-mars/terraforming-mars/pull/8211) | `marsbot-turmoil-helper` | `MarsBotTurmoilHelper.ts` + spec. **Round 1 addressed (2026-08-03):** now a class holding game, turmoil and both players; `totalDelegates` and a no-op `as` cast deleted, `maybeUpdatePartyLeader` renamed, delegate log message generalised. **Round 4 addressed (2026-08-04):** log message to past tense. Pushed back on dropping `maybeUpdatePartyLeader`: `Party.checkPartyLeader` only promotes someone it finds in `game.playersInGenerationOrder`, and MarsBot is deliberately not there, so a bot holding 2 delegates to a human's 1 never took the lead without it. The spec had cast a real second player as MarsBot, which hid this, so it now builds the bot the way `AutomaGameSetup` does and a 14th test covers the leadership. **Round 5 addressed (2026-08-04):** the fix moved into `Party.checkPartyLeader` itself, which now also considers delegates that are not game players, so `maybeUpdatePartyLeader` is deleted; the ctor takes only `game` and reads the bot from the new `automaHooks` seam on IGame (`IAutomaGameHooks`, holding just the MarsBot player upstream); dropped an unnecessary `as PlayerId` cast | Automa types `IGame.automaHooks` as the full `AutomaGameHooks` class (implements the upstream interface); automa's spec builds a real automa game instead of hand-building the player |
| rankedTiers (PR pending) | `ranking-tiers` -> `ranked-tiers` | `rankedTiers` in `utils.ts` plus refits of the three copies of the first/second-with-friendly-ties walk: `Election`, `Revolution` and the award scoring in `calculateVictoryPoints`. Adds the missing tie-for-first and two-player tests, and a `calculateVictoryPoints.spec.ts` covering that two player games award no second place. Answers kberg's note on #8209 that this ranking exists in more than one place | Automa's award refit keeps the MarsBot player push from `automaHooks` |

## Design note: bonus card destruction (resolved 2026-06-20)

A bonus card is destroyed *during its own resolution*, when it sits in MarsBot's
action deck rather than any bonus-deck pile. So destruction only needs to mean
"do not file the card to discard" — then it is unreferenced and can never reshuffle.
No flag on the card, no destroyed-list on the deck. On the automa branch,
`MarsBotBonusResolver.resolve()` returns whether the card was destroyed and skips
the discard accordingly. The old `destroyedBonusCards` serialize/restore/milestone
plumbing was dead code (it scanned piles a destroyed card can never be in) and was
removed.

## Blocked (everything else)

All remaining modules import `MarsBot` directly: `MarsBotStock`, `MarsBotScoring`,
`MarsBotTurnResolver`, `MarsBotBonusResolver`, `AutomaGameHooks`, `AutomaGameSetup`,
colonies modules (`ColonyPlacer`, `Trader`, `ShippingBoard`), corp
manifests/registry/resolver, and the client UI (needs `GameModel.marsBot`).

## Remaining phases (~25 PRs)

1. **Phase 2 - MarsBot skeleton** (3-4 PRs). Gated on kberg's IPlayer-subtype answer
   and on #8203/#8206 merging. First slice should be corp-free (base difficulty plays
   without a corporation).
2. **Phase 3 - capabilities**: Stock, Scoring, BonusResolver (split 2-3 ways by bonus
   group), TurnResolver (split track-advancement vs card resolution).
3. **Phase 4 - game integration**: AutomaGameSetup, AutomaGameHooks (split 2-3 ways),
   Game/GameOptions/routes/ServerModel wiring, then client UI.
4. **Phase 5 - expansions**: corp manifests + registry + resolver, colonies, turmoil
   integration. The ~15 small upstream-card touches ride along with whichever hook PR
   needs them.

## Process per PR

1. Branch from `upstream/main` (or the parent PR branch when stacking, max 1 deep).
2. Copy the file from the automa branch, polish to upstream style
   (`type` not `interface`, `undefined` not `null`, relative imports, no dead code -
   trim methods whose consumers aren't upstream yet).
3. Standalone spec: no `MarsBot`, no `automaOption` - construct directly or use a
   regular `testGame`.
4. Verify: eslint on the files, `npm run build:server`, `npm run build:test`, run the spec.
5. PR body: human tone, reference #8001, note independence/stacking.
6. When kberg requests changes: fix on the PR branch, then port the fix back to the
   automa branch (never merge automa into PR branches).
7. Update published PR branches by merging (`upstream/main` or the parent branch) and
   adding normal commits on top - no rebases, no force pushes.
