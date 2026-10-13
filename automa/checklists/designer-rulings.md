# MarsBot designer rulings

Rulings from the designers, Nick Shaw (njshaw2) and Dávid Turczi (TDaver), on the
BoardGameGeek forums for Terraforming Mars: Automa (BGG id 395612). The code follows these
where the rulebook is silent or reads differently. Read 2026-10-12: 191 threads, 835 posts.

Thread links: `https://boardgamegeek.com/thread/<id>`.

## Applied in the code

| Topic | Ruling | Thread |
|---|---|---|
| Local Neural Instance (B07) | When the tile can't be placed, MarsBot resolves a project card and the bonus card is NOT destroyed. "The destroy only happens if the placement works" (Nick), "I confirm Nick's interpretation of LNI" (Dávid) | 3350125 |
| Neural Instance placement | Most placement icons, then flip a card for the final tiebreak | 3342600 |
| Neural Instance reserved spaces | Only printed reserved spaces (oceans, Noctis). A placed ocean is not reserved but is a tile for "adjacent to no tiles" | 3406056, 3436886 |
| Random tile tiebreak | Cost 1 is the first space; an exact multiple of the count is the last | 3342916 |
| Hard mode card VP | Only cards with a VP icon count. Conditional and per-resource icons count, negative icons don't | 3386410 |
| Thermalist comparison | Heat + energy resources + heat production (not energy production) | 3350125 |
| Magnate | "Blue and green" on rulebook C p.15 is a typo: green cards only | 3534424 |
| Planetologist on Terra Cimmeria | The sum of the Earth/Jovian and Venus tracks must be 5 or more | 3358029 |
| Before the Action Phase | Resolved "before ANY actions are taken in the Action Phase", so after preludes | 3738284 |
| Colony storage | The player may take from MarsBot's MC or its colony storage, and may mix | 3599965, 3398852 |
| Colonies board track advances | Not a tag resolution for MarsBot's corp (Arklight etc.) | 3535330 |
| Final greeneries | No greenery for a space MarsBot already triggered and was pushed back over | 3579630, 3513769 |
| Production decrease | One track space per production step | 3355768 |
| Corporate Competition (B14) | The missing Venuphile helper is an omission, include it | 3641200 |
| Brutal | 4 starting project cards, keeps all 4 in research | 3406056 |
| Expedited Construction (B05, B17 a) | Any space next to 2+ greenery/ocean tiles, then the usual city rule, so 2 greeneries beat 3 oceans. The card's wording wins over the rulebook's "most tiles of these types" (Dávid; the printed card agrees) | 3350125 |
| Philares (C22) | Spends its science resources the moment it has 4, on either player's turn, but advances no track after the game has ended (final greeneries). "Probably not after the end of the game" (Dávid) | 3513998 |
| Pristar and 2-step raises | The steps resolve one at a time, so the cube cancels only the first (Lobbyists, Do It Right, `temperature2`/`venus2` icons). "Resolve sequentially. So mess with the first only", "I definitely imagined it to only cancel the first" (Dávid) | 3431297, 3432237 |
| Bonus card on a maxed track | No Failed Action: a bonus card that can't resolve does nothing unless it says otherwise (B24, B26, B28, B32). Project cards and track icons keep theirs (Nick) | 3599965, 3623553 |
| Final greeneries, chaining | Only the space directly ahead of each tracker, not chained, so Manutech's extra advance doesn't fire then (Nick) | 3385156 |
| Final greenery with no space | A Failed Action, and the tracker stays (Nick; rulebook A p.8) | 3404826 |
| Venus 8% card bonus | MarsBot gains 2 MC instead of a card, as for the heat production bonus. Not from Government Intervention, which pays no MC from bonuses | 3358342, 3424237, 3733436 |
| Greenery placement | The greatest net gain: MarsBot's adjacent cities minus yours, then the placement tiebreakers (Nick) | 3350125, 3411375 |
| Ecoline/Ecotec plants on the corp card | The player chooses: the plants on the card (excess lost) or the usual sources, never both. "You can remove either 2mc or that 1 plant" (Dávid) | 3341536 |
| Leftover resources VP (optional) | The resources left on MarsBot's Colonies shipping board and its Venus-board floaters score 1/2 VP each, rounded down; its colonies don't. The designers meant it but forgot to print it (Dávid). Behind the `automaColonyVP` game option, whose key stays for saved games | 3408751, 3373832 |

## No designer ruling: our reading

| Topic | Choice | Why |
|---|---|---|
| "Furthest from completion" (Lobbyists, Government Intervention, Venusian Lobby) | Steps remaining | User decision; the rulebook gives only the tie order |
| Random M&A (not the expansion) | A map's own milestone uses that map's rule | User decision |
| Venus milestones without Venus Next | Removed for both players | User decision; BGG players ignore or swap |
| Milestone tiebreak "closest to meeting" | Smallest distance to the threshold | Community consensus (3527204) |
| Hard mode first-turn milestone | Costs 8 MC only, no Briber surcharge | Rulebook A p.11 says only "loses 8 MC" |
| Storage overflow timing | Immediate, also on the player's turn, but not after the game has ended | Matches the Philares ruling (3513998), which also stops at game end |
| Mining Guild setup | Starting Building tags already count down the card (8 MC left) | Rulebook B setup step 4: ongoing effects active |
| Final greenery move and corp cubes | Fires the corp cubes on that space (IC, Teractor, Helion's black cubes), but no colony cube and no Manutech advance | User decision; Dávid says Teractor fires on "any other effect advancing the Earth track" (3621937) |
| Corp effects raising a maxed temperature | Failed Action (Helion, Thorgate, Kuiper, Palladin, Stormcraft), also at final greeneries | User decision; Nick's "no benefit, thus it's a failure" (3350125) and "good for the bot" (3404826) |
| Mining Guild overflow | The rest of a gain comes off the refilled card, and a big gain can advance the building track more than once, until #18 | User decision; Nick: the card counts "every 10MC MarsBot gains" (3553988) |
| Setup bonus card destroyed by MarsBot's corp | Destroyed, and the bonus deck deals a replacement into the first action deck (not for set-aside cards like Party Politics) | User decision; the setup card is dealt before the corp (rulebook A setup step 3) |
| Aridor on a two-tag track | Both tags count alike: most matching tags wins, ties at random | User decision; rulebook B makes the priority a track |
