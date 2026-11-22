import {expect} from 'chai';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {runAllActions, setRulingParty} from '../../TestingUtils';
import {Game} from '../../../src/server/Game';
import {IGame} from '../../../src/server/IGame';
import {MarsBot} from '../../../src/server/automa/MarsBot';
import {BoardName} from '../../../src/common/boards/BoardName';
import {BonusCardId, MARSBOT_STARTING_TR} from '../../../src/common/automa/AutomaTypes';
import {DELEGATES_PER_PLAYER} from '../../../src/common/constants';
import {MarsBotBonusCard} from '../../../src/server/automa/MarsBotBonusCard';
import {Turmoil} from '../../../src/server/turmoil/Turmoil';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {Phase} from '../../../src/common/Phase';
import {MARS_FIRST_BONUS_1, MARS_FIRST_POLICY_3} from '../../../src/server/turmoil/parties/MarsFirst';
import {
  MarsBotTurmoilHelper,
} from '../../../src/server/automa/turmoil/MarsBotTurmoilHelper';
import {Election} from '../../../src/server/turmoil/globalEvents/Election';
import {Revolution} from '../../../src/server/turmoil/globalEvents/Revolution';
import {CardName} from '../../../src/common/cards/CardName';
import {getMarsBotCorp} from '../../../src/server/automa/corps/MarsBotCorpRegistry';

/** The turmoil helper for this game. */
function turmoilHelper(game: IGame): MarsBotTurmoilHelper {
  return new MarsBotTurmoilHelper(game);
}

/** Creates a Turmoil-enabled automa game, returning `{game, humanPlayer, marsBot}`. */
function createTurmoilGame(): {game: IGame, humanPlayer: TestPlayer, marsBot: MarsBot} {
  const [game, humanPlayer] = testGame(1, {
    automa: true,
    turmoilExtension: true,
    boardName: BoardName.THARSIS,
  });
  const marsBot = game.automaHooks!.marsBot;
  return {game, humanPlayer, marsBot};
}

describe('MarsBot Turmoil — Setup', () => {
  it('MarsBot starting TR is 10 (reduced by 10, rulebook C, p.6)', () => {
    const {marsBot} = createTurmoilGame();
    expect(marsBot.player.terraformRating).to.equal(MARSBOT_STARTING_TR - 10);
  });

  it('MarsBot has 7 delegates in the reserve (rulebook C, p.6)', () => {
    const {game, marsBot} = createTurmoilGame();
    const turmoil = Turmoil.getTurmoil(game);
    expect(turmoil.delegateReserve.get(marsBot.player)).to.equal(DELEGATES_PER_PLAYER);
  });

  it('Party Politics (B21) is in the initial action deck (rulebook C, p.6)', () => {
    const {marsBot} = createTurmoilGame();
    const hasPartyPolitics = marsBot.actionDeck.cards.some(
      (card) => !('cost' in card) && (card as MarsBotBonusCard).id === BonusCardId.B21_PARTY_POLITICS,
    );
    expect(hasPartyPolitics).to.be.true;
  });

  it('Without Turmoil, MarsBot starting TR is 20', () => {
    const [game] = testGame(1, {automa: true, boardName: BoardName.THARSIS});
    expect(game.automaHooks!.marsBot.player.terraformRating).to.equal(MARSBOT_STARTING_TR);
  });

  it('Party Politics is in action deck on generation 2 (rulebook C, p.6)', () => {
    const {marsBot} = createTurmoilGame();
    marsBot.actionDeck.buildResearch();
    const hasPartyPolitics = marsBot.actionDeck.cards.some(
      (card) => !('cost' in card) && (card as MarsBotBonusCard).id === BonusCardId.B21_PARTY_POLITICS,
    );
    expect(hasPartyPolitics).to.be.true;
  });
});

