import {expect} from 'chai';
import {SerializedGame} from '../../src/server/SerializedGame';
import {sameState} from '../../src/server/rewind/stateHash';
import {isTableLocked} from '../../src/server/rewind/tableLock';
import {INVALID_REQUEST_ID} from '../../src/common/app/AppErrorId';
import {LogMessageDataType} from '../../src/common/logs/LogMessageDataType';
import {statusCode} from '../../src/common/http/statusCode';
import {MAX_OXYGEN_LEVEL, MAX_TEMPERATURE} from '../../src/common/constants';
import {Phase} from '../../src/common/Phase';
import {Timer} from '../../src/common/Timer';
import {RewindVotePoll} from '../../src/common/rewind/RewindVoteModel';
import {CONVERT_HEAT, flush, VoteTable} from '../rewind/vote/voteTable';
import {maxOutOceans, setOxygenLevel, setTemperature} from '../TestingUtils';
import {MockResponse} from './HttpMocks';

describe('ApiRewindVote', () => {
  const t = new VoteTable();
  // An earlier move of the second generation.
  let target: number;

  function answer(res: MockResponse): RewindVotePoll {
    expect(res.statusCode, res.content).eq(statusCode.ok);
    return JSON.parse(res.content);
  }

  // Player 2, who is not asked for anything, asks to rewind to `target`.
  async function request(): Promise<number> {
    const poll = answer(await t.post(t.p2.id, {action: 'request', saveId: target, cards: 'same'}));
    expect(poll.vote?.status).eq('open');
    return poll.vote!.voteId;
  }

  // True when `row` holds the moment `saved` holds. The log and the rewinds are left out.
  function holdsMoment(row: SerializedGame, saved: SerializedGame): boolean {
    const {rewinds: _rewinds, ...state} = row;
    return sameState({...state, gameLog: saved.gameLog}, saved);
  }

  beforeEach(async () => {
    await t.start();
    target = (await t.moves()).slice(-2)[0];
  });

  afterEach(() => t.stop());

  it('rewinds the table when the other player agrees, keeping the clocks, unfrozen, naming the requester', async () => {
    // Standing clocks, so the time kept is exact.
    [t.p1, t.p2].forEach((p, i) => {
      p.timer = Timer.deserialize({sumElapsed: 600_000 + i, startedAt: 0, running: false, afterFirstAction: true, lastStoppedAt: 0});
    });
    const saved = structuredClone(t.rows()[target]);
    const before = t.rows().length;
    const voteId = await request();

    const poll = answer(await t.post(t.p1.id, {action: 'yes', voteId}));

    expect(poll.vote?.status).eq('passed');
    const restored = await t.live();
    expect(restored).is.not.eq(t.game);
    expect(t.rows()).has.length(before + 1);
    expect(holdsMoment(t.newest(), saved)).is.true;
    expect(t.newest().rewindVote).is.undefined;
    [t.p1, t.p2].forEach((p, i) => {
      expect(restored.getPlayerById(p.id).timer.serialize().sumElapsed).eq(600_000 + i);
    });
    expect(restored.frozen).is.false;
    const marker = t.newest().gameLog[t.newest().gameLog.length - 1];
    expect(marker.message).eq('${0} rewound the game to generation ${1} after a unanimous vote');
    expect(marker.data[0]).deep.eq({type: LogMessageDataType.PLAYER, value: t.p2.color});
  });

  // Both players pass with Mars terraformed, so the game ends. `target` is the moment before the last pass.
  async function endGame(): Promise<void> {
    maxOutOceans(t.p1);
    setTemperature(t.game, MAX_TEMPERATURE);
    setOxygenLevel(t.game, MAX_OXYGEN_LEVEL);
    t.p1.plants = 0;
    t.p2.plants = 0;
    answer(await t.act(t.p1.id, 'Pass for this generation'));
    target = t.rows().length - 1;
    answer(await t.act(t.p2.id, 'Pass for this generation'));
    await t.game.finishing;
    expect(t.game.phase).eq(Phase.END);
  }

  it('reopens a finished game when everyone agrees', async () => {
    const calls: Array<string> = [];
    for (const method of ['markFinished', 'reopenFinishedGame'] as const) {
      const original = t.db[method].bind(t.db);
      t.db[method] = (gameId) => {
        calls.push(method);
        return original(gameId);
      };
    }
    await endGame();
    expect(calls).deep.eq(['markFinished']);

    const voteId = await request();
    const poll = answer(await t.post(t.p1.id, {action: 'yes', voteId}));

    expect(poll.vote?.status).eq('passed');
    const restored = await t.live();
    expect(restored).is.not.eq(t.game);
    expect(restored.phase).eq(Phase.ACTION);
    expect(calls).deep.eq(['markFinished', 'reopenFinishedGame']);

    answer(await t.act(t.p2.id, 'Pass for this generation'));
    await restored.finishing;
    expect(restored.phase).eq(Phase.END);
    expect(calls).deep.eq(['markFinished', 'reopenFinishedGame', 'markFinished']);
  });

  it('keeps the open vote of a finished game across a reload', async () => {
    await endGame();
    const voteId = await request();
    await flush();

    t.restart();

    const poll = await t.poll(t.p1.id);
    expect(poll.vote?.status).eq('open');
    expect(poll.vote?.voteId).eq(voteId);
    expect(answer(await t.post(t.p1.id, {action: 'yes', voteId})).vote?.status).eq('passed');
    expect((await t.live()).phase).eq(Phase.ACTION);
  });

  it('ends an open vote when anyone moves', async () => {
    await request();

    const rejected = await t.input(t.p1.id, {type: 'or', index: 99, response: {type: 'option'}});
    expect(rejected.statusCode).eq(statusCode.badRequest);
    expect((await t.poll(t.p1.id)).vote?.status).eq('open');

    // The game did not pause for the vote.
    answer(await t.act(t.p1.id, CONVERT_HEAT));

    expect((await t.poll(t.p1.id)).vote?.status).eq('moved-on');
    await flush();
    expect(t.newest().rewindVote).is.undefined;
  });

  it('refuses a move posted while the last yes rewinds the table', async () => {
    const voteId = await request();
    const before = t.rows().length;
    let release = () => {};
    const listed = new Promise<void>((resolve) => release = resolve);
    const getSaveIds = t.db.getSaveIds.bind(t.db);
    t.db.getSaveIds = async (gameId) => {
      await listed;
      return getSaveIds(gameId);
    };

    const yes = t.post(t.p1.id, {action: 'yes', voteId});
    for (let i = 0; i < 100 && t.game.rewindVote?.status !== 'rewinding'; i++) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    // The table was locked in the same step as the last yes.
    expect(isTableLocked(t.game.id)).is.true;
    const move = await t.act(t.p1.id, CONVERT_HEAT);

    expect(move.statusCode).eq(statusCode.badRequest);
    expect(JSON.parse(move.content).id).eq(INVALID_REQUEST_ID);
    expect(t.rows()).has.length(before);

    release();
    expect(answer(await yes).vote?.status).eq('passed');
    expect(t.rows()).has.length(before + 1);
  });

  it('ends the vote with a load_game rollback to a save from before it', async () => {
    await request();
    const timer = t.timers[t.timers.length - 1];

    answer(await t.rollBack(1));

    expect((await t.poll(t.p1.id)).vote).is.undefined;
    expect(t.newest().rewindVote).is.undefined;

    // The replaced game's timer fires once the rolled-back game has written that save again, and writes nothing.
    answer(await t.act(t.p1.id, CONVERT_HEAT));
    await flush();
    const row = structuredClone(t.newest());
    t.clock.millis += timer.ms;
    timer.fn();
    await flush();
    expect(t.newest()).deep.eq(row);
  });

  it('refuses a vote from a stale tab', async () => {
    const stale = await request();
    expect(answer(await t.post(t.p2.id, {action: 'cancel', voteId: stale})).vote?.status).eq('cancelled');
    const voteId = await request();

    const res = await t.post(t.p1.id, {action: 'yes', voteId: stale});

    expect(res.statusCode).eq(statusCode.badRequest);
    expect(res.content).eq('Bad request: This vote has ended.');
    const poll = await t.poll(t.p1.id);
    expect(poll.vote?.voteId).eq(voteId);
    expect(poll.vote?.status).eq('open');
  });

  it('checks the seat password, also once the game has ended', async () => {
    const password = '0123456789ab';
    for (const finished of [false, true]) {
      await t.start({playerPasswords: true});
      target = (await t.moves()).slice(-2)[0];
      t.p2.password = password;
      const poll = answer(await t.post(t.p2.id, {action: 'request', saveId: target, cards: 'same'}, `&password=${password}`));
      if (finished) {
        t.game.phase = Phase.END;
      }
      const label = String(finished);

      expect((await t.get(t.p2.id)).statusCode, label).eq(statusCode.unauthorized);
      expect((await t.post(t.p2.id, {action: 'cancel', voteId: poll.vote!.voteId})).statusCode, label).eq(statusCode.unauthorized);
      expect((await t.poll(t.p1.id)).vote?.status, label).eq('open');

      expect((await t.get(t.p2.id, `&password=${password}`)).statusCode, label).eq(statusCode.ok);
      const cancelled = answer(await t.post(t.p2.id, {action: 'cancel', voteId: poll.vote!.voteId}, `&password=${password}`));
      expect(cancelled.vote?.status, label).eq('cancelled');
    }
  });

  it('refuses a body that is not a vote', async () => {
    const bodies = [
      '{}',
      '{"action":"yes"}',
      '{"action":"request","saveId":-1,"cards":"same"}',
      '{"action":"request","saveId":1.5,"cards":"same"}',
      '{"action":"request","saveId":1,"cards":"maybe"}',
      '{"action":"request","saveId":1,"cards":"same","voteId":1}',
      '{"action":"maybe","voteId":1}',
      '{"action":"no","voteId":"1"}',
      '{"action":"cancel","voteId":1,"saveId":1}',
      '[]',
      'null',
      'not json',
    ];
    for (const body of bodies) {
      const res = await t.post(t.p2.id, body);
      expect(res.statusCode, body).eq(statusCode.badRequest);
      expect(res.content, body).eq('Bad request: invalid vote');
    }
    expect((await t.poll(t.p1.id)).vote).is.undefined;
  });
});
