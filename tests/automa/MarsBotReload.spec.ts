import {expect} from 'chai';
import {testGame} from '../TestGame';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {MarsBot} from '../../src/server/automa/MarsBot';
import {BoardName} from '../../src/common/boards/BoardName';
import {GlobalParameter} from '../../src/common/GlobalParameter';

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
});
