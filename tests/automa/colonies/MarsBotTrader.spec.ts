import {expect} from 'chai';
import {BonusCardName} from '@/common/automa/BonusCardName';
import {ColonyName} from '@/common/colonies/ColonyName';
import {MarsBotShippingBoard} from '@/server/automa/colonies/MarsBotShippingBoard';
import {maybeTrade, selectTradeColony, tradeWithColony} from '@/server/automa/colonies/MarsBotTrader';
import {ColonyDeserializer} from '@/server/colonies/ColonyDeserializer';
import {Luna} from '@/server/colonies/Luna';
import {fakeCard, runAllActions} from '../../TestingUtils';
import {testGame} from '../../TestGame';
import {fakeMarsBot} from '../FakeMarsBot';
import {recordingMarsBot} from '../corps/RecordingMarsBot';
import {AutomaGameHooks} from '../../../src/server/automa/AutomaGameHooks';
import {MarsBot} from '../../../src/server/automa/MarsBot';
import {COLONY_STORAGE_TAG} from '../../../src/server/automa/colonies/MarsBotShippingBoard';
import {Europa} from '../../../src/server/colonies/Europa';
import {Ceres} from '../../../src/server/colonies/Ceres';
import {Titan} from '../../../src/server/colonies/Titan';
import {Pluto} from '../../../src/server/colonies/Pluto';
import {Tag} from '../../../src/common/cards/Tag';
import {BoardName} from '../../../src/common/boards/BoardName';

function setup(options: {megacredits?: number} = {}) {
  const [game, human, botPlayer] = testGame(2, {expansions: {colonies: true}});
  const {marsBot, calls} = recordingMarsBot({
    game,
    player: botPlayer,
    humanPlayer: human,
    megacredits: options.megacredits ?? 5,
    shippingBoard: new MarsBotShippingBoard(fakeMarsBot({game})),
  });
  return {game, human, botPlayer, marsBot, calls};
}

function getMarsBot(game: ReturnType<typeof testGame>[0]): MarsBot {
  return (game.automaHooks as AutomaGameHooks).marsBot;
}

