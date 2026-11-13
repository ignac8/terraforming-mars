# MarsBot on Amazonis Planitia (big map): design

Status: built as of 2026-11-13 (fork PR #84). Fork only: this map has no MarsBot board in the rulebooks,
so none of this goes upstream.

## 1. Why

Amazonis Planitia (`BoardName.AMAZONIS_PLANITIA`, `'amazonis planitia'`, the 91-hex map) is a bigger Mars:
11 oceans, +14 °C (22 temperature steps), 18 % oxygen, Venus to 33 % with 1 % steps from 31 to 33. That is
51 global steps instead of 42. The rulebooks give each official map its own MarsBot board ("slightly tweaked
tracks, and different milestones & awards", rulebook C p.8), but there is none for this map. This fork adds
one (4.1). `MARSBOT_BOARD_NAMES` lists the map, so `isMarsBotBoardChoice` lets the create-game form offer it
with MarsBot. `AutomaGameSetup.sanitizeGameOptions` still swaps any map without a MarsBot board to Tharsis.

The goal is a MarsBot game on this map that feels like the official ones: same rules, same strength, a
board that looks like the designers made it, and a game that is longer only because Mars is bigger.

## 2. Goals, non-goals, anti-goals

Goals
- A MarsBot board for the map that follows the designers' patterns (section 4.1).
- Game length and MarsBot's M€ → VP table that match the bigger map.
- A MarsBot rule for every milestone and award the map deals, including the three the rulebooks do not
  cover (Merchant3, Innovator, Physicist).
- Every map maximum read from the game, never from the standard-map constants.

Non-goals
- Physical playability. Website first; a printable board is a nice-to-have.
- Unofficial expansions (Ares, Moon, Pathfinders, ...). They stay gated off as on every MarsBot map.
- Upstreaming. The official MarsBot stack upstream does not include this map.

Anti-goals (would make it a failure even if it works)
- Any change to how MarsBot plays on the six official maps. Every rule below is scoped to this map unless
  it says otherwise.
- A MarsBot that is clearly stronger or weaker here than on Tharsis.
- A board that reads as generated: icon runs, clumps, or tag groupings no official map would use.

## 3. Constraints

- Official expansions only (base, Corporate Era, Prelude, Prelude 2, promo, Venus, Colonies, Turmoil).
- Spaces 10 to 18 of every official MarsBot board are almost identical; only spaces 1 to 9 and one Building
  "+track" icon change between maps. The new board keeps that.
- Odd/even generation cards (Government Intervention, Investors) must keep seeing the real generation.

## 4. Decisions

### 4.1 Board: "Animal joins Science"

Tharsis with one tag moved, the way Vastitas Borealis moved Microbe to Science. Spaces 10 to 18 are Tharsis
cell for cell, except the Building "+track" icon moves from space 11 (+Space) to space 13 (+Space), with a
+Science icon on Building 7. Extra tags sit only on Science, Power, Earth or Plant, as on all six official
maps.

Track order and tags:

| # | Track | Tags | Production |
|---|---|---|---|
| 0 | Building | Building | steel |
| 1 | Space | Space | titanium |
| 2 | Event | Event | M€ |
| 3 | Science | Science, **Animal** | none |
| 4 | Energy | Power, Jovian | energy |
| 5 | Earth | Earth, City | heat |
| 6 | Plant | Plant, Microbe | plants |

Layout, as in `src/server/automa/boards/AmazonisPlanitiaMarsBot.ts`:

```ts
const TRACK_BUILDING: TrackDefinition = {
  tags: [Tag.BUILDING],
  productions: [Resource.STEEL],
  layout: [undefined, undefined, undefined, undefined, undefined, 'temperature', 'greenery', 'tag_science', 'milestone', 'greenery', 'city', undefined, 'ocean', 'tag_space', 'greenery', 'city', 'temperature', undefined, 'tr5'],
};

const TRACK_SPACE: TrackDefinition = {
  tags: [Tag.SPACE],
  productions: [Resource.TITANIUM],
  layout: [undefined, 'advance', undefined, 'tr3', 'tr2', undefined, 'ocean', 'venus', 'tr2', 'award', undefined, 'tr3', 'ocean', undefined, 'temperature', undefined, 'tr4', undefined, 'tr6'],
};

const TRACK_EVENT: TrackDefinition = {
  tags: [Tag.EVENT],
  productions: [Resource.MEGACREDITS],
  layout: [undefined, 'city', 'advance', undefined, 'ocean', undefined, 'floater2', 'milestone', 'temperature', 'temperature', 'award', undefined, 'tr4', 'temperature', 'greenery', 'advance', 'temperature2', undefined, 'tr5'],
};

const TRACK_SCIENCE: TrackDefinition = {
  tags: [Tag.SCIENCE, Tag.ANIMAL],
  productions: [],
  layout: [undefined, 'greenery', undefined, 'ocean', 'temperature', 'city', 'ocean', 'greenery', 'greenery', 'milestone', 'temperature', 'ocean', 'tr3', 'temperature', 'tr4', 'advance', undefined, 'temperature', 'tr7'],
};

const TRACK_ENERGY: TrackDefinition = {
  tags: [Tag.POWER, Tag.JOVIAN],
  productions: [Resource.ENERGY],
  layout: [undefined, 'advance', 'floater', undefined, 'floater2', 'tr3', 'advance', 'award', 'city', 'greenery', 'greenery', 'advance', 'ocean', undefined, 'city', 'greenery', undefined, 'temperature', 'tr8'],
};

const TRACK_EARTH: TrackDefinition = {
  tags: [Tag.EARTH, Tag.CITY],
  productions: [Resource.HEAT],
  layout: [undefined, undefined, 'temperature', 'city', 'ocean', undefined, 'city', 'advance', 'temperature', 'greenery', 'advance', 'city', 'greenery', 'tr4', 'greenery', 'advance', undefined, 'city', 'tr7'],
};

const TRACK_PLANT: TrackDefinition = {
  tags: [Tag.PLANT, Tag.MICROBE],
  productions: [Resource.PLANTS],
  layout: [undefined, 'advance', 'greenery', 'advance', 'greenery', undefined, 'milestone', 'advance', 'ocean', 'tr3', 'award', 'temperature', 'tr3', 'greenery', 'greenery', 'ocean', 'greenery', undefined, 'tr6'],
};
```

Icon count: 11 ocean, 14 temperature (plus one double), 18 greenery, 10 city, 4 milestone, 4 award,
13 advance. Tharsis has 10 ocean, 15 temperature and 15 greenery; the extra oceans and greeneries are what
make up the bigger map.

How it was chosen: every tag grouping that follows the designers' pattern (256) was searched with spaces 10
to 18 fixed, about 4,300 boards fitted, and the best 42 re-tested over 5,000 simulated games each against
Tharsis. This board had the best schedule of all 42 and nothing beat it overall.

| Measure | This board | Tharsis |
|---|---|---|
| Extra generations on the big map (target +1.45) | +1.44 | n/a |
| Milestone icons reached by gen 6 / 8 / 10 | 1.10 / 1.94 / 2.66 | 1.07 / 1.91 / 2.64 |
| Award icons reached by gen 8 / 10 / 13 | 0.97 / 1.69 / 2.71 | 0.97 / 1.69 / 2.71 |
| Track speed at gen 13: Physicist, Manufacturer, Power, Earth | +2.3 %, −0.3 %, −1.1 %, +0.2 % | 0 |
| Energy 10 reached (2nd Colonies fleet) by gen 12 / 14 | 38 % / 56 % | 38 % / 57 % |

### 4.2 Game length: shift by two

The big map runs about 1.5 generations longer. On this map only:

- MarsBot's instant-win generation is 22 (20 with Prelude) instead of 20 (18).
- The M€ → VP table follows automatically, since `buildMcToVpTable` counts back from the limit: 1 VP per
  8 M€ until generation 14 (12 with Prelude) instead of 12 (10).

One per-board number, `extraGenerations` in `marsBotMapRules` (`src/common/automa/MarsBotMapRules.ts`), feeds
both. It is 2 on this map and 0 on every other.

### 4.3 Cards that name a generation (this map only)

| Card | Printed | Here |
|---|---|---|
| Terralabs (Turmoil corp): 2 cards per generation | from generation 9 | from generation 10 |
| Overachievement (B04): fund an award | from generation 6 | from generation 7 |
| Nirgal Enterprises: milestone / award / milestone windows | 2–5 / 6–9 / 10+ | 2–6 / 7–10 / 11+ |

The one-generation delay is `generationShift` in `marsBotMapRules` (1 on this map, 0 elsewhere). It moves
only MarsBot's own thresholds. Government Intervention and Investors keep reading the real generation.

### 4.4 Milestones and awards

The map deals Terran, Landshaper, Merchant3, Sponsor, Lobbyist and Collector, Innovator, Constructor,
Manufacturer, Physicist. Rules in **bold** are new.

| Item | MarsBot rule | Note |
|---|---|---|
| Terran | Earth track at 5+ | existing (rulebook C) |
| Landshaper | 1 city, 1 greenery, Building track at 5+ | existing (rulebook C) |
| **Merchant3** | **all 7 Mars tracks at space 3 or higher** (Venus track not counted) | the designers' Merchant is "every Mars track at 2" (`Merchant.marsBotCanClaim` leaves the Venus track out) |
| Sponsor | 3 played cards costing 20+ | existing (rulebook C) |
| Lobbyist | Chairman plus 2 party leaders | existing (rulebook C); "all 7 delegates" is near impossible for MarsBot |
| Collector | number of tracks at 3+ | existing (rulebook C) |
| **Innovator** | **cards in MarsBot's played pile minus the current generation** | MarsBot plays about 3.35 cards a generation, a human about 2.3 |
| Constructor | cities (plus colonies) | existing (rulebook C) |
| **Manufacturer** | **Building + Energy tracks minus 3** | this map only; the rulebook rule stays on other maps |
| **Physicist** | **Science + Space tracks minus 5** | mirrors the designers' +5 on Thermalist and Miner |

Without the new rules, two scoring accidents appear as soon as the map is enabled: Innovator scores 0 for
MarsBot (its cards live in a separate pile), and Merchant3 reduces to "has about 15–18 M€".

Threshold check on this board against Tharsis, same 3,000 simulated games each:

| Item | Tharsis | This board |
|---|---|---|
| Innovator at gen 13 | 30.6 | 30.6 |
| Physicist at gen 10 / 13 (beats a typical human) | 11.2 / 15.2 (53 % / 65 %) | 11.4 / 15.8 (54 % / 69 %) |
| Manufacturer at gen 13 (beats a typical human) | 18.6 (85 %) | 18.6 (85 %) |
| Collector at gen 13 | 7.0 | 7.0 |
| Constructor at gen 13 | 6.2 | 6.1 |
| Merchant3 reached by gen 8 / 10 | 73 % / 89 % | 78 % / 91 % |
| Terran, Landshaper, Sponsor: median claim generation | 8, 5, 5 | 8, 5, 5 |

No threshold needs to change for this board. Physicist moves up by less than one point because Animal cards
now push the Science track.

### 4.5 Tile placement

Tharsis order, made explicit: oceans as printed, then the space with the most bonus icons, then a card flip.
Volcanoes and delegate hexes do nothing special. Every placement variant tested moved MarsBot's tile VP by
about 1 of 24, so the simplest rule wins. No code: `MarsBotTilePlacer` already falls back to the Tharsis
order for a map it does not list.

### 4.6 Venus

- "Complete" means the map's real maximum (33 %), and every "1–2 steps" check counts real steps with
  `venusStepsBetween`, not 2 % per step.
- Lobbyists keeps its printed text, with real step counts.

### 4.6a The map's own global-parameter bonuses

This map's parameter tracks print bonuses the standard maps do not have (`AMAZONIS_PLANITIA` in
`src/server/boards/GlobalParameterTracks.ts`). When MarsBot raises a parameter past one:

| Bonus | MarsBot gets |
|---|---|
| Colony at 16 % Venus | builds a colony exactly as for Utopia Planitia's colony icon (`placeColony`: like Outer System Foothold, ignored without Colonies). A human player is still asked where to build |
| Plant production at −12 °C | 2 M€, as for the heat-production bonuses |
| Card at 7 % oxygen | 2 M€, through the existing card-bonus hook |
| Temperature at 11 % oxygen, TR at 22 % Venus | the bonus itself, as on standard maps at 8 % and 16 % |

The colony is built after the raise has finished. The raise only marks the colony as due, and
`handleVenusRaised` builds it, so a corporation's reaction to the colony (Poseidon's track advance, which can
land on a Venus icon) cannot raise Venus again in the middle of the first raise.

