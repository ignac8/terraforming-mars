# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run build                # Full build: CSS + JSON static files, server (tsc), client (webpack)
npm run build:server         # TypeScript compile server only: tsc --build src/tsconfig.json
npm run build:client         # Webpack production bundle (runs make:cards first)
npm run build:test           # Compile tests: tsc --build tests/tsconfig.json
npm run make:static          # Generate CSS and JSON assets (prerequisite for build)
npm start                    # Run server (node build/src/server/server.js)
npm run lint                 # All lints: eslint + i18n audit + vue-tsc
npm run lint:client          # Vue type checking: vue-tsc --noEmit
npm run lint:server          # ESLint on src and tests
npm run lint:fix             # ESLint autofix
```

### Running Tests

```bash
npm run test                 # All tests (server + client)
npm run test:server          # Mocha server tests
npm run test:client          # Mochapack client component tests

# Single server test file
npx mocha --import=tsx --require tests/testing/setup.ts "tests/cards/base/Algae.spec.ts"

# Single client test file
cross-env NODE_ENV=development mochapack --require tests/client/components/setup.ts "tests/client/components/Board.spec.ts"
```

### Dev Servers

```bash
npm run dev:server           # Server with hot reload (tsx watch)
npm run dev:client           # Webpack watch mode
npm run watch:less           # CSS rebuild on change
```

## Architecture

### Three-Layer Structure

- **`src/server/`** - Game engine, card logic, routes, database. Runs on Node.js.
- **`src/client/`** - Vue 3 frontend (Options API, `defineComponent`). Bundled with Webpack.
- **`src/common/`** - Shared types, enums, and models used by both client and server. No runtime logic that depends on either side.

The `@/` import alias maps to `./src/` (configured in tsconfig paths and webpack).

### Game Engine

`Game.ts` is the central controller — manages phases, turns, board state, and serialization. `Player.ts` manages player resources, production, cards, and actions. Games progress through phases defined in `src/common/Phase.ts`: INITIALDRAFTING → PRELUDES → CEOS → RESEARCH/DRAFTING → ACTION → PRODUCTION → SOLAR → INTERGENERATION → END.

### Card System

Cards are the core domain object (~1000 cards across 15 modules). Each card involves:

1. **Card class** (`src/server/cards/<module>/CardName.ts`) - Extends `Card`, defines cost, tags, requirements, behavior, and metadata. Simple cards are purely declarative via the `behavior` property. Complex cards override `play()`, `action()`, `canAct()`, etc.
2. **CardName enum entry** (`src/common/cards/CardName.ts`) - Every card needs an enum value here.
3. **Module manifest** (`src/server/cards/<module>/<Module>CardManifest.ts`) - Registers the card's factory in a `ModuleManifest`. All manifests aggregate in `AllManifests.ts`.
4. **Card renderer** - Defined inline in the card's `metadata.renderData` using the `CardRenderer.builder()` DSL.
5. **Test** (`tests/cards/<module>/CardName.spec.ts`) - Uses `testGame()` and `TestPlayer` helpers.

Card types: `EVENT`, `ACTIVE` (has action), `AUTOMATED`, `PRELUDE`, `CORPORATION`, `CEO`, `STANDARD_PROJECT`, `STANDARD_ACTION`.

### Behavior System

The `Behavior` type (`src/server/behavior/Behavior.ts`) is a declarative DSL for card effects: production changes, resource gains, tile placement, TR changes, etc. Cards set `behavior` (on play) and/or `action` (repeatable) properties. The `BehaviorExecutor` (`src/server/behavior/Executor.ts`) interprets these at runtime. Prefer declarative `behavior` over imperative `play()` overrides when possible.

### Deferred Actions

Player choices and multi-step effects use `DeferredAction` (`src/server/deferredActions/`). Actions are queued via `game.defer(action)` with a `Priority` and resolved in order. The `.andThen()` callback chains follow-up logic after a deferred action resolves.

### Player Inputs

When a player needs to make a choice, the server returns a `PlayerInput` (e.g., `SelectSpace`, `SelectCard`, `OrOptions`). These live in `src/server/inputs/`. The client renders the appropriate UI based on the input type. Each input type has a matching `InputResponse` discriminated union in `src/common/inputs/InputResponse.ts`.

### Expansion Modules

Each expansion has its own directory under `src/server/cards/` and a manifest. Modules: `base`, `corpera` (Corporate Era), `promo`, `venus`, `colonies`, `prelude`, `prelude2`, `turmoil`, `community`, `ares`, `moon`, `pathfinders`, `ceo`, `starwars`, `underworld`. Cross-expansion card compatibility is declared via `compatibility` in `CardFactorySpec`. Expansions are enabled via boolean flags in `GameOptions` (`src/server/game/GameOptions.ts`).

### Client Components

Vue 3 with Options API. Components are in `src/client/components/`. The root `App.ts` routes between screens. `PlayerHome.vue` is the main game view. Card rendering components are in `src/client/components/card/`. Styles use Less (`src/styles/`).

### Database

Pluggable backends in `src/server/database/`: `SQLite`, `PostgreSQL`, `LocalFilesystem`. Games are serialized/deserialized through `SerializedGame`/`SerializedPlayer` types. `GameLoader` handles caching and retrieval. Card backward compatibility handled through `CARD_RENAMES` in `src/server/createCard.ts`.

### Testing Patterns

- **`testGame(n, options?)`** in `tests/TestGame.ts` - Creates a game with n players, returns `[game, ...players]`. Skips initial card selection by default.
- **`TestPlayer`** in `tests/TestPlayer.ts` - Extends `Player` with test utilities. Use static factories: `TestPlayer.BLUE`, `TestPlayer.RED`, etc.
- Server card tests: instantiate the card, call `canPlay()`/`play()`/`action()`, assert state changes.
- Client tests: use `@vue/test-utils` mount/shallowMount with JSDOM setup from `tests/client/components/setup.ts`.
- Test framework: Mocha + Chai (expect style). Client tests use mochapack.
- `tests/testing/setup.ts` provides a fake database used by all server tests.

### Internationalization

Custom i18n via `src/client/directives/i18n.ts` with `v-i18n` directive. Translation files in `src/locales/`. Strings are matched by exact text content.

## Adding a New Card

1. Add entry to `src/common/cards/CardName.ts`
2. Create card class in `src/server/cards/<module>/YourCard.ts` extending `Card`
3. Register in the module's manifest file (e.g., `src/server/cards/<module>/*CardManifest.ts`)
4. Add tests in `tests/cards/<module>/YourCard.spec.ts`

## Key Enums

- `CardName` — `src/common/cards/CardName.ts` (600+ entries)
- `Tag` — `src/common/cards/Tag.ts`
- `CardType` — `src/common/cards/CardType.ts`
- `Resource` — `src/common/Resource.ts` (megacredits, steel, titanium, plants, energy, heat)
- `TileType` — `src/common/TileType.ts` (numeric enum — stored as numbers in database)
- `SpaceBonus` — `src/common/boards/SpaceBonus.ts` (numeric enum)
- `Phase` — `src/common/Phase.ts`

## Style Guide

- Single quotes, 2-space indent, prefer const. Config in `eslint.config.mjs`.
- Follow the style of the code around the file. If this is a new file, follow the style of the code in the directory.

## Upstreaming (this fork)

MarsBot code is upstreamed to terraforming-mars/terraforming-mars one file at a time.
PR state, per-PR divergences from the automa branch, and the per-PR process live in
`automa/UPSTREAM-PRS.md`. Update that file whenever PR status changes.

## Deployment (this fork)

Production deployment (Docker Compose on a Hetzner VPS, two instances: this branch
plus the `tournament` branch) lives on the orphan **`deploy` branch** — compose file,
Caddyfile, the cron-driven `update.sh` and the full setup/migration runbook in its
README. This branch contains no deployment files. `update.sh` auto-merges
`upstream/main` into this branch on the server, so pushes here go live within a
minute.

**Server access:** SSH details kept in personal notes (not committed).

## Node Version

`.nvmrc` specifies v24; `package.json` `engines` says `22.x` (upstream's value, kept as-is). Run `nvm use` before any `npm` command to switch to the version `.nvmrc` declares — on other versions, optional deps (`pg`, `better-sqlite3`) get skipped and the client tests break (Node 25+ has a half-working native `localStorage` that conflicts with jsdom).