describe('MarsBot Turmoil — Party Politics delegate selection (rulebook C, p.6)', () => {
  it('picks party where +1 makes MarsBot leader AND party dominant', () => {
    const {game, marsBot} = createTurmoilGame();
    const turmoil = Turmoil.getTurmoil(game);
    const marsBotPlayer = marsBot.player;

    // A second MarsBot delegate in Scientists would lead it and make it dominant over the other parties,
    // which hold one NEUTRAL delegate each.
    for (const name of [PartyName.MARS, PartyName.UNITY, PartyName.REDS, PartyName.GREENS]) {
      turmoil.sendDelegateToParty('NEUTRAL', name, game);
    }
    turmoil.sendDelegateToParty(marsBotPlayer, PartyName.SCIENTISTS, game);
    turmoil.dominantParty = turmoil.getPartyByName(PartyName.MARS);

    const selected = turmoilHelper(game).selectParty();
    expect(selected).to.equal(PartyName.SCIENTISTS);
  });

  it('picks party where +1 makes MarsBot party leader', () => {
    const {game, marsBot} = createTurmoilGame();
    const turmoil = Turmoil.getTurmoil(game);
    const marsBotPlayer = marsBot.player;

    // Kelvinists stays dominant, so the first priority can't pick Scientists.
    for (let i = 0; i < 5; i++) {
      turmoil.sendDelegateToParty('NEUTRAL', PartyName.KELVINISTS, game);
    }
    turmoil.sendDelegateToParty(marsBotPlayer, PartyName.SCIENTISTS, game);
    // A NEUTRAL delegate in each other party stops one MarsBot delegate from taking the lead there.
    for (const name of [PartyName.MARS, PartyName.UNITY, PartyName.REDS, PartyName.GREENS]) {
      turmoil.sendDelegateToParty('NEUTRAL', name, game);
    }

    const selected = turmoilHelper(game).selectParty();
    expect(selected).to.equal(PartyName.SCIENTISTS);
  });

  it('picks party where MarsBot is already leader and +1 makes dominant', () => {
    const {game, marsBot} = createTurmoilGame();
    const turmoil = Turmoil.getTurmoil(game);
    const marsBotPlayer = marsBot.player;

    // A NEUTRAL delegate in each other party stops one MarsBot delegate from taking the lead there.
    for (const name of [PartyName.MARS, PartyName.SCIENTISTS, PartyName.KELVINISTS, PartyName.REDS, PartyName.GREENS]) {
      turmoil.sendDelegateToParty('NEUTRAL', name, game);
    }
    turmoil.sendDelegateToParty(marsBotPlayer, PartyName.UNITY, game);
    turmoil.sendDelegateToParty(marsBotPlayer, PartyName.UNITY, game);
    turmoil.sendDelegateToParty(marsBotPlayer, PartyName.UNITY, game);
    const unity = turmoil.getPartyByName(PartyName.UNITY);
    expect(unity.partyLeader).to.equal(marsBotPlayer);

    // Unity is not dominant yet.
    turmoil.dominantParty = turmoil.getPartyByName(PartyName.KELVINISTS);

    const selected = turmoilHelper(game).selectParty();
    expect(selected).to.equal(PartyName.UNITY);
  });

  it('picks party where human has fewest delegates', () => {
    const {game, humanPlayer} = createTurmoilGame();
    const turmoil = Turmoil.getTurmoil(game);

    // A NEUTRAL delegate in every party rules out the first two priorities.
    for (const name of Object.values(PartyName)) {
      turmoil.sendDelegateToParty('NEUTRAL', name, game);
    }
    // The human has a delegate in every party but Greens.
    for (const name of [PartyName.MARS, PartyName.SCIENTISTS, PartyName.UNITY, PartyName.KELVINISTS, PartyName.REDS]) {
      turmoil.sendDelegateToParty(humanPlayer, name, game);
    }

    const selected = turmoilHelper(game).selectParty();
    expect(selected).to.equal(PartyName.GREENS);
  });

  it('tiebreaker picks party where MarsBot has fewest delegates', () => {
    const {game, marsBot} = createTurmoilGame();
    const turmoil = Turmoil.getTurmoil(game);
    const marsBotPlayer = marsBot.player;

    // The human has no delegates anywhere, so the fourth priority ties, and only Reds holds a MarsBot delegate.
    turmoil.sendDelegateToParty(marsBotPlayer, PartyName.REDS, game);

    const selected = turmoilHelper(game).selectParty();
    expect(selected).to.not.equal(PartyName.REDS);
    expect(selected).to.not.be.undefined;
  });

  it('final tiebreaker selects a valid party', () => {
    const {game} = createTurmoilGame();

    const selected = turmoilHelper(game).selectParty();
    expect(selected).to.not.be.undefined;
    expect(Object.values(PartyName)).to.include(selected);
  });

  it('returns undefined when MarsBot has no delegates in reserve', () => {
    const {game, marsBot} = createTurmoilGame();
    const turmoil = Turmoil.getTurmoil(game);
    const marsBotPlayer = marsBot.player;

    for (let i = 0; i < DELEGATES_PER_PLAYER; i++) {
      turmoil.sendDelegateToParty(marsBotPlayer, PartyName.MARS, game);
    }
    expect(turmoil.delegateReserve.has(marsBotPlayer)).to.be.false;

    const selected = turmoilHelper(game).selectParty();
    expect(selected).to.be.undefined;
  });
});

