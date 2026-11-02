import {expect} from 'chai';
import {testGame, TestGameOptions} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {BeginnerCorporation} from '../../src/server/cards/corporation/BeginnerCorporation';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {SerializedGame} from '../../src/server/SerializedGame';
import {IGameLoader} from '../../src/server/database/IGameLoader';
import {Phase} from '../../src/common/Phase';
import {MAX_OXYGEN_LEVEL, MAX_TEMPERATURE} from '../../src/common/constants';
import {loadSandboxGame} from '../../src/server/replay/sandbox';
import {InMemoryDatabase} from '../testing/InMemoryDatabase';
import {restoreTestDatabase, restoreTestGameLoader, setTestDatabase, setTestGameLoader} from '../testing/setup';
import {maxOutOceans, runAllActions, setOxygenLevel, setTemperature} from '../TestingUtils';

describe('loadSandboxGame', () => {
  let db: InMemoryDatabase;
  let calls: Array<string>;

  beforeEach(() => {
    db = new InMemoryDatabase();
    calls = [];
    setTestDatabase(db);
  });

  afterEach(() => {
    restoreTestDatabase();
    restoreTestGameLoader();
  });

  // Anything that would write, in the database or in the game cache, is recorded in `calls`.
  function recordWrites() {
    db.saveGame = () => {
      calls.push('db.saveGame');
      return Promise.resolve();
    };
    db.saveGameResults = () => {
      calls.push('db.saveGameResults');
    };
    db.markFinished = () => {
      calls.push('db.markFinished');
      return Promise.resolve();
    };
    setTestGameLoader({
      mark: () => calls.push('loader.mark'),
      saveGame: () => {
        calls.push('loader.saveGame');
        return Promise.resolve();
      },
      completeGame: () => {
        calls.push('loader.completeGame');
        return Promise.resolve();
      },
    } as unknown as IGameLoader);
  }

  // Players who already picked a corporation, so loading does not go back to the initial research phase.
  function startedGame(playerCount: number, options?: Partial<TestGameOptions>): [IGame, ...Array<TestPlayer>] {
    const [game, ...players] = testGame(playerCount, options);
    players.forEach((player) => player.playedCards.push(new BeginnerCorporation()));
    return [game, ...players];
  }

  // gotoEndGame saves and completes the game after an await.
  function flushAsyncWrites(): Promise<void> {
    return new Promise((resolve) => setImmediate(resolve));
  }

  function lastSave(game: IGame): SerializedGame {
    const rows = db.games.get(game.id)!;
    return rows[rows.length - 1]!;
  }

  function finishedGameSave(plants: number): SerializedGame {
    const [game, player, other] = startedGame(2);
    maxOutOceans(player);
    setTemperature(game, MAX_TEMPERATURE);
    setOxygenLevel(game, MAX_OXYGEN_LEVEL);
    player.plants = plants;
    other.plants = 0;
    game.phase = Phase.PRODUCTION;
    return game.serialize();
  }

  it('loading an action-phase save writes nothing', () => {
    const [game, player] = startedGame(2);
    game.phase = Phase.ACTION;
    player.takeAction();
    runAllActions(game);
    game.save();
    const rowsBefore = db.games.get(game.id)!.length;
    const saved = lastSave(game);
    const copy = structuredClone(saved);
    recordWrites();

    const sandbox = loadSandboxGame(saved);

    expect(sandbox.isSandbox).is.true;
    expect(sandbox.phase).eq(Phase.ACTION);
    expect(db.games.get(game.id)!.length).eq(rowsBefore);
    expect(calls).deep.eq([]);
    expect(saved).deep.eq(copy); // input untouched
  });

  it('loading a research-phase save writes nothing', () => {
    const [game] = startedGame(2);
    game.phase = Phase.RESEARCH;
    game.save();
    const rowsBefore = db.games.get(game.id)!.length;
    const saved = lastSave(game);
    expect(saved.phase).eq(Phase.RESEARCH);
    const copy = structuredClone(saved);
    recordWrites();

    const sandbox = loadSandboxGame(saved);

    expect(sandbox.isSandbox).is.true;
    expect(sandbox.phase).eq(Phase.RESEARCH);
    expect(db.games.get(game.id)!.length).eq(rowsBefore);
    expect(calls).deep.eq([]);
    expect(saved).deep.eq(copy);
  });

  it('loading an initial research save writes nothing', () => {
    const [game] = testGame(2, {skipInitialCardSelection: false});
    game.save();
    const saved = lastSave(game);
    const copy = structuredClone(saved);
    recordWrites();

    const sandbox = loadSandboxGame(saved);

    expect(sandbox.isSandbox).is.true;
    expect(sandbox.phase).eq(Phase.RESEARCH);
    expect(calls).deep.eq([]);
    expect(saved).deep.eq(copy);
  });

  it('loading a final-greenery save writes no results and no finished mark', () => {
    const saved = finishedGameSave(8);
    recordWrites();

    const sandbox = loadSandboxGame(saved);

    expect(sandbox.isSandbox).is.true;
    expect(sandbox.phase).eq(Phase.PRODUCTION);
    expect(calls).deep.eq([]);
  });

  it('reaching the end of the game in a sandbox writes no results and no finished mark', async () => {
    const saved = finishedGameSave(0);
    recordWrites();

    const sandbox = loadSandboxGame(saved);
    await flushAsyncWrites();

    expect(sandbox.phase).eq(Phase.END);
    expect(calls).deep.eq([]);
  });

  it('loading a finished game save does not mark it in the cache', () => {
    const [game] = startedGame(2);
    game.phase = Phase.END;
    const saved = game.serialize();
    recordWrites();

    const sandbox = loadSandboxGame(saved);

    expect(sandbox.phase).eq(Phase.END);
    expect(calls).deep.eq([]);
  });

  it('a normal load still saves and marks, so the recording above is meaningful', async () => {
    const saved = finishedGameSave(0);
    recordWrites();

    const game = Game.deserialize(structuredClone(saved));
    expect(game.isSandbox).is.false;
    await flushAsyncWrites();
    expect(game.phase).eq(Phase.END);

    expect(calls).to.include('db.saveGameResults');
    expect(calls).to.include('loader.saveGame');
    expect(calls).to.include('loader.completeGame');
    expect(calls).to.include('loader.mark');
  });

  it('a normal load of an action-phase save still saves', () => {
    const [game] = startedGame(2);
    game.phase = Phase.ACTION;
    const saved = game.serialize();
    recordWrites();

    Game.deserialize(structuredClone(saved));

    expect(calls).to.include('loader.saveGame');
  });

  it('does not share state with the input save', () => {
    const [game] = startedGame(2);
    game.phase = Phase.ACTION;
    game.save();
    const saved = lastSave(game);
    const logLength = saved.gameLog.length;

    const sandbox = loadSandboxGame(saved);
    sandbox.log('a sandbox only message');

    expect(saved.gameLog.length).eq(logLength);
    expect(sandbox.gameLog).not.eq(saved.gameLog);
  });

  it('does not serialize the sandbox flag', () => {
    const [game] = startedGame(2);
    game.phase = Phase.ACTION;
    const sandbox = loadSandboxGame(game.serialize());

    expect(sandbox.serialize()).not.has.property('isSandbox');
  });
});
