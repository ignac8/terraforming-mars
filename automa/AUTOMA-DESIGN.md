# Terraforming Mars: MarsBot (Automa) — Design & Implementation Document

## 1. Overview

MarsBot is an automated opponent for solo play. Instead of the standard solo mode (race to complete terraforming within a generation limit), the player competes head-to-head against MarsBot for victory points. MarsBot acts as a second player using a card-driven track system instead of playing actual project cards.

**Scope**: Base game on Tharsis map + Prelude/Prelude2 + Venus Next + Colonies + Turmoil expansions + 46 MarsBot corporation cards (Rulebook B). Other expansions (Ares, Moon, Pathfinders, CEOs, Star Wars, Underworld, Community Cards) are server-side gated off.

---

## 2. Automa Rules (Base Game, Tharsis, No Expansions)

### 2.1 Setup

- Set up as a **2-player game** (Corporate Era cards allowed).
- MarsBot gets a player color. Place its TR marker on 20.
- **MarsBot Board**: 7 tracks (positions 0–18), each mapped to card tags. Place a clear cube on position 0 of each track.
- **MarsBot Bonus Deck**: Cards B01–B08 shuffled facedown.
- **MarsBot Action Deck** (4 cards): Deal 3 project cards facedown from the project deck + shuffle in 1 bonus card from the bonus deck.
- MarsBot does NOT receive a corporation card (in base difficulty).
- **Neural Instance Tile**: Set aside for placement later.
- Human player is first player in generation 1.
- MarsBot does NOT pay for cards, milestones, or awards.

### 2.2 Player Order Phase (Gen 2+)

Alternate the first player between human and MarsBot each generation.

### 2.3 Research Phase (Gen 2+)

#### Without Drafting
- Draw 4 cards for the human. Human pays to keep as usual.
- Build MarsBot action deck: 3 project cards from project deck + 1 bonus card from bonus deck.
- If bonus deck is empty, shuffle bonus discard pile (excluding destroyed cards) to form new deck.

#### With Drafting
- Draw two piles of 4 cards.
- Human takes one pile, MarsBot gets the other.
- Alternate: human picks 1 card to keep, MarsBot gets 1 card at random from its pile.
- Swap piles. Repeat until both have kept 4 cards.
- Shuffle MarsBot's 4 drafted cards, discard 1 to project discard.
- Shuffle 1 bonus card into the remaining 3. These 4 cards = MarsBot's action deck.
- Human pays for kept cards as usual.

### 2.4 Action Phase

Alternate turns between human and MarsBot. Continue until both pass.

#### Human Turn
Take your turn as usual with these exceptions:
- **Remove resources from any player**: Remove from MarsBot's MC supply instead.
- **Steal resources**: Take from MarsBot's MC supply.
- **Decrease production**: Regress MarsBot's corresponding track:
  - Steel → Track 1 (Building)
  - Titanium → Track 2 (Space)
  - MC → Track 3 (Event)
  - Energy → Track 5 (Energy)
  - Heat → Track 6 (Earth)
  - Plants → Track 7 (Plant)
- MarsBot does NOT reactivate actions on regressed spaces. Place a player marker on the regressed-from space as a reminder; remove it when MarsBot re-advances to that space.
- **Count something for all players**: Use MarsBot's track position for the corresponding resource/tag type.

#### MarsBot Turn
If MarsBot has cards in its action deck, flip the top card and resolve:

**A. Resolving a Project Card:**
1. Ignore all abilities/effects/restrictions on the card.
2. For each tag on the card (left-to-right), advance the corresponding track's cube 1 space right.
   - Tag → Track mapping (from board data):
     - Building → Track 1
     - Space → Track 2
     - Event → Track 3
     - Science → Track 4
     - Energy, Jovian → Track 5
     - Earth, City → Track 6
     - Plant, Animal, Microbe → Track 7
3. If the cube lands on an action icon, perform that action immediately.
4. If the track is already at position 18 (end), take a **Failed Action** instead.
5. If the card has NO tags, take a **Failed Action**.
6. Place card in MarsBot's played pile.

**B. Resolving a Bonus Card:**
1. Resolve the effect on the card. If impossible, the card specifies what happens (usually nothing or MarsBot gains MC).
2. If the card has a lettered list, resolve the first applicable option and skip the rest.
3. Place in bonus discard pile.

**C. If MarsBot has no cards left:**
MarsBot passes.

### 2.5 Failed Action

MarsBot gains 5 MC. Triggers when:
- Project card has no tags.
- Track is at end and needs to advance.
- Track action cannot be completed (e.g., raise temperature when already maxed).
- Milestone action but 3 already claimed or MarsBot doesn't qualify.
- Award action but 3 already funded or MarsBot isn't ahead on any.
- Terraforming bonus action can't be taken.

### 2.6 MarsBot Board Track Actions

When the cube lands on an icon, perform the action immediately:

| Icon | Action |
|------|--------|
| **Advance (▶)** | Move cube 1 more space (may trigger another action) |
| **+Track N** | Advance that other track's cube 1 space (may trigger action) |
| **TR N** | Gain N terraform rating |
| **M (Milestone)** | Claim an unclaimed milestone MarsBot qualifies for (free). Tiebreakers: 1) one you also qualify for, 2) one you're closest to, 3) leftmost |
| **A (Award)** | Fund the award MarsBot is most ahead of you in (free). Tiebreaker: leftmost |
| **Temperature** | Raise temperature 1 step. Gain 1 TR. |
| **Greenery** | Place greenery tile + raise oxygen 1 step + gain 1 TR. Adjacent to own cities (max), away from your cities (min). Then standard tiebreakers. |
| **Ocean** | Place ocean on any ocean-reserved space. Standard tiebreakers. |
| **City** | Place city adjacent to most existing greenery. Standard city rules (not adjacent to other cities). Then standard tiebreakers. |

