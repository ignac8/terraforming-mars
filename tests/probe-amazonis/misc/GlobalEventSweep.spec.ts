import {expect} from 'chai';
import {BoardName} from '@/common/boards/BoardName';
import {testGame} from '../../TestGame';
import {runAllActions, setTemperature, setOxygenLevel, setVenusScaleLevel, addOcean, addCity, addGreenery} from '@tests/TestingUtils';
import {getGlobalEventByName} from '@/server/turmoil/globalEvents/GlobalEventDealer';
import {GlobalEventName} from '@/common/turmoil/globalEvents/GlobalEventName';
import {IGame} from '@/server/IGame';
import {TestPlayer} from '@tests/TestPlayer';

const baseOptions = {
  promoCardsOption: true,
  venusNextExtension: true,
  pathfindersExpansion: true,
  coloniesExtension: true,
  turmoilExtension: true,
  underworldExpansion: true,
  moonExpansion: true,
  aresExtension: true,
  preludeExtension: true,
  prelude2Expansion: true,
  ceoExtension: true,
  communityCardsOption: true,
};

function prep(state: string, game: IGame, player: TestPlayer, other: TestPlayer) {
  if (state === 'fresh') return;
  if (state === 'mid') {
    setTemperature(game, -10);
    setOxygenLevel(game, 6);
    setVenusScaleLevel(game, 12);
    for (let i = 0; i < 5; i++) addOcean(player);
  } else {
    setTemperature(game, 8);
    setOxygenLevel(game, 14);
    setVenusScaleLevel(game, 30);
    for (let i = 0; i < 9; i++) addOcean(player);
  }
  addCity(player);
  addCity(other);
  addGreenery(player);
  addGreenery(other);
  runAllActions(game);
}

function run(boardName: BoardName, state: string, name: GlobalEventName): string | undefined {
  try {
    const [game, player, other] = testGame(2, {...baseOptions, boardName});
    prep(state, game, player, other);
    player.megaCredits = 50;
    other.megaCredits = 50;
    player.heat = 10; player.plants = 10;
    const ev = getGlobalEventByName(name)!;
    ev.resolve(game);
    runAllActions(game);
    return undefined;
  } catch (e: any) {
    return String(e?.message ?? e).split('\n')[0];
  }
}

describe('probe misc: global event sweep', function() {
  this.timeout(120000);
  for (const state of ['fresh', 'mid', 'late']) {
    it(`no global event throws only on Amazonis (${state})`, () => {
      const diffs: Array<string> = [];
      for (const name of Object.values(GlobalEventName)) {
        const a = run(BoardName.AMAZONIS_PLANITIA, state, name);
        if (a === undefined) continue;
        const t = run(BoardName.THARSIS, state, name);
        if (t === undefined) diffs.push(`${name}: ${a}`);
      }
      expect(diffs).deep.eq([]);
    });
  }
});