Lobbyists ("1–2 steps from a bonus or completion") reads these bonus steps from
`game.globalParameterTracks`, not the standard-map constants (`isNearBonusStep` in
`MarsBotBonusResolver`). Oxygen 8 % is not a bonus step here.

Government Intervention's Venus raise across 16 % still builds the colony, or takes the Failed Action when no
colony tile is left, and the corporation still reacts to it. The M€ gained from the colony (Europa's ocean, the
Failed Action) is taken back, as for the card's other effects, except what Lakefront Resorts may keep.
Aphrodite's 2 M€ per Venus step is paid before the colony is built and stays. The TR from an ocean the colony
places is withheld like the raise's own TR. No ruling covers this map; this applies the card's rule that its
raises give MarsBot no rewards to the colony.

### 4.7 Colonies

No change. The second fleet cube stays on Energy track space 9 (rule C-6); this board moves the Energy
track at Tharsis' rate.

### 4.8 Turmoil

- Delegate hexes: MarsBot gains 1 M€ per delegate icon, as it does for any bonus. Rulebook C prints the
  same rule for the Vastitas Borealis delegate hexes. `MarsBotTilePlacer` already pays it.
- MarsBot's starting TR with Turmoil: 20 − 11 on this map instead of 20 − 10, so 9. The harder variant
  (`automaTurmoilTRReduction` 7) moves by one as well: 20 − 8, so 12 instead of 13. `turmoilTRExtra` in
  `marsBotMapRules` holds the one. The create-game form says "One less on Amazonis Planitia" under that
  option. The human loses about 1 TR a generation to Turmoil and MarsBot none, and the game is a generation
  longer. This is an inference, not a designer statement.

