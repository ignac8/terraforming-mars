import prometheus from '@prometheus-io/client';
import {IGame} from '../../IGame';
import {IPlayer} from '../../IPlayer';
import {Database} from '../../database/Database';
import {getReplayMoves} from '../../replay/ReplayService';
import {RouteError} from '../../routes/RouteError';
import {canVoteRewind} from '../access';
import {isTableLocked} from '../tableLock';
import {SerializedRewindVote} from '../tableState';
import {
  barUntilNextGeneration,
  EndedVote,
  everyoneAgreed,
  isDue,
  mayRequest,
  requestBlock,
  voteModel,
  ENDED_VOTE_SHOWN_MS,
  VOTE_EXPIRY_MS,
} from './RewindVote';
import {Clock} from '../../../common/Timer';
import {GameId, PlayerId} from '../../../common/Types';
import {RewindCards} from '../../../common/replay/ReplayModel';
import {RewindVotePoll, VOTE_ALREADY_OPEN} from '../../../common/rewind/RewindVoteModel';

export const voteMetrics = {
  votes: new prometheus.Counter({
    name: 'rewind_votes',
    help: 'Rewind votes, by how they ended',
    labelNames: ['outcome'] as const,
    registers: [prometheus.register],
  }),
};

export const RESTARTED_BEFORE_REWIND = 'The server restarted before the rewind ran. Ask again.';
const TRY_AGAIN = 'That didn\'t work. Try again.';
const UNRESTORABLE = 'That moment can\'t be restored. Nothing was changed.';
const OWN_MOVES_ONLY = 'You can only ask to rewind your own moves.';
const GAME_REWOUND = 'This game was rewound. Refresh this page.';
const GAME_FROZEN = 'The game is frozen, so no rewind can be asked for or answered.';
const REWIND_RUNNING = 'A rewind is already running.';

export type VoteEffects = {
  /** rewindTable(game, saveId, {cards, clocks: 'keep'}, {kind: 'vote', requester}). Must take the table lock synchronously on call. */
  rewind(game: IGame, saveId: number, cards: RewindCards, requester: IPlayer): Promise<IGame>;
  /** `game.persistTableState()`. */
  persist(game: IGame): Promise<void>;
  /** Whether `game` is the object the loader serves for its id (a replaced object's calls and timers do nothing). */
  isLive(game: IGame): Promise<boolean>;
  /** Runs `fn` once after `ms`. Defaults to an unreferenced setTimeout. */
  schedule?(fn: () => void, ms: number): {cancel(): void};
};

function defaultSchedule(fn: () => void, ms: number): {cancel(): void} {
  const timer = setTimeout(fn, ms).unref();
  return {cancel: () => clearTimeout(timer)};
}

// Seeded with the time, so a tab that holds an id from before a restart can only match the same vote.
let lastVoteId = Date.now();

export class VoteService {
  // A replaced game object (a rollback, a player undo) must not touch the live object's timer or ended vote,
  // so both are kept per object. A vote that passed, or that a judge's rewind ended, is the one an object answers for
  // its restored successor.
  private readonly timers = new Map<IGame, {cancel(): void}>();
  private ended = new WeakMap<IGame, EndedVote>();
  private readonly carried = new Map<GameId, EndedVote>();

  constructor(private readonly effects: VoteEffects, private readonly clock: Clock = new Clock()) {}

  public poll(game: IGame, player: IPlayer): RewindVotePoll {
    if (this.expire(game)) {
      void this.write(game);
    }
    const blocked = requestBlock(game, player.id);
    return {
      rewindCount: game.rewinds.length,
      vote: voteModel(game, this.endedOf(game), this.clock.now()),
      blocked,
    };
  }

  public async request(game: IGame, player: IPlayer, saveId: number, cards: RewindCards): Promise<RewindVotePoll> {
    await this.settle(game);
    this.checkMayRequest(game, player);
    const history = await getReplayMoves(game, player.id);
    // Any status but 'available' (a finished game's history may not be ready) reads as a move that is not there.
    const index = history.status === 'available' ? history.moves.findIndex((move) => move.saveId === saveId) : -1;
    if (index < 0) {
      throw RouteError.notFound('That move is not in this game\'s history.');
    }
    // A move of unknown player is refused too.
    if (history.status === 'available' && history.moves[index].mover !== player.color) {
      throw RouteError.badRequest(OWN_MOVES_ONLY);
    }
    let generation: number;
    try {
      generation = (await Database.getInstance().getGameVersion(game.id, saveId)).generation;
    } catch (e) {
      console.warn(`rewind vote: unable to read save ${saveId} of ${game.id}`, e);
      throw RouteError.badRequest(UNRESTORABLE);
    }

    // Another request may have changed things during the awaits. From here to the write, nothing awaits.
    this.checkMayRequest(game, player);
    const vote: SerializedRewindVote = {
      id: ++lastVoteId,
      requester: player.id,
      saveId,
      moveNumber: index + 1,
      generation,
      cards,
      yes: [player.id],
      status: 'open',
      expiresAt: this.clock.now() + VOTE_EXPIRY_MS,
    };
    game.rewindVote = vote;
    this.ended.delete(game);
    this.carried.delete(game.id);
    this.arm(game);
    console.log(`rewind vote ${vote.id} of ${game.id} opened by ${player.id} for save ${saveId}`);
    if (!await this.write(game)) {
      // Only a vote still as it was opened is taken back. Later changes to it are being written.
      if (game.rewindVote === vote && vote.status === 'open' && vote.yes.length === 1) {
        game.rewindVote = undefined;
        this.disarm(game);
        throw RouteError.badRequest(TRY_AGAIN);
      }
    }
    return this.poll(game, player);
  }

