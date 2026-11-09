import {expect} from 'chai';
import {Tag} from '@/common/cards/Tag';
import {Blacksmith} from '@/server/awards/Blacksmith';
import {fakeMarsBot, setTrack} from '../automa/FakeMarsBot';
import {testGame} from '../TestGame';

describe('Blacksmith', () => {
  it('scores a player by steel and titanium production', () => {
    const [, player] = testGame(2);
    player.production.override({steel: 3, titanium: 2});

    expect(new Blacksmith().getScore(player)).to.eq(5);
  });

  for (const run of [
    {building: 3, space: 5, expected: 5},
    {building: 6, space: 2, expected: 6},
  ] as const) {
    it(`MarsBot scores the higher of its Building and Space tracks, ${JSON.stringify(run)}`, () => {
      const bot = fakeMarsBot();
      setTrack(bot, Tag.BUILDING, run.building);
      setTrack(bot, Tag.SPACE, run.space);

      expect(new Blacksmith().marsBotScore(bot)).eq(run.expected);
    });
  }
});
