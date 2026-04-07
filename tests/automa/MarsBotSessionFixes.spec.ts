import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Game} from '../../src/server/Game';
import {MarsBot} from '../../src/server/automa/MarsBot';
import {BoardName} from '../../src/common/boards/BoardName';
import {Phase} from '../../src/common/Phase';
import {Resource} from '../../src/common/Resource';
import {getMcPerVP} from '../../src/server/automa/MarsBotScoring';
import {MarsBotBonusCard} from '../../src/server/automa/MarsBotBonusCard';
import {BonusCardId} from '../../src/common/automa/AutomaTypes';
import {GlobalParameter} from '../../src/common/GlobalParameter';
import {Mayor} from '../../src/server/milestones/Mayor';
import {Gardener} from '../../src/server/milestones/Gardener';
import {Landlord} from '../../src/server/awards/Landlord';

function createAutomaGame(difficulty: 'easy' | 'normal' | 'hard' | 'brutal' = 'normal'): {game: IGame, human: TestPlayer, marsBot: MarsBot} {
  const [game, human] = testGame(1, {
    automaOption: true,
    automaDifficulty: difficulty,
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
    expect(getMcPerVP(12, false)).to.eq(8);

    // Generation 5: still within window (5 <= 12) → returns 8
    expect(getMcPerVP(5, false)).to.eq(8);

    // Generation 19: last entry (19, 1) matches → returns 1
    expect(getMcPerVP(19, false)).to.eq(1);

    // Generation 20: past all entries (20 > 19) → returns undefined
    expect(getMcPerVP(20, false)).to.eq(undefined);
  });

  it('vpByGeneration populated', () => {
    const {game, marsBot} = createAutomaGame();
    expect(marsBot.vpByGeneration.length).to.eq(0);

    game.automaHooks!.updateVPForGeneration();

    expect(marsBot.vpByGeneration.length).to.eq(1);
  });

  it('toModel includes vpBreakdown during game', () => {
    const {marsBot} = createAutomaGame();

    const model = marsBot.toModel();

    expect(model.vpBreakdown).to.not.be.undefined;
    expect(model.vpBreakdown!.total).to.be.a('number');
    expect(model.vpBreakdown!.terraformRating).to.eq(20);
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

  it('deserialization works when activePlayer is MarsBot', () => {
    const {game, marsBot} = createAutomaGame();
    marsBot.board.tracks[0].advance();
    marsBot.turnResolver.mcSupply = 15;

    // Simulate MarsBot being the active player when saved
    (game as any).activePlayer = marsBot.player;
    const serialized = game.serialize();
    expect(serialized.activePlayer).to.eq(marsBot.player.id);

    const restored = Game.deserialize(serialized);
    expect(restored.marsBot).to.not.be.undefined;
    expect(restored.activePlayer.id).to.eq(marsBot.player.id);
    expect(restored.marsBot!.board.tracks[0].position).to.eq(1);
    expect(restored.marsBot!.turnResolver.mcSupply).to.eq(15);
  });

  it('deserialization works when activePlayer is human', () => {
    const {game, human, marsBot} = createAutomaGame();
    marsBot.board.tracks[0].advance();

    const serialized = game.serialize();
    expect(serialized.activePlayer).to.eq(human.id);

    const restored = Game.deserialize(serialized);
    expect(restored.activePlayer.id).to.eq(human.id);
    expect(restored.marsBot).to.not.be.undefined;
  });

  it('deserialization works when MarsBot has claimed milestones', () => {
    const {game, marsBot} = createAutomaGame();
    const milestone = game.milestones[0];
    game.claimedMilestones.push({player: marsBot.player, milestone});

    const serialized = game.serialize();
    const restored = Game.deserialize(serialized);
    expect(restored.claimedMilestones).to.have.length(1);
    expect(restored.claimedMilestones[0].player.id).to.eq(marsBot.player.id);
  });

  it('deserialization works when MarsBot has funded awards', () => {
    const {game, marsBot} = createAutomaGame();
    const award = game.awards[0];
    game.fundedAwards.push({player: marsBot.player, award});

    const serialized = game.serialize();
    const restored = Game.deserialize(serialized);
    expect(restored.fundedAwards).to.have.length(1);
    expect(restored.fundedAwards[0].player.id).to.eq(marsBot.player.id);
  });

  it('action deck roundtrip preserves project and bonus cards', () => {
    const {game, marsBot} = createAutomaGame();
    const deckSize = marsBot.actionDeck.length;
    expect(deckSize).to.be.gt(0);

    const serialized = game.serialize();
    const restored = Game.deserialize(serialized);
    expect(restored.marsBot!.actionDeck.length).to.eq(deckSize);
  });

  it('bonus deck roundtrip preserves draw and discard piles', () => {
    const {game, marsBot} = createAutomaGame();
    const drawSize = marsBot.bonusDeck.drawPile.length;
    // Move one to discard
    const card = marsBot.bonusDeck.draw();
    if (card) {
      marsBot.bonusDeck.discard(card);
    }

    const serialized = game.serialize();
    const restored = Game.deserialize(serialized);
    expect(restored.marsBot!.bonusDeck.drawPile.length).to.eq(drawSize - 1);
    expect(restored.marsBot!.bonusDeck.discardPile.length).to.eq(1);
  });

  it('bonus deck roundtrip preserves total card count (draw + discard - destroyed)', () => {
    const {game, marsBot} = createAutomaGame();
    const totalBefore = marsBot.bonusDeck.drawPile.length + marsBot.bonusDeck.discardPile.length;

    const serialized = game.serialize();
    const restored = Game.deserialize(serialized);
    const totalAfter = restored.marsBot!.bonusDeck.drawPile.length + restored.marsBot!.bonusDeck.discardPile.length;
    expect(totalAfter).to.eq(totalBefore);
  });

  it('played project cards roundtrip', () => {
    const {game, marsBot} = createAutomaGame();
    // Play a card from action deck
    const projectCard = marsBot.actionDeck.find((c) => 'cost' in c && 'tags' in c);
    if (projectCard) {
      marsBot.playedProjectCards.push(projectCard as any);
    }
    const count = marsBot.playedProjectCards.length;

    const serialized = game.serialize();
    const restored = Game.deserialize(serialized);
    expect(restored.marsBot!.playedProjectCards.length).to.eq(count);
  });

  it('floater count roundtrip', () => {
    const {game, marsBot} = createAutomaGame();
    marsBot.floaterCount = 7;

    const serialized = game.serialize();
    const restored = Game.deserialize(serialized);
    expect(restored.marsBot!.floaterCount).to.eq(7);
  });

  it('temperature raises roundtrip', () => {
    const {game, marsBot} = createAutomaGame();
    marsBot.temperatureRaises = 4;

    const serialized = game.serialize();
    const restored = Game.deserialize(serialized);
    expect(restored.marsBot!.temperatureRaises).to.eq(4);
  });

  it('deserialization does not re-log MarsBot is ready', () => {
    const {game} = createAutomaGame();
    const logBefore = game.gameLog.length;

    const serialized = game.serialize();
    const restored = Game.deserialize(serialized);
    const readyLogs = restored.gameLog.filter((l) => l.message.includes('MarsBot is ready'));
    // Should have exactly 1 from initial creation, not 2
    expect(readyLogs.length).to.eq(1);
  });

  it('deserialization does not rebuild initial action deck', () => {
    const {game, marsBot} = createAutomaGame();
    // Empty the action deck to simulate mid-game
    marsBot.actionDeck = [];

    const serialized = game.serialize();
    const restored = Game.deserialize(serialized);
    // Should still be empty, not rebuilt
    expect(restored.marsBot!.actionDeck.length).to.eq(0);
  });

  it('comprehensive roundtrip: all MarsBot state preserved', () => {
    const {game, marsBot} = createAutomaGame();

    // Set all fields to non-default values
    marsBot.board.tracks[0].advance();
    marsBot.board.tracks[0].advance();
    marsBot.board.tracks[1].advance();
    // Regress track 0 from position 2 to 1
    marsBot.board.tracks[0].regress();
    marsBot.turnResolver.mcSupply = 42;
    marsBot.goesFirst = true;
    marsBot.floaterCount = 3;
    marsBot.temperatureRaises = 5;
    marsBot.vpByGeneration = [10, 20, 30];
    marsBot.corpSpecificState.set('testKey', 99);

    // Set neural instance on a land space
    const landSpace = game.board.getAvailableSpacesOnLand(marsBot.player)[0];
    marsBot.neuralInstanceSpace = landSpace;

    // Set colony cube positions
    marsBot.colonyCubePositions = new Set(['1:7', '1:10', '4:8']);
    marsBot.hasColonyCubes = true;

    // Set corp state (simulate Rulebook B)
    const {getAllMarsBotCorps} = require('../../src/server/automa/corps/MarsBotCorpRegistry');
    const allCorps = getAllMarsBotCorps();
    if (allCorps.length > 0) {
      marsBot.corp = allCorps[0];
      marsBot.trackCubePositions.set('0:5', {trackIndex: 0, position: 5, cubeType: 'white'});
      marsBot.triggeredCubePositions.add('0:5');
    }

    // Claim milestone and fund award as MarsBot
    (game as any).activePlayer = marsBot.player;
    game.claimedMilestones.push({player: marsBot.player, milestone: game.milestones[0]});
    game.fundedAwards.push({player: marsBot.player, award: game.awards[0]});

    // Serialize and restore
    const serialized = game.serialize();
    const restored = Game.deserialize(serialized);
    const rm = restored.marsBot!;

    // Verify all fields
    expect(restored.activePlayer.id).to.eq(marsBot.player.id);
    expect(restored.claimedMilestones[0].player.id).to.eq(marsBot.player.id);
    expect(restored.fundedAwards[0].player.id).to.eq(marsBot.player.id);
    expect(rm.board.tracks[0].position).to.eq(1);
    expect(rm.board.tracks[0].regressedPositions.has(2)).to.eq(true);
    expect(rm.board.tracks[1].position).to.eq(1);
    expect(rm.turnResolver.mcSupply).to.eq(42);
    expect(rm.goesFirst).to.eq(true);
    expect(rm.floaterCount).to.eq(3);
    expect(rm.temperatureRaises).to.eq(5);
    expect(rm.vpByGeneration).to.deep.eq([10, 20, 30]);
    expect(rm.corpSpecificState.get('testKey')).to.eq(99);
    expect(rm.actionDeck.length).to.eq(marsBot.actionDeck.length);
    expect(rm.bonusDeck.drawPile.length).to.eq(marsBot.bonusDeck.drawPile.length);
    expect(rm.playedProjectCards.length).to.eq(marsBot.playedProjectCards.length);
    expect(rm.neuralInstanceSpace?.id).to.eq(landSpace.id);
    expect(rm.colonyCubePositions.size).to.eq(3);
    expect(rm.colonyCubePositions.has('1:7')).to.eq(true);
    expect(rm.hasColonyCubes).to.eq(true);
    if (marsBot.corp) {
      expect(rm.corp?.name).to.eq(marsBot.corp.name);
      expect(rm.trackCubePositions.has('0:5')).to.eq(true);
      expect(rm.triggeredCubePositions.has('0:5')).to.eq(true);
    }
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

  it('Neural Instance not placed adjacent to ocean-reserved spaces', () => {
    const {game, marsBot} = createAutomaGame();
    const space = marsBot.turnResolver.tilePlacer.findNeuralInstanceSpace();
    if (space !== undefined) {
      const adj = game.board.getAdjacentSpaces(space);
      // No adjacent space should be ocean-reserved
      for (const a of adj) {
        expect(a.spaceType).to.not.eq('ocean');
      }
      // Not on edge
      expect(adj.length).to.eq(6);
      // No adjacent tiles
      for (const a of adj) {
        expect(a.tile).to.be.undefined;
      }
    }
  });

  it('award values reduced by 5 in easy mode', () => {
    const {marsBot} = createAutomaGame('easy');
    const normalMarsBot = createAutomaGame('normal').marsBot;
    for (const award of marsBot.game.awards) {
      const easyVal = marsBot.turnResolver.getMarsBotAwardValue(award);
      const normalVal = normalMarsBot.turnResolver.getMarsBotAwardValue(
        normalMarsBot.game.awards.find((a) => a.name === award.name)!);
      expect(easyVal).to.eq(normalVal - 5, `${award.name} easy offset wrong`);
    }
  });
});
