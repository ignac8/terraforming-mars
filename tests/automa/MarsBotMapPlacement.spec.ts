import {expect} from 'chai';
import {testGame} from '../TestGame';
import {setTemperature} from '../TestingUtils';
import {IGame} from '../../src/server/IGame';
import {Space} from '../../src/server/boards/Space';
import {Board} from '../../src/server/boards/Board';
import {AutomaGameHooks} from '../../src/server/automa/AutomaGameHooks';
import {MarsBot} from '../../src/server/automa/MarsBot';
import {MarsBotTilePlacer} from '../../src/server/automa/MarsBotTilePlacer';
import {Luna} from '../../src/server/colonies/Luna';
import {Ceres} from '../../src/server/colonies/Ceres';
import {ColonyName} from '../../src/common/colonies/ColonyName';
import {BoardName} from '../../src/common/boards/BoardName';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {TileType} from '../../src/common/TileType';
import {GameOptions} from '../../src/server/game/GameOptions';
import {RandomMAOptionType} from '../../src/common/ma/RandomMAOptionType';
import {IMilestone} from '../../src/server/milestones/IMilestone';
import {IAward} from '../../src/server/awards/IAward';
import {Geologist} from '../../src/server/milestones/modular/Geologist';
import {Founder} from '../../src/server/awards/modular/Founder';
import {Suburbian} from '../../src/server/awards/modular/Suburbian';
import {Highlander} from '../../src/server/awards/modular/Highlander';
import {CardName} from '../../src/common/cards/CardName';
import {getMarsBotCorp} from '../../src/server/automa/corps/MarsBotCorpRegistry';

type Pred = (space: Space) => boolean;

type Setup = {
  game: IGame,
  marsBot: MarsBot,
  placer: MarsBotTilePlacer,
};

const COSTLY_BONUSES = [SpaceBonus.OCEAN, SpaceBonus.TEMPERATURE_4MC, SpaceBonus.COLONY, SpaceBonus.DELEGATE];

function setup(boardName: BoardName, options: Partial<GameOptions> = {}): Setup {
  const [game] = testGame(1, {automaOption: true, automaDifficulty: 'normal', boardName, ...options});
  const marsBot = (game.automaHooks as AutomaGameHooks).marsBot;
  return {game, marsBot, placer: marsBot.turnResolver.tilePlacer};
}

/** Puts an ocean on every other ocean space, so spaces differ in how many oceans they touch. */
function placeSomeOceans(setup: Setup): void {
  const {game, marsBot} = setup;
  game.board.getAvailableSpacesForOcean(marsBot.player).forEach((space, i) => {
    if (i % 2 === 0) {
      game.simpleAddTile(marsBot.player, space, {tileType: TileType.OCEAN});
    }
  });
}

function oceansNextTo(game: IGame, space: Space): number {
  return game.board.getAdjacentSpaces(space).filter(Board.isOceanSpace).length;
}

function nextToVolcano(game: IGame, space: Space): boolean {
  return space.volcanic === true || game.board.getAdjacentSpaces(space).some((s) => s.volcanic === true);
}

/** Free land spaces whose bonus doesn't cost M€, so only the tiebreaker under test can tell them apart. */
function plainSpaces(game: IGame): ReadonlyArray<Space> {
  return game.board.getSpaces(SpaceType.LAND).filter((space) =>
    space.tile === undefined &&
    space.id !== game.board.noctisCitySpaceId &&
    !space.bonus.some((bonus) => COSTLY_BONUSES.includes(bonus)));
}

/**
 * Finds a space that satisfies `winner` and one that satisfies `loser`, which `related` accepts
 * together. Everything the pair isn't about is left to `related`, usually the same ocean adjacency.
 */
function pair(
  game: IGame,
  winner: Pred,
  loser: Pred,
  related: (winner: Space, loser: Space) => boolean = (w, l) => oceansNextTo(game, w) === oceansNextTo(game, l),
): [Space, Space] {
  const spaces = plainSpaces(game);
  for (const w of spaces.filter(winner)) {
    const l = spaces.find((s) => s !== w && loser(s) && related(w, s));
    if (l !== undefined) {
      return [w, l];
    }
  }
  throw new Error('No such pair of spaces on this board');
}

/** Which of the two spaces MarsBot would put a city on, when nothing else is a candidate. */
function pick(placer: MarsBotTilePlacer, a: Space, b: Space): Space | undefined {
  return placer.findCitySpace((space) => space === a || space === b);
}

