import {expect} from 'chai';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {BoardName} from '@/common/boards/BoardName';
import {MarsBot} from '@/server/automa/MarsBot';
import {createBonusCard} from '@/server/automa/bonusCards/MarsBotBonusCards';
import {Capital} from '@/server/cards/base/Capital';
import {Mine} from '@/server/cards/base/Mine';
import {Turmoil} from '@/server/turmoil/Turmoil';
import {GrayEminenceMarsBot} from '@/server/automa/bonusCards/GrayEminenceMarsBot';
import {testGame} from '../../TestGame';
import {resetCorpRegistry} from '../corps/CorpGame';
import {recordingMarsBot} from '../corps/RecordingMarsBot';

function turmoilGame() {
  const [game] = testGame(1, {automa: true, turmoilExtension: true, boardName: BoardName.THARSIS});
  const marsBot = game.automaHooks!.marsBot;
  return {game, marsBot, turmoil: game.turmoil!};
}
const botDelegates = (turmoil: Turmoil, marsBot: MarsBot) =>
  turmoil.parties.map((party) => party.delegates.get(marsBot.player));

describe('GrayEminenceMarsBot', () => {
  beforeEach(resetCorpRegistry);

  for (const run of [
    {reserve: 7, expected: {placed: 2, calls: []}},
    {reserve: 1, expected: {placed: 1, calls: ['gainMc(2)']}},
    {reserve: 0, expected: {placed: 0, calls: ['gainMc(2)', 'gainMc(2)']}},
  ] as const) {
    it('places 2 delegates, gaining 2 M€ for each it cannot place: ' + JSON.stringify(run), () => {
      const [game, human] = testGame(1, {automa: true, turmoilExtension: true});
      const botPlayer = game.marsBotPlayer!;
      const {marsBot, calls} = recordingMarsBot({game, player: botPlayer, humanPlayer: human});
      const turmoil = Turmoil.getTurmoil(game);
      turmoil.delegateReserve.remove(botPlayer, turmoil.delegateReserve.get(botPlayer) - run.reserve);

      new GrayEminenceMarsBot().resolve(marsBot);

      expect(run.reserve - turmoil.delegateReserve.get(botPlayer)).eq(run.expected.placed);
      expect(calls).deep.eq(run.expected.calls);
    });
  }

  it('sends each delegate to a party with the fewest MarsBot delegates', () => {
    const [game, human] = testGame(1, {automa: true, turmoilExtension: true});
    const botPlayer = game.marsBotPlayer!;
    const {marsBot} = recordingMarsBot({game, player: botPlayer, humanPlayer: human});
    const turmoil = Turmoil.getTurmoil(game);
    for (const party of turmoil.parties.slice(2)) {
      turmoil.sendDelegateToParty(botPlayer, party.name, game);
    }

    new GrayEminenceMarsBot().resolve(marsBot);

    expect(turmoil.parties.map((party) => party.delegates.get(botPlayer))).deep.eq([1, 1, 1, 1, 1, 1]);
  });

  it('places 2 delegates, each in a party with the fewest MarsBot delegates', () => {
    const {marsBot, turmoil} = turmoilGame();
    const before = botDelegates(turmoil, marsBot);
    expect(Math.max(...before)).to.eq(0);
    marsBot['bonusResolver'].resolve(createBonusCard(BonusCardId.B29_GRAY_EMINENCE));
    const after = botDelegates(turmoil, marsBot);
    expect(after.reduce((a, b) => a + b, 0)).to.eq(2);
    expect(Math.max(...after)).to.eq(1);
  });

  it('breaks the last tie by flipping a project card and counting through the parties by its cost', () => {
    const {game, marsBot, turmoil} = turmoilGame();
    game.projectDeck.drawPile.push(new Mine(), new Capital()); // Capital (26) first, then Mine (4)
    const discarded = game.projectDeck.discardPile.length;

    marsBot['bonusResolver'].resolve(createBonusCard(BonusCardId.B29_GRAY_EMINENCE));

    // 26 counts to the 2nd of 6 tied parties; 4 counts to the 4th of the 5 left
    expect(botDelegates(turmoil, marsBot)).deep.eq([0, 1, 0, 0, 1, 0]);
    expect(game.projectDeck.discardPile.length).to.eq(discarded + 2);
  });

  it('gains 2 M€ for each delegate it cannot place', () => {
    const {marsBot, turmoil} = turmoilGame();
    turmoil.delegateReserve.remove(marsBot.player, turmoil.delegateReserve.get(marsBot.player) - 1);
    marsBot['bonusResolver'].resolve(createBonusCard(BonusCardId.B29_GRAY_EMINENCE));
    expect(botDelegates(turmoil, marsBot).reduce((a, b) => a + b, 0)).to.eq(1);
    expect(marsBot.turnResolver.megacredits).to.eq(2);
  });
});
