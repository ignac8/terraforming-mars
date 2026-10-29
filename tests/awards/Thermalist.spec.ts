import {expect} from 'chai';
import {Tag} from '@/common/cards/Tag';
import {Thermalist} from '@/server/awards/Thermalist';
import {fakeMarsBot, setTrack} from '../automa/FakeMarsBot';
import {testGame} from '../TestGame';

describe('Thermalist', () => {
  it('MarsBot scores its Energy track plus 5', () => {
    const bot = fakeMarsBot();
    setTrack(bot, Tag.POWER, 3);

    expect(new Thermalist().marsBotScore(bot)).eq(8);
  });

  it('scores a player by energy, heat and heat production mid game', () => {
    const [, player] = testGame(2);
    player.energy = 2;
    player.heat = 3;

    expect(new Thermalist().getScore(player)).eq(5);
  });
});
