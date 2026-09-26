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
});
