import {expect} from 'chai';
import {Resource} from '../../src/common/Resource';
import {Smith} from '../../src/server/milestones/Smith';
import {TestPlayer} from '../TestPlayer';
import {Tag} from '@/common/cards/Tag';
import {marsBotCanClaimMilestone} from '@/server/automa/MarsBotMilestoneAwardEval';
import {fakeMarsBot, setTrack} from '../automa/FakeMarsBot';

describe('Smith', () => {
  let milestone: Smith;
  let player: TestPlayer;

  beforeEach(() => {
    milestone = new Smith();
    player = TestPlayer.BLUE.newPlayer();
  });

  it('Can claim with 6 steel and titanium production', () => {
    player.production.add(Resource.STEEL, 4);
    player.production.add(Resource.TITANIUM, 1);
    expect(milestone.canClaim(player)).is.false;

    player.production.add(Resource.TITANIUM, 1);
    expect(milestone.canClaim(player)).is.true;
  });

  it('MarsBot needs its Building and Space tracks to add up to 7', () => {
    const bot = fakeMarsBot();
    setTrack(bot, Tag.BUILDING, 3);

    for (const run of [
      {space: 3, expected: false},
      {space: 4, expected: true},
    ]) {
      setTrack(bot, Tag.SPACE, run.space);
      expect(marsBotCanClaimMilestone(milestone, bot), JSON.stringify(run)).eq(run.expected);
    }
  });
});
