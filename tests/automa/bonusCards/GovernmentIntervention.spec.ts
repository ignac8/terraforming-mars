import {expect} from 'chai';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {BoardName} from '@/common/boards/BoardName';
import {CardName} from '@/common/cards/CardName';
import {createBonusCard} from '@/server/automa/bonusCards/MarsBotBonusCards';
import {GovernmentIntervention} from '@/server/automa/bonusCards/GovernmentIntervention';
import {testGame} from '../../TestGame';
import {maxOutOceans, setOxygenLevel, setTemperature, setVenusScaleLevel} from '../../TestingUtils';
import {createAutomaGame} from '../corps/CorpGame';
import {recordingMarsBot} from '../corps/RecordingMarsBot';
import {bonusDeckIds} from './BonusCardGame';

function venusGame() {
  const [game] = testGame(1, {automa: true, venusNextExtension: true, boardName: BoardName.THARSIS});
  const marsBot = game.automaHooks!.marsBot;
  setVenusScaleLevel(game, 6);
  return {game, marsBot, hand: marsBot.player.cardsInHand.length, deck: game.projectDeck.drawPile.length};
}

const ADVANCE_FURTHEST = `advanceFurthestParameter(${CardName.AUTOMA_GOVERNMENT_INTERVENTION}, false)`;

describe('GovernmentIntervention', () => {
  // `advanced` is what raising the parameter furthest from completion returns: false once Mars is complete
  for (const run of [
    {generation: 2, venus: 0, advanced: true, expected: {calls: ['withoutTRorMcGain()', ADVANCE_FURTHEST], venusAfter: 0}},
    {generation: 3, venus: 0, advanced: true, expected: {calls: ['withoutTRGain()'], venusAfter: 2}},
    {generation: 3, venus: 30, advanced: true, expected: {calls: ['withoutTRorMcGain()', ADVANCE_FURTHEST], venusAfter: 30}},
    {generation: 2, venus: 0, advanced: false, expected: {calls: ['withoutTRorMcGain()', ADVANCE_FURTHEST, 'withoutTRGain()'], venusAfter: 2}},
  ] as const) {
    it('raises a Martian parameter on an even generation or with Venus complete, else Venus, for no TR or M€: ' + JSON.stringify(run), () => {
      const [game, human, botPlayer] = testGame(2, {venusNextExtension: true});
      const {marsBot, calls} = recordingMarsBot({
        game, player: botPlayer, humanPlayer: human, megacredits: 0, interceptsParameterRaise: () => false,
        advanceFurthestParameter: (cardName, allowCorpIntercept) => {
          calls.push(`advanceFurthestParameter(${cardName}, ${allowCorpIntercept})`);
          return run.advanced;
        },
      });
      game.generation = run.generation;
      setVenusScaleLevel(game, run.venus);

      new GovernmentIntervention().resolve(marsBot);

      expect(calls).deep.eq(run.expected.calls);
      expect(game.getVenusScaleLevel()).eq(run.expected.venusAfter);
    });
  }

  it('gives MarsBot neither TR nor M€, even from a temperature bonus', () => {
    const [game] = testGame(1, {automa: true, venusNextExtension: true, boardName: BoardName.THARSIS});
    const marsBot = game.automaHooks!.marsBot;
    game.generation = 2;
    setOxygenLevel(game, 14);
    maxOutOceans(game.players[0]);
    setTemperature(game, -26);
    const tr = marsBot.player.terraformRating;
    const mc = marsBot.megacredits;

    marsBot.actionDeck.playBonusCard(createBonusCard(BonusCardId.B16_GOVERNMENT_INTERVENTION));

    expect(game.getTemperature()).to.eq(-24);
    expect(marsBot.player.terraformRating).to.eq(tr);
    expect(marsBot.megacredits).to.eq(mc);
  });

  it('raises Venus instead when every Martian parameter is complete on an even generation', () => {
    const [game] = testGame(1, {automa: true, venusNextExtension: true, boardName: BoardName.THARSIS});
    const marsBot = game.automaHooks!.marsBot;
    game.generation = 2;
    setOxygenLevel(game, 14);
    maxOutOceans(game.players[0]);
    setTemperature(game, 8);
    const venus = game.getVenusScaleLevel();

    marsBot.actionDeck.playBonusCard(createBonusCard(BonusCardId.B16_GOVERNMENT_INTERVENTION));

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

    marsBot.actionDeck.playBonusCard(createBonusCard(BonusCardId.B16_GOVERNMENT_INTERVENTION));

    expect(game.getTemperature()).to.eq(-8);
    expect(game.getOxygenLevel()).to.eq(7);
  });

  it('gains nothing from the Venus 8% bonus, which pays no M€', () => {
    const {game, marsBot, hand} = venusGame();
    game.generation = 3;

    marsBot.actionDeck.playBonusCard(createBonusCard(BonusCardId.B16_GOVERNMENT_INTERVENTION));

    expect(game.getVenusScaleLevel()).to.eq(8);
    expect(marsBot.megacredits).to.eq(0);
    expect(marsBot.player.cardsInHand).has.length(hand);
  });

  it('even generation advances Martian parameter without TR', () => {
    const {game, marsBot} = createAutomaGame({venusNextExtension: true});
    game.generation = 4; // even
    const trBefore = marsBot.player.terraformRating;
    const card = createBonusCard(BonusCardId.B16_GOVERNMENT_INTERVENTION);
    marsBot.actionDeck.playBonusCard(card);
    // TR should not have changed (reversed by withoutTRGain)
    expect(marsBot.player.terraformRating).to.eq(trBefore);
  });

  it('odd generation raises Venus without TR', () => {
    const {game, marsBot} = createAutomaGame({venusNextExtension: true});
    game.generation = 3; // odd
    const venusBefore = game.getVenusScaleLevel();
    const trBefore = marsBot.player.terraformRating;
    const card = createBonusCard(BonusCardId.B16_GOVERNMENT_INTERVENTION);
    marsBot.actionDeck.playBonusCard(card);
    expect(game.getVenusScaleLevel()).to.eq(venusBefore + 2);
    expect(marsBot.player.terraformRating).to.eq(trBefore);
  });

  it('even gen with Venus complete still advances Martian parameter', () => {
    const {game, marsBot} = createAutomaGame({venusNextExtension: true});
    game.generation = 3; // odd, but Venus complete → should use Martian branch
    setVenusScaleLevel(game, 30);
    const venusBefore = game.getVenusScaleLevel();
    const card = createBonusCard(BonusCardId.B16_GOVERNMENT_INTERVENTION);
    marsBot.actionDeck.playBonusCard(card);
    // Venus should not change (already maxed, used Martian branch instead)
    expect(game.getVenusScaleLevel()).to.eq(venusBefore);
  });

  it('stays out of the bonus deck after it resolves', () => {
    const {marsBot} = createAutomaGame({venusNextExtension: true});

    marsBot.actionDeck.playBonusCard(createBonusCard(BonusCardId.B16_GOVERNMENT_INTERVENTION));

    expect(bonusDeckIds(marsBot)).does.not.include(BonusCardId.B16_GOVERNMENT_INTERVENTION);
  });
});
