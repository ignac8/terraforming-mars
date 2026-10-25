import {expect} from 'chai';
import {Planetologist} from '../../../src/server/milestones/modular/Planetologist';
import {TestPlayer} from '../../TestPlayer';
import {Chimera} from '../../../src/server/cards/pathfinders/Chimera';
import {fakeCard} from '../../TestingUtils';
import {Tag} from '../../../src/common/cards/Tag';
import {testGame} from '../../TestGame';
import {BoardName} from '@/common/boards/BoardName';
import {marsBotCanClaimMilestone} from '@/server/automa/MarsBotMilestoneAwardEval';
import {THARSIS_MARSBOT_BOARD} from '@/server/automa/boards/TharsisMarsBot';
import {VENUS_MARSBOT_TRACK} from '@/server/automa/boards/VenusMarsBot';
import {fakeMarsBot, setTrack} from '../../automa/FakeMarsBot';

describe('Planetologist', () => {
  const canClaimRuns = [
    {earth: 0, jovian: 0, venus: 0, wild: 0, expected: {score: 0, canClaim: false}},
    {earth: 0, jovian: 2, venus: 2, wild: 0, expected: {score: 4, canClaim: false}},
    {earth: 2, jovian: 2, venus: 2, wild: 0, expected: {score: 6, canClaim: true}},
    {earth: 7, jovian: 3, venus: 7, wild: 0, expected: {score: 6, canClaim: true}},
    {earth: 1, jovian: 2, venus: 2, wild: 0, expected: {score: 5, canClaim: false}},
    {earth: 1, jovian: 2, venus: 2, wild: 1, expected: {score: 6, canClaim: true}},
    {earth: 1, jovian: 1, venus: 1, wild: 1, expected: {score: 4, canClaim: false}},
    {earth: 0, jovian: 0, venus: 0, wild: 6, expected: {score: 6, canClaim: true}},
  ] as const;
  for (const run of canClaimRuns) {
    it('canClaim ' + JSON.stringify(run), () => {
      const milestone = new Planetologist();
      const player = TestPlayer.BLUE.newPlayer();
      player.tagsForTest = {earth: run.earth, venus: run.venus, jovian: run.jovian, wild: run.wild};
      expect(milestone.getScore(player)).eq(run.expected.score);
      expect(milestone.canClaim(player)).eq(run.expected.canClaim);
    });
  }

  it('Compatible with Chimera', () => {
    const milestone = new Planetologist();
    const [/* game */, player] = testGame(2);
    player.playedCards.push(new Chimera());
    expect(milestone.getScore(player)).eq(1);

    player.playedCards.push(fakeCard({tags: [Tag.EARTH, Tag.EARTH, Tag.VENUS, Tag.VENUS]}));
    player.playedCards.push(fakeCard({tags: [Tag.JOVIAN]}));
    expect(milestone.getScore(player)).eq(6);
    expect(milestone.canClaim(player)).is.true;
  });

  it('MarsBot follows the Terra Cimmeria rule there and the expansion rule elsewhere', () => {
    const terraCimmeria = {boardName: BoardName.TERRA_CIMMERIA_NOVA};
    const expansion = {boardName: BoardName.TERRA_CIMMERIA_NOVA, modularMA: true};

    for (const run of [
      {gameOptions: terraCimmeria, power: 0, earth: 3, venus: 1, expected: false},
      {gameOptions: terraCimmeria, power: 0, earth: 3, venus: 2, expected: true},
      {gameOptions: expansion, power: 0, earth: 2, venus: 3, expected: false},
      {gameOptions: expansion, power: 3, earth: 3, venus: 0, expected: true},
    ]) {
      const bot = fakeMarsBot({tracks: [...THARSIS_MARSBOT_BOARD, VENUS_MARSBOT_TRACK], gameOptions: run.gameOptions});
      setTrack(bot, Tag.POWER, run.power);
      setTrack(bot, Tag.EARTH, run.earth);
      setTrack(bot, Tag.VENUS, run.venus);
      expect(marsBotCanClaimMilestone(new Planetologist(), bot), JSON.stringify(run)).eq(run.expected);
    }
  });
});
