import {expect} from 'chai';
import {testGame} from '../TestGame';
import {IGame} from '../../src/server/IGame';
import {MarsBot} from '../../src/server/automa/MarsBot';
import {Luna} from '../../src/server/colonies/Luna';
import {Ceres} from '../../src/server/colonies/Ceres';
import {ColonyName} from '../../src/common/colonies/ColonyName';
import {BoardName} from '../../src/common/boards/BoardName';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';
import {Phase} from '../../src/common/Phase';
import {getAutomaMaxGeneration} from '../../src/common/automa/AutomaTypes';
import {GameOptions} from '../../src/server/game/GameOptions';

// Once the game is decided, the final greeneries are only worth their VP: the special hexes give
// nothing, and nothing overflows on the Shipping Board.
describe('MarsBot final greenery', () => {
  function setup(boardName: BoardName, options: Partial<GameOptions> = {}): {game: IGame, marsBot: MarsBot} {
    const [game] = testGame(1, {automaOption: true, automaDifficulty: 'normal', boardName, ...options});
    return {game, marsBot: game.automaHooks!.marsBot};
  }

  /** The state placeFinalGreeneries runs in: the last generation's production phase. */
  function endGame(game: IGame): void {
    game.generation = getAutomaMaxGeneration(game.gameOptions.preludeExtension);
    game.phase = Phase.PRODUCTION;
    expect(game.isDoneWithFinalProduction()).is.true;
  }

  it('does not trigger the Hellas south pole', () => {
    const {game, marsBot} = setup(BoardName.HELLAS);
    const southPole = game.board.spaces.find((sp) => sp.bonus.includes(SpaceBonus.OCEAN))!;
    marsBot.turnResolver.megacredits = 10;
    endGame(game);
    const tr = marsBot.player.terraformRating;

    game.addGreenery(marsBot.player, southPole, false);

    expect(game.board.getOceanSpaces()).has.length(0);
    expect(marsBot.player.terraformRating).to.eq(tr);
    expect(marsBot.turnResolver.megacredits).to.eq(10);
  });

  it('does not trigger the Vastitas Borealis north pole', () => {
    const {game, marsBot} = setup(BoardName.VASTITAS_BOREALIS_NOVA);
    const northPole = game.board.spaces.find((sp) => sp.bonus.includes(SpaceBonus.TEMPERATURE_4MC))!;
    marsBot.turnResolver.megacredits = 10;
    endGame(game);
    const temperature = game.getTemperature();

    game.addGreenery(marsBot.player, northPole, false);

    expect(game.getTemperature()).to.eq(temperature);
    expect(marsBot.turnResolver.megacredits).to.eq(10);
  });

  describe('on Terra Cimmeria with Colonies', () => {
    let game: IGame;
    let marsBot: MarsBot;
    beforeEach(() => {
      ({game, marsBot} = setup(BoardName.TERRA_CIMMERIA_NOVA, {coloniesExtension: true}));
      game.colonies = [new Luna(), new Ceres()];
      game.colonies.forEach((colony) => colony.isActive = true);
    });

    it('builds no colony on MSL Curiosity and advances no track', () => {
      const msl = game.board.spaces.find((sp) => sp.bonus.includes(SpaceBonus.COLONY))!;
      marsBot.turnResolver.megacredits = 10;
      marsBot.shippingBoard.storage.set(ColonyName.LUNA, 4);
      marsBot.shippingBoard.storage.set(ColonyName.CERES, 4);
      endGame(game);
      const tracks = marsBot.marsBotBoard.tracks.map((track) => track.position);

      game.addGreenery(marsBot.player, msl, false);

      expect(game.colonies.map((colony) => colony.colonies.length)).deep.eq([0, 0]);
      expect(marsBot.marsBotBoard.tracks.map((track) => track.position)).deep.eq(tracks);
      expect(marsBot.turnResolver.megacredits).to.eq(10);
    });

    it('still builds the colony during the action phase', () => {
      const msl = game.board.spaces.find((sp) => sp.bonus.includes(SpaceBonus.COLONY))!;
      marsBot.turnResolver.megacredits = 10;
      game.phase = Phase.ACTION;
      expect(game.isDoneWithFinalProduction()).is.false;

      game.addGreenery(marsBot.player, msl, false);

      expect(game.colonies.flatMap((colony) => colony.colonies)).has.length(1);
      expect(marsBot.turnResolver.megacredits).to.eq(5);
    });

    it('stops the Shipping Board overflowing', () => {
      endGame(game);
      const tracks = marsBot.marsBotBoard.tracks.map((track) => track.position);

      marsBot.shippingBoard.add(ColonyName.CERES, 5, marsBot);

      expect(marsBot.shippingBoard.get(ColonyName.CERES)).to.eq(5);
      expect(marsBot.marsBotBoard.tracks.map((track) => track.position)).deep.eq(tracks);
    });

    it('lets the Shipping Board overflow before the game is decided', () => {
      game.phase = Phase.ACTION;
      const tracks = marsBot.marsBotBoard.tracks.map((track) => track.position);

      marsBot.shippingBoard.add(ColonyName.CERES, 5, marsBot);

      expect(marsBot.shippingBoard.get(ColonyName.CERES)).to.eq(0);
      expect(marsBot.marsBotBoard.tracks.map((track) => track.position)).not.deep.eq(tracks);
    });
  });

  it('counts a special hex as a space without rewards in the tiebreak', () => {
    const {game, marsBot} = setup(BoardName.HELLAS);
    const southPole = game.board.spaces.find((sp) => sp.bonus.includes(SpaceBonus.OCEAN))!;
    marsBot.turnResolver.megacredits = 10;
    const placer = marsBot.turnResolver.tilePlacer;
    const icons = (): number => placer['tiebreakIcons'](southPole, new Set());
    game.phase = Phase.ACTION;
    expect(icons()).to.eq(2.5);

    endGame(game);

    expect(icons()).to.eq(0);
  });
});
