# Automa: official BGG rulings

184 rulings posted on BoardGameGeek by FryxGames, Stronghold Games and the Automa designers. [README.md](README.md) says who is who, how this was built, and what the tags mean. Under each heading the rulings run in date order, so a later one can overrule an earlier one.


## Open conflicts

Official answers that disagree, with no later post settling it.

- For the Tile placement tiebreaker, a06:26 says an exact multiple selects the last valid space, while a06:27 counts the first valid space as zero (leaving the difference unreconciled). Tile placement: [Nick, 2024-08-01](https://boardgamegeek.com/thread/3342916/article/44647961#44647961), Tile placement: [Dávid, 2024-08-14](https://boardgamegeek.com/thread/3342916/article/44709876#44709876)
- Both say Philares' MarsBot effect resolves immediately off-turn, but a13:1 allows it even after MarsBot passed or in the last production phase while a13:2 says probably not after the end of the game. Philares: [Nick, 2025-06-04](https://boardgamegeek.com/thread/3513998/article/46167832#46167832), Philares: [Dávid, 2025-06-04](https://boardgamegeek.com/thread/3513998/article/46170281#46170281)

## Rules


### Action deck

- **When building MarsBot's action deck by Draft Priority, are all non-matching cards discarded or just one?** Search its drafted pile for the first card that does NOT match a desired tag and discard only that one; once found, stop checking. Only one card is ever discarded; the wording ('until a card is discarded or all 4 have been checked') covers the case of several matching cards.  
  "You don't discard ALL non-matching cards." ([Nick, 2024-08-02](https://boardgamegeek.com/thread/3343494/article/44651810#44651810))

### Automa turn

- **What does a MarsBot/Automa turn consist of?** Flip a card, move tokens on tracks, take any actions passed on the tracks, and possibly trigger the corporation effect.  
  "Flip card, move tokens on tracks, take any actions passed on tracks, possibly trigger corporation effect." ([Nick, 2023-07-14](https://boardgamegeek.com/thread/3117436/article/42617182#42617182))

### B02 Invasive Species

- **When MarsBot's Invasive Species card says to remove the highest scoring cube, how is the highest scoring cube determined between cards that give different VP per cube (e.g. 1 VP per 3 cubes vs 1 VP per 4 cubes)?** Compare the VP value of a single cube: on a card giving 1 VP per 3 cubes each cube is worth 1/3 VP, on a card giving 1 VP per 4 cubes each is worth 1/4 VP, so a cube on the first card is the higher scoring cube. TDaver confirmed this reading.  
  "^^ confirmed." ([Dávid, 2024-09-02](https://boardgamegeek.com/thread/3360797/article/44801066#44801066))
- **Does Invasive Species consider cubes on cards that do not give VP (non-scoring cubes) when choosing which cube to remove?** It was meant to target scoring cubes first. Only target non-scoring cubes if there are no scoring cubes.  
  "It was meant to target scoring cubes first. Only target non-scoring cubes if there are no scoring cubes." ([Dávid, 2024-09-02](https://boardgamegeek.com/thread/3360797/article/44802509#44802509)) `intent`
- **Does the Invasive Species bonus card remove animals from Pets, which cannot lose animals?** No. Animals protected by card effects are safe from Invasive Species.  
  "Animals protected by card effects are safe from the Invasive Species, yes." ([Nick, 2026-03-28](https://boardgamegeek.com/thread/3684496/article/47482028#47482028))
- **What does bonus card B02 Invasive Species do given the animal and microbe share a track on the bot's mat?** The player (not the bot) must lose 1 animal or 1 microbe, a resource cube on one of the player's cards; if they have none, the card has no effect. The bot's animal/plant/microbe track is irrelevant.  
  "Card B02, "Invasive Species", says that you (the player, not the bot) must lose 1 animal or 1 microbe" ([Nick, 2026-09-05](https://boardgamegeek.com/thread/3763588/article/48141603#48141603))

### B03 Research and Development

- **If B03 Research and Development draws a project card with no tags, does MarsBot take a failed action?** Yes, the drawn card is resolved as a failed action, and that counts as completing the bonus card. The only failed actions directly on bonus cards are those printed on them, which occur only when the bonus action cannot be done.  
  "As you are able to resolve this card (as a failed action) the bonus card is complete." ([Nick, 2025-12-06](https://boardgamegeek.com/thread/3623553/article/46988681#46988681)) `inferred`

### B07 Local Neural Instance

- **How does MarsBot choose where to place the Local Neural Instance tile?** Among eligible hexes, pick the one with the most resources; if still tied, flip a card for the final tiebreak (the usual placement tiebreaker). On Tharsis there are very few eligible places.  
  "Yes, go for most resources, and yes, flip a card for a final tiebreak." ([Nick, 2024-07-31](https://boardgamegeek.com/thread/3342600/article/44642427#44642427)) `inferred`
- **In a greenery placement tiebreak with equal bonus icons, does MarsBot prefer the space adjacent to the Neural Instance tile?** From memory: one map has a milestone for special tiles, and on that map the Neural Instance has priority; otherwise the tiebreak is random (card flip).  
  "One of the maps has a milestone for special tiles - on that map the NI has priority. Rest, it'll be random." ([Dávid, 2024-07-31](https://boardgamegeek.com/thread/3342717/article/44643919#44643919)) `hedged`
- **If the rulebook does not mention a Neural Instance placement edge case for a map, which tiebreak applies?** Nick: if the rulebook doesn't mention it, go with the standard placement tiebreakers; he said he would confirm once he could check the rulebook.  
  "If it's not mentioned, go with standard placement tiebreakers. I'll confirm when I can check it." ([Nick, 2024-07-31](https://boardgamegeek.com/thread/3342717/article/44644788#44644788)) `hedged`
- **Does the Neural Instance tile count for the Landlord award for MarsBot?** Yes. MarsBot owns the Neural Instance tile, so it counts for Landlord; you can put a cube on it as a reminder.  
  "It owns it, yes, so it counts. You can put a cube on it if you want for an easy reminder." ([Nick, 2024-08-03](https://boardgamegeek.com/thread/3344180/article/44657604#44657604))
- **Does the Automa consider the Neural Instance tile a hex it owns when placing greeneries by tiebreak?** Yes, the Automa treats the Neural Instance tile as a hex it owns for greenery tiebreaks.  
  "Yes, it would consider that a hex "it owns" for greenery tiebreak." ([Nick, 2024-08-03](https://boardgamegeek.com/thread/3344180/article/44658740#44658740))
- **If Artificial Lake places an ocean next to the Neural Instance tile, does MarsBot get a point for that space?** Yes. MarsBot gets the point for that space, because the ocean tile does not belong to you (the player).  
  "Yes it does, as the ocean tile does not belong to [i]you[/i]." ([Nick, 2024-08-14](https://boardgamegeek.com/thread/3350125/article/44711805#44711805))
- **Is the Local Neural Instance card destroyed the first time it is seen, even if the tile cannot be placed?** Unsure at the time: the wording suggests the card is destroyed only if the placement works; if the bot cannot place the tile, the card is not destroyed (it would be drawn and resolved again later from the main deck as compensation). TDaver confirmed this reading separately.  
  "I feel like the wording is deliberate though, in that, the destroy only happens if the placement works" ([Nick, 2024-08-14](https://boardgamegeek.com/thread/3350125/article/44711805#44711805)) `hedged`
- **Is the LNI card destroyed only if the tile is actually placed?** TDaver confirms Nick's interpretation: the card is merely discarded (not destroyed) if the LNI tile cannot be placed.  
  "I confirm Nick's interpretation of LNI" ([Dávid, 2024-08-15](https://boardgamegeek.com/thread/3350125/article/44714350#44714350)) `inferred`
- **Is the Neural Instance tile considered owned by the bot for the Landlord award?** Yes, it counts. It is not a brown special tile for your card effects, but it is a brown tile when the bot needs it to be.  
  "It's not a (brown) special tile for your card effects, it is however a brown tile when the bot needs it to be." ([Dávid, 2024-08-25](https://boardgamegeek.com/thread/3356189/article/44762112#44762112))
- **Does the Local Neural Instance tile count as a tile owned by MarsBot for the Landlord award at game end and for the 'Find Closest Award' routine?** Yes, the Local Neural Instance tile counts as one tile owned by MarsBot for Landlord evaluation and for the Find Closest Award routine.  
  "Yes" ([Dávid, 2024-09-19](https://boardgamegeek.com/thread/3371131/article/44888855#44888855))
- **Does a space claimed with Land Claim count as a reserved area for placing the Neural Instance tile (not adjacent to reserved spaces)?** Dávid did not consider Land Claim/Arcadia when writing the Neural Instance wording; he says he'd probably rule that only printed reserved spaces (oceans and Noctis) count, so a Land Claim space would not, since the intent is to not make it flatly impossible for the player to build around the Neural Instance. The Neural Instance still can't be placed onto a hex holding a cube (illegal placement), so on maps with few legal spots the player can use these cards and well-placed tiles to steer its placement or block all its legal spots.  
  "I'd probably rule (and tweak the wording, or mention in the faq) to include only printed reserved spaces (oceans and noctis)." ([Dávid, 2024-11-16](https://boardgamegeek.com/thread/3406056/article/45189810#45189810)) `intent` `hedged`
- **Does Nick Shaw agree that only printed reserved spaces (oceans and Noctis) count as reserved for Neural Instance placement, and that the Land Claim space does not?** Yes, he agreed on all points of TDaver's ruling: only printed reserved spaces count, and players must not build onto hexes with a cube.  
  "Yes, I'd agree on all points there." ([Nick, 2024-11-16](https://boardgamegeek.com/thread/3406056/article/45190000#45190000)) `intent` `inferred`
- **Is the Local Neural Instance tile a special tile for card effects like Red Ships?** The exception was not made on purpose: the tile was designed as not a special tile, and only counts as special for the bot's own purposes (the award needing tiles next to special tiles) so that the bot punishes ignoring it but the player is not rewarded for building next to it. Red Ships did not exist when the rule was written.  
  "I didn't make it an exception on purpose. It was originally designed as not a special tile." ([Dávid, 2024-12-02](https://boardgamegeek.com/thread/3415037/article/45270151#45270151)) `intent`
- **Is it fair to count the Local Neural Instance as a tile owned by MarsBot in all circumstances, and as a special tile only when MarsBot needs it to be?** TDaver accepted the proposal (the tile is always owned by MarsBot, and counts as special/brown only when the bot needs it, e.g. the Founder award on Terra Cimmeria), apparently including the Red Ships case; the proposal text is cut off in the packet.  
  "Let's go with yes, it makes sense" ([Dávid, 2024-12-02](https://boardgamegeek.com/thread/3415037/article/45271240#45271240)) `hedged` `inferred`
- **Once an ocean has been placed on a space reserved for oceans, does that space still count as reserved for Local Neural Instance placement?** No, a placed ocean no longer counts as a reserved space, but it does count as a tile for the 'not next to any other tile' restriction.  
  "1) No. But it does count as a tile for the "not next to any other tile" additional restriction." ([Nick, 2025-01-08](https://boardgamegeek.com/thread/3436886/article/45449324#45449324))

### B14 Corporate Competition

- **If a replacement bonus card would otherwise be destroyed, is it still destroyed?** Yes: if the card says to destroy it, destroy it; that happens in-action. The 'discard both cards' step happens after the action resolves, so only the one remaining card is discarded; the destroyed card does not go to the discard pile.  
  "Yes, if it says to destroy it, destroy it. That happens "in-action"." ([Nick, 2024-08-14](https://boardgamegeek.com/thread/3350125/article/44711805#44711805))
- **When Corporate Competition makes MarsBot help its position and advance on a track, does it also resolve the new track space (actions such as placing an ocean or claiming a milestone, failed action 5 M€, and bonuses such as floaters), or only advance?** The official answer to the three options was 'full thing', read as: MarsBot resolves everything on the new track position (its action and any bonus), not only the advance. The reply does not spell out the failed-action 5 M€ detail.  
  "full thing" ([Dávid, 2024-09-22](https://boardgamegeek.com/thread/3372972/article/44903724#44903724)) `hedged` `inferred`
- **What does MarsBot do with Corporate Competition if no award has been funded, and which award does it choose if it leads in all funded awards?** Endorsed: if no awards are funded, another bonus card is drawn and played. If MarsBot leads in all funded awards, it chooses the one it leads by the closest margin.  
  "What Tim said" ([Dávid, 2024-12-31](https://boardgamegeek.com/thread/3431121/article/45404998#45404998))
- **Is it intentional that B14 Corporate Competition does not mention the Venuphile 'Advance the Venus track' helper action like other Corporate Competitions?** No, it is not intentional; the omission is a mistake. The fix is not spelled out beyond that.  
  "No." ([Dávid, 2026-01-08](https://boardgamegeek.com/thread/3641200/article/47125120#47125120)) `intent` `inferred`
- **For Corporate Competition helpers that reveal cards until one matches, does MarsBot keep going through the whole deck, reshuffling the discards if needed?** Yes, keep going through the deck (reshuffling discards as needed) for the bot, as a player would.  
  "That's what I do as a player, so yes, do that for the bot too." ([Nick, 2026-10-13](https://boardgamegeek.com/thread/3781613/article/48285590#48285590))

### B18 Outer System Foothold

- **When the bonus card Outer System Foothold (B18) selects the Europa colony tile, which has no resource for the Shipping Board, how is it resolved?** Follow the rulebook: MarsBot places just 1 ocean (and gets the corresponding TR).  
  "Follow the rulebook in this case: place just 1 ocean (and it gets the corresponding TR)." ([Nick, 2025-03-13](https://boardgamegeek.com/thread/3477621/article/45798060#45798060))
- **On Europa via Outer System Foothold, does MarsBot get 1 TR for the ocean in addition to a separate TR bonus?** No. The 1 TR is the usual reward for actually placing the ocean (when it is not a failed action), not an extra bonus.  
  "Correct, it's the usual reward for placing an ocean, not an extra bonus!." ([Nick, 2025-03-13](https://boardgamegeek.com/thread/3477621/article/45798193#45798193))

### B19 Shipping Lines

- **With Colonies, from the second generation on, is Shipping Lines (B-19) added on top of the usual 3 project cards plus 1 bonus card in MarsBot's action deck, or does it replace one of them?** It is in addition to the usual bot hand construction: it is added after the hand is constructed, so MarsBot's action deck has 5 cards.  
  "It's in addition to the usual bot hand construction, as it's added after that is constructed, thus it'll have 5 cards in its hand" ([Nick, 2024-12-01](https://boardgamegeek.com/thread/3415477/article/45269136#45269136))
- **If MarsBot draws a bonus card requiring it to pay 1 MC for trading (Shipping Lines) while having no MC, does it take a failed action?** Nick's best guess, without the rules to hand and offering to amend if the rules disagree: if the bonus card doesn't say it takes a failed action on failure, the bonus card just does nothing, and the bot does not take a failed action.  
  "If the bonus card doesn't say it takes a failed action on failure, the bonus card just does nothing (so bot doesn't take a failed action)." ([Nick, 2025-10-27](https://boardgamegeek.com/thread/3599965/article/46800194#46800194)) `hedged` `inferred`

### Benefactor (award)

- **Why does MarsBot's Benefactor award use the automa's TR minus 15 compared to the player's TR?** Dávid did not state the reason for the offset directly. He said the automa should normally have a 10-30 TR lead over the player (which the player closes with card VP); if it doesn't, the player is either playing a very aggressive terraforming game that ends early, in which case Benefactor should be super easy, or getting a rule wrong somewhere. (Inferred: the -15 reflects that expected lead.)  
  "If the automa doesn't have a 10-30 TR lead ahead of you (that you're then closing on cards VP), then either you're playing a very good aggressive Terraforming game" ([Dávid, 2024-11-18](https://boardgamegeek.com/thread/3407235/article/45199685#45199685)) `intent` `inferred`

### Bonus cards

- **When is the MarsBot bonus card discard pile shuffled back into the bonus deck?** Reshuffle it whenever you need to draw a bonus card and the deck is empty (not at a fixed phase such as Research).  
  "You reshuffle it whenever you need to draw a card from it and its empty." ([Nick, 2024-10-15](https://boardgamegeek.com/thread/3387297/article/45021597#45021597))

### Colonies

- **Why do only some MarsBot boards show a 'build a colony' icon when playing with Colonies?** Only one map has a Colonies-specific milestone/award, so only that board's tracks have the extra colony building. The bot handles regular Colonies support via the sideboard and the cards; nothing is missing.  
  "Only one map has Colonies specific milestone/award, so only that board's tracks has extra colony building. The bot handles its "regular" Colonies support via the sideboard and the cards." ([Dávid, 2024-08-17](https://boardgamegeek.com/thread/3351972/article/44726649#44726649))
- **When MarsBot trades with a colony, is the colony's white cube reduced to the minimum value as when a player trades?** Yes, the white cube resets exactly as it would when a player trades with a colony.  
  "Yes, it resets exactly like it would when a player trades with a colony." ([Nick, 2024-11-07](https://boardgamegeek.com/thread/3401086/article/45144232#45144232))
- **Are the resource cubes MarsBot has left on its Colonies board counted at final scoring?** Designer intent, omitted from the rulebook: those remaining cubes score half a VP each.  
  "I intended to make those cubes score half a vp each (that's how i played it), but I totally forgot to write it in the rulebook" ([Dávid, 2024-11-20](https://boardgamegeek.com/thread/3408751/article/45211997#45211997)) `intent`
- **Does MarsBot reset the white cube to the left-most position when it trades with a colony?** Yes. Where the rules are silent MarsBot does the same as a player, so a trade resets the white cube to the left-most position.  
  "It should do the same as a player if not mentioned in the rules, so a trade should indeed reset the white cube back to the left-most position." ([Nick, 2024-11-23](https://boardgamegeek.com/thread/3410612/article/45229424#45229424))
- **What does the white arrow on the MarsBot board holder near the energy track mean?** It is a reminder to add the second trade fleet to MarsBot when playing with the Colonies expansion.  
  "Correct, exactly that." ([Nick, 2024-11-26](https://boardgamegeek.com/thread/3412209/article/45242315#45242315))
- **With Colonies, does the MC MarsBot gets from a failed action go into the container for a colony?** No. MC from a failed action always goes to MarsBot's general MC supply.  
  "No, failed action MC always goes to the bot's general MC supply." ([Nick, 2025-08-08](https://boardgamegeek.com/thread/3555685/article/46442713#46442713))
- **With the Colonies MarsBot board, does MarsBot get resources other than floaters from placement bonuses instead of MC?** Nick's best guess, without the rules to hand and offering to amend if the rules disagree: no, using the Colonies MarsBot board does not change this; MarsBot still gets M€ from placement bonuses.  
  "1. No (you assumed correctly)." ([Nick, 2025-10-27](https://boardgamegeek.com/thread/3599965/article/46800194#46800194)) `hedged`

### Corporations

- **Do the Automa's bot corporations require an expansion or owning the matching human corporation?** Most of the 40+ bot corporations do not require an expansion, and you do not need to own the human equivalent corporation to use them.  
  "most of which don't require an expansion (and you don't need to own the "human equivalent" of the corporation either to use them)." ([Dávid, 2023-09-28](https://boardgamegeek.com/thread/3161277/article/43025033#43025033))
- **When does an effect marked 'Before the Action Phase' on the automa's corporation card trigger?** Probably before any actions have been taken that round, by the player or the bot.  
  "Pretty sure it means before any actions have been taken that round, player OR bot." ([Nick, 2026-07-16](https://boardgamegeek.com/thread/3738284/article/47934161#47934161)) `hedged` `superseded` by [a later post](https://boardgamegeek.com/thread/3738284/article/47936614#47936614)
- **When does an effect marked 'Before the Action Phase' on the automa's corporation card trigger?** At the start of the round: after the card draft phase but before ANY actions are taken in the Action Phase, by anyone.  
  "So it should be performed before ANY actions are taken in the Action Phase." ([Nick, 2026-07-17](https://boardgamegeek.com/thread/3738284/article/47936614#47936614))

### Counting MarsBot tiles

- **For a player card that counts cities (1 M€ per city on Mars via an energy action), does it count MarsBot's real city tiles or its city track?** Njshaw2 would play it as applying to all of MarsBot's actual cities on Mars, not its city track, as the track would be too beneficial for the player.  
  "I would play that as applying to all the bot's actual cities on mars, not its city track. The latter would likely be too beneficial for you." ([Nick, 2024-10-16](https://boardgamegeek.com/thread/3388199/article/45030483#45030483)) `hedged`
- **Does the card giving 1 M€ per city on Mars count actual city tiles for MarsBot rather than the city track?** Yes, that card counts actual city tiles on the board, as shown by the city-tile shape of its icon.  
  "Yes, that card definitely counts actual city tiles. Look at the shape of the icon." ([Dávid, 2024-10-17](https://boardgamegeek.com/thread/3388199/article/45031998#45031998))

### Difficulty and variants

- **Is there a difficulty modifier that raises MarsBot's award evaluation?** An optional difficulty modifier adds +10 to MarsBot's track value for the Banker, Thermalist and Miner awards when evaluating awards. It can be used with or without any other difficulty modifiers.  
  "Added difficulty modifier for increasing Award evaluation values for MarsBot for Banker, Thermalist and Miner, all +10 to the track value." ([Nick, 2022-06-21](https://boardgamegeek.com/thread/2883930/article/40306602#40306602)) `prototype`
- **Does the +10 award modifier apply to MarsBot's tag-track total only for award evaluation?** Yes. Wherever the MarsBot is on the tag track, the modifier is added for that total just for the award evaluation.  
  "Correct, just for the award evaluation." ([Nick, 2022-07-07](https://boardgamegeek.com/thread/2883930/article/40401057#40401057)) `prototype`
- **How can MarsBot be made easier?** Untested options offered at your own risk: do not score its failed action cubes at all; regress the respective track twice whenever you decrease something for an opponent; start it with 2 cards instead of 4 (possibly for the first 3 rounds, before going up to 4 per round).  
  "Simple tweaks to make it simpler (I've not tried any of them so use at your own risk!):" ([Nick, 2022-09-15](https://boardgamegeek.com/thread/2883930/article/40801415#40801415)) `prototype` `hedged`
- **Is there an official way to make MarsBot score higher when the player gets strong Colonies/Venus/Prelude 2 combos?** The designers considered an optional compensation, not in the rulebook: convert M€ to VP as usual, then add VP equal to half (rounded down) of the total number of other resources MarsBot has (floaters on the Venus board and resources on the Colonies shipping board).  
  "Megacredits is converted to VP as per usual, but sum up the total number of other resources MarsBot has (floaters on the Venus board and other stuff on the Colonies shipping board), and half it (rounded down), and it gets that much more VP." ([Dávid, 2024-09-24](https://boardgamegeek.com/thread/3373832/article/44911323#44911323)) `variant`
- **On Brutal difficulty (4 starting project cards instead of 3, keeps all 4 acquired in Research), is the intent that MarsBot never discards project cards and acquires one more before the first generation?** Yes, that interpretation of Brutal difficulty is correct: MarsBot never discards project cards and gets one extra project card before the first generation.  
  "Yes your interpretation of Brutal difficulty is correct." ([Dávid, 2024-11-16](https://boardgamegeek.com/thread/3406056/article/45189813#45189813))
- **Would the variant where the first player raises one global parameter without reward at the end of each generation work against the Automa?** Left open: it might affect balance but is hard to say without testing; they suggest trying it.  
  "It might affect balance, but hard to say without testing it. Give it a try and see!" ([Nick, 2026-02-09](https://boardgamegeek.com/thread/3659281/article/47272985#47272985)) `variant` `hedged` `house-rule-ok`
- **Can MarsBot place special tiles when it draws a card that places one?** Not in the official rules (rejected in development for rules overhead). If you want it, have MarsBot place the tile randomly within the tile's placement restrictions; or, for more specific choices, place it adjacent to an ocean, then adjacent to as many of the player's city and plant tiles as possible, whatever screws the player most.  
  "just have them place the tile randomly (within the tile's placement restrictions) if a card comes up wanting to place one." ([Nick, 2026-02-23](https://boardgamegeek.com/thread/3666965/article/47335754#47335754)) `variant` `house-rule-ok`

### Direct interaction with MarsBot

- **Does MarsBot threaten the player's greeneries (asteroids/plant removal) as in multiplayer?** TDaver says the newer versions of the MarsBot (the version later published) have this and much more.  
  "The newer versions of the MarsBot has this and much much more." ([Dávid, 2023-01-26](https://boardgamegeek.com/thread/2883930/article/41595241#41595241)) `prototype` `inferred`
- **If an effect lets the first player choose where the human places a tile (Icy Impactors) and MarsBot is first player, how does the bot decide?** In general, if an effect or action asks another player to decide something and that player is the bot, the human player makes the choice instead. The author was not certain this wording made the final ruleset.  
  "Generally I think we said that if an effect or action asks for another player to decide something, then *you* get to make the choice instead." ([Nick, 2024-07-28](https://boardgamegeek.com/thread/3340756/article/44625536#44625536)) `hedged`
- **If an effect lets the first player choose where the human places a tile (Icy Impactors) and MarsBot is first player, does the human make the choice instead?** Confirmed: when an effect asks another player to decide and that player is the bot, the human player makes the choice.  
  "I agree." ([Dávid, 2024-07-28](https://boardgamegeek.com/thread/3340756/article/44625988#44625988))
- **When an effect asks to decrease any player's production by several steps (e.g. Heat Trappers, 2 heat), does MarsBot's tracker move back one space or the full amount?** Treat MarsBot like any other player: move its corresponding track back by the full number of steps the effect requires, not just one space.  
  "Common sense is right" ([Dávid, 2024-08-24](https://boardgamegeek.com/thread/3355768/article/44758514#44758514)) `inferred`

### Drafting

- **Is MarsBot's draft priority tiebreak order: most 1st-priority tags, then most 2nd-priority tags, then most 3rd-priority tags, then random?** Confirmed: tiebreaker 1 is the card with the most 1st priority tags, 2 the most 2nd priority tags, 3 the most 3rd priority tags, and 4 is random.  
  "Confirmed." ([Nick, 2024-11-02](https://boardgamegeek.com/thread/3398289/article/45118494#45118494))
- **With a MarsBot corporation that has a draft priority, one drafted card is set aside before forming the action deck, but a card with a priority label cannot be chosen; what if all 4 drafted cards have a priority label?** From the cards with the most matching tags, discard whichever has the fewest matches; if all are tied, shuffle and discard one. In effect one of the drafted cards is always discarded.  
  "from the ones with most matching tags, discard whichever has least matches, shuffling and discarding one if all tied. Basically it will always end up discarding one card from those drafted." ([Nick, 2024-11-02](https://boardgamegeek.com/thread/3398289/article/45118494#45118494))
- **When drafting with MarsBot, are the two piles of 4 cards drawn face up or face down, and are they kept face down when MarsBot has no draft priority?** Draw them face down, and keep MarsBot's pile face down if it has no draft priority, keeping information as hidden as possible. MarsBot's bonus cards may be discarded face up; only the general discard is meant to be face down (per the base game rules) so as not to give info to other players.  
  "Face down. Keep face down if bot doesn't have a draft priority. Basically keep the info as hidden as you can." ([Nick, 2024-11-05](https://boardgamegeek.com/thread/3399837/article/45132146#45132146))
- **Is it intentional that the human sees all cards MarsBot is dealt when it drafts with a draft priority, giving the player a knowledge advantage and allowing hate drafting?** Yes. It was intentional, tested and balanced: the player has almost perfect knowledge but not perfect control of what the bot ends up with, and hate drafting against the bot is actively encouraged.  
  "You have almost perfect knowledge, but not perfect control of what the bot will end up with." ([Nick, 2025-07-15](https://boardgamegeek.com/thread/3542834/article/46336409#46336409)) `intent`
- **When drafting with tag priorities, if all 4 cards match does MarsBot discard nothing (rulebook) or always discard one?** MarsBot should always discard 1 card from its drafted set; the rulebook text was missed during proofing.  
  "It should always discard 1 from its drafted set. This was missed during proofing the rules." ([Nick, 2026-10-13](https://boardgamegeek.com/thread/3781613/article/48285590#48285590)) `erratum`

### Expansion compatibility

- **Does the Automa support the other expansions?** Yes. It incorporates all of the expansions, and they are hot-swappable: any mix can be included.  
  "Hard to really outline HOW it incorporates them, just know that it DOES incorporate them all, and they're all "hot-swappable" - you can include any, all, whatever mix." ([Nick, 2023-07-14](https://boardgamegeek.com/thread/3117436/article/42617172#42617172))
- **Why doesn't MarsBot plan for or respond to Turmoil global events?** The designers tried getting the automa to plan for / respond to global events, but it became a nightmare of if/then flowcharts, different for almost every event card, which would have bogged the player down in bot upkeep and lengthened the rulebook, so it was left out. Nick agreed with a user's assessment that Turmoil is swingy because only the player is affected by events, and added that 2p Turmoil is inherently swingy.  
  "We did try getting the automa to plan for / respond to the global events but it became a nightmare of if/then flowcharts" ([Nick, 2024-11-16](https://boardgamegeek.com/thread/3405727/article/45190014#45190014)) `intent`

### Extra players and multiple bots

- **Can you play against multiple Automas?** Not tested. It would require duplicating cards, and TDaver suspects the game length and VP compensation math would be way off.  
  "We have not tested against multiple automas." ([Dávid, 2023-07-16](https://boardgamegeek.com/thread/3117436/article/42624013#42624013)) `intent` `hedged`
- **Can the Automa be used as a third player in a 2-player game?** Not designed or tested for that. It may work mechanically, but it is expected to be swingy (strong early, scoring poorly late because its point compensation assumes 10-13 generation games) and it distorts drafting. Not recommended.  
  "We didn't design it or test it for this purpose, but I see no reason why it couldn't work... However I wouldn't." ([Dávid, 2023-07-26](https://boardgamegeek.com/thread/3124531/article/42680998#42680998)) `intent`
- **Can the Automa be used as a third player in a 2-player game?** Technically it works but is not officially supported: game length makes it swingier (early boost more relevant, game-length M€ compensation less relevant) and it changes drafting dynamics.  
  "Bottom line: it's not officially supported, but it's not impossible to try." ([Dávid, 2023-09-20](https://boardgamegeek.com/thread/3152559/article/42981306#42981306)) `intent`
- **Can a 3-player game be simulated with one player and two Automa bots?** Not supported: it would need two copies of the Automa and retesting of the game-length VP scaling and tile-placement ratios, otherwise the bots score too little from card VP or fill the board too fast. Interactions were designed for one bot.  
  "You would need to buy 2 copies of the automa expansion the very least, and then retest all the game length VP-scaling and tile-placing ratios" ([Dávid, 2024-07-10](https://boardgamegeek.com/thread/3331658/article/44543843#44543843)) `intent`
- **Can the Automa be used in a 2-player game as a third player?** Not recommended: its scoring curve is tuned to 2-player game length, it is likely to score very low VP in 3 players but may create map placement bottlenecks too early. For a serious third opponent much more than targeting rules would be needed.  
  "The scoring curve of the Mars bot is fine-tuned to the 2p game length. It is likely to be extremely weak VP wise in 3p, but might create map placement bottlenecks too early for a 3p game." ([Dávid, 2024-08-16](https://boardgamegeek.com/thread/3351640/article/44724420#44724420)) `intent`
- **Can the Automa be set as an extra third or fourth player?** No, not supported. Its pacing is set for a 2-player game and it was only tested for solo; it may be too fast or too slow for other player counts.  
  "Basic answer: No. Longer answer: You could try it, but the pacing of the automa is set for a 2 player game" ([Nick, 2024-09-29](https://boardgamegeek.com/thread/3357549/article/44939504#44939504)) `intent`
- **Can the MarsBot be used in games with two human players, or can two bots be run?** One bot with 2 human players works easily but is balanced for 2 players, not 3. Running 2 bots needs 2 copies of the bonus cards and there is no rule for how a bot targets another player when there are multiple opponents. Without a bot corporation and bonus cards it runs very quickly.  
  "But yes, you can run a single bot with 2 human players quite easily, just note it's balanced for 2p, not 3p, so your milage may vary." ([Nick, 2024-12-09](https://boardgamegeek.com/thread/3419915/article/45309775#45309775)) `variant` `house-rule-ok`

### Failed actions

- **If oxygen is maxed out and a greenery action is called for, is it a failed action because the bot cannot raise the parameter?** No. As long as the bot can place the greenery it gained some benefit (1 VP and possible points for neighbouring cities), so it is not a failed action. A failed action is one where the bot gains no benefit, e.g. raising temperature at max.  
  "An action failure has to be an action that MarsBot gained no benefit from" ([Nick, 2024-08-14](https://boardgamegeek.com/thread/3350125/article/44711805#44711805))
- **When a corporation effect tells MarsBot to raise the temperature that is already maxed, is that a Failed Action?** Nick wouldn't count a corporation effect like that as an action in its own right, so he doesn't think it's a failed action; it could depend on the corporation if one reads like a specific bonus action rather than a reactionary effect.  
  "I wouldn't count a corp effect like that as an "action" in its own right, so I don't think that's a failed action." ([Nick, 2026-10-13](https://boardgamegeek.com/thread/3781613/article/48285468#48285468)) `hedged`

### Final greenery

- **At the end of the game, if a MarsBot track tracker is just before several consecutive greenery spaces, does it place a greenery for each of them (chained)?** No. Only the greenery symbol immediately adjacent (directly ahead) to the tracker counts for the final greenery; it is not chained along the track.  
  "The idea was just the immediately adjacent greenery symbols, not chained." ([Nick, 2024-10-12](https://boardgamegeek.com/thread/3385156/article/45006817#45006817))
- **If MarsBot cannot place a final greenery because no board space is available, does it gain 5 M€ instead?** Nick quoted a user's suggestion (tiles aren't meant to be limited, but board space may be, so treat the attempted placement as a failed action) and said a failed action would make sense, noting the player in the same spot gets no compensation for the lack of space; in general, if it's good for the bot and bad for the player, that's probably the right thing. He has never seen the board 100% full.  
  "A failed action in this situation would make sense, although presumably the player would have the same limited access and they'd get no compensation for the lack of space to place a greenery." ([Nick, 2024-11-14](https://boardgamegeek.com/thread/3404826/article/45178788#45178788)) `hedged`
- **Does MarsBot avoid a final greenery spot that gives more points to opponents' adjacent cities than to itself?** No. MarsBot does not consider that; if a bad scoring spot is the only option, it places the greenery there anyway.  
  "The bot doesn't take this into consideration, of course. If a bad scoring spot is the only option, it would do it anyway." ([Nick, 2024-11-14](https://boardgamegeek.com/thread/3404826/article/45178788#45178788))
- **If MarsBot's greenery track was moved back (production decrease) from 13 to 12 and space 13 has a greenery icon it already used, does MarsBot place a final greenery for it?** Njshaw2 would rule no effect: the covered icon is effectively not there any more.  
  "I would rule that as no effect, as the covered icon is effectively "not there" any more." ([Nick, 2025-05-18](https://boardgamegeek.com/thread/3513769/article/46097896#46097896)) `hedged`
- **Does MarsBot place a final greenery for a greenery icon it previously used when its track was moved back and the icon is covered?** No: TDaver agrees with Nick Shaw that this has no effect because the covered icon is effectively not there any more.  
  "And I would agree" ([Dávid, 2025-05-18](https://boardgamegeek.com/thread/3513769/article/46099173#46099173))
- **Does MarsBot get a final greenery from a track that regressed from a greenery space and has not re-advanced to it?** No. They believe it was ruled before that MarsBot does not get the final greenery in that case.  
  "I believe we ruled before that it does not get it, but I'm sure Nick will be along to confirm." ([Dávid, 2025-09-21](https://boardgamegeek.com/thread/3579630/article/46636358#46636358)) `hedged`
- **Does MarsBot get a final greenery from a track that regressed from a greenery space and has not re-advanced to it?** No. If MarsBot already triggered that greenery space but regressed for any reason, it does not get the final greenery at game end.  
  "if it's already triggered that space, but regressed for whatever reason, we ruled that it doesn't get it at game end." ([Nick, 2025-09-21](https://boardgamegeek.com/thread/3579630/article/46636825#46636825))
- **Does MarsBot's final greenery movement count as advancing the track for corporation effects, and do cubes that draw cards or advance further tracks trigger?** The final greenery is meant to replicate a player getting just enough plants from final production, so Nick does not move the tracking cube but just counts how many tracks have a greenery next to them. If a corporation gains something from the plant track movement, he would probably give MarsBot that bonus; either way is up to you, a difficulty modifier. The follow-up about draw-a-card and chained advances is not answered.  
  "If corps gain something off the back of a plant track movement though, I would probably give marsbot that bonus, as a player playing such a corp would get it too." ([Nick, 2026-10-13](https://boardgamegeek.com/thread/3781613/article/48285468#48285468)) `hedged` `house-rule-ok`
- **Is a final greenery with no legal space left a Failed Action, and does the tracker still move?** Yes, they would say it is a failed action: it represents a sub-optimal play by MarsBot through no fault of its own. Whether the tracker moves is not addressed.  
  "Yeah, I think I'd say that's a failed action." ([Nick, 2026-10-13](https://boardgamegeek.com/thread/3781613/article/48285468#48285468)) `hedged`

### Final scoring

- **Do the VP printed on MarsBot's cards count at the end of the game?** In normal mode they are worth nothing, since MarsBot gets compensation through its failed-action cubes. One of the difficulty modifiers includes those card VP.  
  "Correct. One of the difficulty modifiers is including those VPs. I kept it out of the normal mode as it can be quite swingy" ([Nick, 2022-07-07](https://boardgamegeek.com/thread/2883930/article/40401057#40401057)) `prototype`
- **Should the End Game rules state that MarsBot does not score points printed on cards in normal mode?** njshaw2 agreed ('Good idea') to mention under End Game that in normal mode MarsBot does not score points printed on cards, which may optionally be scored on higher difficulty.  
  "Good idea." ([Nick, 2022-10-29](https://boardgamegeek.com/thread/2883930/article/41064213#41064213)) `prototype` `inferred`
- **Does MarsBot score the board at game end (greeneries and cities)?** Yes, MarsBot scores for the cities and greenery tiles it placed. It also scores end-game M€, which is lower the faster the game ends.  
  "Yep. It simulates 2p which, in a battle between good players, will be scoring in the 100+ range most of the time." ([Nick, 2024-08-03](https://boardgamegeek.com/thread/3344164/article/44657623#44657623)) `inferred`
- **Does MarsBot score VP for greeneries and cities on the map?** Yes. MarsBot scores everything on the map like a player: greenery tiles, cities (adjacent greeneries), and any milestones and awards it got. It does not score VPs on cards, unless higher difficulty levels are used.  
  "Yes, marsbot scores all things on the map like a player: greenery, cities, and any milestones & awards it got. It just doesn't score VPs on cards (unless using the higher difficulty levels)." ([Nick, 2025-07-26](https://boardgamegeek.com/thread/3548612/article/46383274#46383274))
- **Does MarsBot score VP printed on cards on harder difficulty?** Yes; on harder difficulty MarsBot also scores flat VPs on cards.  
  "(Tbf, on harder difficulty, it does [i]also[/i] score for flat vps." ([Dávid, 2026-06-17](https://boardgamegeek.com/thread/3724743/article/47820279#47820279))

### Floaters

- **If the bot's Hellas track shows a floater icon and Venus Next is not used, does the bot gain 1 M€ or nothing?** Ignore the floater icon if not using Venus Next. (Later posts in the thread refine this: Colonies makes it count, but not without the Titan colony.)  
  "You ignore that icon if you're not using Venus Next." ([Nick, 2024-07-29](https://boardgamegeek.com/thread/3341542/article/44631596#44631596)) `reversed` `superseded` by [a later post](https://boardgamegeek.com/thread/3341542/article/46533573#46533573)
- **The Colonies gameplay-changes section says 'follow the rules for spending floaters as written above'; what does 'above' refer to?** 'Above' was meant to point at wherever the Venus Next floater-spending rules are, i.e. 'previously explained'; the odd wording may be an artefact of splitting the rulebook into three parts.  
  "'Above' was meant to cover wherever the Venus Next rules are (I think they're in the same rulebook though? - in which case "above" means "previously explained"." ([Nick, 2024-09-29](https://boardgamegeek.com/thread/3376814/article/44939499#44939499)) `erratum` `hedged`
- **What does the little cloud symbol on MarsBot cards mean?** It represents floaters, a Venus Next resource, and is only relevant when playing with Venus Next.  
  "They're only relevant when including Venus Next expansion. (The icon represents floaters, which are a new resource introduced in Venus next)." ([Nick, 2024-12-01](https://boardgamegeek.com/thread/3415280/article/45267693#45267693))
- **When MarsBot gains floaters on a track and Colonies or Venus Next is not in play, how is the icon resolved (as MC, or as a failed action)?** If neither Colonies nor Venus Next is used, the floaters icon has no effect: ignore it entirely, so it is neither a failed action nor converted to MC.  
  "If you're not using Colonies or Venus Next, then the floaters icon has no effect (it's like it's not there, so no failed action, and no MC). Literally ignore the icon on its tracks." ([Nick, 2025-05-10](https://boardgamegeek.com/thread/3509922/article/46065996#46065996))
- **If Venus Next is not used but Colonies is, is the floater icon on the bot's track still ignored?** No: only ignore the floater icon if not using an expansion that uses floaters. If Colonies is in use, the icon counts. A later post narrows this: it counts only if the Titan colony is in play.  
  "No, only ignore it if not using an expansion using it. If using Colonies, then the icon counts." ([Nick, 2025-08-28](https://boardgamegeek.com/thread/3341542/article/46533573#46533573)) `reversed` `superseded` by [a later post](https://boardgamegeek.com/thread/3341542/article/48133401#48133401)
- **Do floaters on the bot's main track count if Colonies is used but the Titan colony is not in the game and Venus Next is not used?** No: if the Titan colony is not used and Venus Next is not used, floaters can be ignored.  
  "If you're not using the Titan colony, *and* not using Venus Next, floaters can also be ignored then" ([Nick, 2026-09-03](https://boardgamegeek.com/thread/3341542/article/48133401#48133401))
- **In Colonies without Venus when Titan isn't in play, can floater corporations (Celestic, Stormcraft, Viron) still keep floaters?** Nick's earlier 'ignore floaters' answer was about Titan itself, not corporations. He guesses corporations can still use floaters, as floaters still exist as a resource type for some cards/corps for human players even without Colonies/Venus. He did not say where the floaters are stored.  
  "Corps can still utilise floaters I guess, as they still "exist" as resource types for some cards/corps for human players too" ([Nick, 2026-10-13](https://boardgamegeek.com/thread/3781613/article/48285590#48285590)) `hedged`

### Game length and end of game

- **Why does the Automa make the player lose if the game is not finished by generation 20 (18 with Prelude)?** The failsafe maximum generation (20, or 18 with Prelude) exists so a player cannot ignore terraforming and keep building an engine forever; together with the bot's continually rising VP ratio for its money it encourages balancing terraforming and VP gain. Average game end is about generation 14 without Prelude and 12 with.  
  "So I needed to counter that strategy. This was done by having a failsafe max generation, and a continually increase VP ratio for the bot's money." ([Nick, 2023-09-18](https://boardgamegeek.com/thread/3155761/article/42972900#42972900)) `intent`
- **Does the Automa remove the 14-generation limit of the base solo game?** Yes: an Automa game is a full game of Terraforming Mars rather than a 14-generation challenge. MarsBot does have a limit of 20 generations, intended only as a guard against regressive strategies.  
  "You are playing an actual, full game of TfM, not a 14 turn challenge, as in the base solo mode. MarsBot does have a limit of 20 turns, but that's just against regressive strategies." ([Dávid, 2024-06-22](https://boardgamegeek.com/thread/3123256/article/44459256#44459256))
- **Is the MarsBot rule that you lose when the game reaches round 20 a real clock to race against?** No. It is a 'this should never happen' failsafe so there is an answer for what happens at generation 20; no playtest went beyond round 15.  
  "It's a "this should never happen" failsafe." ([Nick, 2024-10-02](https://boardgamegeek.com/thread/3379088/article/44956102#44956102)) `intent`
- **Are 'round' and 'generation' the same thing in the Automa rules (game end and the VP chart)?** Yes, round and generation mean the same; the 'round 20' game-end rule is generation 20 and the current round (generation) is completed.  
  "Yes, exactly this." ([Nick, 2024-12-26](https://boardgamegeek.com/thread/3428220/article/45382236#45382236))
- **When all global parameters are maxed in a game with the automa, does the game end immediately or after the current generation?** Same as multiplayer: finish the generation, then score. Both the player and the automa must have passed for the generation to end.  
  "It's the same as a multiplayer game. You finish the generation, then score up. That means both you and the automa will have had to pass for the generation to end." ([Nick, 2025-12-23](https://boardgamegeek.com/thread/3428220/article/47060151#47060151))

### Greenery placement

- **Which tiebreaks does MarsBot use when choosing a greenery location?** An extra tiebreak was added for greenery selection: fewest of the player's own city tiles, applied after picking the space with most of the bot's own city tiles.  
  "Added extra tiebreak for greenery selection: Fewest of your own city tiles (after picking most of its own city tiles);" ([Nick, 2022-06-21](https://boardgamegeek.com/thread/2883930/article/40306602#40306602)) `prototype` `superseded` by [a later post](https://boardgamegeek.com/thread/3350125/article/44711805#44711805)
- **Where does MarsBot place greenery tiles?** A greenery goes next to as many of its own cities as possible, then next to as many oceans as possible: it wants to score city points from adjacent greenery, otherwise to fill ocean-adjacent spaces so the player cannot get the money benefit.  
  "Greenery it wants next to as many of its own cities as possible, then next to as many oceans as possible." ([Nick, 2022-07-10](https://boardgamegeek.com/thread/2883930/article/40418517#40418517)) `prototype` `superseded` by [a later post](https://boardgamegeek.com/thread/3350125/article/44711805#44711805)
- **When placing a greenery, does MarsBot prioritise adjacency to its own cities or minimising adjacency to your cities?** It wants the greatest net gain of points: maximise (its own city adjacencies minus the player's city adjacencies). The board reference card's '>' summary is a simplification that could seem to contradict the rule wording.  
  "Effectively it wants the greatest net gain of points for the greenery placement" ([Nick, 2024-08-14](https://boardgamegeek.com/thread/3350125/article/44711805#44711805))
- **For MarsBot greenery placement minimizing adjacency to its cities, if two spaces have the same net difference (its adjacent cities minus the player's), which does it pick?** If the difference is the same, MarsBot picks randomly between those spaces by flipping a card, since it makes no difference to the net score.  
  "If the difference is the same, it should randomly pick between those two (as it make no difference to the net score gained by both you and the bot) by flipping a card." ([Nick, 2024-11-24](https://boardgamegeek.com/thread/3411375/article/45234897#45234897))
- **Should MarsBot place a greenery next to its Local Neural Instance instead of next to the player's city when only those placements are valid?** Not all of the bot's placements are optimal for it; this is the tradeoff of rules simplicity, so follow the placement rules as written. Making the bot take more lucrative placements is a fine optional complexity modifier.  
  "Feel free though to make the bot take more lucrative placements if you want. Call it a complexity modifier!" ([Nick, 2025-05-17](https://boardgamegeek.com/thread/3513320/article/46094970#46094970)) `intent` `house-rule-ok`

### MarsBot M€ supply

- **Does MarsBot ever spend its accumulated M€, and is it intended that it ends with very large piles?** Yes, the M€ accumulates (170+ is possible) and is intended: it offsets the bot not scoring M€ from cards (which it does only at higher difficulty levels) and pushes the player to end the game quickly.  
  "I've had it get into the 170+ M€ at times. The reasoning is to offset its lack of scoring M€ from cards (which it only does at higher difficulty levels)." ([Nick, 2024-07-17](https://boardgamegeek.com/thread/3334891/article/44572809#44572809)) `intent`
- **Why does MarsBot convert MC to VP at a worse rate the longer the game lasts, and what is the generation limit?** The declining efficiency of MarsBot's MC-to-VP conversion is intentional so players cannot ignore terraforming and bulk up on VP. Left alone MarsBot could finish the global parameters in up to 20 generations, which is why 20 generations (18 with Prelude) is the instant-loss trigger for the player.  
  "hence why 20 generations is the "instant loss" trigger for you when playing against MarsBot, or 18 with Prelude" ([Nick, 2025-10-07](https://boardgamegeek.com/thread/3588376/article/46707460#46707460)) `intent`
- **Does MarsBot have to pay MC for cards it keeps or plays?** No. It never has to pay for keeping cards during drafting or to 'play' them.  
  "It never has to pay for keeping cards during drafting, or to "play" them." ([Nick, 2025-12-28](https://boardgamegeek.com/thread/3634497/article/47074537#47074537))
- **Why does MarsBot not score VP on cards, and is a large MC supply normal?** MarsBot can easily accrue over 100 M€ in a game (it regularly does in Nick's games), though it depends on the automa corporation being played. The M€-to-VP conversion simulates points players get on cards, which MarsBot does not score because it cannot target cards with point multipliers and, since it doesn't pay for cards, scoring flat card VPs would be too powerful; scoring VP on cards is instead a difficulty modifier. The rulebook's 24 M€ example (added by the publisher) is a technically correct calculation but unrepresentatively low.  
  "That's why scoring VP on cards is, instead, a difficulty modifier." ([Nick, 2026-06-17](https://boardgamegeek.com/thread/3724743/article/47819861#47819861)) `intent`

### Milestones and awards

- **Does MarsBot fund an award it is not winning?** No. MarsBot funds the award it is most ahead of the player on (only if fewer than 3 awards are claimed). If none can be claimed, or it is not equal to or ahead of the player on the requirement for any award, it skips the action.  
  "Funds whichever award it is most ahead of you in requirements (and only if less than 3 are already claimed). [...] If none can be claimed, or it is not equal to or ahead of you on the requirement for any of the awards, it skips this action." ([Nick, 2022-07-20](https://boardgamegeek.com/thread/2883930/article/40477875#40477875)) `prototype`
- **Does 'skip' for a milestone or award action mean MarsBot takes a failed action?** Yes. When MarsBot cannot claim a milestone or award, it takes a failed action; the wording 'skip' should be changed to 'takes a failed action'.  
  "Correct, it means a failed action." ([Nick, 2022-10-29](https://boardgamegeek.com/thread/2883930/article/41064213#41064213)) `prototype`
- **Does the MarsBot support the Milestones & Awards expansion?** Yes, the published Automa will be made compatible with the Milestones & Awards expansion.  
  "We'll be making them compatible with the bot, yes." ([Nick, 2023-09-05](https://boardgamegeek.com/thread/2883930/article/42905957#42905957)) `intent`
- **Will the Automa have rules for the Milestones & Awards expansion?** Yes, Milestones/Awards are to be made compatible with the bot; at the time of the post the rules were not yet written and were not in the draft rulebook.  
  "Milestones/Awards: yes they will be made compatible with the bot. We've not written the rules up for them yet, so they're not in the draft automa rulebook." ([Nick, 2023-09-05](https://boardgamegeek.com/thread/3148562/article/42905968#42905968)) `intent`
- **On hard difficulty, MarsBot claims a milestone if 1 milestone has been claimed and it meets the requirements for 2 or more milestones. Does 'meets 2 or more' mean 2 unclaimed milestones?** Yes: the 2 or more milestones MarsBot meets must be unclaimed milestones, so the already-claimed milestone does not count toward the 2.  
  "Yes, it means unclaimed." ([Nick, 2024-09-10](https://boardgamegeek.com/thread/3365910/article/44843537#44843537))
- **When MarsBot funds an award or claims a milestone, does it take up one of the three payment slots?** Effectively yes for awards: the first award costs 8 MC, the second 14 MC, the third 20 MC regardless of who funded the previous one, so if MarsBot funds the first, funding the second costs the player 14 MC. Milestones all cost the same.  
  "awards, you pay 8MC for the first, 14MC for the second, 20MC for the third, regardless of who funded the previous award, so if the Automa funds the first, for instance, if you fund the second it will cost you 14MC." ([Nick, 2025-06-25](https://boardgamegeek.com/thread/3532698/article/46255674#46255674))
- **If a random milestone or award comes from a map with no Corporate Competition card, should it not be used with MarsBot?** Correct: do not use it; some won't make sense at times, so swap them out for different ones.  
  "Correct. Some won't make sense at times, so just swap them out for different ones." ([Nick, 2026-10-13](https://boardgamegeek.com/thread/3781613/article/48285468#48285468))

### Planetologist (milestone)

- **What does 'Sum of Jovian/Earth and Venus track spaces combined at 5+' mean for the Automa's Planetologist milestone?** Nick: the sum of the track spaces needs to be 5 or higher, which is what '5+' is meant to imply (not counting only spaces 5 and above on each track); he added 'at least that's what I assume we meant'.  
  "The sum for the automa needs to be 5 or higher. That's what the 5+ is meant to imply." ([Nick, 2024-08-28](https://boardgamegeek.com/thread/3358029/article/44776076#44776076)) `hedged`
- **Does the Automa's Planetologist milestone need a combined track sum of 5 or more?** Confirmed: the combined Jovian/Earth and Venus track sum must be 5 or higher.  
  "Yes." ([Dávid, 2024-08-28](https://boardgamegeek.com/thread/3358029/article/44776922#44776922))

### Rulebook and card authority

- **When an Automa card and the rulebook seem to disagree, which governs?** If the card is clear enough, follow the card; it has been tested much more than the rulebook.  
  "If the card is clear enough, always stick to the card. It has been tested a lot more than the rulebook." ([Dávid, 2024-08-16](https://boardgamegeek.com/thread/3350125/article/44724427#44724427)) `intent`
- **Do forum answers from Nick and Dávid override the Automa rulebook wording?** Generally, forum answers from Dávid or Nick supersede the rulebook wording, since mistakes, typos and missed edge cases end up in rulebooks.  
  "Generally, forum answers from Dávid or I will supersede the rulebook wording." ([Nick, 2026-10-13](https://boardgamegeek.com/thread/3781613/article/48285216#48285216)) `intent`

### Setup

- **Does MarsBot start with M€ (e.g. to be stolen by a card)?** MarsBot starts with no M€ unless the corporation it uses specifies starting M€ in its setup. For a card that would steal M€, Nick suggests not playing it until MarsBot actually has some M€ to steal.  
  "Marsbot doesn't start with any MC unless a corp it's using specifies it in the corp setup." ([Nick, 2024-07-28](https://boardgamegeek.com/thread/3340794/article/44625531#44625531)) `hedged`
- **What changes for the Automa when playing the Prelude 2 Extended Start Variant?** If the variant just gives the player more choices of preludes and corporations, nothing changes for the automa.  
  "Nothing changes for the automa if so." ([Nick, 2025-03-04](https://boardgamegeek.com/thread/3472198/article/45750314#45750314)) `hedged`
- **Do production tracks start at 0 or 1 in the Automa solo mode?** Starting on 1 of each production is for games without Corporate Era cards, not 2-player specific. Automa solo can be played without Corporate Era cards, in which case the player starts on production 1 on all tracks, while the bot still starts on 0.  
  "With the Automa solo mode, you can play without Corporate Era cards if you want, in which case you can indeed start on production of 1 on all your tracks (but the bot still starts on 0)." ([Nick, 2025-07-15](https://boardgamegeek.com/thread/3542597/article/46334144#46334144))
- **Does the Automa use the 2-player setup (starting TR 20) rather than the original solo setup, e.g. for the Turmoil Reds bonus?** Yes. Use the 2-player setup rules and ignore the original solo mode's rules.  
  "Yeah, you're using the 2p setup rules basically, ignore the original solo mode's rules." ([Nick, 2025-10-18](https://boardgamegeek.com/thread/3594202/article/46755233#46755233)) `inferred`
- **May the player pick corporation, Prelude cards and project cards together, given the Automa rulebook says to choose the corporation first?** Yes. All the cards can be dealt at the same time and chosen to synergise; what must happen first is the reveal of corporations (with their setup effects) before the Prelude cards are played. Nick thinks the rulebook's 'you must first choose your own corporation' meant 'pick and reveal it and trigger setup effects', not 'pick it before seeing your preludes or starting project cards'.  
  "You can deal all the cards out at the same time and pick them to synergise nicely together; it's the *reveal* of the corps that has to happen before the prelude cards" ([Nick, 2025-12-04](https://boardgamegeek.com/thread/3622481/article/46979373#46979373)) `hedged`
- **Is it legitimate to select corporation, Prelude and project cards all at once, with only the corporation needing to be revealed first?** Yes, exactly: selecting from all cards (corporation, Prelude, project) at once is legitimate; the corporation just has to be revealed first.  
  "Yep, exactly." ([Nick, 2025-12-05](https://boardgamegeek.com/thread/3622481/article/46982860#46982860))
- **Does MarsBot start with zero MC in the basic Automa without a corporation?** Yes, it doesn't start with any M€.  
  "Correct, it doesn't start with any M€." ([Nick, 2026-01-06](https://boardgamegeek.com/thread/3640302/article/47117777#47117777))
- **If a corporation destroys a bonus card at setup that was already dealt into the first action deck, does MarsBot get a replacement?** Yes, MarsBot should still have 4 cards for its first turn: 3 project cards and 1 bonus card, so the destroyed bonus card is replaced.  
  "Yes, it should still have 4 cards for its first turn: 3 project cards and 1 of its bonus cards. So replacing it makes sense." ([Nick, 2026-10-13](https://boardgamegeek.com/thread/3781613/article/48285468#48285468))

### Stealing and removing resources

- **When stealing a resource (e.g. plants) from MarsBot's M€ supply, do the stolen cubes count as plants or as M€ for the player?** They count as whatever resource type you were told to steal. If the effect lets you choose a type, you pick which type they become.  
  "They count as whatever type you were told to steal. If that was a choice, you can pick which type they become." ([Nick, 2024-10-16](https://boardgamegeek.com/thread/3388201/article/45030261#45030261))
- **When stealing a resource from MarsBot, may you split what you steal between its M€ supply and another storage area (e.g. Venus floaters or Colonies resources)?** Nick would say it's fine to mix what you steal (part from MarsBot's M€, part from another resource storage area); it gives the player interesting decisions about which pot to steal from at different times.  
  "I would say it's fine to mix what you steal. It allows some interesting decision points for the player to decide which pot to steal from at different times during the game." ([Nick, 2024-11-25](https://boardgamegeek.com/thread/3398852/article/45237100#45237100)) `hedged`
- **For an effect that steals and destroys floaters from an opponent, should it take from MarsBot's M€ credits or from its floaters on the Venus board?** The asker took the cubes from MarsBot's credits (as for plants); TDaver confirmed this was the correct ruling.  
  "You ruled correctly." ([Dávid, 2024-12-27](https://boardgamegeek.com/thread/3429154/article/45388532#45388532)) `inferred`
- **With Colonies, when removing another player's resource, can the player take MarsBot's MC instead if it has none of that resource?** Nick's best guess, without the rules to hand and offering to amend if the rules disagree: with Colonies the player can choose to target either the bot's M€ or its Colonies resources.  
  "You can pick to target either the bot's MC or its colonies resources, your choice." ([Nick, 2025-10-27](https://boardgamegeek.com/thread/3599965/article/46800194#46800194)) `hedged`

### Terraform rating and global parameters

- **What does MarsBot get when it passes the temperature step where a player would get a heat production bonus?** The bot gets 2 M€ instead of the heat production bump.  
  "On your question for the heat prod bonus on the temp track: the bot gets 2M€ instead of the heat bump." ([Nick, 2023-09-21](https://boardgamegeek.com/thread/2883930/article/42990537#42990537))
- **Does MarsBot gain TR when it raises a global parameter?** Yes, MarsBot gains TR for raising global parameters; this is the normal rule and it is kept.  
  "Yes it does gain TR for this." ([Nick, 2024-11-01](https://boardgamegeek.com/thread/3397897/article/45115807#45115807))
- **Does MarsBot gain TR when it raises a global parameter such as the temperature?** Yes. MarsBot always gains TR along with a global parameter increase or placement, like a player would.  
  "Yes they do, they always gain TR along with the global parameter increase/placement, like a player would." ([Nick, 2026-06-12](https://boardgamegeek.com/thread/3722492/article/47800636#47800636))

### Thermalist (award)

- **For awards comparing leftover resources (Thermalist), does MarsBot count your current energy that will become heat?** Yes. Thermalist counts leftover heat, so energy that will end up as heat is included; the post says energy production is also taken into account during the game, because the bot cannot know how close the endgame is. At game end only actual leftover heat cubes are compared (energy produced in the final round does not count). A later post by TDaver questions the energy-production part.  
  "Thermalist counts leftover heat, so the energy that will end up as heat is definitely included." ([Nick, 2024-08-14](https://boardgamegeek.com/thread/3350125/article/44711805#44711805)) `reversed` `superseded` by [a later post](https://boardgamegeek.com/thread/3350125/article/44766107#44766107)
- **What does MarsBot add up to estimate your end-of-game heat for Thermalist?** Energy cubes + heat cubes + heat production (stated as 99% sure), i.e. not energy production.  
  "I'm 99% we meant energy cubes + heat cubes + heat production." ([Dávid, 2024-08-26](https://boardgamegeek.com/thread/3350125/article/44766107#44766107)) `hedged`
- **At game end, how is the Thermalist award evaluated for the player and for MarsBot?** At game end, the player's value is calculated as usual, and MarsBot's is its Power track space +5. The mid-game Corporate Competition counts the player's heat production only because it is their potential additional gain in the production phase.  
  "For endgame, calculate yours as you usually would. For the bot, it's power+5." ([Nick, 2025-08-24](https://boardgamegeek.com/thread/3564356/article/46514541#46514541))

### Tile placement

- **On Hellas, does MarsBot place an ocean if it places a tile on the South Pole space?** Yes, the bot should place that ocean tile.  
  "On the Hellas ocean bonus, yes it should place that ocean tile." ([Nick, 2023-09-21](https://boardgamegeek.com/thread/2883930/article/42990537#42990537))
- **When MarsBot places a city, does it advance its Event/M€ production track?** No. Placing a city does not advance MarsBot's M€ track, unless a corporation ability says so. Treat it like a card that lets the bot place a city, not like the city standard project.  
  "Marsbot won't advance it's mc track from city placement, no (unless a corporation ability says to do that of course)." ([Nick, 2024-07-14](https://boardgamegeek.com/thread/3333348/article/44558455#44558455))
- **When the bot's tile placement is tied between several valid spaces and a card is flipped, how is the space chosen?** Divide the flipped card's cost by the number of valid spaces; the remainder gives the chosen space, counting from the top left. No actual counting is needed. Example: 4 valid spaces and cost 31 gives remainder 3, the third valid space.  
  "Let's say I have 4 valid spaces. I draw a card costing 31. 31 divided by 4 gives a remainder of three, so the bot wants the third valid space." ([Dávid, 2024-08-01](https://boardgamegeek.com/thread/3342916/article/44645857#44645857))
- **How is the remainder used when the flipped card's cost is exactly divisible by the number of valid spaces?** The selection is the remainder, except that when the cost divides exactly by n the bot uses the nth (last) valid space rather than a '0' space. With 4 valid spaces: cost 4 or 8 or 32 gives space 4, cost 5 gives space 1, cost 31 gives space 3. This is the same method as the base solo mode used to place starting neutral tiles.  
  "It's the remainder (or modulus if you like), except that when exactly divisible by n, you're placing in the nth space rather than a "0" space." ([Nick, 2024-08-01](https://boardgamegeek.com/thread/3342916/article/44647961#44647961))
- **Should the first valid space be counted as space zero when resolving the tiebreaker card cost?** TDaver accepted a poster's argument for treating the first valid location as zero (so a cost with no remainder returns to the starting top-left spot, and cost 0 works), noting the rules say to start at the top left and move through the others as you count. This sits differently from Nick's table (exact multiple gives the nth space) and the thread leaves the difference unreconciled.  
  "Boom. You've changed my thinking, just like that." ([Dávid, 2024-08-14](https://boardgamegeek.com/thread/3342916/article/44709876#44709876)) `hedged` `inferred`
- **When MarsBot places a tile, does it get 2 M€ once for being next to one or more oceans, or 2 M€ per adjacent ocean tile?** MarsBot gets 2 M€ per adjacent ocean tile, just like a player.  
  "Yes, the intention is 2MC per adjacent ocean tile, just like a player." ([Nick, 2024-09-02](https://boardgamegeek.com/thread/3361315/article/44804762#44804762))
- **Does MarsBot get 2 MC once or per adjacent ocean when placing a tile?** 2 MC for each adjacent ocean tile, same as a player would get.  
  "Exactly. Same as a player would get." ([Nick, 2024-10-22](https://boardgamegeek.com/thread/2883930/article/45061402#45061402))
- **Does MarsBot follow the same basic tile placement restrictions as a player?** Yes, unless otherwise mentioned, the bot's placement follows the same restrictions as a player (e.g. no city next to another city, ocean only on ocean spaces).  
  "Yes, unless otherwise mentioned, the bot's placement follows the same restrictions as a player." ([Nick, 2024-12-14](https://boardgamegeek.com/thread/2883930/article/45333508#45333508))

### Venus track

- **What does the bot get for the Venus 16% TR bonus?** The TR bonus is as written: 1 TR. (The post's guess for the card bonus was struck through and corrected by TDaver to 2 M€.)  
  "TR is as written: 1TR." ([Nick, 2024-08-28](https://boardgamegeek.com/thread/3358342/article/44778752#44778752))
- **What does the bot get for raising Venus to the 8% card-icon bonus?** The card bonus gives 2 M€ (not a card, not 1 M€), to be consistent with the heat production bonus on the temperature track. TR is 1 TR. Whether this applies when raised via the World Governing Intervention card is left open.  
  "Card is 2mcr, to be consistent with the heat production on temp track." ([Dávid, 2024-08-28](https://boardgamegeek.com/thread/3358342/article/44779186#44779186))
- **Should the Venus Next track board be placed above or below the main MarsBot track board, given 'topmost track if tied' rules?** TDaver always plays with the Venus board at the bottom, below the main MarsBot track board.  
  "I've always played w Venus at the bottom" ([Dávid, 2024-09-28](https://boardgamegeek.com/thread/3376248/article/44933972#44933972)) `intent`
- **What does MarsBot get when it reaches a space with a terraforming bonus on the Venus track (card draw, +1 M€) outside World Government Terraforming?** Njshaw2 is 99% sure the rulebook covers it; for an immediate ruling, give it the same as for the heat production bonus on the temperature track: 2 M€ instead of the bonus.  
  "give it the same as it would get for the heat production bonus on the temperature track, i.e. 2M€ instead of the bonus." ([Nick, 2024-12-17](https://boardgamegeek.com/thread/3424237/article/45349740#45349740)) `hedged`
- **When MarsBot must advance the least advanced track, is the Venus track treated as a normal MarsBot track, placed at the very bottom?** Yes: place the Venus track at the very bottom and treat it as a normal MarsBot track when choosing the least advanced track (so it is topmost-if-tied only after the main tracks).  
  "Yup" ([Dávid, 2024-12-28](https://boardgamegeek.com/thread/3376248/article/45391265#45391265))
- **When the automa draws a card with two Venus tags, does its Venus track advance by two spaces?** Yes, once per Venus tag.  
  "Yes, once per tag." ([Nick, 2026-07-05](https://boardgamegeek.com/thread/3733016/article/47888967#47888967))
- **Does MarsBot advance the Venus track once per Venus tag or once per card with a Venus icon (Chinese edition says per card)?** The English wording is ambiguously phrased, but the intent is an advance per tag, not per card.  
  "But the intent was an advance per tag, not per card." ([Nick, 2026-07-05](https://boardgamegeek.com/thread/3733016/article/47889722#47889722)) `intent`
- **What happens when the automa advances its Venus terraforming index onto the card-bonus and TR-bonus reward spaces?** On the card bonus space it gets 2 MC instead; on the TR bump space it gains 1 TR. This is stated as the intention, and they could not confirm the rulebook says so.  
  "Card bonus: Gets 2MC instead." ([Nick, 2026-07-06](https://boardgamegeek.com/thread/3733436/article/47892257#47892257)) `intent` `hedged` `inferred`

### Versions of the Automa

- **How does njshaw2's original Terraforming Mars solo Automa (MarsBot) work and what does it support?** The bot always plays 4 cards per era (2 per turn); the cards' tags move its markers along tracks and passing action icons triggers effects (TR, parameters, cities, greeneries, milestones, awards). The original version supports the base game and Prelude, Hellas and Elysium only in theory; Venus Next, Colonies and Turmoil were not yet supported. Normal difficulty targets roughly 100 VP.  
  "The basic method the bot plays by is by always playing 4 cards per era (2 per turn), where its actions are governed by the cards' tags, which move its markers along tracks matching the tags" ([Nick, 2022-06-15](https://boardgamegeek.com/thread/2883930/article/40271179#40271179)) `prototype`
- **Does the original free pre-published (print and play) MarsBot version support expansions or bot corporations?** No. The pre-published version supports no expansions and has no bot corporations, though it is close to the final published version.  
  "It doesn't support any expansions, and doesn't have bot corporations, but it's pretty close to the final published version." ([Nick, 2025-04-28](https://boardgamegeek.com/thread/3503668/article/46014254#46014254))

### Wild tags

- **Does a wild tag count as matching MarsBot's draft priority tags when drafting?** No. The Adding Corporations rulebook (p. 2) states the Wildcard tag is not considered matching the Draft Priority tag(s), because when played it advances the topmost furthest back track instead of matching.  
  "The Wildcard tag is not considered matching the Draft Priority tag(s) for this purpose." ([Nick, 2024-12-28](https://boardgamegeek.com/thread/3429859/article/45393937#45393937))
- **Does a wild tag count as a tag when MarsBot counts tags (e.g. Spire, Interface Hyperlink tiebreak, Sagitta)?** Yes, a wild tag is still a tag for things that count just 'tags'. It does not match a named draft priority tag, which looks for a specific tag.  
  "Yes, they're still tags. The named draft priority tag match is different because it's looking for a *specific* tag" ([Nick, 2026-10-13](https://boardgamegeek.com/thread/3781613/article/48285590#48285590))

## Cards


### Amazonis Planitia

- **Is the Automa compatible with the Amazonis Planitia board?** No. Amazonis Planitia will not be Automa compatible because it would require redesigning the bot board and game balance for the extended terraforming tracks.  
  "Amazonis Planita: won't be automa compatible, as it would have required redesigning the whole bot board and game balance to cope with the extended Terraforming tracks." ([Nick, 2023-09-05](https://boardgamegeek.com/thread/3148562/article/42905968#42905968))
- **Why does the Automa not support the Amazonis board, and what would be needed?** The MarsBot is tuned around terraforming the base map in 11-13 generations (9-11 with Prelude). A longer-game map would need tracks longer than 18, reworked icons and clarification of every bot corporation that refers to track spaces, so Amazonis is not supported.  
  "The problem is not the component. The problem is that Nick's original MarsBot is designed around the tempo of Terraforming the base game map in 11-13 turns (9-11 when playing with Prelude)" ([Dávid, 2023-09-06](https://boardgamegeek.com/thread/3148562/article/42907867#42907867)) `intent`
- **Which Automa board should be used on the Amazonis Planitia map?** None is designed for it: Amazonis Planitia is much larger (made for 4-5 players) and the Automa simulates a 2-player game, so Automa was intentionally not designed for that map. If you try anyway, pick any bot board; balance is not guaranteed.  
  "If you really, really want to try it anyway, I guess pick any bot board. None are going to be balanced specifically to it, so your mileage may vary." ([Nick, 2025-01-14](https://boardgamegeek.com/thread/3440836/article/45483515#45483515)) `intent`

### Ants

- **Can the player remove microbes from MarsBot's MC supply when playing Ants, which says 'any card' rather than 'any player'?** Nick would say yes: the player can remove microbes from MarsBot for Ants' effect (the asker's framing: from its M€ supply).  
  "Yes, I'd say you can remove them for that effect." ([Nick, 2025-10-19](https://boardgamegeek.com/thread/3595110/article/46758412#46758412)) `hedged`

### Arklight

- **Does MarsBot advancing the animal track through a Colonies board resource gain count as resolving an animal tag for Arklight?** No (Dávid is about 99% sure).  
  "I'm 99% the answer is no. Nick?" ([Dávid, 2025-06-30](https://boardgamegeek.com/thread/3535330/article/46276978#46276978)) `hedged`
- **Does MarsBot advancing the animal track through a Colonies board resource gain count as resolving an animal tag for Arklight?** Nick would say no too, agreeing with Dávid's 99%-sure no: advancing the animal track via the Colonies board does not count as resolving an animal tag.  
  "I would say "no" to that too." ([Nick, 2025-07-01](https://boardgamegeek.com/thread/3535330/article/46278330#46278330)) `hedged`

### Expedited Construction

- **For Expedited Construction's city placement, how do the card's adjacency condition and the tile placement tiebreakers interact?** The card references the Tile Placement Tiebreakers, so the city tiebreaker applies (greenery adjacency preferred over ocean). 'Adjacency conditions' means the usual core-game placement restrictions for that tile type; for a city Nick listed, from memory, not adjacent to another city and not on a reserved space.  
  "It references Tile Placement Tiebreakers, where you should then see the City tiebreaker (as it's placing a city), which would pick the 2 greenery over the 2 ocean." ([Nick, 2024-08-14](https://boardgamegeek.com/thread/3350125/article/44711805#44711805)) `reversed` `hedged` `superseded` by [a later post](https://boardgamegeek.com/thread/3350125/article/44720677#44720677)
- **For Expedited Construction, is adjacency to 3 oceans preferred over adjacency to 2 greeneries?** Nick said yes, it picks the most tiles of any mix, so 3 oceans beats 2 greeneries. This was corrected the next day by TDaver, the card's author.  
  "Yes, it would pick the most of any mix, thus 3 oceans trumps 2 greenery." ([Nick, 2024-08-15](https://boardgamegeek.com/thread/3350125/article/44715999#44715999)) `reversed` `superseded` by [a later post](https://boardgamegeek.com/thread/3350125/article/44720677#44720677)
- **How does MarsBot choose a space with Expedited Construction?** Look at every space that touches 2 or more ocean/greenery tiles and choose among them by the usual city placement rules. So 2 greeneries beat 3 oceans, but 2 oceans beat 1 greenery.  
  "Look at every space that touches 2+ (ocean/forest), and choose between them according to usual placement rules. So 2 forests beat 3 oceans, but 2 oceans beat 1 forest." ([Dávid, 2024-08-16](https://boardgamegeek.com/thread/3350125/article/44720677#44720677))
- **What counts as a 'non-negative VP icon' card for MarsBot (e.g. Expedited Construction)?** Confirmed: a card counts if it has a VP icon that is not negative, including cards that score by counting something (Fish, Ants, Ganymede Colony, Immigration Shuttles, Search For Life). Giant Ice Asteroid does not count (no VP icon); cards with negative VP icons (Heat Trappers, Nuclear Zone) are excluded. Same trigger as Vitor in Prelude. The VP are counted at end of game, not TR.  
  "Confirmed." ([Dávid, 2024-11-01](https://boardgamegeek.com/thread/3386410/article/45111158#45111158))

### Government Intervention

- **With Venus Next/Solar phase, MarsBot raises the parameter every generation via the Government Intervention card; must the player also raise it at the end of the round?** No. That card replaces the need for the player to raise the parameter at the end of the rounds.  
  "Correct, that card replaces the need for the player to do that at the end of the rounds." ([Nick, 2025-01-17](https://boardgamegeek.com/thread/3442207/article/45498612#45498612)) `inferred`

### Magnate

- **The Magnate MarsBot corporation says it counts blue and green cards in the played pile, but Magnate counts green cards; which is right?** The rulebook wording is a mistake; the reader's interpretation, that MarsBot's Magnate counts only green cards, is correct (Dávid is about 98% confident).  
  "I'm 98% confident your interpretation of where we made the booboo is correct :)" ([Dávid, 2025-10-13](https://boardgamegeek.com/thread/3534424/article/46731527#46731527)) `erratum` `hedged` `inferred`

### Mining Guild

- **Do the MC left on the MarsBot Mining Guild corporation card count for end-game scoring?** Nick would say no, going by the card's wording, and says Dávid will correct him if he's wrong: remaining M€ on the card are not included in endgame scoring, as MarsBot has not 'gained' them yet; they are there to trigger the building-track advance for every 10 M€ MarsBot gains, like a separate supply not yet owned by MarsBot.  
  "any remaining MC on the card are NOT included in the endgame scoring calculations (as MarsBot has not "gained" them yet" ([Nick, 2025-08-05](https://boardgamegeek.com/thread/3553988/article/46427348#46427348)) `hedged`

### Mons Insurance

- **Is Mons Insurance supported by the Automa?** No. Mons Insurance is excluded from the Automa because the rule clarifications needed would be more trouble than worth; homebrew rules are welcome.  
  "No. I spent months working on all 40+ corporations. Mons Insurance is nuts. Once the game is out, anyone is welcome to homebrew a bunch of rules for it" ([Dávid, 2023-09-06](https://boardgamegeek.com/thread/3148562/article/42907855#42907855)) `intent`

### Philares

- **When Philares' MarsBot effect triggers off-turn (adjacency created after a tile placement, possibly after MarsBot passed or in the last production phase), is it resolved immediately?** Nick defers to Dávid (who created the MarsBot corporations), but his interpretation is to treat it as multiplayer would, where a player still gains the resource off-turn, after passing, and even during the final production phase. So MarsBot gains the bonus science resource immediately, possibly reaching enough to advance a track and trigger an action. He suggests the player fully completes their current action first, but MarsBot takes its bonus before the player's potential second action.  
  "I would treat MarsBot's effect the same way - it gains the bonus science resource immediately, thus possibly causing it to have enough resources to advance a track and possibly trigger an action" ([Nick, 2025-06-04](https://boardgamegeek.com/thread/3513998/article/46167832#46167832)) `hedged`
- **Does Philares' MarsBot effect resolve immediately off-turn, and can it do so after the end of the game?** Rules and card as written support the immediate resolution, but probably not after the end of the game. The clean solution would be to read the card as 'if anytime during its turn it has 4 science resources'; players may pretend the card says that.  
  "Rules/card as written seem to support the immediate stuff ruling, but probably not the after end of the game." ([Dávid, 2025-06-04](https://boardgamegeek.com/thread/3513998/article/46170281#46170281)) `hedged` `house-rule-ok`

### PhoboLog

- **When a bot corporation such as Phobolog adds space-tag cards to the bonus deck at setup, where do those cards go when played: the bonus discard pile or the played pile?** They just become played cards and go into MarsBot's regular played pile. If there is no documented way of tracking something, it is probably not meant to be tracked.  
  "They just become played cards, so into its regular played pile." ([Nick, 2024-12-26](https://boardgamegeek.com/thread/3428619/article/45384252#45384252)) `inferred`

### Polyphemos

- **When searching the action deck and discarding a card (Polyphemos), must the action deck be shuffled even though the player knows all its cards?** Yes, shuffle it so you don't know the order the cards will come out in.  
  "Yes, so you don't know the order they'll come out in." ([Nick, 2026-05-11](https://boardgamegeek.com/thread/3706780/article/47664057#47664057)) `inferred`

### Pristar

- **When MarsBot's Pristar corporation is active and Lobbyists raises a parameter two steps, does Pristar cancel the whole raise or only one step?** Raises resolve sequentially, so Pristar only affects the first step (cancelling it, gaining 1 TR and 6 M€); the second step happens normally.  
  "Resolve sequentially. So mess with the first only." ([Dávid, 2024-12-31](https://boardgamegeek.com/thread/3431297/article/45405016#45405016))
- **If MarsBot with Pristar lands on event track space #16 that raises temperature twice, does Pristar cancel both raises or only the first?** TDaver (designer of Pristar) imagined it to only cancel the first raise. Whether a maxed-out double temperature space is one failed action or two was not answered in this post.  
  "Nick designed the board, but I designed Pristar. I definitely imagined it to only cancel the first." ([Dávid, 2025-01-01](https://boardgamegeek.com/thread/3432237/article/45411741#45411741)) `intent`

### Saturn Systems

- **Do tags on cards played by MarsBot trigger effects such as Saturn Systems or Solar Logistics?** Effects that count tags other players have played (Toll Station) use the steps on MarsBot's track. Effects that trigger when another player plays a tag (Saturn Systems, Pharmacy Union) trigger when MarsBot resolves a card with that tag or gains an explicit advance on that tag via another effect (advancing plants does not trigger microbes etc.). Solar Logistics triggers whenever MarsBot resolves a space event.  
  "Effects that trigger when another player plays a tag (Saturn systems, pharmacy union, etc) trigger when MarsBot resolves a card with that tag, or gains an explicit advance through some other effect" ([Dávid, 2024-08-25](https://boardgamegeek.com/thread/3356105/article/44762110#44762110))
- **Does a Power-tag advance or Power-tag card trigger Saturn Systems when the Jovian and Power tags share a track row?** A Jovian track bump (including one from another track on the bot board) triggers Saturn Systems; a Power bump or a Power-tag card without a Jovian tag does not, even though Jovian and Power share a row (and count as one for some awards).  
  "a Jovian bump, yes, but an Power bump (or a card with an Power tag without a Jovian tag) wouldn't" ([Dávid, 2024-08-25](https://boardgamegeek.com/thread/3356105/article/44764963#44764963)) `inferred`

### Small Asteroid

- **Can Small Asteroid remove a plant from the bot's Ecoline corporation card, and does 'destroy' mean 'remove'?** The author would play it as allowed to target the bot's corporation card, and believes 'destroy' means the same as 'remove'.  
  "I would play that as being able to target the bot's corp card. I believe "destroy" should mean the same as "remove"" ([Nick, 2024-07-29](https://boardgamegeek.com/thread/3341536/article/44631618#44631618)) `hedged`
- **With 1 plant on the bot's Ecoline card, what can Small Asteroid remove?** You can remove either 2 M€ or that 1 plant, but not 1 M€ and 1 plant.  
  "If there is 1 plant on the ecoline card, you can remove either 2mc or that 1 plant. You cannot remove 1 MC and 1 plant." ([Dávid, 2024-07-30](https://boardgamegeek.com/thread/3341536/article/44636603#44636603))

### Splice

- **How does MarsBot handle the Splice corporation?** When the human plays a microbe tag they may gain either 2 M€ or a microbe on that card; either way MarsBot gains 2 M€. When MarsBot plays a microbe tag it gains 4 M€. The bot also has guaranteed microbe tags, about 1 VP worth of starting M€ and drafting priority for microbe.  
  "When you play a [[microbe-tag]] you may gain either [[2mCr]] or [[microbe]] to that card. Either way, MarsBot gains [[2mCr]]. When MarsBot plays a [[microbe-tag]], it gains [[4mCr]]." ([Dávid, 2023-10-02](https://boardgamegeek.com/thread/3148562/article/43043514#43043514))
- **Does MarsBot discard the microbe card it gains at setup with Splice to the bonus discard pile or the general discard pile when it plays it?** Normal project cards always go to MarsBot's played pile after MarsBot resolves them.  
  "Normal project cards always go to the bot's "played pile" after resolved by the bot." ([Dávid, 2024-12-01](https://boardgamegeek.com/thread/3415208/article/45267240#45267240))

### Teractor

- **Does Teractor's MarsBot effect trigger on any advance of the Earth track, including advance-tracker effects and city tags that share the Earth track?** Yes. The wording difference from Saturn Systems is deliberate: Teractor triggers from resolving a tag that shares a track with the Earth tag, or from any other effect advancing the Earth track.  
  "Teractor indeed triggers from resolving a tag that shares a track with Earth tag, or any other effect advancing the Earth track." ([Dávid, 2025-12-06](https://boardgamegeek.com/thread/3621937/article/46986565#46986565))

### Toll Station

- **How do cards that count opponents' tags or events (Toll Station, Media Archives) work against MarsBot?** Use the bot's track position on the respective tag track for those cards.  
  "You use the track position of the bot on the respective track for those." ([Nick, 2022-07-07](https://boardgamegeek.com/thread/2883930/article/40399513#40399513)) `prototype`
