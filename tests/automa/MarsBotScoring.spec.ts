import {expect} from 'chai';
import {SpaceType} from '@/common/boards/SpaceType';
import {TileType} from '@/common/TileType';
import {IMarsBot} from '@/server/automa/IMarsBot';
import {currentMcPerVP, MarsBotScoring} from '@/server/automa/MarsBotScoring';
import {Banker} from '@/server/awards/Banker';
import {Thermalist} from '@/server/awards/Thermalist';
import {Space} from '@/server/boards/Space';
import {Mayor} from '@/server/milestones/Mayor';
import {Terraformer} from '@/server/milestones/Terraformer';
import {Turmoil} from '@/server/turmoil/Turmoil';
import {testGame} from '../TestGame';
import {fakeMarsBot} from './FakeMarsBot';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {MarsBot} from '../../src/server/automa/MarsBot';
import {standaloneMarsBot} from './corps/CorpGame';
import {THARSIS_MARSBOT_BOARD} from '../../src/server/automa/boards/TharsisMarsBot';
import {ColonyName} from '../../src/common/colonies/ColonyName';

/** Builds a fake MarsBot on a 2-player game, scoring each award from `awardValues`. */
function setup(fields: Partial<IMarsBot> = {}, awardValues: Record<string, number> = {}) {
  const [game, human, botPlayer] = testGame(2, {turmoilExtension: true});
  const marsBot = fakeMarsBot({
    game,
    player: botPlayer,
    humanPlayer: human,
    megacredits: 0,
    neuralInstanceSpace: undefined,
    awardValue: (award) => awardValues[award.name] ?? 0,
    ...fields,
  });
  return {game, human, botPlayer, marsBot};
}

/** Finds an empty land space whose six neighbours are all empty land. */
function inlandSpace(marsBot: IMarsBot): Space {
  return marsBot.game.board.getAvailableSpacesOnLand(marsBot.player).find((space) => {
    const adjacent = marsBot.game.board.getAdjacentSpaces(space);
    return adjacent.length === 6 && adjacent.every((s) => s.spaceType === SpaceType.LAND && s.tile === undefined);
  })!;
}

