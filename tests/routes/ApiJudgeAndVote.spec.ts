import {expect} from 'chai';
import {IPlayer} from '../../src/server/IPlayer';
import {freezeGame} from '../../src/server/rewind/freeze';
import {isTableLocked} from '../../src/server/rewind/tableLock';
import {RewindVotePoll} from '../../src/common/rewind/RewindVoteModel';
import {statusCode} from '../../src/common/http/statusCode';
import {flush, VoteTable} from '../rewind/vote/voteTable';
import {MockResponse} from './HttpMocks';

const FROZEN = 'Bad request: The game is frozen, so no rewind can be asked for or answered.';
const RUNNING = 'Bad request: A rewind is already running.';

describe('a judge at a table that votes', () => {
  const t = new VoteTable();
  // An earlier move of the second generation.
  let target: number;

  function answer(res: MockResponse): RewindVotePoll {
    expect(res.statusCode, res.content).eq(statusCode.ok);
    return JSON.parse(res.content);
  }

  async function seat(player: IPlayer): Promise<string> {
    const password = (await t.live()).getPlayerById(player.id).password;
    return password === undefined ? '' : `&password=${password}`;
  }

  // Player 2, who is not asked for anything, asks to rewind to `target`.
  async function request(): Promise<number> {
    const poll = answer(await t.post(t.p2.id, {action: 'request', saveId: target, cards: 'same'}, await seat(t.p2)));
    expect(poll.vote?.status).eq('open');
    return poll.vote!.voteId;
  }

  beforeEach(async () => {
    await t.start({judgeLink: true, judgeUndo: true});
    target = (await t.moves()).slice(-3)[0];
  });

  afterEach(() => t.stop());

  it('ends an open vote when the judge freezes the game, without barring the asker', async () => {
    await request();

    expect((await t.judgeFreeze(true)).statusCode).eq(statusCode.ok);

    const poll = await t.poll(t.p1.id, await seat(t.p1));
    expect(poll.vote?.status).eq('froze');
    // The one patch that saved the freeze saved the end of the vote.
    expect(t.newest().frozen).is.true;
    expect(t.newest().rewindVote).is.undefined;
    expect(t.newest().rewindRequestLimits).is.undefined;

    expect((await t.judgeFreeze(false)).statusCode).eq(statusCode.ok);
    expect((await t.poll(t.p2.id, await seat(t.p2))).mayRequest).is.true;
    await request();
  });

  it('refuses a request while the game is frozen', async () => {
    await t.judgeFreeze(true);

    const res = await t.post(t.p2.id, {action: 'request', saveId: target, cards: 'same'}, await seat(t.p2));

    expect(res.statusCode).eq(statusCode.badRequest);
    expect(res.content).eq(FROZEN);
    expect((await t.live()).rewindVote).is.undefined;
    // Polling is not refused, and it says the request control is off.
    const poll = await t.poll(t.p1.id, await seat(t.p1));
    expect(poll.vote).is.undefined;
    expect(poll.mayRequest).is.false;
  });

  it('refuses a yes and a no while the game is frozen, and lets the asker cancel', async () => {
    const voteId = await request();
    // A frozen game that holds a vote, which a freeze never leaves.
    (await t.live()).frozen = true;

    for (const action of ['yes', 'no'] as const) {
      const res = await t.post(t.p1.id, {action, voteId}, await seat(t.p1));
      expect(res.statusCode, action).eq(statusCode.badRequest);
      expect(res.content, action).eq(FROZEN);
    }
    expect((await t.live()).rewindVote?.status).eq('open');

    expect(answer(await t.post(t.p2.id, {action: 'cancel', voteId}, await seat(t.p2))).vote?.status).eq('cancelled');
  });

  it('ends an open vote when the judge rewinds the game, without barring the asker', async () => {
    await request();
    const rewound = (await t.moves()).slice(-2)[0];

    expect((await t.judgeRewind(rewound)).statusCode).eq(statusCode.ok);

    const live = await t.live();
    expect(live).is.not.eq(t.game);
    expect(t.game.rewindVote).is.undefined;
    expect(live.rewindVote).is.undefined;
    expect(t.newest().rewindVote).is.undefined;
    expect((await t.poll(t.p1.id, await seat(t.p1))).vote?.status).eq('judge-rewound');
    expect(live.rewindRequestLimits).is.undefined;
    // The rewound game is frozen until the judge unfreezes it.
    await t.judgeFreeze(false);
    expect((await t.poll(t.p2.id, await seat(t.p2))).mayRequest).is.true;
  });

  it('refuses a judge freeze or rewind while the last yes rewinds the table', async () => {
    const voteId = await request();
    const stale = t.game;
    let release = () => {};
    const listed = new Promise<void>((resolve) => release = resolve);
    const getSaveIds = t.db.getSaveIds.bind(t.db);
    t.db.getSaveIds = async (gameId) => {
      await listed;
      return getSaveIds(gameId);
    };
    const yes = t.post(t.p1.id, {action: 'yes', voteId}, await seat(t.p1));
    for (let i = 0; i < 100 && stale.rewindVote?.status !== 'rewinding'; i++) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    expect(isTableLocked(stale.id)).is.true;

    const freeze = await t.judgeFreeze(true);
    const rewind = await t.judgeRewind(target);

    for (const res of [freeze, rewind]) {
      expect(res.statusCode).eq(statusCode.badRequest);
      expect(res.content).eq('Bad request: A rewind is already running.');
    }
    expect(stale.frozen).is.false;

    release();
    expect(answer(await yes).vote?.status).eq('passed');
    await flush();
    // The judge's page can still hold the game the vote replaced.
    let refused: unknown;
    await freezeGame(stale).catch((e) => refused = e);
    expect(String(refused)).contains('This game was rewound. Refresh this page.');
    expect((await t.live()).frozen).is.false;
  });

  // The judge rewind has read what it needs and waits for the database, with the table locked.
  async function duringJudgeRewind(act: (voteId: number) => Promise<MockResponse>): Promise<{res: MockResponse, judge: MockResponse}> {
    const voteId = await request();
    const rewound = (await t.moves()).slice(-2)[0];
    let release = () => {};
    const gate = new Promise<void>((resolve) => release = resolve);
    const getSaveIds = t.db.getSaveIds.bind(t.db);
    let blocked = false;
    t.db.getSaveIds = async (gameId) => {
      if (!blocked) {
        blocked = true;
        await gate;
      }
      return getSaveIds(gameId);
    };
    const judge = t.judgeRewind(rewound);
    for (let i = 0; i < 100 && !isTableLocked(t.game.id); i++) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    expect(isTableLocked(t.game.id)).is.true;
    const res = await act(voteId);
    expect(t.game.rewindVote?.status, 'the vote is as it was').eq('open');
    release();
    return {res, judge: await judge};
  }

  it('leaves the vote alone for an answer or a cancel while the judge rewinds, and the rewind then ends it', async () => {
    const p1 = await seat(t.p1);
    const p2 = await seat(t.p2);
    for (const [label, act] of [
      ['yes', (voteId: number) => t.post(t.p1.id, {action: 'yes', voteId}, p1)],
      ['no', (voteId: number) => t.post(t.p1.id, {action: 'no', voteId}, p1)],
      ['cancel', (voteId: number) => t.post(t.p2.id, {action: 'cancel', voteId}, p2)],
    ] as const) {
      await t.start({judgeLink: true, judgeUndo: true});
      target = (await t.moves()).slice(-3)[0];

      const {res, judge} = await duringJudgeRewind(act);

      expect(res.statusCode, label).eq(statusCode.badRequest);
      expect(res.content, label).eq(RUNNING);
      expect(judge.statusCode, label).eq(statusCode.ok);
      const live = await t.live();
      expect(live.rewindRequestLimits, label).is.undefined;
      expect((await t.poll(t.p2.id, await seat(t.p2))).vote?.status, label).eq('judge-rewound');
    }
  });

  it('refuses a request while the judge rewinds', async () => {
    const rewound = (await t.moves()).slice(-2)[0];
    let release = () => {};
    const gate = new Promise<void>((resolve) => release = resolve);
    const getSaveIds = t.db.getSaveIds.bind(t.db);
    t.db.getSaveIds = async (gameId) => {
      await gate;
      return getSaveIds(gameId);
    };
    const judge = t.judgeRewind(rewound);
    for (let i = 0; i < 100 && !isTableLocked(t.game.id); i++) {
      await new Promise((resolve) => setImmediate(resolve));
    }

    const res = await t.post(t.p2.id, {action: 'request', saveId: target, cards: 'same'}, await seat(t.p2));

    expect(res.statusCode).eq(statusCode.badRequest);
    expect(res.content).eq(RUNNING);
    expect(t.game.rewindVote).is.undefined;
    release();
    expect((await judge).statusCode).eq(statusCode.ok);
    expect((await t.live()).rewindVote).is.undefined;
  });
});
