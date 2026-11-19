import {expect} from 'chai';
import {BoardName} from '@/common/boards/BoardName';
import {TerralabsResearchMarsBot} from '@/server/automa/corps/turmoil/TerralabsResearchMarsBot';
import {testGame} from '../../../TestGame';
import {recordingMarsBot} from '../RecordingMarsBot';

describe('TerralabsResearchMarsBot', () => {
  it('setup takes 8 TR off MarsBot', () => {
    const {marsBot, calls} = recordingMarsBot();

    new TerralabsResearchMarsBot().setup(marsBot);

    expect(calls).deep.eq(['raiseTR(-8)']);
  });

  for (const run of [
    {boardName: BoardName.THARSIS, generation: 8, count: 1},
    {boardName: BoardName.THARSIS, generation: 9, count: 2},
    {boardName: BoardName.AMAZONIS_PLANITIA, generation: 9, count: 1},
    {boardName: BoardName.AMAZONIS_PLANITIA, generation: 10, count: 2},
  ]) {
    it(`draws ${run.count} card(s) to the action deck in generation ${run.generation} on ${run.boardName}`, () => {
      const [game] = testGame(1, {boardName: run.boardName});
      const {marsBot, calls} = recordingMarsBot({game});
      game.generation = run.generation;

      new TerralabsResearchMarsBot().beforeActionPhase(marsBot);

      expect(calls).deep.eq([`drawProjectCardsToActionDeck(${run.count})`]);
    });
  }
});
