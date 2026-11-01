import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {Color} from '../../src/common/Color';
import {InputResponse} from '../../src/common/inputs/InputResponse';
import {Phase} from '../../src/common/Phase';
import {ReplayMove, ReplayMovesModel} from '../../src/common/replay/ReplayModel';
import {PlayerId} from '../../src/common/Types';
import {cast} from '../../src/common/utils/utils';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {SerializedGame} from '../../src/server/SerializedGame';
import {autoPicksOf, draftHandsOf, DraftHands, PlayerPick, picksOf} from '../../src/server/replay/picks';
import {clearReplayCache, getReplayMoves} from '../../src/server/replay/ReplayService';
import {RecordedInput} from '../../src/server/rewind/RecordedInput';
import {restoreTestDatabase, setTestDatabase} from '../testing/setup';
import {SnapshotDatabase} from '../testing/SnapshotDatabase';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {finishGeneration} from '../TestingUtils';

const a = 'p-a' as PlayerId;
const b = 'p-b' as PlayerId;

function recorded(playerId: PlayerId, response: InputResponse): RecordedInput {
  return {playerId, prompt: {type: response.type === 'card' ? 'card' : 'or', title: 'x'}, response, stateHash: 'h'};
}

describe('picksOf', () => {
  it('lists one entry per card answer, in the order they were given', () => {
    const picks = picksOf([
      recorded(a, {type: 'card', cards: [CardName.FISH]}),
      recorded(b, {type: 'card', cards: [CardName.CAPITAL, CardName.HACKERS]}),
    ]);
    expect(picks).deep.eq([
      {playerId: a, cards: [CardName.FISH]},
      {playerId: b, cards: [CardName.CAPITAL, CardName.HACKERS]},
    ]);
  });

  it('finds card answers inside or, and and initialCards answers', () => {
    const picks = picksOf([
      recorded(a, {type: 'or', index: 1, response: {type: 'and', responses: [{type: 'option'}, {type: 'card', cards: [CardName.TREES]}]}}),
      recorded(b, {
        type: 'initialCards',
        responses: [
          {type: 'card', cards: [CardName.ECOLINE]},
          {type: 'card', cards: [CardName.DONATION, CardName.GALILEAN_MINING]},
          {type: 'card', cards: []},
        ],
      }),
    ]);
    expect(picks).deep.eq([
      {playerId: a, cards: [CardName.TREES]},
      {playerId: b, cards: [CardName.ECOLINE]},
      {playerId: b, cards: [CardName.DONATION, CardName.GALILEAN_MINING]},
      {playerId: b, cards: []},
    ]);
  });

  it('skips the answers that choose no cards, and copies the cards', () => {
    const response: InputResponse = {type: 'card', cards: [CardName.FISH]};
    const picks = picksOf([
      recorded(a, {type: 'option'}),
      recorded(a, {type: 'or', index: 0, response: {type: 'space', spaceId: '03'}}),
      recorded(a, response),
    ]);
    expect(picks).has.length(1);
    expect(picks[0].cards).not.eq((response as {cards: Array<CardName>}).cards);
  });

  it('is empty when nothing was recorded', () => {
    expect(picksOf(undefined)).is.empty;
    expect(picksOf([])).is.empty;
  });
});

