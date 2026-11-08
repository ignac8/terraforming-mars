# Incognito games

Status: draft for Marcin's review, 2026-11-08. Branch: tournament only.

## Why

Request from Niewodnik on the tournament Discord, 2026-11-08. Players sometimes hit an opponent
because of who that opponent is, not because of the position on the board. A late game can also
be played to drag one particular person down the standings. Nobody can prove that this happened.
Foreign tournament Discords already play with hidden opponents, also on herokuapp, and Niewodnik
wants the option for his own games too.

The fix is to hide who is who. Each player sees opponents under neutral names and colors until
the game ends.

## Decisions (Marcin, 2026-11-08)

1. **The server does the hiding.** Until the game ends, a player or spectator never receives an
   opponent's real name or real color from the server. Opening dev tools must not reveal them.
2. **Hidden before and during the game, revealed at the end.** Once `phase === END`, every response
   carries real names and colors, as it does today.
3. **The judge sees real data.** So does anything gated by serverId (admin).
4. **The spectator is hidden like a player.** It gets its own mapping, which covers every seat.
5. **The shared game page (`game?id=g…`, the "general link") keeps working.** In incognito games it
   lists players alphabetically by name, with no colors and no turn order or first-player mark.
   Players still click their own name.
6. **Tournament instance only.** This is a create-game checkbox, off by default. It is available for
   any game with 2+ players on the tournament branch, not only games using the tournament
   expansion. It is not ported to automa or main.
7. **Nobody learns the seat order before the end, the creator included.** An incognito game
   shuffles the seats on the server when it is created. The response to the creator shows the same
   alphabetical list without colors that the shared page shows. This lets the organizer play in their
   own incognito games without an advantage. Only the judge sees the real seat order.

## Calls made while writing this (not asked; check these)

- **Incognito forces player passwords on.** Without passwords, any player could open an opponent's
  link from the shared page and see that opponent's real name as `thisPlayer`. Since seat order is
  visible in the game, that would expose the whole table. The server forces the option, and the form
  shows the passwords checkbox as on and locked, the way the undo option already does
  (`undoNeedsPasswords`).
- **Fake colors are a uniform shuffle.** An opponent's fake color may equal some player's real color.
  That gives nothing away, because nobody sees real colors before the end. With 6 players it can't be
  avoided anyway, since only 4 colors are free for 5 opponents.
- **Handicaps stay visible** (a non-goal). Tournament games turn them off, and they affect scoring.

## What each viewer sees while the game runs

- **Themselves:** their real name and real color. The client-side "My color" preference
  (`localColors.ts`) still applies on top.
- **Each opponent:** a fake color, with a name that is that color's label ("Red", "Turquoise",
  "Transparent" for `clear`). Fake colors are drawn from all 10 `PLAYER_COLORS` minus the viewer's
  own real color, so the set of colors in use reveals nothing. Each viewer has their own mapping.
  The mapping never changes during a game: "Red" is the same opponent every generation and after
  a server restart.
- **Spectator:** one mapping over all seats, also drawn from all 10 colors.
- **Names in the viewer's language.** The fake name is shown translated: a Polish player sees
  "Czerwony". The keys already exist in `src/locales/pl/ui.json`.
- **Everything that refers to a player** uses the fake identity consistently: the board tiles, the log,
  milestones and awards, colonies, the Turmoil delegates, waiting-for indicators, the rewind vote banner,
  the replay and the prompts. An example prompt is "steal from whom", where picking "Red" acts on the
  real player behind Red.

Seat order stays visible inside the game. Turn order is part of play and players need to know who
acts after them. It reveals identity only when combined with a known seat list, and decisions 5
and 7 make sure nobody has one.

## Scope of the server-side rewrite

The inventory was made on origin/tournament 3754e48ad. Everything below is in scope.

**Outbound, participant-scoped (p or s id), phase !== END, incognito on.** Rewrite every response
that carries player data:

- `api/player`, `player/input`, `api/rewind`, `api/spectator` and `api/waitingfor`
- `api/game/logs`
- `api/replay/moves` and `api/replay/view`
- `api/rewind/vote`, plus any other route returning PlayerViewModel or SpectatorModel

`reset` is solo-only, so it is out.

**What gets rewritten in those responses:**

- **Every color field.** `src/client/utils/localColors.ts` `COLOR_KEYS` already names the full set
  (color, coOwner, excavator, chairman, partyLeader, visitor, activePlayer, lobby,
  passedPlayers, colonies, players, waitingFor, movers, viewerColor, defaultViewAs, viewAs,
  requester), plus log data of type PLAYER. `neutral`, `bronze` and `NEUTRAL` pass through.
- **Player-name fields:**
  - `PublicPlayerModel.name`
  - `ClaimedMilestoneModel.playerName`
  - `FundedAwardModel.playerName`

  A blanket `name` key match would also hit card, colony and milestone names, so the rewrite has to
  know which `name` belongs to a player.