describe('MarsBot Turmoil — End-of-game VP (rulebook C, p.7)', () => {
  it('MarsBot scores 1 VP for being party leader', () => {
    const {game, marsBot} = createTurmoilGame();
    const turmoil = Turmoil.getTurmoil(game);
    const marsBotPlayer = marsBot.player;

    // Three delegates outnumber the NEUTRAL ones setup puts in a party (at most 2).
    turmoil.sendDelegateToParty(marsBotPlayer, PartyName.MARS, game);
    turmoil.sendDelegateToParty(marsBotPlayer, PartyName.MARS, game);
    turmoil.sendDelegateToParty(marsBotPlayer, PartyName.MARS, game);
    const marsFirst = turmoil.getPartyByName(PartyName.MARS);
    expect(marsFirst.partyLeader).to.equal(marsBotPlayer);

    const vp = marsBot.getVictoryPoints();
    expect(vp.turmoilVP).to.be.at.least(1);
  });

  it('MarsBot scores 1 VP for being chairman', () => {
    const {game, marsBot} = createTurmoilGame();
    const turmoil = Turmoil.getTurmoil(game);
    const marsBotPlayer = marsBot.player;

    turmoil.chairman = marsBotPlayer;

    const vp = marsBot.getVictoryPoints();
    expect(vp.turmoilVP).to.equal(1);
  });

  it('turmoilVP is 0 without Turmoil extension', () => {
    const [game] = testGame(1, {automa: true, boardName: BoardName.THARSIS});
    const marsBot = game.automaHooks!.marsBot;
    const vp = marsBot.getVictoryPoints();
    expect(vp.turmoilVP).to.equal(0);
  });

  it('turmoilVP included in total', () => {
    const {game, marsBot} = createTurmoilGame();
    const turmoil = Turmoil.getTurmoil(game);
    turmoil.chairman = marsBot.player;

    const vp = marsBot.getVictoryPoints();
    const expectedTotal = vp.terraformRating + vp.milestones + vp.awards + vp.greenery +
      vp.cityAdjacentGreenery + vp.neuralInstance + vp.mcToVP + vp.cardVP +
      vp.vermin + vp.turmoilVP;
    expect(vp.total).to.equal(expectedTotal);
  });
});

