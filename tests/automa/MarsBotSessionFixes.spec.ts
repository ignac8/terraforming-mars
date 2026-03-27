import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Game} from '../../src/server/Game';
import {MarsBot} from '../../src/server/automa/MarsBot';
import {BoardName} from '../../src/common/boards/BoardName';
import {Phase} from '../../src/common/Phase';
import {Resource} from '../../src/common/Resource';
import {getMcPerVP} from '../../src/common/automa/AutomaTypes';
import {GlobalParameter} from '../../src/common/GlobalParameter';
import {Mayor} from '../../src/server/milestones/Mayor';
import {Gardener} from '../../src/server/milestones/Gardener';
import {Landlord} from '../../src/server/awards/Landlord';

function createAutomaGame(): {game: IGame, human: TestPlayer, marsBot: MarsBot} {
  const [game, human] = testGame(1, {
    automaOption: true,
    automaDifficulty: 'normal',
    boardName: BoardName.THARSIS,
  });
  expect(game.marsBot).to.not.be.undefined;
  return {game, human, marsBot: game.marsBot!};
}

describe('MarsBotSessionFixes', () => {
  it('tile ownership preserved for greenery', () => {
    const {game, marsBot} = createAutomaGame();
    const spaces = game.board.getAvailableSpacesForGreenery(marsBot.player);
    expect(spaces.length).to.be.greaterThan(0);
    const space = spaces[0];

    game.addGreenery(marsBot.player, space, true);

    expect(space.player).to.eq(marsBot.player);
  });

  it('tile ownership preserved for city', () => {
    const {game, marsBot} = createAutomaGame();
    const spaces = game.board.getAvailableSpacesOnLand(marsBot.player);
    expect(spaces.length).to.be.greaterThan(0);
    const space = spaces[0];

    game.addCity(marsBot.player, space);

    expect(space.player).to.eq(marsBot.player);
  });

  it('solar phase clears ownership', () => {
    const {game, marsBot} = createAutomaGame();
    game.phase = Phase.SOLAR;
    const spaces = game.board.getAvailableSpacesForGreenery(marsBot.player);
    expect(spaces.length).to.be.greaterThan(0);
    const space = spaces[0];

    game.addGreenery(marsBot.player, space, false);

    expect(space.player).to.eq(undefined);
  });

  it('MarsBot resource getters report mcSupply', () => {
    const {marsBot} = createAutomaGame();
    marsBot.turnResolver.mcSupply = 42;

    expect(marsBot.player.steel).to.eq(42);
    expect(marsBot.player.megaCredits).to.eq(42);
    expect(marsBot.player.plants).to.eq(42);
  });

  it('steal from MarsBot deducts mcSupply', () => {
    const {marsBot, human} = createAutomaGame();
    marsBot.turnResolver.mcSupply = 10;
    const humanSteelBefore = human.steel;

    marsBot.player.stock.steal(Resource.STEEL, 2, human);

    expect(marsBot.turnResolver.mcSupply).to.eq(8);
    expect(human.steel).to.eq(humanSteelBefore + 2);
  });

  it('Mayor milestone counts MarsBot cities', () => {
    const {game, marsBot} = createAutomaGame();
    const mayor = new Mayor();

    // Place 3 cities for MarsBot
    for (let i = 0; i < 3; i++) {
      const spaces = game.board.getAvailableSpacesOnLand(marsBot.player);
      expect(spaces.length).to.be.greaterThan(0);
      game.addCity(marsBot.player, spaces[0]);
    }

    expect(marsBot.turnResolver.marsBotMeetsMilestone(mayor)).to.be.true;
  });

  it('Gardener milestone counts MarsBot greeneries', () => {
    const {game, marsBot} = createAutomaGame();
    const gardener = new Gardener();

    // Place 3 greeneries for MarsBot
    for (let i = 0; i < 3; i++) {
      const spaces = game.board.getAvailableSpacesForGreenery(marsBot.player);
      expect(spaces.length).to.be.greaterThan(0);
      game.addGreenery(marsBot.player, spaces[0], false);
    }

    expect(marsBot.turnResolver.marsBotMeetsMilestone(gardener)).to.be.true;
  });

  it('Landlord award counts MarsBot tiles', () => {
    const {game, marsBot} = createAutomaGame();
    const landlord = new Landlord();

    // Place some tiles for MarsBot
    const spaces = game.board.getAvailableSpacesOnLand(marsBot.player);
    expect(spaces.length).to.be.greaterThan(0);
    game.addCity(marsBot.player, spaces[0]);

    expect(marsBot.turnResolver.getMarsBotAwardValue(landlord)).to.be.greaterThan(0);
  });

  it('getMcPerVP returns correct values', () => {
    // Base game: max gen = 20, table entries are {maxGeneration: 20 - mcPerVP, mcPerVP}
    // Entries: (12,8), (13,7), (14,6), (15,5), (16,4), (17,3), (18,2), (19,1)
    // getMcPerVP finds first entry where generation <= maxGeneration

    // Generation 12: before conversion window closes → first entry (12, 8) matches
    expect(getMcPerVP(12, false, false)).to.eq(8);

    // Generation 5: still within window (5 <= 12) → returns 8
    expect(getMcPerVP(5, false, false)).to.eq(8);

    // Generation 19: last entry (19, 1) matches → returns 1
    expect(getMcPerVP(19, false, false)).to.eq(1);

    // Generation 20: past all entries (20 > 19) → returns undefined
    expect(getMcPerVP(20, false, false)).to.eq(undefined);
  });

  it('vpByGeneration populated', () => {
    const {game, marsBot} = createAutomaGame();
    expect(marsBot.vpByGeneration.length).to.eq(0);

    game.automaHooks!.updateVPForGeneration();

    expect(marsBot.vpByGeneration.length).to.eq(1);
  });

  it('toModel includes currentVP during game', () => {
    const {marsBot} = createAutomaGame();

    const model = marsBot.toModel();

    expect(model.currentVP).to.be.a('number');
  });

  it('toModel includes globalParameterSteps', () => {
    const {game, marsBot} = createAutomaGame();

    game.increaseTemperature(marsBot.player, 1);
    const model = marsBot.toModel();

    expect(model.globalParameterSteps).to.not.be.undefined;
    expect(model.globalParameterSteps![GlobalParameter.TEMPERATURE]).to.be.greaterThan(0);
  });

  it('serialization roundtrip for vpByGeneration', () => {
    const {game, marsBot} = createAutomaGame();
    marsBot.vpByGeneration = [20, 25, 30];

    const serialized = game.serialize();
    const restored = Game.deserialize(serialized);

    expect(restored.marsBot).to.not.be.undefined;
    expect(restored.marsBot!.vpByGeneration).to.deep.eq([20, 25, 30]);
  });

  it('human is limited to 2 actions before MarsBot gets a turn', () => {
    const {game, human, marsBot} = createAutomaGame();
    // MarsBot should not have passed yet (has cards in action deck)
    expect(game.hasPassedThisActionPhase(marsBot.player)).to.be.false;
    // allOtherPlayersHavePassed should return false for human (MarsBot hasn't passed)
    expect(game.automaHooks!.allOtherPlayersHavePassed()).to.be.false;
  });

  it('allOtherPlayersHavePassed returns true when MarsBot has passed', () => {
    const {game, marsBot} = createAutomaGame();
    // Drain MarsBot's action deck
    marsBot.actionDeck = [];
    marsBot.takeTurn(); // This should mark MarsBot as passed
    expect(game.hasPassedThisActionPhase(marsBot.player)).to.be.true;
    expect(game.automaHooks!.allOtherPlayersHavePassed()).to.be.true;
  });
});
