import {expect} from 'chai';
import {Tag} from '@/common/cards/Tag';
import {Miner} from '@/server/awards/Miner';
import {fakeMarsBot, setTrack} from '../automa/FakeMarsBot';
import {testGame} from '../TestGame';

describe('Miner', () => {
  it('MarsBot scores its Space track plus 5', () => {
    const bot = fakeMarsBot();
    setTrack(bot, Tag.SPACE, 3);

    expect(new Miner().marsBotScore(bot)).eq(8);
  });

  it('scores a player by steel and titanium mid game', () => {
    const [, player] = testGame(2);
    player.steel = 3;
    player.titanium = 2;

    expect(new Miner().getScore(player)).eq(5);
  });
});
