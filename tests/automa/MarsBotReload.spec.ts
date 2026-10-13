import {expect} from 'chai';
import {testGame} from '../TestGame';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {SerializedGame} from '../../src/server/SerializedGame';
import {MarsBot} from '../../src/server/automa/MarsBot';
import {BoardName} from '../../src/common/boards/BoardName';
import {GlobalParameter} from '../../src/common/GlobalParameter';
import {Phase} from '../../src/common/Phase';
import {createCorpBonusCard} from '../../src/server/automa/MarsBotBonusCard';
import {BonusCardId} from '../../src/common/automa/AutomaTypes';
import {CardName} from '../../src/common/cards/CardName';
import {Asteroid} from '../../src/server/cards/base/Asteroid';
import {Research} from '../../src/server/cards/base/Research';
import {Greenhouses} from '../../src/server/cards/base/Greenhouses';
import {Tag} from '../../src/common/cards/Tag';

function createAutomaGame(): {game: IGame, marsBot: MarsBot} {
  const [game] = testGame(1, {
    automaOption: true,
    automaDifficulty: 'easy',
    boardName: BoardName.THARSIS,
  });
  return {game, marsBot: game.automaHooks!.marsBot};
}

describe('MarsBotReload', () => {
  it('keeps the terraform rating across a reload', () => {
    const {game, marsBot} = createAutomaGame();
    marsBot.player.setTerraformRating(30);

    const restored = Game.deserialize(game.serialize());

    expect(restored.automaHooks!.marsBot.player.terraformRating).to.eq(30);
  });

  it('keeps the global parameter steps across a reload', () => {
    const {game, marsBot} = createAutomaGame();
    marsBot.player.globalParameterSteps[GlobalParameter.OXYGEN] = 3;
    marsBot.player.globalParameterSteps[GlobalParameter.VENUS] = 4;

    const restored = Game.deserialize(game.serialize());

    const steps = restored.automaHooks!.marsBot.player.globalParameterSteps;
    expect(steps[GlobalParameter.OXYGEN]).to.eq(3);
    expect(steps[GlobalParameter.VENUS]).to.eq(4);
    expect(steps[GlobalParameter.OCEANS]).to.eq(0);
  });

  it('keeps the Hard mode first-turn check generation across a reload', () => {
    const {game, marsBot} = createAutomaGame();
    game.generation = 4;
    marsBot.firstTurnCheckedGeneration = 3;

    const restored = Game.deserialize(game.serialize());

    expect(restored.automaHooks!.marsBot.firstTurnCheckedGeneration).to.eq(3);
  });

  it('keeps a before-action-phase box that still waits for the preludes across a reload', () => {
    const {game, marsBot} = createAutomaGame();
    marsBot.beforeActionPhasePending = true;

    const restored = Game.deserialize(game.serialize());

    expect(restored.automaHooks!.marsBot.beforeActionPhasePending).is.true;
  });

  it('has no before-action-phase box waiting in older saves', () => {
    const {game} = createAutomaGame();
    const serialized = game.serialize();
    delete serialized.automaState!.beforeActionPhasePending;

    const restored = Game.deserialize(serialized);

    expect(restored.automaHooks!.marsBot.beforeActionPhasePending).is.false;
  });

  it('treats the first-turn check as done for the current generation in older saves', () => {
    const {game} = createAutomaGame();
    game.generation = 4;
    const serialized = game.serialize();
    delete serialized.automaState!.firstTurnCheckedGeneration;

    const restored = Game.deserialize(serialized);

    expect(restored.automaHooks!.marsBot.firstTurnCheckedGeneration).to.eq(4);
  });

  it('reads older saves without those fields', () => {
    const {game, marsBot} = createAutomaGame();
    const serialized = game.serialize();
    delete serialized.automaState!.terraformRating;
    delete serialized.automaState!.globalParameterSteps;

    const restored = Game.deserialize(serialized);

    expect(restored.automaHooks!.marsBot.player.terraformRating).to.eq(marsBot.player.terraformRating);
  });

  it('records the bot as a global-parameter contributor when it raises parameters', () => {
    const {game, marsBot} = createAutomaGame();
    game.phase = Phase.ACTION;

    game.increaseTemperature(marsBot.player, 2);
    game.increaseOxygenLevel(marsBot.player, 1);
    game.increaseVenusScaleLevel(marsBot.player, 1);

    const steps = marsBot.player.globalParameterSteps;
    expect(steps[GlobalParameter.TEMPERATURE]).is.greaterThan(0);
    expect(steps[GlobalParameter.OXYGEN]).is.greaterThan(0);
    expect(steps[GlobalParameter.VENUS]).is.greaterThan(0);

    // The end-of-game contribution table reads these off the reloaded model.
    const restored = Game.deserialize(game.serialize());
    const restoredSteps = restored.automaHooks!.marsBot.player.globalParameterSteps;
    expect(restoredSteps[GlobalParameter.TEMPERATURE]).eq(steps[GlobalParameter.TEMPERATURE]);
    expect(restoredSteps[GlobalParameter.OXYGEN]).eq(steps[GlobalParameter.OXYGEN]);
    expect(restoredSteps[GlobalParameter.VENUS]).eq(steps[GlobalParameter.VENUS]);
  });

  it('keeps MarsBot\'s player markers across a reload', () => {
    const {game, marsBot} = createAutomaGame();
    marsBot['bonusResolver'].resolve(createCorpBonusCard(BonusCardId.B22_SETTLERS));
    const [id] = marsBot.markerSpaceIds;

    const restored = Game.deserialize(game.serialize());

    const restoredBot = restored.automaHooks!.marsBot;
    expect(restoredBot.markerSpaceIds).to.deep.eq([id]);
    expect(restored.board.getSpaceOrThrow(id).player).to.eq(restoredBot.player);
  });

  it('saves MarsBot\'s corporation before the player\'s first action', () => {
    const [game, human] = testGame(1, {
      automaOption: true,
      automaCorpOption: true,
      automaDifficulty: 'easy',
      boardName: BoardName.THARSIS,
      skipInitialCardSelection: false,
    });
    const saves: Array<SerializedGame> = [];
    game.save = () => {
      saves.push(game.serialize());
    };

    human.process({type: 'initialCards', responses: [
      {type: 'card', cards: [human.dealtCorporationCards[0].name]},
      {type: 'card', cards: []},
    ]});

    const corp = game.automaHooks!.marsBot.corp;
    expect(corp).is.not.undefined;
    // A server restart before the player's next action reloads the latest save.
    const restored = Game.deserialize(saves[saves.length - 1]);
    expect(restored.automaHooks!.marsBot.corp).to.eq(corp);
  });

  it('keeps the cards MarsBot resolved out of the project discard pile across a reload', () => {
    const {game, marsBot} = createAutomaGame();
    const asteroid = new Asteroid();
    marsBot.turnResolver.resolveProjectCard(asteroid);

    const restored = Game.deserialize(game.serialize());

    const restoredBot = restored.automaHooks!.marsBot;
    expect(restoredBot.playedProjectCards.map((c) => c.name)).deep.eq([CardName.ASTEROID]);
    expect(restored.projectDeck.discardPile.map((c) => c.name)).does.not.include(CardName.ASTEROID);
  });

  it('removes cards MarsBot played from the project discard pile in older saves', () => {
    const {game, marsBot} = createAutomaGame();
    const asteroid = new Asteroid();
    marsBot.turnResolver.resolveProjectCard(asteroid);
    // Older saves also left the resolved card in the project discard pile
    game.projectDeck.discardPile.push(asteroid);

    const restored = Game.deserialize(game.serialize());

    expect(restored.automaHooks!.marsBot.playedProjectCards.map((c) => c.name)).deep.eq([CardName.ASTEROID]);
    expect(restored.projectDeck.discardPile.map((c) => c.name)).does.not.include(CardName.ASTEROID);
  });

  it('removes every card MarsBot played from the project piles in older saves', () => {
    const {game, marsBot} = createAutomaGame();
    const cards = [new Asteroid(), new Research()];
    cards.forEach((card) => marsBot.turnResolver.resolveProjectCard(card));
    game.projectDeck.discardPile.push(new Asteroid(), new Research());

    const restored = Game.deserialize(game.serialize());

    const piles = [...restored.projectDeck.discardPile, ...restored.projectDeck.drawPile].map((c) => c.name);
    expect(piles).does.not.include(CardName.ASTEROID);
    expect(piles).does.not.include(CardName.RESEARCH);
  });

  it('removes cards MarsBot played from the project draw pile in older saves', () => {
    const {game, marsBot} = createAutomaGame();
    const asteroid = new Asteroid();
    marsBot.turnResolver.resolveProjectCard(asteroid);
    // An older save may have reshuffled the resolved card into the draw pile
    game.projectDeck.drawPile.push(new Asteroid());

    const restored = Game.deserialize(game.serialize());

    expect(restored.automaHooks!.marsBot.playedProjectCards.map((c) => c.name)).deep.eq([CardName.ASTEROID]);
    expect(restored.projectDeck.drawPile.map((c) => c.name)).does.not.include(CardName.ASTEROID);
  });

  it('records the whole card when a corporation resolves only its first tag, and keeps it across a reload', () => {
    const {game, marsBot} = createAutomaGame();
    const card = new Greenhouses();
    const tags = [...card.tags];
    expect(tags).deep.eq([Tag.PLANT, Tag.BUILDING]);
    game.projectDeck.drawPile.push(card);
    const plant = marsBot.marsBotBoard.tagToTrack[Tag.PLANT]!;
    const building = marsBot.marsBotBoard.tagToTrack[Tag.BUILDING]!;

    marsBot.maybeDrawAndResolveProjectCardFirstTagOnly();

    // Thorgate (C11): "ignoring all except its first tag", so only the Plant tag moves a track
    expect(marsBot.marsBotBoard.tracks[plant].position).to.eq(1);
    expect(marsBot.marsBotBoard.tracks[building].position).to.eq(0);

    expect(marsBot.playedProjectCards).deep.eq([card]);
    expect(marsBot.playedProjectCards[0].tags).deep.eq(tags);
    const restored = Game.deserialize(game.serialize());
    expect(restored.automaHooks!.marsBot.playedProjectCards[0].tags).deep.eq(tags);
  });
});
