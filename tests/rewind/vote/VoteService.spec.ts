import {expect} from 'chai';
import {Game} from '../../../src/server/Game';
import {IGame} from '../../../src/server/IGame';
import {IPlayer} from '../../../src/server/IPlayer';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {SelectInitialCards} from '../../../src/server/inputs/SelectInitialCards';
import {SelectSpace} from '../../../src/server/inputs/SelectSpace';
import {clearReplayCache, getReplayMoves} from '../../../src/server/replay/ReplayService';
import {RouteError} from '../../../src/server/routes/RouteError';
import {RESTARTED_BEFORE_REWIND, VoteEffects, VoteService, voteMetrics} from '../../../src/server/rewind/vote/VoteService';
import {VOTE_EXPIRY_MS} from '../../../src/server/rewind/vote/RewindVote';
import {RewindCards} from '../../../src/common/replay/ReplayModel';
import {RewindVotePoll} from '../../../src/common/rewind/RewindVoteModel';
import {cast} from '../../../src/common/utils/utils';
import {restoreTestDatabase, setTestDatabase} from '../../testing/setup';
import {SnapshotDatabase} from '../../testing/SnapshotDatabase';
import {FakeClock} from '../../common/FakeClock';
import {TestPlayer} from '../../TestPlayer';
import {testGame} from '../../TestingUtils';

const UNLOADABLE = 'That moment can\'t be restored with this version of the game. Nothing was changed.';
const GENERIC = 'That moment can\'t be restored. Nothing was changed.';

type Timer = {fn: () => void, ms: number, cancelled: boolean};
type Snapshot = {rewindVote: IGame['rewindVote'], limits: IGame['rewindRequestLimits']};

