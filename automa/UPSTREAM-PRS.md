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

## Open

#8001 stays open as the discussion thread (kberg closes it when he wants).
The ICard / MarsBot-as-IPlayer-subtype question raised there got its answer in the
#8207 review (2026-07-28): corp handlers take an IPlayer-style `IMarsBot` (own state
plus a `game` reference installed at load), and card hooks take the real
`IProjectCard`. Phase 2 can build on that shape.

| PR | Branch | Contents | Divergence from automa branch |
|----|--------|----------|-------------------------------|
| [#8353](https://github.com/terraforming-mars/terraforming-mars/pull/8353) | `marsbot-postmerge-fixes` | Follow-ups to the merged #8206 and #8207: `Automa: X` card names to the `X:automa` suffix form (the client keeps what precedes the colon, so all eight rendered as "Automa"), `mcSupply`/`floaterCount` to `megacredits`/`floaters`, hook comments, and `MarsBotBoard` to `MarsBotTracks` with its array as `all` | Automa keeps the old `mcSupply`/`floaterCount` save keys and reads either |
| [#8208](https://github.com/terraforming-mars/terraforming-mars/pull/8208) | `marsbot-tile-placer` | `MarsBotTilePlacer.ts` + spec. **Round 2 addressed (2026-08-03):** `Board.ownedBy` filters, `drawOrThrow`, redundant `s.tile !== undefined` dropped, duplicated adjacency scorer collapsed, dead reserved-space check removed; spec rewritten so no test can pass without asserting, tiebreakers covered | Spec setup: `testGame(2)` instead of `TestPlayer.RED.newPlayer` + `as any` cast |
| [#8209](https://github.com/terraforming-mars/terraforming-mars/pull/8209) | `marsbot-draft-resolver` | `MarsBotDraftResolver.ts` + spec. **Round 2 addressed (2026-08-03):** now a class taking tracks and an injected shuffle, `pickBest` made total, `postDraftDiscard` to `discardAfterDraft`, spec on real cards | Uses `MarsBotTracks`; this PR adopts the name when #8353 merges |
| [#8210](https://github.com/terraforming-mars/terraforming-mars/pull/8210) | `marsbot-ma-eval` | `MarsBotMilestoneAwardEval.ts` + spec. **Round 2 addressed (2026-08-03):** `MarsBotMAContext` dropped, evals take `IMarsBot` and read the game like the real milestones. Fixed two bugs it exposed: Hydrologist counted owners of ocean tiles, which the engine never sets, so it could never be claimed; Visionary counted the Venus track twice | `@/` imports -> relative. 2 integration tests dropped (Terraformer29 filtering, Briber MC deduction) - re-add with game integration PRs |
| [#8211](https://github.com/terraforming-mars/terraforming-mars/pull/8211) | `marsbot-turmoil-helper` | `MarsBotTurmoilHelper.ts` + spec. **Round 1 addressed (2026-08-03):** now a class holding game, turmoil and both players; `totalDelegates` and a no-op `as` cast deleted, `maybeUpdatePartyLeader` renamed, delegate log message generalised | Spec is a 13-test extraction from `MarsBotTurmoil.spec.ts`; 2-player Turmoil game stands in for the bot |

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
