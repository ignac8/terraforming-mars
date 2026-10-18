import {expect} from 'chai';
import {BoardName} from '@/common/boards/BoardName';
import {testGame} from '../../TestGame';
import {runAllActions} from '@tests/TestingUtils';
import {cast} from '@/common/utils/utils';
import {SelectSpace} from '@/server/inputs/SelectSpace';
import {MarsNomads} from '@/server/cards/promo/MarsNomads';
import {SelectResource} from '@/server/inputs/SelectResource';
import {MiningGuild} from '@/server/cards/corporation/MiningGuild';
import {GagarinMobileBase} from '@/server/cards/pathfinders/GagarinMobileBase';
import {Turmoil} from '@/server/turmoil/Turmoil';
import {SelectParty} from '@/server/inputs/SelectParty';
import {PartyName} from '@/common/turmoil/PartyName';

const opts = {boardName: BoardName.AMAZONIS_PLANITIA};

describe('probe: Amazonis nomads + std resource', () => {
  it('Mars Nomads onto 35, pick steel: Mining Guild gives no production (per card ruling)', () => {
    const [game, player] = testGame(2, opts);
    player.playedCards.push(new MiningGuild());
    game.nomadSpace = '34';
    const card = new MarsNomads();
    const sel = cast(card.action(player), SelectSpace);
    sel.cb(game.board.getSpaceOrThrow('35'));
    runAllActions(game);
    cast(player.popWaitingFor(), SelectResource).cb('steel');
    runAllActions(game);
    expect(player.production.steel).eq(0);
    expect(player.steel).eq(1);
  });

  it('BUG: Gagarin Mobile Base offered delegate space with empty reserve', () => {
    const [game, player] = testGame(2, {...opts, turmoilExtension: true});
    const turmoil = Turmoil.getTurmoil(game);
    while (turmoil.hasDelegatesInReserve(player)) {
      turmoil.delegateReserve.remove(player);
    }
    const card = new GagarinMobileBase();
    const sel = cast(card.action(player), SelectSpace);
    expect(sel.spaces.map((s) => s.id)).does.not.include('10');
    void SelectParty; void PartyName;
  });
});