describe('MarsBotTrader', () => {
  // The revealed card's cost picks among the tied tiles: (cost - 1) % 2, so cost 2 picks the second
  for (const run of [
    {
      tiles: [{colonyName: ColonyName.LUNA, track: 5, botColony: false}, {colonyName: ColonyName.CERES, track: 3, botColony: false}],
      expected: ColonyName.LUNA,
    },
    {
      tiles: [{colonyName: ColonyName.LUNA, track: 4, botColony: true}, {colonyName: ColonyName.CERES, track: 4, botColony: false}],
      expected: ColonyName.LUNA,
    },
    {
      tiles: [{colonyName: ColonyName.LUNA, track: 4, botColony: false}, {colonyName: ColonyName.CERES, track: 4, botColony: false}],
      expected: ColonyName.CERES,
    },
  ] as const) {
    it('trades with the tile furthest along its track, then with its colony, then by a revealed card: ' + JSON.stringify(run), () => {
      const {game, botPlayer, marsBot} = setup();
      game.colonies = run.tiles.map((tile) => {
        const colony = ColonyDeserializer.deserialize(tile.colonyName)!;
        colony.trackPosition = tile.track;
        colony.colonies = tile.botColony ? [botPlayer.id] : [];
        return colony;
      });
      game.projectDeck.drawPile.push(fakeCard({cost: 2}));

      expect(selectTradeColony(marsBot)?.name).eq(run.expected);
    });
  }

  for (const run of [
    {colonyName: ColonyName.LUNA, botColony: false, expected: {stored: 2, tr: 0, calls: ['loseMc(1)']}},
    {colonyName: ColonyName.LUNA, botColony: true, expected: {stored: 3, tr: 0, calls: ['loseMc(1)']}},
    {colonyName: ColonyName.EUROPA, botColony: false, expected: {stored: 0, tr: 1, calls: ['loseMc(1)']}},
    {
      colonyName: ColonyName.TITAN,
      botColony: false,
      expected: {stored: 0, tr: 0, calls: ['loseMc(1)', 'addFloaters(2)']},
    },
  ] as const) {
    it("pays 1 M€ and takes MarsBot's reward instead of the track's income: " + JSON.stringify(run), () => {
      const {botPlayer, marsBot, calls} = setup();
      const colony = ColonyDeserializer.deserialize(run.colonyName)!;
      colony.colonies = run.botColony ? [botPlayer.id] : [];
      const tr = botPlayer.terraformRating;

      tradeWithColony(marsBot, colony);

      expect(marsBot.shippingBoard.get(run.colonyName)).eq(run.expected.stored);
      expect(botPlayer.terraformRating - tr).eq(run.expected.tr);
      expect(calls).deep.eq(run.expected.calls);
      expect(colony.visitor).eq(botPlayer.id);
    });
  }

  it("pays the player's colony bonus and moves the track back", () => {
    const {game, human, marsBot} = setup();
    const luna = new Luna();
    luna.colonies = [human.id];
    luna.trackPosition = 5;

    tradeWithColony(marsBot, luna);
    runAllActions(game);

    expect(human.megaCredits).eq(2);
    expect(luna.trackPosition).eq(1);
  });

  for (const run of [
    {megacredits: 1, visited: false, expected: true},
    {megacredits: 0, visited: false, expected: false},
    {megacredits: 1, visited: true, expected: false},
  ] as const) {
    it('trades only with a tile to trade with and 1 M€ to pay: ' + JSON.stringify(run), () => {
      const {game, human, marsBot, calls} = setup({megacredits: run.megacredits});
      const luna = new Luna();
      luna.visitor = run.visited ? human.id : undefined;
      game.colonies = [luna];

      maybeTrade(marsBot, BonusCardName.SHIPPING_LINES);

      expect(calls.includes('loseMc(1)')).eq(run.expected);
    });
  }

  describe('selectTradeColony', () => {
    it('returns undefined when no tradeable colonies', () => {
      const [game] = testGame(1, {automa: true, expansions: {colonies: true}, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      game.colonies = [];
      expect(selectTradeColony(marsBot)).to.be.undefined;
    });

    it('returns undefined when all colonies already visited (rulebook C, p.5)', () => {
      const [game] = testGame(1, {automa: true, expansions: {colonies: true}, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const luna = new Luna();
      luna.visitor = 'psome-player';
      game.colonies = [luna];
      expect(selectTradeColony(marsBot)).to.be.undefined;
    });

    it('selects the colony with the highest track position (rulebook C, p.5)', () => {
      const [game] = testGame(1, {automa: true, expansions: {colonies: true}, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const luna = new Luna();
      luna.trackPosition = 3;
      const ceres = new Ceres();
      ceres.trackPosition = 5;
      game.colonies = [luna, ceres];
      expect(selectTradeColony(marsBot)!.name).to.eq(ColonyName.CERES);
    });

    it('tiebreaks by preferring a colony where MarsBot has a presence (rulebook C, p.5)', () => {
      const [game] = testGame(1, {automa: true, expansions: {colonies: true}, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const luna = new Luna();
      luna.trackPosition = 4;
      const ceres = new Ceres();
      ceres.trackPosition = 4;
      ceres.colonies = [marsBot.player.id];
      game.colonies = [luna, ceres];
      expect(selectTradeColony(marsBot)!.name).to.eq(ColonyName.CERES);
    });

    it('uses random tiebreak when still tied after track position and colony presence (rulebook C, p.5)', () => {
      const [game] = testGame(1, {automa: true, expansions: {colonies: true}, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const luna = new Luna();
      luna.trackPosition = 4;
      const ceres = new Ceres();
      ceres.trackPosition = 4;
      game.colonies = [luna, ceres];

      expect(game.projectDeck.drawPile.length).to.be.greaterThan(0);
      const discardBefore = game.projectDeck.discardPile.length;
      const result = selectTradeColony(marsBot);
      // Should have revealed one card (random tiebreak)
      expect(game.projectDeck.discardPile.length).to.eq(discardBefore + 1);
      expect(result).to.not.be.undefined;
    });

    it('excludes inactive colonies', () => {
      const [game] = testGame(1, {automa: true, expansions: {colonies: true}, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const luna = new Luna();
      luna.isActive = false;
      game.colonies = [luna];
      expect(selectTradeColony(marsBot)).to.be.undefined;
    });
  });

  describe('tradeWithColony', () => {
    it('deducts 1 MC from marsBot (rulebook C, p.5)', () => {
      const [game] = testGame(1, {automa: true, expansions: {colonies: true}, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const luna = new Luna();
      game.colonies = [luna];
      const mcBefore = marsBot.megacredits;
      tradeWithColony(marsBot, luna);
      expect(marsBot.megacredits).to.eq(Math.max(0, mcBefore - 1));
    });

    it('marks colony.visitor with MarsBot player id (rulebook C, p.5)', () => {
      const [game] = testGame(1, {automa: true, expansions: {colonies: true}, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const luna = new Luna();
      game.colonies = [luna];
      tradeWithColony(marsBot, luna);
      expect(luna.visitor).to.eq(marsBot.player.id);
    });

    it('gains 2 resources to shipping board (rulebook C, p.5)', () => {
      const [game] = testGame(1, {automa: true, expansions: {colonies: true}, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const luna = new Luna();
      game.colonies = [luna];
      const storeBefore = marsBot.shippingBoard.get(ColonyName.LUNA);
      tradeWithColony(marsBot, luna);
      expect(marsBot.shippingBoard.get(ColonyName.LUNA)).to.eq(storeBefore + 2);
    });

    it('gains 3 resources when MarsBot has a colony there (rulebook C, p.5)', () => {
      const [game] = testGame(1, {automa: true, expansions: {colonies: true}, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const luna = new Luna();
      luna.colonies = [marsBot.player.id];
      game.colonies = [luna];
      const storeBefore = marsBot.shippingBoard.get(ColonyName.LUNA);
      tradeWithColony(marsBot, luna);
      expect(marsBot.shippingBoard.get(ColonyName.LUNA)).to.eq(storeBefore + 3);
    });

    it('resets track position to colonies.length after trade', () => {
      const [game] = testGame(1, {automa: true, expansions: {colonies: true}, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const luna = new Luna();
      luna.trackPosition = 5;
      luna.colonies = ['player1'];
      game.colonies = [luna];
      tradeWithColony(marsBot, luna);
      expect(luna.trackPosition).to.eq(luna.colonies.length);
    });

    describe('Europa special case (rulebook C, p.5)', () => {
      it('raises TR 1 step instead of resources', () => {
        const [game] = testGame(1, {automa: true, expansions: {colonies: true}, boardName: BoardName.THARSIS});
        const marsBot = getMarsBot(game);
        const europa = new Europa();
        game.colonies = [europa];
        const trBefore = marsBot.player.terraformRating;
        tradeWithColony(marsBot, europa);
        expect(marsBot.player.terraformRating).to.eq(trBefore + 1);
      });

      it('does not add resources to Europa storage (rulebook C, p.5)', () => {
        const [game] = testGame(1, {automa: true, expansions: {colonies: true}, boardName: BoardName.THARSIS});
        const marsBot = getMarsBot(game);
        const europa = new Europa();
        game.colonies = [europa];
        tradeWithColony(marsBot, europa);
        expect(marsBot.shippingBoard.get(ColonyName.EUROPA)).to.eq(0);
      });
    });

    describe('human colony bonus (rulebook C, p.5)', () => {
      it('gives colony bonus to human player when they have a colony on the tile', () => {
        const [game, player] = testGame(1, {automa: true, expansions: {colonies: true}, boardName: BoardName.THARSIS});
        const marsBot = getMarsBot(game);
        const ceres = new Ceres();
        ceres.colonies = [player.id];
        game.colonies = [ceres];
        const steelBefore = player.steel;
        tradeWithColony(marsBot, ceres);
        // Ceres colony bonus = 1 steel
        expect(player.steel).to.be.greaterThan(steelBefore);
      });

      it('does not give MarsBot the printed colony bonus (skip self)', () => {
        const [game] = testGame(1, {automa: true, expansions: {colonies: true}, boardName: BoardName.THARSIS});
        const marsBot = getMarsBot(game);
        const luna = new Luna();
        luna.colonies = [marsBot.player.id];
        game.colonies = [luna];
        // MarsBot gets the 3 resources on its shipping board and no printed Luna bonus.
        const storeBefore = marsBot.shippingBoard.get(ColonyName.LUNA);
        tradeWithColony(marsBot, luna);
        expect(marsBot.shippingBoard.get(ColonyName.LUNA)).to.eq(storeBefore + 3);
      });
    });

    it('Titan without Venus: adds resources to Titan storage (rulebook C, p.5)', () => {
      const [game] = testGame(1, {automa: true, expansions: {colonies: true}, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const titan = new Titan();
      game.colonies = [titan];
      const storeBefore = marsBot.shippingBoard.get(ColonyName.TITAN);
      tradeWithColony(marsBot, titan);
      expect(marsBot.shippingBoard.get(ColonyName.TITAN)).to.eq(storeBefore + 2);
    });

    it('Titan with Venus Next: adds floaters instead of Titan storage (rulebook C, p.5)', () => {
      const [game] = testGame(1, {
        automa: true,
        expansions: {colonies: true, venus: true},
        boardName: BoardName.THARSIS,
      });
      const marsBot = getMarsBot(game);
      const titan = new Titan();
      game.colonies = [titan];
      const floatersBefore = marsBot.floaters;
      const titanStoreBefore = marsBot.shippingBoard.get(ColonyName.TITAN);
      tradeWithColony(marsBot, titan);
      expect(marsBot.floaters).to.eq(floatersBefore + 2);
      expect(marsBot.shippingBoard.get(ColonyName.TITAN)).to.eq(titanStoreBefore);
    });

    describe('Pluto special case (rulebook C, p.5)', () => {
      it('adds 2 resources to Pluto storage (MC-equivalent) instead of drawing cards', () => {
        const [game] = testGame(1, {automa: true, expansions: {colonies: true}, boardName: BoardName.THARSIS});
        const marsBot = getMarsBot(game);
        const pluto = new Pluto();
        game.colonies = [pluto];
        const storeBefore = marsBot.shippingBoard.get(ColonyName.PLUTO);
        tradeWithColony(marsBot, pluto);
        expect(marsBot.shippingBoard.get(ColonyName.PLUTO)).to.eq(storeBefore + 2);
      });

      it('Pluto storage maps to the Science track via COLONY_STORAGE_TAG (rulebook C, p.5)', () => {
        expect(COLONY_STORAGE_TAG[ColonyName.PLUTO]).to.eq(Tag.SCIENCE);
      });

      it('Pluto overflow advances Science track (rulebook C, p.4-5)', () => {
        const [game] = testGame(1, {automa: true, expansions: {colonies: true}, boardName: BoardName.THARSIS});
        const marsBot = getMarsBot(game);
        const pluto = new Pluto();
        game.colonies = [pluto];
        const scienceTrackIdx = marsBot.marsBotBoard.tagToTrack[Tag.SCIENCE]!;
        const before = marsBot.marsBotBoard.tracks[scienceTrackIdx].position;
        // Add 5 to Pluto → overflow → advance Science track
        marsBot.shippingBoard.add(ColonyName.PLUTO, 5);
        expect(marsBot.marsBotBoard.tracks[scienceTrackIdx].position).to.be.greaterThan(before);
        expect(marsBot.shippingBoard.get(ColonyName.PLUTO)).to.eq(0);
      });
    });
  });
});
