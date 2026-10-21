# Tournament judge view

Status: design, waiting for approval. Branch: tournament only.

## Why

During tournament games the judges have no way to see hidden information. The spectator link shows
only what every player can see, and opening a player link claims that player's seat. A judge who is
asked to settle a dispute ("did they really have that card?", "what did they draft?") can't check
anything.

The request came from the tournament Discord on 2026-10-21, next to a complaint about the spectator
view freezing (fixed separately, see "Builds on" below). Marcin's idea: a hidden link, like the
spectator link, where the judge sees all of the info.

## Goals

- Every tournament game gets one judge link when it is created. Nobody has to opt in.
- The judge page is read-only. It shows the normal spectator view plus, for every player, what only
  that player can see:
  - cards in hand
  - drafted cards
  - dealt corporations, preludes, CEOs and project cards
  - the picked corporation
  - preludes and CEOs in hand
  - the choice the player is making right now (draft pack, research cards, any pending input)
- The judge also sees every log line, including the private ones a player only sees for themselves.
- The judge link is protected by a password the same way tournament player seats are. The first
  visitor claims it, and after that the link only works with `&password=...` in the address.
- The page stays current on its own, including during drafting and research, where no log line is
  written.
- The organizer finds the judge link on the game page (`game?id=g...`) next to the player and
  spectator links, every time they open that page.

## Non-goals

- Acting for a player, undoing, or changing game state in any way.
- Judge links for games that aren't tournament games, or for games created before this ships.
- More than one judge link per game. Several judges share the same full address, password included.
- An admin login or a serverId-based page. The organizer creates the games, so the game page is
  enough.
- Upstreaming. This lives on the tournament branch.

## Anti-goals (failures even if the page works)

- The judge id, link or judge data shows up anywhere a player can see it in normal play: the player
  page, the spectator page, `GameModel`, `PlayerViewModel`, the bug report dialog, the end screen.
  The one deliberate exception is the organizer's game page, below.
- The judge data includes any player's seat password. With those, the judge link could be used to
  play as anyone.
- Opening the judge page claims a player seat or changes anything about a player.
- Existing saved games stop loading. The new serialized field must be optional.

## Decided with Marcin

1. One link per game, a new participant type, rather than one server-wide secret key.
2. Password like player seats.
3. The organizer creates tournament games, so the link goes on the game page.
4. The link stays on the game page permanently, not only right after creation. Marcin chose this
   knowing that anyone who has the game page address can see the judge link. The password limits
   the damage once the link has been opened, so the page shows a one-line hint next to the link:
   open it now, before sharing this page. Wording is the builder's call.
5. The judge sees everything hidden.

## Facts from the code (tournament branch)

These come from reading the code. Line numbers are approximate.

- **Ids.**
  - Defined in `src/common/Types.ts`: `p` for player, `s` for spectator, `g` for game. `ParticipantId`
    is player or spectator.
  - Generated with `generateRandomId(prefix)` (`src/server/utils/server-ids.ts`) in
    `ApiCreateGame.ts`.
  - `UrlParams.participantId` accepts only `p` or `s`.
  - `GameLoader.add` maps every participant id to its game id.
- **Database.** All three backends need to learn about a new id:
  - PostgreSQL writes the `participants` row only on the first save.
  - SQLite `getGameId` hard-codes the `s` and `p` prefixes and throws on anything else.
  - LocalFilesystem derives participants from the serialized game.
- **Cloning.** `Cloner.clone` reuses the source game's spectator id, and `GameLoader.add` then rebinds
  that id to the clone. A judge id must be regenerated on clone, or the original game's judge link
  would start showing the clone.
- **Player passwords.**
  - `Handler.checkPlayerPassword` (`src/server/routes/Handler.ts`): the first request claims a random
    password, later requests must match it (`timingSafeEqual`), and a mismatch returns 401.
  - It is skipped when `playerPasswords` is off, for solo games, at `END`, and for the serverId or a
    Discord admin.
  - The password is stored on the player and serialized.
  - The client keeps it in the address bar (`passwordParam`, `App.update` `replaceState`), and every
    poll reuses `window.location.search`.
- **View models.**
  - `ServerModel.getPlayerModel` builds the private fields with `cardsToModel(player, ...)` and
    `getWaitingFor(player, ...)`. It also adds `password`.
  - `getSpectatorModel` is the public part.
  - `draftHand` is not in the model on its own. A player's current pack only appears as the options of
    their `waitingFor`.
- **Refresh signal.**
  - The spectator page refreshes when `gameAge` grows, and `gameAge` only grows in `Game.log()`.
  - `GameModel.step` is `lastSaveId`. It changes on every `game.save()`, including draft picks.
  - With undo off, saves happen only at turn starts and phase changes, so `lastSaveId` alone misses
    some changes to pending choices.
  - Every `PlayerInput` has a random `requestId`.
- **Tournament gate.** `gameOptions.tournamentExpansion`, set at game creation.
- **Game page.** `GameHome.vue` lists the player and spectator links. It is fed by `ApiCreateGame`
  and `ApiGame` (`SimpleGameModel`). `ApiGame` has no authentication: anyone with the game id gets
  it.

## Builds on

The spectator freeze fix (`port-polling-tournament`, fork PR #41) changes the polling loop in
`WaitingFor.vue` and makes `App.update()` return whether it replaced the view. Start the judge work
from the tournament branch after that fix is pushed. The judge page should get the same behavior:
quiet retries during a restart, and no permanent freeze after one failed fetch.

## Claude's calls (Marcin can override any of these)

- **Id prefix `j`, page path `/judge?id=j...`.** The judge id is added to the participants mapping
  like the spectator id, and regenerated on clone.
- **The judge password lives on the game**, serialized as an optional field. It needs its own check
  modeled on `checkPlayerPassword`, which is typed on a player. The serverId and Discord admins pass,
  as they do for players. Unlike player seats, the check is not skipped for solo games or at `END`:
  the page reveals every hand.
- **The judge model** is the spectator model plus a list with one entry per player: color plus the
  same private fields `getPlayerModel` builds, without `password`. Pull those fields out of
  `getPlayerModel` into a shared helper so the two can't drift. Use the "this player" variant of
  `getPlayer` for every player, so the judge sees true money and hand counts.
- **The page layout.** The spectator page as it is, plus one block per player under it with their
  hidden cards and their current choice.
  - The choice is shown read-only: no save button, nothing sent to the server.
  - Card order storage is keyed by player id, so the judge page must not share keys with a real
    player page.
- **Refresh.** The judge page polls for a signature built from `lastSaveId`, `gameAge`, `undoCount`
  and each player's current `requestId`, and refetches the judge model when the signature changes.
  - Compare with `!==`, not `>`.
  - Whether this is a judge branch in `ApiWaitingFor` or its own route is the builder's call. A judge
    branch must come before the `getPlayerById` call, which throws for unknown ids.
- **Logs.** The judge log route returns all lines.
- **New UI strings** get Polish translations. Only Polish and English are edited.
- **Tests.**
  - Server tests, each of which must fail when its change is reverted:
    - The judge model contains every player's hand and no password.
    - The judge password is claimed on the first visit and enforced after that.
    - A draft pick changes the judge signature.
    - A cloned game gets a new judge id.
  - The new Vue page gets at least a sanity test (repo rule). Whether it should get feature-rich
    tests is a question for Marcin at implementation time.

## Left to the builder

Component structure, route names, exactly where the link and hint sit on the game page, styling of
the per-player blocks, and how the pending choice is rendered read-only.
