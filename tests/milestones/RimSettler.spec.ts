import {expect} from 'chai';
import {BoardName} from '@/common/boards/BoardName';
import {Tag} from '@/common/cards/Tag';
import {marsBotCanClaimMilestone} from '@/server/automa/MarsBotMilestoneAwardEval';
import {RimSettler} from '@/server/milestones/RimSettler';
import {fakeMarsBot, setTrack} from '../automa/FakeMarsBot';

describe('RimSettler', () => {
  it('MarsBot needs space 6 on Hellas and space 5 anywhere else', () => {
    const hellas = {boardName: BoardName.HELLAS};
    const tharsis = {boardName: BoardName.THARSIS};
    const hellasWithExpansion = {boardName: BoardName.HELLAS, modularMA: true};

    for (const run of [
      {gameOptions: hellas, position: 5, expected: false},
      {gameOptions: hellas, position: 6, expected: true},
      {gameOptions: tharsis, position: 5, expected: true},
      {gameOptions: hellasWithExpansion, position: 5, expected: true},
    ]) {
      const bot = fakeMarsBot({gameOptions: run.gameOptions});
      setTrack(bot, Tag.POWER, run.position);
      expect(marsBotCanClaimMilestone(new RimSettler(), bot), JSON.stringify(run)).eq(run.expected);
    }
  });
});