### 4.9 New bonus card: Corporate Competition (Amazonis)

In code this is not a new card: every map's Corporate Competition runs through B08
(`bonusCards/CorporateCompetitionMarsBot.ts`), which picks a push by award name in
`MarsBotBonusResolver.tryHelperAction` (B09–B13 are enum values only). Collector, Constructor, Manufacturer
and Venuphile use helpers the other maps share; Innovator and Physicist are this map's own:

| Award | Push |
|---|---|
| Collector | advance the least-advanced track |
| Innovator | flip the top project card and resolve it, with no filter on the card |
| Constructor | place a city |
| Manufacturer | advance the less advanced of Building and Energy |
| Physicist | advance the less advanced of Science and Space |
| Venuphile (with Venus) | advance the Venus track |

When the two tracks are tied, the upper track advances. The Innovator push is invented; the rest reuse
existing helpers.

### 4.10 Milestones & Awards expansion on this map: disabled for now

With the M&A expansion on, the rulebook (C p.13) has MarsBot use the Tharsis board whatever the map, and
the code does the same (`marsBotBoardName`, `MarsBotTilePlacer.mapName`, `marsBotMapSet`). For now MarsBot
does not play this map when M&A is on.

The expansion counts as on when `modularMA` is set and random milestones and awards are not off (limited
synergy, full random or hand-picked). One shared check, `modularMABlocksMarsBot` in
`src/common/automa/MarsBotBoards.ts`, decides when the expansion blocks the map, and the first two places
below use it:
- The create-game form shows a blocking error (`marsBotModularMAOnAmazonis` in `validateNewGameConfig`).
- The server does not run that validation. `ApiCreateGame` drops the map from MarsBot's board choices and
  picks Tharsis when none is left. `AutomaGameSetup.sanitizeGameOptions` swaps a blocked map to Tharsis as a
  backstop.
