import {expect} from 'chai';
import {Tag} from '@/common/cards/Tag';
import {Promoter} from '@/server/awards/arabiaTerra/Promoter';
import {fakeMarsBot, setTrack} from '../../automa/FakeMarsBot';
import {TestPlayer} from '../../TestPlayer';
import {fakeCard} from '../../TestingUtils';
import {CardType} from '@/common/cards/CardType';

describe('Promoter', () => {
  it('scores a player by played events', () => {
    const player = TestPlayer.BLUE.newPlayer();
    player.playedCards.push(fakeCard({type: CardType.EVENT}));
    player.playedCards.push(fakeCard());

    expect(new Promoter().getScore(player)).to.eq(1);
  });

  it('MarsBot scores its Event track', () => {
    const marsBot = fakeMarsBot();
    setTrack(marsBot, Tag.EVENT, 4);

    expect(new Promoter().marsBotScore(marsBot)).eq(4);
  });
});