  /** Answers with the poll of the game that is live afterwards, which after a rewind is the restored one. */
  public async cast(game: IGame, player: IPlayer, voteId: number, choice: 'yes' | 'no'): Promise<RewindVotePoll> {
    this.checkMayTake(game, player);
    await this.settle(game);
    this.checkMayTake(game, player);
    this.checkNotFrozen(game);
    const vote = game.rewindVote;
    if (vote === undefined || vote.id !== voteId) {
      throw RouteError.badRequest('This vote has ended.');
    }
    if (vote.status === 'rewinding') {
      throw RouteError.badRequest(REWIND_RUNNING);
    }
    if (player.id === vote.requester) {
      throw RouteError.badRequest('You asked for this rewind. You can cancel it.');
    }

    if (choice === 'no') {
      this.end(game, 'declined', {bar: true, no: player.id});
      await this.write(game);
      return this.poll(game, player);
    }
    if (!vote.yes.includes(player.id)) {
      vote.yes.push(player.id);
    }
    if (!everyoneAgreed(vote, game)) {
      await this.write(game);
      return this.poll(game, player);
    }

    // One step: no input can land between the last yes and the table lock the rewind takes.
    const requester = game.getPlayerById(vote.requester);
    vote.status = 'rewinding';
    this.disarm(game);
    let started: Promise<IGame>;
    try {
      started = this.effects.rewind(game, vote.saveId, vote.cards, requester);
    } catch (e) {
      started = Promise.reject(e);
    }
    const outcome = started.then((restored) => ({restored}), (error) => ({error}));
    // The rewind's own row may be written first, which makes this patch a no-op. That is right.
    await this.write(game);
    const result = await outcome;
    if ('restored' in result) {
      // The old object is retired, and the restored game's row carries no vote.
      this.end(game, 'passed', {});
      return this.poll(result.restored, player);
    }
    const reason = result.error instanceof RouteError && result.error.detail !== undefined ? result.error.detail : UNRESTORABLE;
    this.end(game, 'failed', {reason});
    await this.write(game);
    return this.poll(game, player);
  }

  /**
   * Ends the game's open vote because the judge froze or rewound the game. Nobody is barred from asking, and nothing is
   * written: a freeze writes the table state itself, and a rewound game's save carries no vote.
   */
  public endForJudge(game: IGame, status: 'froze' | 'judge-rewound'): void {
    this.end(game, status, {});
  }

  public async cancel(game: IGame, player: IPlayer, voteId: number): Promise<RewindVotePoll> {
    this.checkMayTake(game, player);
    await this.settle(game);
    this.checkMayTake(game, player);
    const vote = game.rewindVote;
    if (vote === undefined || vote.id !== voteId) {
      throw RouteError.badRequest('This vote has ended.');
    }
    if (player.id !== vote.requester) {
      throw RouteError.forbidden();
    }
    if (vote.status === 'rewinding') {
      throw RouteError.badRequest(REWIND_RUNNING);
    }
    this.end(game, 'cancelled', {});
    await this.write(game);
    return this.poll(game, player);
  }

  /** Called after every accepted input. Starts the write without awaiting it. */
  public moved(game: IGame): void {
    if (game.rewindVote?.status !== 'open') {
      return;
    }
    this.end(game, 'moved-on', {});
    void this.write(game);
  }

  /** After a load: expires, re-arms or fails a restored vote. */
  public async resume(game: IGame): Promise<void> {
    const vote = game.rewindVote;
    if (vote === undefined) {
      return;
    }
    lastVoteId = Math.max(lastVoteId, vote.id);
    if (!await this.effects.isLive(game) || game.rewindVote !== vote) {
      return;
    }
    if (vote.status === 'rewinding') {
      // Every yes was in and the rewind never wrote its save: it would have carried no vote.
      this.end(game, 'failed', {reason: RESTARTED_BEFORE_REWIND});
      await this.write(game);
    } else if (isDue(vote, this.clock.now())) {
      await this.settle(game);
    } else {
      this.arm(game);
    }
  }

