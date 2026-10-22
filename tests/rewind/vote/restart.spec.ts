import {expect} from 'chai';
import {loadReplayState} from '../../../src/server/replay/ReplayService';
import {RESTARTED_BEFORE_REWIND} from '../../../src/server/rewind/vote/VoteService';
import {VOTE_EXPIRY_MS} from '../../../src/server/rewind/vote/RewindVote';
import {statusCode} from '../../../src/common/http/statusCode';
import {RewindVotePoll} from '../../../src/common/rewind/RewindVoteModel';
import {MockResponse} from '../../routes/HttpMocks';
import {CONVERT_HEAT, flush, VoteTable} from './voteTable';

describe('rewind vote across a restart', () => {
  const t = new VoteTable();
  // An earlier move of the second generation.
  let target: number;

  function answer(res: MockResponse): RewindVotePoll {
    expect(res.statusCode, res.content).eq(statusCode.ok);
    return JSON.parse(res.content);
  }

  // Player 2, who is not asked for anything, asks to rewind to `saveId`.
  async function request(saveId = target): Promise<number> {
    const poll = answer(await t.post(t.p2.id, {action: 'request', saveId, cards: 'same'}));
    expect(poll.vote?.status).eq('open');
    return poll.vote!.voteId;
  }

  beforeEach(async () => {
    await t.start();
    target = (await t.moves()).slice(-3)[0];
  });

  afterEach(() => t.stop());

  it('brings an open vote back after a restart', async () => {
    const voteId = await request();
    t.clock.millis += 20_000;
    t.restart();
    const armed = t.timers.length;

    const poll = await t.poll(t.p1.id);
    expect(poll.vote?.voteId).eq(voteId);
    expect(poll.vote?.status).eq('open');
    expect(poll.vote?.expiresInMs).eq(VOTE_EXPIRY_MS - 20_000);

    // Its timer runs again, and ends it on time.
    expect(t.timers).has.length(armed + 1);
    const timer = t.timers[armed];
    expect(timer.ms).eq(VOTE_EXPIRY_MS - 20_000);
    t.clock.millis += timer.ms;
    timer.fn();
    await flush();
    expect((await t.poll(t.p1.id)).vote?.status).eq('expired');
  });

  it('expires a vote whose deadline passed while the server was down, and bars its requester', async () => {
    await request();
    t.restart();
    t.clock.millis += VOTE_EXPIRY_MS;

    // The first request loads the game, whichever route it is for.
    await t.live();

    expect(t.newest().rewindVote).is.undefined;
    expect(t.newest().rewindRequestLimits?.players).deep.eq([t.p2.id]);
    const poll = await t.poll(t.p2.id);
    expect(poll.vote?.status).eq('expired');
    expect(poll.mayRequest).is.false;
  });

  it('passes or declines a vote with the first request after a restart', async () => {
    for (const choice of ['yes', 'no'] as const) {
      await t.start();
      target = (await t.moves()).slice(-3)[0];
      const voteId = await request();
      const before = t.rows().length;
      t.restart();

      // Player 1's vote is the request that loads the game.
      const poll = answer(await t.post(t.p1.id, {action: choice, voteId}));

      if (choice === 'yes') {
        expect(poll.vote?.status).eq('passed');
        expect(t.rows()).has.length(before + 1);
      } else {
        expect(poll.vote?.status).eq('declined');
        expect((await t.poll(t.p2.id)).mayRequest).is.false;
        expect(t.rows()).has.length(before);
      }
    }

    await t.start();
    target = (await t.moves()).slice(-3)[0];
    const voteId = await request();
    t.restart();
    t.clock.millis += VOTE_EXPIRY_MS;

    const res = await t.post(t.p1.id, {action: 'yes', voteId});

    expect(res.statusCode).eq(statusCode.badRequest);
    expect(res.content).eq('Bad request: This vote has ended.');
  });

  it('ends a restored vote on the first move after a restart', async () => {
    await request();
    t.restart();

    // Player 1's move is the request that loads the game.
    answer(await t.act(t.p1.id, CONVERT_HEAT));

    expect((await t.poll(t.p1.id)).vote?.status).eq('moved-on');
    await flush();
    expect(t.newest().rewindVote).is.undefined;
  });

  it('fails a vote whose rewind never ran before a restart', async () => {
    const voteId = await request();
    const before = t.rows().length;
    // The process dies while the rewind waits for a read.
    let fail = (_e: Error) => {};
    const dead = new Promise<never>((_resolve, reject) => fail = reject);
    let reached = false;
    t.db.getSaveIds = () => {
      reached = true;
      return dead;
    };
    const yes = t.post(t.p1.id, {action: 'yes', voteId});
    for (let i = 0; i < 100 && !(reached && t.newest().rewindVote?.status === 'rewinding'); i++) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    expect(reached).is.true;
    expect(t.newest().rewindVote?.status).eq('rewinding');

    try {
      t.restart();

      const poll = await t.poll(t.p1.id);

      expect(poll.vote?.status).eq('failed');
      expect(poll.vote?.reason).eq(RESTARTED_BEFORE_REWIND);
      expect(t.newest().rewindVote).is.undefined;
      expect(t.rows()).has.length(before);
    } finally {
      // The old process's rewind fails, and its game object, no longer served, writes nothing.
      fail(new Error('the process died'));
      await yes;
    }
    expect(t.rows()).has.length(before);
  });

  it('keeps a player barred across a restart until the next generation', async () => {
    const voteId = await request();
    answer(await t.post(t.p1.id, {action: 'no', voteId}));
    t.restart();

    const res = await t.post(t.p2.id, {action: 'request', saveId: target, cards: 'same'});

    expect(res.statusCode).eq(statusCode.badRequest);
    expect(res.content).eq('Bad request: You can ask again next generation.');
  });

  it('never shows a vote in a past moment', async () => {
    // The vote is in the newest save.
    const newest = t.rows().length - 1;
    const voteId = await request();
    expect(t.newest().rewindVote?.id).eq(voteId);

    const past = await loadReplayState(t.game, newest);
    expect(past.rewindVote).is.undefined;

    expect(answer(await t.post(t.p1.id, {action: 'yes', voteId})).vote?.status).eq('passed');
    const restored = await t.live();
    expect(restored.rewindVote).is.undefined;
    expect(t.newest().rewindVote).is.undefined;
  });
});
