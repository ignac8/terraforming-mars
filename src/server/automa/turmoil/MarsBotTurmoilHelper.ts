import {Turmoil} from '@/server/turmoil/Turmoil';
import {IParty} from '@/server/turmoil/parties/IParty';
import {PartyName} from '@/common/turmoil/PartyName';
import {IPlayer} from '@/server/IPlayer';
import {IGame} from '@/server/IGame';

/** MarsBot's delegate placement in an automa game (T-7). */
export class MarsBotTurmoilHelper {
  private readonly turmoil: Turmoil;
  private readonly marsBotPlayer: IPlayer;
  private readonly humanPlayer: IPlayer;

  constructor(private readonly game: IGame) {
    if (game.marsBotPlayer === undefined) {
      throw new Error('MarsBotTurmoilHelper needs an automa game');
    }
    this.turmoil = Turmoil.getTurmoil(game);
    this.marsBotPlayer = game.marsBotPlayer;
    this.humanPlayer = game.players[0];
  }

  /**
   * Chooses the party for MarsBot's next delegate, or undefined when its reserve is empty (T-7).
   *
   * Each tier narrows the candidates. A tier that matches nothing leaves the candidates alone
   * and the next tier runs against the same set.
   *
   *  Tier 1: Party where +1 makes MarsBot become Party Leader AND the party become Dominant.
   *  Tier 2: Party where +1 makes MarsBot become Party Leader.
   *  Tier 3: Party where MarsBot is already Party Leader, and +1 makes it become Dominant
   *          (the party must NOT already be Dominant, since both conditions are transitions).
   *  Tier 4: Party where the human player has fewest delegates (including zero).
   *  Tier 5: Party where MarsBot has fewest delegates (including zero).
   *  Tier 6: Next party clockwise from the Dominance marker, circling around. Always yields one.
   */
  public selectParty(): PartyName | undefined {
    if (!this.turmoil.delegateReserve.has(this.marsBotPlayer)) {
      return undefined;
    }

    const allParties = this.turmoil.parties;
    let candidates = allParties;

    candidates = narrow(candidates, (party) =>
      this.wouldBecomePartyLeader(party) && this.wouldBecomeDominant(party));

    candidates = narrow(candidates, (party) => this.wouldBecomePartyLeader(party));

    candidates = narrow(candidates, (party) =>
      party.partyLeader === this.marsBotPlayer && this.wouldBecomeDominant(party));

    const fewestHuman = Math.min(...candidates.map((party) => party.delegates.get(this.humanPlayer)));
    candidates = narrow(candidates, (party) => party.delegates.get(this.humanPlayer) === fewestHuman);

    const fewestMarsBot = Math.min(...candidates.map((party) => party.delegates.get(this.marsBotPlayer)));
    candidates = narrow(candidates, (party) => party.delegates.get(this.marsBotPlayer) === fewestMarsBot);

    const dominantIndex = allParties.indexOf(this.turmoil.dominantParty);
    const nearest = [...candidates].sort((a, b) =>
      clockwiseDistance(dominantIndex, allParties.indexOf(a), allParties.length) -
      clockwiseDistance(dominantIndex, allParties.indexOf(b), allParties.length));

    return nearest[0]?.name;
  }

  /**
   * Sends one delegate from MarsBot's reserve to the party it picks (T-7).
   *
   * Returns the party it went to, or undefined when the reserve is empty.
   */
  public maybePlaceDelegate(): PartyName | undefined {
    const partyName = this.selectParty();
    if (partyName === undefined) {
      return undefined;
    }
    this.turmoil.sendDelegateToParty(this.marsBotPlayer, partyName, this.game);
    this.game.log('${0} added a delegate in ${1}', (b) => b.player(this.marsBotPlayer).partyName(partyName));
    return partyName;
  }

  /**
   * Whether one more MarsBot delegate makes MarsBot the Party Leader.
   *
   * False when MarsBot already leads, since the rule asks for a change of leader.
   */
  private wouldBecomePartyLeader(party: IParty): boolean {
    if (party.partyLeader === this.marsBotPlayer) {
      return false;
    }
    return party.delegates.get(this.marsBotPlayer) + 1 > this.leaderCount(party);
  }

  /**
   * Whether one more delegate makes this party the Dominant party.
   *
   * False when it is already Dominant, since the rule asks for a change.
   */
  private wouldBecomeDominant(party: IParty): boolean {
    if (this.turmoil.dominantParty === party) {
      return false;
    }
    const countAfter = party.delegates.size + 1;
    return this.turmoil.parties.every((other) => other === party || other.delegates.size < countAfter);
  }

  private leaderCount(party: IParty): number {
    return party.partyLeader !== undefined ? party.delegates.get(party.partyLeader) : 0;
  }
}

/** Keeps the parties that pass the predicate, or all of them when none does. */
function narrow(
  candidates: ReadonlyArray<IParty>,
  predicate: (party: IParty) => boolean,
): ReadonlyArray<IParty> {
  const filtered = candidates.filter(predicate);
  return filtered.length > 0 ? filtered : candidates;
}

/**
 * Counts the clockwise steps from `fromIndex` to `toIndex` around `size` parties.
 *
 * A party is `size` steps from itself, so it sorts last. Clockwise runs towards lower indexes,
 * matching Turmoil.setNextPartyAsDominant.
 */
function clockwiseDistance(fromIndex: number, toIndex: number, size: number): number {
  if (fromIndex === toIndex) {
    return size;
  }
  return (fromIndex - toIndex + size) % size;
}
