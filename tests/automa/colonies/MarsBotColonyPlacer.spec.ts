import {expect} from 'chai';
import {ColonyName} from '@/common/colonies/ColonyName';
import {MarsBotShippingBoard} from '@/server/automa/colonies/MarsBotShippingBoard';
import {eligibleColoniesForMarsBot, placeColonyForMarsBot} from '@/server/automa/colonies/MarsBotColonyPlacer';
import {Poseidon} from '@/server/cards/colonies/Poseidon';
import {ColonyDeserializer} from '@/server/colonies/ColonyDeserializer';
import {Luna} from '@/server/colonies/Luna';
import {testGame} from '../../TestGame';
import {fakeMarsBot} from '../FakeMarsBot';
import {recordingMarsBot} from '../corps/RecordingMarsBot';
import {fakeCard} from '../../TestingUtils';
import {AutomaGameHooks} from '../../../src/server/automa/AutomaGameHooks';
import {MarsBot} from '../../../src/server/automa/MarsBot';
import {selectRandomColony} from '../../../src/server/automa/colonies/MarsBotColonyPlacer';
import {Europa} from '../../../src/server/colonies/Europa';
import {Titan} from '../../../src/server/colonies/Titan';
import {Ceres} from '../../../src/server/colonies/Ceres';
import {BoardName} from '../../../src/common/boards/BoardName';
import {Tag} from '../../../src/common/cards/Tag';

function setup() {
  const [game, human, botPlayer] = testGame(2, {coloniesExtension: true});
  const notices: Array<string> = [];
  const {marsBot, calls} = recordingMarsBot({
    game,
    player: botPlayer,
    humanPlayer: human,
    shippingBoard: new MarsBotShippingBoard(fakeMarsBot({game})),
    notifyColonyPlaced: () => notices.push('notifyColonyPlaced()'),
  });
  return {game, human, botPlayer, marsBot, calls, notices};
}

function getMarsBot(game: ReturnType<typeof testGame>[0]): MarsBot {
  return (game.automaHooks as AutomaGameHooks).marsBot;
}