### 2.7 Tile Placement Rules

**Greenery**: Adjacent to as many MarsBot cities as possible, minimizing adjacency to human cities. Must follow normal greenery rules (next to own tiles when possible, not on reserved spaces).

**City**: Adjacent to as much existing greenery as possible. Standard city rules (not adjacent to other cities, not on reserved spaces).

**Tiebreakers** (after type-specific adjacency rules):
1. Adjacent to as many oceans as possible.
2. Cover the most placement bonus icons.
3. Random: Flip a card from the project deck, use its cost to count through tied spaces (top-left, going right, then down). Place on the final space. Discard the flipped card.

**Placement Bonuses**:
- Adjacent to ocean: MarsBot gains 2 MC per adjacent ocean.
- Covers bonus icons: MarsBot gains 1 MC per icon covered (not the actual printed reward).

**Terraforming Bonuses**:
- Temperature at -24°C or -20°C (heat bonus): MarsBot gains 2 MC instead.
- Temperature/oxygen reaching a bonus step that grants another terraforming action: resolve it immediately (Failed Action if can't).
- All terraforming raises grant TR as normal.

### 2.8 Milestones & Awards (Tharsis)

**Milestone Requirements for MarsBot:**
| Milestone | MarsBot Criteria |
|-----------|-----------------|
| Terraformer | Reached 35 TR |
| Mayor | Owns 3+ cities |
| Gardener | Owns 3+ greenery tiles |
| Builder | Reached space 8 on Track 1 |
| Planner | Reached space 4 on every track |

**Award Evaluation for MarsBot:**
| Award | MarsBot Value |
|-------|--------------|
| Landlord | Tiles owned on board |
| Banker | Track 1 position + Track 3 position |
| Scientist | Track 4 position |
| Thermalist | Track 5 position + 5 |
| Miner | Track 2 position + 5 |

When comparing awards for resources (Thermalist, Miner), MarsBot considers your current resources + your production.

### 2.9 Production Phase

Human produces as normal. MarsBot skips production entirely.

### 2.10 Bonus Cards (B01–B08)

| Card | Name | Effect |
|------|------|--------|
| B01 | Meteor Shower | Human must lose 5 plants (or as many as possible). If lost ≥3 or effect blocked removal, destroy this card. |
| B02 | Invasive Species | Human must remove highest-scoring animal/microbe from a card. MarsBot gains 5 MC regardless. |
| B03 | Research and Development | MarsBot draws 1 project card and resolves it immediately. |
| B04 | Overachievement | MarsBot claims a milestone if able. If fails AND gen ≥6, funds an award. If either succeeded, destroy card. Otherwise gain 5 MC. |
| B05 | Expedited Construction | Place city adjacent to ≥2 greenery/ocean mix. If placed, destroy card. Normal city rules apply. |
| B06 | Lobbyists | First applicable: (a) Temp 1-2 steps from bonus/completion → raise temp 2, destroy. (b) Oxygen 1-2 from bonus/completion → place greenery + raise oxygen twice, destroy. (c) Ocean space adjacent to 2+ oceans → place ocean, destroy. (d) Advance furthest-from-completion parameter (tie: oxygen > ocean > temp). |
| B07 | Local Neural Instance | Place Neural Instance tile adjacent to no tiles, not on edge, not on/adjacent to reserved spaces. If can't, draw and resolve a project card. Destroy this card. |
| B08 | Corporate Competition | If MarsBot has ≥5 MC, help position on closest funded award via helper actions: Landlord→place greenery, Banker→advance Track 1 or 3 (least advanced), Scientist→advance Track 4, Thermalist→advance Track 5, Miner→advance Track 2. Costs 5 MC if successful, discard. If no action possible, draw another bonus card and resolve, discarding both. |

### 2.11 Game End

- **Round 20**: MarsBot instantly wins (human loses).
- **Terraforming complete**: Finish the round. Both players may place final greenery tiles in turn order.
  - MarsBot places final greenery for each track where the next space ahead has a greenery action. Advance the tracker and perform the greenery action.
- Score with these MarsBot exceptions:
  1. Awards: Use MarsBot's track-based evaluation (section 2.8).
  2. MarsBot does NOT gain VP from played cards.
  3. Neural Instance tile: MarsBot gains 1 VP per adjacent space not occupied by human (empty or MarsBot-owned).
  4. MC → VP: Based on generation game ended:

| Generation | VP per MC |
|-----------|-----------|
| ≤12 | 1 VP per 8 MC |
| 13 | 1 VP per 7 MC |
| 14 | 1 VP per 6 MC |
| 15 | 1 VP per 5 MC |
| 16 | 1 VP per 4 MC |
| 17 | 1 VP per 3 MC |
| 18 | 1 VP per 2 MC |
| 19 | 1 VP per 1 MC |
| 20 | MarsBot wins! |

Tie = MarsBot wins.

### 2.12 Difficulty Levels

**Easy:**
- Ignore Advance (▶) actions on tracks.
- Failed Actions give 3 MC instead of 5.
- MarsBot's award values reduced by 5 each.

**Normal:** Default rules.

**Hard:**
- MarsBot gains 1 VP for each card in played pile with non-negative VP icon.
- On MarsBot's first turn each gen, if it has 8 MC and meets milestone conditions (3+ milestones if none claimed, 2+ if one claimed, any if two claimed), claim and lose 8 MC.

**Brutal:**
- Both Hard rules.
- MarsBot starts with 4 project cards (not 3) and keeps all 4 during Research Phase.

---

## 3. Architecture Design

### 3.1 Core Concept

MarsBot uses a real `Player` instance for game engine compatibility (tile ownership, TR tracking) but is managed externally by the `MarsBot` class. Game.ts integrates via a single `AutomaGameHooks` object that handles all automa-specific lifecycle hooks with minimal footprint in base classes.

Key design decisions:
- MarsBot's Player has `MarsBotTags` override so opponent tag queries return track positions
- MarsBot is NOT in `game.players` array — turn alternation handled by `AutomaGameHooks.getNextPlayer()`
- `isSoloMode()` returns false for automa (behaves as 2-player game)
- Placement bonuses from game engine are blocked for MarsBot (gets MC via `turnResolver.mcSupply` instead)
- Temperature heat bonuses at -24°C/-20°C intercepted to give MarsBot 2 MC instead of heat production
- Venus track actions ignored without Failed Action when Venus expansion not enabled
- `AwardScorer` includes MarsBot's track-based values for proper award comparison

### 3.2 Actual File Structure

```
src/server/automa/
├── AutomaGameHooks.ts      # Single contact point between Game.ts and automa logic
├── AutomaGameSetup.ts      # Game setup: creates MarsBot, wires hooks, registers corps
├── MarsBot.ts              # Main manager: board, decks, turns, scoring, model, serialization
├── MarsBotBoard.ts         # 7-track board with positions and tag-to-track mapping
├── MarsBotBonusCard.ts     # Bonus card definitions (B01-B08, B22-B32 corp cards)
├── MarsBotBonusDeck.ts     # Bonus deck: draw, discard, destroy, reshuffle
├── MarsBotBonusResolver.ts # All bonus card effects (B01-B08 + B22-B32)
├── MarsBotTurnResolver.ts  # Project card resolution, track actions, milestones, awards
├── MarsBotTilePlacer.ts    # Tile placement with automa tiebreakers
├── MarsBotScoring.ts       # End-game VP: TR + milestones + awards + tiles + NI + MC→VP + corpVP
├── MarsBotTags.ts          # Override tag counting to use track positions
├── MarsBotStock.ts         # Override stock/production: resource getters → mcSupply, removal → MC deduction, production → track regression
├── boards/
│   └── TharsisMarsBot.ts   # Tharsis track layouts and milestone/award data
└── corps/
    ├── MarsBotCorpRegistry.ts   # Map-based registry for all corps
    ├── MarsBotCorpResolver.ts   # Corp selection, setup, cube triggers, per-gen effects
    ├── MarsBotDraftResolver.ts  # Draft card picking with 4 priority types
    ├── BaseGameCorps.ts         # C01-C12 (12 base game corps)
    └── ExpansionCorps.ts        # C13-C46 (34 expansion corps)

src/common/automa/
├── AutomaTypes.ts          # Shared types, constants, MC→VP table, getMcPerVP()
├── MarsBotCorpTypes.ts     # Corp interface, context, effects, cube types
└── MarsBotModel.ts         # Client model (tracks with layout, MC, VP, corp, globalParamSteps)

src/client/components/automa/
└── MarsBotPanel.vue        # In-game display (tracks with action icons, MC, VP, corp effect, MC/VP ratio)
```

### 3.3 Integration Points (via AutomaGameHooks)

Game.ts has `automaHooks?: AutomaGameHooks` with thin `this.automaHooks?.method()` calls at each hook point. When undefined, all hooks are no-ops via optional chaining.

| Hook site in Game.ts | AutomaGameHooks method | Purpose |
|---|---|---|
| `isSoloMode()` | returns false | Automa is NOT solo mode |
| `lastSoloGeneration()` | returns 20 | MarsBot instant win at gen 20 |
| `gameIsOver()` | `isGameOver()` | Gen 20 or Mars terraformed |
| `allMilestonesClaimed/allAwardsFunded` | (inline check) | Not disabled for automa |
| `gotoResearchPhase()` | `handleResearchPhase()` | Build action deck, alternate first player |
| `playerIsFinishedWithResearchPhase` | `getFirstPlayerForActionPhase()` | Start with MarsBot if goesFirst |
| `playerIsFinishedTakingActions()` | `getNextPlayer()` | Turn alternation |
| `startActionsForPlayer()` | `handleStartActions()` | Auto-resolve MarsBot turn |
| `gotoProductionPhase()` | `handleProductionPhase()` | Skip production for MarsBot |
| `takeNextFinalGreeneryAction()` | `handleFinalGreenery()` | MarsBot final greenery |
| `increaseTemperature()` | `handleTemperatureHeatBonus()` | 2 MC instead of heat prod |
| `addTile()` | `shouldGrantPlacementBonuses()` | Block normal bonuses for MarsBot |
| `allPlayersHavePassed()` | `allPlayersHavePassed()` | Include MarsBot |
| `getPassedPlayers()` | `getPassedPlayerColor()` | Resolve MarsBot color |

| `addTile()` | `handleTilePlaced()` | Corp effect: onTilePlaced |
| `increaseVenusScaleLevel()` | `handleVenusRaised()` | Corp effect: onVenusRaised |
| `increaseTemperature/Oxygen` | `handleGlobalParameterRaised()` | Corp effect: onGlobalParameterRaised |
| `updatePlayerVPForTheGeneration()` | `updateVPForGeneration()` | Track MarsBot VP per gen for chart |

Player.ts integration:
- Line 926: `this.game.automaHooks?.handleHumanCardPlayed(card)` — Corp effect: onHumanCardPlayed
- Line 1653: `game.automaHooks.allOtherPlayersHavePassed()` — Turn interleaving fix

Other integration:
- `AwardScorer` constructor includes MarsBot track-based scores
- `calculateVictoryPoints.giveAwards()` includes MarsBot player in comparison
- `ServerModel.getMilestones/getAwards()` includes MarsBot scores
- `MarsBotTags` overrides `rawCount()` on MarsBot's Player for opponent tag queries
- `MarsBotStock` overrides resource getters to report mcSupply, overrides `has()`/`canAdjust()`

### 3.4 MarsBot Turn Resolution Flow

```
MarsBot.takeTurn():
  if actionDeck is empty → pass, signal game
  card = actionDeck.shift()
  if ProjectCard → turnResolver.resolveProjectCard(card)
  if BonusCard → bonusResolver.resolve(card)
  if hard/brutal → hardModeFirstTurnMilestone()
  game.playerIsFinishedTakingActions()

MarsBotTurnResolver.resolveProjectCard(card):
  tags = [...card.tags]
  if card.type === EVENT → tags.push(Tag.EVENT)  // inject Event tag
  if tags empty → failedAction()
  for each tag:
    if WILD → skip
    trackIndex = board.getTrackIndexForTag(tag)
    if undefined → skip (unmapped, e.g. Venus tag)
    advanceTrack(trackIndex)
  card → project discard pile

advanceTrack(trackIndex):
  if position >= 18 → failedAction()
  position++
  if regressed marker on this position → clear marker, skip action
  action = layout[position]
  if action → resolveTrackAction(action, trackIndex)

resolveTrackAction(action):
  "advance"      → advanceTrack(same) [ignored in Easy mode]
  "tag_N"        → advanceTrack(N-1)
  "trN"          → increaseTerraformRating(N) [N=1..8]
  "milestone"    → tryClaimMilestone() [tiebreakers: human qualifies > human closest > leftmost]
  "award"        → tryFundAward() [must be ahead, leftmost tiebreak]
  "temperature"  → raiseTemperature(1) [fails if maxed]
  "temperature2" → raiseTemperature(2)
  "greenery"     → placeGreenery() [+oxygen +TR, adjacency rules, MC bonuses]
  "ocean"        → placeOcean() [+TR, MC bonuses]
  "city"         → placeCity() [adjacency rules, MC bonuses]
  "venus"        → if Venus expansion enabled: raiseVenus(1); else: IGNORE (no Failed Action)
  "venus2"       → if Venus expansion enabled: raiseVenus(2); else: IGNORE
```

### 3.5 MarsBot State

```typescript
interface MarsBotState {
  trackPositions: [number, number, number, number, number, number, number]; // 7 tracks, 0-18
  trackRegressed: [Set<number>, ...]; // positions with regression markers per track
  mcSupply: number;
  actionDeck: Array<IProjectCard | MarsBotBonusCard>;
  bonusDeck: Array<MarsBotBonusCard>;
  bonusDiscard: Array<MarsBotBonusCard>;
  destroyedBonusCards: Array<MarsBotBonusCard>;
  playedCards: Array<IProjectCard>; // for scoring in Hard mode
  neuralInstancePlaced: boolean;
  neuralInstanceSpace: Space | null;
  difficulty: 'easy' | 'normal' | 'hard' | 'brutal';
}
```

---

## 4. Implementation Plan

### Phase 1: Foundation
1. Create `src/common/automa/AutomaTypes.ts` — shared types.
2. Create `src/server/automa/MarsBotBoard.ts` — track data structure, load from JSON.
3. Create `src/server/automa/boards/TharsisMarsBot.ts` — Tharsis track layout.
4. Create `src/server/automa/MarsBotBonusCard.ts` — B01-B08 definitions.
5. Create `src/server/automa/MarsBotBonusDeck.ts` — deck management.

### Phase 2: MarsBot Player
6. Create `src/server/automa/MarsBot.ts` — player class with track state, MC supply.
7. Implement `takeMarsAction()` — flip card, resolve tags → tracks → actions.
8. Implement `advanceTrack()` with action resolution.
9. Implement `failedAction()` — gain 5 MC.
10. Handle tag-to-track mapping.

### Phase 3: Track Actions
11. Implement TR gain action.
12. Implement milestone claiming with MarsBot-specific criteria and tiebreakers.
13. Implement award funding with MarsBot-specific evaluation.
14. Implement `MarsBotTilePlacer.ts` — greenery/city/ocean placement with automa tiebreakers.
15. Implement temperature/oxygen raising with bonus step handling.

### Phase 4: Game Integration
16. Add automa option to `GameOptions`.
17. Modify `GameSetup.ts` — create MarsBot player, deal initial cards, set up board.
18. Modify `Game.ts` — handle MarsBot turns (auto-resolve instead of waiting for input).
19. Implement Research Phase for MarsBot (deck building).
20. Skip production for MarsBot.
21. Handle human effects on MarsBot (remove/steal/decrease production → track regression).

### Phase 5: Bonus Cards
22. Implement B01 (Meteor Shower) — force human plant loss.
23. Implement B02 (Invasive Species) — force human resource removal.
24. Implement B03 (Research and Development) — draw and resolve extra card.
25. Implement B04 (Overachievement) — milestone/award with destruction.
26. Implement B05 (Expedited Construction) — conditional city placement.
27. Implement B06 (Lobbyists) — conditional terraforming.
28. Implement B07 (Local Neural Instance) — special tile placement.
29. Implement B08 (Corporate Competition) — award helper actions.

### Phase 6: Game End & Scoring
30. Implement generation 20 = instant loss.
31. Implement MarsBot final greenery placement (tracks with greenery as next action).
32. Implement MarsBot scoring: TR + milestones + awards (track-based) + tiles + Neural Instance + MC→VP.
33. Compare scores (tie = MarsBot wins).

### Phase 7: Difficulty
34. Implement Easy mode (ignore advance, 3 MC failed action, -5 award values).
35. Implement Hard mode (card VP, aggressive milestones).
36. Implement Brutal mode (4 starting cards, keep all during research).

### Phase 8: Client UI
37. Add automa game creation option to the UI.
38. Display MarsBot's track board in the game view.
39. Show MarsBot's action deck resolution (card flip animation / log).
40. Show MarsBot's MC supply and Neural Instance tile.

---

## 5. Test Coverage (7703 tests total, 808 automa-specific)

### Test Files
| File | Tests | Coverage |
|------|-------|---------|
| MarsBotBoard.spec.ts | 15 | Track state, tag mapping, advance/regress/peek |
| MarsBotBonusDeck.spec.ts | 5 | Draw, discard, destroy, reshuffle |
| MarsBotTurnResolver.spec.ts | 34 | All tag types, event injection, track actions (TR1-8, advance, tag_N, milestone, award, temp, ocean, greenery, city), failed actions, award/milestone evaluation |
| MarsBotTilePlacer.spec.ts | 10 | Space finding, adjacency, bonus MC |
| MarsBotScoring.spec.ts | 27 | TR, milestones, greenery, city adjacency, MC→VP all generations, Neural Instance |
| MarsBotTags.spec.ts | 22 | All tag→track mappings, shared tracks, countAllTags, opponent queries |
| MarsBot.spec.ts | 19 | Setup, deck building, passing, regression, production skip, game end |
| MarsBotFixes.spec.ts | 32 | isSoloMode, placement bonuses blocked, heat bonus MC, difficulty levels, event tags, chain actions |
| MarsBotDraft.spec.ts | 12 | Drafting variant: 4-round pile swap, card counts, MarsBot deck building from draft |
| MarsBotLimitations.spec.ts | 16 | Award resources+production comparison, hard mode card VP, serialization/deserialization |
| MarsBotResourceInteraction.spec.ts | 17 | Remove/Steal from MC supply, production decrease → track regression, resource addition ignored |
| MarsBotGameEnd.spec.ts | 22 | VP breakdown model, instantWin, award VP |
| MarsBotIntegration.spec.ts | 25 | Player identity, getPassedPlayers, award/milestone funding, tag counting scenarios |
| MarsBotAwardCrash.spec.ts | 13 | calculateVictoryPoints crash fix, AwardScorer with MarsBot |
| MarsBotRulesCompliance.spec.ts | 27 | Track action placement, failed actions, B01/B04/B08, final greenery, hard mode, production skip |
| MarsBotRulesDeep.spec.ts | 25 | Venus ignored, oxygen→temp chain, multi-tag partial fail, B02/B06, no-pay milestones/awards, destroyed cards, leftmost tiebreaker, event injection, MC→VP examples |
| MarsBotGameCreation.spec.ts | 14 | Automa game creation, expansion gating, prelude support |
| MarsBotPrelude.spec.ts | 21 | Prelude rules: gen 18, extra cards, wild tags, MC→VP table |
| BaseGameCorps.spec.ts | 24 | All 12 base game corp effects, cubes, per-gen |
| ExpansionCorps.spec.ts | 35 | All 34 expansion corp effects |
| CorpBonusCards.spec.ts | 14 | Corp-specific bonus cards B22-B32 |
| CorpEffectHooks.spec.ts | 22 | Corp effect hooks: tile placed, human card, venus, global param |
| MarsBotCorpResolver.spec.ts | 15 | Corp selection, setup, cube triggers |
| MarsBotDraftResolver.spec.ts | 15 | Draft priorities: tags, mostExpensive, leastAdvancedTrack, mostTags |
| MarsBotSessionFixes.spec.ts | 15 | Tile ownership, resource stealing, turn interleaving, VP tracking, serialization |

### Key Rules Verified
- Event cards inject Event tag (page 5) ✓
- Venus actions ignored without Failed Action when expansion off (page 8) ✓
- Temperature heat bonuses give MarsBot 2 MC (page 9) ✓
- Oxygen at 8 triggers temperature chain (page 9) ✓
- Placement bonuses: 1 MC/icon + 2 MC/ocean (page 9) ✓
- MarsBot doesn't pay for milestones/awards (page 8) ✓
- Milestone tiebreakers 1-3 (page 8) ✓
- All 5 Tharsis award formulas (page 8-9) ✓
- All 5 Tharsis milestone criteria (page 8) ✓
- MC→VP for all generation brackets (page 10) ✓
- Tie = MarsBot wins (page 10) ✓
- Generation 20 instant loss (page 10) ✓
- Final greenery from tracks (page 10) ✓
- B01-B08 core effects (pages 6-7) ✓
- Easy/Hard/Brutal difficulty modifiers (page 11) ✓
- Destroyed bonus cards never return (page 6) ✓

### Known Limitations
- Venus Next, Colonies, and Turmoil expansion-dependent features are now fully implemented (Tharsis only for Colonies' 2nd Trade Fleet)
- Only Tharsis map supported (other official maps need MarsBot board data: track layouts, milestone criteria, award formulas)
- Fan-made expansions (Ares, Community, Pathfinders, CEOs, Star Wars, Underworld, The Moon) will NOT be supported
- Corp card data from NamuWiki may have inaccuracies — needs verification against physical cards

### Implemented Rules
All rules from Rulebook A (base game) and Rulebook B (corporations) are implemented:
- Drafting variant with pile-swapping protocol (page 4)
- Remove/Steal resources from MarsBot → deducts from mcSupply (via `MarsBotStock` override)
- Decrease production on MarsBot → regresses corresponding track (via `MarsBotProduction` override)
- MarsBot is in human's opponents list so cards targeting opponents can see MarsBot
- Award comparison for Thermalist/Miner uses human resources + production (page 8)
- Hard mode card VP tracked via `playedProjectCards` array
- Serialization/deserialization of MarsBot state (track positions, MC, decks, etc.)
- Venus track actions ignored without Failed Action when expansion off (page 8)
- Temperature heat bonuses give 2 MC instead of heat production (page 9)
- Event cards inject Event tag (page 5)
- All base files access automa only through `automaHooks` methods (no direct `marsBot` access)

---

## 6. Key Codebase References

| Component | File | Key Methods |
|-----------|------|-------------|
| **Automa hooks** | `src/server/automa/AutomaGameHooks.ts` | All lifecycle hooks into Game.ts |
| **Automa setup** | `src/server/automa/AutomaGameSetup.ts` | `setup()`, creates MarsBot + hooks |
| **MarsBot manager** | `src/server/automa/MarsBot.ts` | `takeTurn()`, `buildResearchActionDeck()`, `toModel()` |
| **Turn resolver** | `src/server/automa/MarsBotTurnResolver.ts` | `resolveProjectCard()`, `advanceTrackPublic()`, `getMarsBotAwardValue()`, `marsBotMeetsMilestone()` |
| **Bonus resolver** | `src/server/automa/MarsBotBonusResolver.ts` | `resolve()` for B01-B08 |
| **Tile placer** | `src/server/automa/MarsBotTilePlacer.ts` | `findGreenerySpace()`, `findCitySpace()`, `findOceanSpace()`, `getTotalPlacementMC()` |
| **Tag override** | `src/server/automa/MarsBotTags.ts` | `rawCount()` returns track positions |
| **Scoring** | `src/server/automa/MarsBotScoring.ts` | `calculate()` → `MarsBotVPBreakdown` |
| **Board data** | `src/server/automa/boards/TharsisMarsBot.ts` | Track layouts, award formulas, milestone criteria |
| Game flow | `src/server/Game.ts` | `automaHooks?.` at ~15 hook points |
| Award scoring | `src/server/awards/AwardScorer.ts` | Includes MarsBot track values |
| VP calculation | `src/server/game/calculateVictoryPoints.ts` | Includes MarsBot in award comparison |
| Tile types | `src/common/TileType.ts` | `NEURAL_INSTANCE = 44` |
| Game options | `src/server/game/GameOptions.ts` | `automaOption`, `automaDifficulty` |
| **Corp registry** | `src/server/automa/corps/MarsBotCorpRegistry.ts` | `registerMarsBotCorp()`, `getMarsBotCorp()`, `getAllMarsBotCorps()` |
| **Corp resolver** | `src/server/automa/corps/MarsBotCorpResolver.ts` | `selectCorp()`, `setupCorp()`, `onTrackAdvanced()`, `resolvePerGenEffect()` |
| **Draft resolver** | `src/server/automa/corps/MarsBotDraftResolver.ts` | `pickCardForMarsBot()` with 4 priority types |
| **Base game corps** | `src/server/automa/corps/BaseGameCorps.ts` | C01-C12: Credicor, Eco Line, Helion, etc. |
| **Expansion corps** | `src/server/automa/corps/ExpansionCorps.ts` | C13-C46: Prelude, Venus, Colonies, Turmoil corps |
| **Corp types** | `src/common/automa/MarsBotCorpTypes.ts` | `IMarsBotCorp`, `MarsBotCorpContext`, `MarsBotCorpEffect` |

---

## 7. Rulebook B — Corporations (46 Corps)

### 7.1 Overview

MarsBot can play with a corporation card (optional, toggle `automaCorpOption` in game setup). Each corporation modifies MarsBot's behavior through one or more of: starting tags, draft priority, setup effects, per-generation effects, track cubes (white/black/credit), and triggered effects.

### 7.2 Corporation Framework

- **IMarsBotCorp**: Interface with id, name, description, startingTags, draftPriority, setup, effect, perGeneration, trackCubes, associatedBonusCards
- **MarsBotCorpContext**: Cached context with 20+ operations (advanceTrack, gainMc, placeOcean/City/Greenery, drawAndResolveProjectCard, raiseTR, etc.)
- **MarsBotCorpEffect**: Hooks for onTrackCubeTrigger, onProjectCardResolved, onHumanCardPlayed, onTilePlaced, onVenusRaised, onGlobalParameterRaised, onMcGained, vpBonus
- **Draft priority types**: tags (standard), mostExpensive (Credicor), leastAdvancedTrack (Aridor), mostTags (Spire)

### 7.3 Track Cubes

Corporations place cubes on specific track positions during setup:
- **White cubes**: Replace the normal track action. When MarsBot advances to this position, the corp's `onTrackCubeTrigger` fires instead.
- **Black cubes**: Add an additional effect. The normal track action still fires, AND the cube trigger fires.
- **Credit cubes**: MarsBot gains MC when advancing to this position.

Some corps use `whiteTrackCubes(trackNum)` to replace ALL 18 positions on a track with white cubes.

### 7.4 Corp Bonus Cards (B22-B32)

Corps may add associated bonus cards to the bonus deck or action deck:
- B22 Settlers, B23 Rapid Sprouting, B24 Supply & Demand, B25 Do It Right
- B26 Venusian Lobby, B27 Build Build Build, B28 Diversification
- B29 Gray Eminence, B30 Interface Hyperlink, B31 Government Subsidy, B32 Investors

### 7.5 All 46 Corporations

**Base Game (C01-C12)**: Credicor, Eco Line, Helion, IC, Inventrix, Mining Guild, Phobolog, Saturn Systems, Teractor, Tharsis Republic, Thorgate, UNMI

**Prelude (C13-C17)**: Cheung Shing, Point Luna, Robinson Industries, Valley Trust, Vitor

**Prelude 2 (C18-C19, C40-C46)**: Acadian Community, Astrodrill, Ecotec, Kuiper Cooperative, Nirgal Enterprises, Paladin Shipping, Sagitta, Spire, Tyco Magnetics

**Promo (C20-C24)**: Factorum, Pharmacy Union, Philares, Recyclone, Splice

**Venus (C25-C28, C34)**: Viron, Celestic, Morningstar, Aphrodite, Stormcraft

**Colonies (C30-C33)**: Aridor, Arclight, Polyphemos, Poseidon

**Turmoil (C35-C39)**: Lakefront Resorts, Pristar, Septem Tribus, Terralabs, Utopia Invest

---

## 8. Rulebook C — Expansion Rules

### 8.1 Prelude / Prelude 2

- Max generation reduced from 20 to 18
- Human draws 5 prelude cards (not 4), keeps 2
- MarsBot gets 3 extra project cards at start (shuffled into first action deck)
- Wild tags on cards advance the least-advanced track
- Recession prelude card is filtered out
- MC-to-VP table shifted (conversion window starts at gen 10 instead of 12)

### 8.2 Expansion Gating (sanitizeGameOptions)

Unsupported expansions are force-disabled on the server:
- Venus Next, Colonies, Turmoil, Ares, Moon, Pathfinders, CEOs, Star Wars, Underworld, Community Cards
- Board forced to Tharsis
- "All" button in game creation enables only compatible expansions (Corporate Era, Prelude, Prelude 2, Promos)

### 8.3 Venus Track Actions

Venus actions on the MarsBot board (`venus`, `venus2`) are silently ignored when Venus expansion is not enabled — they do NOT trigger a Failed Action.

---

## 9. Session Fixes (2026-03-27)

### 9.1 Tile Ownership Bug
**Problem**: `Game.addTile()` cleared `space.player` to `undefined` when `shouldGrantPlacementBonuses()` returned false (for MarsBot). This meant MarsBot's cities/greeneries had no owner — they didn't show the bronze cube on the map and weren't counted for Mayor/Gardener/Landlord.
**Fix**: Only clear `space.player` during SOLAR phase (world government greeneries). MarsBot tiles skip bonuses but keep ownership.

### 9.2 Resource Stealing Bug (Hired Raiders etc.)
**Problem**: Cards like Hired Raiders check `target.steel > 0` before offering steal options. MarsBot's resource fields were always 0 (resources tracked in `mcSupply`). So MarsBot was never shown as a steal target.
**Fix**: `MarsBotStock.setMarsBot()` uses `Object.defineProperty` to override all 6 resource getters to report `mcSupply`. Also added `has()` and `canAdjust()` overrides for correct affordability checks.

### 9.3 Turn Interleaving Bug
**Problem**: Human could take unlimited actions without MarsBot interleaving. `allOtherPlayersHavePassed()` checked `game.players` which doesn't include MarsBot, so with 1 human player it always returned `true`, bypassing the 2-action limit.
**Fix**: `allOtherPlayersHavePassed()` in Player.ts now delegates to `automaHooks.allOtherPlayersHavePassed()` which checks MarsBot's pass state.

### 9.4 VP Display
- Added `currentVP` to MarsBot model (live VP during game)
- Added `mcPerVP` and `mcVP` to model (MC-to-VP ratio and resulting VP)
- Added `vpByGeneration` tracking (for end-game VP chart)
- Added `globalParameterSteps` to model (for end-game contributions table)
- MarsBot appears in VP chart, global parameter contributions, and VP details at game end
- Fixed bronze color in VictoryPointChart.vue (was empty string → invisible line)

### 9.5 Corporation Display
- Added `description` field to all 46 corps (human-readable effect text)
- Corp description shown in MarsBotPanel during game
- Corp name shown in GameEnd VP table
- Track action layout sent to client — each square shows action icon with tooltip

### 9.6 Award 2nd Place Fix
No 2nd place VP in 2-player automa games (same as standard 2-player TM rules). Only 1st place (5 VP) or 0. Fixed in both `calculateVictoryPoints.ts` and `MarsBotScoring.ts`.

### 9.7 VP Display Improvements
- VP breakdown always sent (not just at game end) so panel shows live source breakdown
- "MarsBot wins!" banner shown at generation limit instead of misleading VP drop
- Track log changed from "Track N → pos" to "Track N to pos" to avoid arrow confusion
- MC/VP line hidden when no conversion applies
- Corporate Era not forced on (optional per rules page 3)

### 9.8 UI Improvements
- MarsBotPanel font sizes scaled up 2-4px across the board (was undersized vs game UI)
- Track squares enlarged from 14x14 to 18x18
- Milestone/award MarsBot rules moved below item lists (were above)
- "All" expansion button works for automa (enables compatible expansions only)

---

## 10. Implementation Status

### Fully Implemented
- [x] Base game rules (Rulebook A)
- [x] All 8 bonus cards (B01-B08)
- [x] All 4 difficulty levels (Easy/Normal/Hard/Brutal)
- [x] Drafting variant
- [x] Prelude / Prelude 2 support
- [x] Corporation framework (Rulebook B) — all 46 corps
- [x] Corp bonus cards (B22-B32)
- [x] Corp draft priority (4 types)
- [x] Corp cube system (white/black/credit)
- [x] Turn interleaving (human 2 actions → MarsBot 1 card → repeat)
- [x] Tile ownership display (bronze cubes on map)
- [x] Resource stealing/removal from MarsBot
- [x] VP tracking per generation (chart)
- [x] Global parameter contributions display
- [x] MC-to-VP ratio display
- [x] Track action layout display with tooltips
- [x] Corp effect descriptions
- [x] Serialization/deserialization of all state
- [x] Milestone/award evaluation registry for all maps + modular MA expansion
- [x] Corporate Competition helper actions for all awards (pages 12 + 16)
- [x] Briber milestone MC deduction on claim
- [x] Pioneer4/Constructor colony cubes on tracks
- [x] Terraformer29 filtered from automa games
- [x] Temperature raise tracking (for Thawer milestone)
- [x] i18n support for all player-visible text
- [x] 7700+ tests
- [x] Venus Next — full expansion support (board, floater track action, milestones/awards/scoring, Government Intervention card)
- [x] Colonies — full expansion support (Tharsis only): MarsBot Shipping Board with 11 storage areas, colony placement (B17 Expedited Construction Colonies, B18 Outer System Foothold), trading (B19 Shipping Lines, B20 Extended Shipping Lines), 2nd Trade Fleet unlock at credits-track position 9, player-trade colony bonus hook, Europa special handling (ocean tile / TR / MC), Pluto card-resource handling, Aridor/Poseidon corp ongoing effects, Pioneer/Constructor cube colony-build trigger
- [x] Turmoil — full expansion support: 7 delegates in reserve, MarsBot starts at 10 TR (or 13 with extra-difficulty), Party Politics (B21) with 6-tier narrowing priority and divisible-by-3 second-delegate trigger, Gray Eminence (B29) using same delegate priority, Election/Revolution global events solo-resolution for automa, Chairman gives MarsBot +1 TR, no Lobby placement, 1 VP per Party Leader / Chairman owned, Septem Tribus replaces Party Politics with Gray Eminence in deck
- [x] Milestones & Awards expansion — all modular milestones/awards have MarsBot eval functions (Rulebook C pages 13-16)

### Not Yet Implemented (Official Expansions Only)
- [ ] Other official maps — Hellas, Elysium, Utopia Planitia, Terra Cimmeria, Vastitas Borealis (milestone/award evals done, but track layouts still needed from physical boards). Note: 2nd Trade Fleet for Vastitas Borealis must use the Energy track (currently uses Event/credits track for Tharsis)
- [ ] Turmoil difficulty option T-15 fully wired into UI (the GameOption exists; UI selector control may need a final visual pass)
- [ ] Promos — Some promo cards may need special MarsBot interaction handling
- [ ] Physical card verification — Corp effects from NamuWiki need verification against physical Automa expansion cards

---

## 11. Data Verification Note

Corporation card data was extracted from NamuWiki (Korean wiki). This data may not be 100% accurate — effects should be verified against physical Automa expansion cards when available. The NamuWiki PDF is stored at `automa/Terraforming Mars_Automa - NamuWiki.pdf` for reference.

---

## 12. Upstream Merge Integration (2026-05-17)

Merged `upstream/main` (Delta Project expansion #7962 + the new game-name feature) into `automa`. Three conflicts, all resolved as combine-both:

### 12.1 Game options sanitize guard (`Game.ts`)
Upstream's side was whitespace-only; kept the automa guard `if (gameOptions.automaOption) { AutomaGameSetup.sanitizeGameOptions(gameOptions); }`. No behavior change.

### 12.2 Game constructor gains `name` (`Game.ts`)
Upstream added a required `name` parameter as the **2nd** constructor argument (`new Game(id, name, players, …)`), with deserialize falling back to `d.name ?? generateGameName(UnseededRandom.INSTANCE)` for old saves (upstream TODO: remove fallback by 2026-07-01). The automa deserialize path was combined to pass **both** the new `name` and the automa `marsBotPlayer` (last, optional) arguments. Constructor signature is now `(id, name, players, first, activePlayer, gameOptions, rng, board, projectDeck, corporationDeck, preludeDeck, ceoDeck, tags, marsBotPlayer?)`. Pinned by a regression test in `MarsBotSessionFixes.spec.ts` ("serialization roundtrip preserves both game name and MarsBot") so a future bad merge dropping/reordering either arg fails fast.

### 12.3 GameBoardView coexistence (`GameBoardView.vue`)
`MarsBotPanel` (automa) and `DeltaProjectBoard` (upstream) now render side by side. Upstream renamed the component's `playerCount` prop to `players`, so the milestones/awards visibility condition was reconciled from `playerCount > 1 || isAutoma` to `players.length > 1 || isAutoma`, preserving the automa-shows-MA behavior.

### 12.4 Delta Project ↔ automa
Delta Project is a community (unofficial) expansion. Automa support is intentionally scoped to official expansions only, so no MarsBot interaction with Delta Project is implemented and none is planned — this is out of scope by design, not a tracked gap. The merge only ensures the two features render side by side without breaking automa.
