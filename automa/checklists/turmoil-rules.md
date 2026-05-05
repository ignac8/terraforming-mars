# MarsBot Turmoil — Rule Checklist

Source: `automa/TM-Automa-rulebook-C-11-14-2023.pdf` pages 6–7.

Implementers must scan the **full rulebook** and add `T-X*` cross-reference entries below for any clauses on other pages (Prelude/Prelude2 p.1, Venus Next p.2–3, Colonies p.4–5, base rules) that touch Turmoil behavior.

> **Bonus card numbering note:** the rulebook calls Party Politics **B20**. The current codebase `BonusCardId` enum has it as **B21** (one slot offset, same as the Colonies cards). Implementers must reconcile this in their plan.

## Setup Changes

- **T-1** — Set up according to Turmoil rules normally, but leave all 7 of MarsBot's color delegates in the reserve.
- **T-2** — Player starts normally on 20 TR. MarsBot's starting TR is reduced by 10, to **10 TR**.
- **T-3** — After creating MarsBot's starting action deck, shuffle the Party Politics (rulebook: B20) bonus card into it.

## Gameplay Changes

- **T-4** — Player interacts with all Turmoil components and rules the same way as normal Turmoil rules. This section only describes changes to the regular MarsBot rules. Unless otherwise stated, all regular MarsBot rules apply.
- **T-5** — MarsBot **ignores** the ruling party's policy.
- **T-6** — After the Research Phase each generation, shuffle the Party Politics card into MarsBot's action deck.

## New MarsBot Bonus Card — Party Politics (rulebook B20)

- **T-7** — If MarsBot has at least 1 delegate left in the reserve, place 1 of its delegates from the reserve into one of the delegate areas, then check whether the Party Leader or the Dominant Party changes because of this.
- To select which party to place into, walk the priority list below until a single party is selected:
    - **T-7.1** — A party where placing 1 delegate would cause MarsBot to become Party Leader **AND** the party to become Dominant.
    - **T-7.2** — A party where placing 1 delegate would cause MarsBot to become Party Leader.
    - **T-7.3** — A party where MarsBot is already Party Leader, and placing 1 delegate would make the party Dominant.
    - **T-7.4** — A party where the player has the fewest (including zero) delegates (including possibly a Party Leader).
    - **T-7.5** — A party where MarsBot has fewest (including zero) delegates (including possibly a Party Leader).
    - **T-7.6** — The next party clockwise from the Dominance marker (circling around).
- **T-8** — After placement, if there is at least 1 MarsBot delegate remaining in reserve AND MarsBot has at least 5 MC, flip a card from the project deck (and then discard it). If the flipped card's price is **evenly divisible by 3**, MarsBot spends 5 MC and repeats the T-7 procedure to place a second delegate from the reserve.

## Turmoil Step

- **T-9** — TR Revision: player loses 1 TR normally. **MarsBot does NOT lose a TR.**
- **T-10** — Global Event: perform the Global Event (including influence) normally, however it **only affects the player**.
    - **T-10a** — If there are any choices to be made by the first player, they are always made by the player.
    - **T-10b** — For Global Events *Revolution* and *Election*, resolve the effect for solo (instead of comparing player to MarsBot).
- **T-11** — New Government: perform this sub-step normally, with the following adjustments:
    - **T-11a** — MarsBot ignores the Ruling Party Bonus.
    - **T-11b** — MarsBot **does** gain 1 TR if it becomes Chairman.
    - **T-11c** — Do **not** place a MarsBot delegate in the Lobby.
- **T-12** — Changing Times: perform this sub-step normally.

## End of Game

- **T-13** — At the end of the game, both player and MarsBot score 1 VP for any Party Leader or the Chairman owned.

## Increasing the Difficulty (optional rules)

- **T-14** — Optional: reduce MarsBot's starting TR by 7 instead of 10.
- **T-15** — Optional: after placing the neutral delegates during setup, select a random party (flipping a card from the project deck) and place 1 MarsBot delegate there (possibly taking the Party Leader position). For further challenge, repeat once more.

> Implementers: T-14 and T-15 are difficulty knobs. Either implement behind a setting, or document why deferred.

## Cross-references (implementer must scan rulebook and fill in)

- **T-X*** — _Implementer: scan Prelude/Prelude2 (p.1), Venus Next (p.2–3), Colonies (p.4–5), and any base-rule pages for clauses that interact with Turmoil (e.g. Wild-tag resolution by ruling party, ruling party policy effects on resource gains, milestones tied to delegates, MC reduction interactions with the round-end VP table). Add as `T-X1`, `T-X2`, ... with PDF page reference._

If this section is empty when you submit your plan, the lead will reject it.
