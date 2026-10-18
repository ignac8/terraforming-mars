import {expect} from 'chai';
import {BoardName} from '@/common/boards/BoardName';
import {testGame} from '../../TestGame';
import {runAllActions, addCity, addGreenery} from '@tests/TestingUtils';
import {cast} from '@/common/utils/utils';
import {SelectSpace} from '@/server/inputs/SelectSpace';
import {LavaFlows} from '@/server/cards/base/LavaFlows';
import {LavaTubeSettlement} from '@/server/cards/prelude/LavaTubeSettlement';
import {NoctisCity} from '@/server/cards/base/NoctisCity';
import {Game} from '@/server/Game';
import {Turmoil} from '@/server/turmoil/Turmoil';
import {SelectParty} from '@/server/inputs/SelectParty';
import {PartyName} from '@/common/turmoil/PartyName';
import {MarsNomads} from '@/server/cards/promo/MarsNomads';
import {FrontierTown} from '@/server/cards/prelude2/FrontierTown';
import {GeologicalExpedition} from '@/server/cards/pathfinders/GeologicalExpedition';
import {SelectResource} from '@/server/inputs/SelectResource';
import {OrOptions} from '@/server/inputs/OrOptions';

const opts = {boardName: BoardName.AMAZONIS_PLANITIA};

describe('probe: Amazonis misc space interactions', () => {
  it('Lava Flows only offers the five volcanic spaces', () => {
    const [game, player] = testGame(2, opts);
    const card = new LavaFlows();
    const sel = cast(card.play(player) ?? (runAllActions(game), player.popWaitingFor()), SelectSpace);
    expect(sel.spaces.map((s) => s.id).sort()).deep.eq(['33', '70', '72', '80', '87']);
  });

  it('Lava Tube Settlement offers the five volcanic spaces', () => {
    const [game, player] = testGame(2, opts);
    player.production.override({energy: 1});
    const card = new LavaTubeSettlement();
    card.play(player);
    runAllActions(game);
    const sel = cast(player.popWaitingFor(), SelectSpace);
    expect(sel.spaces.map((s) => s.id).sort()).deep.eq(['33', '70', '72', '80', '87']);
  });

  it('Noctis City is an ordinary city on Amazonis (no reserved area)', () => {
    const [game, player] = testGame(2, opts);
    player.production.override({energy: 1});
    expect(game.board.noctisCitySpaceId).is.undefined;
    const card = new NoctisCity();
    expect(card.canPlay(player)).is.true;
    card.play(player);
    runAllActions(game);
    const sel = cast(player.popWaitingFor(), SelectSpace);
    expect(sel.spaces.length).gt(60);
  });

  it('serialize round trip keeps Amazonis tiles on 70 and 41', () => {
    const [game, player] = testGame(2, {...opts, turmoilExtension: true});
    addGreenery(player, '41');
    addCity(player, '70');
    runAllActions(game);
    const json = JSON.parse(JSON.stringify(game.serialize()));
    const g2 = Game.deserialize(json);
    expect(g2.board.getSpaceOrThrow('70').tile?.tileType).eq(game.board.getSpaceOrThrow('70').tile?.tileType);
    expect(g2.board.getSpaceOrThrow('70').volcanic).is.true;
    expect(g2.board.getSpaceOrThrow('41').bonus).deep.eq(game.board.getSpaceOrThrow('41').bonus);
  });

  it('BUG: Mars Nomads onto delegate space with empty reserve', () => {
    const [game, player] = testGame(2, {...opts, turmoilExtension: true});
    const turmoil = Turmoil.getTurmoil(game);
    while (turmoil.hasDelegatesInReserve(player)) {
      turmoil.delegateReserve.remove(player);
    }
    game.nomadSpace = '11';
    const card = new MarsNomads();
    const sel = cast(card.action(player), SelectSpace);
    const ids = sel.spaces.map((s) => s.id);
    expect(ids).does.not.include('10');
    void SelectParty; void PartyName;
  });

  it('Frontier Town on 70 with Turmoil: sends 6 delegates (3x2), reserve is 7', () => {
    const [game, player] = testGame(2, {...opts, turmoilExtension: true, preludeExtension: false});
    const turmoil = Turmoil.getTurmoil(game);
    const before = turmoil.getAvailableDelegateCount(player);
    const card = new FrontierTown();
    player.production.override({energy: 1});
    card.play(player);
    runAllActions(game);
    const sel = cast(player.popWaitingFor(), SelectSpace);
    sel.cb(game.board.getSpaceOrThrow('70'));
    runAllActions(game);
    // Each SendDelegateToArea asks for a party.
    let asked = 0;
    let input = player.popWaitingFor();
    while (input instanceof SelectParty) {
      asked++;
      input.cb(PartyName.MARS);
      runAllActions(game);
      input = player.popWaitingFor();
    }
    console.log('asked', asked, 'reserve', before, '->', turmoil.getAvailableDelegateCount(player));
    expect(before - turmoil.getAvailableDelegateCount(player)).eq(6);
  });

  it('Geological Expedition on 35 (std resource only): gets two resource prompts', () => {
    const [game, player] = testGame(2, opts);
    player.playedCards.push(new GeologicalExpedition());
    addCity(player, '35');
    runAllActions(game);
    let prompts = 0;
    let input = player.popWaitingFor();
    while (input instanceof SelectResource || input instanceof OrOptions) {
      prompts++;
      if (input instanceof SelectResource) input.cb('plants'); else input.options[0].cb();
      runAllActions(game);
      input = player.popWaitingFor();
    }
    expect(prompts).eq(2);
  });

  it('Geological Expedition on 10 (delegate-only space) gives something (steel fallback?)', () => {
    const [game, player] = testGame(2, opts);
    player.playedCards.push(new GeologicalExpedition());
    const before = player.steel;
    addCity(player, '10');
    runAllActions(game);
    console.log('GE on delegate-only space: steel delta', player.steel - before);
  });
});