describe('MarsBotScoring', () => {
  it("counts MarsBot's terraform rating", () => {
    const {botPlayer, marsBot} = setup();
    botPlayer.terraformRating = 25;

    expect(new MarsBotScoring(marsBot).calculate().terraformRating).eq(25);
  });

  it('scores 5 VP for each milestone MarsBot claimed', () => {
    const {game, human, botPlayer, marsBot} = setup();
    game.claimedMilestones.push(
      {player: botPlayer, milestone: new Terraformer()},
      {player: human, milestone: new Mayor()},
    );

    const vp = new MarsBotScoring(marsBot).calculate();

    const expectedDetails = [{message: 'Claimed ${0} milestone', messageArgs: ['Terraformer'], victoryPoint: 5}];
    expect(vp.milestones).eq(5);
    expect(vp.detailsMilestones).deep.eq(expectedDetails);
  });

  for (const run of [
    {awardValue: 2, expected: 0},
    {awardValue: 3, expected: 5},
    {awardValue: 4, expected: 5},
  ]) {
    it('scores 5 VP for each funded award MarsBot ties or leads: ' + JSON.stringify(run), () => {
      const {game, human, marsBot} = setup({}, {Thermalist: run.awardValue});
      human.heat = 3;
      game.fundedAwards.push({player: human, award: new Thermalist()});

      expect(new MarsBotScoring(marsBot).calculate().awards).eq(run.expected);
    });
  }

  it('lists the awards MarsBot scores', () => {
    const {game, human, marsBot} = setup({}, {Banker: 1});
    game.fundedAwards.push({player: human, award: new Banker()});

    const vp = new MarsBotScoring(marsBot).calculate();

    const expectedDetails = [{
      message: '${0} place for ${1} award (funded by ${2})',
      messageArgs: ['1st', 'Banker', human.name],
      victoryPoint: 5,
    }];
    expect(vp.detailsAwards).deep.eq(expectedDetails);
  });

  it("scores MarsBot's greeneries, and the greeneries next to its cities", () => {
    const {game, human, botPlayer, marsBot} = setup();
    const city = inlandSpace(marsBot);
    game.simpleAddTile(botPlayer, city, {tileType: TileType.CITY});
    const [first, second] = game.board.getAdjacentSpaces(city);
    game.simpleAddTile(botPlayer, first, {tileType: TileType.GREENERY});
    game.simpleAddTile(human, second, {tileType: TileType.GREENERY});

    const vp = new MarsBotScoring(marsBot).calculate();

    expect(vp.greenery).eq(1);
    expect(vp.cityAdjacentGreenery).eq(2);
  });

  it("scores 1 VP for each space next to the Neural Instance that the player doesn't hold", () => {
    const {game, human, botPlayer, marsBot: withoutTile} = setup();
    const space = inlandSpace(withoutTile);
    const marsBot = fakeMarsBot({...withoutTile, neuralInstanceSpace: space});
    const [first, second] = game.board.getAdjacentSpaces(space);
    game.simpleAddTile(human, first, {tileType: TileType.GREENERY});
    game.simpleAddTile(botPlayer, second, {tileType: TileType.GREENERY});

    expect(new MarsBotScoring(marsBot).calculate().neuralInstance).eq(5);
  });

  it('scores no Neural Instance VP before MarsBot places it', () => {
    const {marsBot} = setup();

    expect(new MarsBotScoring(marsBot).calculate().neuralInstance).eq(0);
  });

  for (const run of [
    {generation: 1, expected: 2},
    {generation: 19, expected: 17},
    {generation: 20, expected: 0},
  ]) {
    it("turns MarsBot's M€ into VP at the generation's rate: " + JSON.stringify(run), () => {
      const {game, marsBot} = setup({megacredits: 17});
      game.generation = run.generation;

      expect(new MarsBotScoring(marsBot).calculate().mcToVP).eq(run.expected);
    });
  }

  for (const run of [
    {generation: 12, preludeExtension: false, expected: 8},
    {generation: 13, preludeExtension: false, expected: 7},
    {generation: 19, preludeExtension: false, expected: 1},
    {generation: 20, preludeExtension: false, expected: undefined},
    {generation: 10, preludeExtension: true, expected: 8},
    {generation: 11, preludeExtension: true, expected: 7},
    {generation: 17, preludeExtension: true, expected: 1},
    {generation: 18, preludeExtension: true, expected: undefined},
  ]) {
    it('reads the M€ per VP table: ' + JSON.stringify(run), () => {
      const [game] = testGame(2, {preludeExtension: run.preludeExtension});
      game.generation = run.generation;

      expect(currentMcPerVP(game)).eq(run.expected);
    });
  }

  for (const run of [
    {verminInEffect: false, expected: 0},
    {verminInEffect: true, expected: -1},
  ]) {
    it("takes 1 VP for each of MarsBot's cities with Vermin in effect: " + JSON.stringify(run), () => {
      const {game, botPlayer, marsBot} = setup();
      game.simpleAddTile(botPlayer, inlandSpace(marsBot), {tileType: TileType.CITY});
      game.verminInEffect = run.verminInEffect;

      expect(new MarsBotScoring(marsBot).calculate().vermin).eq(run.expected);
    });
  }

  it('scores 1 VP for the chairman and each party leader MarsBot holds', () => {
    const {game, botPlayer, marsBot} = setup();
    const turmoil = Turmoil.getTurmoil(game);
    turmoil.chairman = botPlayer;
    turmoil.parties[0].partyLeader = botPlayer;
    turmoil.parties[1].partyLeader = botPlayer;

    expect(new MarsBotScoring(marsBot).calculate().turmoilVP).eq(3);
  });

  it('scores no Turmoil VP without Turmoil', () => {
    const [game, human, botPlayer] = testGame(2);
    const marsBot = fakeMarsBot({
      game, player: botPlayer, humanPlayer: human, megacredits: 0, neuralInstanceSpace: undefined,
    });

    expect(new MarsBotScoring(marsBot).calculate().turmoilVP).eq(0);
  });

  it('adds up every part, with the corp VP', () => {
    const {game, human, botPlayer, marsBot} = setup({megacredits: 16, corpVictoryPoints: () => 4});
    game.claimedMilestones.push({player: botPlayer, milestone: new Terraformer()});
    Turmoil.getTurmoil(game).chairman = botPlayer;
    game.fundedAwards.push({player: human, award: new Banker()});

    const vp = new MarsBotScoring(marsBot).calculate();

    expect(vp.corpVP).eq(4);
    expect(vp.total).eq(20 + 5 + 5 + 2 + 1 + 4);
  });

  let game: IGame;
  let human: TestPlayer;
  let botPlayer: TestPlayer;
  let marsBot: MarsBot;

  beforeEach(() => {
    [game, human] = testGame(1);
    botPlayer = TestPlayer.RED.newPlayer({name: 'marsbot'});
    botPlayer.game = game;
    marsBot = standaloneMarsBot(game, botPlayer, human, THARSIS_MARSBOT_BOARD);
  });

  function makeScoring(neuralInstanceSpace?: Space) {
    marsBot.neuralInstanceSpace = neuralInstanceSpace;
    return new MarsBotScoring(marsBot);
  }

  describe('Terraform Rating', () => {
    it('includes terraform rating in VP', () => {
      botPlayer.setTerraformRating(25);
      const vp = makeScoring().calculate();
      expect(vp.terraformRating).to.eq(25);
    });

    it('default TR of 20', () => {
      const vp = makeScoring().calculate();
      expect(vp.terraformRating).to.eq(20);
    });
  });

  describe('Milestones', () => {
    it('counts milestones at 5 VP each', () => {
      game.claimedMilestones.push({player: botPlayer, milestone: game.milestones[0]});
      game.claimedMilestones.push({player: botPlayer, milestone: game.milestones[1]});
      const vp = makeScoring().calculate();
      expect(vp.milestones).to.eq(10);
    });

    it('does not count milestones claimed by human', () => {
      game.claimedMilestones.push({player: human, milestone: game.milestones[0]});
      const vp = makeScoring().calculate();
      expect(vp.milestones).to.eq(0);
    });

    it('counts 0 when no milestones claimed', () => {
      const vp = makeScoring().calculate();
      expect(vp.milestones).to.eq(0);
    });

    it('counts 3 milestones at 15 VP', () => {
      for (let i = 0; i < 3; i++) {
        game.claimedMilestones.push({player: botPlayer, milestone: game.milestones[i]});
      }
      const vp = makeScoring().calculate();
      expect(vp.milestones).to.eq(15);
    });
  });

  describe('Greenery VP', () => {
    it('counts greenery VP', () => {
      const spaces = game.board.getAvailableSpacesOnLand(botPlayer);
      game.simpleAddTile(botPlayer, spaces[5], {tileType: TileType.GREENERY});
      game.simpleAddTile(botPlayer, spaces[10], {tileType: TileType.GREENERY});
      game.simpleAddTile(botPlayer, spaces[15], {tileType: TileType.GREENERY});
      const vp = makeScoring().calculate();
      expect(vp.greenery).to.eq(3);
    });

    it('does not count human greenery', () => {
      const spaces = game.board.getAvailableSpacesOnLand(human);
      game.simpleAddTile(human, spaces[5], {tileType: TileType.GREENERY});
      const vp = makeScoring().calculate();
      expect(vp.greenery).to.eq(0);
    });
  });

  describe('City adjacent greenery VP', () => {
    it('counts adjacent greenery for MarsBot cities', () => {
      const spaces = game.board.getAvailableSpacesOnLand(botPlayer);
      const citySpace = spaces[15];
      game.simpleAddTile(botPlayer, citySpace, {tileType: TileType.CITY});
      const adj = game.board.getAdjacentSpaces(citySpace);
      let placed = 0;
      for (const s of adj) {
        if (s.tile === undefined && placed < 2) {
          game.simpleAddTile(botPlayer, s, {tileType: TileType.GREENERY});
          placed++;
        }
      }
      expect(placed).to.be.gte(1);
      const vp = makeScoring().calculate();
      const actualAdj = game.board.getAdjacentSpaces(citySpace).filter((s) => s.tile?.tileType === TileType.GREENERY).length;
      expect(vp.cityAdjacentGreenery).to.eq(actualAdj);
    });

    it('counts greenery from any player adjacent to MarsBot cities', () => {
      const spaces = game.board.getAvailableSpacesOnLand(botPlayer);
      const citySpace = spaces[15];
      game.simpleAddTile(botPlayer, citySpace, {tileType: TileType.CITY});
      const adj = game.board.getAdjacentSpaces(citySpace).filter((s) => s.tile === undefined);
      if (adj.length > 0) {
        game.simpleAddTile(human, adj[0], {tileType: TileType.GREENERY});
      }
      const vp = makeScoring().calculate();
      expect(vp.cityAdjacentGreenery).to.be.gte(1);
    });

    it('does not count adjacency for human cities', () => {
      const spaces = game.board.getAvailableSpacesOnLand(human);
      game.simpleAddTile(human, spaces[15], {tileType: TileType.CITY});
      const adj = game.board.getAdjacentSpaces(spaces[15]).filter((s) => s.tile === undefined);
      if (adj.length > 0) {
        game.simpleAddTile(botPlayer, adj[0], {tileType: TileType.GREENERY});
      }
      const vp = makeScoring().calculate();
      expect(vp.cityAdjacentGreenery).to.eq(0); // MarsBot has no cities
    });
  });

  describe('MC to VP conversion', () => {
    it('gen ≤12: 1 VP per 8 MC', () => {
      game.generation = 12;
      marsBot.megacredits = 24;
      expect(makeScoring().calculate().mcToVP).to.eq(3);
    });

    it('gen 13: 1 VP per 7 MC', () => {
      game.generation = 13;
      marsBot.megacredits = 21;
      expect(makeScoring().calculate().mcToVP).to.eq(3);
    });

    it('gen 14: 1 VP per 6 MC', () => {
      game.generation = 14;
      marsBot.megacredits = 13;
      expect(makeScoring().calculate().mcToVP).to.eq(2);
    });

    it('gen 15: 1 VP per 5 MC', () => {
      game.generation = 15;
      marsBot.megacredits = 23;
      expect(makeScoring().calculate().mcToVP).to.eq(4);
    });

    it('gen 16: 1 VP per 4 MC', () => {
      game.generation = 16;
      marsBot.megacredits = 9;
      expect(makeScoring().calculate().mcToVP).to.eq(2);
    });

    it('gen 17: 1 VP per 3 MC', () => {
      game.generation = 17;
      marsBot.megacredits = 10;
      expect(makeScoring().calculate().mcToVP).to.eq(3);
    });

    it('gen 18: 1 VP per 2 MC', () => {
      game.generation = 18;
      marsBot.megacredits = 7;
      expect(makeScoring().calculate().mcToVP).to.eq(3);
    });

    it('gen 19: 1 VP per 1 MC', () => {
      game.generation = 19;
      marsBot.megacredits = 7;
      expect(makeScoring().calculate().mcToVP).to.eq(7);
    });

    it('gen 20 (instant win): 0 MC VP', () => {
      game.generation = 20;
      marsBot.megacredits = 100;
      expect(makeScoring().calculate().mcToVP).to.eq(0);
    });

    it('fractional points rounded down', () => {
      game.generation = 14; // 1 per 6 MC
      marsBot.megacredits = 17;
      expect(makeScoring().calculate().mcToVP).to.eq(2); // floor(17/6) = 2
    });

    it('0 MC gives 0 VP', () => {
      game.generation = 14;
      marsBot.megacredits = 0;
      expect(makeScoring().calculate().mcToVP).to.eq(0);
    });
  });

  describe('Neural Instance', () => {
    it('0 VP when not placed', () => {
      expect(makeScoring(undefined).calculate().neuralInstance).to.eq(0);
    });

    it('counts adjacent spaces not occupied by human', () => {
      const spaces = game.board.getAvailableSpacesOnLand(botPlayer);
      const niSpace = spaces[15]; // Pick a non-edge space
      const adj = game.board.getAdjacentSpaces(niSpace);

      const humanAdj = adj.find((s) => s.tile === undefined && s.spaceType === SpaceType.LAND);
      if (humanAdj) {
        game.simpleAddTile(human, humanAdj, {tileType: TileType.CITY});
      }

      const vp = makeScoring(niSpace).calculate();
      const adjCount = game.board.getAdjacentSpaces(niSpace).length;
      const humanAdjCount = humanAdj ? 1 : 0;
      expect(vp.neuralInstance).to.eq(adjCount - humanAdjCount);
    });
  });

  // TDaver, BGG 3408751 and 3373832: the resources MarsBot has left on the Colonies shipping board,
  // and its floaters on the Venus board, score half a VP each, rounded down
  describe('Leftover resources VP (automaColonyVP)', () => {
    function leftoverGame(options: {automaColonyVP?: boolean, coloniesExtension?: boolean, venusNextExtension?: boolean} = {}) {
      const [game] = testGame(1, {automa: true, coloniesExtension: true, ...options});
      return {game, marsBot: game.automaHooks!.marsBot};
    }

    for (const run of [
      {cubes: 0, expected: 0},
      {cubes: 1, expected: 0},
      {cubes: 2, expected: 1},
      {cubes: 3, expected: 1},
      {cubes: 7, expected: 3},
    ] as const) {
      it('scores 1 VP for every 2 resources left on the shipping board, rounded down: ' + JSON.stringify(run), () => {
        const {marsBot} = leftoverGame({automaColonyVP: true});
        marsBot.shippingBoard.storage.set(ColonyName.CERES, Math.min(run.cubes, 4));
        marsBot.shippingBoard.storage.set(ColonyName.LUNA, Math.max(0, run.cubes - 4));
        const vp = marsBot.getVictoryPoints();
        expect(vp.leftoverResourcesVP, `${run.cubes} resources`).to.eq(run.expected);
      });
    }

    it('counts the floaters on the Venus board too', () => {
      const {marsBot} = leftoverGame({automaColonyVP: true, venusNextExtension: true});
      marsBot.shippingBoard.storage.set(ColonyName.CERES, 2);
      marsBot.floaters = 3;
      expect(marsBot.getVictoryPoints().leftoverResourcesVP).to.eq(2);
    });

    it("does not score MarsBot's colonies", () => {
      const {game, marsBot} = leftoverGame({automaColonyVP: true});
      for (let i = 0; i < 4; i++) {
        game.colonies[i].colonies.push(marsBot.player.id);
      }
      expect(marsBot.getVictoryPoints().leftoverResourcesVP).to.eq(0);
    });

    it('adds to the total', () => {
      const without = leftoverGame();
      const withOption = leftoverGame({automaColonyVP: true});
      for (const {marsBot} of [without, withOption]) {
        marsBot.shippingBoard.storage.set(ColonyName.CERES, 4);
      }
      const totalWithout = without.marsBot.getVictoryPoints().total;
      const totalWith = withOption.marsBot.getVictoryPoints().total;
      expect(totalWith).to.eq(totalWithout + 2);
    });

    it('is off by default', () => {
      const {marsBot} = leftoverGame();
      marsBot.shippingBoard.storage.set(ColonyName.CERES, 4);
      expect(marsBot.getVictoryPoints().leftoverResourcesVP).to.eq(0);
    });

    it('scores nothing without Colonies', () => {
      const {marsBot} = leftoverGame({automaColonyVP: true, coloniesExtension: false, venusNextExtension: true});
      marsBot.floaters = 4;
      expect(marsBot.getVictoryPoints().leftoverResourcesVP).to.eq(0);
    });
  });

  describe('Total VP', () => {
    it('combines all VP sources', () => {
      botPlayer.setTerraformRating(25);
      marsBot.megacredits = 16;
      game.generation = 12; // 1 VP per 8 MC

      const spaces = game.board.getAvailableSpacesOnLand(botPlayer);
      game.simpleAddTile(botPlayer, spaces[10], {tileType: TileType.GREENERY});

      const vp = makeScoring().calculate();
      expect(vp.terraformRating).to.eq(25);
      expect(vp.greenery).to.eq(1);
      expect(vp.mcToVP).to.eq(2); // 16/8
      expect(vp.total).to.eq(25 + 1 + 2);
    });
  });
});