describe('autoPicksOf', () => {
  let base: SerializedGame;

  beforeEach(() => {
    const [game] = testGame(3);
    base = game.serialize();
  });

  // The ids of the players of `base`, in seat order.
  const seats = (): Array<PlayerId> => base.players.map((p) => p.id);

  // `after` holds the given cards in the given list of every player.
  function after(list: 'draftedCards' | 'dealtProjectCards' | 'dealtPreludeCards' | 'dealtCeoCards', cards: Array<Array<CardName>>): SerializedGame {
    const state = structuredClone(base);
    state.players.forEach((p, i) => {
      p.draftedCards = [];
      p.dealtProjectCards = [];
      p.dealtPreludeCards = [];
      p.dealtCeoCards = [];
      p[list] = cards[i];
    });
    return state;
  }

  // Everyone else has picked and left one card, and the player at `picker` has two cards and is to pick.
  function lastRound(picker: number): DraftHands {
    const [x, y, z] = seats();
    const hands = [
      [CardName.FISH],
      [CardName.CAPITAL],
      [CardName.HACKERS],
    ];
    hands[picker] = [...hands[picker], CardName.TREES];
    return [x, y, z].map((playerId, i) => ({playerId, needsToDraft: i === picker, hand: hands[i]}));
  }

  it('gives each player the last card of the hand they take from, wherever the end of the round put it', () => {
    const [x, y, z] = seats();
    const picks: Array<PlayerPick> = [{playerId: y, cards: [CardName.TREES]}];
    // Whichever way the round passes, each card is found in the list of the player it was handed to.
    for (const list of ['draftedCards', 'dealtProjectCards', 'dealtPreludeCards', 'dealtCeoCards'] as const) {
      const auto = autoPicksOf(lastRound(1), picks, after(list, [[CardName.CAPITAL], [CardName.HACKERS], [CardName.FISH]]));
      expect(auto, list).deep.eq([
        {playerId: x, cards: [CardName.CAPITAL], auto: true},
        {playerId: y, cards: [CardName.HACKERS], auto: true},
        {playerId: z, cards: [CardName.FISH], auto: true},
      ]);
    }
  });

  it('does not hand over the card the picker chose', () => {
    const [x, y, z] = seats();
    const auto = autoPicksOf(lastRound(0), [{playerId: x, cards: [CardName.FISH]}], after('draftedCards', [[CardName.TREES, CardName.FISH], [CardName.HACKERS], [CardName.CAPITAL]]));
    expect(auto.map((p) => p.cards)).deep.eq([[CardName.TREES], [CardName.HACKERS], [CardName.CAPITAL]]);
    expect(auto.map((p) => p.playerId)).deep.eq([x, y, z]);
  });

  it('is empty while more than one card is left in the hand of the picker', () => {
    const [x, y, z] = seats();
    const hands: DraftHands = [
      {playerId: x, needsToDraft: false, hand: [CardName.FISH, CardName.TREES]},
      {playerId: y, needsToDraft: false, hand: [CardName.CAPITAL, CardName.ECOLINE]},
      {playerId: z, needsToDraft: true, hand: [CardName.HACKERS, CardName.DONATION, CardName.MINE]},
    ];
    expect(autoPicksOf(hands, [{playerId: z, cards: [CardName.MINE]}], after('draftedCards', [[], [], []]))).is.empty;
  });

  it('hands over the last card after a pick of two cards when one is left', () => {
    const [x, y, z] = seats();
    const hands: DraftHands = [
      {playerId: x, needsToDraft: false, hand: [CardName.FISH]},
      {playerId: y, needsToDraft: false, hand: [CardName.CAPITAL]},
      {playerId: z, needsToDraft: true, hand: [CardName.HACKERS, CardName.DONATION, CardName.MINE]},
    ];
    const auto = autoPicksOf(hands, [{playerId: z, cards: [CardName.MINE, CardName.DONATION]}], after('draftedCards', [[CardName.HACKERS], [CardName.FISH], [CardName.CAPITAL]]));
    expect(auto.map((p) => [p.playerId, p.cards])).deep.eq([[x, [CardName.HACKERS]], [y, [CardName.FISH]], [z, [CardName.CAPITAL]]]);
  });

  it('is empty while another player has yet to pick, or when the picker made no pick', () => {
    const [x, y] = seats();
    const lastTwo = lastRound(0).map((p, i) => i === 1 ? {...p, needsToDraft: true} : p);
    const state = after('draftedCards', [[CardName.CAPITAL], [CardName.HACKERS], [CardName.FISH]]);
    expect(autoPicksOf(lastTwo, [{playerId: x, cards: [CardName.FISH]}], state)).is.empty;
    expect(autoPicksOf(lastRound(0), [{playerId: y, cards: [CardName.CAPITAL]}], state)).is.empty;
    expect(autoPicksOf(undefined, [{playerId: x, cards: [CardName.FISH]}], state)).is.empty;
  });

  it('leaves out a player who was handed nothing, and cards that landed nowhere', () => {
    const [x, y] = seats();
    // The card of the third player is nowhere, and the first player holds none of the cards.
    const auto = autoPicksOf(lastRound(0), [{playerId: x, cards: [CardName.FISH]}], after('draftedCards', [[], [CardName.CAPITAL, CardName.TREES], []]));
    expect(auto).deep.eq([{playerId: y, cards: [CardName.TREES, CardName.CAPITAL], auto: true}]);
  });
});

