import {expect} from 'chai';
import {CardType} from '@/common/cards/CardType';
import {marsBotCanClaimMilestone} from '@/server/automa/MarsBotMilestoneAwardEval';
import {Legend} from '@/server/milestones/Legend';
import {fakeCard} from '../TestingUtils';
import {fakeMarsBot} from '../automa/FakeMarsBot';

describe('Legend', () => {
  it('MarsBot needs 5 events in its played pile', () => {
    const others = [CardType.ACTIVE, CardType.AUTOMATED];

    for (const run of [
      {events: 4, expected: false},
      {events: 5, expected: true},
    ]) {
      const types = [...others, ...Array<CardType>(run.events).fill(CardType.EVENT)];
      const bot = fakeMarsBot({playedProjectCards: types.map((type) => fakeCard({type}))});
      expect(marsBotCanClaimMilestone(new Legend(), bot), JSON.stringify(run)).eq(run.expected);
    }
  });
});
