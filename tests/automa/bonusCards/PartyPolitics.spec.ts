import {expect} from 'chai';
import {BonusCardName} from '@/common/automa/BonusCardName';
import {createBonusCard} from '@/server/automa/bonusCards/MarsBotBonusCards';
import {Turmoil} from '@/server/turmoil/Turmoil';
import {PartyPolitics} from '@/server/automa/bonusCards/PartyPolitics';
import {fakeCard} from '../../TestingUtils';
import {testGame} from '../../TestGame';
import {createAutomaGame} from '../corps/CorpGame';
import {recordingMarsBot} from '../corps/RecordingMarsBot';
import {bonusCardsInBonusDeck} from './BonusCardGame';

describe('PartyPolitics', () => {
  for (const run of [
    {reserve: 7, megacredits: 5, revealedCost: 6, expected: {placed: 2, calls: ['loseMc(5)']}},
    {reserve: 7, megacredits: 5, revealedCost: 4, expected: {placed: 1, calls: []}},
    {reserve: 7, megacredits: 4, revealedCost: 6, expected: {placed: 1, calls: []}},
    {reserve: 1, megacredits: 5, revealedCost: 6, expected: {placed: 1, calls: []}},
    {reserve: 0, megacredits: 5, revealedCost: 6, expected: {placed: 0, calls: []}},
  ] as const) {
    it('places a delegate, and spends 5 M€ on a second when the revealed cost divides by 3: ' + JSON.stringify(run), () => {
      const [game, human] = testGame(1, {automa: true, expansions: {turmoil: true}});
      const botPlayer = game.marsBotPlayer!;
      const {marsBot, calls} = recordingMarsBot({game, player: botPlayer, humanPlayer: human, megacredits: run.megacredits});
      const turmoil = Turmoil.getTurmoil(game);
      turmoil.delegateReserve.remove(botPlayer, turmoil.delegateReserve.get(botPlayer) - run.reserve);
      game.projectDeck.drawPile.push(fakeCard({cost: run.revealedCost}));

      new PartyPolitics().resolve(marsBot);

      const placed = run.reserve - turmoil.delegateReserve.get(botPlayer);
      expect(placed).eq(run.expected.placed);
      expect(calls).deep.eq(run.expected.calls);
    });
  }

  it('places 1 delegate and drains the reserve', () => {
    const {game, marsBot} = createAutomaGame({expansions: {turmoil: true}});
    const turmoil = Turmoil.getTurmoil(game);
    const marsBotPlayer = marsBot.player;

    const reserveBefore = turmoil.delegateReserve.get(marsBotPlayer);
    const card = createBonusCard(BonusCardName.PARTY_POLITICS);
    marsBot.actionDeck.playBonusCard(card);

    const reserveAfter = turmoil.delegateReserve.get(marsBotPlayer);
    // At least 1 delegate is placed, 2 when the revealed card's cost divides by 3.
    expect(reserveAfter).to.be.lessThan(reserveBefore);
  });

  it('stays out of the bonus deck after it resolves', () => {
    const {marsBot} = createAutomaGame({expansions: {turmoil: true}});

    marsBot.actionDeck.playBonusCard(createBonusCard(BonusCardName.PARTY_POLITICS));

    expect(bonusCardsInBonusDeck(marsBot)).does.not.include(BonusCardName.PARTY_POLITICS);
  });
});
