

# MarsBot Colonies — Rule Checklist

Source: `automa/TM-Automa-rulebook-C-11-14-2023.pdf` pages 4–5.

Implementers must scan the **full rulebook** and add `C-X*` cross-reference entries below for any clauses on other pages (Prelude/Prelude2 p.1, Venus Next p.2–3, base rules) that touch Colonies behavior.

> **Bonus card numbering note:** the rulebook calls the Colonies bonus cards B16 (Expedited Construction), B17 (Outer System Foothold), B18 (Shipping Lines), B19 (Extended Shipping Lines). The current codebase `BonusCardId` enum may have these as B17–B20 (one slot offset). Implementers must reconcile this in their plan and pick one consistent numbering.

## Setup Changes

- **C-1** — Set up Colonies as if playing a two-player game; all Colony tiles (incl. Titan, Enceladus, Miranda) start with their tracker on the highlighted second step.
- **C-2** — Replace the base Expedited Construction (B05) bonus card with the Colonies-specific Expedited Construction (rulebook: B16).
- **C-3** — Shuffle Outer System Foothold (rulebook: B17) into the bonus deck.
- **C-4** — Place the MarsBot Colonies Shipping Board beside the MarsBot board.
- **C-5** — Place 1 Trade Fleet for MarsBot (and one for the player) on the Trade Fleets tile.
- **C-6** — Place a 2nd Trade Fleet on the 9th space of the credits track for Tharsis and Utopia Planitia, and on the energy track for Vastitas Borealis.
- **C-7** — Set aside the bonus cards Shipping Lines and Extended Shipping Lines (rulebook: B18–B19).

## Gameplay Changes

- **C-8** — If playing with Venus Next: follow the Venus rules for spending Floaters (see Venus Next page).
- **C-9** — If NOT playing with Venus Next: follow the Venus Next floater-spending rules anyway, assuming the Hoverlord Milestone is no longer available.
- **C-10** — After the Research Phase, once MarsBot has its new action deck (excluding the first round), shuffle the Shipping Lines card into the action deck.
- **C-11** — If MarsBot has unlocked its 2nd Trade Fleet, also shuffle Extended Shipping Lines into the action deck on the same trigger.
- **C-12** — If at any point during MarsBot's turn it has ≥5 resources in a storage area, remove 5 resources from that area and advance the indicated track by one space. Does NOT apply to the Titan/Floater area.

## New MarsBot Track Actions (on Colony-specific MarsBot boards)

- **C-13** — "Raise Venus 1 Step" icon: if playing without Venus Next, ignore. Otherwise, see Venus Next rules p.2.
- **C-14** — "Gain Floater" icon: if playing without Venus Next, place a resource token in the Titan storage area of the Colonies shipping board. Otherwise, see Venus Next rules p.2.

## New MarsBot Bonus Cards

### C-15: Expedited Construction (rulebook B16) — evaluate first applicable

- **C-15a** — MarsBot places a city tile adjacent to any mix of at least 2 greenery/ocean tiles. If tied: adjacent to most tiles of these types, then see Tile Placement Tiebreakers. The placement must obey usual city placement rules. **If a city tile is placed, destroy this card.**
- **C-15b** — Otherwise, if MarsBot has 1 or 0 colonies in play, place one on a randomly selected colony tile where it doesn't already have one:
    - Flip a card from the project deck. Count and loop around if needed, counting through each eligible colony tile up to the card's cost. Place the colony on the final tile, then discard the flipped card.
    - Then MarsBot gains 2 resources into the storage area on its Shipping Board corresponding to the selected colony tile.
    - **Note: this option does NOT destroy this card.**
- **C-15c** — Otherwise, no effect.

### C-16: Outer System Foothold (rulebook B17)

- **C-16a** — MarsBot places a colony on a randomly selected colony tile where it doesn't yet have one (using the C-15b method).
- **C-16b** — MarsBot gains 2 resources into the storage area on its Shipping Board corresponding to the selected colony tile.
- **C-16c** — Draw a card from the bonus deck (reshuffling the discard pile if necessary, but **not** including Outer System Foothold itself in that reshuffle), and discard it without resolving the drawn card's effect.
- **C-16d** — Note: this card-draw applies to MarsBot's bonus deck, not its action deck.

### C-17: Shipping Lines (B18) and Extended Shipping Lines (B19)

- **C-17a** — Select the colony tile with the most-advanced track.
- **C-17b** — If multiple options are tied, prefer one where MarsBot has a colony.
- **C-17c** — If still tied, select randomly (using the C-15b method).
- **C-17d** — MarsBot loses 1 MC and then trades with the selected colony tile.

## Shipping Board and Trading

- **C-18** — MarsBot has a Shipping Board with 11 storage areas, corresponding to the 11 colony tiles.
- **C-19** — When MarsBot places a colony (via Expedited Construction or Outer System Foothold), it ignores the printed reward of the tile, and instead gains 2 resources into the storage area corresponding to the colony tile where it has built. (This rule is indicated on the bonus cards that cause it.)
- **C-20** — When MarsBot trades with a colony tile (via Shipping Lines or Extended Shipping Lines), it ignores the colony track's trade income, and instead gains 2 resources into the storage area corresponding to the colony tile it's trading with. If MarsBot already has a colony on that tile, it gains an additional 1 resource into the same storage area. **If the player has 1+ colonies on the tile in question, the player receives a colony bonus per core rules.**
- **C-21** — When the player trades with a colony tile (per core rules), the player gains trade income and colony bonus as normal. If MarsBot has a colony on the tile in question, MarsBot gains 1 resource into the storage area corresponding to that tile.
- **C-22** — Both player and MarsBot must observe the One Trade Fleet per Colony Tile rule.

## Colony Tile-specific Rules

- **C-23** — The Titan storage area is only used if playing without Venus Next. MarsBot only spends floaters using the C-8/C-9 rules.
- **C-24** — Europa works differently:
    - **C-24a** — Placing a colony on Europa: instead of 2 resources, MarsBot places an ocean tile (raising TR 1 step per usual rules). If not possible, **Failed Action**.
    - **C-24b** — Trading with Europa: instead of 2 resources, MarsBot raises TR 1 step (still loses 1 MC, as usual).
    - **C-24c** — Receiving the Europa colony bonus: instead of 1 resource, MarsBot gains 1 MC.
    - **C-24d** — Resources are never placed in Europa's storage area.
- **C-25** — Resources on Ceres, Luna, Io, Enceladus, Ganymede, Callisto, Miranda, and Triton are considered to be resources of the indicated type for the purposes of player cards. The player may steal/remove from them as usual.
- **C-26** — MarsBot does not gain cards for Pluto. Instead it gains [card-equivalent] resources into the corresponding storage area.

## Unlocking the 2nd Trade Fleet

- **C-27** — When the credits track reaches the 9th space, in addition to resolving the space's effect, move the Trade Fleet from there to the Trade Fleet tile (mark with one of MarsBot's player markers). From the following generation onwards, shuffle Extended Shipping Lines into the action deck (in addition to Shipping Lines), so MarsBot trades twice per generation.

## Cross-references (implementer must scan rulebook and fill in)

- **C-X*** — _Implementer: scan Prelude/Prelude2 (p.1), Venus Next (p.2–3), and any base-rule pages for clauses that interact with Colonies (e.g. Trade Fleets, colony tiles in Wild-tag resolution, milestone/award changes). Add as `C-X1`, `C-X2`, ... with PDF page reference._

If this section is empty when you submit your plan, the lead will reject it.
