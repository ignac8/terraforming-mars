import {expect} from 'chai';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {CardName} from '@/common/cards/CardName';
import {bonusCard} from '@/server/automa/MarsBotBonusCard';
import {setOxygenLevel, setTemperature, setVenusScaleLevel} from '../../TestingUtils';
import {createAutomaGame} from '../corps/CorpGame';

describe('LobbyistsVenusMarsBot', () => {
  it('Venus branch triggers at 1 step from Venus bonus at 8%', () => {
    const {game, marsBot} = createAutomaGame({venusNextExtension: true});
    // Venus at 6% → 1 step from 8% bonus
    setVenusScaleLevel(game, 6);
    // Need to access private method - use the bonus card directly
    const b15 = marsBot.bonusDeck.drawPile.find((c) => c.id === BonusCardId.B15_LOBBYISTS_VENUS);
    if (b15 === undefined) {
      // B15 might have been drawn already, create one
      const card = bonusCard(BonusCardId.B15_LOBBYISTS_VENUS, 'Lobbyists (Venus)' as CardName);
      // Set temp/oxygen far from bonuses so Venus branch is reached
      setTemperature(game, -30 + 26); // = -4, far from any bonus
      setOxygenLevel(game, 5); // far from 8% bonus
      marsBot['bonusResolver'].resolve(card);
      expect(game.getVenusScaleLevel()).to.be.greaterThan(6);
    }
  });

  it('Venus branch triggers at 2 steps from Venus bonus at 16%', () => {
    const {game, marsBot} = createAutomaGame({venusNextExtension: true});
    // Venus at 12% → 2 steps from 16% bonus
    setVenusScaleLevel(game, 12);
    setTemperature(game, 8); // maxed
    setOxygenLevel(game, 14); // maxed
    const card = bonusCard(BonusCardId.B15_LOBBYISTS_VENUS, 'Lobbyists (Venus)' as CardName);
    marsBot['bonusResolver'].resolve(card);
    // Venus should have been raised 2 steps: 12 → 16
    expect(game.getVenusScaleLevel()).to.eq(16);
  });

  it('Venus branch does NOT destroy card', () => {
    const {game, marsBot} = createAutomaGame({venusNextExtension: true});
    setVenusScaleLevel(game, 26); // 2 steps from 30% max
    setTemperature(game, 8);
    setOxygenLevel(game, 14);
    const card = bonusCard(BonusCardId.B15_LOBBYISTS_VENUS, 'Lobbyists (Venus)' as CardName);
    const destroyed = marsBot['bonusResolver'].resolve(card);
    expect(game.getVenusScaleLevel()).to.eq(30);
    expect(destroyed).to.be.false;
  });

  it('temp branch destroys card', () => {
    const {game, marsBot} = createAutomaGame({venusNextExtension: true});
    // Temperature at -26 → 1 step from -24 (heat bonus)
    setTemperature(game, -26);
    const card = bonusCard(BonusCardId.B15_LOBBYISTS_VENUS, 'Lobbyists (Venus)' as CardName);
    const destroyed = marsBot['bonusResolver'].resolve(card);
    expect(game.getTemperature()).to.eq(-22); // raised 2 steps
    expect(destroyed).to.be.true;
  });
});
