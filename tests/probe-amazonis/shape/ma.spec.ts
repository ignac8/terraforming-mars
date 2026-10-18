import {expect} from 'chai';
import {BoardName} from '@/common/boards/BoardName';
import {testGame} from '@tests/TestGame';
import {runAllActions} from '@tests/TestingUtils';
import {OrOptions} from '@/server/inputs/OrOptions';
import {SelectOption} from '@/server/inputs/SelectOption';
import {SelectPayment} from '@/server/inputs/SelectPayment';
import {Payment} from '@/common/inputs/Payment';
import {Turmoil} from '@/server/turmoil/Turmoil';
import {PartyName} from '@/common/turmoil/PartyName';
import {cast} from '@/common/utils/utils';
import {Lobbyist} from '@/server/milestones/modular/Lobbyist';
import {Merchant3} from '@/server/milestones/Merchant3';
import {Merchant} from '@/server/milestones/modular/Merchant';
import {IPlayer} from '@/server/IPlayer';
import {addGreenery} from '@tests/TestingUtils';

function claimOption(player: IPlayer, name: string) {
  const actions = cast((player as any).getActions(), OrOptions);
  const claim = cast(actions.options.find((o) => (o as OrOptions).title === 'Claim a milestone'), OrOptions);
  return cast(claim.options.find((o) => (o as SelectOption).title === name), SelectOption);
}

describe('probe shape: milestones/awards', () => {
  it('BUG: claiming Merchant3 (Helion) does not enforce the 3-of-each reserve in SelectPayment', () => {
    const [game, player] = testGame(2, {boardName: BoardName.AMAZONIS_PLANITIA});
    expect(game.milestones.map((m) => m.name)).includes('Merchant3');
    player.canUseHeatAsMegaCredits = true;
    player.stock.override({megacredits: 3, heat: 11, steel: 3, titanium: 3, plants: 3, energy: 3});
    const m3 = new Merchant3();
    expect(m3.canClaim(player)).is.true;

    const opt = claimOption(player, 'Merchant3');
    opt.cb(undefined);
    runAllActions(game);
    const pay = cast(player.popWaitingFor(), SelectPayment);
    // 3 MC + 5 heat = 8 pays the cost but spends the 3 reserved M€ (leaves 0 M€, 3 required)
    expect(() => pay.process({type: 'payment', payment: Payment.of({megacredits: 3, heat: 5})}, player)).to.throw();
  });

  it('control: Merchant (2 of each) reserve IS enforced via claim flow', () => {
    const [game, player] = testGame(2);
    const merchant = new Merchant();
    player.canUseHeatAsMegaCredits = true;
    player.stock.override({megacredits: 2, heat: 10, steel: 2, titanium: 2, plants: 2, energy: 2});
    expect(merchant.canClaim(player)).is.true;
    game.milestones.length = 0;
    game.milestones.push(merchant);
    const opt = claimOption(player, 'Merchant');
    opt.cb(undefined);
    runAllActions(game);
    const pay = cast(player.popWaitingFor(), SelectPayment);
    expect(() => pay.process({type: 'payment', payment: Payment.of({megacredits: 2, heat: 6})}, player)).to.throw();
  });

  it('BUG: Lobbyist (needs Turmoil delegates) is not offered as a dead milestone in a non-Turmoil Amazonis Planitia game', () => {
    const [game] = testGame(2, {boardName: BoardName.AMAZONIS_PLANITIA});
    expect(game.turmoil).is.undefined;
    expect(game.milestones.map((m) => m.name)).does.not.include('Lobbyist');
    void Lobbyist;
  });

  it('BUG: delegate bonus with empty delegate reserve is a no-op but is logged/counted as sent', () => {
    const [game, player] = testGame(2, {boardName: BoardName.AMAZONIS_PLANITIA, turmoilExtension: true});
    const turmoil = Turmoil.getTurmoil(game);
    // put all but one of player's delegates in parties
    const parties = [PartyName.MARS, PartyName.GREENS, PartyName.REDS, PartyName.KELVINISTS, PartyName.SCIENTISTS, PartyName.UNITY];
    for (let i = 0; i < 6; i++) turmoil.sendDelegateToParty(player, parties[i], game);
    expect(turmoil.getAvailableDelegateCount(player)).eq(1);
    const before = player.totalDelegatesPlaced;
    addGreenery(player, '70'); // H7: two delegates
    runAllActions(game);
    const sp = cast(player.popWaitingFor(), (require('@/server/inputs/SelectParty').SelectParty));
    sp.cb(PartyName.MARS);
    // Only 1 delegate really moved; the player should have been credited with 1 placement, not 2.
    expect(turmoil.getAvailableDelegateCount(player)).eq(0);
    expect(player.totalDelegatesPlaced - before).eq(1);
  });

  it('BUG: player with 0 delegates in reserve is not prompted for a delegate bonus', () => {
    const [game, player] = testGame(2, {boardName: BoardName.AMAZONIS_PLANITIA, turmoilExtension: true});
    const turmoil = Turmoil.getTurmoil(game);
    const parties = [PartyName.MARS, PartyName.GREENS, PartyName.REDS, PartyName.KELVINISTS, PartyName.SCIENTISTS, PartyName.UNITY, PartyName.MARS];
    for (const p of parties) turmoil.sendDelegateToParty(player, p, game);
    expect(turmoil.getAvailableDelegateCount(player)).eq(0);
    addGreenery(player, '10'); // B2: one delegate
    runAllActions(game);
    expect(player.popWaitingFor()).is.undefined;
  });
});