- **Real names embedded in text.** These are prompt titles and option titles:
  - Asimov's award list (`cards/ceos/Asimov.ts:77`)
  - `ChoosePoliticalAgenda.ts:27`
  - the VP-breakdown "funded by" detail (`calculateVictoryPoints.ts:104-111`)
  - the "land claimed by <name>" errors (`Game.ts:1599`, `MoonExpansion.ts:97`)

  - the raw color in the error message at `DeltaProjectExpansion.ts:46` (also in scope)

  Either rewrite them so they carry the player as a PLAYER datum, or replace the names in the
  outgoing text. The builder chooses.

**Inbound.** Translate fake colors back to real colors:

- `SelectPlayer` and `SelectDelegate` responses, including when nested inside `or`, `and` and
  `initialCards` wrappers, on `player/input`.
- The `as=<color>` parameter of `api/replay/view`.

**The shared game page.** For incognito games before END, `api/game?id=g` (no auth) returns
players sorted by name with no colors, and without `activePlayer`. It keeps the player ids, because
GameHome builds the links from them. GameHome hides the color square and the 1st/2nd/3rd ordinal.
`api/creategame`'s response gets the same treatment, because the client renders GameHome directly
from it (`CreateGameForm.vue:1214-1222`, also stored via `history.replaceState`). Seats are
shuffled at creation (decision 7). The first player is then whoever ends up in seat 0, or a random
pick as today. Either way the creator never sees it.

**Unchanged:**

- `api/judge*`
- the judge branches of the shared routes
- the admin routes (`api/games`, `load_game` and others)
- `end_game_log` (END only)

## Behaviour details

- **A rewind out of END.** If a finished game is rewound into play (rewind vote or judge rewind),
  hiding resumes. Players will already know who was who, and that is accepted.
- **Persisted state.** The mapping must be derived deterministically, for example seeded from the
  game id and the viewer's participant id. Then nothing new is persisted, and old saves and clones
  keep working. Add the option to `GameOptions` with a deserialize default of `false`, following the
  `judgeUndo` line.
- **Where hiding stops.** `ApiReplayView` decides "finished" with `isFinished(game)`, not
  `phase === END`. Use one check everywhere, so that no route reveals real data while another still
  hides it.
- **Option plumbing** follows `judgeLink`:
  - `CreateGameForm.vue` checkbox (shown when players > 1, outside the tournament-expansion block),
    `CreateGameModel`, `defaultCreateGameModel` and `JSONProcessor`
  - `NewGameConfig`
  - `ApiCreateGame` (forced to false for solo)
  - `GameOptions` and `DEFAULT_GAME_OPTIONS`
  - the `TournamentMode.spec` key list, as passthrough
  - `GameOptionsModel` if the client needs it, to hide markers on GameHome

  The checkbox label is "Incognito (hide opponents' names and colors until the game ends)", with a Polish
  translation.

## Non-goals

- Hiding identity from timers or play style. A player who recognizes a habit can still guess.
- Fixing the existing weaknesses of the shared link:
  - it hands out every player link
  - a seat that is not yet claimed can be taken by whoever opens it first
  - it shows the judge id
- Hiding the viewer's own identity from themselves.
- Hiding handicaps.
- Turning incognito on for a game that is already running.
- Automa and main ports, and upstreaming.

## Anti-goals (failure even if it "works")

- A real opponent name anywhere in a p or s response before END, or a color field that shows an
  opponent in anything other than their mapped fake color. That includes log data, prompt text,
  error bodies and replay views.
- A fake color that changes between polls or after a restart. Players would lose track of who's who.
- A player choice that reaches the wrong real player.
- Any change to games with incognito off. That includes response shape and performance.

## Proof it works

- A leak test. Build a multiplayer incognito game with unique player names (e.g. `Zzalice`) and with
  features that put colors and names in many places: tiles, milestones, awards, colonies, a pending
  SelectPlayer, and log lines. Fetch every participant-scoped route as a player and as the spectator,
  and assert two things. No opponent real name appears anywhere in the body. Every color field equals
  the viewer's mapping of the real value, so the test compares against the unmasked model and does
  not just look for real color strings. Repeat at END and assert the real data is back.
- An inbound test. As a player, answer a SelectPlayer prompt with a fake color, and assert that the
  intended real player was hit.
- A stability test. The mapping is identical across two fetches and after a serialize and
  deserialize round trip.
- A GameHome client test: alphabetical order, no color square or ordinal for incognito games, and
  unchanged otherwise.
- A create test. An incognito game forces passwords on, its creategame response lists players
  alphabetically without colors, and its seat order is shuffled. Use a seeded random to make that
  deterministic.

## Left to the builder

- Where the rewrite lives: one shared helper called by each handler, or a hook in
  `responses.writeJson` with the viewer passed in. Also whether the server reuses the
  `COLOR_KEYS` list by moving it to `src/common`.
- The exact seeding and shuffle for the mapping.
- How the client gets the translated fake name. The server can send the color label, and the
  client translates player names it knows are fake. Or another way, as long as a Polish client shows
  Polish color names and an opponent never sees a real name.
