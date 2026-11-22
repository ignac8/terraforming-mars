import {expect} from 'chai';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {createBonusCard} from '@/server/automa/bonusCards/MarsBotBonusCards';
import {Turmoil} from '@/server/turmoil/Turmoil';
import {PartyPolitics} from '@/server/automa/bonusCards/PartyPolitics';
import {fakeCard} from '../../TestingUtils';
import {testGame} from '../../TestGame';
import {createAutomaGame} from '../corps/CorpGame';
import {recordingMarsBot} from '../corps/RecordingMarsBot';
import {bonusDeckIds} from './BonusCardGame';

describe('PartyPolitics', () => {
  for (const run of [
    {reserve: 7, megacredits: 5, revealedCost: 6, expected: {placed: 2, calls: ['loseMc(5)']}},
    {reserve: 7, megacredits: 5, revealedCost: 4, expected: {placed: 1, calls: []}},
    {reserve: 7, megacredits: 4, revealedCost: 6, expected: {placed: 1, calls: []}},
    {reserve: 1, megacredits: 5, revealedCost: 6, expected: {placed: 1, calls: []}},
    {reserve: 0, megacredits: 5, revealedCost: 6, expected: {placed: 0, calls: []}},
  ] as const) {
    it('places a delegate, and spends 5 M€ on a second when the revealed cost divides by 3: ' + JSON.stringify(run), () => {
      const [game, human] = testGame(1, {automa: true, turmoilExtension: true});
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
    const {game, marsBot} = createAutomaGame({turmoilExtension: true});
    const turmoil = Turmoil.getTurmoil(game);
    const marsBotPlayer = marsBot.player;

    const reserveBefore = turmoil.delegateReserve.get(marsBotPlayer);
    const card = createBonusCard(BonusCardId.B21_PARTY_POLITICS);
    marsBot.actionDeck.playBonusCard(card);

    const reserveAfter = turmoil.delegateReserve.get(marsBotPlayer);
    // At least 1 delegate is placed, 2 when T-8 applies.
    expect(reserveAfter).to.be.lessThan(reserveBefore);
  });

  it('T-8: second delegate is placed when cost divisible by 3 and MC >= 5', () => {
    const {game, marsBot} = createAutomaGame({turmoilExtension: true});
    const turmoil = Turmoil.getTurmoil(game);
    const marsBotPlayer = marsBot.player;

    marsBot.megacredits = 5;

    // Finds a card whose cost is divisible by 3.
    const projectCard = game.projectDeck.draw(game)!;
    let targetCard = projectCard;
    const searchLimit = 20;
    for (let i = 0; i < searchLimit && targetCard.cost % 3 !== 0; i++) {
      game.projectDeck.discardPile.push(targetCard);
      const next = game.projectDeck.draw(game);
      if (next === undefined) {
        break;
      }
      targetCard = next;
    }

    if (targetCard.cost % 3 === 0) {
      // The top of the project deck is the end of the draw pile, which T-8 reveals.
      game.projectDeck.drawPile.push(targetCard);
      const reserveBefore = turmoil.delegateReserve.get(marsBotPlayer);
      const card = createBonusCard(BonusCardId.B21_PARTY_POLITICS);
      marsBot.actionDeck.playBonusCard(card);
      const reserveAfter = turmoil.delegateReserve.get(marsBotPlayer);
      expect(reserveBefore - reserveAfter).to.be.at.least(2);
    }
    // Without a card whose cost is divisible by 3, nothing is checked.
  });

  it('stays out of the bonus deck after it resolves', () => {
    const {marsBot} = createAutomaGame({turmoilExtension: true});

    marsBot.actionDeck.playBonusCard(createBonusCard(BonusCardId.B21_PARTY_POLITICS));

    expect(bonusDeckIds(marsBot)).does.not.include(BonusCardId.B21_PARTY_POLITICS);
  });
});
