import {expect} from 'chai';
import {ApiGameLogs} from '@/server/routes/ApiGameLogs';
import {ApiJudge} from '@/server/routes/ApiJudge';
import {ApiPlayer} from '@/server/routes/ApiPlayer';
import {ApiReplayMoves} from '@/server/routes/ApiReplayMoves';
import {ApiReplayView} from '@/server/routes/ApiReplayView';
import {ApiRewindVote} from '@/server/routes/ApiRewindVote';
import {ApiSpectator} from '@/server/routes/ApiSpectator';
import {ApiWaitingFor} from '@/server/routes/ApiWaitingFor';
import {GameLogs} from '@/server/routes/GameLogs';
import {Handler} from '@/server/routes/Handler';
import {LoadGame} from '@/server/routes/LoadGame';
import {PlayerInput} from '@/server/routes/PlayerInput';
import {Server} from '@/server/models/ServerModel';
import {Ants} from '@/server/cards/base/Ants';
import {IGame} from '@/server/IGame';
import {IPlayer} from '@/server/IPlayer';
import {incognitoMask, maskModel, unmaskColor} from '@/server/incognito/IncognitoMask';
import {OrOptions} from '@/server/inputs/OrOptions';
import {SelectDelegate} from '@/server/inputs/SelectDelegate';
import {SelectOption} from '@/server/inputs/SelectOption';
import {SelectPlayer} from '@/server/inputs/SelectPlayer';
import {SelectSpace} from '@/server/inputs/SelectSpace';
import {DeltaProjectExpansion} from '@/server/delta/DeltaProjectExpansion';
import {loadSandboxGame} from '@/server/replay/sandbox';
import {buildReplayView} from '@/server/replay/replayView';
import {clearReplayCache, getReplayMoves, isFinished, loadReplayState} from '@/server/replay/ReplayService';
import {voteClock, voteService} from '@/server/rewind/vote/effects';
import {SerializedGame} from '@/server/SerializedGame';
import {Color, PLAYER_COLORS, PLAYER_COLOR_LABELS, PlayerColor} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {LogMessage} from '@/common/logs/LogMessage';
import {JudgeModel} from '@/common/models/JudgeModel';
import {ReplayMovesModel} from '@/common/replay/ReplayModel';
import {statusCode} from '@/common/http/statusCode';
import {Clock} from '@/common/Timer';
import {isJudgeId, isPlayerId, ParticipantId, PlayerId} from '@/common/Types';
import {MAX_OXYGEN_LEVEL, MAX_TEMPERATURE} from '@/common/constants';
import {Phase} from '@/common/Phase';
import {PartyName} from '@/common/turmoil/PartyName';
import {testGame} from '@tests/TestGame';
import {TestPlayer} from '@tests/TestPlayer';
import {addCity, addGreenery, addOcean, maxOutOceans, setOxygenLevel, setTemperature} from '@tests/TestingUtils';
import {FakeClock} from '@tests/common/FakeClock';
import {InMemoryDatabase} from '@tests/testing/InMemoryDatabase';
import {restoreTestDatabase, setTestDatabase} from '@tests/testing/setup';
import {VoteTable} from '@tests/rewind/vote/voteTable';
import {MockRequest, MockResponse} from './HttpMocks';
import {RouteTestScaffolding} from './RouteTestScaffolding';

const ALICE = 'Zzalice';
const BOB = 'Zzbob';
const CAROL = 'Zzcarol';
const JUDGE_PASSWORD = 'secret';
const SEAT_PASSWORD = '0123456789ab';
// The judge id is random, and so is the judge's mask. This one shows every seat as another color than its own, and leaves two of
// the three real colors unshown, so that a leaked color cannot pass for a masked one.
const JUDGE_ID = 'j-judge-id-4';

type Viewer = 'player' | 'spectator' | 'judge';

/** A route that answers a player, a spectator or the judge, and the model it builds the answer from. */
type Route = {
  name: string;
  viewers: ReadonlyArray<Viewer>;
  /** What the unmasked body shows of the other players: their names and colors, or only their colors. */
  kind: 'names' | 'colors';
  /** The running game's answer to a spectator shows no player. The judge's does. */
  emptyForSpectator?: boolean;
  request(id: ParticipantId): Promise<MockResponse>;
  /** The body from the models before any mask. Asked for after `request`, which can change the game. */
  unmasked(id: ParticipantId): Promise<unknown>;
};

function label(color: PlayerColor | undefined): string {
  return PLAYER_COLOR_LABELS[color as PlayerColor];
}

