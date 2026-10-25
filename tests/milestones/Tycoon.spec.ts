import {expect} from 'chai';
import {CardType} from '@/common/cards/CardType';
import {marsBotCanClaimMilestone} from '@/server/automa/MarsBotMilestoneAwardEval';
import {Tycoon} from '@/server/milestones/Tycoon';
import {fakeCard} from '../TestingUtils';
import {fakeMarsBot} from '../automa/FakeMarsBot';

describe('Tycoon', () => {
  it('MarsBot needs 15 green or blue cards in its played pile, events excluded', () => {
    const events = [CardType.EVENT, CardType.EVENT];

    for (const run of [
      {cards: 14, expected: false},
      {cards: 15, expected: true},
    ]) {
      const types = [...events, ...Array<CardType>(run.cards).fill(CardType.ACTIVE)];
      const bot = fakeMarsBot({playedProjectCards: types.map((type) => fakeCard({type}))});
      expect(marsBotCanClaimMilestone(new Tycoon(), bot), JSON.stringify(run)).eq(run.expected);
    }
  });
});
