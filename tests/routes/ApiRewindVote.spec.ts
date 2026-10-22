import {expect} from 'chai';
import {SerializedGame} from '../../src/server/SerializedGame';
import {sameState} from '../../src/server/rewind/stateHash';
import {isTableLocked} from '../../src/server/rewind/tableLock';
import {INVALID_REQUEST_ID} from '../../src/common/app/AppErrorId';
import {LogMessageDataType} from '../../src/common/logs/LogMessageDataType';
import {statusCode} from '../../src/common/http/statusCode';
import {MAX_OXYGEN_LEVEL, MAX_TEMPERATURE} from '../../src/common/constants';
import {Phase} from '../../src/common/Phase';
import {IPlayer} from '../../src/server/IPlayer';
import {Timer} from '../../src/common/Timer';
import {RewindVotePoll} from '../../src/common/rewind/RewindVoteModel';
import {voteService} from '../../src/server/rewind/vote/effects';
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

  // The password query of a seat, which a player claims by moving through the input route in a game with player passwords.
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

  // True when `row` holds the moment `saved` holds. The log and the rewinds are left out.
  function holdsMoment(row: SerializedGame, saved: SerializedGame): boolean {
    const {rewinds: _rewinds, ...state} = row;
    return sameState({...state, gameLog: saved.gameLog}, saved);
  }

  beforeEach(async () => {
    await t.start();
    target = (await t.moves()).slice(-3)[0];
  });

  afterEach(() => t.stop());

  it('rewinds the table when the other player agrees, keeping the requester\'s clock, unfrozen, naming the requester', async () => {
    // Standing clocks, so the time kept is exact.
    [t.p1, t.p2].forEach((p, i) => {
      p.timer = Timer.deserialize({sumElapsed: 600_000 + i, startedAt: 0, running: false, afterFirstAction: true, lastStoppedAt: 0});
    });
    for (const [i, p] of t.rows()[target].players.entries()) {
      p.timer.sumElapsed = 300_000 + i;
    }
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
    // Player 2 asked about their own move and keeps their time. Player 1's clock goes back.
    expect(restored.getPlayerById(t.p2.id).timer.serialize().sumElapsed).eq(600_001);
    expect(restored.getPlayerById(t.p1.id).timer.serialize().sumElapsed).eq(300_000);
    expect(restored.frozen).is.false;
    const marker = t.newest().gameLog[t.newest().gameLog.length - 1];
    expect(marker.message).eq('${0} rewound the game to generation ${1} after a unanimous vote');
    expect(marker.data[0]).deep.eq({type: LogMessageDataType.PLAYER, value: t.p2.color});
  });

  it('refuses a move of another player, and one of unknown player, and opens no vote', async () => {
    const entries = await t.entries();
    // The second generation: player 2's two moves, player 1's move, and the newest save, which nobody has answered.
    expect(entries.slice(-4).map((move) => move.mover)).deep.eq([t.p2.color, t.p2.color, t.p1.color, undefined]);

    for (const [asker, saveId] of [[t.p2, entries[entries.length - 2].saveId], [t.p2, entries[entries.length - 1].saveId], [t.p1, target]] as const) {
      const res = await t.post(asker.id, {action: 'request', saveId, cards: 'same'});

      expect(res.statusCode, String(saveId)).eq(statusCode.badRequest);
      expect(res.content, String(saveId)).eq('Bad request: You can only ask to rewind your own moves.');
      expect(t.newest().rewindVote).is.undefined;
      expect((await t.live()).rewindVote).is.undefined;
    }
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
    await t.start({playerPasswords: true});
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
    const poll = answer(await t.post(t.p1.id, {action: 'yes', voteId}, await seat(t.p1)));

    expect(poll.vote?.status).eq('passed');
    const restored = await t.live();
    expect(restored).is.not.eq(t.game);
    expect(restored.phase).eq(Phase.ACTION);
    expect(calls).deep.eq(['markFinished', 'reopenFinishedGame']);

    answer(await t.act(t.p2.id, 'Pass for this generation', await seat(t.p2)));
    await restored.finishing;
    expect(restored.phase).eq(Phase.END);
    expect(calls).deep.eq(['markFinished', 'reopenFinishedGame', 'markFinished']);
  });

  it('refuses a request for the final position of a finished game, which nobody played from', async () => {
    await endGame();
    const entries = await t.entries();
    const final = entries[entries.length - 1];
    expect(final.mover).is.undefined;

    for (const asker of [t.p1, t.p2]) {
      const res = await t.post(asker.id, {action: 'request', saveId: final.saveId, cards: 'same'});

      expect(res.statusCode).eq(statusCode.badRequest);
      expect(res.content).eq('Bad request: You can only ask to rewind your own moves.');
      expect(t.newest().rewindVote).is.undefined;
      expect((await t.poll(asker.id)).vote).is.undefined;
    }
  });

  it('keeps the open vote of a finished game across a reload', async () => {
    await t.start({playerPasswords: true});
    await endGame();
    const voteId = await request();
    await flush();

    t.restart();

    const poll = await t.poll(t.p1.id, await seat(t.p1));
    expect(poll.vote?.status).eq('open');
    expect(poll.vote?.voteId).eq(voteId);
    expect(answer(await t.post(t.p1.id, {action: 'yes', voteId}, await seat(t.p1))).vote?.status).eq('passed');
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

  it('refuses the last yes from a game object that a rollback replaced', async () => {
    const voteId = await request();
    const stale = t.game;
    answer(await t.rollBack(1));
    const rows = t.rows().length;
    const reloaded = await t.live();
    expect(reloaded).is.not.eq(stale);

    const poll = await voteService.cast(stale, stale.getPlayerById(t.p1.id), voteId, 'yes');

    expect(poll.vote?.status).eq('failed');
    expect(poll.vote?.reason).eq('This game was rewound. Refresh this page.');
    expect(t.rows()).has.length(rows);
    expect(await t.live()).eq(reloaded);
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
      target = (await t.moves()).slice(-3)[0];
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

  it('refuses every vote action on a finished game of a table without player passwords', async () => {
    const voteId = await request();
    t.game.phase = Phase.END;

    for (const body of [
      {action: 'request', saveId: target, cards: 'same'},
      {action: 'yes', voteId},
      {action: 'no', voteId},
      {action: 'cancel', voteId},
    ]) {
      const res = await t.post(t.p1.id, body);
      expect(res.statusCode, body.action).eq(statusCode.badRequest);
      expect(res.content, body.action).eq('Bad request: A finished game can only be rewound at a table with player passwords.');
    }
    expect((await t.poll(t.p1.id)).vote?.status).eq('open');
  });

  it('needs the seat password for every vote action of a finished game', async () => {
    const password = '0123456789ab';
    await t.start({playerPasswords: true});
    target = (await t.moves()).slice(-2)[0];
    t.p1.password = password;
    t.p2.password = password;
    const voteId = answer(await t.post(t.p2.id, {action: 'request', saveId: target, cards: 'same'}, `&password=${password}`)).vote!.voteId;
    t.game.phase = Phase.END;

    for (const body of [
      {action: 'request', saveId: target, cards: 'same'},
      {action: 'yes', voteId},
      {action: 'no', voteId},
      {action: 'cancel', voteId},
    ]) {
      expect((await t.post(t.p1.id, body)).statusCode, body.action).eq(statusCode.unauthorized);
      expect((await t.post(t.p1.id, body, '&password=wrong')).statusCode, body.action).eq(statusCode.unauthorized);
    }
    expect((await t.poll(t.p1.id, `&password=${password}`)).vote?.status).eq('open');
    expect(answer(await t.post(t.p1.id, {action: 'no', voteId}, `&password=${password}`)).vote?.status).eq('declined');
  });

  it('refuses a spectator id and a judge id', async () => {
    await t.start({judgeLink: true});
    for (const id of [t.game.spectatorId, t.game.judgeId!]) {
      for (const res of [await t.get(id), await t.post(id, {action: 'request', saveId: target, cards: 'same'})]) {
        expect(res.statusCode, id).eq(statusCode.badRequest);
        expect(res.content, id).eq('Bad request: invalid player id');
      }
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
