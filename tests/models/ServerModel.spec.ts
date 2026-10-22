import {expect} from 'chai';
import {Banker} from '../../src/server/awards/Banker';
import {IAward} from '../../src/server/awards/IAward';
import {IGame} from '../../src/server/IGame';
import {Mayor} from '../../src/server/milestones/Mayor';
import {Resource} from '../../src/common/Resource';
import {TestPlayer} from '../TestPlayer';
import {testGame} from '../TestGame';
import {Server} from '../../src/server/models/ServerModel';
import {GlobalParameter} from '../../src/common/GlobalParameter';
import {Phase} from '../../src/common/Phase';
import {CardName} from '../../src/common/cards/CardName';
import {toName, cast} from '../../src/common/utils/utils';
import {cardsFromJSON} from '../../src/server/createCard';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {SelectOption} from '../../src/server/inputs/SelectOption';

describe('ServerModel', () => {
  let player: TestPlayer;
  let player2: TestPlayer;
  let game: IGame;

  function createTestGame(showOtherPlayersVP: boolean) {
    [game, player, player2] = testGame(2, {showOtherPlayersVP});
    // Claim milestone
    const milestone = new Mayor();

    game.claimedMilestones.push({
      player: player,
      milestone: milestone,
    });

    // Fund awards
    const award: IAward = new Banker();
    game.fundAward(player, award);

    // Set second player to win Banker award
    player2.production.add(Resource.MEGACREDITS, 10);

    // Our testing player will be 2nd Banker in the game
    player.production.add(Resource.MEGACREDITS, 7);
  }

  it('Should always return current player\'s VP', () => {
    createTestGame(false);
    const response = Server.getPlayerModel(player);
    expect(response.thisPlayer.victoryPointsBreakdown.total).eq(25);
    expect(response.thisPlayer.victoryPointsBreakdown.milestones).eq(5);
    expect(response.players[0].victoryPointsBreakdown.total).eq(25);
    expect(response.players[1].victoryPointsBreakdown.total).eq(0);
  });

  it('Should return all players\' VP', () => {
    createTestGame(true);
    const response = Server.getPlayerModel(player);
    expect(response.thisPlayer.victoryPointsBreakdown.total).eq(25);
    expect(response.players[0].victoryPointsBreakdown.total).eq(25);
    expect(response.players[0].victoryPointsBreakdown.milestones).eq(5);
    expect(response.players[1].victoryPointsBreakdown.total).eq(25);
    expect(response.players[1].victoryPointsBreakdown.awards).eq(5);
  });

  it('Should hide all players\' VP when spectator', () => {
    createTestGame(false);
    const response = Server.getSpectatorModel(game);
    expect(response.players[0].victoryPointsBreakdown.total).eq(0);
    expect(response.players[1].victoryPointsBreakdown.total).eq(0);
  });

  it('Should show a finished game\'s player ids to everyone, except those of a solo game to anyone but its player and the judge', () => {
    for (const [players, spectatorSeesId] of [[2, true], [1, false]] as const) {
      [game, player] = testGame(players, {judgeLink: true});
      game.phase = Phase.END;

      expect(Server.getPlayerModel(player).players.map((p) => p.id), String(players)).includes(player.id);
      expect(Server.getJudgeModel(game).players.map((p) => p.id), String(players)).includes(player.id);
      expect(Server.getSpectatorModel(game).players.map((p) => p.id).includes(player.id), String(players)).eq(spectatorSeesId);
    }
  });

  it('Should include globalParameterSteps at game end', () => {
    createTestGame(false);
    // Simulate players contributing to global parameters
    player.globalParameterSteps[GlobalParameter.TEMPERATURE] = 5;
    player.globalParameterSteps[GlobalParameter.OXYGEN] = 3;
    player.globalParameterSteps[GlobalParameter.OCEANS] = 2;

    player2.globalParameterSteps[GlobalParameter.TEMPERATURE] = 2;
    player2.globalParameterSteps[GlobalParameter.OXYGEN] = 6;

    game.phase = Phase.END;

    const response = Server.getPlayerModel(player);

    // Current player should always see their globalParameterSteps
    expect(response.thisPlayer.globalParameterSteps[GlobalParameter.TEMPERATURE]).eq(5);
    expect(response.thisPlayer.globalParameterSteps[GlobalParameter.OXYGEN]).eq(3);
    expect(response.thisPlayer.globalParameterSteps[GlobalParameter.OCEANS]).eq(2);

    // Other players' globalParameterSteps should be visible at game end
    const otherPlayer = response.players.find((p) => p.id === player2.id);
    expect(otherPlayer).is.not.undefined;
    expect(otherPlayer!.globalParameterSteps[GlobalParameter.TEMPERATURE]).eq(2);
    expect(otherPlayer!.globalParameterSteps[GlobalParameter.OXYGEN]).eq(6);
  });

  it('Should not include globalParameterSteps during game', () => {
    createTestGame(false);
    player.globalParameterSteps[GlobalParameter.TEMPERATURE] = 5;
    player2.globalParameterSteps[GlobalParameter.OXYGEN] = 3;

    game.phase = Phase.ACTION;

    const response = Server.getPlayerModel(player);

    // Current player should see their own steps
    expect(response.thisPlayer.globalParameterSteps[GlobalParameter.TEMPERATURE]).eq(5);

    // Other players' steps should be empty during game (player id is undefined during game)
    const otherPlayer = response.players.find((p) => p.color === player2.color && p.name === player2.name);
    expect(otherPlayer).is.not.undefined;
    expect(Object.keys(otherPlayer!.globalParameterSteps).length).eq(0);
  });

  it('Should include globalParameterSteps when showOtherPlayersVP is true', () => {
    createTestGame(true);
    player.globalParameterSteps[GlobalParameter.TEMPERATURE] = 4;
    player2.globalParameterSteps[GlobalParameter.OXYGEN] = 7;

    game.phase = Phase.ACTION;

    const response = Server.getPlayerModel(player);

    // With showOtherPlayersVP, all players' steps should be visible
    expect(response.thisPlayer.globalParameterSteps[GlobalParameter.TEMPERATURE]).eq(4);

    const otherPlayer = response.players.find((p) => p.color === player2.color && p.name === player2.name);
    expect(otherPlayer).is.not.undefined;
    expect(otherPlayer!.globalParameterSteps[GlobalParameter.OXYGEN]).eq(7);
  });

  it('puts the judge id on the organizer game model only', () => {
    createTestGame(false);
    expect(Server.getSimpleGameModel(game).judgeId).is.undefined;

    game.judgeId = 'jtest';

    expect(Server.getSimpleGameModel(game).judgeId).eq('jtest');
    expect(JSON.stringify(Server.getGameModel(game))).does.not.contain('jtest');
    expect(JSON.stringify(Server.getSpectatorModel(game))).does.not.contain('jtest');
  });

  it('reports the sizes of the decks in the game', () => {
    [game] = testGame(2, {preludeExtension: true, turmoilExtension: true});
    game.preludeDeck.discardPile.push(...game.preludeDeck.drawPile.splice(0, 1));

    const model = Server.getGameModel(game).otherDeckSizes;

    expect(model.corporations).deep.eq({drawPile: game.corporationDeck.drawPile.length, discardPile: 0});
    expect(model.preludes).deep.eq({drawPile: game.preludeDeck.drawPile.length, discardPile: 1});
    expect(model.ceos).is.undefined;
    expect(model.globalEvents).deep.eq({
      drawPile: game.turmoil!.globalEventDealer.deck.length,
      discardPile: game.turmoil!.globalEventDealer.discards.length,
    });
  });

  it('judge model shows every player\'s hand and no player secrets', () => {
    [game, player, player2] = testGame(2, {judgeLink: true, playerPasswords: true});
    player.cardsInHand = cardsFromJSON([CardName.ANTS]);
    player2.cardsInHand = cardsFromJSON([CardName.FISH]);
    player.password = 'player-one-secret';
    player2.password = 'player-two-secret';
    game.judgePassword = 'judge-secret';

    const model = Server.getJudgeModel(game);

    expect(model.id).eq(game.judgeId);
    expect(model.password).eq('judge-secret');
    expect(model.thisPlayer).is.undefined;
    expect(model.privates.map((p) => p.cardsInHand.map(toName))).deep.eq([[CardName.ANTS], [CardName.FISH]]);
    expect(model.privates.map((p) => p.color)).deep.eq([player.color, player2.color]);
    const json = JSON.stringify(model);
    expect(json).does.not.include('player-one-secret');
    expect(json).does.not.include('player-two-secret');
    expect(json).does.not.include(player.id);
    expect(json).does.not.include(player2.id);
  });

  it('hides a frozen player\'s prompt but not the judge\'s view of it', () => {
    [game, player] = testGame(2, {judgeLink: true});
    player.setWaitingFor(new SelectOption('Input'));
    game.frozen = true;

    expect(Server.getPlayerModel(player).waitingFor).is.undefined;
    const index = game.playersInGenerationOrder.indexOf(player);
    expect(Server.getJudgeModel(game).privates[index].waitingFor).is.not.undefined;
  });

  it('the judge model needs a judge id', () => {
    [game] = testGame(2);

    expect(() => Server.getJudgeModel(game)).to.throw('no judge id');
  });

  it('player and spectator models never carry the judge id', () => {
    [game, player] = testGame(2, {judgeLink: true});
    game.judgePassword = 'secret';
    expect(game.judgeId).is.a('string');

    for (const model of [Server.getPlayerModel(player), Server.getSpectatorModel(game)]) {
      const json = JSON.stringify(model);
      expect(json).does.not.include(game.judgeId!);
      expect(json).does.not.include('secret');
    }
  });

  it('a draft pick changes the judge signature', () => {
    [game, player, player2] = testGame(2, {draftVariant: true, judgeLink: true, skipInitialShuffling: true});
    game.projectDeck.drawPile.unshift(...cardsFromJSON([
      CardName.ACQUIRED_COMPANY,
      CardName.BIOFERTILIZER_FACILITY,
      CardName.CAPITAL,
      CardName.DECOMPOSERS,
      CardName.EARTH_OFFICE,
      CardName.FISH,
      CardName.GENE_REPAIR,
      CardName.HACKERS]));
    game.generation = 1;
    // Same as finishGeneration, but each player's action-phase input is cleared first so the
    // draft inputs do not overwrite it.
    for (const p of [player, player2]) {
      p.popWaitingFor();
      game.playerHasPassed(p);
      game.playerIsFinishedTakingActions();
    }
    expect(game.generation).eq(2);
    const before = Server.getJudgeSignature(game);

    const selectCard = cast(player.popWaitingFor(), SelectCard);
    selectCard.process({type: 'card', cards: [CardName.BIOFERTILIZER_FACILITY]});

    expect(Server.getJudgeSignature(game)).not.eq(before);
  });
});
