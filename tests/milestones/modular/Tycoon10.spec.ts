import {expect} from 'chai';
import {CardType} from '@/common/cards/CardType';
import {marsBotCanClaimMilestone} from '@/server/automa/MarsBotMilestoneAwardEval';
import {Tycoon10} from '@/server/milestones/modular/Tycoon10';
import {fakeCard} from '../../TestingUtils';
import {fakeMarsBot} from '../../automa/FakeMarsBot';

describe('Tycoon10', () => {
  it('MarsBot needs 10 green or blue cards in its played pile, events excluded', () => {
    const events = [CardType.EVENT, CardType.EVENT];

    for (const run of [
      {cards: 9, expected: false},
      {cards: 10, expected: true},
    ]) {
      const types = [...events, ...Array<CardType>(run.cards).fill(CardType.ACTIVE)];
      const bot = fakeMarsBot({playedProjectCards: types.map((type) => fakeCard({type}))});
      expect(marsBotCanClaimMilestone(new Tycoon10(), bot), JSON.stringify(run)).eq(run.expected);
    }
  });
});
