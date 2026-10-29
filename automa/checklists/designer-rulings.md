# MarsBot designer rulings

Rulings from the designers, Nick Shaw (njshaw2) and Dávid Turczi (TDaver), on the
BoardGameGeek forums for Terraforming Mars: Automa (BGG id 395612). The code follows these
where the rulebook is silent or reads differently. Read 2026-10-12: 191 threads, 835 posts.

Thread links: `https://boardgamegeek.com/thread/<id>`. "Q&A n" is question n of our own question thread (2026-10-13), where Nick also wrote that forum answers from Dávid or him supersede the rulebook wording.

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
| Final greenery with no space | A Failed Action, and the tracker stays (Nick; rulebook A p.8). "I think I'd say that's a failed action" (Nick) | 3404826, Q&A 2 |
| Venus 8% card bonus | MarsBot gains 2 MC instead of a card, as for the heat production bonus. Not from Government Intervention, which pays no MC from bonuses | 3358342, 3424237, 3733436 |
| Greenery placement | The greatest net gain: MarsBot's adjacent cities minus yours, then the placement tiebreakers (Nick) | 3350125, 3411375 |
| Ecoline/Ecotec plants on the corp card | The player chooses: the plants on the card (excess lost) or the usual sources, never both. "You can remove either 2mc or that 1 plant" (Dávid) | 3341536 |
| Invasive Species (B02) and Excentric | The cube worth the most VP: cards that score per resource first (Vermin and cards with no VP count as non-scoring), then the best VP per cube. "It was meant to target scoring cubes first" (Dávid). A tie goes to a flipped card (our reading) | 3360797 |
| Floaters without Venus Next or Titan | With Colonies, no Venus Next and Titan not dealt, floater icons and Invasive Species' floater are ignored (its 2 M€ stays). "If you're not using the Titan colony, *and* not using Venus Next, floaters can also be ignored" (Nick). Floater corps (Celestic, Stormcraft, Viron) still keep theirs in Titan storage: "Corps can still utilise floaters" (Nick) | 3341542, Q&A 21 |
| Draft discard when every card matches | A tag priority (a tag list, or Aridor's track) always discards one card: the fewest matches of the 1st priority tag, then the 2nd, ties at random. "It will always end up discarding one card", and the rulebook's line "was missed during proofing" (Nick). This overrides rulebook B p.2's "in rare cases it can be 5"; Credicor and Spire still discard nothing, as their cards print | 3398289, Q&A 22 |
| The player's Saturn Systems | Only an advance that names Jovian counts as a played Jovian tag: Traveller advancing the Jovian track, which on Terra Cimmeria and Vastitas Borealis is the shared Earth/Jovian row. An advance that names only the row's other tag doesn't: Earth on the Earth/Jovian row, Power on the Power/Jovian row. "A Jovian bump, yes" (Dávid), over the FAQ's "only when you or MarsBot play a card" | 3356105 |
| Leftover resources VP (optional) | The resources left on MarsBot's Colonies shipping board and its Venus-board floaters score 1/2 VP each, rounded down; its colonies don't. The designers meant it but forgot to print it (Dávid). Behind the `automaColonyVP` game option, whose key stays for saved games | 3408751, 3373832 |
| Final greenery move and corp cubes | Fires the corp cubes on that space (IC, Teractor, Helion's black cubes), but no colony cube and no Manutech advance. Nick leaves it to us ("consider it a difficulty modifier"), and would give MarsBot a bonus a player's corp would get. So it fires by default, and the game option `automaFinalGreeneryNoCorpEffects` ("Final greeneries skip MarsBot's corporation") turns it off | Q&A 1, 3621937 |
| Corp effects raising a maxed temperature | Nothing, and no Failed Action (Helion, Thorgate, Kuiper, Palladin, Stormcraft), also at final greeneries. "I wouldn't count a corp effect like that as an 'action' in its own right" (Nick). All five are reactions printed as "When MarsBot ..." | Q&A 3 |
| Setup bonus card destroyed by MarsBot's corp | Destroyed, and the bonus deck deals a replacement into the first action deck (not for set-aside cards like Party Politics). "It should still have 4 cards for its first turn" (Nick) | Q&A 4 |
| Random milestones and awards | Only those the automa rules cover are dealt: the sets of the six MarsBot maps, the Milestones & Awards expansion (listed by name, so new upstream ones stay out) and Venus Next. Every such award but Politician has a Corporate Competition helper; Politician "has no corresponding competition effect" (rulebook C, p.16), so Corporate Competition skips it like any award without one. "Some won't make sense at times, so just swap them out" (Nick) | Q&A 5, 3599464, 3649540 |
| Wild tags | Count as tags wherever MarsBot counts them (Spire's effect, the most-tags draft, Interface Hyperlink, Sagitta), but never match a named draft-priority tag. "A wild tag is still a tag for things that count just 'tags'" (Nick) | Q&A 19, 3429859 |
| "Reveal until" helpers | No cap: reveal on, reshuffling the discards, and give up only once every card in the deck has been seen. "That's what I do as a player, so yes, do that for the bot too" (Nick) | Q&A 20 |
| Venus track and "least-advanced" | Counts as a normal track and sits at the bottom for ties; only Visionary leaves it out (rulebook C). "I've always played w Venus at the bottom" (Dávid) | 3376248 |
| Neural Instance and your cards | Not a special tile for your cards, so Red Ships pays nothing for it. It is special only where that helps MarsBot (Founder). "It was originally designed as not a special tile" (Dávid) | 3415037, 3356189 |
| Neural Instance is MarsBot's tile | Counts for Landlord and the closest-award check, as a tile it owns for greenery placement, and its VP counts an ocean next to it, which belongs to nobody. "It owns it, yes, so it counts" (Nick) | 3344180, 3371131, 3350125 |
| Your cards counting MarsBot's tags or events | Its track positions stand in for played cards: Toll Station reads its tag tracks, Media Archives its event track. "You use the track position of the bot on the respective track for those" (Nick; rulebook A p.5 says the same) | 2883930 |
| Your cards counting cities on Mars | Count MarsBot's city tiles, not its city track; cards counting city tags read the track. "That card definitely counts actual city tiles. Look at the shape of the icon" (Dávid) | 3388199 |
| Reds ruling bonuses | The 2-player rules: your TR is compared with MarsBot's for lowest and highest, and MarsBot itself gains or loses nothing (rulebook C). "You're using the 2p setup rules basically" (Nick) | 3594202 |
| Bonus deck reshuffle | Only when a draw finds the bonus deck empty, so the last card drawn is part of it. "You reshuffle it whenever you need to draw a card from it and its empty" (Nick) | 3387297 |
| Shipping Lines (B19, B20) with no M€ | MarsBot can't lose the 1 M€, so the card does nothing and takes no Failed Action. "The bonus card just does nothing" (Nick, a best guess) | 3599965 |
| Draft with a draft priority | The log shows each card MarsBot keeps and the one it discards, as you would see its pile at the table (rulebook B p.2). "You have almost perfect knowledge, but not perfect control" (Nick) | 3542834 |
| Invasive Species (B02) and protected resources | Cards whose resources can't be removed, such as Pets, are skipped. "Animals protected by card effects are safe from the Invasive Species" (Nick) | 3684496 |
| Corporate Competition (B14) and a replacement that destroys itself | Destroyed during the action; only Corporate Competition is discarded. "If it says to destroy it, destroy it. That happens 'in-action'" (Nick) | 3350125 |
| Final greenery on a bad space | Used when it is the only legal space, even if it scores more for you. "If a bad scoring spot is the only option, it would do it anyway" (Nick) | 3404826 |
| Greenery at maximum oxygen | Not a Failed Action while a greenery space exists, since the tile still scores. "An action failure has to be an action that MarsBot gained no benefit from" (Nick) | 3350125 |
| City placement | Places the tile and takes the placement M€; no track moves unless the corporation says so (Tharsis Republic). "Unless a corporation ability says to do that of course" (Nick) | 3333348 |
| Ocean adjacency | 2 M€ per adjacent ocean tile. "2MC per adjacent ocean tile, just like a player" (Nick) | 3361315 |
| Generation limit | Round and generation are the same: MarsBot wins as generation 20 (18 with Prelude) begins, and a game that finishes terraforming in generation 19 completes that generation (Nick) | 3428220, 3379088 |
| Card over rulebook | A clear card wins over the rulebook, as Expedited Construction does. "It has been tested a lot more than the rulebook" (Dávid) | 3350125 |
| Starting M€ | None, unless MarsBot's corporation gives some. "It doesn't start with any M€" (Nick) | 3640302, 3340794 |
| Choosing corporation and preludes | Everything is chosen at once; the corporations are revealed and set up before any prelude is played, over rulebook B p.1's order (Nick) | 3622481 |
| Hard mode first-turn milestone | "2 or more" counts unclaimed milestones only. "Yes, it means unclaimed" (Nick) | 3365910 |
| Award price after MarsBot funds one | 8, 14, 20 M€ whoever funded the earlier awards. "Regardless of who funded the previous award" (Nick) | 3532698 |
| Venus 16% TR bonus | MarsBot gains 1 TR. "TR is as written: 1TR" (Nick) | 3358342 |
| Amazonis Planitia | Not offered with MarsBot: it has no MarsBot board. "Won't be automa compatible" (Nick) | 3148562 |
| MarsBot corporations | Only those marked with an expansion need it, and you don't need the matching human corporation (Dávid) | 3161277 |
| Ants against MarsBot | You may take microbes from MarsBot. "I'd say you can remove them for that effect" (Nick) | 3595110 |
| Mining Guild's M€ on the card | Not scored at game end. "MarsBot has not 'gained' them yet" (Nick) | 3553988 |
| Splice | You pick 2 M€ or a microbe for your microbe tag and MarsBot gains 2 M€ either way; MarsBot's own microbe tag gives it 4 M€ (Dávid) | 3148562 |
| Teractor | Any advance of the Earth track pays: an Earth tag, a tag sharing the row, or an effect that advances it. "Any other effect advancing the Earth track" (Dávid) | 3621937 |
| MarsBot's colony trade | Resets the colony's white cube as your trade does. "It should do the same as a player if not mentioned in the rules" (Nick) | 3401086, 3410612 |
| Failed Action M€ with Colonies | Goes to MarsBot's general supply, never a shipping board area. "Failed action MC always goes to the bot's general MC supply" (Nick) | 3555685 |
| A choice that falls to MarsBot | You make it, e.g. Icy Impactors' first-player choice. "If an effect or action asks for another player to decide something, then *you* get to make the choice" (Nick) | 3340756 |

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
| Nothing chains after the game ends | Once the game has ended, nothing advances MarsBot's tracks or draws a card for it, except the final greenery move itself. M€ gains and temperature steps still happen, so at a final greenery Thorgate's white cube draws no card but raises the temperature, and Aridor's cubes don't advance the event track | User decision; extends the Philares ruling (3513998) and Nick's no-chaining (3385156) |
| Mining Guild overflow | The rest of a gain comes off the refilled card, and a big gain can advance the building track more than once, until #18 | User decision; Nick: the card counts "every 10MC MarsBot gains" (3553988) |
| Aridor on a two-tag track | Both tags count alike: most matching tags wins, ties at random | User decision; rulebook B makes the priority a track |
| Rapid Sprouting (B23) with no greenery space | Ecoline's plant is spent anyway; no greenery and no Failed Action | User decision; a bonus card that can't resolve takes no Failed Action (rulebook A p.5) |
| Helion's white cube on another icon | It replaces only a temperature icon. On the Nova boards' city icons (Terra Cimmeria science #10, Vastitas Borealis power #5 and #9) MarsBot resolves a card and places the city | User decision; the card says "instead of raising the temperature" |
| Lakefront Resorts and Government Intervention | The M€ from Lakefront's building-track advance stays; its TR is still taken back | User decision; rulebook B's FAQ says Lakefront overrides Government Intervention's "no M€" |
| Sagitta's tagless card | Pays double the Failed Action: 10 M€ on Normal, 6 on Easy | User decision; the card reads "10MC (instead of 5MC)" |
| Mining Guild after the game ends | The card stops: M€ goes straight to MarsBot, with no building-track advance | User decision; matches the Philares ruling (3513998) |
| Manutech on Venus #12 | The extra advance off the end of the Venus track is a Failed Action | User decision; any advance on a maxed track is one |
| Polyphemos | Discards a project card with the fewest tags, never a bonus card | Kept; discarding the bonus card would turn the corp into a drawback |
| Aphrodite | 2 M€ per Venus step, so 4 M€ for a 2-step raise | Kept; the steps resolve one at a time (3431297) |
| Diversification (B28) | Loses up to 4 M€: all it has when it has less | Kept, user decision |
| Ecotec and board icons | A board icon advancing the microbe track is not a resolved microbe tag, so no plant | Kept; worded like Arklight (3535330) |
| Investors (B32) | The track to move back is picked before the advance | Kept; picking it after could undo the card's own advance |
| Build, Build, Build (B27 b) | The special tile ignores its own card's placement rules and needs only a space next to a player city | Kept, user decision |
| Thorgate's "first tag" | The leftmost printed tag. The event tag is printed rightmost, so it counts only on a card with no other tag | Kept; checked on card scans (Asteroid, Imported Hydrogen) |
| Nirgal and setup removals | A bonus card removed at setup is not destroyed, so it doesn't count for Land Specialist | Kept; same as Philares' setup removal |
