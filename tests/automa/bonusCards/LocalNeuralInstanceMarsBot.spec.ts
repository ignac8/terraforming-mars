import {expect} from 'chai';
import {TileType} from '@/common/TileType';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {SpaceType} from '@/common/boards/SpaceType';
import {createBaseBonusCards} from '@/server/automa/MarsBotBonusCard';
import {createAutomaGame} from '../corps/CorpGame';

function neuralInstance() {
  return createBaseBonusCards().find((c) => c.id === BonusCardId.B07_LOCAL_NEURAL_INSTANCE)!;
}

describe('LocalNeuralInstanceMarsBot', () => {
  it('is removed once its tile is placed', () => {
    const {marsBot} = createAutomaGame();

    const destroyed = marsBot['bonusResolver'].resolve(neuralInstance());

    expect(marsBot.neuralInstanceSpace?.tile?.tileType).to.eq(TileType.NEURAL_INSTANCE);
    expect(destroyed).to.be.true;
    expect(marsBot.bonusDeck.discardPile.map((c) => c.id)).does.not.include(BonusCardId.B07_LOCAL_NEURAL_INSTANCE);
  });

  it('goes to the bonus discard pile when its tile cannot be placed', () => {
    const {marsBot} = createAutomaGame();
    marsBot.turnResolver.tilePlacer.findNeuralInstanceSpace = () => undefined;
    const played = marsBot.playedProjectCards.length;

    const destroyed = marsBot['bonusResolver'].resolve(neuralInstance());

    expect(marsBot.neuralInstanceSpace).to.be.undefined;
    expect(marsBot.playedProjectCards).has.length(played + 1); // The project card it resolved instead
    expect(destroyed).to.be.false;
    expect(marsBot.bonusDeck.discardPile.map((c) => c.id)).to.include(BonusCardId.B07_LOCAL_NEURAL_INSTANCE);
  });

  it('records the project card in its fallback', () => {
    const {marsBot} = createAutomaGame();
    marsBot['tilePlacer'].findNeuralInstanceSpace = () => undefined;
    const b07 = createBaseBonusCards().find((c) => c.id === BonusCardId.B07_LOCAL_NEURAL_INSTANCE)!;

    marsBot['bonusResolver'].resolve(b07);

    expect(marsBot.playedProjectCards).to.have.length(1);
  });

  it('gains 1 MC per covered icon', () => {
    const {game, marsBot} = createAutomaGame();
    const space = game.board.spaces.find((s) => s.bonus.length >= 2 && s.spaceType === SpaceType.LAND)!;
    marsBot['tilePlacer'].findNeuralInstanceSpace = () => space;
    const b07 = createBaseBonusCards().find((c) => c.id === BonusCardId.B07_LOCAL_NEURAL_INSTANCE)!;

    marsBot['bonusResolver'].resolve(b07);

    const expected = marsBot['tilePlacer'].getTotalPlacementMC(space);
    expect(expected).to.be.gte(2);
    expect(marsBot.turnResolver.megacredits).to.eq(expected);
  });
});
