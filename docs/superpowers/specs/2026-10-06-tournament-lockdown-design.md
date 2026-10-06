# Tournament lockdown: force undo off and clear custom card pools

Date: 2026-10-06
Branch: `tournament-lockdown` (off `tournament`)

## Intent

Tournament games must be played on identical, prescribed rules. Two levers that
change the game are currently left to whoever fills in the create-game form:

1. **Undo** — `undoOption` is settable, so one tournament table can take actions
   back and another cannot.
2. **Custom card and corporation pools** — `customCorporationsList`,
   `bannedCards`, `includedCards`, `customColoniesList`, `customPreludes` and
   `customCeos` are all settable, so the card pool itself can differ between
   tables.

Both must be forced off for tournament games and must not be settable in the
form.

This is deliberately narrow. It changes which options a tournament game is
allowed to use; it changes no game logic.

## Existing pattern this follows

`applyTournamentPreset` in `src/server/game/GameOptions.ts` already forces the
options tournament regulations prescribe, and its doc comment states the rule
this spec obeys:

> The create game form locks the same options, but the client is not trusted.

So every option is pinned twice: the server overwrites it in
`applyTournamentPreset`, and the client disables its control. The server side is
what actually enforces; the client side exists so the form does not display
values that will be silently discarded.

`ApiCreateGame.ts:172` is the single call site, applying the preset whenever
`gameOptions.tournamentExpansion` is set.

## Scope

**In scope**

- Force `undoOption = false` for tournament games.
- Clear all six custom card/corporation/colony/prelude/CEO pool overrides.
- Disable the four always-rendered form controls when tournament is selected.
  The other three are already hidden by the expansion they depend on.
- Reset those controls when tournament is toggled on, so the form does not keep
  stale selections that the server would discard.
- Correct the `applyTournamentPreset` doc comment, which currently claims undo
  and the corporation pool are left untouched.

**Out of scope**

- Any change to undo's behaviour or correctness. That is the separate
  `automa-undo` work, on a different branch.
- Player count, timers and escape velocity, which remain settable as they are
  today.

## Design

### Server: `src/server/game/GameOptions.ts`

`applyTournamentPreset` gains two things.

Undo is forced off alongside the existing variant forcing:

```ts
options.undoOption = false;
```

And every custom pool override is cleared:

```ts
options.customCorporationsList = [];
options.bannedCards = [];
options.includedCards = [];
options.customColoniesList = [];
options.customPreludes = [];
options.customCeos = [];
```

Three of those six (`customColoniesList`, `customPreludes`, `customCeos`) are
already inert for tournament games, because the preset turns the colonies,
prelude and CEO expansions off and the lists are only read when their expansion
is enabled. They are cleared regardless. The preset's purpose is to produce a
known-good `GameOptions` from untrusted input, so it should not depend on
another field's value to stay safe. If a later change enables one of those
expansions for tournaments, the pool override must not quietly come back to
life.

#### `customCorporationsList` is a deliberate behaviour change

Clearing `customCorporationsList` removes a capability that works today and is
covered by a test. Under current tournament rules the list, when supplied,
*becomes* the corporation pool, filtered down to tournament corporations:
`tests/TournamentMode.spec.ts:46` asserts that passing
`[TERACTOR_TOURNAMENT, ECOLINE_TOURNAMENT, PHOBOLOG]` deals a pool of exactly
the two tournament corporations. The preset's doc comment deliberately exempted
the override for that reason.

That exemption is being withdrawn on purpose. The corporation pool is a property
of this fork, not of whoever fills in the create-game form: the fork defines
which `:tournament` corporations exist, and tournament games deal five of them
at random to a shared pool. Nobody creating a game may narrow or redirect that
set.

The existing test is therefore rewritten rather than deleted. It keeps its
subject but inverts its claim: `customCorporationsList` is ignored under
tournament rules, and the pool is dealt from the fork's tournament corporations
regardless of what was passed in.

Note what this does *not* change: the pool stays five corporations drawn at
random per game. If tournament rules should instead pin the same five
corporations for every table, that is a different change — a deterministic pool,
not a locked override — and it is not in this spec.

The doc comment's last line currently reads:

> Player count, timers, undo and the corporation pool override stay untouched.

It becomes:

> Player count and timers stay untouched.

### Client: `src/client/components/create/CreateGameForm.vue`

Four checkboxes gain `:disabled="expansions.tournament"`, matching the roughly
twenty controls already locked this way:

| Line | Control | Why it needs disabling |
| --- | --- | --- |
| 243 | `undo-checkbox` | always rendered |
| 308 | `customCorps-checkbox` | always rendered |
| 330 | `bannedCards-checkbox` | always rendered |
| 335 | `includedCards-checkbox` | always rendered |

The other three filter toggles need no `:disabled` attribute, because they are
already conditionally rendered on the expansion the tournament preset turns off:

