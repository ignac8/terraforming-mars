import {expect} from 'chai';
import {marsBotAwardScore} from '@/server/automa/MarsBotMilestoneAwardEval';
import {Benefactor} from '@/server/awards/Benefactor';
import {fakeMarsBot} from '../automa/FakeMarsBot';

describe('Benefactor', () => {
  it('MarsBot scores its TR minus 15, but never below 0', () => {
    const bot = fakeMarsBot();

    for (const run of [
      {terraformRating: 22, expected: 7},
      {terraformRating: 10, expected: 0},
    ]) {
      bot.player.setTerraformRating(run.terraformRating);
      expect(marsBotAwardScore(new Benefactor(), bot), JSON.stringify(run)).eq(run.expected);
    }
  });
});