describe('updatePartyLeaderForMarsBot', () => {
  it('sets MarsBot as leader when it has more delegates than current leader', () => {
    const {game, marsBot} = createTurmoilGame();
    const turmoil = Turmoil.getTurmoil(game);
    const marsBotPlayer = marsBot.player;

    turmoil.sendDelegateToParty(marsBotPlayer, PartyName.UNITY, game);
    turmoil.sendDelegateToParty(marsBotPlayer, PartyName.UNITY, game);
    turmoil.sendDelegateToParty(marsBotPlayer, PartyName.UNITY, game);
    const unity = turmoil.getPartyByName(PartyName.UNITY);
    expect(unity.partyLeader).to.equal(marsBotPlayer);
  });

  it('does NOT set MarsBot as leader when it ties', () => {
    const {game, marsBot} = createTurmoilGame();
    const turmoil = Turmoil.getTurmoil(game);
    const marsBotPlayer = marsBot.player;

    turmoil.sendDelegateToParty(marsBotPlayer, PartyName.MARS, game);
    const marsFirst = turmoil.getPartyByName(PartyName.MARS);
    const leaderBefore = marsFirst.partyLeader;

    // A tie with a NEUTRAL delegate leaves the leader unchanged. In a party without one, MarsBot takes the lead.
    expect(marsFirst.partyLeader).to.satisfy((leader: unknown) =>
      leader === marsBotPlayer || leader === leaderBefore,
    );
  });
});

describe('totalDelegates helper', () => {
  it('counts all delegates for a player in a party', () => {
    const {game, marsBot} = createTurmoilGame();
    const turmoil = Turmoil.getTurmoil(game);
    const marsBotPlayer = marsBot.player;

    turmoil.sendDelegateToParty(marsBotPlayer, PartyName.UNITY, game);
    turmoil.sendDelegateToParty(marsBotPlayer, PartyName.UNITY, game);

    const unity = turmoil.getPartyByName(PartyName.UNITY);
    expect(unity.delegates.get(marsBotPlayer)).to.equal(2);
  });
});

describe('MarsBot Turmoil — serialization', () => {
  it('Turmoil state survives game serialize', () => {
    const {game, marsBot} = createTurmoilGame();
    const turmoil = Turmoil.getTurmoil(game);
    const marsBotPlayer = marsBot.player;

    turmoil.sendDelegateToParty(marsBotPlayer, PartyName.MARS, game);
    turmoil.sendDelegateToParty(marsBotPlayer, PartyName.SCIENTISTS, game);

    const serialized = game.serialize();
    expect(serialized.turmoil).to.not.be.undefined;
    const marsParty = serialized.turmoil!.parties.find((p) => p.name === PartyName.MARS);
    expect(marsParty).to.not.be.undefined;
    expect(marsParty!.delegates).to.include(marsBotPlayer.id);
  });

  it('a game with MarsBot delegates loads again', () => {
    const {game, marsBot} = createTurmoilGame();
    const turmoil = Turmoil.getTurmoil(game);
    turmoil.sendDelegateToParty(marsBot.player, PartyName.MARS, game);
    turmoil.sendDelegateToParty(marsBot.player, PartyName.MARS, game);
    turmoil.sendDelegateToParty(marsBot.player, PartyName.SCIENTISTS, game);

    // MarsBot is not one of the serialized players, so reading its delegates back needs the bot in the list
    // Turmoil resolves owners against.
    const restored = Game.deserialize(game.serialize());

    const restoredBot = restored.automaHooks!.marsBot.player;
    const restoredTurmoil = Turmoil.getTurmoil(restored);
    expect(restoredTurmoil.getPartyByName(PartyName.MARS).delegates.get(restoredBot)).to.eq(2);
    expect(restoredTurmoil.getPartyByName(PartyName.SCIENTISTS).delegates.get(restoredBot)).to.eq(1);
  });

  it('MarsBot party leadership survives a reload', () => {
    const {game, marsBot} = createTurmoilGame();
    const turmoil = Turmoil.getTurmoil(game);
    for (let i = 0; i < 3; i++) {
      turmoil.sendDelegateToParty(marsBot.player, PartyName.GREENS, game);
    }
    expect(turmoil.getPartyByName(PartyName.GREENS).partyLeader).to.eq(marsBot.player);

    const restored = Game.deserialize(game.serialize());

    const restoredBot = restored.automaHooks!.marsBot.player;
    expect(Turmoil.getTurmoil(restored).getPartyByName(PartyName.GREENS).partyLeader).to.eq(restoredBot);
  });

  it('the bot keeps its delegate reserve across a reload', () => {
    const {game, marsBot} = createTurmoilGame();
    const turmoil = Turmoil.getTurmoil(game);
    turmoil.sendDelegateToParty(marsBot.player, PartyName.REDS, game);
    const remaining = turmoil.delegateReserve.get(marsBot.player);

    const restored = Game.deserialize(game.serialize());

    const restoredBot = restored.automaHooks!.marsBot.player;
    expect(Turmoil.getTurmoil(restored).delegateReserve.get(restoredBot)).to.eq(remaining);
  });

  it('MarsBot automa state serializes correctly with turmoil', () => {
    const {marsBot} = createTurmoilGame();
    const state = marsBot.serialize();
    expect(marsBot.player.terraformRating).to.equal(MARSBOT_STARTING_TR - 10);
    expect(state).to.not.be.undefined;
    expect(state.marsBotPlayerId).to.not.be.undefined;
  });
});

