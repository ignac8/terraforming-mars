import {IGame} from '../../../src/server/IGame';
import {IPlayer} from '../../../src/server/IPlayer';
import {SerializedGame} from '../../../src/server/SerializedGame';
import {GameLoader} from '../../../src/server/database/GameLoader';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {clearReplayCache, getReplayMoves} from '../../../src/server/replay/ReplayService';
import {voteClock, voteEffects, voteService} from '../../../src/server/rewind/vote/effects';
import {Handler} from '../../../src/server/routes/Handler';
import {ApiRewindVote} from '../../../src/server/routes/ApiRewindVote';
import {LoadGame} from '../../../src/server/routes/LoadGame';
import {PlayerInput} from '../../../src/server/routes/PlayerInput';
import {Phase} from '../../../src/common/Phase';
import {Clock} from '../../../src/common/Timer';
import {ParticipantId, PlayerId} from '../../../src/common/Types';
import {RewindVotePoll} from '../../../src/common/rewind/RewindVoteModel';
import {cast} from '../../../src/common/utils/utils';
import {restoreTestDatabase, restoreTestGameLoader, setTestDatabase, setTestGameLoader} from '../../testing/setup';
import {SnapshotDatabase} from '../../testing/SnapshotDatabase';
import {FakeClock} from '../../common/FakeClock';
import {MockRequest, MockResponse} from '../../routes/HttpMocks';
import {RouteTestScaffolding} from '../../routes/RouteTestScaffolding';
import {TestPlayer} from '../../TestPlayer';
import {testGame} from '../../TestingUtils';

export const CONVERT_HEAT = 'Convert 8 heat into temperature';

/**
 * A two-player game with Player undo, served by a real loader over a SnapshotDatabase, played to the
 * second generation: player 2 converted heat twice and player 1 once, so player 1 is asked for an action.
 * Every request goes through the routes and the loader, so a restart can drop the game from memory.
 */
export class VoteTable {
  public db = new SnapshotDatabase();
  public loader!: GameLoader;
  public clock = new FakeClock();
  public game!: IGame;
  public p1!: TestPlayer;
  public p2!: TestPlayer;
  /** The vote timers armed, which a spec fires by hand. */
  public timers: Array<{fn: () => void, ms: number}> = [];

  public async start(options: Parameters<typeof testGame>[1] = {}): Promise<void> {
    clearReplayCache();
    voteService.resetForTesting();
    this.db = new SnapshotDatabase();
    setTestDatabase(this.db);
    this.newLoader();
    // An epoch, so no deadline sits near 0.
    this.clock.millis = Date.parse('2026-10-22T12:00:00Z');
    voteClock.source = this.clock;
    this.timers = [];
    voteEffects.schedule = (fn, ms) => {
      this.timers.push({fn, ms});
      return {cancel: () => {}};
    };
    [this.game, this.p1, this.p2] = testGame(2, {undoOption: true, ...options});
    await this.loader.add(this.game);
    this.game.phase = Phase.ACTION;
    this.p1.heat = 40;
    this.p2.heat = 40;
    this.p1.takeAction();
    choose(this.p1, 'Pass for this generation');
    choose(this.p2, 'Pass for this generation');
    this.p1.process({type: 'card', cards: []});
    this.p2.process({type: 'card', cards: []});
    // Player 2 goes first in the second generation.
    choose(this.p2, CONVERT_HEAT);
    choose(this.p2, CONVERT_HEAT);
    choose(this.p1, CONVERT_HEAT);
  }

  public stop(): void {
    voteService.resetForTesting();
    voteClock.source = new Clock();
    delete voteEffects.schedule;
    restoreTestDatabase();
    restoreTestGameLoader();
    clearReplayCache();
  }

  /** What a server restart does to memory: the loader and the vote service forget everything. The database stays. */
  public restart(): void {
    this.newLoader();
    voteService.resetForTesting();
    clearReplayCache();
  }

  public rows(): Array<SerializedGame> {
    return this.db.games.get(this.game.id) as Array<SerializedGame>;
  }

