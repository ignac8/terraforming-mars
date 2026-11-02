import {expect} from 'chai';
import {Tag} from '@/common/cards/Tag';
import {Banker} from '@/server/awards/Banker';
import {fakeMarsBot, setTrack} from '../automa/FakeMarsBot';
import {testGame} from '../TestGame';
import {Resource} from '@/common/Resource';

describe('Banker', () => {
  it('MarsBot scores its Building and Event tracks together', () => {
    const bot = fakeMarsBot();
    setTrack(bot, Tag.BUILDING, 3);
    setTrack(bot, Tag.EVENT, 2);

    expect(new Banker().marsBotScore(bot)).eq(5);
  });

  it('scores a player by M€ production', () => {
    const [, player] = testGame(2);
    player.production.add(Resource.MEGACREDITS, 4);

    expect(new Banker().getScore(player)).eq(4);
  });
});
