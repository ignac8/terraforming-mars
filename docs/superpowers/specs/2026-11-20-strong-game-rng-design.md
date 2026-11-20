# Strengthen the game RNG so players cannot predict the shuffle

Date: 2026-11-20.

## Intent and why

The game's random generator (`SeededRandom`, mulberry32) keeps its entire state in a single
32-bit word. The board, every deck shuffle, colonies, Turmoil events and all reshuffles run off
that one generator, and the state is seeded with `Math.random()` at game creation.

With only ~2^32 (about 4.3 billion) possible states, and because the Fisher-Yates shuffle fills
from the end while `Deck.draw()` pops from the end, each card a player legitimately sees pins one
generator output. A proof on this code recovered the full state from one seat's opening hand in
about 0.4 s on a 32-core machine (5 revealed cards already pin a unique state), and from the state
reproduced every other hand, draft pack and future draw. So a player could predict all hidden
information. This matters most on the tournament instance.

## Goals

- A live game's shuffle must not be reconstructable from the cards a player sees.
- Existing in-progress games (old saves) keep loading and playing.
- Determinism is preserved where the code and tests rely on it (board/deck unit tests, the
  incognito per-viewer mask, clone, rewind/replay).

## Non-goals

- A cryptographically secure generator. `sfc32` is a fast PRNG, not a CSPRNG; it is chosen because
  its 128-bit state is far beyond brute force from the little a player sees, while staying a cheap
  drop-in. A keyed CSPRNG/DRBG was the heavier alternative (see Approaches).
- Changing how ids are generated, or any other finding from the parallel cheat audit.

## Anti-goals

- Breaking old saves or the determinism the test suite depends on.
- Importing Node's `crypto` into the shared `common/` module (it must stay isomorphic for the
  client bundle).

## Constraints

- `src/common/utils/Random.ts` is shared client/server: no `node:crypto` there.
- `SeededRandom(numericSeed)` must stay bit-identical: 30 test files and the board shuffles assert
  exact sequences from it, and the incognito mask derives a per-viewer shuffle from it.
- The serialized game carries the generator (`seed` + `currentSeed` today); old saves must still load.

## Approaches

| | Approach | Trade-off | Decision |
|---|---|---|---|
| A | Keep mulberry32, seed it with more entropy | Does nothing — state is 32-bit by construction | Rejected |
| B | Add a 128-bit `sfc32` generator, crypto-seeded, used only for live games; keep `SeededRandom` for tests/boards/incognito/old saves | Two generators coexist, but zero blast radius on the suite and old games | **Chosen** |
| C | A keyed CSPRNG (HMAC-SHA256 / ChaCha20), serialized as key+counter | Closes it formally, but more code and a secret key that must never reach a client model | Deferred; B is enough for the threat (a player's partial observations) |

## How it was built (decisions made)

- `StrongRandom` (sfc32, 128-bit state) added to `common/utils/Random.ts`, pure, no crypto import.
  `StrongRandom.fromEntropy(words)` seeds from four 32-bit words and warms up 15 steps.
- `SeededRandom` is **unchanged** except for a new `serialize()` method; its mulberry32 sequence is
  untouched, so every existing determinism test and the incognito mask stay bit-identical.
- Serialization is a tagged union `SerializedRandom = {kind:'mulberry32',…} | {kind:'sfc32',…}`
  with `deserializeRandom()`. `SerializedGame` gains `rng?`; `seed?`/`currentSeed?` become
  optional, kept only to load pre-2026-11 saves.
- `Game.rng` is typed `GameRandom = SeededRandom | StrongRandom`. `Game.newInstance` takes
  `number | StrongRandom`: a number still builds mulberry32 (so all 68 test callers and `testGame`
  stay deterministic), a `StrongRandom` is used as-is. `serialize()` writes `this.rng.serialize()`;
  `deserialize()` uses `rng` when present, else falls back to the old `seed`/`currentSeed`.
- The single production caller, `ApiCreateGame`, seeds from the OS CSPRNG via a new server helper
  `src/server/utils/createStrongRandom.ts` (`crypto.randomBytes`).
- Rewind's `shuffleHiddenPiles` now writes a fresh strong generator and drops the legacy seed
  fields, so a reshuffled game continues unpredictably.

## Tests

- `StrongRandom`: determinism, range, serialize round-trip preserving all four words, `fromEntropy`
  validation, distinct streams.
- `SeededRandom.serialize()` round-trip.
- `Game`: generator round-trips and continues the same sequence; a pre-2026-11 `seed`/`currentSeed`
  save loads and reproduces the legacy mulberry32 sequence; a strong-seeded game serializes as sfc32.
- Updated `shuffleHiddenPiles` and `serializes properties` tests for the new `rng` field.
- Full server suite: 10327 passing, the only remaining failures are two pre-existing worktree
  environment failures that need a client build (`build/index.html`), unrelated to this change.

## Left to the builder / follow-ups

- Approach C (keyed CSPRNG) if formal unpredictability is ever wanted.
- The parallel cheat audit's F7 (Planner milestone leaks hand count during research) and F1
  (`/api/game` exposes judgeId unauthenticated) are separate fixes, not in this change.