function expectTie(game: IGame, placer: MarsBotTilePlacer, a: Space, b: Space): void {
  game.projectDeck.discardPile.length = 0;
  pick(placer, a, b);
  expect(game.projectDeck.discardPile, 'the tie should be broken with a flipped card').has.length(1);
}

/** MarsBot picks `winner` whichever way round the spaces come, without flipping a card to break a tie. */
function expectWins(game: IGame, placer: MarsBotTilePlacer, winner: Space, loser: Space): void {
  game.projectDeck.discardPile.length = 0;
  expect(pick(placer, winner, loser)).to.eq(winner);
  expect(pick(placer, loser, winner)).to.eq(winner);
  expect(game.projectDeck.discardPile, 'no card should be needed').has.length(0);
}

const hasIcons = (count: number): Pred => (space) => space.bonus.length === count;

describe('MarsBot tile placement tiebreakers by map', () => {
  describe('Hellas', () => {
    let s: Setup;
    beforeEach(() => {
      s = setup(BoardName.HELLAS);
      placeSomeOceans(s);
    });
    const polar = (game: IGame): Pred => (space) => space.y >= game.board.bottomRow - 1;

    it('prefers the polar region, even over more reward icons', () => {
      const isPolar = polar(s.game);
      const [winner, loser] = pair(s.game, (sp) => isPolar(sp) && hasIcons(0)(sp), (sp) => !isPolar(sp) && hasIcons(2)(sp));

      expectWins(s.game, s.placer, winner, loser);
    });

    it('still puts ocean adjacency ahead of the polar region', () => {
      const isPolar = polar(s.game);
      const [winner, loser] = pair(s.game, (sp) => !isPolar(sp), isPolar, (w, l) => oceansNextTo(s.game, w) > oceansNextTo(s.game, l));

      expectWins(s.game, s.placer, winner, loser);
    });

    it('goes on to reward icons when both are polar', () => {
      const isPolar = polar(s.game);
      const [winner, loser] = pair(s.game, (sp) => isPolar(sp) && hasIcons(2)(sp), (sp) => isPolar(sp) && hasIcons(0)(sp));

      expectWins(s.game, s.placer, winner, loser);
    });
  });

  describe('Elysium', () => {
    let s: Setup;
    beforeEach(() => {
      s = setup(BoardName.ELYSIUM);
      placeSomeOceans(s);
    });
    const southern = (game: IGame): Pred => (space) => space.y >= game.board.bottomRow - 3;

    it('prefers the southern region when reward icons are tied', () => {
      const isSouthern = southern(s.game);
      const [winner, loser] = pair(s.game, (sp) => isSouthern(sp) && hasIcons(1)(sp), (sp) => !isSouthern(sp) && hasIcons(1)(sp));

      expectWins(s.game, s.placer, winner, loser);
    });

    it('puts reward icons ahead of the southern region', () => {
      const isSouthern = southern(s.game);
      const [winner, loser] = pair(s.game, (sp) => !isSouthern(sp) && hasIcons(2)(sp), (sp) => isSouthern(sp) && hasIcons(0)(sp));

      expectWins(s.game, s.placer, winner, loser);
    });

    it('counts the fourth row from the bottom as southern', () => {
      const bottom = s.game.board.bottomRow;
      const [fourth, above] = pair(s.game, (sp) => sp.y === bottom - 3 && hasIcons(1)(sp), (sp) => sp.y < bottom - 3 && hasIcons(1)(sp));

      expectWins(s.game, s.placer, fourth, above);
    });

    it('does not count the fifth row from the bottom as southern', () => {
      const bottom = s.game.board.bottomRow;
      const [fifth, above] = pair(s.game, (sp) => sp.y === bottom - 4 && hasIcons(2)(sp), (sp) => sp.y < bottom - 4 && hasIcons(2)(sp));

      expectTie(s.game, s.placer, fifth, above);
    });
  });

  describe('Terra Cimmeria', () => {
    let s: Setup;
    let special: Space;
    const nextToSpecial: Pred = (space) => s.game.board.getAdjacentSpaces(space).includes(special);

    beforeEach(() => {
      s = setup(BoardName.TERRA_CIMMERIA_NOVA);
      placeSomeOceans(s);
      // The Neural Instance is a special tile too.
      special = plainSpaces(s.game).find((sp) => oceansNextTo(s.game, sp) === 0 && s.game.board.getAdjacentSpaces(sp).length === 6)!;
      s.game.simpleAddTile(s.marsBot.player, special, {tileType: TileType.NEURAL_INSTANCE});
    });

    it('prefers a space next to a special tile, even over more reward icons', () => {
      const [winner, loser] = pair(s.game, (sp) => nextToSpecial(sp) && hasIcons(0)(sp), (sp) => !nextToSpecial(sp) && hasIcons(2)(sp));

      expectWins(s.game, s.placer, winner, loser);
    });

    it('still puts ocean adjacency ahead of special tiles', () => {
      const [winner, loser] = pair(s.game, (sp) => !nextToSpecial(sp), nextToSpecial, (w, l) => oceansNextTo(s.game, w) > oceansNextTo(s.game, l));

      expectWins(s.game, s.placer, winner, loser);
    });
  });

  describe('Utopia Planitia', () => {
    let s: Setup;
    beforeEach(() => {
      s = setup(BoardName.UTOPIA_PLANITIA);
    });

    it('counts an edge space as one more reward icon', () => {
      const [edge, inland] = pair(s.game, (sp) => sp.edge && hasIcons(1)(sp), (sp) => !sp.edge && hasIcons(1)(sp));

      expectWins(s.game, s.placer, edge, inland);
    });

    it('ties an edge space with one more printed icon inland', () => {
      const [edge, inland] = pair(s.game, (sp) => sp.edge && hasIcons(1)(sp), (sp) => !sp.edge && hasIcons(2)(sp));

      expectTie(s.game, s.placer, edge, inland);
    });

    it('does not pay M€ for the extra icon', () => {
      const edge = plainSpaces(s.game).find((sp) => sp.edge && hasIcons(1)(sp))!;

      expect(s.placer.getPlacementBonusMC(edge)).to.eq(1);
    });
  });

  describe('Vastitas Borealis', () => {
    let s: Setup;
    beforeEach(() => {
      s = setup(BoardName.VASTITAS_BOREALIS_NOVA);
      placeSomeOceans(s);
    });

    it('counts a volcanic space and the spaces next to it as one more reward icon', () => {
      const volcanoes = s.game.board.spaces.filter((sp) => sp.volcanic === true).length;
      expect(volcanoes).to.be.greaterThan(0);

      const [near, far] = pair(s.game,
        (sp) => nextToVolcano(s.game, sp) && hasIcons(1)(sp),
        (sp) => !nextToVolcano(s.game, sp) && hasIcons(1)(sp),
        (w, l) => w.edge === l.edge);

      expectWins(s.game, s.placer, near, far);
    });

    it('puts reward icons ahead of ocean adjacency', () => {
      const [winner, loser] = pair(s.game,
        (sp) => !nextToVolcano(s.game, sp) && hasIcons(2)(sp),
        (sp) => !nextToVolcano(s.game, sp) && hasIcons(1)(sp),
        (w, l) => oceansNextTo(s.game, w) < oceansNextTo(s.game, l));

      expectWins(s.game, s.placer, winner, loser);
    });

    it('prefers an edge space to one next to more oceans', () => {
      const [edge, wet] = pair(s.game,
        (sp) => sp.edge && !nextToVolcano(s.game, sp) && hasIcons(1)(sp),
        (sp) => !sp.edge && !nextToVolcano(s.game, sp) && hasIcons(1)(sp),
        (w, l) => oceansNextTo(s.game, w) < oceansNextTo(s.game, l));

      expectWins(s.game, s.placer, edge, wet);
    });

    it('takes the space next to the most oceans when none of them is on the edge', () => {
      const [wet, dry] = pair(s.game,
        (sp) => !sp.edge && !nextToVolcano(s.game, sp) && hasIcons(1)(sp),
        (sp) => !sp.edge && !nextToVolcano(s.game, sp) && hasIcons(1)(sp),
        (w, l) => oceansNextTo(s.game, w) > oceansNextTo(s.game, l));

      expectWins(s.game, s.placer, wet, dry);
    });
  });

  describe('Tharsis', () => {
    it('ignores the edge and keeps ocean adjacency, then reward icons', () => {
      const s = setup(BoardName.THARSIS);
      const [edge, inland] = pair(s.game, (sp) => sp.edge && hasIcons(1)(sp), (sp) => !sp.edge && hasIcons(1)(sp));
      expectTie(s.game, s.placer, edge, inland);

      const [rich, poor] = pair(s.game, hasIcons(2), hasIcons(1));
      expectWins(s.game, s.placer, rich, poor);
    });
  });
});

