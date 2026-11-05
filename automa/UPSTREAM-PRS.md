# Upstream PR tracker

State of the one-file-at-a-time PR series against `terraforming-mars/terraforming-mars`,
agreed after #8001 was deemed too big to review. Last updated: 2026-11-05.

## Merged

| PR | Contents |
|----|----------|
| [#7994](https://github.com/terraforming-mars/terraforming-mars/pull/7994) | Foundation: `AutomaTypes`, `MarsBotTracks` (was `MarsBotBoard`), `TharsisMarsBot`, `MarsBotModel`, `MarsBotMADescriptions`, board spec. Automa divergence since merge: `MarsBotModel`'s VP breakdown field `colonyVP` is `leftoverResourcesVP` (the optional rule scores leftover shipping-board resources and Venus floaters, not colonies; model only, never saved); every milestone and award MarsBot plays against has an `automaDescription` on its class (#8645 moved the `MarsBotMADescriptions` tables there), adding Polar Explorer, Pioneer, Geologist, Hoverlord, Desert Settler, Estate Dealer, Metropolist, Suburbian, Landscaper, Highlander and Venuphile |
| [#8203](https://github.com/terraforming-mars/terraforming-mars/pull/8203) | `MarsBotBonusCard.ts` — bonus card type + base set (squash-merged 2026-07-20) |
| [#8204](https://github.com/terraforming-mars/terraforming-mars/pull/8204) | `MarsBotTags.ts` + spec |
| [#8205](https://github.com/terraforming-mars/terraforming-mars/pull/8205) | Venus track layout, `AutomaTypes` floater/floater2 + `tag_${string}` actions |
| [#8206](https://github.com/terraforming-mars/terraforming-mars/pull/8206) | `MarsBotBonusDeck.ts` extending `Deck<MarsBotBonusCard>` + spec, kberg's `b5c7df0cf` (`AUTOMA_*` CardNames, `Deck<Named<CardName>>`) riding along (squash-merged 2026-07-28 as `27bd8b963`). His approval note: many of the deck tests duplicate `Deck.spec.ts` now — #8342 trims them. Automa divergence stays: the deck holds `MarsBotBonusDeckCard` (a bonus card or a project card a corporation put there), `marsBotBonusCardsFromJSON` also knows B15-B32 and project cards, expansion deck factories with a `shuffle` flag for loading, `findAndRemove`/`removeById`, `bonusCardDisplayName()` (now a `split(':')[0]`). Since 2026-10-29 `MarsBot.ts` saves the deck with `Deck.serialize()` and loads it through upstream's `deserialize`; saves from before hold `bonusDeckDrawPile`/`bonusDeckDiscardPile` with bonus cards by id, which `restoreState` and `stateHash` translate |
| [#8207](https://github.com/terraforming-mars/terraforming-mars/pull/8207) | `MarsBotCorpTypes.ts` + `CubeType` in `AutomaTypes` (squash-merged 2026-07-31 as `8d8e335d8`). Approved with questions still open, answered and fixed in #8353. Automa divergence since merge: `onColonyPlaced` also fires for the human's colonies (Poseidon); `maybeDrawAndResolveProjectCardIgnoringFirstNTags(n)` became `maybeDrawAndResolveProjectCardFirstTagOnly()` (Thorgate resolves only the first tag); new `returnSetupBonusCardToBonusDeck()` (UNMI); new `afterTrackSpaceResolved` effect hook, so Manutech advances again after the #5/#12 space resolves; `IMarsBot.failedActionMc` (Sagitta pays double) and `mcKeptThroughIntervention` (Lakefront's M€ survives Government Intervention); `raiseTemperature` narrowed to `1 \| 2` and takes a Failed Action at max; `trackCubes` also takes a tag-named `MarsBotTagTrackCube` (Aridor's Jovian and city cubes), read through the new `corpTrackCubes(corp, board)`; `advanceTrack` and the `maybeDrawAndResolve*` methods do nothing once the game has ended |
| [#8342](https://github.com/terraforming-mars/terraforming-mars/pull/8342) | Trims the 3 bonus deck tests that duplicate `Deck.spec.ts` (merged 2026-07-28 as `740d79ef6`). Automa's spec has upstream's two tests, the three it trimmed, and a round trip with expansion and corporation bonus cards and project cards |
| [#8208](https://github.com/terraforming-mars/terraforming-mars/pull/8208) | `MarsBotTilePlacer.ts` + spec (squash-merged 2026-08-03 as `b9ddb4063`). Three review rounds: `Board.ownedBy` filters, `drawOrThrow`, duplicated adjacency scorer collapsed; spec rewritten so no test can pass without asserting, then flattened to one `describe` with `cast(x, undefined)` and 17 tests naming the spaces they expect. `findExpediteConstructionCitySpace` renamed after the Expedited Construction card. Pushed back successfully on `maxOutOceans`: it stops at the 9-ocean cap, leaving 3 of Tharsis's 12 reserved spaces free. Automa divergence since merge: `findNeuralInstanceSpace` also rejects spaces next to `noctisCitySpaceId` (with a spec), still to be sent upstream; greenery placement scores MarsBot's adjacent cities minus the player's (net gain, BGG 3350125/3411375) instead of MarsBot's first; the Expedited Construction city space goes through `findCitySpace` with a 2+ greenery/ocean filter, so the usual city rule picks among those spaces |
| [#8209](https://github.com/terraforming-mars/terraforming-mars/pull/8209) | `MarsBotDraftResolver.ts` + spec (squash-merged 2026-08-04 as `d3eed6478`). Four rounds; round 4 found two rule bugs behind kberg's "magic incantation" note: tag priority became lexicographic on per-tag counts, and the post-draft discard now removes the first card without a priority tag, with Credicor, Spire and Aridor saving what they drafted for. His parting note that ranking by score exists in more than one place became the `rankedTiers` PR. Automa divergence since merge: a tag priority (a tag list or Aridor's track) that protects every card still discards one, the card with the fewest matches (`fewestMatches`, BGG 3398289); Aridor scores cards by the tags on its least-advanced track (`scoreByTrack`), both tags of a shared track alike; the most-tags count includes wild tags |
| [#8353](https://github.com/terraforming-mars/terraforming-mars/pull/8353) | Follow-ups to the merged #8206 and #8207: `Automa: X` card names to the `X:automa` suffix form (the client keeps what precedes the colon, so all eight rendered as "Automa"), `mcSupply`/`floaterCount` to `megacredits`/`floaters`, hook comments, and `MarsBotBoard` to `MarsBotTracks` with its array as `all`. **Round 1 addressed (2026-08-03):** the three `drawAndResolve*` methods return nothing and carry a `maybe` prefix, since no caller read the boolean. Answered without a change: the eight automa card names collide with nothing in the enum. **Round 2 addressed (2026-08-04):** kberg reversed himself on the tracks naming after a closer read, so the class went back to `MarsBotBoard` with a `tracks` array (`marsBotBoard` as the variable name, per his ask), `data` became `definitions`, and `tagToTrack` is a public `Partial<Record<Tag, number>>` with both accessor methods gone (merged 2026-08-10 as `98dbca9a7`). Automa keeps the old `mcSupply`/`floaterCount` save keys and reads either; automa's board keeps `regress(): boolean` and `getLeastAdvancedTrackIndex(excludeVenus)` |
| [#8626](https://github.com/terraforming-mars/terraforming-mars/pull/8626) | MarsBot hooks on milestones and awards: `IMilestone.marsBotCanClaim` and `IAward.marsBotScore`, implemented by Planner, Banker, Miner and Thermalist; `MarsBotBoard.trackPosition` (read by `MarsBotTags`); `tests/automa/FakeMarsBot.ts` (squash-merged 2026-10-29 as `4423f18ac`, which automa took in with no content change). Automa divergence: `IMilestone.remaining?` and `BaseMilestone.remaining`, and a human-player test added to each of the four specs |
| [#8643](https://github.com/terraforming-mars/terraforming-mars/pull/8643) | Four `MarsBotTilePlacer` rule fixes from the BGG answers: the random tiebreak counts cost 1 to the first space and cost 0 picks the last (njshaw2 in 3342916; TDaver later leaned toward counting the first space as zero and nobody settled it), Neural Instance stays off the spaces next to Noctis City (3406056, 3436886), greeneries go for the greatest net gain (3350125, 3411375), and Expedited Construction picks among its eligible spaces by the usual city rule through `findCitySpace(filter)` (3350125) (squash-merged 2026-11-02 as `d0ecb7f84`, identical to automa's two files, so automa's merge kept its own). Automa divergence: the placer also has the per-map tiebreakers, extra icons, special hexes and `filter` on the other finders |
| [#8657](https://github.com/terraforming-mars/terraforming-mars/pull/8657) | Flattens the nested discard-then-draw describe in `tests/cards/Deck.spec.ts`, from the #8646 review (merged 2026-11-02 as `c51c92f4d`). No automa divergence |
| [#8644](https://github.com/terraforming-mars/terraforming-mars/pull/8644) | Tharsis floaters on Event space 6 and Energy spaces 2 and 4, Building space 11 as `tag_space`, `peek()` skipping a regressed space, `regress()` returning whether the track moved, and `MarsBotModel`'s `instantWin`, `globalParameterSteps` and `vpByGeneration` made required with `CubeType` imported from `AutomaTypes`. Answers kberg's #7994 notes on the peek test and the optional model fields (squash-merged 2026-10-30 as `acb1d92bf`). Automa divergence: automa's model also has the score fields (productions, vermin, leftover resources, Turmoil and corporation VP, M&A details, name, color, shipping board), `getLeastAdvancedTrackIndex(excludeVenus)`, `THARSIS_MARSBOT_BOARD_WITH_VENUS`, and `trackPosition` tests in the board spec |
| [#8645](https://github.com/terraforming-mars/terraforming-mars/pull/8645) | MarsBot milestone and award descriptions rewritten to the rulebook (about 30 strings, missing entries filled in) and moved onto the milestone and award classes as `automaDescription`, with `automaMapDescriptions` for the nine rules a map words differently, both exported to the client JSON, and `MarsBotBoards.ts` as just `MARSBOT_BOARD_NAMES`. One test. **Round 2 addressed (2026-11-02):** all texts in one style (N+ for counts, ≥ for track positions, + and - for arithmetic, M€, "(including events)"), Landlord is `Tiles owned (unchanged)`, kberg's wording on the `IMilestone` and `IAward` docs, Tycoon reads blue/green like Tycoon10, and a new PR description (squash-merged 2026-11-02 as `872c5ba01`). Automa took it in on 2026-11-02 keeping its own side of the 10 files that conflicted, each a superset (the `IMarsBot` imports and map overrides, `isMarsBotBoardChoice`, `printedVictoryPoints`, its broader descriptions spec). Upstream has no `marsBotMapSet`: the first map PR that needs it (Vastitas Borealis, for Farmer) brings `src/common/automa/marsBotMapSet.ts` back with it. Automa divergence: the PR drops `MarsBotMADescriptions.ts`; automa keeps it, renamed `marsBotMapSet.ts`, for `marsBotMapSet` and reads the descriptions in `Milestone.vue` and `Award.vue`, and its spec sweeps what `supportsMilestone` and `supportsAward` allow instead of the six boards. Automa's `MarsBotBoards.ts` also has `isMarsBotBoardChoice` |
| [#8647](https://github.com/terraforming-mars/terraforming-mars/pull/8647) | Four `MarsBotDraftResolver` fixes: wild tags count in the most-tags draft (3781613), event cards count their Event tag through `cardTagsIncludingEvent`, Aridor scores both tags on its track alike (our reading of B p.3, labelled so in the body), and a tag priority that protects every card discards the one with the fewest matches (3398289, 3781613). One test each, each failing without its fix (squash-merged 2026-11-02 as `3c46e5600`). Automa divergence: resolver and spec are identical; automa's `MarsBotTags.ts` also has `printedVictoryPoints` |
| [#8648](https://github.com/terraforming-mars/terraforming-mars/pull/8648) | `Deck.draw` shuffles only when a draw finds the draw pile empty, so cards discarded after the last draw join the new deck (MarsBot's bonus deck reshuffle rule; squash-merged 2026-10-30 as `3c528bbf0`). No automa divergence |
| [#8662](https://github.com/terraforming-mars/terraforming-mars/pull/8662) | Hoverlord (7 floaters on the Venus board, C p.2) and Visionary (lowest track doubled, second lowest with Venus, C p.15), with `MarsBotMilestoneAwardEval.ts` (`marsBotAllTrackPositions`, `marsBotUsesMapSet`) and `src/common/automa/marsBotMapSet.ts` (squash-merged 2026-11-02 as `ff936fe0a`). kberg asked why the map set matters; answered in the thread (the expansion plays the Tharsis rules on any map, Farmer differs). Automa took it in keeping its own sides of the 5 conflicting files: import paths, the eval file's extra helpers, and the human-player tests next to the PR's MarsBot tests. Automa divergence: imports only, plus `marsBotCanClaimMilestone`, `marsBotAwardScore`, `milestoneRemaining` and `marsBotMarsTrackPositions` in the eval file |
| [#8625](https://github.com/terraforming-mars/terraforming-mars/pull/8625) | `marsbot-setup`: Brings back #8369: `GameOptions.automa`, `IGame.marsBotPlayer` handed to the Game constructor, `IGame.playersPlusMarsBot`, `AutomaGameSetup` creating MarsBot's player with the id `p-${gameId}-marsbot`, and `Cloner` swapping that id. **Round 1 addressed (2026-10-29):** `allPlayers` taken out and then brought back as a readonly field, with the reasons in the `IGame.ts` thread and a question to kberg. **Round 2 addressed (2026-11-02):** `allPlayers` renamed to `playersAndAutoma`, as kberg suggested. **Round 3 (2026-11-02, from kberg's comments on #8664, which showed this PR's files):** renamed to `playersPlusMarsBot` and the Reds comments say plainly that MarsBot's TR counts but MarsBot never gains or loses it (squash-merged 2026-11-03 as `0e62d6180`; kberg: "I think I'll regret the extra complexity, but I'm OK with it"). Automa divergence: Automa's setup also builds the bot manager, decks and board (`automaHooks`), and older automa saves hold the option as `automaOption`. Automa's Reds comments also cite rulebook C |
| [#8663](https://github.com/terraforming-mars/terraforming-mars/pull/8663) | `marsbot-vastitas-overrides`: The Vastitas Borealis set (C p.10): Blacksmith, Promoter, Traveller, V. Spacefarer, Engineer, Farmer (Science or Bio space 6 on the map, Bio 7 with the expansion, through `marsBotUsesMapSet`), with the same two helper files as #8662 (opened 2026-11-02, replaces fork #56). Approved 2026-11-02; main merged in after #8662 landed, so the diff is the Vastitas files only (squash-merged 2026-11-03 as `0c199176d`). Automa divergence: Imports only, as #8662 |
| [#8665](https://github.com/terraforming-mars/terraforming-mars/pull/8665) | `marsbot-tile-tiebreaker-order`: `MarsBotTilePlacer` per-map tiebreaker order from the player aids (C p.10; Vastitas Borealis read as icons, edge, then oceans, our reading), Highlander keeping oceans below icons, the M&A expansion playing the Tharsis aid, the Vastitas delegate hexes empty without Turmoil. `Scorer`, `primaryScorer`, the comparator over spaces and Elysium's `equatorRow` come from kberg's #8664 review. Opened 2026-11-02 as the first of three pieces of #8664; the extra icons wait as fork #64 and the M€ hexes as fork #65. **Round 1 addressed (2026-11-03):** `.toSorted()`, `preferring(predicate)` (kberg suggested `scorer`; kept `predicate` since it returns a boolean and `Scorer` a number, said so in the thread), one `as const` test array with an `it` per run and `expected` for the winner. On kberg's "what's this magic" about the Highlander reorder: now a named `oceansAfterIcons` with the rule (C p.15), kept on every map because automa lets MarsBot games pick awards by hand (`Game.ts` skips the solo `customMA` reset when `automa` is set). Merged down into #64 and #65. kberg approved it with "Thanks" (squash-merged 2026-11-04 as `d443cfe7e`). Automa took it in keeping its own side of the two files that conflicted: the placer is the end state of #65, and the spec has all 14 of the PR's runs word for word among its 29. Automa divergence: automa's placer is the end state of #65: `iconCount(space, extraIcons)` built on `paidIconCount`, the M€ hexes and the optional `IMarsBot` (from `IMarsBot.ts`), and `getPlacementBonusMC` leaving out the M€ hexes and the delegate without Turmoil. Automa also has the `filter` params on the greenery and ocean finders, the Build, Build, Build finders, markers and `beforeRandomScorer`, and Lakefront's M€ per ocean |
| [#8646](https://github.com/terraforming-mars/terraforming-mars/pull/8646) | `marsbot-corp-types`: The whole of automa's `MarsBotCorpTypes.ts` (+158/-21): hooks with new parameters or wider triggers, tag-named `trackCubes` with `corpTrackCubes`, three renamed or narrowed methods, and the corporation fields, hooks and bot methods the 46 corporations use, plus the `CubeType` comment on the silver `credit` cube (opened 2026-10-29). One test for `corpTrackCubes`. Approved with one non-blocking note on `IMarsBotCorp.oceanAdjacencyMc` (kberg: "seems like this is standing in for a function"), followed up as the branch `marsbot-ocean-bonus` (squash-merged 2026-11-04 as `cf34e3b4c`). Automa took it in with one conflict, `IMarsBot.ts` (add/add), where automa's side adds `canPlaceColony`; every other file matched. Automa divergence: `MarsBotCorpTypes.ts` and its spec are identical; automa's `CubeType` also has the Utopia Planitia `colony` cube, and its `IMarsBot` has `canPlaceColony` |
| [#8669](https://github.com/terraforming-mars/terraforming-mars/pull/8669) | `marsbot-red-ships`: Red Ships leaves MarsBot's Neural Instance out (Dávid on BGG 3415037: "originally designed as not a special tile"); `isSpecialTile` unchanged since MarsBot's own placement still sees it as special. One test (opened 2026-11-03, replaces fork #62). Round 1 (2026-11-04): kberg asked for the exclusion in `isSpecialTile` instead; pushed back, since MarsBot's tile placer, bonus resolver and Founder score need the Neural Instance special. kberg approved it after the pushback (squash-merged 2026-11-04 as `9c7de4989`). Automa took it in keeping its own side of `RedShips.spec.ts`, where only the test comment differs. Automa divergence: source identical; automa's test comment also cites the BGG thread |
| [#8670](https://github.com/terraforming-mars/terraforming-mars/pull/8670) | `marsbot-media-archives`: Media Archives counts MarsBot's Event track (rulebook A p.5, Nick Shaw on BGG 2883930) in `Counter`, as a separate `game.marsBotPlayer?.tags.count(Tag.EVENT, 'raw')` line after the human players (round 1, 2026-11-04: kberg asked to drop `playersPlusMarsBot` there). One test (opened 2026-11-03, replaces fork #61). kberg approved it ("How much do I care about \' in test names? It's not pretty let's move along") (squash-merged 2026-11-04 as `096553e95`). Automa took it in keeping its own side of the two hunks in `MediaArchives.spec.ts`. Automa divergence: source identical; automa's spec takes the board from `automaHooks` where the PR's builds one with `fakeMarsBot`, and its comment cites the rulebook |
| [#8674](https://github.com/terraforming-mars/terraforming-mars/pull/8674) | `fix-imarsbot-imports`: main stopped building once #8646 landed: nine files still imported `IMarsBot` from `MarsBotCorpTypes` (TS2459, CI red since `cf34e3b4c`). Changes only those nine import lines (squash-merged 2026-11-05 as `4767971dc`). Tournament carries the same nine lines as `4c9d9690b`. No automa divergence, automa already imported from `IMarsBot.ts` |

## Open

#8001 stays open as the discussion thread (kberg closes it when he wants).
The ICard / MarsBot-as-IPlayer-subtype question raised there got its answer in the
#8207 review (2026-07-28): corp handlers take an IPlayer-style `IMarsBot` (own state
plus a `game` reference installed at load), and card hooks take the real
`IProjectCard`. Phase 2 can build on that shape.

| PR | Branch | Contents | Divergence from automa branch |
|----|--------|----------|-------------------------------|
| [#8671](https://github.com/terraforming-mars/terraforming-mars/pull/8671) | `marsbot-turmoil` | `MarsBotTurmoilHelper` (Party Politics, rulebook C p.6: the six step party priority and the placement) and `Party.checkPartyLeader` checking MarsBot when it holds delegates. Picks up #8211 (opened 2026-11-03, replaces fork #48). Also `selectGrayEminenceParty` (Gray Eminence, B29) with `pickByFlippedCard` in `MarsBotCardFlip.ts`. 23 tests: 18 in the helper spec, 5 in the new `MarsBotCardFlip.spec.ts`. Carried #8674's nine import lines until #8674 merged; main merged in 2026-11-05, so the diff is its own files only. kberg review 2026-11-05 ("Seems clear enough", 8 inline): shared `fewestDelegates`, spec `ALL_PARTIES`/`partiesExcept`/`sendDelegates`, the already-dominant and placement tests pinned to Scientists and Kelvinists; tier 1 kept (priority 1 test fails without it) | None, `MarsBotTurmoilHelper.ts`, `MarsBotCardFlip.ts` and both specs are identical to the PR |
| rankedTiers (PR pending) | `ranking-tiers` -> `ranked-tiers` | `rankedTiers` in `utils.ts` plus refits of the three copies of the first/second-with-friendly-ties walk: `Election`, `Revolution` and the award scoring in `calculateVictoryPoints`. Adds the missing tie-for-first and two-player tests, and a `calculateVictoryPoints.spec.ts` covering that two player games award no second place. Answers kberg's note on #8209 that this ranking exists in more than one place | Automa's award refit keeps the MarsBot player push from `automaHooks` |
| [#8675](https://github.com/terraforming-mars/terraforming-mars/pull/8675) | `marsbot-tile-extra-icons` | The extra reward icons in MarsBot's tiebreak as named space checks (`onEdge`, `onOrNextToVolcanic`, `nextToSpecialTile`) with the map and M&A tables, the second piece of #8664 (opened 2026-11-04, replaces fork #64). Five rows join the placer spec table, all failing with main's placer. Carried #8674's nine import lines until #8674 merged; main merged in 2026-11-05, so the diff is its own files only | Automa's placer is the end state of fork #65 |
| [#8676](https://github.com/terraforming-mars/terraforming-mars/pull/8676) | `marsbot-ocean-bonus` | Removes `IMarsBotCorp.oceanAdjacencyMc`; `MarsBotTilePlacer.getOceanAdjacencyMC` pays MarsBot's player `oceanBonus` per adjacent ocean, as the human Lakefront Resorts does (kberg's note on #8646: "seems like this is standing in for a function"). One test (opened 2026-11-04, replaces fork #66). Carried #8674's nine import lines until #8674 merged; main merged in 2026-11-05, so the diff is its own files only | Automa's Lakefront `setup` sets `bot.player.oceanBonus` to `LAKEFRONT_OCEAN_BONUS` (3), and `MarsBot.restoreState` sets it again when the corporation is Lakefront, since the bot's player is rebuilt on load and the save holds no ocean bonus. The save format is unchanged on purpose: `stateHash` covers the whole `automaState`, so a new field would break the recorded hashes of games in progress |

### Held on the fork (2026-10-29, updated 2026-11-04)

These stay stacked on their parent branches, each with a comment saying what it waits on. The map chain sits on
`marsbot-ma-core-v1`, and #8626 merged in a different shape (`MarsBotBoard.trackPosition` and the
`marsBotCanClaim`/`marsBotScore` hooks instead of `marsBotTrackPosition` and the eval module), so every map gets
rebuilt off upstream main before it goes up, and its fork PR is closed with "Moved upstream".

| Fork PR | Branch (on) | Waits on | Before it goes up |
|---------|-------------|----------|-------------------|
| [#49](https://github.com/ignac8/terraforming-mars/pull/49) | `marsbot-ma-hellas` (on `marsbot-ma-core-v1`) | Rebuilt off main 2026-11-04 as `marsbot-ma-hellas-v2` and opened upstream as [#8677](https://github.com/terraforming-mars/terraforming-mars/pull/8677) (via fork #67), carrying #8674's nine import lines until main was merged in on 2026-11-05; fork #49 closed 2026-11-04 | #8677 has the five Hellas hooks (Diversifier, Tactician, Rim Settler, Magnate, Excentric), same logic as automa; `playedProjectCards`, `marsBotUsesMapSet` and `marsBotMapSet.ts` were already on main. Its branch stays as the base of #50 |
| [#68](https://github.com/ignac8/terraforming-mars/pull/68) (was #50, closed 2026-11-04) | `marsbot-ma-elysium-v2` (on `fix-imarsbot-imports`) | Moved upstream as [#8689](https://github.com/terraforming-mars/terraforming-mars/pull/8689) (2026-11-05, main merged in, fork PR closed) | Elysium: 8 overrides and the `marsBotMarsTrackPositions` helper (shared byte-identical with #69). Rebuilt off main 2026-11-04, carries #8674's nine import lines and automa's human-player tests, so it builds alone and merges into automa without conflicts |
| [#51](https://github.com/ignac8/terraforming-mars/pull/51) | `marsbot-ma-venus` (on elysium) | Moved upstream as #8662 (fork PR closed 2026-11-02, branch kept for the stack) | |
| [#69](https://github.com/ignac8/terraforming-mars/pull/69) (was #52, closed 2026-11-04) | `marsbot-ma-modular-milestones-v2` (on `fix-imarsbot-imports`) | Moved upstream as [#8690](https://github.com/terraforming-mars/terraforming-mars/pull/8690) (2026-11-05, main merged in, fork PR closed) | Milestones & Awards milestones: 13 overrides incl. Landshaper, Sponsor and Lobbyist from #57; carries the helper and the modular Forester spec byte-identical with #68 and #71. Rebuilt off main 2026-11-04, carries #8674's nine import lines and automa's human-player tests, so it builds alone and merges into automa without conflicts |
| [#70](https://github.com/ignac8/terraforming-mars/pull/70) (was #53, closed 2026-11-04) | `marsbot-ma-modular-awards-v2` (on `fix-imarsbot-imports`) | Moved upstream as [#8691](https://github.com/terraforming-mars/terraforming-mars/pull/8691) (2026-11-05, main merged in, fork PR closed) | Milestones & Awards awards: Administrator, Politician, Biologist, plus Collector and Manufacturer from #57. Rebuilt off main 2026-11-04, carries #8674's nine import lines and automa's human-player tests, so it builds alone and merges into automa without conflicts |
| [#71](https://github.com/ignac8/terraforming-mars/pull/71) (was #54, closed 2026-11-04) | `marsbot-ma-terra-cimmeria-v2` (on `fix-imarsbot-imports`) | Moved upstream as [#8692](https://github.com/terraforming-mars/terraforming-mars/pull/8692) (2026-11-05, main merged in, fork PR closed) | Terra Cimmeria: 9 overrides incl. C. Forester (space 10) and Founder (Neural Instance special for MarsBot only, C p.9); carries the Forester lines from #69. Rebuilt off main 2026-11-04, carries #8674's nine import lines and automa's human-player tests, so it builds alone and merges into automa without conflicts |
| [#72](https://github.com/ignac8/terraforming-mars/pull/72) (was #55, closed 2026-11-04) | `marsbot-ma-utopia-planitia-v2` (on `fix-imarsbot-imports`) | Moved upstream as [#8693](https://github.com/terraforming-mars/terraforming-mars/pull/8693) (2026-11-05, main merged in, fork PR closed) | Utopia Planitia: 5 overrides; Botanist without the floor at 0. Rebuilt off main 2026-11-04, carries #8674's nine import lines and automa's human-player tests, so it builds alone and merges into automa without conflicts |
| [#56](https://github.com/ignac8/terraforming-mars/pull/56) | `marsbot-ma-vastitas-borealis` (on utopia planitia) | Moved upstream as #8663 (fork PR closed 2026-11-02, branch kept for the stack) | |
| [#57](https://github.com/ignac8/terraforming-mars/pull/57) | `marsbot-ma-amazonis-planitia` | Closed 2026-11-04 | Its five official items moved into #69 (Landshaper, Sponsor, Lobbyist) and #70 (Collector, Manufacturer); the big-map MarsBot board stays unofficial and unbuilt |
| [#64](https://github.com/ignac8/terraforming-mars/pull/64) | `marsbot-tile-extra-icons` (on `marsbot-tile-tiebreaker-order`, merged as #8665) | Moved upstream as #8675 (fork PR closed 2026-11-04, branch kept for #65) | The extra icons as named space checks (`onEdge`, `onOrNextToVolcanic`, `nextToSpecialTile`), map and M&A tables, from kberg's "kinda messy" on #8664. Opened 2026-11-02 |
| [#65](https://github.com/ignac8/terraforming-mars/pull/65) | `marsbot-tile-special-hexes` (on #64, with `marsbot-setup` merged in) | #8675 (#8625 merged 2026-11-03, #8665 and #8646 merged 2026-11-04) | The three hexes that cost M€, `IPlayer.isMarsBot` (kberg's idea on #8664) in `Board` and `TerraCimmeriaNovaBoard` (early return), `canPlaceColony` on `IMarsBot` (in the `IMarsBot.ts` #8646 split out). The placer keeps the player and an optional bot, answered on #8664. Opened 2026-11-02 |

Fork #29 (ocean count text) waits on no PR: it changes translation keys and stays on the fork until we send it
up. It conflicts with upstream main now and needs main merged in first. Fork #25 (HE3 log) was closed on
2026-11-02: upstream made the same fix in 693109c97, and automa has it.

Fork #14 (Head Start) merged into automa on 2026-11-02 after automa was merged into it (the two `Player.ts`
conflicts: `drainQueue` around its action callback, and the undo action option automa had already removed).
Opened upstream as [#8666](https://github.com/terraforming-mars/terraforming-mars/pull/8666) the same day, after kberg on #14: "if you don't hear many complaints, perhaps it's worth restoring". Branch `head-start`. **Round 1 addressed (2026-11-03):** the count moved onto the card (`HeadStart.data.actionsRemaining`, read through `HeadStart.actionsRemaining(player)`), `headStartInEffect` named and checked last, no Pass or Skip during Head Start (Fryxen, 2993276/41555074) with an action used up on its own only when the menu is empty, and the corporation first action taken as Head Start's first action (Fryxen, 3055761). Divergence: upstream still has the undo action, so #8666 also hides it during Head Start; automa has no undo action; automa's `takeAction` also lets MarsBot's corporation start the action phase during Head Start; automa and tournament carry an old save's player-level `headStartActionsRemaining` onto the card (`DeprecatedFields`). The tournament version waits for the organizer

Checked 2026-11-02: every open upstream and fork PR's changes are on automa, apart from the import paths and
divergences listed in the rows above.

## Opened 2026-11-05: boards, bonus cards, corporations

Six fresh branches off upstream main, each independent of the others and of every open PR (merge-tree
pairwise and chained onto all open PRs: clean). Opened upstream the same day as #8683 to #8688.
The four corporation PRs carry `AutomaManifest.ts`, `BaseGameCorps.ts` and automa's `fakeMarsBot(tracks,
overrides)` byte-identical, so any of them can go first. Their specs are new (fake bot, no `MarsBot`) and
are on automa too (`59a6328b1`), next to automa's real-MarsBot corp specs.

| PR and branch | Contents | Divergence from automa branch |
|--------|----------|-------------------------------|
| [#8683](https://github.com/terraforming-mars/terraforming-mars/pull/8683) `marsbot-map-boards` | Hellas, Elysium, Utopia Planitia, Vastitas Borealis and Terra Cimmeria MarsBot boards with Venus variants, `THARSIS_MARSBOT_BOARD_WITH_VENUS`, `MARSBOT_BOARDS`, the `colony` track action (C p.8). Spec `tests/automa/boards/MarsBotBoards.spec.ts` (6 tests) | `isMarsBotBoardChoice` left out (only the fork's create form uses it) |
| [#8684](https://github.com/terraforming-mars/terraforming-mars/pull/8684) `marsbot-expansion-bonus-cards` | `AUTOMA_*` names for B15 to B32, `createBonusCard`, expansion cards in `marsBotBonusCardsFromJSON`, `MarsBotBonusDeck.create(random, {venus, colonies})` (C p.2, p.4). Extends `MarsBotBonusDeck.spec.ts` | No `MarsBotBonusDeckCard` (project cards in the bonus deck), `findAndRemove`, `removeById`, `bonusCardDisplayName`. Merging it into automa conflicts in those three files: keep automa's side, its spec already holds the PR's tests |
| [#8685](https://github.com/terraforming-mars/terraforming-mars/pull/8685) `marsbot-corps-base` | The 12 base game corporations (`AutomaBaseManifest.ts`), `AutomaManifest.ts`, `BaseGameCorps.ts`. Spec `AutomaBaseManifest.spec.ts` (16 tests) | None |
| [#8686](https://github.com/terraforming-mars/terraforming-mars/pull/8686) `marsbot-corps-prelude` | The 16 Prelude and Prelude 2 corporations, `printedVictoryPoints` in `MarsBotTags.ts`. Spec `AutomaPreludeManifest.spec.ts` (13 tests) | None |
| [#8687](https://github.com/terraforming-mars/terraforming-mars/pull/8687) `marsbot-corps-venus-promo` | The 5 Venus Next and 4 promo corporations. Specs `AutomaVenusManifest.spec.ts`, `AutomaPromoManifest.spec.ts` (13 tests) | None |
| [#8688](https://github.com/terraforming-mars/terraforming-mars/pull/8688) `marsbot-corps-turmoil` | The 5 Turmoil corporations, `LAKEFRONT_OCEAN_BONUS` (read by #8676's placer). Spec `AutomaTurmoilManifest.spec.ts` (13 tests) | None |

Polish made for these on automa first: one bonus deck builder and `createCorpBonusCard` renamed to
`createBonusCard` (`3e576de4e`), colons instead of em dashes in the corporation logs (same commit), the
corporation FAQ cited as rulebook B p.4, not p.3 (`83990805a`). Not in any of them: the registry
(`MarsBotCorpRegistry`, `AllAutomaManifests`), which comes with the resolver, and the Colonies corporations,
which need `MarsBotColonyPlacer`.

## Closed

kberg closed these on 2026-09-29 without a comment; their last review rounds had gone unanswered. #8369 came
back as #8625 and the milestone and award hooks of #8210 as #8626. #8211 and the rest of #8210 wait as fork PRs.

| PR | Branch | Contents | Divergence from automa branch |
|----|--------|----------|-------------------------------|
| [#8664](https://github.com/terraforming-mars/terraforming-mars/pull/8664) | `marsbot-tile-map-tiebreakers` | Per-map tiebreakers, extra icons and the M€ hexes in one PR, stacked on #8625. Closed by us on 2026-11-02 after kberg's review ("doing too much at once"; 21 files in his diff, 15 of them #8625's). Split into #8665, fork #64 and fork #65, with his 15 comments answered in the threads | Superseded |
| [#8210](https://github.com/terraforming-mars/terraforming-mars/pull/8210) | `marsbot-ma-eval` | `MarsBotMilestoneAwardEval.ts` + spec. **Round 2 addressed (2026-08-03):** `MarsBotMAContext` dropped, evals take `IMarsBot` and read the game like the real milestones. Fixed two bugs it exposed: Hydrologist counted owners of ocean tiles, which the engine never sets, so it could never be claimed; Visionary counted the Venus track twice. **Round 3 addressed (2026-08-06):** the 84-entry eval table is gone; the bot claims and scores through the ordinary `IMilestone`/`IAward` calls with its player (its tags and production read the tracks). Rulebook C documents bot criteria past Tharsis (the official maps on pages 9-10, the Awards & Milestones expansion on 13-16), so every criterion that differs from the human rule became an override: 29 milestones and 22 awards implement the new optional `marsBotCanClaim`/`marsBotScore` members, tested in their class specs, and entries the rulebook leaves unchanged fall through to the normal rules. Reading the source also fixed a dozen errors in the old table (Fundraiser and Promoter read the wrong track, Trader and Lobbyist could never be claimed) and Terraformer under Turmoil, where the class knows the 26 threshold the table hardcoded as 35 | `@/` imports -> relative; automa's helpers read the public `tagToTrack` record and the overrides read `megacredits`/`floaters` and `marsBotBoard`, where upstream keeps `getTrackIndexForTag`, `mcSupply`/`floaterCount` and `board` until #8353 lands |
| [#8211](https://github.com/terraforming-mars/terraforming-mars/pull/8211) | `marsbot-turmoil-helper` | `MarsBotTurmoilHelper.ts` + spec. **Round 1 addressed (2026-08-03):** now a class holding game, turmoil and both players; `totalDelegates` and a no-op `as` cast deleted, `maybeUpdatePartyLeader` renamed, delegate log message generalised. **Round 4 addressed (2026-08-04):** log message to past tense. Pushed back on dropping `maybeUpdatePartyLeader`: `Party.checkPartyLeader` only promotes someone it finds in `game.playersInGenerationOrder`, and MarsBot is deliberately not there, so a bot holding 2 delegates to a human's 1 never took the lead without it. The spec had cast a real second player as MarsBot, which hid this, so it now builds the bot the way `AutomaGameSetup` does and a 14th test covers the leadership. **Round 5 addressed (2026-08-04):** the fix moved into `Party.checkPartyLeader` itself, which now also considers delegates that are not game players, so `maybeUpdatePartyLeader` is deleted; the ctor takes only `game` and reads the bot from the new `automaHooks` seam on IGame (`IAutomaGameHooks`, holding just the MarsBot player upstream); dropped an unnecessary `as PlayerId` cast. **Round 6 addressed (2026-08-06):** the seam is a `type AutomaGameHooks` (the fork's class of the same name replaces it in a later PR); game setup split into its own PR that this one sits on, so the spec builds a real automa game via `automaOption`; the Party fix took kberg's explicit shape, pushing `automaHooks?.marsBotPlayer` after NEUTRAL when it holds delegates | Automa types `IGame.automaHooks` as the full `AutomaGameHooks` class in place of the upstream type; automa's spec builds a real automa game instead of hand-building the player |
| [#8369](https://github.com/terraforming-mars/terraforming-mars/pull/8369) | `marsbot-game-setup` | Split out of #8211 round 6: `automaOption` in `GameOptions`, `AutomaGameSetup` creating the MarsBot player outside `game.players` (turmoil delegates seeded, no solo neutral tiles, `isSoloMode` false) and the deserialize path recreating it by id; 6 tests including a reload round trip that keeps a sent delegate | Automa's setup also builds the bot manager, decks and board; the upstream slice holds just the player. Automa's `Game.newInstance` also drops Mons Insurance from the corporation deck (rulebook A FAQ) |

## Design note: bonus card destruction (resolved 2026-06-20)

A bonus card is destroyed *during its own resolution*, when it sits in MarsBot's
action deck rather than any bonus-deck pile. So destruction only needs to mean
"do not file the card to discard" — then it is unreferenced and can never reshuffle.
No flag on the card, no destroyed-list on the deck. On the automa branch,
`MarsBotBonusResolver.resolve()` returns whether the card was destroyed and skips
the discard accordingly. The old `destroyedBonusCards` serialize/restore/milestone
plumbing was dead code (it scanned piles a destroyed card can never be in) and was
removed.

Since 2026-10-12 `MarsBot.destroyedBonusCards` is back as a plain counter, for Utopia
Planitia's Specialist milestone ("3 or more MarsBot bonus cards are destroyed").
`resolve()` increments it when a card is destroyed rather than shuffled back into the
bonus deck. Corp setup resolves (Philares) go through `resolveBonusCard` and don't
count. It is serialized like the other MarsBot counters.

## Shared engine files touched by the boards and rules batch (2026-10-12)

These ride along with whichever automa PR needs them:

- `boards/Board.ts`: MarsBot pays no placement-bonus costs (`computeAdditionalCosts`).
- `boards/TerraCimmeriaNovaBoard.ts`, `boards/VastitasBorealisNovaBoard.ts`: MarsBot can
  always use the MSL and Viking hexes.
- `Game.ts`: oxygen's temperature bonus with temperature maxed calls
  `automaHooks.handleUnresolvableTerraformingBonus` (Failed Action for MarsBot).
- `Player.ts`: generation 1 calls `automaHooks.handleActionPhaseStart` once preludes are
  done, so MarsBot's before-action-phase box resolves after them.
- `milestones/IMilestone.ts`, `Terraformer.ts`, `amazonisPlanitia/Minimalist.ts`: optional
  `remaining(player)` for MarsBot's "closest to meeting" milestone tiebreaker.
- Map milestones and awards (`RimSettler`, `Irrigator`/`Coastguard`, `Smith`, `Tradesman`,
  `LandSpecialist`, modular `Engineer`, `Farmer`, `Fundraiser`, `Planetologist`,
  `awards/modular/Founder`, `awards/Magnate`): `marsBotCanClaim` / `marsBotScore` with map
  rules keyed by `marsBotMapSet`.
- `deferredActions/RemoveResourcesFromCard.ts`: MarsBot's colony storage as a target (C-25).
- `colonies/Colony.ts`: `addColony` calls `automaHooks.handleColonyBuilt`, so the human's
  colonies trigger MarsBot's Poseidon.
- `Game.ts`: the Venus 8% card bonus calls `automaHooks.handleVenusCardBonus` first, so MarsBot
  gains 2 M€ instead of drawing a card.
- `client/components/GameEnd.vue`, `GameSetupDetail.vue`, `automa/MarsBotPanel.vue`,
  `create/CreateGameForm.vue`: the `automaColonyVP` labels read "Leftover resources" (fork-only
  client, but the end-game and setup-detail rows touch shared components).
- `SerializedGame.ts`, `game/GameOptions.ts`, `common/game/NewGameConfig.ts`,
  `routes/ApiCreateGame.ts`, `models/ServerModel.ts`, create-form files: new automa state and
  the `automaColonyVP` option (MarsBot's leftover shipping-board resources and Venus floaters score
  1/2 VP each) and the `automaFinalGreeneryNoCorpEffects` option (final greeneries skip MarsBot's
  corp cubes; `GameSetupDetail.vue` shows it too).
- `ma/MilestoneAwardSelector.ts`: random milestones and awards in an automa game draw only from
  the ones `AutomaGameSetup.supportsMilestone` / `supportsAward` accept: the six MarsBot maps'
  sets, Venus Next's, and the Milestones & Awards expansion's listed by name (not by the
  manifest's `random` flag, so new upstream ones are not dealt against MarsBot).
  `replaceUnsupportedAgainstMarsBot`, called from `Game.newInstance`, swaps the ones a map's own
  set holds for random ones from the same pool, drawn with the game's seeded random.
- `game/calculateVictoryPoints.ts`: Turmoil Points come first in `detailsCards`, matching
  MarsBot's end-game column (fork display choice, not needed upstream).

## Non-automa fixes to offer upstream

Each can go up as its own PR, independent of the MarsBot chain:

- Head Start (X43) re-enabled (2026-10-16), upstream as #8666 (2026-11-02). Upstream keeps it commented out of
  `PromoCardManifest.ts` since #5852 (kberg: "I'm not about to fix Head Start"). The fork keeps its count on
  the card (`HeadStart.data`), so prelude plays no longer eat its 2 actions. During them there is no Pass,
  End Turn or Undo, the corporation first action is the first of them, and an action is used up on its own
  only when the player has nothing to do. When Head Start is the last prelude the turn goes to the next
  player instead of falling into the action phase. Touches `Player.ts`, `IPlayer.ts`,
  `SerializedPlayer.ts`, `HeadStart.ts`, `PromoCardManifest.ts`, `HeadStart.spec.ts`.
- Upstream main does not compile (found 2026-11-04). #8663 (merged 2026-11-03) added nine files that import
  `IMarsBot` from `@/server/automa/MarsBotCorpTypes`, then #8646 (merged 2026-11-04) moved the type to
  `IMarsBot.ts` without a re-export, so `tsc` fails with TS2459 in `MarsBotMilestoneAwardEval.ts`,
  `Blacksmith`, `Visionary`, `Promoter`, `Traveller`, `Hoverlord`, `VSpacefarer`, `Engineer` and `Farmer`.
  The fix is those nine import paths. Automa imports `IMarsBot` from `IMarsBot.ts` and is not affected.
  Sent as #8674 the same day.

## Blocked (everything else)

All remaining modules import `MarsBot` directly: `MarsBotStock`, `MarsBotScoring`,
`MarsBotTurnResolver`, `MarsBotBonusResolver`, `AutomaGameHooks`, `AutomaGameSetup`,
colonies modules (`ColonyPlacer`, `Trader`, `ShippingBoard`, only as a type), the corp
registry/resolver and the Colonies corporations, and the client UI (needs `GameModel.marsBot`).
The other corporation manifests, the map boards and the expansion bonus cards only need
`IMarsBot`, so they went up as #8683 to #8688.

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
3. Standalone spec: no `MarsBot`, no `automa` option - construct directly or use a
   regular `testGame`.
4. Verify: eslint on the files, `npm run build:server`, `npm run build:test`, run the spec.
5. PR body: human tone, reference #8001, note independence/stacking.
6. When kberg requests changes: fix on the PR branch, then port the fix back to the
   automa branch (never merge automa into PR branches).
7. Update published PR branches by merging (`upstream/main` or the parent branch) and
   adding normal commits on top - no rebases, no force pushes.
