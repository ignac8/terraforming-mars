import {expect} from 'chai';
import {canBrowseHistory, canRewind, canVoteRewind, judgeCanRewind} from '../../src/server/rewind/access';
import {testGame} from '../TestingUtils';

describe('who may rewind a tournament game with Player undo', () => {
  it('lets the players of a judged table vote and the judge rewind', () => {
    const [game, player] = testGame(2, {tournamentExpansion: true, undoOption: true, judgeLink: true, judgeUndo: true});

    expect(canVoteRewind(game, player.id)).is.true;
    expect(canBrowseHistory(game, player.id)).is.true;
    expect(canRewind(game, player.id)).is.false;
    expect(judgeCanRewind(game, game.judgeId!)).is.true;
    expect(canVoteRewind(game, game.judgeId!)).is.false;
  });

  it('lets the solo player rewind, beside a judge', () => {
    const [game, player] = testGame(1, {tournamentExpansion: true, undoOption: true, judgeLink: true, judgeUndo: true});

    expect(canRewind(game, player.id)).is.true;
    expect(canVoteRewind(game, player.id)).is.false;
    expect(judgeCanRewind(game, game.judgeId!)).is.true;
  });

  it('keeps the vote of a table without a judge', () => {
    const [game, player] = testGame(2, {tournamentExpansion: true, undoOption: true});

    expect(canVoteRewind(game, player.id)).is.true;
  });
});
