import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {BeginnerCorporation} from '../../src/server/cards/corporation/BeginnerCorporation';
import {Ants} from '../../src/server/cards/base/Ants';
import {Algae} from '../../src/server/cards/base/Algae';
import {Tardigrades} from '../../src/server/cards/base/Tardigrades';
import {IGame} from '../../src/server/IGame';
import {SerializedGame} from '../../src/server/SerializedGame';
import {buildReplayView} from '../../src/server/replay/replayView';
import {loadSandboxGame} from '../../src/server/replay/sandbox';
import {RouteError} from '../../src/server/routes/RouteError';
import {CardName} from '../../src/common/cards/CardName';
import {Phase} from '../../src/common/Phase';
import {Timer} from '../../src/common/Timer';
import {PlayerViewModel} from '../../src/common/models/PlayerModel';
import {finishGeneration} from '../TestingUtils';
import {cast} from '../../src/common/utils/utils';
import {SelectCard} from '../../src/server/inputs/SelectCard';

describe('buildReplayView', () => {
  let game: IGame;
  let player: TestPlayer;
  let player2: TestPlayer;
  let save: SerializedGame;
  let sandbox: IGame;

  beforeEach(() => {
    [game, player, player2] = testGame(2);
    // Players who already picked a corporation, so loading does not go back to the initial research phase.
    [player, player2].forEach((p) => p.playedCards.push(new BeginnerCorporation()));
    player.cardsInHand = [new Ants()];
    player2.cardsInHand = [new Algae(), new Tardigrades()];
    save = game.serialize();
    sandbox = loadSandboxGame(save);
  });

  it('all hands shows every player\'s cards', () => {
    const r = buildReplayView(sandbox, game.spectatorId, 3, 'all');
    expect(r.saveId).eq(3);
    expect(r.viewAs).eq('all');
    expect(r.privates.map((p) => p.color)).has.members(sandbox.players.map((p) => p.color));
    const handOf = (color: string) => r.privates.find((p) => p.color === color)!.cardsInHand.map((c) => c.name);
    expect(handOf(player.color)).deep.eq([CardName.ANTS]);
    expect(handOf(player2.color)).deep.eq([CardName.ALGAE, CardName.TARDIGRADES]);
  });

  it('all hands uses the spectator view', () => {
    const r = buildReplayView(sandbox, game.spectatorId, 3, 'all');
    expect(r.view.color).eq('neutral');
    expect(r.view.thisPlayer).is.undefined;
    expect(r.view.id).eq(game.spectatorId);
  });

  it('one player\'s view hides nothing of theirs and carries no ids or prompts', () => {
    const r = buildReplayView(sandbox, game.spectatorId, 3, player2.color);
    const view = r.view as PlayerViewModel;
    expect(view.id).eq(game.spectatorId);
    expect(view.color).eq(player2.color);
    expect(view.waitingFor).is.undefined;
    expect(view.cardsInHand.map((c) => c.name)).deep.eq([CardName.ALGAE, CardName.TARDIGRADES]);
    expect(r.privates).is.empty;
  });

  it('answers no prompt even when the save was waiting for the player', () => {
    // A restored game asks the active player again, so the sandbox has a prompt to leave out.
    expect(sandbox.activePlayer.getWaitingFor()).is.not.undefined;
    const r = buildReplayView(sandbox, game.spectatorId, 3, sandbox.activePlayer.color);
    expect((r.view as PlayerViewModel).waitingFor).is.undefined;
    const all = buildReplayView(sandbox, game.spectatorId, 3, 'all');
    expect(all.privates.map((p) => p.waitingFor)).deep.eq([undefined, undefined]);
  });

  it('carries the cards a player chooses from, but not the prompt, as in the research phase', () => {
    // A research phase save comes back with each player choosing which drafted cards to buy, which only the prompt holds.
    [game, player, player2] = testGame(2, {draftVariant: true});
    [player, player2].forEach((p) => p.playedCards.push(new BeginnerCorporation()));
    player.draftedCards = [new Ants(), new Algae()];
    player2.draftedCards = [new Tardigrades()];
    const research = loadSandboxGame({...game.serialize(), phase: Phase.RESEARCH});
    const names = (choice: {cards: ReadonlyArray<{name: CardName}>} | undefined) => choice?.cards.map((c) => c.name);

    const all = buildReplayView(research, game.spectatorId, 3, 'all');
    const choiceOf = (color: string) => all.privates.find((p) => p.color === color)!;
    expect(names(choiceOf(player.color).pendingChoice)).deep.eq([CardName.ANTS, CardName.ALGAE]);
    expect(names(choiceOf(player2.color).pendingChoice)).deep.eq([CardName.TARDIGRADES]);
    expect(all.privates.map((p) => p.waitingFor)).deep.eq([undefined, undefined]);

    const one = buildReplayView(research, game.spectatorId, 3, player.color);
    expect(names(one.pendingChoice)).deep.eq([CardName.ANTS, CardName.ALGAE]);
    expect((one.view as PlayerViewModel).waitingFor).is.undefined;
  });

  it('shows the drafted cards and the hand still to pick from, between the picks of a draft', () => {
    [game, player, player2] = testGame(2, {draftVariant: true});
    game.generation = 1;
    finishGeneration(game);
    const handOf = (p: TestPlayer) => cast(p.getWaitingFor(), SelectCard).cards.map((c) => c.name);
    const names = (cards: ReadonlyArray<{name: CardName}> | undefined) => cards?.map((c) => c.name);
    const privatesAt = (p: TestPlayer) => buildReplayView(loadSandboxGame(game.serialize()), game.spectatorId, 3, 'all').privates.find((x) => x.color === p.color)!;
    const hand = handOf(player);
    const hand2 = handOf(player2);

    player.process({type: 'card', cards: [hand[0]]});
    // Before the other player picks, the pick is drafted and the other player chooses from the whole hand.
    expect(names(privatesAt(player).draftedCards)).deep.eq([hand[0]]);
    expect(names(privatesAt(player2).pendingChoice?.cards)).deep.eq(hand2);

    player2.process({type: 'card', cards: [hand2[0]]});
    // The next round: each holds one drafted card and chooses from the hand the other passed on.
    expect(names(privatesAt(player2).draftedCards)).deep.eq([hand2[0]]);
    expect(names(privatesAt(player).pendingChoice?.cards)).deep.eq(hand2.slice(1));
    expect(names(privatesAt(player2).pendingChoice?.cards)).deep.eq(hand.slice(1));
  });

  it('never hands out a player id, not even after the game ended', () => {
    const ended = loadSandboxGame({...save, phase: Phase.END});
    const ids = [player.id, player2.id];
    for (const viewAs of ['all', player.color] as const) {
      const r = buildReplayView(ended, game.spectatorId, 3, viewAs);
      expect(r.view.players.map((p) => p.id)).deep.eq([undefined, undefined]);
      expect(r.view.thisPlayer?.id).is.undefined;
      expect(JSON.stringify(r)).does.not.contain(ids[0]).and.does.not.contain(ids[1]);
    }
  });

  describe('VP', () => {
    beforeEach(() => {
      player.terraformRating = 23;
      player2.terraformRating = 27;
      sandbox = loadSandboxGame(game.serialize());
    });

    const totals = (r: ReturnType<typeof buildReplayView>) => r.view.players.map((p) => [p.color, p.victoryPointsBreakdown.total]);

    for (const viewAs of ['all', 'player2'] as const) {
      it(`shows every player's VP when asked, as ${viewAs}`, () => {
        const r = buildReplayView(sandbox, game.spectatorId, 3, viewAs === 'all' ? 'all' : player2.color, true);
        expect(r.view.allVictoryPoints).is.true;
        expect(totals(r)).deep.eq([[player.color, 23], [player2.color, 27]]);
        if (viewAs !== 'all') {
          expect(r.view.thisPlayer?.victoryPointsBreakdown.total).eq(27);
        }
      });
    }

    it('shows only the viewed player\'s VP otherwise', () => {
      const one = buildReplayView(sandbox, game.spectatorId, 3, player2.color);
      expect(one.view.allVictoryPoints).is.undefined;
      expect(totals(one)).deep.eq([[player.color, 0], [player2.color, 27]]);
      const all = buildReplayView(sandbox, game.spectatorId, 3, 'all');
      expect(totals(all)).deep.eq([[player.color, 0], [player2.color, 0]]);
    });
  });

  it('rejects an unknown color', () => {
    // Two players use two colors, the others are free.
    const unused = (['red', 'green', 'yellow', 'blue', 'black', 'purple', 'orange', 'pink'] as const)
      .find((c) => sandbox.players.every((p) => p.color !== c))!;
    expect(() => buildReplayView(sandbox, game.spectatorId, 3, unused)).to.throw(RouteError);
  });

  describe('timers', () => {
    // The saved clock of `player` was running when the game was saved, and had 5 s on it.
    function saveWithRunningTimer(): IGame {
      player.timer = Timer.deserialize({
        sumElapsed: 5_000,
        startedAt: Date.now() - 3_600_000,
        running: true,
        afterFirstAction: true,
        lastStoppedAt: 0,
      });
      player2.timer = Timer.deserialize({
        sumElapsed: 7_000,
        startedAt: 0,
        running: false,
        afterFirstAction: true,
        lastStoppedAt: 0,
      });
      return loadSandboxGame(game.serialize());
    }

    it('shows the time stored in the save, not a running clock', () => {
      const withTimers = saveWithRunningTimer();
      for (const viewAs of ['all', player.color, player2.color] as const) {
        const r = buildReplayView(withTimers, game.spectatorId, 3, viewAs);
        const timers = r.view.players.map((p) => [p.color, p.timer.sumElapsed, p.timer.running]);
        expect(timers).deep.eq([[player.color, 5_000, false], [player2.color, 7_000, false]]);
        if (viewAs !== 'all') {
          expect(r.view.thisPlayer?.timer.running).is.false;
        }
      }
    });

    for (const viewAs of ['all', 'player', 'player2'] as const) {
      it(`does not change the timers of the sandbox itself, as ${viewAs}`, () => {
        const withTimers = saveWithRunningTimer();
        const before = withTimers.players.map((p) => p.timer.serialize());
        buildReplayView(withTimers, game.spectatorId, 3, viewAs === 'all' ? 'all' : (viewAs === 'player' ? player : player2).color);
        expect(withTimers.players.map((p) => p.timer.serialize())).deep.eq(before);
      });
    }
  });
});