  /** Forgets every timer and ended vote, and the vote ids handed out, as a process restart does. */
  public resetForTesting(): void {
    for (const timer of this.timers.values()) {
      timer.cancel();
    }
    this.timers.clear();
    this.ended = new WeakMap();
    this.carried.clear();
    lastVoteId = Date.now();
  }

  private checkMayTake(game: IGame, player: IPlayer): void {
    if (!canVoteRewind(game, player.id)) {
      throw RouteError.forbidden();
    }
    if (game.retired) {
      throw RouteError.badRequest(GAME_REWOUND);
    }
    // A rewind or a freeze by someone else is running. Nothing about the vote changes, and the judge's action decides its end.
    if (isTableLocked(game.id)) {
      throw RouteError.badRequest(REWIND_RUNNING);
    }
  }

  /** A request and an answer wait until the judge unfreezes the game. Cancelling does not. */
  private checkNotFrozen(game: IGame): void {
    if (game.frozen) {
      throw RouteError.badRequest(GAME_FROZEN);
    }
  }

  private checkMayRequest(game: IGame, player: IPlayer): void {
    this.checkMayTake(game, player);
    this.checkNotFrozen(game);
    if (game.rewindVote !== undefined) {
      throw RouteError.badRequest(VOTE_ALREADY_OPEN);
    }
    if (!mayRequest(game.rewindRequestLimits, game, player.id)) {
      throw RouteError.badRequest('You can ask again next generation.');
    }
  }

  /** The newest ended vote this object, or the game it was restored into, has to show. */
  private endedOf(game: IGame): EndedVote | undefined {
    const carried = this.carried.get(game.id);
    if (carried !== undefined && this.clock.now() >= carried.endedAt + ENDED_VOTE_SHOWN_MS) {
      this.carried.delete(game.id);
    }
    const own = this.ended.get(game);
    const shown = this.carried.get(game.id);
    return shown !== undefined && (own === undefined || shown.endedAt > own.endedAt) ? shown : own;
  }

  /** Starts the timer of the game's open vote, and has an accepted move end the vote. */
  private arm(game: IGame): void {
    const vote = game.rewindVote;
    if (vote === undefined) {
      return;
    }
    this.timers.get(game)?.cancel();
    const schedule = this.effects.schedule ?? defaultSchedule;
    this.timers.set(game, schedule(() => void this.onTimer(game), Math.max(0, vote.expiresAt - this.clock.now())));
    game.onRewindVoteMove = () => this.moved(game);
  }

  private disarm(game: IGame): void {
    this.timers.get(game)?.cancel();
    this.timers.delete(game);
  }

  private async onTimer(game: IGame): Promise<void> {
    if (!await this.effects.isLive(game)) {
      // Nothing will end this object's vote, and the map must not keep the object.
      this.timers.delete(game);
      return;
    }
    await this.settle(game);
    // A timer can fire a moment before the clock agrees that the vote is due.
    if (game.rewindVote?.status === 'open') {
      this.arm(game);
    }
  }

  private async settle(game: IGame): Promise<void> {
    if (this.expire(game)) {
      await this.write(game);
    }
  }

  /** Ends the game's vote as expired when its time is up. Returns whether it did. */
  private expire(game: IGame): boolean {
    const vote = game.rewindVote;
    if (vote === undefined || !isDue(vote, this.clock.now())) {
      return false;
    }
    this.end(game, 'expired', {bar: true});
    return true;
  }

  private end(game: IGame, status: EndedVote['status'], options: {bar?: boolean, no?: PlayerId, reason?: string}): void {
    const vote = game.rewindVote;
    if (vote === undefined) {
      return;
    }
    const ended: EndedVote = {vote: structuredClone(vote), status, endedAt: this.clock.now()};
    if (options.no !== undefined) {
      ended.no = options.no;
    }
    if (options.reason !== undefined) {
      ended.reason = options.reason;
    }
    if (status === 'passed' || status === 'judge-rewound') {
      this.carried.set(game.id, ended);
    } else {
      this.ended.set(game, ended);
    }
    game.rewindVote = undefined;
    if (options.bar === true) {
      game.rewindRequestLimits = barUntilNextGeneration(game.rewindRequestLimits, game, vote.requester);
    }
    this.disarm(game);
    voteMetrics.votes.inc({outcome: status});
    console.log(`rewind vote ${vote.id} of ${game.id} ${status}`);
  }

  /** Writes the game's table state. False when it didn't, which is only a failure for the caller that must have it written. */
  private async write(game: IGame): Promise<boolean> {
    try {
      if (!await this.effects.isLive(game)) {
        return false;
      }
      // Whether the patch landed is not acted on: the vote stays in memory and the next save carries it, and a restart
      // loses at worst an open vote that would have expired anyway.
      await this.effects.persist(game);
      return true;
    } catch (e) {
      // The state stays in memory, and the next write carries all of it.
      console.warn(`rewind vote of ${game.id}: unable to write the table state`, e);
      return false;
    }
  }
}
