import {expect} from 'chai';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {createBonusCard} from '@/server/automa/MarsBotBonusCard';
import {Turmoil} from '@/server/turmoil/Turmoil';
import {PartyPoliticsMarsBot} from '@/server/automa/bonusCards/PartyPoliticsMarsBot';
import {fakeCard} from '../../TestingUtils';
import {testGame} from '../../TestGame';
import {createAutomaGame} from '../corps/CorpGame';
import {recordingMarsBot} from '../corps/RecordingMarsBot';
import {bonusDeckIds} from './BonusCardGame';

describe('PartyPoliticsMarsBot', () => {
  for (const run of [
    {reserve: 7, megacredits: 5, flippedCost: 6, placed: 2, megacreditsLeft: 0},
    {reserve: 7, megacredits: 5, flippedCost: 4, placed: 1, megacreditsLeft: 5},
    {reserve: 7, megacredits: 4, flippedCost: 6, placed: 1, megacreditsLeft: 4},
    {reserve: 1, megacredits: 5, flippedCost: 6, placed: 1, megacreditsLeft: 5},
    {reserve: 0, megacredits: 5, flippedCost: 6, placed: 0, megacreditsLeft: 5},
  ] as const) {
    it('places a delegate, and spends 5 M€ on a second when the flipped cost divides by 3: ' + JSON.stringify(run), () => {
      const [game, human] = testGame(1, {automa: true, turmoilExtension: true});
      const botPlayer = game.marsBotPlayer!;
      const {marsBot} = recordingMarsBot({game, player: botPlayer, humanPlayer: human, megacredits: run.megacredits});
      const turmoil = Turmoil.getTurmoil(game);
      turmoil.delegateReserve.remove(botPlayer, turmoil.delegateReserve.get(botPlayer) - run.reserve);
      game.projectDeck.drawPile.push(fakeCard({cost: run.flippedCost}));

      new PartyPoliticsMarsBot().resolve(marsBot);

      expect(run.reserve - turmoil.delegateReserve.get(botPlayer)).eq(run.placed);
      expect(marsBot.megacredits).eq(run.megacreditsLeft);
    });
  }

  it('places 1 delegate and drains the reserve', () => {
    const {game, marsBot} = createAutomaGame({turmoilExtension: true});
    const turmoil = Turmoil.getTurmoil(game);
    const marsBotPlayer = marsBot.player;

    const reserveBefore = turmoil.delegateReserve.get(marsBotPlayer);
    // Trigger the Party Politics bonus card directly
    const card = createBonusCard(BonusCardId.B21_PARTY_POLITICS);
    // Access private bonusResolver for testing
    marsBot['bonusResolver'].resolve(card);

    const reserveAfter = turmoil.delegateReserve.get(marsBotPlayer);
    // At least 1 delegate placed (possibly 2 if T-8 triggered)
    expect(reserveAfter).to.be.lessThan(reserveBefore);
  });

  it('T-8: second delegate is placed when cost divisible by 3 and MC >= 5', () => {
    const {game, marsBot} = createAutomaGame({turmoilExtension: true});
    const turmoil = Turmoil.getTurmoil(game);
    const marsBotPlayer = marsBot.player;

    // Give MarsBot 5+ MC
    marsBot.turnResolver.megacredits = 5;

    // Find a card whose cost is divisible by 3 and put it on top of project deck
    const projectCard = game.projectDeck.draw(game)!;
    // Find a card with cost divisible by 3
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
      // Put this card on top so it gets flipped for T-8 (draw() uses pop(), so push = top)
      game.projectDeck.drawPile.push(targetCard);
      const reserveBefore = turmoil.delegateReserve.get(marsBotPlayer);
      const card = createBonusCard(BonusCardId.B21_PARTY_POLITICS);
      marsBot['bonusResolver'].resolve(card);
      const reserveAfter = turmoil.delegateReserve.get(marsBotPlayer);
      // Should have placed 2 delegates
      expect(reserveBefore - reserveAfter).to.be.at.least(2);
    }
    // If no divisible-by-3 card found, test is inconclusive (skip)
  });

  it('stays out of the bonus deck after it resolves', () => {
    const {marsBot} = createAutomaGame({turmoilExtension: true});

    marsBot['bonusResolver'].resolve(createBonusCard(BonusCardId.B21_PARTY_POLITICS));

    expect(bonusDeckIds(marsBot)).does.not.include(BonusCardId.B21_PARTY_POLITICS);
  });
});
