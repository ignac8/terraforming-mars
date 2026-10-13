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
import {FAILED_ACTION_MC} from '../../src/common/automa/AutomaTypes';
import {CardName} from '../../src/common/cards/CardName';
import {getMarsBotCorp} from '../../src/server/automa/corps/MarsBotCorpRegistry';
import {MAX_TEMPERATURE} from '../../src/common/constants';
import {setTemperature} from '../TestingUtils';
import {Space} from '../../src/server/boards/Space';

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

  describe('the tracker move onto the greenery', () => {
    // Tharsis Earth track: #12 is a greenery icon
    const EARTH = 5;

    function finalGreenery(corp: CardName | undefined) {
      const {game, marsBot} = setup(BoardName.THARSIS);
      if (corp !== undefined) {
        marsBot.setCorpAndSetup(getMarsBotCorp(corp)!);
      }
      marsBot.marsBotBoard.tracks[EARTH].position = 11;
      endGame(game);
      const mc = marsBot.turnResolver.megacredits;
      let placed: Space | undefined;
      const placer = marsBot.turnResolver.tilePlacer;
      const find = placer.findGreenerySpace.bind(placer);
      placer.findGreenerySpace = (where) => placed = find(where);
      return {game, marsBot, mc, placementMc: () => placer.getTotalPlacementMC(placed!)};
    }

    it('fires Teractor\'s Earth track cube', () => {
      const {marsBot, mc, placementMc} = finalGreenery(CardName.TERACTOR);

      marsBot.placeFinalGreeneries();

      expect(marsBot.marsBotBoard.tracks[EARTH].position).to.eq(12);
      expect(marsBot.turnResolver.megacredits).to.eq(mc + placementMc() + 2);
    });

    it('takes a Failed Action for Helion\'s black cube with the temperature maxed', () => {
      const {game, marsBot, mc, placementMc} = finalGreenery(CardName.HELION);
      setTemperature(game, MAX_TEMPERATURE);

      marsBot.placeFinalGreeneries();

      expect(marsBot.turnResolver.megacredits).to.eq(mc + placementMc() + FAILED_ACTION_MC);
    });

    it('does not chain into Manutech\'s extra advance (BGG 3385156)', () => {
      const {marsBot} = finalGreenery(CardName.MANUTECH);

      marsBot.placeFinalGreeneries();

      expect(marsBot.marsBotBoard.tracks[EARTH].position).to.eq(12);
    });

    it('with no legal space takes a Failed Action and leaves the tracker (BGG 3404826)', () => {
      const {game, marsBot, mc} = finalGreenery(CardName.TERACTOR);
      marsBot.turnResolver.tilePlacer.findGreenerySpace = () => undefined;

      marsBot.placeFinalGreeneries();

      expect(marsBot.marsBotBoard.tracks[EARTH].position).to.eq(11);
      expect(marsBot.turnResolver.megacredits).to.eq(mc + FAILED_ACTION_MC);
      expect(game.board.getGreeneries(marsBot.player)).to.have.length(0);
    });
  });

  // Once the game has ended nothing chains: only the final greenery move itself advances a tracker
  // (user decision, following BGG 3385156 and 3513998). Gains still happen.
  describe('no chains after the game has ended', () => {
    const ENERGY = 4;
    const PLANT = 6;
    const EVENT = 2;

    /** Every tracker at 0, so only `trackIndex` at `position` has a final greenery ahead (Tharsis). */
    function finalGreeneryOn(corp: CardName, trackIndex: number, position: number, options: Partial<GameOptions> = {}) {
      const {game, marsBot} = setup(BoardName.THARSIS, options);
      marsBot.setCorpAndSetup(getMarsBotCorp(corp)!);
      marsBot.marsBotBoard.tracks.forEach((track) => track.position = 0);
      marsBot.marsBotBoard.tracks[trackIndex].position = position;
      endGame(game);
      return {
        game,
        marsBot,
        tracks: () => marsBot.marsBotBoard.tracks.map((track) => track.position),
        played: marsBot.playedProjectCards.length,
        deck: game.projectDeck.size(),
        tr: marsBot.player.terraformRating,
        temperature: game.getTemperature(),
      };
    }

    it('Thorgate\'s white cube draws no card but still raises the temperature', () => {
      const {game, marsBot, tracks, played, deck, tr, temperature} = finalGreeneryOn(CardName.THORGATE, ENERGY, 9);
      const expected = tracks();
      expected[ENERGY] = 10;

      marsBot.placeFinalGreeneries();

      expect(tracks()).deep.eq(expected);
      expect(marsBot.playedProjectCards).has.length(played);
      expect(game.projectDeck.size()).to.eq(deck);
      expect(game.getTemperature()).to.eq(temperature + 2);
      expect(marsBot.player.terraformRating).to.eq(tr + 1);
      expect(game.board.getGreeneries(marsBot.player)).has.length(1);
    });

    for (const position of [2, 5]) {
      it(`Aridor's black cube at plant #${position + 1} does not advance the event track`, () => {
        const {game, marsBot, tracks, tr} = finalGreeneryOn(CardName.ARIDOR, PLANT, position, {coloniesExtension: true});
        const expected = tracks();
        expected[PLANT] = position + 1;

        marsBot.placeFinalGreeneries();

        expect(tracks()).deep.eq(expected);
        expect(expected[EVENT]).to.eq(0);
        expect(marsBot.player.terraformRating).to.eq(tr);
        expect(game.board.getGreeneries(marsBot.player)).has.length(1);
      });
    }
  });

  // "probably not after the end of the game" (TDaver, BGG 3513998)
  it('Philares advances no track from an adjacency made after the game has ended', () => {
    const {game, marsBot} = setup(BoardName.THARSIS);
    marsBot.setCorpAndSetup(getMarsBotCorp(CardName.PHILARES)!);
    const human = game.players[0];
    const next = game.board.getAvailableSpacesOnLand(human)
      .find((s) => game.board.getAdjacentSpaces(s).some((a) => a.tile !== undefined && a.player === marsBot.player))!;
    marsBot.setCorpState('scienceResources', 3);
    endGame(game);
    const tracks = marsBot.marsBotBoard.tracks.map((track) => track.position);

    game.addGreenery(human, next, false);

    expect(marsBot.marsBotBoard.tracks.map((track) => track.position)).deep.eq(tracks);
  });
});
