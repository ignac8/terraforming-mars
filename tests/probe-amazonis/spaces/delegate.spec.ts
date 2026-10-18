import {expect} from 'chai';
import {BoardName} from '@/common/boards/BoardName';
import {testGame} from '../../TestGame';
import {runAllActions, addGreenery} from '@tests/TestingUtils';
import {Turmoil} from '@/server/turmoil/Turmoil';
import {SpaceBonus} from '@/common/boards/SpaceBonus';
import {SelectParty} from '@/server/inputs/SelectParty';
import {PartyName} from '@/common/turmoil/PartyName';

describe('probe: Amazonis delegate spaces', () => {
  it('BUG: delegate space offered to player with 0 delegates in reserve (VBN filters it)', () => {
    const [game, player] = testGame(2, {boardName: BoardName.AMAZONIS_PLANITIA, turmoilExtension: true});
    const turmoil = Turmoil.getTurmoil(game);
    while (turmoil.hasDelegatesInReserve(player)) {
      turmoil.delegateReserve.remove(player);
    }
    const delegateSpaces = game.board.spaces.filter((s) => s.bonus.includes(SpaceBonus.DELEGATE)).map((s) => s.id);
    const avail = game.board.getAvailableSpacesOnLand(player, {cost: 0}).map((s) => s.id);
    for (const id of delegateSpaces) {
      expect(avail, `delegate space ${id} available with empty reserve`).does.not.include(id);
    }
  });

  it('BUG: placing on delegate space with empty reserve counts a delegate that was never sent', () => {
    const [game, player] = testGame(2, {boardName: BoardName.AMAZONIS_PLANITIA, turmoilExtension: true});
    const turmoil = Turmoil.getTurmoil(game);
    while (turmoil.hasDelegatesInReserve(player)) {
      turmoil.delegateReserve.remove(player);
    }
    const before = player.totalDelegatesPlaced;
    addGreenery(player, '10');
    runAllActions(game);
    const input = player.popWaitingFor();
    if (input instanceof SelectParty) {
      input.cb(PartyName.MARS);
    }
    const party = turmoil.getPartyByName(PartyName.MARS);
    expect(party.delegates.get(player)).eq(0);
    expect(player.totalDelegatesPlaced, 'totalDelegatesPlaced counted though no delegate sent').eq(before);
  });

  it('BUG: double delegate space (70) with 1 delegate in reserve counts 2 but sends 1', () => {
    const [game, player] = testGame(2, {boardName: BoardName.AMAZONIS_PLANITIA, turmoilExtension: true});
    const turmoil = Turmoil.getTurmoil(game);
    while (turmoil.getAvailableDelegateCount(player) > 1) {
      turmoil.delegateReserve.remove(player);
    }
    const before = player.totalDelegatesPlaced;
    addGreenery(player, '70');
    runAllActions(game);
    const input = player.popWaitingFor();
    (input as SelectParty).cb(PartyName.MARS);
    const party = turmoil.getPartyByName(PartyName.MARS);
    expect(party.delegates.get(player)).eq(1);
    expect(player.totalDelegatesPlaced - before, 'totalDelegatesPlaced increment').eq(1);
  });
});
