import {expect} from 'chai';
import {CardType} from '@/common/cards/CardType';
import {marsBotCanClaimMilestone} from '@/server/automa/MarsBotMilestoneAwardEval';
import {Legend4} from '@/server/milestones/modular/Legend4';
import {fakeCard} from '../../TestingUtils';
import {fakeMarsBot} from '../../automa/FakeMarsBot';

describe('Legend4', () => {
  it('MarsBot needs 4 events in its played pile', () => {
    const others = [CardType.ACTIVE, CardType.AUTOMATED];

    for (const run of [
      {events: 3, expected: false},
      {events: 4, expected: true},
    ]) {
      const types = [...others, ...Array<CardType>(run.events).fill(CardType.EVENT)];
      const bot = fakeMarsBot({playedProjectCards: types.map((type) => fakeCard({type}))});
      expect(marsBotCanClaimMilestone(new Legend4(), bot), JSON.stringify(run)).eq(run.expected);
    }
  });
});
