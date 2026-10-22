import {expect} from 'chai';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {SerializedGame} from '../../src/server/SerializedGame';
import {GameLoader} from '../../src/server/database/GameLoader';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {SelectSpace} from '../../src/server/inputs/SelectSpace';
import {Server} from '../../src/server/models/ServerModel';
import {freezeGame, unfreezeGame} from '../../src/server/rewind/freeze';
import {readRebuildSaves, replayToSave} from '../../src/server/rewind/rebuild';
import {isTableLocked} from '../../src/server/rewind/tableLock';
import {ApiWaitingFor} from '../../src/server/routes/ApiWaitingFor';
import {RouteError} from '../../src/server/routes/RouteError';
import {CardName} from '../../src/common/cards/CardName';
import {Payment} from '../../src/common/inputs/Payment';
import {Phase} from '../../src/common/Phase';
import {cast} from '../../src/common/utils/utils';
import {FakeClock} from '../common/FakeClock';
import {restoreTestDatabase, restoreTestGameLoader, setTestDatabase, setTestGameLoader} from '../testing/setup';
import {SnapshotDatabase} from '../testing/SnapshotDatabase';
import {MockResponse} from '../routes/HttpMocks';
import {RouteTestScaffolding} from '../routes/RouteTestScaffolding';
import {testGame} from '../TestGame';

const CACHE = {sleepMillis: 0, evictMillis: 100, idleMillis: 1000, sweep: 'manual'} as const;