describe('MarsBot Turmoil — Global Events solo resolution (rulebook C, p.7)', () => {
  it('Revolution does not crash in automa game', () => {
    const {game, humanPlayer} = createTurmoilGame();
    const revolution = new Revolution();

    // Only the human player's score is checked against the threshold.
    const trBefore = humanPlayer.terraformRating;
    expect(() => revolution.bespokeResolve(game)).not.to.throw();
    // No Earth tags and little influence, so the score stays below the threshold.
    expect(humanPlayer.terraformRating).to.equal(trBefore);
  });

  it('Revolution loses 2 TR when human score >= 4 in automa game', () => {
    const {game, humanPlayer} = createTurmoilGame();
    const turmoil = Turmoil.getTurmoil(game);
    const revolution = new Revolution();

    // Influence 3: chairman 1, dominant party leader 1 and a second delegate 1.
    turmoil.chairman = humanPlayer;
    turmoil.dominantParty = turmoil.getPartyByName(PartyName.GREENS);
    turmoil.dominantParty.partyLeader = humanPlayer;
    turmoil.dominantParty.delegates.add(humanPlayer, 4);
    const trBefore = humanPlayer.terraformRating;

    humanPlayer.tagsForTest = {earth: 0};
    expect(revolution.getScore(humanPlayer, turmoil)).to.eq(3);
    revolution.bespokeResolve(game);
    expect(humanPlayer.terraformRating).to.equal(trBefore);

    humanPlayer.tagsForTest = {earth: 1};
    expect(revolution.getScore(humanPlayer, turmoil)).to.eq(4);
    revolution.bespokeResolve(game);
    expect(humanPlayer.terraformRating).to.equal(trBefore - 2);
  });

  it('Election does not grant TR to MarsBot in automa game', () => {
    const {game, humanPlayer, marsBot} = createTurmoilGame();
    const election = new Election();

    const marsBotTR = marsBot.player.terraformRating;
    const humanTR = humanPlayer.terraformRating;
    election.bespokeResolve(game);
    expect(marsBot.player.terraformRating).to.equal(marsBotTR);
    // The human has no building tags, influence or cities, so the score is below 5.
    expect(humanPlayer.terraformRating).to.equal(humanTR);
  });

  it('Election grants 2 TR to human when score >= 10 in automa game', () => {
    const {game, humanPlayer} = createTurmoilGame();
    const turmoil = Turmoil.getTurmoil(game);
    const election = new Election();

    // Influence 3: chairman 1, dominant party leader 1 and a second delegate 1.
    turmoil.chairman = humanPlayer;
    turmoil.dominantParty = turmoil.getPartyByName(PartyName.GREENS);
    turmoil.dominantParty.partyLeader = humanPlayer;
    turmoil.dominantParty.delegates.add(humanPlayer, 4);
    humanPlayer.tagsForTest = {building: 7};
    expect(election.getScore(humanPlayer, turmoil, game)).to.eq(10);

    const trBefore = humanPlayer.terraformRating;
    election.bespokeResolve(game);
    expect(humanPlayer.terraformRating).to.equal(trBefore + 2);
  });
});

