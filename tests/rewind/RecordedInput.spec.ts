import {expect} from 'chai';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {SelectSpace} from '../../src/server/inputs/SelectSpace';
import {restoreTestDatabase, setTestDatabase} from '../testing/setup';
import {SnapshotDatabase} from '../testing/SnapshotDatabase';
import {TestPlayer} from '../TestPlayer';
import {testGame} from '../TestingUtils';
import {cast} from '../../src/common/utils/utils';
import {InputResponse} from '../../src/common/inputs/InputResponse';

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
  });

  // Takes the "convert plants" action, which holds a sub-choice of the space for the greenery.
  function convertPlants(): InputResponse {
    player.plants = 8;
    player.popWaitingFor();
    player.takeAction();
    const action = cast(player.getWaitingFor(), OrOptions);
    const index = action.options.findIndex((option) => option instanceof SelectSpace);
    const select = cast(action.options[index], SelectSpace);
    const response: InputResponse = {type: 'or', index, response: {type: 'space', spaceId: select.spaces[0].id}};
    player.process(response);
    return response;
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
    expect(withInputs[1][0].stateHash).has.length(64);
    expect(game.inputsSinceSave).is.empty;
  });

  it('round-trips the inputs since the last save', () => {
    player.takeAction();
    const waitingFor = player.getWaitingFor()!;
    game.recordInput(player, waitingFor, {type: 'or', index: 0, response: {type: 'option'}});
    const serialized = game.serialize();
    expect(serialized.inputs).has.length(1);
    // Reloading takes the next action, which saves the game again with the same inputs.
    Game.deserialize(structuredClone(serialized));
    const rows = db.games.get(game.id)!;
    expect(rows[rows.length - 1]!.inputs).deep.eq(serialized.inputs);
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