describe('MarsBot tile placement with the Milestones & Awards expansion', () => {
  const MODULAR: Partial<GameOptions> = {randomMA: RandomMAOptionType.UNLIMITED, modularMA: true};

  /** The Vastitas Borealis board played with the Tharsis aid, and exactly these milestones and awards in play. */
  function modularSetup(milestones: Array<IMilestone> = [], awards: Array<IAward> = [], boardName = BoardName.VASTITAS_BOREALIS_NOVA): Setup {
    const s = setup(boardName, MODULAR);
    s.game.milestones = milestones;
    s.game.awards = awards;
    placeSomeOceans(s);
    return s;
  }

  it('uses the Tharsis tiebreakers and no map icon, whatever the map', () => {
    const s = modularSetup();
    const [wet, rich] = pair(s.game,
      (sp) => hasIcons(1)(sp) && !sp.edge,
      (sp) => hasIcons(2)(sp) && !sp.edge,
      (w, l) => oceansNextTo(s.game, w) > oceansNextTo(s.game, l));
    expectWins(s.game, s.placer, wet, rich);

    const [volcanic, flat] = pair(s.game,
      (sp) => nextToVolcano(s.game, sp) && hasIcons(1)(sp),
      (sp) => !nextToVolcano(s.game, sp) && hasIcons(1)(sp));
    expectTie(s.game, s.placer, volcanic, flat);
  });

  it('Geologist counts volcanic spaces and the spaces next to them as one more reward icon', () => {
    const s = modularSetup([new Geologist()]);
    const [volcanic, flat] = pair(s.game,
      (sp) => nextToVolcano(s.game, sp) && hasIcons(1)(sp),
      (sp) => !nextToVolcano(s.game, sp) && hasIcons(1)(sp));
    expectWins(s.game, s.placer, volcanic, flat);
  });

  it('Geologist does not count twice on a map that already does', () => {
    const s = setup(BoardName.VASTITAS_BOREALIS_NOVA);
    s.game.milestones = [new Geologist()];
    expect([...s.placer['extraIcons']()]).deep.eq(['volcanic']);
  });

  it('Founder counts the spaces next to a special tile as one more reward icon', () => {
    const s = modularSetup([], [new Founder()]);
    const preserve = plainSpaces(s.game).find((sp) => !sp.edge && s.game.board.getAdjacentSpaces(sp).length === 6)!;
    s.game.simpleAddTile(s.marsBot.player, preserve, {tileType: TileType.NATURAL_PRESERVE});
    const next = (sp: Space) => s.game.board.getAdjacentSpaces(sp).includes(preserve);
    const [near, far] = pair(s.game,
      (sp) => next(sp) && hasIcons(1)(sp),
      (sp) => !next(sp) && hasIcons(1)(sp));
    expectWins(s.game, s.placer, near, far);
  });

  it('Suburbian counts edge spaces as one more reward icon', () => {
    const s = modularSetup([], [new Suburbian()]);
    const [edge, inland] = pair(s.game, (sp) => sp.edge && hasIcons(1)(sp), (sp) => !sp.edge && hasIcons(1)(sp));
    expectWins(s.game, s.placer, edge, inland);
  });

  it('Highlander puts ocean adjacency after the reward icons', () => {
    const s = modularSetup([], [new Highlander()]);
    const [rich, wet] = pair(s.game, hasIcons(2), hasIcons(1), (w, l) => oceansNextTo(s.game, w) < oceansNextTo(s.game, l));
    expectWins(s.game, s.placer, rich, wet);

    s.game.awards = [];
    expectWins(s.game, s.placer, wet, rich);
  });

  it('Highlander moves ocean adjacency after the reward icons on a map with its own tiebreakers', () => {
    const s = setup(BoardName.ELYSIUM);
    s.game.awards = [new Highlander()];
    placeSomeOceans(s);
    const [rich, wet] = pair(s.game, hasIcons(2), hasIcons(1), (w, l) => oceansNextTo(s.game, w) < oceansNextTo(s.game, l));
    expectWins(s.game, s.placer, rich, wet);

    s.game.awards = [];
    expectWins(s.game, s.placer, wet, rich);
  });
});