describe('MarsBotColonyPlacer', () => {
  for (const run of [
    {isActive: true, colonies: [], expected: true},
    {isActive: false, colonies: [], expected: false},
    {isActive: true, colonies: ['human', 'human', 'human'], expected: false},
    {isActive: true, colonies: ['bot'], expected: false},
  ] as const) {
    it('lists the tiles MarsBot can build on: ' + JSON.stringify(run), () => {
      const {game, human, botPlayer, marsBot} = setup();
      const luna = new Luna();
      luna.isActive = run.isActive;
      luna.colonies = run.colonies.map((owner) => owner === 'bot' ? botPlayer.id : human.id);
      game.colonies = [luna];

      expect(eligibleColoniesForMarsBot(marsBot)).deep.eq(run.expected ? [luna] : []);
    });
  }

  for (const run of [
    {colonyName: ColonyName.LUNA, expected: {stored: 2, calls: []}},
    {colonyName: ColonyName.EUROPA, expected: {stored: 0, calls: ['placeOcean()']}},
    {colonyName: ColonyName.TITAN, expected: {stored: 0, calls: ['addFloaters(2)']}},
  ] as const) {
    it("builds a colony and takes MarsBot's reward instead of the tile's: " + JSON.stringify(run), () => {
      const {botPlayer, marsBot, calls} = setup();
      const colony = ColonyDeserializer.deserialize(run.colonyName)!;

      placeColonyForMarsBot(colony, marsBot);

      expect(colony.colonies).deep.eq([botPlayer.id]);
      expect(marsBot.shippingBoard.get(run.colonyName)).eq(run.expected.stored);
      expect(calls).deep.eq(run.expected.calls);
    });
  }

  it("moves the colony track up and tells MarsBot's corp and the player's cards", () => {
    const {human, marsBot, notices} = setup();
    human.playedCards.push(new Poseidon());
    const luna = new Luna();
    luna.colonies = [human.id];

    placeColonyForMarsBot(luna, marsBot);

    expect(luna.trackPosition).eq(2);
    expect(notices).deep.eq(['notifyColonyPlaced()']);
    expect(human.production.megacredits).eq(1);
  });

  describe('eligibleColoniesForMarsBot', () => {
    it('excludes inactive colonies', () => {
      const [game] = testGame(1, {automa: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const luna = new Luna();
      luna.isActive = false;
      game.colonies = [luna];
      const eligible = eligibleColoniesForMarsBot(marsBot);
      expect(eligible.length).to.eq(0);
    });

    it('excludes full colonies', () => {
      const [game] = testGame(1, {automa: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const luna = new Luna();
      luna.colonies = ['p1', 'p2', 'p3']; // MAX_COLONIES_PER_TILE = 3
      game.colonies = [luna];
      const eligible = eligibleColoniesForMarsBot(marsBot);
      expect(eligible.length).to.eq(0);
    });

    it('excludes colonies where MarsBot already has one', () => {
      const [game] = testGame(1, {automa: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const luna = new Luna();
      luna.colonies = [marsBot.player.id];
      game.colonies = [luna];
      const eligible = eligibleColoniesForMarsBot(marsBot);
      expect(eligible.length).to.eq(0);
    });

    it('includes active, non-full colonies without MarsBot', () => {
      const [game] = testGame(1, {automa: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const luna = new Luna();
      game.colonies = [luna];
      const eligible = eligibleColoniesForMarsBot(marsBot);
      expect(eligible.length).to.eq(1);
    });
  });

  describe('selectRandomColony (C-15b method)', () => {
    it('uses card cost to index into eligible colonies', () => {
      const [game] = testGame(1, {automa: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const luna = new Luna();
      const ceres = new Ceres();
      game.colonies = [luna, ceres];

      // Draw a project card with known cost from the test deck
      const drawnCard = game.projectDeck.drawN(game, 1)[0];
      // Put it back so selectRandomColony can draw it
      game.projectDeck.drawPile.push(drawnCard);

      const colony = selectRandomColony(marsBot);
      expect(colony).to.not.be.undefined;
      // Index = (cost - 1) % 2
      const expectedIndex = (drawnCard.cost - 1) % 2;
      expect(colony!.name).to.eq([luna, ceres][expectedIndex].name);
    });

    it('discards the flipped card', () => {
      const [game] = testGame(1, {automa: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      game.colonies = [new Luna()];
      const discardBefore = game.projectDeck.discardPile.length;
      selectRandomColony(marsBot);
      expect(game.projectDeck.discardPile.length).to.eq(discardBefore + 1);
    });

    it('returns undefined if no eligible colonies', () => {
      const [game] = testGame(1, {automa: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      game.colonies = []; // No colonies in game
      const colony = selectRandomColony(marsBot);
      expect(colony).to.be.undefined;
    });

    it('handles 0-cost card without returning undefined (negative modulo fix)', () => {
      // JS: (0 - 1) % N = -1, so ((0-1) % N + N) % N = N-1 (last tile)
      const [game] = testGame(1, {automa: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const luna = new Luna();
      const ceres = new Ceres();
      game.colonies = [luna, ceres];
      // Inject a 0-cost card at the front of the draw pile
      game.projectDeck.drawPile.unshift(fakeCard({cost: 0}));
      // Should NOT return undefined — 0-cost maps to last tile (index N-1 = 1 = ceres)
      const selected = selectRandomColony(marsBot);
      expect(selected).to.not.be.undefined;
      expect(selected!.name).to.eq(ColonyName.CERES); // (0-1+2)%2 = 1 = ceres
    });
  });

  describe('placeColonyForMarsBot (C-19)', () => {
    it('adds MarsBot to colony.colonies array', () => {
      const [game] = testGame(1, {automa: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const luna = new Luna();
      game.colonies = [luna];
      placeColonyForMarsBot(luna, marsBot);
      expect(luna.colonies).to.include(marsBot.player.id);
    });

    it('adds 2 resources to shipping board instead of printed reward (C-19)', () => {
      const [game] = testGame(1, {automa: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const luna = new Luna();
      game.colonies = [luna];
      placeColonyForMarsBot(luna, marsBot);
      expect(marsBot.shippingBoard.get(ColonyName.LUNA)).to.eq(2);
    });

    it('updates trackPosition if colonies.length exceeds it', () => {
      const [game] = testGame(1, {automa: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const luna = new Luna();
      luna.trackPosition = 1;
      luna.colonies = ['phuman-id']; // 1 colony already
      game.colonies = [luna];
      placeColonyForMarsBot(luna, marsBot);
      expect(luna.trackPosition).to.be.at.least(luna.colonies.length);
    });
  });

  describe('Europa special case (C-24a)', () => {
    it('places ocean tile instead of 2 resources', () => {
      const [game] = testGame(1, {automa: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const europa = new Europa();
      game.colonies = [europa];
      const oceansBefore = game.board.getOceanSpaces().length;
      placeColonyForMarsBot(europa, marsBot);
      expect(game.board.getOceanSpaces().length).to.eq(oceansBefore + 1);
      expect(marsBot.shippingBoard.get(ColonyName.EUROPA)).to.eq(0); // No storage
    });

    it('flips one project card to break a tie between ocean spaces', () => {
      const [game] = testGame(1, {automa: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const europa = new Europa();
      game.colonies = [europa];
      game.projectDeck.discardPile.length = 0;
      placeColonyForMarsBot(europa, marsBot);
      expect(game.projectDeck.discardPile).has.length(1);
    });

    it('adds MarsBot to Europa colonies', () => {
      const [game] = testGame(1, {automa: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const europa = new Europa();
      game.colonies = [europa];
      placeColonyForMarsBot(europa, marsBot);
      expect(europa.colonies).to.include(marsBot.player.id);
    });

    it('places the colony and takes a failed action if ocean maxed', () => {
      const [game] = testGame(1, {automa: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const europa = new Europa();
      game.colonies = [europa];
      // Max all oceans
      while (game.canAddOcean()) {
        marsBot.turnResolver.placeOcean();
      }
      const mcBefore = marsBot.turnResolver.megacredits;
      placeColonyForMarsBot(europa, marsBot);
      // Should be a failed action (gains MC)
      expect(marsBot.turnResolver.megacredits).to.be.greaterThan(mcBefore);
      expect(europa.colonies).to.include(marsBot.player.id);
    });
  });

  describe('Titan special case (C-23)', () => {
    it('without Venus Next: adds 2 to Titan storage', () => {
      const [game] = testGame(1, {automa: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const titan = new Titan();
      game.colonies = [titan];
      placeColonyForMarsBot(titan, marsBot);
      expect(marsBot.shippingBoard.get(ColonyName.TITAN)).to.eq(2);
    });

    it('with Venus Next: adds 2 floaters to floaters', () => {
      const [game] = testGame(1, {
        automa: true,
        coloniesExtension: true,
        venusNextExtension: true,
        boardName: BoardName.THARSIS,
      });
      const marsBot = getMarsBot(game);
      const titan = new Titan();
      game.colonies = [titan];
      const floatersBefore = marsBot.floaters;
      placeColonyForMarsBot(titan, marsBot);
      expect(marsBot.floaters).to.eq(floatersBefore + 2);
    });

    it('Titan storage overflow does NOT advance any track (C-23)', () => {
      const [game] = testGame(1, {automa: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const titan = new Titan();
      game.colonies = [titan, new Luna()];
      // Add enough Titan floaters to hit overflow threshold
      marsBot.shippingBoard.add(ColonyName.TITAN, 3);
      const plantIdx = marsBot.marsBotBoard.tagToTrack[Tag.PLANT]!;
      const plantBefore = marsBot.marsBotBoard.tracks[plantIdx].position;
      placeColonyForMarsBot(titan, marsBot); // Adds 2 more = 5 total, but exempt from C-12
      expect(marsBot.marsBotBoard.tracks[plantIdx].position).to.eq(plantBefore); // No overflow
    });
  });
});