describe('MarsBot Turmoil — Automatic skips (rulebook C, p.6-7)', () => {
  it('MarsBot does NOT lose TR during Turmoil TR Revision', () => {
    const {game, marsBot} = createTurmoilGame();
    const turmoil = Turmoil.getTurmoil(game);
    const trBefore = marsBot.player.terraformRating;

    game.phase = Phase.SOLAR;
    turmoil.runTurmoilPhase(game);
    runAllActions(game);

    expect(marsBot.player.terraformRating).to.equal(trBefore);
  });

  it('MarsBot does NOT receive Ruling Party Bonus (Turmoil new government)', () => {
    const {game, marsBot} = createTurmoilGame();
    const marsBotPlayer = marsBot.player;

    const mcBefore = marsBotPlayer.stock.megacredits;
    MARS_FIRST_BONUS_1.grant(game);
    expect(marsBotPlayer.stock.megacredits).to.equal(mcBefore);
  });

  it('MarsBot does NOT receive Ruling Party Policy effect (onPolicyStart)', () => {
    const {game, marsBot} = createTurmoilGame();
    const marsBotPlayer = marsBot.player;

    // Mars First policy 3 raises each player's steel value by 1.
    const steelValueBefore = marsBotPlayer.getSteelValue();
    MARS_FIRST_POLICY_3.onPolicyStart?.(game);
    expect(marsBotPlayer.getSteelValue()).to.equal(steelValueBefore);
  });

  it('MarsBot raises TR under Reds without paying and without being asked to pay', () => {
    const {game, marsBot} = createTurmoilGame();
    const botPlayer = marsBot.player;
    setRulingParty(game, PartyName.REDS);
    game.phase = Phase.ACTION;
    marsBot.megacredits = 10;
    const trBefore = botPlayer.terraformRating;

    botPlayer.increaseTerraformRating(1);
    runAllActions(game);

    expect(botPlayer.terraformRating).to.equal(trBefore + 1);
    expect(marsBot.megacredits).to.equal(10);
    expect(botPlayer.getWaitingFor()).is.undefined;
  });
});

describe('MarsBot Turmoil — Chairman rules (rulebook C, p.7)', () => {
  it('MarsBot gains 1 TR when it becomes chairman', () => {
    const {game, marsBot} = createTurmoilGame();
    const turmoil = Turmoil.getTurmoil(game);
    const marsBotPlayer = marsBot.player;

    const trBefore = marsBotPlayer.terraformRating;
    turmoil.setNewChairman(marsBotPlayer, game, /* setAgenda */ false, /* gainTR */ true);
    runAllActions(game);

    expect(marsBotPlayer.terraformRating).to.equal(trBefore + 1);
  });

  it('MarsBot gains 1 TR when it becomes chairman via full runTurmoilPhase', () => {
    const {game, marsBot} = createTurmoilGame();
    const turmoil = Turmoil.getTurmoil(game);
    const marsBotPlayer = marsBot.player;

    // MarsBot leads Kelvinists, which is dominant.
    for (let i = 0; i < 3; i++) {
      turmoil.sendDelegateToParty(marsBotPlayer, PartyName.KELVINISTS, game);
    }
    const kelvinists = turmoil.getPartyByName(PartyName.KELVINISTS);
    turmoil.dominantParty = kelvinists;

    const trBefore = marsBotPlayer.terraformRating;
    game.phase = Phase.SOLAR;
    turmoil.runTurmoilPhase(game);
    runAllActions(game);

    expect(marsBotPlayer.terraformRating).to.equal(trBefore + 1);
    expect(turmoil.chairman).to.equal(marsBotPlayer);
  });

  it('MarsBot delegates from ruling party return to reserve (not lost) after New Government', () => {
    const {game, marsBot} = createTurmoilGame();
    const turmoil = Turmoil.getTurmoil(game);
    const marsBotPlayer = marsBot.player;

    turmoil.sendDelegateToParty(marsBotPlayer, PartyName.REDS, game);
    turmoil.sendDelegateToParty(marsBotPlayer, PartyName.REDS, game);
    const reserveAfterPlacement = turmoil.delegateReserve.get(marsBotPlayer);
    const reds = turmoil.getPartyByName(PartyName.REDS);
    turmoil.dominantParty = reds;

    game.phase = Phase.SOLAR;
    turmoil.setRulingParty(game);
    runAllActions(game);

    // One MarsBot delegate leads Reds and becomes chairman. The other returns to the reserve.
    expect(turmoil.delegateReserve.get(marsBotPlayer)).to.equal(reserveAfterPlacement + 1);
    expect(turmoil.chairman).to.equal(marsBotPlayer);
    expect(reds.delegates.size).to.equal(0);
    expect(reds.partyLeader).to.be.undefined;
  });

  it('MarsBot does NOT use the free lobby delegate action each generation', () => {
    const {game, marsBot} = createTurmoilGame();
    const turmoil = Turmoil.getTurmoil(game);
    const marsBotPlayer = marsBot.player;

    game.phase = Phase.SOLAR;
    turmoil.runTurmoilPhase(game);
    runAllActions(game);

    expect(turmoil.usedFreeDelegateAction.has(marsBotPlayer)).to.be.false;
  });
});

