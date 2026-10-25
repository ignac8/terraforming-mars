import {expect} from 'chai';
import {Birds} from '../../src/server/cards/base/Birds';
import {CometAiming} from '../../src/server/cards/promo/CometAiming';
import {Dirigibles} from '../../src/server/cards/venusNext/Dirigibles';
import {Tradesman} from '../../src/server/milestones/Tradesman';
import {TestPlayer} from '../TestPlayer';
import {Tag} from '@/common/cards/Tag';
import {marsBotCanClaimMilestone} from '@/server/automa/MarsBotMilestoneAwardEval';
import {THARSIS_MARSBOT_BOARD} from '@/server/automa/boards/TharsisMarsBot';
import {VENUS_MARSBOT_TRACK} from '@/server/automa/boards/VenusMarsBot';
import {fakeMarsBot, setTrack} from '../automa/FakeMarsBot';

describe('Tradesman', () => {
  let milestone: Tradesman;
  let player: TestPlayer;

  beforeEach(() => {
    milestone = new Tradesman();
    player = TestPlayer.BLUE.newPlayer();
  });

  it('Can claim with 3 types of non-standard resources', () => {
    const cometAiming = new CometAiming();
    const birds = new Birds();
    const dirigibles = new Dirigibles();
    player.playedCards.push(cometAiming, birds, dirigibles);

    player.addResourceTo(cometAiming);
    player.addResourceTo(birds);
    expect(milestone.canClaim(player)).is.false;

    player.addResourceTo(dirigibles);
    expect(milestone.canClaim(player)).is.true;
  });

  it('Can claim with corruption', () => {
    const cometAiming = new CometAiming();
    const birds = new Birds();
    player.playedCards.push(cometAiming, birds);

    player.addResourceTo(cometAiming);
    player.underworldData.corruption = 1;
    expect(milestone.canClaim(player)).is.false;

    player.addResourceTo(birds);
    expect(milestone.canClaim(player)).is.true;
  });

  it('MarsBot needs space 2 on its Energy, Earth and Venus tracks', () => {
    const bot = fakeMarsBot({tracks: [...THARSIS_MARSBOT_BOARD, VENUS_MARSBOT_TRACK]});
    setTrack(bot, Tag.POWER, 2);
    setTrack(bot, Tag.EARTH, 2);

    for (const run of [
      {venus: 1, expected: false},
      {venus: 2, expected: true},
    ]) {
      setTrack(bot, Tag.VENUS, run.venus);
      expect(marsBotCanClaimMilestone(milestone, bot), JSON.stringify(run)).eq(run.expected);
    }
  });
});
