import {expect} from 'chai';
import {BoardName} from '@/common/boards/BoardName';
import {testGame} from '../../TestGame';
import {runAllActions, setTemperature, setOxygenLevel, setVenusScaleLevel, addOcean, addCity, addGreenery} from '@tests/TestingUtils';
import {ALL_MODULE_MANIFESTS} from '@/server/cards/AllManifests';
import {CardManifest} from '@/server/cards/ModuleManifest';
import {ICard} from '@/server/cards/ICard';
import {TestPlayer} from '@tests/TestPlayer';
import {Units} from '@/common/Units';

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

function snapshot(p: TestPlayer) {
  return {
    tr: p.terraformRating,
    stock: Units.keys.map((k) => p.stock.get(k as any)),
    prod: Units.keys.map((k) => p.production.get(k as any)),
    hand: p.cardsInHand.length,
  };
}
function delta(b: ReturnType<typeof snapshot>, a: ReturnType<typeof snapshot>, wf: string | undefined) {
  return {
    tr: a.tr - b.tr,
    stock: a.stock.map((x, i) => x - b.stock[i]).join(','),
    prod: a.prod.map((x, i) => x - b.prod[i]).join(','),
    hand: a.hand - b.hand,
    wf,
  };
}

function run(boardName: BoardName, makeCard: () => ICard): string {
  try {
    const [game, player, other] = testGame(2, {...baseOptions, boardName, skipInitialShuffling: true});
    setTemperature(game, -10);
    setOxygenLevel(game, 2);
    setVenusScaleLevel(game, 10);
    for (let i = 0; i < 3; i++) addOcean(player);
    addCity(player);
    addCity(other);
    addGreenery(player);
    addGreenery(other);
    runAllActions(game);
    player.megaCredits = 100;
    player.steel = 5; player.titanium = 5; player.plants = 5; player.energy = 5; player.heat = 5;
    other.megaCredits = 100;
    const before = snapshot(player);
    const beforeO = snapshot(other);
    const bt = game.getTemperature(); const bo = game.getOxygenLevel(); const bv = game.getVenusScaleLevel(); const boc = game.board.getOceanSpaces().length;
    const card = makeCard();
    (card as any).play(player);
    runAllActions(game);
    const wf = player.getWaitingFor()?.constructor.name;
    return JSON.stringify({
      me: delta(before, snapshot(player), wf),
      other: delta(beforeO, snapshot(other), other.getWaitingFor()?.constructor.name),
      t: game.getTemperature() - bt, o: game.getOxygenLevel() - bo, v: game.getVenusScaleLevel() - bv,
      oc: game.board.getOceanSpaces().length - boc,
    });
  } catch (e: any) {
    return 'THROW ' + String(e?.message ?? e).split('\n')[0];
  }
}

describe('probe misc: card diff sweep Amazonis vs Tharsis (low state)', function() {
  this.timeout(600000);
  it('card play yields the same observable result on both boards (low state)', () => {
    const diffs: Array<string> = [];
    for (const [name, make] of allCards()) {
      const a = run(BoardName.AMAZONIS_PLANITIA, make);
      const t = run(BoardName.THARSIS, make);
      if (a !== t) diffs.push(`${name}\n   A: ${a}\n   T: ${t}`);
    }
    // Every difference seen is explained, none is a bug:
    //  - Noctis City: no reserved space on Amazonis (forced play without canPlay)
    //  - Giant Solar Shade, Venus L1 Shade: Venus 16 grants a colony on Amazonis, TR on the standard map (per-map track)
    //  - Hermetic Order of Mars, Red Tourism Wave, Sponsored Academies, Road Piracy: prep tile placement landed on
    //    spaces with different bonuses, so hand/steel/empty-area counts differ
    const explained = new Set(['Noctis City', 'Giant Solar Shade', 'Venus L1 Shade', 'Hermetic Order of Mars', 'Red Tourism Wave', 'Sponsored Academies', 'Road Piracy']);
    const unexplained = diffs.filter((d) => !explained.has(d.split('\n')[0]));
    expect(unexplained).deep.eq([]);
  });
});