describe('VoteService', () => {
  let db: SnapshotDatabase;
  let game: IGame;
  let p1: TestPlayer;
  let p2: TestPlayer;
  let p3: TestPlayer;
  let clock: FakeClock;
  let service: VoteService;
  let saveId: number;

  // What the fake effects saw.
  let persists: Array<Snapshot>;
  let rewinds: Array<{game: IGame, saveId: number, cards: RewindCards, requester: IPlayer, persistsBefore: number}>;
  let timers: Array<Timer>;
  let live: boolean;
  let failPersist: boolean;
  // While set, the rewind waits for it; it settles the rewind with the outcome it is given.
  let hold: boolean;
  let settleRewind: (outcome: {error: unknown} | {restored: IGame}) => void;
  let rewindError: unknown;
  let restored: IGame;

  const originalLog = console.log;
  const originalWarn = console.warn;
  let logs: Array<string>;

  // Converts plants into a greenery, an action that saves the game when the next one is taken.
  function act(who: TestPlayer) {
    who.plants = 8;
    who.popWaitingFor();
    who.takeAction();
    const action = cast(who.getWaitingFor(), OrOptions);
    const index = action.options.findIndex((option) => option instanceof SelectSpace);
    const select = cast(action.options[index], SelectSpace);
    who.process({type: 'or', index, response: {type: 'space', spaceId: select.spaces[0].id}});
  }

  const flush = () => new Promise((resolve) => setImmediate(resolve));

  async function outcomes(outcome: string): Promise<number> {
    return (await voteMetrics.votes.get()).values.find((v) => v.labels.outcome === outcome)?.value ?? 0;
  }

  async function refusal(promise: Promise<unknown>): Promise<RouteError> {
    try {
      await promise;
    } catch (e) {
      return cast(e, RouteError);
    }
    throw new Error('Not refused');
  }

  function status(g: IGame, player: IPlayer): string | undefined {
    return service.poll(g, player).vote?.status;
  }

  function newEffects(): VoteEffects {
    return {
      rewind: async (g, id, cards, requester) => {
        rewinds.push({game: g, saveId: id, cards, requester, persistsBefore: persists.length});
        if (hold) {
          const outcome = await new Promise<{error: unknown} | {restored: IGame}>((resolve) => {
            settleRewind = resolve;
          });
          if ('error' in outcome) {
            throw outcome.error;
          }
          return outcome.restored;
        }
        if (rewindError !== undefined) {
          throw rewindError;
        }
        return restored;
      },
      persist: async (g) => {
        if (failPersist) {
          throw new Error('write failed');
        }
        persists.push(structuredClone({rewindVote: g.rewindVote, limits: g.rewindRequestLimits}));
      },
      isLive: async () => live,
      schedule: (fn, ms) => {
        const timer = {fn, ms, cancelled: false};
        timers.push(timer);
        return {cancel: () => {
          timer.cancelled = true;
        }};
      },
    };
  }

  beforeEach(async () => {
    logs = [];
    console.log = (...args: Array<unknown>) => {
      logs.push(args.join(' '));
    };
    console.warn = () => {};
    db = new SnapshotDatabase();
    setTestDatabase(db);
    clearReplayCache();
    persists = [];
    rewinds = [];
    timers = [];
    live = true;
    failPersist = false;
    hold = false;
    rewindError = undefined;
    clock = new FakeClock();
    clock.millis = 1_000_000;
    service = new VoteService(newEffects(), clock);
    service.resetForTesting();
    [game, p1, p2, p3] = testGame(3, {undoOption: true});
    act(p1);
    act(p1);
    act(p1);
    const history = await getReplayMoves(game, p2.id);
    if (history.status !== 'available') {
      throw new Error('No history');
    }
    saveId = history.moves[1].saveId;
    restored = Object.create(game);
    restored.undoCount = game.undoCount + 1;
    restored.rewindVote = undefined;
  });

  afterEach(() => {
    service.resetForTesting();
    console.log = originalLog;
    console.warn = originalWarn;
    restoreTestDatabase();
    clearReplayCache();
  });

  it('opens a vote and counts the requester as yes', async () => {
    // The vote is about the generation the move was made in.
    game.generation = 2;
    const poll = await service.request(game, p2, saveId, 'same');

    expect(poll.vote).deep.include({status: 'open', requester: p2.color, saveId, cards: 'same', moveNumber: 2, generation: 1, expiresInMs: VOTE_EXPIRY_MS});
    expect(poll.vote!.votes).deep.eq([{color: p1.color, choice: 'pending'}, {color: p3.color, choice: 'pending'}]);
    expect(game.rewindVote!.yes).deep.eq([p2.id]);
    expect(persists).has.length(1);
    expect(timers.map((t) => t.ms)).deep.eq([VOTE_EXPIRY_MS]);
  });

  it('refuses a second request, also one that started before the first opened', async () => {
    const results = await Promise.allSettled([service.request(game, p2, saveId, 'same'), service.request(game, p3, saveId, 'same')]);

    expect(results.map((r) => r.status).sort()).deep.eq(['fulfilled', 'rejected']);
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason.detail).eq('A rewind vote is already open.');
    expect(persists).has.length(1);
  });

  it('rewinds with the requester\'s cards once every other player agrees', async () => {
    const opened = await service.request(game, p2, saveId, 'shuffle');
    const first = await service.cast(game, p1, opened.vote!.voteId, 'yes');
    await service.cast(game, p1, opened.vote!.voteId, 'yes');
    expect(first.vote!.status).eq('open');
    expect(game.rewindVote!.yes).deep.eq([p2.id, p1.id]);
    expect(rewinds).is.empty;

    const poll = await service.cast(game, p3, opened.vote!.voteId, 'yes');

    expect(rewinds).has.length(1);
    expect(rewinds[0]).deep.include({game, saveId, cards: 'shuffle', requester: p2});
    expect(poll.undoCount).eq(game.undoCount + 1);
    expect(poll.vote!.status).eq('passed');
    expect(await outcomes('passed')).eq(1);
  });

  it('starts the rewind once when the last two yes votes arrive together', async () => {
    const opened = await service.request(game, p2, saveId, 'same');

    const polls = await Promise.all([service.cast(game, p1, opened.vote!.voteId, 'yes'), service.cast(game, p3, opened.vote!.voteId, 'yes')]);

    expect(rewinds).has.length(1);
    expect(polls.some((poll) => poll.vote!.status === 'passed')).is.true;
  });

  it('starts the rewind in the same step as the last yes', async () => {
    const opened = await service.request(game, p2, saveId, 'same');
    await service.cast(game, p1, opened.vote!.voteId, 'yes');
    const written = persists.length;

    await service.cast(game, p3, opened.vote!.voteId, 'yes');

    expect(rewinds[0].persistsBefore).eq(written);
  });

  it('ends an open vote on a move, and leaves a rewinding one alone', async () => {
    await service.request(game, p2, saveId, 'same');
    act(p1);
    await flush();
    expect(status(game, p2)).eq('moved-on');
    expect(service.poll(game, p2).mayRequest).is.true;
    expect(game.rewindVote).is.undefined;

    hold = true;
    const opened = await service.request(game, p2, saveId, 'same');
    await service.cast(game, p1, opened.vote!.voteId, 'yes');
    const last = service.cast(game, p3, opened.vote!.voteId, 'yes');
    await flush();
    expect(status(game, p2)).eq('rewinding');
    act(p1);
    await flush();
    expect(status(game, p2)).eq('rewinding');
    settleRewind({restored});
    expect((await last).vote!.status).eq('passed');
  });

  it('bars the requester until the next generation after a no or the time running out, and not after a cancel or a move', async () => {
    const ends = {
      no: async (id: number) => service.cast(game, p1, id, 'no'),
      expiry: async () => {
        clock.millis += VOTE_EXPIRY_MS;
        timers[timers.length - 1].fn();
        await flush();
      },
      cancel: async (id: number) => service.cancel(game, p2, id),
      move: async () => {
        act(p1);
        await flush();
      },
    };
    const outcome = {no: 'declined', expiry: 'expired', cancel: 'cancelled', move: 'moved-on'};
    for (const end of ['no', 'expiry', 'cancel', 'move'] as const) {
      const before = await outcomes(outcome[end]);
      const opened = await service.request(game, p2, saveId, 'same');
      await ends[end](opened.vote!.voteId);

      const barred = end === 'no' || end === 'expiry';
      expect(service.poll(game, p2).mayRequest, end).eq(!barred);
      expect(service.poll(game, p3).mayRequest, end).is.true;
      expect(await outcomes(outcome[end]), end).eq(before + 1);
      expect(timers.every((t) => t.cancelled), end).is.true;
      if (barred) {
        expect((await refusal(service.request(game, p2, saveId, 'same'))).detail).eq('You can ask again next generation.');
        game.generation++;
      }
      const again = await service.request(game, p2, saveId, 'same');
      expect(again.vote!.status, end).eq('open');
      await service.cancel(game, p2, again.vote!.voteId);
    }
  });

  it('ends as failed with the refusal text when the rewind is refused', async () => {
    const runs: Array<{error: unknown, reason: string}> = [
      {error: RouteError.badRequest(UNLOADABLE), reason: UNLOADABLE},
      {error: RouteError.badRequest('This game was rewound too many times.'), reason: 'This game was rewound too many times.'},
      {error: new Error('boom'), reason: GENERIC},
    ];
    for (const run of runs) {
      rewindError = run.error;
      const before = await outcomes('failed');
      const opened = await service.request(game, p2, saveId, 'same');
      await service.cast(game, p1, opened.vote!.voteId, 'yes');
      const poll = await service.cast(game, p3, opened.vote!.voteId, 'yes');

      expect(poll.vote, run.reason).deep.include({status: 'failed', reason: run.reason});
      expect(poll.mayRequest).is.true;
      expect(persists[persists.length - 1].rewindVote).is.undefined;
      expect(await outcomes('failed')).eq(before + 1);
    }
  });

  it('refuses a cancel or a no and ignores the expiry while the rewind runs', async () => {
    hold = true;
    const opened = await service.request(game, p2, saveId, 'same');
    const id = opened.vote!.voteId;
    await service.cast(game, p1, id, 'yes');
    const last = service.cast(game, p3, id, 'yes');
    await flush();

    expect((await refusal(service.cancel(game, p2, id))).detail).eq('A rewind is already running.');
    expect((await refusal(service.cast(game, p1, id, 'no'))).detail).eq('A rewind is already running.');
    clock.millis += VOTE_EXPIRY_MS * 2;
    expect(status(game, p2)).eq('rewinding');
    expect(game.rewindRequestLimits).is.undefined;
    settleRewind({restored});
    await last;
  });

  it('refuses votes for an ended vote, and the requester\'s own', async () => {
    const opened = await service.request(game, p2, saveId, 'same');
    const id = opened.vote!.voteId;
    expect((await refusal(service.cast(game, p2, id, 'yes'))).detail).eq('You asked for this rewind. You can cancel it.');
    expect((await refusal(service.cancel(game, p1, id))).kind).eq('forbidden');
    await service.cancel(game, p2, id);

    expect((await refusal(service.cast(game, p1, id, 'yes'))).detail).eq('This vote has ended.');
    expect((await refusal(service.cancel(game, p2, id))).detail).eq('This vote has ended.');
    const next = await service.request(game, p2, saveId, 'same');
    expect((await refusal(service.cast(game, p1, id, 'yes'))).detail).eq('This vote has ended.');
    expect(next.vote!.voteId).not.eq(id);
  });

  it('lets only players of a multiplayer game with player undo and without judge undo ask', async () => {
    const runs = [
      {players: 3, options: {undoOption: false}},
      {players: 1, options: {undoOption: true}},
      {players: 3, options: {undoOption: true, judgeLink: true, judgeUndo: true}},
    ];
    for (const run of runs) {
      const [g, p] = testGame(run.players, run.options, '-other');
      act(p);
      expect((await refusal(service.request(g, p, saveId, 'same'))).kind, JSON.stringify(run)).eq('forbidden');
    }
  });

  it('refuses a move that is not in the history', async () => {
    const error = await refusal(service.request(game, p2, 9999, 'same'));

    expect(error.kind).eq('notFound');
    expect(error.detail).eq('That move is not in this game\'s history.');
    expect(game.rewindVote).is.undefined;
  });

  it('refuses a request on a game that was rewound', async () => {
    game.retired = true;

    expect((await refusal(service.request(game, p2, saveId, 'same'))).detail).eq('This game was rewound. Refresh this page.');
  });

  it('writes every change of the vote', async () => {
    const opened = await service.request(game, p2, saveId, 'same');
    const id = opened.vote!.voteId;
    expect(persists.map((s) => s.rewindVote?.yes.length)).deep.eq([1]);

    await service.cast(game, p1, id, 'yes');
    expect(persists.map((s) => s.rewindVote?.yes.length)).deep.eq([1, 2]);

    hold = true;
    const last = service.cast(game, p3, id, 'yes');
    await flush();
    expect(persists.map((s) => s.rewindVote?.status)).deep.eq(['open', 'open', 'rewinding']);
    settleRewind({restored});
    await last;

    persists = [];
    const second = await service.request(game, p2, saveId, 'same');
    await service.cast(game, p1, second.vote!.voteId, 'no');
    expect(persists[persists.length - 1]).deep.eq({rewindVote: undefined, limits: {generation: game.generation, players: [p2.id]}});
    expect(service.poll(game, p2).vote).deep.include({status: 'declined'});
    expect(service.poll(game, p2).vote!.votes).deep.eq([{color: p1.color, choice: 'no'}, {color: p3.color, choice: 'pending'}]);

    game.generation++;
    persists = [];
    await service.request(game, p3, saveId, 'same');
    act(p1);
    await flush();
    expect(persists.map((s) => s.rewindVote?.status)).deep.eq(['open', undefined]);
  });

  it('takes an opened vote back when it can\'t be written', async () => {
    failPersist = true;

    expect((await refusal(service.request(game, p2, saveId, 'same'))).detail).eq('That didn\'t work. Try again.');

    expect(game.rewindVote).is.undefined;
    expect(timers.every((t) => t.cancelled)).is.true;
  });

  it('keeps a change in memory when it can\'t be written, and the next write carries it', async () => {
    const opened = await service.request(game, p2, saveId, 'same');
    failPersist = true;
    await service.cast(game, p1, opened.vote!.voteId, 'yes');
    expect(game.rewindVote!.yes).deep.eq([p2.id, p1.id]);

    failPersist = false;
    await service.cancel(game, p2, opened.vote!.voteId);
    expect(persists[persists.length - 1].rewindVote).is.undefined;
  });

  it('writes one line for operators when a vote expires', async () => {
    const opened = await service.request(game, p2, saveId, 'same');
    clock.millis += VOTE_EXPIRY_MS;
    timers[0].fn();
    await flush();

    expect(logs).includes(`rewind vote ${opened.vote!.voteId} of ${game.id} expired`);
  });

  it('settles an overdue vote first in every method, before any timer has fired', async () => {
    const methods = {
      poll: async () => {
        service.poll(game, p3);
      },
      cast: async (id: number) => {
        await refusal(service.cast(game, p1, id, 'yes'));
      },
      cancel: async (id: number) => {
        await refusal(service.cancel(game, p2, id));
      },
      request: async () => {
        await service.request(game, p3, saveId, 'same');
      },
    };
    for (const [name, call] of Object.entries(methods)) {
      service.resetForTesting();
      game.rewindVote = undefined;
      game.rewindRequestLimits = undefined;
      const opened = await service.request(game, p2, saveId, 'same');
      clock.millis += VOTE_EXPIRY_MS;

      await call(opened.vote!.voteId);

      expect(game.rewindRequestLimits?.players, name).deep.eq([p2.id]);
      expect(game.rewindVote?.requester === p2.id, name).is.false;
      expect(logs, name).includes(`rewind vote ${opened.vote!.voteId} of ${game.id} expired`);
    }
  });

  it('arms the timer again when it fires before the vote is due', async () => {
    await service.request(game, p2, saveId, 'same');
    clock.millis += VOTE_EXPIRY_MS - 5;

    timers[0].fn();
    await flush();

    expect(status(game, p2)).eq('open');
    expect(timers.map((t) => t.ms)).deep.eq([VOTE_EXPIRY_MS, 5]);
  });

  it('picks a restored vote up where the deadline says', async () => {
    const runs = [
      {status: 'open' as const, expiresIn: -1, result: 'expired', barred: true, writes: 1},
      {status: 'open' as const, expiresIn: 30_000, result: 'open', barred: false, writes: 0},
      {status: 'rewinding' as const, expiresIn: 30_000, result: 'failed', barred: false, writes: 1},
    ];
    for (const run of runs) {
      persists = [];
      timers = [];
      game.rewindRequestLimits = undefined;
      game.rewindVote = {id: 5, requester: p2.id, saveId, moveNumber: 2, generation: game.generation, cards: 'same', yes: [p2.id], status: run.status, expiresAt: clock.now() + run.expiresIn};

      await service.resume(game);

      const poll: RewindVotePoll = service.poll(game, p2);
      expect(poll.vote!.status, run.result).eq(run.result);
      expect(persists, run.result).has.length(run.writes);
      expect(poll.mayRequest, run.result).eq(!run.barred);
      if (run.result === 'failed') {
        expect(poll.vote!.reason).eq(RESTARTED_BEFORE_REWIND);
      }
      if (run.result === 'open') {
        expect(timers.map((t) => t.ms)).deep.eq([30_000]);
        clock.millis += 30_000;
        timers[0].fn();
        await flush();
        expect(status(game, p2)).eq('expired');
        expect(service.poll(game, p2).mayRequest).is.false;
      }
    }
  });

  it('ends a restored vote on a move', async () => {
    game.rewindVote = {id: 5, requester: p2.id, saveId, moveNumber: 2, generation: game.generation, cards: 'same', yes: [p2.id], status: 'open', expiresAt: clock.now() + 30_000};
    await service.resume(game);

    act(p1);
    await flush();

    expect(status(game, p2)).eq('moved-on');
  });

  it('issues vote ids above a restored one', async () => {
    const restoredId = Date.now() + 10_000_000;
    game.rewindVote = {id: restoredId, requester: p2.id, saveId, moveNumber: 2, generation: game.generation, cards: 'same', yes: [p2.id], status: 'open', expiresAt: clock.now() + 30_000};
    await service.resume(game);
    await service.cancel(game, p2, restoredId);

    const opened = await service.request(game, p2, saveId, 'same');

    expect(opened.vote!.voteId).greaterThan(restoredId);
  });

  it('ends a vote opened on an object loaded from the database when a move is made', async () => {
    const rows = db.games.get(game.id)!;
    const loaded = Game.deserialize(structuredClone(rows[rows.length - 1]!));
    const [asker] = loaded.players.filter((p) => p.id === p2.id);
    await service.request(loaded, asker, saveId, 'same');
    expect(status(loaded, asker)).eq('open');

    // A game loaded mid-play asks everyone for their initial cards again. Any accepted answer is a move.
    const mover = loaded.activePlayer;
    const initial = cast(mover.getWaitingFor(), SelectInitialCards);
    const responses = initial.options.map((option) => {
      const select = cast(option, SelectCard);
      return {type: 'card' as const, cards: select.cards.slice(0, select.config.min).map((card) => card.name)};
    });
    mover.process({type: 'initialCards', responses});
    await flush();

    expect(status(loaded, asker)).eq('moved-on');
    expect(loaded.rewindVote).is.undefined;
  });

  it('does nothing for an object the loader no longer serves', async () => {
    const opened = await service.request(game, p2, saveId, 'same');
    persists = [];
    live = false;
    clock.millis += VOTE_EXPIRY_MS;

    timers[0].fn();
    await flush();
    await service.resume(game);

    expect(game.rewindVote!.status).eq('open');
    expect(game.rewindVote!.id).eq(opened.vote!.voteId);
    expect(persists).is.empty;

    // A move still ends the vote in memory, but the object has no row to write.
    act(p1);
    await flush();
    expect(game.rewindVote).is.undefined;
    expect(persists).is.empty;
  });

  it('forgets its memory on request', async () => {
    const opened = await service.request(game, p2, saveId, 'same');
    await service.cancel(game, p2, opened.vote!.voteId);
    expect(status(game, p2)).eq('cancelled');

    service.resetForTesting();

    expect(status(game, p2)).is.undefined;
  });
});