describe('Incognito routes', () => {
  let db: InMemoryDatabase;
  let game: IGame;
  let alice: TestPlayer;
  let bob: TestPlayer;
  let carol: TestPlayer;
  const clock = new FakeClock();

  async function call(handler: Handler, method: 'get' | 'post', url: string, body?: unknown): Promise<MockResponse> {
    const req = new MockRequest();
    const res = new MockResponse();
    const scaffolding = new RouteTestScaffolding(req);
    await scaffolding.ctx.gameLoader.add(game);
    scaffolding.url = url;
    if (method === 'get') {
      await scaffolding.get(handler, res);
      return res;
    }
    // The route reads the body once the loader has found the game, so the body comes once it listens.
    let answered = false;
    const response = scaffolding.post(handler, res).finally(() => {
      answered = true;
    });
    for (let i = 0; !answered && req.emitter.listenerCount('end') === 0; i++) {
      if (i === 100) {
        throw new Error(`${url} neither read its body nor answered`);
      }
      await new Promise((resolve) => setImmediate(resolve));
    }
    if (!answered) {
      req.emitString(JSON.stringify(body));
      req.emitter.emit('end');
    }
    await response;
    return res;
  }

  function fakeOf(viewer: IPlayer | 'spectator' | 'judge', seat: IPlayer): PlayerColor {
    const id = viewer === 'spectator' ? game.spectatorId : viewer === 'judge' ? game.judgeId! : viewer.id;
    return incognitoMask(game, id)!.colors.get(seat.color) as PlayerColor;
  }

  /**
   * The colors that a viewer could send in place of a seat's: the real colors of the seats that are no fake of theirs, a color
   * that nobody plays, and the fakes they were shown. `alice`, by default, is not shown her own seat.
   */
  function probes(viewer: 'alice' | 'judge' = 'alice'): {hidden: Array<Color>, unplayed: Array<Color>, fakes: Array<Color>} {
    const mask = incognitoMask(game, viewer === 'judge' ? game.judgeId! : alice.id)!;
    const shown = (color: Color) => mask.reverse.has(color);
    return {
      hidden: (viewer === 'judge' ? [alice, bob, carol] : [bob, carol]).map((p) => p.color).filter((color) => !shown(color)),
      unplayed: PLAYER_COLORS.filter((color) => !game.players.some((p) => p.color === color) && !shown(color)),
      fakes: [...mask.reverse.keys()],
    };
  }

  /** The password a request of this participant carries: only the judge's seat has one in these games. */
  function credentials(id: ParticipantId): string {
    return isJudgeId(id) ? `&password=${JUDGE_PASSWORD}` : '';
  }

  /** Starts a game of three players with tiles, a milestone, an award, a colony, a delegate, log lines and an open rewind vote. */
  async function start(options: Parameters<typeof testGame>[1] = {}): Promise<void> {
    db = new InMemoryDatabase();
    setTestDatabase(db);
    clearReplayCache();
    voteService.resetForTesting();
    clock.millis = Date.parse('2026-11-08T12:00:00Z');
    voteClock.source = clock;
    [game, alice, bob, carol] = testGame(3, {
      incognito: true, undoOption: true, judgeUndo: true, judgeLink: true, coloniesExtension: true, turmoilExtension: true, ...options,
    });
    alice.name = ALICE;
    bob.name = BOB;
    carol.name = CAROL;
    game.judgeId = JUDGE_ID;
    game.judgePassword = JUDGE_PASSWORD;
    game.phase = Phase.ACTION;

    addCity(alice);
    addGreenery(bob);
    addOcean(carol);
    game.claimedMilestones.push({player: bob, milestone: game.milestones[0]});
    game.fundAward(carol, game.awards[0]);
    game.colonies[0].colonies.push(bob.id);
    game.colonies[0].visitor = carol.id;
    game.turmoil!.chairman = bob;
    game.turmoil!.sendDelegateToParty(carol, PartyName.REDS, game);
    game.log('${0} and ${1} take their turns', (b) => b.player(bob).player(carol));
    game.log('${0} is ahead', (b) => b.player(alice));
    game.log('${0}', (b) => b.rawString(`${ALICE}: 3 / ${BOB}: 2 / ${CAROL}: 1`));
    game.log('You bought ${0}', (b) => b.player(alice), {reservedFor: alice});
    game.log('${0} paid', (b) => b.player(bob));
    game.rewindVote = {
      id: 1, requester: bob.id, saveId: 0, moveNumber: 1, generation: 1, cards: 'same', yes: [bob.id], status: 'open', expiresAt: clock.now() + 60_000,
    };
    for (const player of game.players) {
      player.setWaitingFor(new SelectOption('Go').andThen(() => undefined));
    }

    const base = game.serialize();
    const length = base.gameLog.length;
    db.games.set(game.id, [0, Math.ceil(length / 2), length].map((n, i): SerializedGame => ({
      ...structuredClone(base), lastSaveId: i, gameLog: structuredClone(base.gameLog.slice(0, n)),
    })));

    // Where a fake color equals the real one, a leaked color would pass for a masked one.
    for (const viewer of [alice.id, game.spectatorId, game.judgeId!]) {
      const mask = incognitoMask(game, viewer);
      for (const [real, fake] of mask?.colors ?? []) {
        if (real === fake) {
          throw new Error(`The mask of ${viewer} keeps ${real}. Pick another game id.`);
        }
      }
    }
  }

  /** Ends the game: the phase is END and the newest save is too. */
  function finish(): void {
    game.phase = Phase.END;
    const saves = db.games.get(game.id) as Array<SerializedGame>;
    saves.push({...structuredClone(saves[saves.length - 1]), phase: Phase.END, lastSaveId: saves.length});
  }

  function pending(): Array<string> {
    return game.playersInGenerationOrder.filter((p) => p.getWaitingFor() !== undefined && !p.getWaitingFor()?.optional).map((p) => p.color);
  }

  function routes(): Array<Route> {
    const gameLogs = new GameLogs();
    const counts = () => `gameAge=${game.gameAge}&undoCount=${game.undoCount}`;
    const playerOf = (id: ParticipantId) => game.getPlayerById(id as PlayerId);
    return [
      {
        name: 'api/player',
        viewers: ['player'],
        kind: 'names',
        request: (id) => call(ApiPlayer.INSTANCE, 'get', `/api/player?id=${id}`),
        unmasked: async (id) => Server.getPlayerModel(playerOf(id)),
      },
      {
        name: 'player/input',
        viewers: ['player'],
        kind: 'names',
        request: (id) => {
          playerOf(id).setWaitingFor(new SelectOption('Go').andThen(() => undefined));
          return call(PlayerInput.INSTANCE, 'post', `/player/input?id=${id}`, {type: 'option'});
        },
        unmasked: async (id) => Server.getPlayerModel(playerOf(id)),
      },
      {
        name: 'api/spectator',
        viewers: ['spectator'],
        kind: 'names',
        request: (id) => call(ApiSpectator.INSTANCE, 'get', `/api/spectator?id=${id}`),
        unmasked: async () => Server.getSpectatorModel(game),
      },
      {
        name: 'api/judge',
        viewers: ['judge'],
        kind: 'names',
        request: (id) => call(ApiJudge.INSTANCE, 'get', `/api/judge?id=${id}${credentials(id)}`),
        unmasked: async () => Server.getJudgeModel(game),
      },
      {
        name: 'api/waitingfor',
        viewers: ['player', 'spectator', 'judge'],
        kind: 'colors',
        request: (id) => {
          // The input route took the prompt of the player before it.
          game.players.forEach((p) => p.setWaitingFor(new SelectOption('Go').andThen(() => undefined)));
          const query = isJudgeId(id) ? `signature=${Server.getJudgeSignature(game)}` : counts();
          return call(ApiWaitingFor.INSTANCE, 'get', `/api/waitingfor?id=${id}${credentials(id)}&${query}`);
        },
        unmasked: async (id) => ({result: isPlayerId(id) ? 'GO' : 'WAIT', waitingFor: pending()}),
      },
      {
        name: 'api/game/logs',
        viewers: ['player', 'spectator', 'judge'],
        kind: 'names',
        request: (id) => call(ApiGameLogs.INSTANCE, 'get', `/api/game/logs?id=${id}${credentials(id)}`),
        unmasked: async (id) => isJudgeId(id) ? gameLogs.getLogsForJudge(game, undefined) : gameLogs.getLogsForGameView(id, game, undefined),
      },
      {
        name: 'api/rewind/vote',
        viewers: ['player'],
        kind: 'colors',
        request: (id) => call(ApiRewindVote.INSTANCE, 'get', `/api/rewind/vote?id=${id}`),
        unmasked: async (id) => voteService.poll(game, playerOf(id)),
      },
      {
        name: 'api/replay/moves',
        viewers: ['player', 'spectator', 'judge'],
        kind: 'names',
        emptyForSpectator: true,
        request: (id) => call(ApiReplayMoves.INSTANCE, 'get', `/api/replay/moves?id=${id}${credentials(id)}`),
        unmasked: (id) => getReplayMoves(game, id),
      },
      {
        name: 'api/replay/view',
        viewers: ['player', 'judge'],
        kind: 'names',
        // The judge may look at every hand at once, and the player only at their own.
        request: (id) => call(ApiReplayView.INSTANCE, 'get', `/api/replay/view?id=${id}&save=0&as=${isJudgeId(id) ? 'all' : alice.color}${credentials(id)}`),
        unmasked: async (id) => isJudgeId(id) ?
          buildReplayView(await loadReplayState(game, 0), id, 0, 'all', true) :
          buildReplayView(await loadReplayState(game, 0), id, 0, alice.color, await isFinished(game)),
      },
    ];
  }

  function idOf(viewer: Viewer): ParticipantId {
    return viewer === 'player' ? alice.id : viewer === 'spectator' ? game.spectatorId : game.judgeId!;
  }

  // Every route as the player, the spectator and the judge, so a route that forgot to mask fails under its own name.
  const cases = routes().flatMap((route) => route.viewers.map((viewer) => ({route, viewer})));

  function hiddenNames(viewer: Viewer): Array<string> {
    return viewer === 'player' ? [BOB, CAROL] : [ALICE, BOB, CAROL];
  }

  function carries(route: Route, viewer: Viewer, ended: boolean): boolean {
    return !(route.emptyForSpectator && viewer === 'spectator' && !ended);
  }

  type Fetched = {content: string, body: unknown, raw: unknown};

  async function fetchRoute(route: Route, id: ParticipantId): Promise<Fetched> {
    const res = await route.request(id);
    expect(res.statusCode, `${route.name} ${id}: ${res.content}`).eq(statusCode.ok);
    const raw = JSON.parse(JSON.stringify(await route.unmasked(id)));
    return {content: res.content, body: JSON.parse(res.content), raw};
  }

  /** Expects the unmasked body at the end of the game, and the viewer's masked one, with no name of an opponent, before it. */
  function expectBody(route: Route, viewer: Viewer, id: ParticipantId, fetched: Fetched, ended: boolean): void {
    const where = `${route.name} for the ${viewer}${ended ? ' at the end' : ''}`;
    const rawNames = JSON.stringify(fetched.raw);
    const shows = carries(route, viewer, ended);
    if (route.kind === 'names' && shows) {
      for (const name of hiddenNames(viewer)) {
        expect(rawNames, `${where}: the unmasked body should name ${name}`).includes(name);
      }
    }
    if (ended) {
      expect(fetched.body, where).deep.eq(fetched.raw);
      return;
    }
    const expected = maskModel(fetched.raw, incognitoMask(game, id));
    expect(fetched.body, where).deep.eq(expected);
    if (shows) {
      expect(expected, `${where}: the mask should change the body`).not.deep.eq(fetched.raw);
    }
    for (const name of hiddenNames(viewer)) {
      expect(fetched.content, where).not.includes(name);
    }
  }

  beforeEach(() => start());

  afterEach(() => {
    voteService.resetForTesting();
    voteClock.source = new Clock();
    restoreTestDatabase();
    clearReplayCache();
  });

  describe('no opponent name in any player, spectator or judge body', () => {
    for (const {route, viewer} of cases) {
      it(`${route.name} for the ${viewer}`, async () => {
        const id = idOf(viewer);
        const fetched = await fetchRoute(route, id);

        for (const name of hiddenNames(viewer)) {
          expect(fetched.content, `${route.name} for the ${viewer} names ${name}`).not.includes(name);
        }
        expectBody(route, viewer, id, fetched, false);
      });
    }
  });

  describe('every color field equals the viewer\'s mapping', () => {
    for (const {route, viewer} of cases) {
      it(`${route.name} for the ${viewer}`, async () => {
        const id = idOf(viewer);
        const fetched = await fetchRoute(route, id);

        expect(fetched.body).deep.eq(maskModel(fetched.raw, incognitoMask(game, id)));
        if (carries(route, viewer, false)) {
          expect(fetched.body, 'the mask should change the body').not.deep.eq(fetched.raw);
        }
      });
    }
  });

  it('a viewer\'s mapping stays the same between requests', async () => {
    const route = routes()[0];

    const first = await fetchRoute(route, alice.id);
    const second = await fetchRoute(route, alice.id);

    expect(second.body).deep.eq(first.body);
  });

  describe('rewind out of END hides again', () => {
    for (const {route, viewer} of cases) {
      it(`${route.name} for the ${viewer}`, async () => {
        const id = idOf(viewer);
        expectBody(route, viewer, id, await fetchRoute(route, id), false);

        finish();
        expectBody(route, viewer, id, await fetchRoute(route, id), true);

        // The rewind drops the saves of the end and reopens the game.
        db.games.set(game.id, (db.games.get(game.id) as Array<SerializedGame>).slice(0, 3));
        clearReplayCache();
        game.phase = Phase.ACTION;
        expectBody(route, viewer, id, await fetchRoute(route, id), false);
      });
    }
  });

  describe('replay view', () => {
    function view(id: ParticipantId, as: string, save = 0, extra = ''): Promise<MockResponse> {
      return call(ApiReplayView.INSTANCE, 'get', `/api/replay/view?id=${id}&save=${save}&as=${as}${extra}`);
    }

    it('of an old save follows the live game', async () => {
      const running = await view(alice.id, alice.color);

      expect(running.statusCode, running.content).eq(statusCode.ok);
      expect(running.content).not.includes(BOB).and.not.includes(CAROL);
      expect(JSON.parse(running.content).view.players.map((p: {color: string}) => p.color)).has.members([alice.color, fakeOf(alice, bob), fakeOf(alice, carol)]);

      finish();
      expect(await isFinished(game)).is.true;
      const ended = await view(alice.id, 'all');

      expect(ended.statusCode, ended.content).eq(statusCode.ok);
      expect(ended.content).includes(BOB).and.includes(CAROL);
      expect(JSON.parse(ended.content).view.players.map((p: {color: string}) => p.color)).has.members([alice.color, bob.color, carol.color]);
    });

    for (const withPassword of [true, false]) {
      it(`refuses every color but the viewer's own the same way while the game runs, ${withPassword ? 'with' : 'without'} the seat password`, async () => {
        await start({playerPasswords: true});
        alice.password = SEAT_PASSWORD;
        const extra = withPassword ? `&password=${SEAT_PASSWORD}` : '';
        const {hidden, unplayed, fakes} = probes();
        expect(hidden, 'a color that was never shown').is.not.empty;
        expect(unplayed).is.not.empty;

        const answers = new Map<string, MockResponse>();
        for (const as of [...hidden, ...fakes, ...unplayed, 'all']) {
          answers.set(as, await view(alice.id, as, 0, extra));
        }

        expect(answers.size).gt(3);
        for (const [as, res] of answers) {
          expect(res.statusCode, `as ${as}`).eq(statusCode.badRequest);
          expect(res.content, `as ${as}`).eq('Bad request: only your own view while the game runs');
        }
        const own = await view(alice.id, alice.color, 0, extra);
        expect(own.statusCode).eq(withPassword ? statusCode.ok : statusCode.unauthorized);
      });
    }
  });

  describe('judge replay view', () => {
    const judgeQuery = (as: string, save = 0, extra = `&password=${JUDGE_PASSWORD}`) =>
      call(ApiReplayView.INSTANCE, 'get', `/api/replay/view?id=${game.judgeId}&save=${save}&as=${as}${extra}`);

    it('as a fake color gives the view of the seat behind it, masked', async () => {
      for (const seat of [alice, bob, carol]) {
        const fake = fakeOf('judge', seat);

        const res = await judgeQuery(fake);

        expect(res.statusCode, `${fake}: ${res.content}`).eq(statusCode.ok);
        for (const name of [ALICE, BOB, CAROL]) {
          expect(res.content, fake).not.includes(name);
        }
        const unmasked = JSON.parse(JSON.stringify(buildReplayView(await loadReplayState(game, 0), game.judgeId!, 0, seat.color, true)));
        expect(JSON.parse(res.content), fake).deep.eq(maskModel(unmasked, incognitoMask(game, game.judgeId!)));
        const body = JSON.parse(res.content);
        expect(body.viewAs).eq(fake);
        expect(body.view.thisPlayer.color).eq(fake);
        expect(body.view.thisPlayer.name).eq(label(fake));
        expect(body.view.id).eq(game.judgeId);
      }
    });

    it('as all shows every seat, masked', async () => {
      const res = await judgeQuery('all');

      expect(res.statusCode, res.content).eq(statusCode.ok);
      const body = JSON.parse(res.content);
      expect(body.viewAs).eq('all');
      expect(body.view.players.map((p: {color: string}) => p.color)).has.members([alice, bob, carol].map((seat) => fakeOf('judge', seat)));
      expect(body.privates.map((p: {color: string}) => p.color)).has.members([alice, bob, carol].map((seat) => fakeOf('judge', seat)));
      for (const name of [ALICE, BOB, CAROL]) {
        expect(res.content).not.includes(name);
      }
    });

    it('refuses a real color that is no fake of the judge as it refuses a color that nobody plays', async () => {
      const {hidden, unplayed, fakes} = probes('judge');
      expect(hidden, 'a seat color that was never shown').is.not.empty;
      expect(unplayed).is.not.empty;
      expect(fakes).has.length(3);

      const answers = new Map<string, MockResponse>();
      for (const as of [...hidden, ...unplayed]) {
        answers.set(as, await judgeQuery(as));
      }

      expect(answers.size).gt(3);
      for (const [as, res] of answers) {
        expect(res.statusCode, `as ${as}`).eq(statusCode.badRequest);
        expect(res.content, `as ${as}`).eq('Bad request: unknown color');
      }
    });

    it('answers a wrong judge password the same way for every color', async () => {
      const {hidden, unplayed, fakes} = probes('judge');

      const answers = new Set<string>();
      for (const as of [...hidden, ...unplayed, ...fakes, 'all']) {
        const res = await judgeQuery(as, 0, '&password=wrongpassword');
        expect(res.statusCode, `as ${as}`).eq(statusCode.unauthorized);
        answers.add(res.content);
      }

      expect(answers.size).eq(1);
    });

    it('at the end shows the real colors, and a fake color then means nothing', async () => {
      const {fakes} = probes('judge');
      finish();
      const real = await judgeQuery(alice.color);

      expect(real.statusCode, real.content).eq(statusCode.ok);
      expect(real.content).includes(ALICE).and.includes(BOB).and.includes(CAROL);
      expect(JSON.parse(real.content).view.thisPlayer.color).eq(alice.color);
      // At the end the judge asks for real colors as everyone does: a color only the mask knew is just a color.
      const unplayedFake = fakes.find((color) => !game.players.some((p) => p.color === color));
      expect(unplayedFake, 'a fake that no seat has').is.not.undefined;
      expect((await judgeQuery(unplayedFake as Color)).statusCode).eq(statusCode.badRequest);
    });
  });

  describe('input', () => {
    function answer(body: unknown): Promise<MockResponse> {
      return call(PlayerInput.INSTANCE, 'post', `/player/input?id=${alice.id}`, body);
    }

    it('SelectPlayer answered with a fake color hits the real player', async () => {
      let picked: IPlayer | undefined;
      alice.setWaitingFor(new SelectPlayer([bob, carol], 'Pick a player').andThen((player) => {
        picked = player;
        return undefined;
      }));

      const res = await answer({type: 'player', player: fakeOf(alice, bob)});

      expect(res.statusCode, res.content).eq(statusCode.ok);
      expect(picked).eq(bob);
    });

    it('SelectPlayer nested in OrOptions', async () => {
      let picked: IPlayer | undefined;
      alice.setWaitingFor(new OrOptions(
        new SelectOption('Skip').andThen(() => undefined),
        new SelectPlayer([bob, carol], 'Pick a player').andThen((player) => {
          picked = player;
          return undefined;
        }),
      ));

      const res = await answer({type: 'or', index: 1, response: {type: 'player', player: fakeOf(alice, carol)}});

      expect(res.statusCode, res.content).eq(statusCode.ok);
      expect(picked).eq(carol);
    });

    it('a recorded answer with a fake color means the same player in a rebuilt game', async () => {
      alice.setWaitingFor(new SelectPlayer([bob, carol], 'Pick a player'));
      const fake = fakeOf(alice, bob);
      expect((await answer({type: 'player', player: fake})).statusCode).eq(statusCode.ok);

      // A rewind rebuilds the game from its saves and plays the recorded answers again.
      const rebuilt = loadSandboxGame(game.serialize());

      expect(game.inputsSinceSave?.at(-1)?.response).deep.eq({type: 'player', player: fake});
      expect(unmaskColor(fake, incognitoMask(rebuilt, alice.id))).eq(bob.color);
    });

    it('SelectPlayer refuses a color that was never shown like any other that is not an option', async () => {
      const {hidden, unplayed} = probes();
      expect(hidden, 'a color that was never shown').is.not.empty;
      const options = [bob];
      const refused = [...hidden, fakeOf(alice, carol), ...unplayed];

      for (const color of refused) {
        alice.setWaitingFor(new SelectPlayer(options, 'Pick a player').andThen(() => undefined));
        const res = await answer({type: 'player', player: color});

        expect(res.statusCode, `as ${color}`).eq(statusCode.badRequest);
        expect(res.content, `as ${color}`).eq('{"message":"Player not available"}');
      }
    });

    it('SelectDelegate refuses a color that was never shown like any other that is not an option', async () => {
      const {hidden, unplayed} = probes();
      expect(hidden, 'a color that was never shown').is.not.empty;
      const refused = [...hidden, fakeOf(alice, carol), ...unplayed];

      for (const color of refused) {
        alice.setWaitingFor(new SelectDelegate([bob, 'NEUTRAL'], 'Pick a delegate').andThen(() => undefined));
        const res = await answer({type: 'delegate', player: color});

        expect(res.statusCode, `as ${color}`).eq(statusCode.badRequest);
        expect(res.content, `as ${color}`).eq('{"message":"Player not available"}');
      }
    });

    it('SelectDelegate answered with a fake color hits the real player, and NEUTRAL stays', async () => {
      const picked: Array<IPlayer | 'NEUTRAL'> = [];
      const select = () => new SelectDelegate([bob, carol, 'NEUTRAL'], 'Pick a delegate').andThen((player) => {
        picked.push(player);
        return undefined;
      });
      alice.setWaitingFor(select());
      expect((await answer({type: 'delegate', player: fakeOf(alice, carol)})).statusCode).eq(statusCode.ok);
      alice.setWaitingFor(select());
      expect((await answer({type: 'delegate', player: 'NEUTRAL'})).statusCode).eq(statusCode.ok);

      expect(picked).deep.eq([carol, 'NEUTRAL']);
    });

    it('land-claim error is masked', async () => {
      const space = game.board.getAvailableSpacesOnLand(alice)[0];
      space.player = bob;
      alice.setWaitingFor(new SelectSpace('Place a greenery', [space]).andThen((chosen) => {
        game.addGreenery(alice, chosen);
        return undefined;
      }));

      const res = await answer({type: 'space', spaceId: space.id});

      expect(res.statusCode).eq(statusCode.badRequest);
      expect(res.content).not.includes(BOB);
      expect(JSON.parse(res.content).message).eq(`This space is land claimed by ${label(fakeOf(alice, bob))}`);
    });

    it('a player who answers last sees the game as it ends', async () => {
      alice.setWaitingFor(new SelectOption('Finish').andThen(() => {
        game.phase = Phase.END;
        return undefined;
      }));

      const res = await answer({type: 'option'});

      expect(res.statusCode, res.content).eq(statusCode.ok);
      expect(res.content).includes(BOB).and.includes(CAROL);
    });
  });

  it('a vote answer is masked, and a no from the viewer keeps the requester\'s fake', async () => {
    const res = await call(ApiRewindVote.INSTANCE, 'post', `/api/rewind/vote?id=${alice.id}`, {action: 'no', voteId: 1});

    expect(res.statusCode, res.content).eq(statusCode.ok);
    const poll = JSON.parse(res.content);
    expect(poll.vote.status).eq('declined');
    expect(poll.vote.requester).eq(fakeOf(alice, bob));
    expect(poll.vote.votes).deep.eq([
      {color: alice.color, choice: 'no'},
      {color: fakeOf(alice, carol), choice: 'pending'},
    ]);
  });

  it('refuses an unclaimed seat\'s replay and vote reads while the game runs as it refuses a wrong password, and leaves the seat unclaimed', async () => {
    await start({playerPasswords: true});
    alice.password = SEAT_PASSWORD;
    const reads = async (player: IPlayer, extra: string) => [
      await call(ApiReplayMoves.INSTANCE, 'get', `/api/replay/moves?id=${player.id}${extra}`),
      ...await Promise.all([player.color, carol.color, 'all'].map((as) => call(ApiReplayView.INSTANCE, 'get', `/api/replay/view?id=${player.id}&save=0&as=${as}${extra}`))),
      await call(ApiRewindVote.INSTANCE, 'get', `/api/rewind/vote?id=${player.id}${extra}`),
      await call(ApiRewindVote.INSTANCE, 'post', `/api/rewind/vote?id=${player.id}${extra}`, {action: 'no', voteId: 1}),
    ];
    const wrongPassword = await reads(alice, '&password=wrongpassword');
    const {unauthorized, badRequest} = statusCode;
    expect(wrongPassword.map((res) => res.statusCode)).deep.eq([unauthorized, unauthorized, badRequest, badRequest, unauthorized, unauthorized]);

    const unclaimed = await reads(bob, '');

    expect(unclaimed.map((res) => [res.statusCode, res.content])).deep.eq(wrongPassword.map((res) => [res.statusCode, res.content]));
    expect(bob.password).is.undefined;

    bob.password = SEAT_PASSWORD;
    const claimed = [
      await call(ApiReplayMoves.INSTANCE, 'get', `/api/replay/moves?id=${bob.id}&password=${SEAT_PASSWORD}`),
      await call(ApiReplayView.INSTANCE, 'get', `/api/replay/view?id=${bob.id}&save=0&as=${bob.color}&password=${SEAT_PASSWORD}`),
      await call(ApiRewindVote.INSTANCE, 'get', `/api/rewind/vote?id=${bob.id}&password=${SEAT_PASSWORD}`),
    ];
    for (const res of claimed) {
      expect(res.statusCode, res.content).eq(statusCode.ok);
      expect(res.content).not.includes(ALICE).and.not.includes(CAROL);
    }
  });

  it('no player id but the viewer\'s own reaches a player or the spectator with Ares on', async () => {
    await start({aresExtension: true});

    const player = await call(ApiPlayer.INSTANCE, 'get', `/api/player?id=${alice.id}`);
    const spectator = await call(ApiSpectator.INSTANCE, 'get', `/api/spectator?id=${game.spectatorId}`);

    expect(player.statusCode, player.content).eq(statusCode.ok);
    expect(spectator.statusCode, spectator.content).eq(statusCode.ok);
    expect(player.content).not.includes(bob.id).and.not.includes(carol.id);
    expect(spectator.content).not.includes(alice.id).and.not.includes(bob.id).and.not.includes(carol.id);
  });

  it('delta project error does not name the color', () => {
    bob.deltaProjectData = undefined;

    expect(() => DeltaProjectExpansion.getValidAdvanceSteps(bob)).to.throw('No Delta Project progress for a player');
  });

  describe('judge', () => {
    const judgeRequest = (handler: Handler, path: string, extra = '') =>
      call(handler, 'get', `${path}?id=${game.judgeId}${credentials(game.judgeId!)}${extra}`);

    /** The owners of the lines as the judge's mapping shows them, which differ from the real ones for more than one seat. */
    function fakeOwners(lines: Array<LogMessage>): Array<Color | undefined> {
      const mask = incognitoMask(game, game.judgeId!)!;
      const owners = lines.map((line) => line.owner);
      expect(new Set(owners.filter((owner) => owner !== undefined)).size, 'private lines of several seats').gt(1);
      return owners.map((owner) => owner === undefined ? undefined : mask.colors.get(owner));
    }

    it('the model shows every seat under the judge\'s own mapping, with every hand', async () => {
      alice.cardsInHand.push(new Ants());

      const res = await judgeRequest(ApiJudge.INSTANCE, '/api/judge');

      expect(res.statusCode, res.content).eq(statusCode.ok);
      const model: JudgeModel = JSON.parse(res.content);
      const seats = game.playersInGenerationOrder;
      expect(model.players.map((p) => p.color)).deep.eq(seats.map((seat) => fakeOf('judge', seat)));
      expect(model.players.map((p) => p.name)).deep.eq(seats.map((seat) => label(fakeOf('judge', seat))));
      expect(model.privates.map((p) => p.color)).deep.eq(model.players.map((p) => p.color));
      expect(model.privates.find((p) => p.color === fakeOf('judge', alice))?.cardsInHand.map((card) => card.name)).deep.eq([CardName.ANTS]);
      expect(model.players.map((p) => p.color)).not.deep.eq(seats.map((seat) => seat.color));
      for (const name of [ALICE, BOB, CAROL]) {
        expect(res.content).not.includes(name);
      }
    });

    it('the mapping is its own, neither the spectator\'s nor a player\'s', () => {
      const fakes = (viewer: IPlayer | 'spectator' | 'judge') => [alice, bob, carol].map((seat) => seat === viewer ? seat.color : fakeOf(viewer, seat));

      expect(fakes('judge')).not.deep.eq(fakes('spectator'));
      expect(fakes('judge')).not.deep.eq(fakes(alice));
    });

    it('the mapping stays the same between requests', async () => {
      const first = await judgeRequest(ApiJudge.INSTANCE, '/api/judge');
      game.log('${0} moved on', (b) => b.player(bob));
      const second = await judgeRequest(ApiJudge.INSTANCE, '/api/judge');

      const colors = (res: MockResponse) => (JSON.parse(res.content) as JudgeModel).players.map((p) => [p.name, p.color]);
      expect(colors(second)).deep.eq(colors(first));
    });

    it('the private log lines carry the owner as the judge\'s fake color', async () => {
      const res = await judgeRequest(ApiGameLogs.INSTANCE, '/api/game/logs');

      expect(res.statusCode, res.content).eq(statusCode.ok);
      const lines: Array<LogMessage> = JSON.parse(res.content);
      const bought = lines.find((line) => line.message === 'You bought ${0}');
      expect(bought?.owner).eq(fakeOf('judge', alice));
      expect(bought?.playerId).is.undefined;
      expect(lines.map((line) => line.owner)).deep.eq(fakeOwners(new GameLogs().getLogsForJudge(game, undefined)));
    });

    it('the replay moves carry the owner as the judge\'s fake color', async () => {
      const res = await judgeRequest(ApiReplayMoves.INSTANCE, '/api/replay/moves');

      expect(res.statusCode, res.content).eq(statusCode.ok);
      const moves = JSON.parse(res.content) as Extract<ReplayMovesModel, {status: 'available'}>;
      const unmasked = await getReplayMoves(game, game.judgeId!) as Extract<ReplayMovesModel, {status: 'available'}>;
      expect(moves.moves.flatMap((move) => move.messages).map((line) => line.owner)).deep.eq(fakeOwners(unmasked.moves.flatMap((move) => move.messages)));
      expect(moves.defaultViewAs).eq('all');
    });

    it('the waiting-for answer lists the pending players by the judge\'s fake colors', async () => {
      const res = await judgeRequest(ApiWaitingFor.INSTANCE, '/api/waitingfor', `&signature=${Server.getJudgeSignature(game)}`);

      expect(res.statusCode, res.content).eq(statusCode.ok);
      const body = JSON.parse(res.content);
      expect(body.result).eq('WAIT');
      expect(body.waitingFor).deep.eq(game.playersInGenerationOrder.map((seat) => fakeOf('judge', seat)));
    });

    it('no player id reaches the judge with Ares on', async () => {
      await start({aresExtension: true});

      const model = await judgeRequest(ApiJudge.INSTANCE, '/api/judge');
      const view = await judgeRequest(ApiReplayView.INSTANCE, '/api/replay/view', '&save=0&as=all');
      const moves = await judgeRequest(ApiReplayMoves.INSTANCE, '/api/replay/moves');
      const logs = await judgeRequest(ApiGameLogs.INSTANCE, '/api/game/logs');

      for (const res of [model, view, moves, logs]) {
        expect(res.statusCode, res.content).eq(statusCode.ok);
        for (const player of game.players) {
          expect(res.content).not.includes(player.id);
        }
      }
    });

    it('a judge link that carries the serverId is masked too', async () => {
      const res = await call(ApiJudge.INSTANCE, 'get', `/api/judge?id=${game.judgeId}&serverId=1`);

      expect(res.statusCode, res.content).eq(statusCode.ok);
      for (const name of [ALICE, BOB, CAROL]) {
        expect(res.content).not.includes(name);
      }
    });

    it('the admin load_game route keeps the real seats while the judge sees the fakes', async () => {
      const req = new MockRequest();
      const res = new MockResponse();
      const scaffolding = new RouteTestScaffolding(req);
      await scaffolding.ctx.gameLoader.add(game);
      scaffolding.url = '/load_game?serverId=1';
      const response = scaffolding.put(LoadGame.INSTANCE, res);
      const body = new Promise((resolve) => setImmediate(resolve)).then(() => {
        req.emitString(JSON.stringify({gameId: game.id, rollbackCount: 0}));
        req.emitter.emit('end');
      });
      await Promise.all([body, response]);

      expect(res.statusCode, res.content).eq(statusCode.ok);
      const loaded = JSON.parse(res.content);
      expect(loaded.players.map((p: {name: string, color: string}) => [p.name, p.color])).deep.eq(
        game.playersInGenerationOrder.map((seat) => [seat.name, seat.color]));
      expect(loaded.activePlayer).eq(game.activePlayer.color);
      const judge = await judgeRequest(ApiJudge.INSTANCE, '/api/judge');
      expect(judge.content).not.includes(ALICE);
    });
  });

  describe('incognito-off games unchanged', () => {
    for (const {route, viewer} of cases) {
      it(`a game without the option answers ${route.name} for the ${viewer} with the model as it is`, async () => {
        await start({incognito: false});
        const fetched = await fetchRoute(route, idOf(viewer));

        expect(fetched.body).deep.eq(fetched.raw);
        if (route.kind === 'names' && carries(route, viewer, false)) {
          expect(fetched.content).includes(BOB).and.includes(CAROL);
        }
      });
    }

    it('a game without the option keeps the land-claim error', async () => {
      await start({incognito: false});
      const space = game.board.getAvailableSpacesOnLand(alice)[0];
      space.player = bob;
      alice.setWaitingFor(new SelectSpace('Place a greenery', [space]).andThen((chosen) => {
        game.addGreenery(alice, chosen);
        return undefined;
      }));

      const res = await call(PlayerInput.INSTANCE, 'post', `/player/input?id=${alice.id}`, {type: 'space', spaceId: space.id});

      expect(res.statusCode).eq(statusCode.badRequest);
      expect(JSON.parse(res.content).message).eq(`This space is land claimed by ${BOB}`);
    });
  });

  describe('rewind vote of a finished game', () => {
    const t = new VoteTable();

    afterEach(() => t.stop());

    it('answers the player who reopens the game with the restored game\'s mapping', async () => {
      await t.start({playerPasswords: true, incognito: true});
      const seat = async (player: IPlayer) => `&password=${(await t.live()).getPlayerById(player.id).password}`;
      maxOutOceans(t.p1);
      setTemperature(t.game, MAX_TEMPERATURE);
      setOxygenLevel(t.game, MAX_OXYGEN_LEVEL);
      t.p1.plants = 0;
      t.p2.plants = 0;
      expect((await t.act(t.p1.id, 'Pass for this generation')).statusCode).eq(statusCode.ok);
      const target = t.rows().length - 1;
      expect((await t.act(t.p2.id, 'Pass for this generation')).statusCode).eq(statusCode.ok);
      await t.game.finishing;
      expect(t.game.phase).eq(Phase.END);
      const asked = await t.post(t.p2.id, {action: 'request', saveId: target, cards: 'same'}, await seat(t.p2));
      expect(asked.statusCode, asked.content).eq(statusCode.ok);
      const voteId = JSON.parse(asked.content).vote.voteId;

      const res = await t.post(t.p1.id, {action: 'yes', voteId}, await seat(t.p1));

      expect(res.statusCode, res.content).eq(statusCode.ok);
      const restored = await t.live();
      expect(restored).is.not.eq(t.game);
      expect(restored.phase).eq(Phase.ACTION);
      const fake = incognitoMask(restored, t.p1.id)!.colors.get(t.p2.color);
      expect(fake).is.not.undefined;
      const poll = JSON.parse(res.content);
      expect(poll.vote.status).eq('passed');
      expect(poll.vote.requester).eq(fake);
      expect(poll.vote.votes).deep.eq([{color: t.p1.color, choice: 'yes'}]);
      expect(fake).not.eq(t.p2.color);
    });
  });
});