describe('MarsBot special placement hexes', () => {
  describe('South Pole (Hellas)', () => {
    let s: Setup;
    let southPole: Space;
    beforeEach(() => {
      s = setup(BoardName.HELLAS);
      southPole = s.game.board.spaces.find((sp) => sp.bonus.includes(SpaceBonus.OCEAN))!;
    });

    // Polar too, since the polar region comes before reward icons on Hellas.
    function rival(): Space {
      return plainSpaces(s.game).find((sp) => hasIcons(2)(sp) && sp.y >= s.game.board.bottomRow - 1 &&
        oceansNextTo(s.game, sp) === oceansNextTo(s.game, southPole))!;
    }

    it('is available even when MarsBot cannot pay for it', () => {
      s.marsBot.turnResolver.megacredits = 0;

      expect(s.game.board.getAvailableSpacesOnLand(s.marsBot.player)).to.include(southPole);
    });

    it('is preferred to a space with two icons when MarsBot has 6 M€', () => {
      s.marsBot.turnResolver.megacredits = 6;
      const other = rival();

      expectWins(s.game, s.placer, southPole, other);
    });

    it('counts as a space without rewards with 5 M€', () => {
      s.marsBot.turnResolver.megacredits = 5;
      const other = rival();

      expectWins(s.game, s.placer, other, southPole);
    });

    it('does not count M€ in the Luna storage towards the cost', () => {
      s.marsBot.turnResolver.megacredits = 5;
      s.marsBot.shippingBoard.storage.set(ColonyName.LUNA, 3);
      const other = rival();

      expectWins(s.game, s.placer, other, southPole);
    });

    it('counts as a space without rewards when no ocean is left', () => {
      s.marsBot.turnResolver.megacredits = 20;
      for (const space of s.game.board.getAvailableSpacesForOcean(s.marsBot.player)) {
        s.game.simpleAddTile(s.marsBot.player, space, {tileType: TileType.OCEAN});
      }
      const other = rival();

      expectWins(s.game, s.placer, other, southPole);
    });

    it('never pays M€ for the ocean icon', () => {
      expect(s.placer.getPlacementBonusMC(southPole)).to.eq(0);
    });

    it('places an ocean, gains 1 TR and loses 6 M€ instead of gaining resources', () => {
      s.marsBot.turnResolver.megacredits = 10;
      const tr = s.marsBot.player.terraformRating;
      const oceans = s.game.board.getOceanSpaces().length;

      s.game.addCity(s.marsBot.player, southPole);

      const placed = s.game.board.getOceanSpaces();
      expect(placed).has.length(oceans + 1);
      expect(s.marsBot.player.terraformRating).to.eq(tr + 1);
      // 6 M€ lost. The ocean pays out like any other ocean MarsBot places, the city does not.
      expect(s.marsBot.turnResolver.megacredits).to.eq(4 + s.placer.getTotalPlacementMC(placed[placed.length - 1]));
    });

    it('does not charge M€ for an ocean its corporation swallows', () => {
      s.marsBot.setCorpAndSetup(getMarsBotCorp(CardName.PRISTAR)!);
      s.marsBot.setCorpState('whiteCubeOnCard', 1);
      s.marsBot.turnResolver.megacredits = 10;
      const tr = s.marsBot.player.terraformRating;

      s.game.addCity(s.marsBot.player, southPole);

      expect(s.game.board.getOceanSpaces()).has.length(0);
      // Pristar's own +6 M€ and +1 TR, and nothing paid for the hex
      expect(s.marsBot.turnResolver.megacredits).to.eq(16);
      expect(s.marsBot.player.terraformRating).to.eq(tr + 1);
    });

    it('does nothing when MarsBot cannot pay', () => {
      s.marsBot.turnResolver.megacredits = 5;
      const tr = s.marsBot.player.terraformRating;

      s.game.addCity(s.marsBot.player, southPole);

      expect(s.game.board.getOceanSpaces()).has.length(0);
      expect(s.marsBot.player.terraformRating).to.eq(tr);
      expect(s.marsBot.turnResolver.megacredits).to.eq(5);
    });
  });

  describe('MSL Curiosity (Terra Cimmeria)', () => {
    let s: Setup;
    let msl: Space;
    beforeEach(() => {
      s = setup(BoardName.TERRA_CIMMERIA_NOVA, {coloniesExtension: true});
      s.game.colonies = [new Luna(), new Ceres()];
      s.game.colonies.forEach((colony) => colony.isActive = true);
      msl = s.game.board.spaces.find((sp) => sp.bonus.includes(SpaceBonus.COLONY))!;
    });

    function rival(icons: number): Space {
      return plainSpaces(s.game).find((sp) => hasIcons(icons)(sp) && oceansNextTo(s.game, sp) === oceansNextTo(s.game, msl) &&
        s.game.board.getAdjacentSpaces(sp).every((a) => a.tile === undefined) && s.game.board.getAdjacentSpaces(msl).every((a) => a.tile === undefined))!;
    }

    function builtColonies(): number {
      return s.game.colonies.filter((colony) => colony.colonies.includes(s.marsBot.player.id)).length;
    }

    it('is available with no M€ and no colony left to build', () => {
      s.marsBot.turnResolver.megacredits = 0;
      s.game.colonies.forEach((colony) => colony.colonies.push(s.marsBot.player.id));

      expect(s.game.board.getAvailableSpacesOnLand(s.marsBot.player)).to.include(msl);
    });

    it('is preferred to a space with two icons, but not to one with three, when MarsBot has 5 M€', () => {
      s.marsBot.turnResolver.megacredits = 5;
      const two = rival(2);
      const three = rival(3);

      expectWins(s.game, s.placer, msl, two);
      expectWins(s.game, s.placer, three, msl);
    });

    it('counts as a space without rewards with 4 M€', () => {
      s.marsBot.turnResolver.megacredits = 4;

      expect(pick(s.placer, msl, rival(2))).to.eq(rival(2));
    });

    it('counts as a space without rewards when MarsBot has a colony on every tile', () => {
      s.marsBot.turnResolver.megacredits = 20;
      s.game.colonies.forEach((colony) => colony.colonies.push(s.marsBot.player.id));

      expect(pick(s.placer, msl, rival(2))).to.eq(rival(2));
    });

    it('never pays M€ for the colony icon', () => {
      expect(s.placer.getPlacementBonusMC(msl)).to.eq(0);
    });

    it('builds a colony and loses 5 M€ instead of gaining resources', () => {
      s.marsBot.turnResolver.megacredits = 7;

      s.game.addCity(s.marsBot.player, msl);

      expect(builtColonies()).to.eq(1);
      expect(s.marsBot.turnResolver.megacredits).to.eq(2);
    });

    it('does not charge M€ when the project deck has no card to pick the colony', () => {
      s.marsBot.turnResolver.megacredits = 7;
      s.game.projectDeck.drawN = () => [];

      s.game.addCity(s.marsBot.player, msl);

      expect(builtColonies()).to.eq(0);
      expect(s.marsBot.turnResolver.megacredits).to.eq(7);
    });

    it('does nothing when MarsBot cannot pay', () => {
      s.marsBot.turnResolver.megacredits = 4;

      s.game.addCity(s.marsBot.player, msl);

      expect(builtColonies()).to.eq(0);
      expect(s.marsBot.turnResolver.megacredits).to.eq(4);
    });

    it('is an ordinary space without Colonies', () => {
      const without = setup(BoardName.TERRA_CIMMERIA_NOVA);
      const spaces = without.game.board.spaces;
      expect(spaces.some((sp) => sp.bonus.includes(SpaceBonus.COLONY))).is.false;

      without.marsBot.turnResolver.megacredits = 10;
      without.game.addCity(without.marsBot.player, spaces.find((sp) => sp.id === msl.id)!);

      expect(without.marsBot.turnResolver.megacredits).to.eq(10);
    });
  });

  describe('North Pole (Vastitas Borealis)', () => {
    let s: Setup;
    let northPole: Space;
    beforeEach(() => {
      s = setup(BoardName.VASTITAS_BOREALIS_NOVA);
      northPole = s.game.board.spaces.find((sp) => sp.bonus.includes(SpaceBonus.TEMPERATURE_4MC))!;
    });

    function rival(): Space {
      return plainSpaces(s.game).find((sp) => hasIcons(2)(sp) && oceansNextTo(s.game, sp) === oceansNextTo(s.game, northPole) &&
        nextToVolcano(s.game, sp) === nextToVolcano(s.game, northPole))!;
    }

    it('is available even when MarsBot cannot pay for it', () => {
      s.marsBot.turnResolver.megacredits = 0;

      expect(s.game.board.getAvailableSpacesOnLand(s.marsBot.player)).to.include(northPole);
    });

    it('is preferred to a space with two icons when MarsBot has 4 M€', () => {
      s.marsBot.turnResolver.megacredits = 4;
      const other = rival();

      expectWins(s.game, s.placer, northPole, other);
    });

    it('counts as a space without rewards with 3 M€', () => {
      s.marsBot.turnResolver.megacredits = 3;
      const other = rival();

      expectWins(s.game, s.placer, other, northPole);
    });

    it('counts as a space without rewards once the temperature is maxed', () => {
      s.marsBot.turnResolver.megacredits = 20;
      setTemperature(s.game, s.game.max.temperature);
      const other = rival();

      expectWins(s.game, s.placer, other, northPole);
    });

    it('never pays M€ for the temperature icon', () => {
      expect(s.placer.getPlacementBonusMC(northPole)).to.eq(0);
    });

    it('raises the temperature, gains 1 TR and loses 4 M€ instead of gaining resources', () => {
      s.marsBot.turnResolver.megacredits = 6;
      const tr = s.marsBot.player.terraformRating;
      const temperature = s.game.getTemperature();

      s.game.addCity(s.marsBot.player, northPole);

      expect(s.game.getTemperature()).to.eq(temperature + 2);
      expect(s.marsBot.player.terraformRating).to.eq(tr + 1);
      expect(s.marsBot.turnResolver.megacredits).to.eq(2);
    });

    it('does not charge M€ for a temperature raise its corporation swallows', () => {
      s.marsBot.setCorpAndSetup(getMarsBotCorp(CardName.PRISTAR)!);
      s.marsBot.setCorpState('whiteCubeOnCard', 1);
      s.marsBot.turnResolver.megacredits = 6;
      const temperature = s.game.getTemperature();

      s.game.addCity(s.marsBot.player, northPole);

      expect(s.game.getTemperature()).to.eq(temperature);
      // Pristar's own +6 M€, and nothing paid for the hex
      expect(s.marsBot.turnResolver.megacredits).to.eq(12);
    });

    it('does nothing when MarsBot cannot pay', () => {
      s.marsBot.turnResolver.megacredits = 3;
      const temperature = s.game.getTemperature();

      s.game.addCity(s.marsBot.player, northPole);

      expect(s.game.getTemperature()).to.eq(temperature);
      expect(s.marsBot.turnResolver.megacredits).to.eq(3);
    });
  });

  describe('Viking 1 and 2 (Vastitas Borealis)', () => {
    function viking(game: IGame): Space {
      return game.board.spaces.find((sp) => sp.bonus.includes(SpaceBonus.DELEGATE))!;
    }

    it('is worth 1 M€ and a reward icon with Turmoil', () => {
      const s = setup(BoardName.VASTITAS_BOREALIS_NOVA, {turmoilExtension: true});
      const space = viking(s.game);
      const other = plainSpaces(s.game).find((sp) => hasIcons(0)(sp) && oceansNextTo(s.game, sp) === oceansNextTo(s.game, space) &&
        nextToVolcano(s.game, sp) === nextToVolcano(s.game, space))!;

      expect(s.placer.getPlacementBonusMC(space)).to.eq(1);
      expectWins(s.game, s.placer, space, other);
    });

    it('is available with Turmoil when MarsBot has no delegates left in reserve', () => {
      const s = setup(BoardName.VASTITAS_BOREALIS_NOVA, {turmoilExtension: true});
      const space = viking(s.game);
      const reserve = s.game.turmoil!.delegateReserve;
      while (reserve.count(s.marsBot.player) > 0) {
        reserve.remove(s.marsBot.player);
      }

      expect(s.game.board.getAvailableSpacesOnLand(s.marsBot.player)).to.include(space);
    });

    it('is empty without Turmoil', () => {
      const s = setup(BoardName.VASTITAS_BOREALIS_NOVA);
      const space = viking(s.game);

      expect(s.placer.getPlacementBonusMC(space)).to.eq(0);
      expect(s.game.board.getAvailableSpacesOnLand(s.marsBot.player)).to.include(space);

      s.marsBot.turnResolver.megacredits = 3;
      s.game.addCity(s.marsBot.player, space);
      expect(s.marsBot.turnResolver.megacredits).to.eq(3);
    });
  });
});