describe('freeze', () => {
  let db: SnapshotDatabase;
  let game: IGame;
  // The save of the research phase the game played into.
  let research: number;

  function startLoader() {
    setTestGameLoader(GameLoader.newTestInstance(CACHE, new FakeClock()));
  }

  function choose(player: IPlayer, title: string) {
    const action = cast(player.getWaitingFor(), OrOptions);
    const text = (option: {title: string | {message: string}}) => typeof option.title === 'string' ? option.title : option.title.message;
    player.process({type: 'or', index: action.options.findIndex((option) => text(option) === title), response: {type: 'option'}});
  }

  // Plays the greenery standard project, which leaves the player's turn waiting for the tile's space.
  function startGreenery(player: IPlayer) {
    const action = cast(player.getWaitingFor(), OrOptions);
    const index = action.options.findIndex((option) => option.title === 'Standard projects');
    player.process({type: 'or', index, response: {type: 'projectCard', card: CardName.GREENERY_STANDARD_PROJECT, payment: {...Payment.EMPTY, megacredits: 23}}});
    cast(player.getWaitingFor(), SelectSpace);
  }

  function buyNothing(player: IPlayer) {
    cast(player.getWaitingFor(), SelectCard);
    player.process({type: 'card', cards: []});
  }

  // A two-player game played by real answers: both pass, so the second generation starts with research.
  async function play(stage: 'research' | 'one has bought' | 'action') {
    db = new SnapshotDatabase();
    setTestDatabase(db);
    startLoader();
    const [created, player1, player2] = testGame(2);
    game = created;
    await GameLoader.getInstance().add(game);
    for (const player of [player1, player2]) {
      player.heat = 40;
      player.megaCredits = 100;
    }
    player1.takeAction();
    choose(player1, 'Pass for this generation');
    choose(player2, 'Pass for this generation');
    research = rows().findIndex((row) => row?.phase === Phase.RESEARCH && row.generation === 2);
    expect(research).is.greaterThan(0);
    if (stage !== 'research') {
      buyNothing(player1);
    }
    if (stage === 'action') {
      buyNothing(player2);
    }
  }

  // A restart: the games are read from the database again.
  async function restart() {
    startLoader();
    game = (await GameLoader.getInstance().getGame(game.id))!;
  }

  function rows(): Array<SerializedGame> {
    return db.games.get(game.id) as Array<SerializedGame>;
  }

  function running(): Array<boolean> {
    return game.players.map((p) => p.timer.serialize().running);
  }

  // The clocks when only the active player is being waited on.
  function onlyActive(): Array<boolean> {
    return game.players.map((p) => p === game.activePlayer);
  }

  // A row without the fields a freeze patches.
  function withoutTableState(row: SerializedGame): unknown {
    const {frozen: _frozen, undoCount: _undoCount, ...rest} = row;
    return {...rest, players: row.players.map(({timer: _timer, ...player}) => player)};
  }

  async function refusal(call: Promise<unknown>): Promise<string | undefined> {
    try {
      await call;
    } catch (e) {
      return cast(e, RouteError).detail;
    }
    throw new Error('The call was not refused');
  }

  afterEach(() => {
    restoreTestDatabase();
    restoreTestGameLoader();
  });

  it('stops every clock and input, and lets them go on again', async () => {
    await play('action');
    const active = game.activePlayer;
    const undoCount = game.undoCount;
    expect(running()).deep.eq(onlyActive());

    const freezing = freezeGame(game);

    // Nothing was awaited yet: the gate holds, and no other table change gets in.
    expect(game.frozen).is.true;
    expect(running()).deep.eq([false, false]);
    expect(game.undoCount).eq(undoCount + 1);
    expect(isTableLocked(game.id)).is.true;
    expect(await refusal(unfreezeGame(game))).eq('A rewind is already running.');
    expect(await freezing).is.true;
    expect(isTableLocked(game.id)).is.false;
    expect(game.frozen).is.true;

    expect(await unfreezeGame(game)).is.true;

    expect(game.frozen).is.false;
    expect(running()).deep.eq(onlyActive());
    expect(game.undoCount).eq(undoCount + 2);
    expect(active.getWaitingFor()).is.not.undefined;
  });

  it('shows a page that polls with the old undo count the freeze and the unfreeze', async () => {
    await play('action');
    const scaffolding = new RouteTestScaffolding();
    await scaffolding.ctx.gameLoader.add(game);
    const active = game.activePlayer;
    async function poll(undoCount: number) {
      const res = new MockResponse();
      scaffolding.url = `/api/waitingfor?id=${active.id}&gameAge=${game.gameAge}&undoCount=${undoCount}`;
      await scaffolding.get(ApiWaitingFor.INSTANCE, res);
      return JSON.parse(res.content).result;
    }
    expect(await poll(game.undoCount)).eq('GO');

    for (const change of [freezeGame, unfreezeGame]) {
      const seen = game.undoCount;
      await change(game);
      expect(await poll(seen), change.name).eq('REFRESH');
    }
  });

  it('writes the freeze into the newest save wherever the game is', async () => {
    for (const run of ['turn start', 'mid-action', 'mid-research', 'reloaded']) {
      await play(run === 'mid-research' ? 'one has bought' : 'action');
      if (run === 'reloaded') {
        await restart();
      }
      if (run === 'mid-action') {
        startGreenery(game.activePlayer);
      }
      const before = structuredClone(rows());
      const undoCount = game.undoCount;

      expect(await freezeGame(game), run).is.true;

      const frozen = rows();
      const newest = frozen.length - 1;
      expect(frozen, run).has.length(before.length);
      expect(frozen.slice(0, newest), run).deep.eq(before.slice(0, newest));
      expect(withoutTableState(frozen[newest]), run).deep.eq(withoutTableState(before[newest]));
      expect(frozen[newest].frozen, run).is.true;
      expect(frozen[newest].undoCount, run).eq(undoCount + 1);
      expect(frozen[newest].players.map((p) => p.timer.running), run).deep.eq([false, false]);

      // Loading saves the game again, so the saved copy is loaded with the database stubbed out.
      restoreTestDatabase();
      const loaded = Game.deserialize(structuredClone(frozen[newest]));
      setTestDatabase(db);
      expect(loaded.frozen, run).is.true;
      expect(loaded.players.map((p) => p.timer.serialize().running), run).deep.eq([false, false]);

      expect(await unfreezeGame(game), run).is.true;

      expect(rows(), run).has.length(before.length);
      expect(rows()[newest], run).not.to.have.property('frozen');
      expect(rows()[newest].undoCount, run).eq(undoCount + 2);
      expect(rows()[newest].players.some((p) => p.timer.running), run).is.true;
    }
  });

  it('keeps a game frozen across a restart', async () => {
    await play('action');
    startGreenery(game.activePlayer);
    await freezeGame(game);

    await restart();

    const active = game.activePlayer;
    expect(game.frozen).is.true;
    expect(running()).deep.eq([false, false]);
    expect(Server.getPlayerModel(active).waitingFor).is.undefined;

    await unfreezeGame(game);

    // Prompts reached while frozen started no clock. Unfreezing starts the one a player is waiting on.
    expect(running()).deep.eq(onlyActive());
    expect(Server.getPlayerModel(active).waitingFor).is.not.undefined;
    choose(active, 'Pass for this generation');
  });

  it('replays across a patched row', async () => {
    await play('action');
    const active = game.activePlayer;
    choose(active, 'Convert 8 heat into temperature');
    await freezeGame(game);
    await unfreezeGame(game);
    choose(active, 'Convert 8 heat into temperature');
    choose(game.activePlayer, 'Convert 8 heat into temperature');
    const later = game.lastSaveId - 1;

    const saves = await readRebuildSaves(game, later);

    expect(saves[0].lastSaveId).eq(research);
    expect(saves.some((save) => save.frozen === undefined && save.undoCount > 0)).is.true;
    expect(replayToSave(saves).outcome).eq('replayed');
  });

  it('refuses a second freeze, an unfreeze of a running game, a finished game and a replaced game', async () => {
    const runs: Array<{name: string, setup: () => Promise<void> | void, call: () => Promise<unknown>, detail: string}> = [
      {name: 'frozen twice', setup: () => freezeGame(game).then(() => {}), call: () => freezeGame(game), detail: 'The game is already frozen.'},
      {name: 'unfrozen running', setup: () => {}, call: () => unfreezeGame(game), detail: 'The game is not frozen.'},
      {name: 'finished freeze', setup: () => {
        game.phase = Phase.END;
      }, call: () => freezeGame(game), detail: 'The game has ended.'},
      {name: 'replaced freeze', setup: () => {
        game.retired = true;
      }, call: () => freezeGame(game), detail: 'This game was rewound. Refresh this page.'},
      {name: 'replaced unfreeze', setup: async () => {
        await freezeGame(game);
        game.retired = true;
      }, call: () => unfreezeGame(game), detail: 'This game was rewound. Refresh this page.'},
    ];
    for (const run of runs) {
      await play('action');
      await run.setup();
      const state = {frozen: game.frozen, undoCount: game.undoCount, running: running()};

      expect(await refusal(run.call()), run.name).eq(run.detail);

      expect({frozen: game.frozen, undoCount: game.undoCount, running: running()}, run.name).deep.eq(state);
      expect(isTableLocked(game.id), run.name).is.false;
    }
  });

  it('says so when the change could not be saved, and keeps it in memory', async () => {
    const warn = console.warn;
    const ways: Array<{name: string, break: () => void}> = [
      // The row this game stands on is gone.
      {name: 'no such row', break: () => game.ownSaveId = 999},
      {name: 'database error', break: () => db.updateNewestSave = () => Promise.reject(new Error('down'))},
    ];
    try {
      for (const way of ways) {
        await play('action');
        const warnings: Array<unknown> = [];
        console.warn = (...args) => warnings.push(args);
        way.break();

        expect(await freezeGame(game), way.name).is.false;
        expect(game.frozen, way.name).is.true;
        expect(running(), way.name).deep.eq([false, false]);
        expect(await unfreezeGame(game), way.name).is.false;
        expect(game.frozen, way.name).is.false;

        expect(warnings, way.name).has.length(2);
      }
    } finally {
      console.warn = warn;
    }
  });
});
