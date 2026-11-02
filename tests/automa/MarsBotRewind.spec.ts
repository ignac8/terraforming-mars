import {expect} from 'chai';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {SerializedGame} from '../../src/server/SerializedGame';
import {GameLoader} from '../../src/server/database/GameLoader';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {clearReplayCache} from '../../src/server/replay/ReplayService';
import {rewindGame, rewindMetrics} from '../../src/server/rewind/RewindService';
import {BoardName} from '../../src/common/boards/BoardName';
import {CardName} from '../../src/common/cards/CardName';
import {Phase} from '../../src/common/Phase';
import {cast} from '../../src/common/utils/utils';
import {restoreTestDatabase, restoreTestGameLoader, setTestDatabase} from '../testing/setup';
import {SnapshotDatabase} from '../testing/SnapshotDatabase';
import {TestPlayer} from '../TestPlayer';
import {testGame} from '../TestingUtils';

function choose(p: IPlayer, title: string) {
  const action = cast(p.getWaitingFor(), OrOptions);
  p.process({type: 'or', index: action.options.findIndex((option) => option.title === title), response: {type: 'option'}});
}

function offered(p: IPlayer): Array<CardName> {
  return cast(p.getWaitingFor(), SelectCard).cards.map((card) => card.name);
}

async function rebuilds(result: string): Promise<number> {
  return (await rewindMetrics.rebuilds.get()).values.find((v) => v.labels.result === result)?.value ?? 0;
}

describe('Rewinding a MarsBot game', () => {
  let db: SnapshotDatabase;
  let game: IGame;
  let player: TestPlayer;
  // The second generation's research save, which comes before MarsBot's draft deals.
  let research: number;
  // The cards the first draft round of that generation offered.
  let firstPile: Array<CardName>;
  // Where the random generator stood when that pile was offered.
  let firstSeed: number;
  // The action prompt after the draft and one heat conversion.
  let convert: number;

  const rows = () => db.games.get(game.id) as Array<SerializedGame>;

  beforeEach(async () => {
    clearReplayCache();
    db = new SnapshotDatabase();
    setTestDatabase(db);
    [game, player] = testGame(1, {undoOption: true, automa: true, automaDifficulty: 'easy', boardName: BoardName.THARSIS, draftVariant: true});
    await GameLoader.getInstance().add(game);
    player.heat = 40;
    player.takeAction();
    choose(player, 'Pass for this generation');
    expect(game.phase).eq(Phase.RESEARCH);
    research = game.lastSaveId - 1;
    firstPile = offered(player);
    firstSeed = game.rng.current;
    // Every draft pick, against MarsBot's random ones, then the buy.
    while (cast(player.getWaitingFor(), SelectCard).title.toString().startsWith('Draft round')) {
      player.process({type: 'card', cards: [offered(player)[0]]});
    }
    player.process({type: 'card', cards: []});
    choose(player, 'Convert 8 heat into temperature');
    convert = game.lastSaveId - 1;
    choose(player, 'Convert 8 heat into temperature');
  });

  afterEach(() => {
    restoreTestDatabase();
    restoreTestGameLoader();
  });

  it('offers the same first draft pile again with the same cards', async () => {
    const restored = await rewindGame(game, player, research, 'same');

    expect(offered(restored.getPlayerById(player.id))).deep.eq(firstPile);
    expect(restored.rng.current).eq(firstSeed);
  });

  it('replays MarsBot\'s draft picks to a later move without a mismatch', async () => {
    const replayed = await rebuilds('replayed');
    const mismatches = await rebuilds('mismatch');
    const saved = structuredClone(rows()[convert]);

    const restored = await rewindGame(game, player, convert, 'same');

    expect(await rebuilds('replayed')).eq(replayed + 1);
    expect(await rebuilds('mismatch')).eq(mismatches);
    expect(restored.getPlayerById(player.id).heat).eq(saved.players[0].heat);
    expect(restored.automaHooks!.marsBot.serialize()).deep.eq(saved.automaState);
  });

  it('brings back the moves an earlier rewind undid, MarsBot\'s draft picks with them', async () => {
    // The first rewind undid the draft and both conversions.
    const first = await rewindGame(game, player, research, 'same');
    const mismatches = await rebuilds('mismatch');
    const saved = structuredClone(rows()[convert]);

    const restored = await rewindGame(first, first.getPlayerById(player.id), convert, 'same');

    expect(await rebuilds('mismatch')).eq(mismatches);
    expect(restored.getPlayerById(player.id).heat).eq(saved.players[0].heat);
    expect(restored.automaHooks!.marsBot.serialize()).deep.eq(saved.automaState);
    expect(restored.gameLog[restored.gameLog.length - 1].message).eq('${0} brought back undone moves and rewound the game to generation ${1}');
  });
});
