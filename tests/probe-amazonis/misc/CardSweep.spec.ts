import {expect} from 'chai';
import {BoardName} from '@/common/boards/BoardName';
import {testGame} from '../../TestGame';
import {runAllActions, setTemperature, setOxygenLevel, setVenusScaleLevel, addOcean, addCity, addGreenery} from '@tests/TestingUtils';
import {ALL_MODULE_MANIFESTS} from '@/server/cards/AllManifests';
import {CardManifest} from '@/server/cards/ModuleManifest';
import {ICard} from '@/server/cards/ICard';
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
  preludeExtension: true,
  prelude2Expansion: true,
  ceoExtension: true,
  communityCardsOption: true,
  starWarsExpansion: true,
};

type State = 'fresh' | 'mid' | 'late';

function prep(state: State, game: IGame, player: TestPlayer, other: TestPlayer) {
  if (state === 'fresh') return;
  if (state === 'mid') {
    setTemperature(game, -10);
    setOxygenLevel(game, 6);
    setVenusScaleLevel(game, 12);
    for (let i = 0; i < 5; i++) addOcean(player);
    addCity(player);
    addCity(other);
    addGreenery(player);
    addGreenery(other);
  } else {
    setTemperature(game, 8);
    setOxygenLevel(game, 14);
    setVenusScaleLevel(game, 30);
    for (let i = 0; i < 9; i++) addOcean(player);
    addCity(player);
    addCity(other);
    addGreenery(player);
    addGreenery(other);
  }
  runAllActions(game);
}

function allCards(): Array<[string, () => ICard]> {
  const out: Array<[string, () => ICard]> = [];
  for (const m of ALL_MODULE_MANIFESTS) {
    for (const man of [m.projectCards, m.preludeCards, m.ceoCards, m.corporationCards] as Array<CardManifest<any>>) {
      for (const [name, spec] of CardManifest.entries(man)) {
        out.push([name, () => new (spec as any).Factory()]);
      }
    }
  }
  return out;
}

function tryCard(boardName: BoardName, state: State, makeCard: () => ICard): string | undefined {
  try {
    const [game, player, other] = testGame(2, {...baseOptions, boardName});
    prep(state, game, player, other);
    const card = makeCard();
    player.megaCredits = 100;
    if (card.type === 'corporation') {
      (card as any).play(player);
    } else {
      (card as any).play(player);
    }
    runAllActions(game);
    for (let i = 0; i < 5; i++) {
      const wf = player.popWaitingFor();
      if (wf === undefined) break;
    }
    return undefined;
  } catch (e: any) {
    return String(e?.message ?? e).split('\n')[0];
  }
}

describe('probe misc: card sweep Amazonis vs Tharsis (exceptions in play)', function() {
  this.timeout(600000);
  for (const state of ['fresh', 'mid', 'late'] as Array<State>) {
    it(`no card throws on Amazonis that does not throw on Tharsis (${state})`, () => {
      const diffs: Array<string> = [];
      for (const [name, make] of allCards()) {
        const a = tryCard(BoardName.AMAZONIS_PLANITIA, state, make);
        if (a === undefined) continue;
        const t = tryCard(BoardName.THARSIS, state, make);
        // Subterranean Sea: play() without canPlay() has no excavation marker to use. On Tharsis the 9-ocean cap
        // makes PlaceOceanTile bail early; on Amazonis (cap 11) it proceeds. canPlay guards this in real play.
        if (t === undefined && name !== 'Subterranean Sea') diffs.push(`${name}: ${a}`);
      }
      expect(diffs).deep.eq([]);
    });
  }
});
