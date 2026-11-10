import {expect} from 'chai';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {BoardName} from '@/common/boards/BoardName';
import {CardName} from '@/common/cards/CardName';
import {bonusCard, createBonusCard} from '@/server/automa/MarsBotBonusCard';
import {testGame} from '../../TestGame';
import {maxOutOceans, setOxygenLevel, setTemperature, setVenusScaleLevel} from '../../TestingUtils';
import {createAutomaGame} from '../corps/CorpGame';
import {bonusDeckIds} from './BonusCardGame';

function venusGame() {
  const [game] = testGame(1, {automa: true, venusNextExtension: true, boardName: BoardName.THARSIS});
  const marsBot = game.automaHooks!.marsBot;
  setVenusScaleLevel(game, 6);
  return {game, marsBot, hand: marsBot.player.cardsInHand.length, deck: game.projectDeck.drawPile.length};
}

describe('GovernmentInterventionMarsBot', () => {
  it('gives MarsBot neither TR nor M€, even from a temperature bonus', () => {
    const [game] = testGame(1, {automa: true, venusNextExtension: true, boardName: BoardName.THARSIS});
    const marsBot = game.automaHooks!.marsBot;
    game.generation = 2;
    setOxygenLevel(game, 14);
    maxOutOceans(game.players[0]);
    setTemperature(game, -26);
    const tr = marsBot.player.terraformRating;
    const mc = marsBot.turnResolver.megacredits;

    marsBot['bonusResolver'].resolve(createBonusCard(BonusCardId.B16_GOVERNMENT_INTERVENTION));

    expect(game.getTemperature()).to.eq(-24);
    expect(marsBot.player.terraformRating).to.eq(tr);
    expect(marsBot.turnResolver.megacredits).to.eq(mc);
  });

  it('raises Venus instead when every Martian parameter is complete on an even generation', () => {
    const [game] = testGame(1, {automa: true, venusNextExtension: true, boardName: BoardName.THARSIS});
    const marsBot = game.automaHooks!.marsBot;
    game.generation = 2;
    setOxygenLevel(game, 14);
    maxOutOceans(game.players[0]);
    setTemperature(game, 8);
    const venus = game.getVenusScaleLevel();

    marsBot['bonusResolver'].resolve(createBonusCard(BonusCardId.B16_GOVERNMENT_INTERVENTION));

    expect(game.getVenusScaleLevel()).to.eq(venus + 2);
  });

  it('advances the parameter with the most steps remaining, not the lowest fraction done', () => {
    const [game] = testGame(1, {automa: true, venusNextExtension: true, boardName: BoardName.THARSIS});
    const marsBot = game.automaHooks!.marsBot;
    game.generation = 2;
    // Oxygen 7 is 50% done with 7 steps left, temperature -10 is 52% done with 9 steps left
    setOxygenLevel(game, 7);
    maxOutOceans(game.players[0]);
    setTemperature(game, -10);

    marsBot['bonusResolver'].resolve(createBonusCard(BonusCardId.B16_GOVERNMENT_INTERVENTION));

    expect(game.getTemperature()).to.eq(-8);
    expect(game.getOxygenLevel()).to.eq(7);
  });

  it('gains nothing from the Venus 8% bonus, which pays no M€', () => {
    const {game, marsBot, hand} = venusGame();
    game.generation = 3;

    marsBot['bonusResolver'].resolve(createBonusCard(BonusCardId.B16_GOVERNMENT_INTERVENTION));

    expect(game.getVenusScaleLevel()).to.eq(8);
    expect(marsBot.turnResolver.megacredits).to.eq(0);
    expect(marsBot.player.cardsInHand).has.length(hand);
  });

  it('even generation advances Martian parameter without TR', () => {
    const {game, marsBot} = createAutomaGame({venusNextExtension: true});
    (game as any).generation = 4; // even
    const trBefore = marsBot.player.terraformRating;
    const card = bonusCard(BonusCardId.B16_GOVERNMENT_INTERVENTION, 'Government Intervention' as CardName);
    (marsBot as any).bonusResolver.resolve(card);
    // TR should not have changed (reversed by withoutTRGain)
    expect(marsBot.player.terraformRating).to.eq(trBefore);
  });

  it('odd generation raises Venus without TR', () => {
    const {game, marsBot} = createAutomaGame({venusNextExtension: true});
    (game as any).generation = 3; // odd
    const venusBefore = game.getVenusScaleLevel();
    const trBefore = marsBot.player.terraformRating;
    const card = bonusCard(BonusCardId.B16_GOVERNMENT_INTERVENTION, 'Government Intervention' as CardName);
    (marsBot as any).bonusResolver.resolve(card);
    expect(game.getVenusScaleLevel()).to.eq(venusBefore + 2);
    expect(marsBot.player.terraformRating).to.eq(trBefore);
  });

  it('even gen with Venus complete still advances Martian parameter', () => {
    const {game, marsBot} = createAutomaGame({venusNextExtension: true});
    (game as any).generation = 3; // odd, but Venus complete → should use Martian branch
    (game as any).venusScaleLevel = 30;
    const venusBefore = game.getVenusScaleLevel();
    const card = bonusCard(BonusCardId.B16_GOVERNMENT_INTERVENTION, 'Government Intervention' as CardName);
    (marsBot as any).bonusResolver.resolve(card);
    // Venus should not change (already maxed, used Martian branch instead)
    expect(game.getVenusScaleLevel()).to.eq(venusBefore);
  });

  it('stays out of the bonus deck after it resolves', () => {
    const {marsBot} = createAutomaGame({venusNextExtension: true});

    marsBot['bonusResolver'].resolve(createBonusCard(BonusCardId.B16_GOVERNMENT_INTERVENTION));

    expect(bonusDeckIds(marsBot)).does.not.include(BonusCardId.B16_GOVERNMENT_INTERVENTION);
  });
});
