import {expect} from 'chai';
import {HeadStart} from '../../../src/server/cards/promo/HeadStart';
import {TestPlayer} from '../../TestPlayer';
import {fakeCard, runAllActions} from '../../TestingUtils';
import {testGame} from '../../TestGame';
import {Units} from '../../../src/common/Units';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {Phase} from '../../../src/common/Phase';
import {Loan} from '../../../src/server/cards/prelude/Loan';
import {Donation} from '../../../src/server/cards/prelude/Donation';
import {DoubleDown} from '../../../src/server/cards/promo/DoubleDown';
import {TharsisRepublic} from '../../../src/server/cards/corporation/TharsisRepublic';
import {BeginnerCorporation} from '../../../src/server/cards/corporation/BeginnerCorporation';
import {MarsMaths} from '../../../src/server/cards/pathfinders/MarsMaths';
import {cast} from '../../../src/common/utils/utils';
import {IPreludeCard} from '../../../src/server/cards/prelude/IPreludeCard';

describe('HeadStart', () => {
  let headStart: HeadStart;
  let loan: Loan;
  let game: IGame;
  let player: TestPlayer;
  let player2: TestPlayer;

  beforeEach(() => {
    headStart = new HeadStart();
    loan = new Loan();
    [game, player, player2] = testGame(2, {preludeExtension: true});
  });

  function start() {
    player.preludeCardsInHand = [headStart, loan];
    player2.preludeCardsInHand = [new Donation()];
    player.takeAction();
  }

  function playPrelude(prelude: IPreludeCard) {
    const selectCard = cast(player.getWaitingFor(), SelectCard<IPreludeCard>);
    expect(selectCard.title).eq('Select prelude card to play');
    player.process({type: 'card', cards: [prelude.name]});
    runAllActions(game);
  }

  function actionMenu(): OrOptions {
    expect(game.activePlayer).eq(player);
    return cast(player.getWaitingFor(), OrOptions);
  }

  function choose(title: string) {
    const menu = actionMenu();
    const index = menu.options.findIndex((option) => option.title === title);
    expect(index, `no "${title}" in ${menu.options.map((o) => o.title)}`).gte(0);
    player.process({type: 'or', index, response: {type: 'option'}});
    runAllActions(game);
  }

  function expectPlayer2ToPlayPreludes() {
    expect(game.phase).eq(Phase.PRELUDES);
    expect(game.activePlayer).eq(player2);
    expect(player.getWaitingFor()).is.undefined;
    expect(cast(player2.getWaitingFor(), SelectCard).title).eq('Select prelude card to play');
  }

  it('Gain resources', () => {
    player.cardsInHand.push(fakeCard(), fakeCard(), fakeCard());
    headStart.play(player);
    expect(player.stock.asUnits()).deep.eq(Units.of({megacredits: 6, steel: 2}));
    expect(player.headStartActionsRemaining).eq(2);
  });

  it('Take 2 actions, as first prelude', () => {
    player.heat = 16;
    start();
    playPrelude(headStart);

    expect(actionMenu().title).eq('Take your first action');
    choose('Convert 8 heat into temperature');
    expect(actionMenu().title).eq('Take your next action');
    choose('Convert 8 heat into temperature');

    expect(player.heat).eq(0);
    expect(player.headStartActionsRemaining).eq(0);
    playPrelude(loan);
    expectPlayer2ToPlayPreludes();
  });

  it('Take 2 actions, as second prelude', () => {
    player.heat = 16;
    start();
    playPrelude(loan);
    playPrelude(headStart);

    choose('Convert 8 heat into temperature');
    choose('Convert 8 heat into temperature');

    expect(player.heat).eq(0);
    expectPlayer2ToPlayPreludes();
  });

  it('Cannot pass, end turn, or undo during Head Start', () => {
    [game, player, player2] = testGame(2, {preludeExtension: true, undoOption: true});
    player.heat = 16;
    start();
    playPrelude(headStart);
    choose('Convert 8 heat into temperature');

    const titles = actionMenu().options.map((option) => option.title);
    expect(titles).includes('Skip this action');
    expect(titles).does.not.include('Pass for this generation');
    expect(titles).does.not.include('End Turn');
    expect(titles).does.not.include('Undo last action');
  });

  it('Hands the turn on even when an action raised the action limit', () => {
    // Mars Maths raises availableActionsThisRound above the 2 actions the prelude plays counted.
    const marsMaths = new MarsMaths();
    player.playedCards.push(marsMaths);
    start();
    playPrelude(loan);
    playPrelude(headStart);

    const menu = actionMenu();
    const index = menu.options.findIndex((option) => option.title === 'Perform an action from a played card');
    player.process({type: 'or', index, response: {type: 'card', cards: [marsMaths.name]}});
    runAllActions(game);
    expect(player.availableActionsThisRound).eq(4);
    choose('Skip this action');

    expectPlayer2ToPlayPreludes();
  });

  it('Skip the actions', () => {
    start();
    playPrelude(headStart);
    choose('Skip this action');
    choose('Skip this action');

    expect(game.hasPassedThisActionPhase(player)).is.false;
    playPrelude(loan);
    expectPlayer2ToPlayPreludes();
  });

  it('The corporation first action waits for the action phase', () => {
    const tharsis = new TharsisRepublic();
    player.pendingInitialActions = [tharsis];
    start();
    playPrelude(headStart);

    const titles = actionMenu().options.map((option) => option.title);
    expect(titles.some((title) => JSON.stringify(title).includes('Take first action'))).is.false;
    choose('Skip this action');
    choose('Skip this action');
    playPrelude(loan);

    expect(player.pendingInitialActions).deep.eq([tharsis]);
  });

  it('Reloading the game keeps the remaining actions', () => {
    // Without corporations, loading a generation 1 game restarts the initial card selection.
    player.playedCards.push(new BeginnerCorporation());
    player2.playedCards.push(new BeginnerCorporation());
    player.heat = 16;
    start();
    playPrelude(headStart);
    choose('Convert 8 heat into temperature');

    const reloaded = Game.deserialize(game.serialize());
    const reloadedPlayer = reloaded.getPlayerById(player.id);

    expect(reloadedPlayer.headStartActionsRemaining).eq(1);
    expect(reloaded.activePlayer.id).eq(player.id);
    expect(cast(reloadedPlayer.getWaitingFor(), OrOptions).title).eq('Take your next action');
  });

  it('Double Down copying Head Start grants 2 more actions', () => {
    const doubleDown = new DoubleDown();
    player.preludeCardsInHand = [headStart, doubleDown];
    player2.preludeCardsInHand = [new Donation()];
    player.takeAction();

    playPrelude(headStart);
    choose('Skip this action');
    choose('Skip this action');
    playPrelude(doubleDown);
    const copy = cast(player.getWaitingFor(), SelectCard<IPreludeCard>);
    expect(copy.cards).deep.eq([headStart]);
    player.process({type: 'card', cards: [headStart.name]});
    runAllActions(game);

    expect(player.headStartActionsRemaining).eq(2);
    choose('Skip this action');
    choose('Skip this action');
    expectPlayer2ToPlayPreludes();
  });
});