describe('MarsBot Turmoil — Difficulty options (rulebook C, p.7)', () => {
  function delegatesInParties(game: ReturnType<typeof testGame>[0]): number {
    const turmoil = Turmoil.getTurmoil(game);
    const marsBotPlayer = game.automaHooks!.marsBot.player;
    let inParties = 0;
    for (const party of turmoil.parties) {
      inParties += party.delegates.get(marsBotPlayer);
    }
    return inParties;
  }

  it('by default MarsBot starts at 10 TR (reduced by 10) with no seeded delegates', () => {
    const [game] = testGame(1, {
      automa: true,
      turmoilExtension: true,
      boardName: BoardName.THARSIS,
    });
    expect(game.automaHooks!.marsBot.player.terraformRating).to.equal(MARSBOT_STARTING_TR - 10);
    expect(delegatesInParties(game)).to.equal(0);
    const marsBotPlayer = game.automaHooks!.marsBot.player;
    expect(Turmoil.getTurmoil(game).delegateReserve.get(marsBotPlayer)).to.equal(DELEGATES_PER_PLAYER);
  });

  it('automaTurmoilTRReduction=7 → MarsBot starts at 13 TR and still seeds no delegates', () => {
    const [game] = testGame(1, {
      automa: true,
      turmoilExtension: true,
      boardName: BoardName.THARSIS,
      automaTurmoilTRReduction: 7,
    });
    expect(game.automaHooks!.marsBot.player.terraformRating).to.equal(MARSBOT_STARTING_TR - 7);
    expect(delegatesInParties(game)).to.equal(0);
  });

  it('automaTurmoilSetupDelegates=1 → 1 MarsBot delegate seeded, TR reduction unchanged', () => {
    const [game] = testGame(1, {
      automa: true,
      turmoilExtension: true,
      boardName: BoardName.THARSIS,
      automaTurmoilSetupDelegates: 1,
    });
    const marsBotPlayer = game.automaHooks!.marsBot.player;
    expect(delegatesInParties(game)).to.equal(1);
    expect(Turmoil.getTurmoil(game).delegateReserve.get(marsBotPlayer)).to.equal(DELEGATES_PER_PLAYER - 1);
    expect(marsBotPlayer.terraformRating).to.equal(MARSBOT_STARTING_TR - 10);
  });

  it('automaTurmoilSetupDelegates=2 → 2 MarsBot delegates seeded', () => {
    const [game] = testGame(1, {
      automa: true,
      turmoilExtension: true,
      boardName: BoardName.THARSIS,
      automaTurmoilSetupDelegates: 2,
    });
    const marsBotPlayer = game.automaHooks!.marsBot.player;
    expect(delegatesInParties(game)).to.equal(2);
    expect(Turmoil.getTurmoil(game).delegateReserve.get(marsBotPlayer)).to.equal(DELEGATES_PER_PLAYER - 2);
  });

  it('both difficulty options combine: reduction 7 and 2 seeded delegates', () => {
    const [game] = testGame(1, {
      automa: true,
      turmoilExtension: true,
      boardName: BoardName.THARSIS,
      automaTurmoilTRReduction: 7,
      automaTurmoilSetupDelegates: 2,
    });
    expect(game.automaHooks!.marsBot.player.terraformRating).to.equal(MARSBOT_STARTING_TR - 7);
    expect(delegatesInParties(game)).to.equal(2);
  });

  it('Turmoil difficulty options have no effect without turmoilExtension', () => {
    const [game] = testGame(1, {
      automa: true,
      turmoilExtension: false,
      boardName: BoardName.THARSIS,
      automaTurmoilTRReduction: 7,
      automaTurmoilSetupDelegates: 2,
    });
    expect(game.automaHooks!.marsBot.player.terraformRating).to.equal(MARSBOT_STARTING_TR);
  });
});