describe('draftHandsOf', () => {
  it('holds the hands of a save in the middle of a draft round, and nothing for any other save', () => {
    const [game] = testGame(2);
    const state = game.serialize();
    expect(draftHandsOf(state)).is.undefined;

    state.phase = Phase.DRAFTING;
    expect(draftHandsOf(state), 'nobody waits').is.undefined;

    state.players[1].needsToDraft = true;
    state.players[1].draftHand = [CardName.FISH];
    expect(draftHandsOf(state)).deep.eq([
      {playerId: state.players[0].id, needsToDraft: false, hand: []},
      {playerId: state.players[1].id, needsToDraft: true, hand: [CardName.FISH]},
    ]);

    state.phase = Phase.ACTION;
    expect(draftHandsOf(state)).is.undefined;
  });
});

describe('draft picks in a replay', () => {
  let db: SnapshotDatabase;
  let game: IGame;
  let players: Array<TestPlayer>;

  type Available = Extract<ReplayMovesModel, {status: 'available'}>;

  beforeEach(() => {
    db = new SnapshotDatabase();
    setTestDatabase(db);
    clearReplayCache();
  });

  afterEach(() => {
    restoreTestDatabase();
    clearReplayCache();
  });

  function pick(who: IPlayer): CardName {
    const name = cast(who.getWaitingFor(), SelectCard).cards[0].name;
    who.process({type: 'card', cards: [name]});
    return name;
  }

  // Every player picks once, in seat order.
  function round() {
    for (const who of players) {
      pick(who);
    }
  }

  async function movesOf(viewerId: string): Promise<Array<ReplayMove>> {
    const history = await getReplayMoves(game, viewerId as PlayerId);
    expect(history.status).eq('available');
    return (history as Available).moves;
  }

  // The picks of the moves, as [colour, auto] and the cards.
  function entries(moves: Array<ReplayMove>, color?: Color) {
    return moves.flatMap((m) => m.picks ?? []).filter((p) => color === undefined || p.color === color);
  }

  function finish() {
    const rows = db.games.get(game.id)!;
    rows[rows.length - 1] = {...rows[rows.length - 1]!, phase: Phase.END};
    game.phase = Phase.END;
  }

  describe('of the project draft', () => {
    beforeEach(() => {
      [game, ...players] = testGame(3, {draftVariant: true, undoOption: true, judgeLink: true, judgeUndo: true});
      game.generation = 1;
      // This moves into the draft phase.
      finishGeneration(game);
    });

    // Plays three rounds, which draft three of the four cards.
    function draft() {
      for (let i = 0; i < 3; i++) {
        round();
      }
    }

    it('puts each pick on the move it was made from, and the cards handed over on the last pick', async () => {
      draft();

      const moves = await movesOf(game.judgeId!);

      const picked = moves.filter((m) => m.picks !== undefined);
      expect(picked).has.length(9);
      expect(picked.map((m) => m.picks!.filter((p) => !p.auto).length)).deep.eq(Array(9).fill(1));
      expect(picked.map((m) => m.picks![0].color)).deep.eq(players.map((p) => p.color).concat(players.map((p) => p.color), players.map((p) => p.color)));
      // Each pick leaves a move of its own that logged nothing.
      expect(picked.every((m) => m.silent === true)).is.true;
      const handed = picked.filter((m) => m.picks!.some((p) => p.auto));
      expect(handed).has.length(1);
      expect(handed[0]).eq(picked[8]);
      expect(handed[0].picks!.map((p) => [p.color, p.auto])).deep.eq([
        [players[2].color, undefined],
        [players[0].color, true],
        [players[1].color, true],
        [players[2].color, true],
      ]);
    });

    it('hands each player exactly the card that research then offers besides their picks', async () => {
      draft();

      const picks = entries(await movesOf(game.judgeId!));

      for (const who of players) {
        const offered = cast(who.getWaitingFor(), SelectCard).cards.map((card) => card.name);
        const own = picks.filter((p) => p.color === who.color);
        expect(offered).has.length(4);
        expect(own.filter((p) => p.auto)).has.length(1);
        expect(own.flatMap((p) => p.cards)).has.members(offered);
        expect(own.flatMap((p) => p.cards)).has.length(4);
      }
    });

    it('keeps the cards handed over when the list is read again during the draft', async () => {
      round();
      round();
      for (const who of players.slice(0, 2)) {
        pick(who);
      }
      const before = await movesOf(game.judgeId!);
      expect(entries(before).some((p) => p.auto)).is.false;

      pick(players[2]);
      const after = await movesOf(game.judgeId!);

      expect(entries(after).filter((p) => p.auto)).has.length(3);
      expect(entries(after)).has.length(12);
    });

    it('shows a player of a running game only their own picks, and the judge every pick', async () => {
      draft();

      expect(entries(await movesOf(game.judgeId!))).has.length(12);
      for (const who of players) {
        const own = entries(await movesOf(who.id));
        expect(own, who.color).has.length(4);
        expect(own.every((p) => p.color === who.color)).is.true;
        expect(own.filter((p) => p.auto)).has.length(1);
      }
      // A spectator may not browse a running game.
      expect(await getReplayMoves(game, game.spectatorId)).deep.eq({status: 'not-finished'});
    });

    it('does not show a player the picks of another through their moves', async () => {
      draft();

      const json = JSON.stringify(await movesOf(players[0].id));
      expect(json).not.contains(`"color":"${players[1].color}"`);
      expect(json).not.contains(`"color":"${players[2].color}"`);
    });

    it('shows everyone every pick once the game is finished', async () => {
      draft();
      finish();

      const judge = entries(await movesOf(game.judgeId!));
      expect(judge).has.length(12);
      expect(new Set(judge.map((p) => p.color)).size).eq(3);
      for (const viewer of [players[0].id, players[1].id, game.spectatorId]) {
        expect(entries(await movesOf(viewer)), viewer).deep.eq(judge);
      }
    });

    it('gives the newest move the cards a player kept in research since the last save, to that player and the judge', async () => {
      draft();
      players[0].megaCredits = 10;
      const offered = cast(players[0].getWaitingFor(), SelectCard).cards[0].name;
      const started = Date.now();
      players[0].process({type: 'card', cards: [offered]});

      const newest = (moves: Array<ReplayMove>) => moves[moves.length - 1];
      const forJudge = newest(await movesOf(game.judgeId!));
      expect(forJudge.picks).deep.eq([{color: players[0].color, cards: [offered]}]);
      expect(forJudge.at).gte(started);
      expect(newest(await movesOf(players[0].id)).picks).deep.eq(forJudge.picks);
      expect(newest(await movesOf(players[1].id)).picks).is.undefined;
    });

    it('records when each pick was made', async () => {
      const originalNow = Date.now;
      let now = 5_000_000;
      Date.now = () => (now += 250);
      try {
        draft();
      } finally {
        Date.now = originalNow;
      }

      const rows = db.games.get(game.id)!.filter((row) => row !== undefined);
      const moves = await movesOf(game.judgeId!);

      const picked = moves.filter((m) => m.picks !== undefined);
      expect(picked.map((m) => m.at)).deep.eq(rows.filter((row) => row.inputs!.length > 0).map((row) => row.inputs![0].at));
      expect(picked.every((m) => m.at !== undefined && m.at > 5_000_000)).is.true;
      expect(picked.map((m) => m.at!)).deep.eq([...picked.map((m) => m.at!)].sort((x, y) => x - y));
    });
  });

  describe('of the initial draft', () => {
    it('finds the cards handed over where the end of the draft put them', async () => {
      [game, ...players] = testGame(2, {tournamentExpansion: true, initialDraftVariant: true, skipInitialCardSelection: false, judgeLink: true, judgeUndo: true});
      // 9 rounds; the last card of each hand passes automatically.
      for (let i = 0; i < 9; i++) {
        round();
      }

      const picks = entries(await movesOf(game.judgeId!));

      expect(picks.filter((p) => p.auto)).has.length(2);
      for (const who of players) {
        const own = picks.filter((p) => p.color === who.color).flatMap((p) => p.cards);
        expect(own).has.length(10);
        expect(own).has.members(who.dealtProjectCards.map((card) => card.name));
      }
    });
  });
});
