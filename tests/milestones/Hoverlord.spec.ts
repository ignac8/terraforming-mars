import {expect} from 'chai';
import {Hoverlord} from '@/server/milestones/Hoverlord';
import {CardResource} from '@/common/CardResource';
import {TestPlayer} from '../TestPlayer';
import {fakeCard} from '../TestingUtils';
import {fakeMarsBot} from '../automa/FakeMarsBot';

describe('Hoverlord', () => {
  it('Can claim with 7 floaters on cards', () => {
    const milestone = new Hoverlord();
    const player = TestPlayer.BLUE.newPlayer();
    const card = fakeCard({resourceType: CardResource.FLOATER});
    card.resourceCount = 6;
    player.playedCards.push(card);
    expect(milestone.canClaim(player)).is.false;

    card.resourceCount = 7;
    expect(milestone.canClaim(player)).is.true;
  });

  for (const run of [
    {floaters: 6, expected: false},
    {floaters: 7, expected: true},
  ] as const) {
    it('MarsBot counts the floaters on its Venus board: ' + JSON.stringify(run), () => {
      const marsBot = fakeMarsBot({floaters: run.floaters});

      expect(new Hoverlord().marsBotCanClaim(marsBot)).eq(run.expected);
    });
  }
});
