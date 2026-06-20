# Upstream PR tracker

State of the one-file-at-a-time PR series against `terraforming-mars/terraforming-mars`,
agreed after #8001 was deemed too big to review. Last updated: 2026-06-09.

## Merged

| PR | Contents |
|----|----------|
| [#7994](https://github.com/terraforming-mars/terraforming-mars/pull/7994) | Foundation: `AutomaTypes`, `MarsBotBoard`, `TharsisMarsBot`, `MarsBotModel`, `MarsBotMADescriptions`, board spec |

## Open

#8001 stays open as the discussion thread (kberg closes it when he wants).
The ICard / MarsBot-as-IPlayer-subtype question raised there is **unresolved** and
gates Phase 2.

| PR | Branch | Contents | Divergence from automa branch |
|----|--------|----------|-------------------------------|
| [#8203](https://github.com/terraforming-mars/terraforming-mars/pull/8203) | `marsbot-bonus-cards` | `MarsBotBonusCard.ts` (no spec) | **kberg review addressed (2026-06-20):** card type is just `{id, name}` — `destroyed` field removed entirely, test file deleted. Base set only (corp names deferred). `type` not `interface` |
| [#8204](https://github.com/terraforming-mars/terraforming-mars/pull/8204) | `marsbot-tags` | `MarsBotTags.ts` + new spec | Spec rewritten standalone (builds `MarsBotTags` directly with a `testGame` player + `MarsBotBoard`; automa-branch spec goes through `game.marsBot`) |
| [#8205](https://github.com/terraforming-mars/terraforming-mars/pull/8205) | `marsbot-venus-track` | `VenusMarsBot.ts`, `AutomaTypes` floater/floater2 + `tag_${string}` actions, `canAdvance` uses layout length, Venus tests in board spec | `regress()` boolean return and `getLeastAdvancedTrackIndex(excludeVenus)` deferred until their consumers land |
| [#8206](https://github.com/terraforming-mars/terraforming-mars/pull/8206) | `marsbot-bonus-deck` (stacked on `marsbot-bonus-cards`) | `MarsBotBonusDeck.ts` + spec | **Flag-free (2026-06-20):** deck has NO `destroy()` — destruction = the resolver not discarding the card; just createBase/draw/discard/reshuffle. Expansion deck variants deferred. **Rebase after #8203 merges** |
| [#8207](https://github.com/terraforming-mars/terraforming-mars/pull/8207) | `marsbot-corp-types` | `MarsBotCorpTypes.ts` + `CubeType` in `AutomaTypes` | 3 interfaces -> `type`, C-xx comments labeled as Colonies rule numbers. No spec (types only). Body invites early design feedback |
| [#8208](https://github.com/terraforming-mars/terraforming-mars/pull/8208) | `marsbot-tile-placer` | `MarsBotTilePlacer.ts` + spec | Spec setup: `testGame(2)` instead of `TestPlayer.RED.newPlayer` + `as any` cast |
| [#8209](https://github.com/terraforming-mars/terraforming-mars/pull/8209) | `marsbot-draft-resolver` (stacked on `marsbot-corp-types`) | `MarsBotDraftResolver.ts` + spec | None. **Rebase after #8207 merges** |
| [#8210](https://github.com/terraforming-mars/terraforming-mars/pull/8210) | `marsbot-ma-eval` | `MarsBotMilestoneAwardEval.ts` + spec | `@/` imports -> relative. 2 integration tests dropped (Terraformer29 filtering, Briber MC deduction) - re-add with game integration PRs |
| [#8211](https://github.com/terraforming-mars/terraforming-mars/pull/8211) | `marsbot-turmoil-helper` | `MarsBotTurmoilHelper.ts` + new spec | Spec is a 10-test extraction from `MarsBotTurmoil.spec.ts` (T-7 selection, party leader, totalDelegates); 2-player Turmoil game stands in for the bot |

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
