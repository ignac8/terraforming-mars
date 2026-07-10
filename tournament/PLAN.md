# Tournament branch — Polish TM Championship 2026 support

This branch (`tournament`, cut from upstream/main) adds a **Tournament rules** mode
replicating the setup used by the Polish Terraforming Mars Championship 2026 qualifier
tournaments, so players can practice online. It is deployed as a second, independent
instance alongside the fork's main instance; all deployment infrastructure lives in the
[ignac8/terraforming-mars-deploy](https://github.com/ignac8/terraforming-mars-deploy) repo (see its README for the runbook).

## Status (2026-07-10)

Implemented and **live at <https://tournament.terraforming-mars.zerko.it>**. The create
game form opens with Tournament rules pre-checked and locked to the regulation; every
table is dealt the same pool of 5 tournament corporations, duplicates allowed. Card list
for reviewers: <https://tournament.terraforming-mars.zerko.it/cards#~mT~tc>.

Verified: full lint, server suite (7000+ tests incl. 33 tournament-specific), client
suite, and an HTTP end-to-end run (server-side preset clamp + shared pool). Pushes to
this branch go live on the instance within about a minute (see the deploy repo).

### Acceptance checklist (needs humans)

- [ ] Organizers proof all 16 corporations against the printed sheets (link above).
      Interpretation calls still to bless explicitly:
      1. **Sagitta** — "4 poziomami produkcji M€" read as total M€ production 4
         (original has 2), not +4 on top.
      2. **Recyclon** — effect triggers once **per building tag** on the played card.
- [x] **UNMI** — resolved by the organizer (2026-07-10): the three setup tiles skip
      only the printed space bonuses; the ocean-adjacency 2 M€ is a different reward
      and still pays. Ocean/oxygen/TR raises apply as normal. Implemented.
- [x] **Initial draft** — resolved by the organizer (2026-07-10): one pack of 10
      cards, not 5+5. Implemented.
- [ ] One real multiplayer game played start to finish on the instance.

### Possible follow-ups

- A "tournament" badge on variant corporations if players confuse them with the
  originals in the card browser (in tournament games only the variants appear).
- Upstream candidates per `automa/UPSTREAM-PRS.md` (on the automa branch): the
  `grantPlacementBonus` option on `Game.addTile`, the instance-based
  `getCardPlayerByCard` owner lookup used by `RemoveResourcesFromCard`, and the
  `IntragenSanctuaryHeadquarters` owner-argument simplification.

## Tournament setup (from the championship regulations)

- Base game + Corporate Era cards only; any officially published map (Tharsis, Hellas,
  Elysium). 3-4 players at a table.
- **Tournament corporations only**: each table offers a shared pool of **5 tournament
  corporation cards**; every player picks from the same 5 and **duplicates are allowed**
  (in the extreme, all players may play the same corporation).
- Draft variant in every generation, including the initial 10-card draft. The initial
  draft is **one pack of 10 cards** (not the upstream app's two packs of 5) and passes
  in one direction; generation drafts alternate per the rulebook (gen 2 opposite to the
  initial draft, gen 3 same, ...). [Organizer ruling, 2026-07-10.]
- Card purchase cost 3 M€ (standard). Ecological Zone uses the English-edition
  requirement (own greenery) — already how this codebase implements it.
- The physical tournaments also use a 120-minute table limit; this instance is for
  practice, so no clock/end-after-generation feature is implemented.

## The 16 tournament corporations

Rebalanced variants of official corporations (roughly: original corp + a prelude folded
into the starting conditions). Implemented in `src/server/cards/tournament/` with
colon-suffix names (`'Teractor:tournament'`), registered in `TournamentCardManifest`
under the `tournament` module. Purely declarative corporations are standalone classes;
corporations with effect/action code subclass the original (their constructors accept
config overrides), so the behavior code exists once.

| Tournament card | Original | Delta vs original |
|---|---|---|
| Inventrix:tournament | Inventrix (45 M€, first action draw 3, ±2 global requirements) | + 2 steel production, + 4 steel |
| Sagitta Frontier Services:tournament | Sagitta Frontier Services (31 M€, +1 energy +2 M€ prod, draw a no-tag card; no-tag play → 4 M€, one-tag play → 1 M€) | M€ production 2→4, +1 plant production |
| Phobolog:tournament | Phobolog (23 M€, 10 titanium, titanium value +1) | 23→28 M€, +1 plant production, +1 TR at start |
| CrediCor:tournament | CrediCor (57 M€, ≥20 M€ card/SP → 4 M€ back) | +1 steel production, +2 heat production, +2 heat |
| Teractor:tournament | Teractor (60 M€, Earth tags −3 M€) | +1 plant production, draw 3 cards at start |
| Factorum:tournament | Factorum (37 M€, +1 steel prod; action: +1 energy prod if no energy OR 3 M€ → draw building card) | 37→40 M€, +4 M€ production |
| Ecoline:tournament | Ecoline (36 M€, +2 plant prod, 3 plants, greenery for 7 plants) | +1 M€ production, +1 steel production, +1 titanium production |
| Nirgal Enterprises:tournament | Nirgal Enterprises (30 M€, +1 energy/plant/steel prod, milestones & awards free) | +3 heat production, +3 heat |
| Recyclon:tournament | Recyclon (38 M€, +1 steel prod; building tag → +1 microbe here OR spend 2 microbes → +1 plant prod) | production: −1 M€, +1 plant, +1 energy, +1 heat (steel kept); effect now triggers **per building tag** on the played card |
| Interplanetary Cinematics:tournament | Interplanetary Cinematics (30 M€, 20 steel, event → 2 M€) | +1 energy production, +1 plant production, +2 plants |
| Manutech:tournament | Manutech (35 M€, +1 steel prod; gain resources equal to production increases) | +1 plant production, place a city tile at start |
| Cheung Shing Mars:tournament | Cheung Shing MARS (44 M€, +3 M€ prod, building tags −2 M€) | 44→65 M€ |
| Palladin Shipping:tournament | Palladin Shipping (36 M€, 5 titanium, space event → 1 titanium; action: 2 titanium → raise temperature) | +1 M€ production, draw 3 cards at start |
| Ecotec:tournament | Ecotec (42 M€, +1 plant prod; per bio tag → 1 plant or microbe to any card) | 42→48 M€, +1 energy production, +1 steel production |
| UNMI:tournament | United Nations Mars Initiative (40 M€; action: 3 M€ → +1 TR if TR raised this gen) | on play: place 1 ocean, 1 city and 1 greenery **without printed space bonuses** (the ocean-adjacency 2 M€ still pays; global effects apply), then discard 3 cards from hand (capped at hand size) |
| Utopia Invest:tournament | Utopia Invest (40 M€, +1 steel/titanium prod; action: lower a production → gain 4 of that resource) | +2 energy production, +4 steel |

The printed tournament cards (Polish) are the authoritative source for these values.

## Implementation map

1. **Module** `tournament` — wired like other expansions (GameModule, GameOptions flat
   bool + expansions record, NewGameConfig/GameOptionsModel, ApiCreateGame, ServerModel,
   GameCards manifest pair, AllManifests, client checkbox). Server default OFF; the
   client create-game form defaults it ON on this branch.
2. **Cards** — 16 standalone classes (see table) + `TournamentCardManifest`.
   Nirgal's free-milestones/awards check in `Player.ts` extended to the tournament name.
3. **Shared corporation pool** — in `Game.newGame`, when the module is on: draw 5
   tournament corps once (or use `customCorporationsList` as the pool if set — creator
   override), then give every player fresh per-player instances of those same cards.
   Duplicate corporations across players are supported; name→owner reverse lookups were
   audited (`RemoveResourcesFromCard` now resolves the owner by card instance).
4. **Engine** — `Game.addTile(..., {grantSpaceBonuses: false})` threaded through
   `addOcean`/`addGreenery`/`addCity` and the Place*Tile deferred actions (used by
   UNMI:tournament). Skips only the printed space bonuses; adjacency rewards and
   global effects still apply.
5. **Initial draft** — with the module on, the initial draft is a single pack of 10
   cards passed in one constant direction ('before'), matching the regulation (gen 2
   passes opposite).
6. **Create-game UI** — "Tournament rules" checkbox, ON by default, forces + locks
   incompatible options (expansions, draft toggles, fan boards, rule variants); board
   limited to Tharsis/Hellas/Elysium; player count, colors, undo, timers and the
   corporation pool override stay free. Server-side `applyTournamentPreset()` clamps the
   same rules in `ApiCreateGame` (UI is not trusted).
7. **i18n** — Polish strings for all new texts in `src/locales/pl.json` (wording from
   the printed cards).
8. **Tests** — `tests/cards/tournament/` per-card specs + shared-pool dealing +
   duplicate-corporation regressions + draft direction + preset clamp.

## Relationship to other branches

- `automa` — the fork's main line (MarsBot). Not merged here.
- [ignac8/terraforming-mars-deploy](https://github.com/ignac8/terraforming-mars-deploy) — all deployment
  configuration for both instances (compose, Caddy, updater, runbook). This branch
  contains no deployment files.
- Upstream merges into `tournament` are manual and deliberate (the deployment updater
  never auto-merges upstream into this branch).