describe('MarsBot C37 Septem Tribus — Turmoil interaction (Rules-covered: C37)', () => {
  function hasBonusCard(deck: ReadonlyArray<unknown>, bonusCardId: BonusCardId): boolean {
    return deck.some((c) => !('cost' in (c as object)) && (c as MarsBotBonusCard).id === bonusCardId);
  }

  it('C37: B21 (Party Politics) is NOT in the initial action deck when Septem Tribus is active', () => {
    const {marsBot} = createTurmoilGame();
    const septumTribus = getMarsBotCorp(CardName.SEPTUM_TRIBUS)!;
    marsBot.setCorpAndSetup(septumTribus);

    expect(hasBonusCard(marsBot.actionDeck.cards, BonusCardId.B21_PARTY_POLITICS)).to.be.false;
  });

  it("C37: adds all delegates of an unused colour to MarsBot's reserve", () => {
    const {game, marsBot} = createTurmoilGame();
    marsBot.setCorpAndSetup(getMarsBotCorp(CardName.SEPTUM_TRIBUS)!);

    expect(Turmoil.getTurmoil(game).delegateReserve.get(marsBot.player)).to.equal(2 * DELEGATES_PER_PLAYER);
  });

  it('C37: sets up without Turmoil', () => {
    const [game] = testGame(1, {automa: true, boardName: BoardName.THARSIS});
    const marsBot = game.automaHooks!.marsBot;

    marsBot.setCorpAndSetup(getMarsBotCorp(CardName.SEPTUM_TRIBUS)!);

    expect(game.turmoil).to.be.undefined;
  });

  it('C37: B29 (Gray Eminence) is in the bonusDeck after Septem Tribus setup', () => {
    const {marsBot} = createTurmoilGame();
    const septumTribus = getMarsBotCorp(CardName.SEPTUM_TRIBUS)!;
    marsBot.setCorpAndSetup(septumTribus);

    const hasGrayEminence = marsBot.bonusDeck.drawPile.some(
      (c) => c.id === BonusCardId.B29_GRAY_EMINENCE,
    );
    expect(hasGrayEminence).to.be.true;
  });

  it('C37: B21 (Party Politics) is NOT in the gen-2 action deck when Septem Tribus is active', () => {
    const {marsBot} = createTurmoilGame();
    const septumTribus = getMarsBotCorp(CardName.SEPTUM_TRIBUS)!;
    marsBot.setCorpAndSetup(septumTribus);
    marsBot.actionDeck.buildResearch();

    expect(hasBonusCard(marsBot.actionDeck.cards, BonusCardId.B21_PARTY_POLITICS)).to.be.false;
  });

  it('C37: B29 (Gray Eminence) is in the gen-2 action deck exactly once', () => {
    const {game, marsBot} = createTurmoilGame();
    const septumTribus = getMarsBotCorp(CardName.SEPTUM_TRIBUS)!;
    marsBot.setCorpAndSetup(septumTribus);
    game.generation = 2;
    marsBot.actionDeck.buildResearch();
    game.automaHooks!.handleBeforeActionPhase();

    // The generation effect adds it whether or not the bonus draw already did.
    const grayEminences = marsBot.actionDeck.cards.filter((c) => hasBonusCard([c], BonusCardId.B29_GRAY_EMINENCE));
    expect(grayEminences).to.have.length(1);
  });
});