| Line | Control | Wrapped in |
| --- | --- | --- |
| 315 | `customPreludes-checkbox` | `<template v-if="expansions.prelude">` |
| 323 | `customCeos-checkbox` | `<template v-if="expansions.ceo">` |
| 341 | `customColonies-checkbox` | `<template v-if="expansions.colonies">` |

The watcher already sets `expansions.prelude`, `expansions.ceo` and
`expansions.colonies` to false when tournament is switched on, so those three
controls disappear from the form. Adding `:disabled` to a control that is not
rendered would be dead markup.

The six filter components (`CorporationsFilter`, `PreludesFilter`,
`ColoniesFilter`, `CeosFilter` and two `CardsFilter` instances) need no change.
Each is rendered under `v-if` on its `show*` flag, so clearing the flag removes
the panel.

Disappearing is not the same as being cleared, which is why the watcher work
below is not optional: a form where prelude was enabled and preludes were chosen
keeps `showPreludesList` true and `customPreludes` populated after the checkbox
vanishes, and would still post them.

The existing `'expansions.tournament'` watcher, which already resets expansion
checkboxes when tournament is switched on, is extended to reset this group too:

```ts
this.undoOption = false;
this.showCorporationList = false;
this.showPreludesList = false;
this.showColoniesList = false;
this.showCeosList = false;
this.showBannedCards = false;
this.showIncludedCards = false;
this.customCorporations = [];
this.customPreludes = [];
this.customColonies = [];
this.customCeos = [];
this.bannedCards = [];
this.includedCards = [];
```

Clearing the backing arrays as well as the flags matters: the flags only control
panel visibility, and a previously chosen list would otherwise still be posted
in `newGameConfig`. The server would discard it, but the form would have
misrepresented the game about to be created.

### Translation impact

None. This change adds no user-facing text: it disables existing controls and
clears existing values. The roughly twenty controls already locked by the
tournament preset carry no explanatory tooltip, so adding one here would be
inconsistent as well as new translation debt. Polish translation gaps are a
separate piece of work and are not coupled to this spec.

## Testing

Server tests go in `tests/TournamentMode.spec.ts`, which already holds
`applyTournamentPreset forces the regulation options` at line 195 and is the
natural home for these.

1. Extend the existing `applyTournamentPreset forces the regulation options`
   test with `expect(options.undoOption).is.false` and an emptiness assertion
   for each of the six pool arrays, seeding each one populated in the input
   options so the assertions can fail.
2. Rewrite `customCorporationsList becomes the pool, filtered to tournament
   corporations` (line 46) to assert the opposite: with
   `customCorporationsList` supplied, a tournament game still deals five
   corporations drawn from the fork's full tournament set, and the supplied list
   has no effect.
3. Keep `Deals one shared pool of 5 tournament corporations to every player`
   (line 23) passing unchanged — it pins the behaviour the lockdown falls back
   to, so it becomes the load-bearing test for the corporation pool.
4. Assert the preset leaves player count and timer options untouched, pinning
   the boundary the corrected doc comment now claims.

Client test, in `tests/client/components/create/CreateGameForm.spec.ts`:

5. Toggling tournament on clears the six `show*` flags, empties the six arrays
   and sets `undoOption` false.

The server tests are the ones that matter for enforcement; the client test
guards the display promise.

## Verification before deploy

Per the project's standing rule, all three of lint, build and tests run before
commit — build catches strict TypeScript errors that lint alone misses:

```
npm run lint
npm run build
npm run test
```

## Deployment

This branch ships to the tournament site before any `automa-undo` work begins.
Deployment goes through `ignac8/terraforming-mars-deploy` on the Hetzner VPS.

Two things to confirm at deploy time rather than assume:

- Games already in progress carry their own serialized `GameOptions`, so an
  in-flight tournament game created with undo enabled keeps it. The lock applies
  to newly created games. If existing games must also lose undo, that is a
  separate data migration and is not part of this spec.
- The deploy window should avoid an active tournament round.

## Flags for the organizers

Two judgement calls belong to the tournament organizers, not to this change:

1. **This reverses a documented decision.** The preset's comment explicitly said
   undo and the corporation pool were left to the table. Removing both is a
   rules change and the standing rule is that rules changes are confirmed with
   organizers first.
2. **Prescribing a corporation pool becomes impossible.** Organizers can
   currently supply `customCorporationsList` to fix exactly which tournament
   corporations are in play. After this change every tournament game deals five
   at random from the fork's full tournament set, and there is no way to narrow
   it. This is the intended outcome — the pool belongs to the fork, not to the
   game's creator — but it removes a working tool and organizers should hear it
   before the deploy, not after.
3. **Banning cards becomes impossible.** Forcing `bannedCards` and
   `includedCards` empty means tournament games always use the complete official
   base + Corporate Era pool. If organizers ever ban a card by convention, this
   removes the mechanism. Worth raising explicitly before deploy.

None of these block implementation. All three should be communicated.
