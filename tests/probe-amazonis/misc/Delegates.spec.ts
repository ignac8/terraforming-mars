import {expect} from 'chai';
import {BoardName} from '@/common/boards/BoardName';
import {testGame} from '../../TestGame';
import {runAllActions, addGreenery} from '@tests/TestingUtils';
import {Turmoil} from '@/server/turmoil/Turmoil';
import {SelectParty} from '@/server/inputs/SelectParty';
import {cast} from '@/common/utils/utils';
import {PartyName} from '@/common/turmoil/PartyName';
import {IPlayer} from '@/server/IPlayer';

function drainReserve(turmoil: Turmoil, player: IPlayer, keep: number) {
  // mnemonist MultiSet.set() adds rather than replaces, so remove one at a time.
  while (turmoil.delegateReserve.get(player) > keep) {
    turmoil.delegateReserve.remove(player);
  }
}

describe('probe misc: Amazonis delegates', () => {
  it('BUG: DELEGATE spaces are not offered when the player has no delegates in reserve (Vastitas parity)', () => {
    const [game, player] = testGame(2, {boardName: BoardName.AMAZONIS_PLANITIA, turmoilExtension: true});
    const turmoil = Turmoil.getTurmoil(game);
    drainReserve(turmoil, player, 0);
    const ids = game.board.getAvailableSpacesOnLand(player, {cost: 0}).map((s) => s.id);
    expect(ids).does.not.include('10');
    expect(ids).does.not.include('70');
    expect(ids).does.not.include('72');
  });

  it('BUG: greenery on B2 (single delegate) with 0 delegates in reserve neither prompts nor counts a delegate', () => {
    const [game, player] = testGame(2, {boardName: BoardName.AMAZONIS_PLANITIA, turmoilExtension: true});
    const turmoil = Turmoil.getTurmoil(game);
    drainReserve(turmoil, player, 0);
    addGreenery(player, '10');
    runAllActions(game);
    const waiting = player.popWaitingFor();
    expect(waiting, 'no SelectParty prompt for an impossible delegate').is.undefined;
    expect(player.totalDelegatesPlaced).eq(0);
  });

  it('BUG: H7 (two delegates) with 1 in reserve does not count a second delegate that was never placed', () => {
    const [game, player] = testGame(2, {boardName: BoardName.AMAZONIS_PLANITIA, turmoilExtension: true});
    const turmoil = Turmoil.getTurmoil(game);
    drainReserve(turmoil, player, 1);
    addGreenery(player, '70');
    runAllActions(game);
    cast(player.popWaitingFor(), SelectParty).cb(PartyName.MARS);
    runAllActions(game);
    const inParties = turmoil.parties.reduce((sum, party) => sum + party.delegates.get(player), 0);
    expect(player.totalDelegatesPlaced).eq(inParties);
  });
});
