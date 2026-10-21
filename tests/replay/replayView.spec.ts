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
    expect(r.privates.map((p) => p.color)).deep.eq(sandbox.players.map((p) => p.color));
    expect(r.privates[1].cardsInHand.map((c) => c.name)).deep.eq([CardName.ALGAE, CardName.TARDIGRADES]);
    expect(r.privates[0].cardsInHand.map((c) => c.name)).deep.eq([CardName.ANTS]);
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

    it('does not change the timers of the sandbox itself', () => {
      const withTimers = saveWithRunningTimer();
      const before = withTimers.players.map((p) => p.timer.serialize());
      buildReplayView(withTimers, game.spectatorId, 3, 'all');
      expect(withTimers.players.map((p) => p.timer.serialize())).deep.eq(before);
    });
  });
});
