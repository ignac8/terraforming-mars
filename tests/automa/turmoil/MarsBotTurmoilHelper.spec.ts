import {expect} from 'chai';
import {testGame} from '../../TestGame';
import {DELEGATES_PER_PLAYER} from '@/common/constants';
import {Turmoil} from '@/server/turmoil/Turmoil';
import {PartyName} from '@/common/turmoil/PartyName';
import {MarsBotTurmoilHelper} from '@/server/automa/turmoil/MarsBotTurmoilHelper';
import {IGame} from '@/server/IGame';
import {IPlayer} from '@/server/IPlayer';
import {TestPlayer} from '../../TestPlayer';

describe('MarsBotTurmoilHelper', () => {
  let game: IGame;
  let human: TestPlayer;
  let marsBot: IPlayer;
  let turmoil: Turmoil;
  let helper: MarsBotTurmoilHelper;

  beforeEach(() => {
    [game, human] = testGame(1, {automa: true, turmoilExtension: true});
    marsBot = game.marsBotPlayer!;
    turmoil = Turmoil.getTurmoil(game);
    helper = new MarsBotTurmoilHelper(game);
  });

  it('T-7.1: picks party where +1 makes MarsBot leader AND party dominant', () => {
    // One NEUTRAL delegate in each of these blocks T-7.2 for them.
    for (const name of [PartyName.MARS, PartyName.UNITY, PartyName.REDS, PartyName.GREENS]) {
      turmoil.sendDelegateToParty('NEUTRAL', name, game);
    }
    turmoil.sendDelegateToParty(marsBot, PartyName.SCIENTISTS, game);
    turmoil.dominantParty = turmoil.getPartyByName(PartyName.MARS);

    expect(helper.selectParty()).eq(PartyName.SCIENTISTS);
  });

  it('T-7.2: picks party where +1 makes MarsBot party leader', () => {
    // Kelvinists stays dominant, so T-7.1 cannot fire for Scientists.
    for (let i = 0; i < 5; i++) {
      turmoil.sendDelegateToParty('NEUTRAL', PartyName.KELVINISTS, game);
    }
    turmoil.sendDelegateToParty(marsBot, PartyName.SCIENTISTS, game);
    for (const name of [PartyName.MARS, PartyName.UNITY, PartyName.REDS, PartyName.GREENS]) {
      turmoil.sendDelegateToParty('NEUTRAL', name, game);
    }

    expect(helper.selectParty()).eq(PartyName.SCIENTISTS);
  });

  it('T-7.3: picks party where MarsBot is already leader and +1 makes dominant', () => {
    // One NEUTRAL delegate everywhere else, so one MarsBot delegate only ties it there.
    for (const name of [PartyName.MARS, PartyName.SCIENTISTS, PartyName.KELVINISTS, PartyName.REDS, PartyName.GREENS]) {
      turmoil.sendDelegateToParty('NEUTRAL', name, game);
    }
    for (let i = 0; i < 3; i++) {
      turmoil.sendDelegateToParty(marsBot, PartyName.UNITY, game);
    }
    turmoil.dominantParty = turmoil.getPartyByName(PartyName.KELVINISTS);

    expect(helper.selectParty()).eq(PartyName.UNITY);
  });

  it('T-7.4: picks party where human has fewest delegates', () => {
    for (const name of Object.values(PartyName)) {
      turmoil.sendDelegateToParty('NEUTRAL', name, game);
    }
    for (const name of [PartyName.MARS, PartyName.SCIENTISTS, PartyName.UNITY, PartyName.KELVINISTS, PartyName.REDS]) {
      turmoil.sendDelegateToParty(human, name, game);
    }

    expect(helper.selectParty()).eq(PartyName.GREENS);
  });

  it('T-7.5: tiebreaker picks party where MarsBot has fewest delegates', () => {
    turmoil.sendDelegateToParty(marsBot, PartyName.REDS, game);

    const selected = helper.selectParty();

    expect(turmoil.getPartyByName(selected!).delegates.get(marsBot)).eq(0);
  });

  it('T-7.6: falls back to the party nearest clockwise from the dominance marker', () => {
    // Every tier before this one ties, and clockwise runs towards lower indexes.
    for (const name of Object.values(PartyName)) {
      turmoil.sendDelegateToParty('NEUTRAL', name, game);
    }
    const parties = turmoil.parties;
    const dominantIndex = parties.indexOf(turmoil.dominantParty);

    expect(helper.selectParty()).eq(parties[(dominantIndex - 1 + parties.length) % parties.length].name);
  });

  it('takes the party lead the delegate earns', () => {
    // A NEUTRAL delegate everywhere leaves Greens as the only party where one more MarsBot
    // delegate takes the lead.
    for (const name of Object.values(PartyName)) {
      turmoil.sendDelegateToParty('NEUTRAL', name, game);
    }
    turmoil.sendDelegateToParty(marsBot, PartyName.GREENS, game);
    const greens = turmoil.getPartyByName(PartyName.GREENS);

    expect(helper.maybePlaceDelegate()).eq(PartyName.GREENS);

    expect(greens.partyLeader).eq(marsBot);
  });

  it('does nothing when the reserve is empty', () => {
    for (let i = 0; i < DELEGATES_PER_PLAYER; i++) {
      turmoil.sendDelegateToParty(marsBot, PartyName.MARS, game);
    }

    expect(helper.maybePlaceDelegate()).is.undefined;
    expect(turmoil.getPartyByName(PartyName.MARS).delegates.get(marsBot)).eq(DELEGATES_PER_PLAYER);
  });
});