  public newest(): SerializedGame {
    const rows = this.rows();
    return rows[rows.length - 1];
  }

  /** The save ids of the moves `player` sees in the history of the live game, oldest first. */
  public async moves(player: IPlayer = this.p2): Promise<Array<number>> {
    const history = await getReplayMoves(await this.live(), player.id);
    if (history.status !== 'available') {
      throw new Error(`no history: ${history.status}`);
    }
    return history.moves.map((move) => move.saveId);
  }

  /** The game object the loader serves now. */
  public async live(): Promise<IGame> {
    const game = await this.loader.getGame(this.game.id);
    if (game === undefined) {
      throw new Error('the game is gone');
    }
    return game;
  }

  public get(id: ParticipantId, query = ''): Promise<MockResponse> {
    return this.call(ApiRewindVote.INSTANCE, `/api/rewind/vote?id=${id}${query}`, 'get');
  }

  public post(id: ParticipantId, body: object | string, query = ''): Promise<MockResponse> {
    return this.call(ApiRewindVote.INSTANCE, `/api/rewind/vote?id=${id}${query}`, 'post', typeof body === 'string' ? body : JSON.stringify(body));
  }

  /** Posts an answer to the player's prompt, the way the game page does, but without a request id. */
  public input(id: PlayerId, body: object, query = ''): Promise<MockResponse> {
    return this.call(PlayerInput.INSTANCE, `/player/input?id=${id}${query}`, 'post', JSON.stringify(body));
  }

  /** Deletes the newest `count` saves and reloads the game, as the operator's load_game form does. */
  public rollBack(count: number): Promise<MockResponse> {
    return this.call(LoadGame.INSTANCE, '/load_game?serverId=1', 'put', JSON.stringify({gameId: this.game.id, rollbackCount: count}));
  }

  /** Posts the action titled `title` for the player asked for an action. */
  public async act(id: PlayerId, title: string, query = ''): Promise<MockResponse> {
    const player = (await this.live()).getPlayerById(id);
    const index = cast(player.getWaitingFor(), OrOptions).options.findIndex((option) => option.title === title);
    return this.input(id, {type: 'or', index, response: {type: 'option'}}, query);
  }

  public async poll(id: PlayerId, query = ''): Promise<RewindVotePoll> {
    const res = await this.get(id, query);
    if (res.statusCode !== 200) {
      throw new Error(`poll answered ${res.statusCode}: ${res.content}`);
    }
    return JSON.parse(res.content);
  }

  private newLoader(): void {
    this.loader = GameLoader.newTestInstance({sleepMillis: 0, evictMillis: 100, idleMillis: 0, sweep: 'manual'}, new FakeClock());
    setTestGameLoader(this.loader);
  }

  // A mock request drops a body emitted before the route listens for it, and the route reads it only after the
  // loader has found the game. So the body is emitted once the route listens, unless it answered before reading it.
  private async call(handler: Handler, url: string, method: 'get' | 'post' | 'put', body = ''): Promise<MockResponse> {
    const req = new MockRequest();
    const res = new MockResponse();
    const scaffolding = new RouteTestScaffolding(req);
    scaffolding.ctx.gameLoader = this.loader;
    scaffolding.url = url;
    if (method === 'get') {
      await scaffolding.get(handler, res);
      return res;
    }
    let answered = false;
    const response = (method === 'post' ? scaffolding.post(handler, res) : scaffolding.put(handler, res)).finally(() => {
      answered = true;
    });
    for (let i = 0; !answered && req.emitter.listenerCount('end') === 0; i++) {
      if (i === 100) {
        throw new Error(`${url} neither read its body nor answered`);
      }
      await new Promise((resolve) => setImmediate(resolve));
    }
    if (!answered) {
      req.emitString(body);
      req.emitter.emit('end');
    }
    await response;
    return res;
  }
}

export function choose(player: IPlayer, title: string): void {
  const action = cast(player.getWaitingFor(), OrOptions);
  player.process({type: 'or', index: action.options.findIndex((option) => option.title === title), response: {type: 'option'}});
}

/** Lets writes that were started without an await land. */
export async function flush(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}
