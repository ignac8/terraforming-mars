import {expect} from 'chai';
import {canBrowseHistory, canRewind, canVoteRewind} from '../../src/server/rewind/access';
import {Phase} from '../../src/common/Phase';
import {testGame} from '../TestingUtils';

describe('who may rewind a game with Player undo', () => {
  it('lets the players of a multiplayer game vote, and browse its history', () => {
    const [game, player] = testGame(2, {undoOption: true});

    expect(canVoteRewind(game, player.id)).is.true;
    expect(canBrowseHistory(game, player.id)).is.true;
    expect(canRewind(game, player.id)).is.false;
  });

  it('lets the solo player rewind, and not vote', () => {
    const [game, player] = testGame(1, {undoOption: true});

    expect(canRewind(game, player.id)).is.true;
    expect(canVoteRewind(game, player.id)).is.false;
    expect(canBrowseHistory(game, player.id)).is.true;
  });

  it('lets nobody rewind a game without Player undo', () => {
    for (const players of [1, 2]) {
      const [game, player] = testGame(players, {undoOption: false});

      expect(canRewind(game, player.id), `${players} players`).is.false;
      expect(canVoteRewind(game, player.id), `${players} players`).is.false;
      expect(canBrowseHistory(game, player.id), `${players} players`).is.false;
    }
  });

  it('does not let a spectator rewind or browse the history', () => {
    const [game] = testGame(2, {undoOption: true});

    expect(canRewind(game, game.spectatorId!)).is.false;
    expect(canVoteRewind(game, game.spectatorId!)).is.false;
    expect(canBrowseHistory(game, game.spectatorId!)).is.false;
  });

  it('no longer lets the players of a finished multiplayer game vote', () => {
    const [game, player] = testGame(2, {undoOption: true});
    game.phase = Phase.END;

    expect(canVoteRewind(game, player.id)).is.false;
    expect(canBrowseHistory(game, player.id)).is.false;
  });

  it('still lets the solo player rewind a finished game', () => {
    const [game, player] = testGame(1, {undoOption: true});
    game.phase = Phase.END;

    expect(canRewind(game, player.id)).is.true;
    expect(canVoteRewind(game, player.id)).is.false;
    expect(canBrowseHistory(game, player.id)).is.true;
  });
});
