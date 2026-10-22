import {expect} from 'chai';
import {testGame} from '../../TestGame';
import {SerializedRewindVote} from '../../../src/server/rewind/tableState';
import {
  barUntilNextGeneration,
  EndedVote,
  ENDED_VOTE_SHOWN_MS,
  everyoneAgreed,
  isDue,
  mayRequest,
  voteModel,
  VOTE_EXPIRY_MS,
} from '../../../src/server/rewind/vote/RewindVote';

function vote(requester: string, yes: Array<string>, overrides: Partial<SerializedRewindVote> = {}): SerializedRewindVote {
  return {id: 7, requester, saveId: 12, moveNumber: 5, generation: 2, cards: 'same', yes, status: 'open', expiresAt: 1000 + VOTE_EXPIRY_MS, ...overrides} as SerializedRewindVote;
}

describe('RewindVote', () => {
  it('needs every other player\'s yes', () => {
    for (const count of [2, 3, 4]) {
      const [game, ...players] = testGame(count);
      const [requester, ...others] = players;
      const yes = [requester.id];
      for (const other of others) {
        expect(everyoneAgreed(vote(requester.id, yes), game)).is.false;
        yes.push(other.id);
      }
      expect(everyoneAgreed(vote(requester.id, yes), game)).is.true;
    }
  });

  it('is due at its time, and a rewinding vote never is', () => {
    const open = vote('p1', ['p1']);
    expect(isDue(open, open.expiresAt - 1)).is.false;
    expect(isDue(open, open.expiresAt)).is.true;
    expect(isDue({...open, status: 'rewinding'}, open.expiresAt + VOTE_EXPIRY_MS)).is.false;
  });

  it('shows an ended vote for a minute, then nothing', () => {
    const [game, player1] = testGame(2);
    const ended: EndedVote = {vote: vote(player1.id, [player1.id]), status: 'cancelled', endedAt: 5000};
    expect(voteModel(game, ended, 5000 + ENDED_VOTE_SHOWN_MS - 1)).is.not.undefined;
    expect(voteModel(game, ended, 5000 + ENDED_VOTE_SHOWN_MS)).is.undefined;
    expect(voteModel(game, undefined, 5000)).is.undefined;
  });

  it('lists every player but the requester with their choice', () => {
    const [game, player1, player2] = testGame(3);
    game.rewindVote = vote(player1.id, [player1.id, player2.id], {expiresAt: 9000});
    const model = voteModel(game, undefined, 4000)!;
    const others = game.playersInGenerationOrder.filter((p) => p !== player1);
    expect(others).has.length(2);
    expect(model.requester).eq(player1.color);
    expect(model.status).eq('open');
    expect(model.expiresInMs).eq(5000);
    expect(model.votes).deep.eq(others.map((p) => ({color: p.color, choice: p === player2 ? 'yes' : 'pending'})));
  });

  it('marks the player who said no, and shows no time once ended', () => {
    const [game, player1, player2, player3] = testGame(3);
    const ended: EndedVote = {vote: vote(player1.id, [player1.id, player2.id]), status: 'declined', endedAt: 5000, no: player3.id, reason: 'why'};
    const model = voteModel(game, ended, 6000)!;
    expect(model.status).eq('declined');
    expect(model.expiresInMs).eq(0);
    expect(model.reason).eq('why');
    expect(model.votes.find((v) => v.color === player3.color)!.choice).eq('no');
    expect(model.votes.find((v) => v.color === player2.color)!.choice).eq('yes');
  });

  it('prefers the game\'s own vote over an ended one', () => {
    const [game, player1] = testGame(2);
    game.rewindVote = vote(player1.id, [player1.id], {id: 8});
    const ended: EndedVote = {vote: vote(player1.id, [player1.id], {id: 7}), status: 'expired', endedAt: 5000};
    expect(voteModel(game, ended, 5001)!.voteId).eq(8);
  });

  it('bars a player until the next generation', () => {
    const [game, player1, player2] = testGame(2);
    let limits = barUntilNextGeneration(undefined, game, player1.id);
    expect(mayRequest(limits, game, player1.id)).is.false;
    expect(mayRequest(limits, game, player2.id)).is.true;
    limits = barUntilNextGeneration(limits, game, player2.id);
    expect(limits.players).deep.eq([player1.id, player2.id]);
    expect(barUntilNextGeneration(limits, game, player2.id).players).deep.eq([player1.id, player2.id]);
    expect(mayRequest(undefined, game, player1.id)).is.true;

    game.generation++;
    expect(mayRequest(limits, game, player1.id)).is.true;
    limits = barUntilNextGeneration(limits, game, player2.id);
    expect(limits).deep.eq({generation: game.generation, players: [player2.id]});
    expect(mayRequest(limits, game, player1.id)).is.true;
  });
});
