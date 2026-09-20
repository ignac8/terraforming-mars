import {expect} from 'chai';
import {testGame} from '../TestGame';
import {maxOutOceans} from '../TestingUtils';
import {IGame} from '../../src/server/IGame';
import {MarsBot} from '../../src/server/automa/MarsBot';
import {BoardName} from '../../src/common/boards/BoardName';
import {MARSBOT_MAX_GENERATION} from '../../src/common/automa/AutomaTypes';
import {MAX_OXYGEN_LEVEL, MAX_TEMPERATURE} from '../../src/common/constants';

function createAutomaGame(automaNoGenerationLimit: boolean): {game: IGame, marsBot: MarsBot} {
  const [game] = testGame(1, {automaOption: true, automaNoGenerationLimit, boardName: BoardName.THARSIS});
  return {game, marsBot: game.automaHooks!.marsBot};
}

describe('MarsBot without a generation limit', () => {
  it('does not end the game at the last generation', () => {
    const {game} = createAutomaGame(true);
    (game as any).generation = MARSBOT_MAX_GENERATION;
    expect(game.gameIsOver()).is.false;
  });

  it('still ends the game once Mars is terraformed', () => {
    const {game, marsBot} = createAutomaGame(true);
    (game as any).generation = MARSBOT_MAX_GENERATION + 5;
    (game as any).temperature = MAX_TEMPERATURE;
    (game as any).oxygenLevel = MAX_OXYGEN_LEVEL;
    maxOutOceans(marsBot.player);
    expect(game.gameIsOver()).is.true;
  });

  it('never lets MarsBot win on the generation count', () => {
    const {game, marsBot} = createAutomaGame(true);
    (game as any).generation = MARSBOT_MAX_GENERATION;
    expect(marsBot.isInstantWin()).is.false;
    expect(marsBot.toModel().instantWin).is.false;
  });

  it('converts megacredits at 1 per VP from the last table row onward', () => {
    const {game, marsBot} = createAutomaGame(true);
    marsBot.turnResolver.megacredits = 7;

    (game as any).generation = MARSBOT_MAX_GENERATION - 1;
    expect(marsBot.getVictoryPoints().mcToVP).to.eq(7);
    (game as any).generation = MARSBOT_MAX_GENERATION;
    expect(marsBot.getVictoryPoints().mcToVP).to.eq(7);
    (game as any).generation = MARSBOT_MAX_GENERATION + 4;
    expect(marsBot.getVictoryPoints().mcToVP).to.eq(7);
  });

  it('keeps the limit when the option is off', () => {
    const {game, marsBot} = createAutomaGame(false);
    (game as any).generation = MARSBOT_MAX_GENERATION;
    expect(game.gameIsOver()).is.true;
    expect(marsBot.isInstantWin()).is.true;
  });
});