- With random milestones and awards off, `modularMA` does nothing, but the create-game form sends it anyway.
  `sanitizeGameOptions` ignores that leftover `modularMA`, so the map stays playable.

TODO: decide between
- Tharsis tracks with this map's numbers (extra generations, Turmoil 20 − 11, 4.3, 4.6a), keyed to the map
  played rather than the MarsBot board; unchanged Tharsis tracks run about half a generation longer here.
- This map's board even under M&A, which breaks the rulebook's pattern.

### 4.11 Not added

"Frontier Push", a pacing card for non-Venus games. The board already closes the game-length gap; both
together would make the big map end faster than a standard one.

## 5. Changes outside the board

- `src/server/automa` reads the map's maxima from `game.max.*` and uses no `constants.MAX_*`. With the
  standard-map maxima MarsBot would call temperature done at +8 °C and take Failed Actions.
- The Lobbyists branches in `MarsBotBonusResolver.ts` ask `isNearBonusStep` whether a parameter is 1 to 2 steps
  from a bonus step or its maximum, from the map's own bonus tracks (4.6a) and the game's maxima.
- The board is registered in `MARSBOT_BOARD_NAMES` (`src/common/automa/MarsBotBoards.ts`) and `MARSBOT_BOARDS`
  (`src/server/automa/boards/MarsBotBoards.ts`). `MARSBOT_BOARDS` holds one board per map, seven tracks;
  `AutomaGameSetup.getBoardData` appends the Venus track when Venus Next is in play.
