# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

```bash
npm run build                # Full build (static assets + server + client)
npm run build:server         # TypeScript compilation of server code
npm run build:client         # Webpack bundle of Vue client
npm run make:static          # Generate CSS and JSON assets (prerequisite for build)
npm start                    # Run server (node build/src/server/server.js)
npm run dev:server           # Dev server with watch (ts-node-dev)
npm run dev:client           # Webpack watch mode
```

## Testing

```bash
npm test                     # All tests (server + client)
npm run test:server          # Server tests (ts-mocha)
npm run test:client          # Client tests (mochapack)
```

Run a single server test:
```bash
npx ts-mocha --experimental-transform-types -p tests/tsconfig.json -r tests/testing/setup.ts "tests/path/to/test.spec.ts"
```

Test framework: Mocha + Chai. Tests live in `tests/` mirroring `src/` structure.

**Key test helpers:**
- `testGame(playerCount, options?)` in `tests/TestGame.ts` — creates a game with players, returns `[IGame, ...TestPlayer[]]`
- `TestPlayer` in `tests/TestPlayer.ts` — player wrapper with color-based factories (`TestPlayer.BLUE.newPlayer()`)
- `tests/testing/setup.ts` — required setup that provides a fake database

## Linting

```bash
npm run lint                 # All linting (server ESLint + i18n audit + client vue-tsc)
npm run lint:server          # ESLint on src/ and tests/
npm run lint:client          # Vue type checking (vue-tsc)
npm run lint:fix             # Auto-fix ESLint issues
```

Style: single quotes, 2-space indent, prefer const. Config in `eslint.config.mjs`.

## Architecture

**Client-server monolith** — TypeScript throughout, with a clear three-way split:

- `src/server/` — Game engine, card logic, database, HTTP routes
- `src/client/` — Vue 3 SFC components, card rendering, styles (LESS)
- `src/common/` — Shared types, enums, and interfaces used by both sides

Path alias: `@/*` maps to `src/*` (configured in tsconfig).

### Game Engine

`Game.ts` is the central controller — manages phases, turns, board state, and serialization. `Player.ts` manages player resources, production, cards, and actions. Games progress through phases defined in `src/common/Phase.ts`: INITIALDRAFTING → PRELUDES → CEOS → RESEARCH/DRAFTING → ACTION → PRODUCTION → SOLAR → INTERGENERATION → END.

### Card System

Cards extend the `Card` base class (`src/server/cards/Card.ts`) and implement interfaces like `IProjectCard`, `ICorporationCard`, `IPreludeCard`, or `ICeoCard` (defined in `src/server/cards/ICard.ts`).

**Declarative Behavior system** (`src/server/behavior/Behavior.ts`): Most card effects are expressed as data rather than imperative code:
```typescript
behavior: {
  production: {plants: 2},
  stock: {plants: 1},
  tr: 1,
  global: {oxygen: 1},
}
```
Executed by `BehaviorExecutor.ts`. Only override `play()`/`action()` for complex logic.

**Card registration:** Each module has a manifest file (e.g., `MoonCardManifest.ts`) exporting card factories. All manifests are aggregated in `src/server/cards/AllManifests.ts`. Card names are enumerated in `src/common/cards/CardName.ts`.

### Expansion Modules

Expansions are organized in parallel directory trees under `src/server/cards/<module>/` and `src/server/<module>/` (for non-card logic like turmoil, moon, colonies). Modules: base, corpera, promo, venus, colonies, prelude, prelude2, turmoil, community, ares, moon, pathfinders, ceo, starwars, underworld.

Enabled via boolean flags in `GameOptions` (`src/server/game/GameOptions.ts`).

### Player Input System

Composable input classes in `src/server/inputs/` (SelectCard, SelectSpace, SelectPayment, OrOptions, etc.) extend `BasePlayerInput`. Inputs are chainable via `.andThen(callback)` and serialized to models for the client. Each input type has a matching `InputResponse` discriminated union in `src/common/inputs/InputResponse.ts`.

### Database

`IDatabase` interface (`src/server/database/IDatabase.ts`) with implementations: SQLite (`SQLite.ts`), PostgreSQL (`PostgreSQL.ts`), LocalFilesystem (`LocalFilesystem.ts`). Game state is serialized as JSON via `SerializedGame`/`SerializedPlayer` types. Card backward compatibility handled through `CARD_RENAMES` in `src/server/createCard.ts`.

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

## Node Version

Requires Node.js >=22.x <=24.x (`.nvmrc` specifies v24).
