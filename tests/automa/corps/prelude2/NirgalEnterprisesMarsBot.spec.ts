import {expect} from 'chai';
import {BoardName} from '@/common/boards/BoardName';
import {NirgalEnterprisesMarsBot} from '@/server/automa/corps/prelude2/NirgalEnterprisesMarsBot';
import {testGame} from '../../../TestGame';
import {recordingMarsBot} from '../RecordingMarsBot';

describe('NirgalEnterprisesMarsBot', () => {
  it('removes Overachievement at setup', () => {
    const {marsBot, calls} = recordingMarsBot();

    new NirgalEnterprisesMarsBot().setup(marsBot);

    expect(calls).deep.eq(['removeBonusCard(B04)']);
  });

  it('adds 2 to every award', () => {
    expect(new NirgalEnterprisesMarsBot().awardScoreBonus()).eq(2);
  });

  const milestone = 'maybeClaimMilestone()';
  const award = 'maybeFundAward()';
  for (const [generation, expected] of [[1, []], [2, [milestone]], [5, [milestone]], [6, [award]], [9, [award]], [10, [milestone]]] as const) {
    it(`claims a milestone in generations 2 to 5 and from 10, and funds an award in 6 to 9, generation ${generation}`, () => {
      const {marsBot, calls} = recordingMarsBot();
      marsBot.game.generation = generation;

      new NirgalEnterprisesMarsBot().beforeActionPhase(marsBot);

      expect(calls).deep.eq(expected);
    });
  }

  for (const [generation, expected] of [[6, [milestone]], [7, [award]], [10, [award]], [11, [milestone]]] as const) {
    it(`starts each window after the first one generation later on Amazonis Planitia, generation ${generation}`, () => {
      const [game] = testGame(1, {boardName: BoardName.AMAZONIS_PLANITIA});
      const {marsBot, calls} = recordingMarsBot({game});
      game.generation = generation;

      new NirgalEnterprisesMarsBot().beforeActionPhase(marsBot);

      expect(calls).deep.eq(expected);
    });
  }
});
