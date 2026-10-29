import {expect} from 'chai';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {SelectSpace} from '../../src/server/inputs/SelectSpace';
import {restoreTestDatabase, restoreTestGameLoader, setTestDatabase, setTestGameLoader} from '../testing/setup';
import {IGameLoader} from '../../src/server/database/IGameLoader';
import {SnapshotDatabase} from '../testing/SnapshotDatabase';
import {TestPlayer} from '../TestPlayer';
import {maxOutOceans, setOxygenLevel, setTemperature, testGame} from '../TestingUtils';
import {cast} from '../../src/common/utils/utils';
import {InputResponse} from '../../src/common/inputs/InputResponse';
import {IPlayer} from '../../src/server/IPlayer';
import {SelectOption} from '../../src/server/inputs/SelectOption';
import {BeginnerCorporation} from '../../src/server/cards/corporation/BeginnerCorporation';
import {Phase} from '../../src/common/Phase';
import {MAX_OXYGEN_LEVEL, MAX_TEMPERATURE} from '../../src/common/constants';
import {loadSandboxGame} from '../../src/server/replay/sandbox';
import {stateHash} from '../../src/server/rewind/stateHash';

describe('RecordedInput', () => {
  let db: SnapshotDatabase;
  let game: IGame;
  let player: TestPlayer;

  beforeEach(() => {
    db = new SnapshotDatabase();
    setTestDatabase(db);
    [game, player] = testGame(1);
  });

  afterEach(() => {
    restoreTestDatabase();
    restoreTestGameLoader();
  });

  // Takes the "convert plants" action, which holds a sub-choice of the space for the greenery.
  function answerConvertPlants(who: IPlayer): InputResponse {
    const action = cast(who.getWaitingFor(), OrOptions);
    const index = action.options.findIndex((option) => option instanceof SelectSpace);
    const select = cast(action.options[index], SelectSpace);
    const response: InputResponse = {type: 'or', index, response: {type: 'space', spaceId: select.spaces[0].id}};
    who.process(response);
    return response;
  }

  function convertPlants(): InputResponse {
    player.plants = 8;
    player.popWaitingFor();
    player.takeAction();
    return answerConvertPlants(player);
  }

  it('a save carries the inputs processed since the previous save', () => {
    // Taking the next action saves the game, so each answer lands in the save that follows it.
    const first = convertPlants();
    const second = convertPlants();

    const withInputs = db.games.get(game.id)!.map((row) => row!.inputs!).filter((inputs) => inputs.length > 0);
    expect(withInputs).has.length(2);
    expect(withInputs[0]).has.length(1);
    expect(withInputs[0][0].response).deep.eq(first);
    expect(withInputs[1]).has.length(1);
    expect(withInputs[1][0]).deep.include({playerId: player.id, response: second});
    expect(withInputs[1][0].prompt.type).eq('or');
    expect(game.inputsSinceSave).is.empty;

    // The hash is that of the state the answer was applied to: the save made just before it.
    const rows = db.games.get(game.id)!;
    const index = rows.length - 1 - [...rows].reverse().findIndex((row) => row!.inputs!.length > 0);
    expect(index).gt(0);
    expect(rows[index]!.inputs![0].stateHash).eq(stateHash(rows[index - 1]!));
  });

  it('round-trips the inputs since the last save, and a save that has none', () => {
    player.takeAction();
    const waitingFor = player.getWaitingFor()!;
    game.recordInput(player, waitingFor, {type: 'or', index: 0, response: {type: 'option'}});
    for (const recorded of [true, false]) {
      const serialized = game.serialize();
      expect(serialized.inputs).has.length(1);
      // A save written before inputs were recorded.
      if (!recorded) {
        delete serialized.inputs;
      }
      // Reloading takes the next action, which saves the game again with the same inputs.
      Game.deserialize(structuredClone(serialized));
      const rows = db.games.get(game.id)!;
      expect(rows[rows.length - 1]!.inputs, String(recorded)).deep.eq(serialized.inputs);
    }
  });

  it('the save at the end of the game carries the inputs and the completing save none', async () => {
    const [endGame, first, second] = testGame(2, {}, '-end');
    first.playedCards.push(new BeginnerCorporation());
    second.playedCards.push(new BeginnerCorporation());
    maxOutOceans(first);
    setTemperature(endGame, MAX_TEMPERATURE);
    setOxygenLevel(endGame, MAX_OXYGEN_LEVEL);
    first.plants = 0;
    second.plants = 0;
    endGame.phase = Phase.PRODUCTION;
    db.saveGameResults = () => {};
    // The real completeGame also purges unfinished games, and the real loader remembers the purged ids.
    setTestGameLoader({
      saveGame: (g: IGame) => db.saveGame(g),
      completeGame: (g: IGame) => db.saveGame(g),
      mark: () => {},
    } as unknown as IGameLoader);
    endGame.recordInput(first, new SelectOption('x'), {type: 'option'});
    const saved = endGame.serialize();
    const rows = db.games.get(endGame.id)!;
    const rowsBefore = rows.length;

    // Loading a game that is over ends it: one save in the END phase, then the completing save.
    Game.deserialize(structuredClone(saved));
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));

    const written = rows.slice(rowsBefore);
    expect(written.map((row) => row!.phase)).deep.eq([Phase.END, Phase.END]);
    expect(written.map((row) => row!.inputs!.length)).deep.eq([1, 0]);
  });

  it('a sandbox game records nothing', () => {
    // A player who has a corporation, so loading goes to the action phase.
    player.playedCards.push(new BeginnerCorporation());
    game.phase = Phase.ACTION;
    player.plants = 8;
    player.popWaitingFor();
    player.takeAction();
    const rows = db.games.get(game.id)!;
    const sandbox = loadSandboxGame(rows[rows.length - 1]!);

    answerConvertPlants(sandbox.players[0]);

    expect(sandbox.inputsSinceSave).is.empty;
  });

  it('does not record an answer the game rejects', () => {
    player.plants = 8;
    player.takeAction();
    const before = game.serialize().inputs;
    expect(() => player.process({type: 'or', index: 999, response: {type: 'option'}})).to.throw();
    expect(game.serialize().inputs).deep.eq(before);
    expect(player.getWaitingFor()).is.not.undefined;
  });
});
