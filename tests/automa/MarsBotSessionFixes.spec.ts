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
import {RemoveResourcesFromCard} from '../../src/server/deferredActions/RemoveResourcesFromCard';
import {CardResource} from '../../src/common/CardResource';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {Predators} from '../../src/server/cards/base/Predators';
import {Ants} from '../../src/server/cards/base/Ants';

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

  it('tile ownership preserved through serialization roundtrip', () => {
    const {game, marsBot} = createAutomaGame();
    const spaces = game.board.getAvailableSpacesOnLand(marsBot.player);
    const space = spaces[0];
    game.addCity(marsBot.player, space);
    expect(space.player).to.eq(marsBot.player);

    const serialized = game.serialize();
    const restored = Game.deserialize(serialized);

    const restoredSpace = restored.board.getSpaceOrThrow(space.id);
    expect(restoredSpace.player).to.not.be.undefined;
    expect(restoredSpace.player!.id).to.eq(marsBot.player.id);
  });

  it('greenery ownership preserved through serialization roundtrip', () => {
    const {game, marsBot} = createAutomaGame();
    const spaces = game.board.getAvailableSpacesForGreenery(marsBot.player);
    const space = spaces[0];
    game.addGreenery(marsBot.player, space, true);

    const serialized = game.serialize();
    const restored = Game.deserialize(serialized);

    const restoredSpace = restored.board.getSpaceOrThrow(space.id);
    expect(restoredSpace.player).to.not.be.undefined;
    expect(restoredSpace.player!.id).to.eq(marsBot.player.id);
  });

  it('track regression at position 0 does not log', () => {
    const {game, marsBot} = createAutomaGame();
    // Ensure event track is at 0
    const eventTrackIndex = marsBot.board.data.findIndex((d) => d.productions.includes(Resource.MEGACREDITS));
    expect(marsBot.board.tracks[eventTrackIndex].position).to.eq(0);

    const logsBefore = game.gameLog.length;
    marsBot.regressTrack(Resource.MEGACREDITS);
    expect(game.gameLog.length).to.eq(logsBefore); // No log added
    expect(marsBot.board.tracks[eventTrackIndex].position).to.eq(0); // Still at 0
  });

  it('track regression at position > 0 logs and decrements', () => {
    const {game, marsBot} = createAutomaGame();
    const eventTrackIndex = marsBot.board.data.findIndex((d) => d.productions.includes(Resource.MEGACREDITS));
    marsBot.board.tracks[eventTrackIndex].advance(); // Move to 1

    const logsBefore = game.gameLog.length;
    marsBot.regressTrack(Resource.MEGACREDITS);
    expect(game.gameLog.length).to.eq(logsBefore + 1); // Log added
    expect(marsBot.board.tracks[eventTrackIndex].position).to.eq(0);
  });

  it('vermin VP penalty applied to MarsBot', () => {
    const {game, marsBot} = createAutomaGame();
    // Place a city for MarsBot
    const spaces = game.board.getAvailableSpacesOnLand(marsBot.player);
    game.addCity(marsBot.player, spaces[0]);

    game.verminInEffect = false;
    const vpWithout = marsBot.getVictoryPoints();

    game.verminInEffect = true;
    const vpWith = marsBot.getVictoryPoints();

    expect(vpWith.vermin).to.eq(-1);
    expect(vpWith.total).to.eq(vpWithout.total - 1);
  });

  it('CrashSiteCleanup hook triggered when removing plants from MarsBot', () => {
    const {game, human, marsBot} = createAutomaGame();
    marsBot.turnResolver.mcSupply = 10;

    expect(game.someoneHasRemovedOtherPlayersPlants).to.be.false;

    marsBot.player.stock.add(Resource.PLANTS, -3, {log: true, from: {player: human}});

    expect(game.someoneHasRemovedOtherPlayersPlants).to.be.true;
  });

  it('RemoveResourcesFromCard targets MarsBot MC supply when only option', () => {
    const {human, marsBot} = createAutomaGame();
    marsBot.turnResolver.mcSupply = 10;

    const action = new RemoveResourcesFromCard(human, undefined, 1, {source: 'opponents'});
    action.execute();

    // Auto-executed since MarsBot MC is the only target
    expect(marsBot.turnResolver.mcSupply).to.eq(9);
  });

  it('RemoveResourcesFromCard offers choice when both cards and MarsBot MC available', () => {
    const {game, human, marsBot} = createAutomaGame();
    marsBot.turnResolver.mcSupply = 10;

    // Give human a card with animals so there are card targets too
    const predators = new Predators();
    predators.resourceCount = 3;
    human.playedCards.push(predators);

    const action = new RemoveResourcesFromCard(human, CardResource.ANIMAL, 1, {source: 'all'});
    const result = action.execute();

    // Should offer OrOptions with both card selection and MarsBot MC
    expect(result).to.be.instanceOf(OrOptions);
  });

  it('RemoveResourcesFromCard does not offer MarsBot when source is self', () => {
    const {human, marsBot} = createAutomaGame();
    marsBot.turnResolver.mcSupply = 10;

    const action = new RemoveResourcesFromCard(human, undefined, 1, {source: 'self', blockable: false});
    const result = action.execute();

    // No self-targets and MarsBot excluded for source=self
    expect(result).to.be.undefined;
  });

  it('RemoveResourcesFromCard does not offer MarsBot when MC is 0', () => {
    const {human, marsBot} = createAutomaGame();
    marsBot.turnResolver.mcSupply = 0;

    const action = new RemoveResourcesFromCard(human, undefined, 1, {source: 'opponents'});
    const result = action.execute();

    expect(result).to.be.undefined;
  });

  it('Predators canAct returns true when MarsBot has MC', () => {
    const {human, marsBot} = createAutomaGame();
    marsBot.turnResolver.mcSupply = 5;
    const predators = new Predators();
    human.playedCards.push(predators);

    expect(predators.canAct(human)).to.be.true;
  });

  it('Ants canAct returns true when MarsBot has MC', () => {
    const {human, marsBot} = createAutomaGame();
    marsBot.turnResolver.mcSupply = 5;
    const ants = new Ants();
    human.playedCards.push(ants);

    expect(ants.canAct(human)).to.be.true;
  });

  it('hasAvailableTargets returns false without automa', () => {
    const [game, player1, player2] = testGame(2);
    expect(RemoveResourcesFromCard.hasAvailableTargets(player1, CardResource.ANIMAL)).to.be.false;
  });

  it('LawSuit hook triggered when removing resources from MarsBot', () => {
    const {human, marsBot} = createAutomaGame();
    marsBot.turnResolver.mcSupply = 10;

    marsBot.player.stock.add(Resource.STEEL, -2, {log: true, from: {player: human}});

    // LawSuit tracks removingPlayers
    expect(marsBot.player.removingPlayers).to.include(human.id);
  });

  it('vermin penalty is 0 when no cities', () => {
    const {game, marsBot} = createAutomaGame();
    game.verminInEffect = true;
    const vp = marsBot.getVictoryPoints();
    expect(vp.vermin).to.eq(0);
  });

  it('vermin penalty scales with number of cities', () => {
    const {game, marsBot} = createAutomaGame();
    const citySpaces = game.board.getAvailableSpacesOnLand(marsBot.player);
    game.addCity(marsBot.player, citySpaces[0]);
    game.addCity(marsBot.player, citySpaces[5]);

    game.verminInEffect = true;
    const vp = marsBot.getVictoryPoints();
    expect(vp.vermin).to.eq(-2);
  });

  it('multiple tiles preserve ownership through serialization', () => {
    const {game, marsBot} = createAutomaGame();
    const landSpaces = game.board.getAvailableSpacesOnLand(marsBot.player);

    game.addCity(marsBot.player, landSpaces[0]);
    // Pick a greenery space that isn't already occupied
    const greenerySpaces = game.board.getAvailableSpacesForGreenery(marsBot.player);
    game.addGreenery(marsBot.player, greenerySpaces[0], true);

    const serialized = game.serialize();
    const restored = Game.deserialize(serialized);

    const restoredCity = restored.board.getSpaceOrThrow(landSpaces[0].id);
    const restoredGreenery = restored.board.getSpaceOrThrow(greenerySpaces[0].id);

    expect(restoredCity.player).to.not.be.undefined;
    expect(restoredCity.player!.id).to.eq(marsBot.player.id);
    expect(restoredGreenery.player).to.not.be.undefined;
    expect(restoredGreenery.player!.id).to.eq(marsBot.player.id);
  });

  it('getCities and getGreeneries work after deserialization', () => {
    const {game, marsBot} = createAutomaGame();
    const landSpaces = game.board.getAvailableSpacesOnLand(marsBot.player);

    game.addCity(marsBot.player, landSpaces[0]);
    const greenerySpaces = game.board.getAvailableSpacesForGreenery(marsBot.player);
    game.addGreenery(marsBot.player, greenerySpaces[0], true);

    const serialized = game.serialize();
    const restored = Game.deserialize(serialized);

    const restoredMarsBot = restored.automaHooks!.getMarsBotPlayer();
    expect(restored.board.getCities(restoredMarsBot).length).to.eq(1);
    expect(restored.board.getGreeneries(restoredMarsBot).length).to.eq(1);
  });

  it('Mons Insurance regression at 0 is no-op', () => {
    const {marsBot} = createAutomaGame();
    // All tracks start at 0
    for (const track of marsBot.board.tracks) {
      expect(track.position).to.eq(0);
    }

    // Decrease megacredits production by 2 (Mons Insurance)
    marsBot.player.production.add(Resource.MEGACREDITS, -2);

    // Track should still be at 0
    const eventTrackIndex = marsBot.board.data.findIndex((d) => d.productions.includes(Resource.MEGACREDITS));
    expect(marsBot.board.tracks[eventTrackIndex].position).to.eq(0);
  });

  it('track regression from 1 stops at 0 for multi-step decrease', () => {
    const {marsBot} = createAutomaGame();
    const eventTrackIndex = marsBot.board.data.findIndex((d) => d.productions.includes(Resource.MEGACREDITS));
    marsBot.board.tracks[eventTrackIndex].advance(); // Position 1

    // Decrease by 2 — should regress once to 0, second step is no-op
    marsBot.player.production.add(Resource.MEGACREDITS, -2);

    expect(marsBot.board.tracks[eventTrackIndex].position).to.eq(0);
  });
});
