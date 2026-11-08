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
import {PlayerInput} from '@/server/routes/PlayerInput';
import {Server} from '@/server/models/ServerModel';
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
import {statusCode} from '@/common/http/statusCode';
import {Clock} from '@/common/Timer';
import {ParticipantId, PlayerId} from '@/common/Types';
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

type Viewer = 'player' | 'spectator';

/** A route that answers a player or a spectator, and the model it builds the answer from. */
type Route = {
  name: string;
  viewers: ReadonlyArray<Viewer>;
  /** What the unmasked body shows of the other players: their names and colors, or only their colors. */
  kind: 'names' | 'colors';
  /** The running game's answer to a spectator shows no player. */
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

  function fakeOf(viewer: IPlayer | 'spectator', seat: IPlayer): PlayerColor {
    const id = viewer === 'spectator' ? game.spectatorId : viewer.id;
    return incognitoMask(game, id)!.colors.get(seat.color) as PlayerColor;
  }

  /**
   * The colors that `alice` could send in place of a seat's: those never shown to her, the real colors of the opponents that
   * are no fake of hers and a color that nobody plays, and the fakes she was shown.
   */
  function probes(): {hidden: Array<Color>, unplayed: Array<Color>, fakes: Array<Color>} {
    const mask = incognitoMask(game, alice.id)!;
    const shown = (color: Color) => mask.reverse.has(color);
    return {
      hidden: [bob.color, carol.color].filter((color) => !shown(color)),
      unplayed: PLAYER_COLORS.filter((color) => !game.players.some((p) => p.color === color) && !shown(color)),
      fakes: [...mask.reverse.keys()],
    };
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
    for (const viewer of [alice.id, game.spectatorId]) {
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
        name: 'api/waitingfor',
        viewers: ['player', 'spectator'],
        kind: 'colors',
        request: (id) => {
          // The input route took the prompt of the player before it.
          game.players.forEach((p) => p.setWaitingFor(new SelectOption('Go').andThen(() => undefined)));
          return call(ApiWaitingFor.INSTANCE, 'get', `/api/waitingfor?id=${id}&${counts()}`);
        },
        unmasked: async (id) => ({result: id === game.spectatorId ? 'WAIT' : 'GO', waitingFor: pending()}),
      },
      {
        name: 'api/game/logs',
        viewers: ['player', 'spectator'],
        kind: 'names',
        request: (id) => call(ApiGameLogs.INSTANCE, 'get', `/api/game/logs?id=${id}`),
        unmasked: async (id) => gameLogs.getLogsForGameView(id, game, undefined),
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
        viewers: ['player', 'spectator'],
        kind: 'names',
        emptyForSpectator: true,
        request: (id) => call(ApiReplayMoves.INSTANCE, 'get', `/api/replay/moves?id=${id}`),
        unmasked: (id) => getReplayMoves(game, id),
      },
      {
        name: 'api/replay/view',
        viewers: ['player'],
        kind: 'names',
        request: (id) => call(ApiReplayView.INSTANCE, 'get', `/api/replay/view?id=${id}&save=0&as=${alice.color}`),
        unmasked: async (id) => buildReplayView(await loadReplayState(game, 0), id, 0, alice.color, await isFinished(game)),
      },
    ];
  }

  function idOf(viewer: Viewer): ParticipantId {
    return viewer === 'player' ? alice.id : game.spectatorId;
  }

  // Every route as the player and as the spectator, so a route that forgot to mask fails under its own name.
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

  describe('no opponent name in any player or spectator body', () => {
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

  describe('judge and incognito-off games unchanged', () => {
    it('the judge sees every name and color', async () => {
      const judge = game.judgeId!;
      const gameLogs = new GameLogs();
      const query = `id=${judge}&password=${JUDGE_PASSWORD}`;
      const cases: Array<[string, Promise<MockResponse>, unknown]> = [
        ['api/judge', call(ApiJudge.INSTANCE, 'get', `/api/judge?${query}`), Server.getJudgeModel(game)],
        ['api/game/logs', call(ApiGameLogs.INSTANCE, 'get', `/api/game/logs?${query}`), gameLogs.getLogsForJudge(game, undefined)],
        [
          'api/waitingfor',
          call(ApiWaitingFor.INSTANCE, 'get', `/api/waitingfor?${query}&signature=${Server.getJudgeSignature(game)}`),
          {result: 'WAIT', waitingFor: pending()},
        ],
        ['api/replay/moves', call(ApiReplayMoves.INSTANCE, 'get', `/api/replay/moves?${query}`), await getReplayMoves(game, judge)],
        [
          'api/replay/view',
          call(ApiReplayView.INSTANCE, 'get', `/api/replay/view?${query}&save=0&as=all`),
          buildReplayView(await loadReplayState(game, 0), judge, 0, 'all', true),
        ],
      ];

      for (const [name, pendingResponse, model] of cases) {
        const res = await pendingResponse;

        expect(res.statusCode, `${name}: ${res.content}`).eq(statusCode.ok);
        expect(JSON.parse(res.content), name).deep.eq(JSON.parse(JSON.stringify(model)));
      }
      const logs = await call(ApiGameLogs.INSTANCE, 'get', `/api/game/logs?${query}`);
      expect(logs.content).includes(BOB).and.includes(CAROL);
    });

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