- `getAutomaMaxGeneration` adds the map's `extraGenerations`, and the M€ → VP table is built from that limit
  (4.2).
- `coveredByAutomaRules` counts Merchant3, Innovator and Physicist as covered only in a game on this map
  without the M&A expansion. On the six official maps random M&A keeps leaving them out of MarsBot games.
  The rules for them are in 4.4.

## 6. Decisions the design left open

- The per-map numbers live in one object per map, returned by `marsBotMapRules`: `extraGenerations` 2,
  `generationShift` 1 and `turmoilTRExtra` 1 on this map, all 0 elsewhere. Manufacturer's −3 sits on the
  award itself (`Manufacturer.marsBotScore`), not in that object.
- The Turmoil harder variant also moves by one: MarsBot starts at 9 TR with the rulebook reduction and at 12
  with the harder one (4.8).
- Corporate Competition's Innovator push flips the top project card and resolves it, with no filter on the
  card. Its Physicist push advances the less advanced of the Science and Space tracks (4.9).
- The colony from the 16 % Venus bonus is built right after the raise is complete, so a corporation reaction
  such as Poseidon's cannot re-enter the raise (4.6a).
- The M&A expansion counts as on when `modularMA` is set and random milestones and awards are not off (limited
  synergy, full random or hand-picked). `modularMABlocksMarsBot` is the one check for it (4.10).
- A leftover `modularMA` with random milestones and awards off is ignored, so the map stays playable.
- The card text for the new rules follows the existing `automaDescription` style: Merchant3 "All tracks ≥ 3
  (except Venus)", Innovator "Played cards minus the generation", Physicist "Science + Space tracks − 5",
  and on Manufacturer "Building + Energy tracks − 3" through `automaMapDescriptions`. The Terralabs and
  Nirgal Enterprises texts say that their generation thresholds are one generation later on Amazonis Planitia.
- The tests are `tests/automa/MarsBotAmazonisRules.spec.ts`, `MarsBotAmazonisBonuses.spec.ts`,
  `MarsBotAmazonisMA.spec.ts` and `MarsBotAmazonisMaxima.spec.ts`, plus `MarsBotMapRules.spec.ts` for the
  per-map numbers.

## 7. Evidence

The simulations (tag-grouping search, board fitting, 5,000-game re-tests, threshold check) were run outside
the repo between 2026-10-16 and 2026-11-04. Human-side numbers (about 30 cards played, 13 science + space
tags at game end) are assumptions, not play data, so the new award rules are best checked again after some
real games. The simulations model MarsBot's tracks only, not the map's parameter bonuses in 4.6a; MarsBot
raises Venus about 2 steps a game, so those bonuses add little to its totals.
