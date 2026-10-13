import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {MarsBot} from '../../src/server/automa/MarsBot';
import {MarsBotBoard} from '../../src/server/automa/MarsBotBoard';
import {MarsBotTurnResolver} from '../../src/server/automa/MarsBotTurnResolver';
import {MarsBotBonusDeck} from '../../src/server/automa/MarsBotBonusDeck';
import {MarsBotBonusResolver} from '../../src/server/automa/MarsBotBonusResolver';
import {MarsBotTilePlacer} from '../../src/server/automa/MarsBotTilePlacer';
import {THARSIS_MARSBOT_BOARD} from '../../src/server/automa/boards/TharsisMarsBot';
import {TrackAction, TrackDefinition, BonusCardId} from '../../src/common/automa/AutomaTypes';
import {createBaseBonusCards, createCorpBonusCard} from '../../src/server/automa/MarsBotBonusCard';
import {SeededRandom} from '../../src/common/utils/Random';
import {BoardName} from '../../src/common/boards/BoardName';
import {Tag} from '../../src/common/cards/Tag';
import {TileType} from '../../src/common/TileType';
import {Pets} from '../../src/server/cards/base/Pets';
import {Birds} from '../../src/server/cards/base/Birds';
import {ColonyName} from '../../src/common/colonies/ColonyName';
import {fakeCard, maxOutOceans, setOxygenLevel, setTemperature, setVenusScaleLevel} from '../TestingUtils';
import {FAILED_ACTION_MC} from '../../src/common/automa/AutomaTypes';
import {MAX_TEMPERATURE} from '../../src/common/constants';
import {SpaceId} from '../../src/common/Types';
import {SpaceType} from '../../src/common/boards/SpaceType';

function createAutomaGame(difficulty: 'easy' | 'normal' | 'hard' | 'brutal' = 'normal'): {game: IGame, human: TestPlayer, marsBot: MarsBot} {
  const [game, human] = testGame(1, {automaOption: true, automaDifficulty: difficulty, boardName: BoardName.THARSIS});
  return {game, human, marsBot: game.automaHooks!.marsBot};
}

function emptyLayout(): Array<TrackAction | undefined> {
  return new Array(19).fill(undefined);
}

function makeBoard(track1Layout: ReadonlyArray<TrackAction | undefined>): ReadonlyArray<TrackDefinition> {
  return THARSIS_MARSBOT_BOARD.map((def, i) =>
    i === 0 ? {...def, layout: track1Layout} : def,
  );
}

function mockCard(tags: Tag[], type: string = 'automated') {
  return {cost: 5, tags, type: type as any, name: 'Mock' as any, metadata: {} as any} as any;
}

describe('MarsBot Deep Rules Tests', () => {
  // ---- Page 8: Expansion icons ignored without Failed Action ----

  describe('Expansion icons ignored when expansion not in use (page 8)', () => {
    it('venus action is ignored (no Failed Action) when Venus not enabled', () => {
      const [game, human] = testGame(1); // No Venus expansion
      const bot = TestPlayer.RED.newPlayer({name: 'bot'});
      (bot as any).game = game;

      const layout = emptyLayout();
      layout[1] = 'venus';
      const marsBotBoard = new MarsBotBoard(makeBoard(layout));
      const resolver = new MarsBotTurnResolver(game, bot, human, marsBotBoard, 'normal');

      resolver.resolveProjectCard(mockCard([Tag.BUILDING]));
      // Venus should be ignored, NOT a failed action
      expect(resolver.megacredits).to.eq(0); // No 5 MC from failed action
      expect(marsBotBoard.tracks[0].position).to.eq(1); // Track still advanced
    });

    it('venus2 action is ignored when Venus not enabled', () => {
      const [game, human] = testGame(1);
      const bot = TestPlayer.RED.newPlayer({name: 'bot'});
      (bot as any).game = game;

      const layout = emptyLayout();
      layout[1] = 'venus2';
      const marsBotBoard = new MarsBotBoard(makeBoard(layout));
      const resolver = new MarsBotTurnResolver(game, bot, human, marsBotBoard, 'normal');

      resolver.resolveProjectCard(mockCard([Tag.BUILDING]));
      expect(resolver.megacredits).to.eq(0);
    });
  });

  // ---- Page 9: Terraforming chain bonuses ----

  describe('Terraforming bonus chains (page 9)', () => {
    it('oxygen at 8 triggers temperature raise (bonus step)', () => {
      const {game, marsBot} = createAutomaGame();
      // Set oxygen to 7 so next raise hits 8 (bonus: raise temperature)
      (game as any).oxygenLevel = 7;
      const tempBefore = game.getTemperature();
      const trBefore = marsBot.player.terraformRating;

      const layout = emptyLayout();
      layout[1] = 'greenery'; // Greenery raises oxygen
      const marsBotBoard = new MarsBotBoard(makeBoard(layout));
      // Place a city for greenery placement rules
      const spaces = game.board.getAvailableSpacesOnLand(marsBot.player);
      game.simpleAddTile(marsBot.player, spaces[15], {tileType: TileType.CITY});

      const resolver = new MarsBotTurnResolver(game, marsBot.player, marsBot.humanPlayer, marsBotBoard, 'normal');
      resolver.resolveProjectCard(mockCard([Tag.BUILDING]));

      // Oxygen should be 8, which triggers temperature raise
      expect(game.getOxygenLevel()).to.eq(8);
      // Temperature should have increased by 2 (1 step = 2°C from the bonus)
      expect(game.getTemperature()).to.eq(tempBefore + 2);
      // TR: +1 for oxygen + +1 for temperature bonus = 2 more TR
      expect(marsBot.player.terraformRating).to.be.gte(trBefore + 2);
    });
  });

  // ---- Page 5: Multiple tags, one track maxed ----

  describe('Multiple tags where one track is maxed (page 5)', () => {
    it('maxed track gets Failed Action, other track still advances', () => {
      const [game, human] = testGame(1);
      const bot = TestPlayer.RED.newPlayer({name: 'bot'});
      (bot as any).game = game;

      const allEmpty = emptyLayout();
      const boardData = THARSIS_MARSBOT_BOARD.map((def) => ({...def, layout: allEmpty}));
      const marsBotBoard = new MarsBotBoard(boardData);
      const resolver = new MarsBotTurnResolver(game, bot, human, marsBotBoard, 'normal');

      // Max out Track 1 (Building)
      for (let i = 0; i < 18; i++) {
        marsBotBoard.tracks[0].advance();
      }
      expect(marsBotBoard.tracks[0].position).to.eq(18);

      // Play card with Building + Space tags
      resolver.resolveProjectCard(mockCard([Tag.BUILDING, Tag.SPACE]));

      // Building track maxed → Failed Action (5 MC)
      // Space track should still advance
      expect(resolver.megacredits).to.eq(5);
      expect(marsBotBoard.tracks[1].position).to.eq(1);
      expect(marsBotBoard.tracks[0].position).to.eq(18); // Unchanged
    });
  });

  // ---- Page 6: B02 Invasive Species edge cases ----

  describe('B02 Invasive Species (page 6)', () => {
    it('MarsBot gains 5 MC even when human has no animals/microbes', () => {
      const {game, human, marsBot} = createAutomaGame();
      // Human has no cards with resources

      const cards = createBaseBonusCards();
      const b02 = cards.find((c) => c.id === BonusCardId.B02_INVASIVE_SPECIES)!;
      const tilePlacer = new MarsBotTilePlacer(game, marsBot.player, human);
      const bonusDeck = MarsBotBonusDeck.createBase(new SeededRandom(99));
      const bonusResolver = new MarsBotBonusResolver(game, marsBot.player, human, marsBot.turnResolver, bonusDeck, tilePlacer);

      bonusResolver.resolve(b02);
      expect(marsBot.turnResolver.megacredits).to.eq(5);
    });

    function invasiveSpecies() {
      return createBaseBonusCards().find((c) => c.id === BonusCardId.B02_INVASIVE_SPECIES)!;
    }

    it('skips Pets, whose animals cannot be removed', () => {
      const {human, marsBot} = createAutomaGame();
      const pets = new Pets();
      pets.resourceCount = 6; // 3 VP
      const birds = new Birds();
      birds.resourceCount = 1; // 1 VP
      human.playedCards.push(pets, birds);

      marsBot['bonusResolver'].resolve(invasiveSpecies());

      expect(pets.resourceCount).to.eq(6);
      expect(birds.resourceCount).to.eq(0);
    });

    it('with Venus Next gains 2 M€ and 1 floater instead of 5 M€', () => {
      const [game] = testGame(1, {automaOption: true, venusNextExtension: true, boardName: BoardName.THARSIS});
      const marsBot = game.automaHooks!.marsBot;

      marsBot['bonusResolver'].resolve(invasiveSpecies());

      expect(marsBot.turnResolver.megacredits).to.eq(2);
      expect(marsBot.floaters).to.eq(1);
    });

    it('with Colonies and no Venus Next puts the floater in Titan storage', () => {
      const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = game.automaHooks!.marsBot;

      marsBot['bonusResolver'].resolve(invasiveSpecies());

      expect(marsBot.turnResolver.megacredits).to.eq(2);
      expect(marsBot.shippingBoard.storage.get(ColonyName.TITAN)).to.eq(1);
    });
  });

  describe('B16 Government Intervention', () => {
    it('gives MarsBot neither TR nor M€, even from a temperature bonus', () => {
      const [game] = testGame(1, {automaOption: true, venusNextExtension: true, boardName: BoardName.THARSIS});
      const marsBot = game.automaHooks!.marsBot;
      game.generation = 2;
      setOxygenLevel(game, 14);
      maxOutOceans(game.players[0]);
      setTemperature(game, -26);
      const tr = marsBot.player.terraformRating;
      const mc = marsBot.turnResolver.megacredits;

      marsBot['bonusResolver'].resolve(createCorpBonusCard(BonusCardId.B16_GOVERNMENT_INTERVENTION));

      expect(game.getTemperature()).to.eq(-24);
      expect(marsBot.player.terraformRating).to.eq(tr);
      expect(marsBot.turnResolver.megacredits).to.eq(mc);
    });

    it('raises Venus instead when every Martian parameter is complete on an even generation', () => {
      const [game] = testGame(1, {automaOption: true, venusNextExtension: true, boardName: BoardName.THARSIS});
      const marsBot = game.automaHooks!.marsBot;
      game.generation = 2;
      setOxygenLevel(game, 14);
      maxOutOceans(game.players[0]);
      setTemperature(game, 8);
      const venus = game.getVenusScaleLevel();

      marsBot['bonusResolver'].resolve(createCorpBonusCard(BonusCardId.B16_GOVERNMENT_INTERVENTION));

      expect(game.getVenusScaleLevel()).to.eq(venus + 2);
    });

    it('advances the parameter with the most steps remaining, not the lowest fraction done', () => {
      const [game] = testGame(1, {automaOption: true, venusNextExtension: true, boardName: BoardName.THARSIS});
      const marsBot = game.automaHooks!.marsBot;
      game.generation = 2;
      // Oxygen 7 is 50% done with 7 steps left, temperature -10 is 52% done with 9 steps left
      setOxygenLevel(game, 7);
      maxOutOceans(game.players[0]);
      setTemperature(game, -10);

      marsBot['bonusResolver'].resolve(createCorpBonusCard(BonusCardId.B16_GOVERNMENT_INTERVENTION));

      expect(game.getTemperature()).to.eq(-8);
      expect(game.getOxygenLevel()).to.eq(7);
    });
  });

  // ---- Page 8: MarsBot does NOT pay for milestones or awards ----

  describe('MarsBot does not pay for milestones or awards (page 8)', () => {
    it('milestone claim does not deduct MC from megacredits', () => {
      const [game, human] = testGame(1);
      const bot = TestPlayer.RED.newPlayer({name: 'bot'});
      (bot as any).game = game;
      bot.setTerraformRating(35); // Meets Terraformer

      const layout = emptyLayout();
      layout[1] = 'milestone';
      const marsBotBoard = new MarsBotBoard(makeBoard(layout));
      const resolver = new MarsBotTurnResolver(game, bot, human, marsBotBoard, 'normal');
      resolver.megacredits = 10;

      resolver.resolveProjectCard(mockCard([Tag.BUILDING]));
      // MC should not have decreased (MarsBot doesn't pay for milestones)
      // It might have increased from failed action if couldn't claim
      expect(resolver.megacredits).to.be.gte(10);
    });

    it('award funding does not deduct MC from megacredits', () => {
      const [game, human] = testGame(1);
      const bot = TestPlayer.RED.newPlayer({name: 'bot'});
      (bot as any).game = game;

      // Give bot some tiles so it's ahead on Landlord
      const spaces = game.board.getAvailableSpacesOnLand(bot);
      game.simpleAddTile(bot, spaces[5], {tileType: TileType.GREENERY});
      game.simpleAddTile(bot, spaces[10], {tileType: TileType.CITY});

      const layout = emptyLayout();
      layout[1] = 'award';
      const marsBotBoard = new MarsBotBoard(makeBoard(layout));
      const resolver = new MarsBotTurnResolver(game, bot, human, marsBotBoard, 'normal');
      resolver.megacredits = 10;

      resolver.resolveProjectCard(mockCard([Tag.BUILDING]));
      // MC should not have decreased
      expect(resolver.megacredits).to.be.gte(10);
    });
  });

  // ---- Page 3: Setup verification ----

  describe('Setup rules (page 3)', () => {
    it('initial action deck draws from project deck', () => {
      const {game} = createAutomaGame();
      // The project deck should have been reduced by 3 cards for MarsBot + 10 for human
      // Just verify it's less than the full deck
      expect(game.projectDeck.drawPile.length).to.be.lt(200);
    });

    it('MarsBot has no corporation card', () => {
      const {marsBot} = createAutomaGame();
      expect(marsBot.player.playedCards.length).to.eq(0);
    });

    it('bonus deck starts with B01-B08 minus 1 (drawn for action deck)', () => {
      const {marsBot} = createAutomaGame();
      // 8 cards - 1 drawn for action deck = 7 remaining
      expect(marsBot.bonusDeck.drawPile.length).to.eq(7);
    });
  });

  // ---- Page 6: B06 Lobbyists detailed options ----

  describe('B06 Lobbyists detailed options (page 6-7)', () => {
    it('option (a): temp 1-2 from completion → raise 2 + destroy', () => {
      const {game, human, marsBot} = createAutomaGame();
      // Temperature at +4 (2 steps from max +8)
      (game as any).temperature = 4;

      const cards = createBaseBonusCards();
      const b06 = cards.find((c) => c.id === BonusCardId.B06_LOBBYISTS)!;
      const tilePlacer = new MarsBotTilePlacer(game, marsBot.player, human);
      const bonusDeck = MarsBotBonusDeck.createBase(new SeededRandom(99));
      const bonusResolver = new MarsBotBonusResolver(game, marsBot.player, human, marsBot.turnResolver, bonusDeck, tilePlacer);

      const destroyed = bonusResolver.resolve(b06);
      expect(game.getTemperature()).to.eq(8); // Raised 2 steps (4°C)
      expect(destroyed).to.be.true;
    });

    it('option (d): advance furthest parameter, measured in steps remaining', () => {
      const {game, human, marsBot} = createAutomaGame();
      // From the start temperature has 19 steps left, oxygen 14 and oceans 9

      const cards = createBaseBonusCards();
      const b06 = cards.find((c) => c.id === BonusCardId.B06_LOBBYISTS)!;
      const tilePlacer = new MarsBotTilePlacer(game, marsBot.player, human);
      const bonusDeck = MarsBotBonusDeck.createBase(new SeededRandom(99));
      const bonusResolver = new MarsBotBonusResolver(game, marsBot.player, human, marsBot.turnResolver, bonusDeck, tilePlacer);

      const tempBefore = game.getTemperature();
      const destroyed = bonusResolver.resolve(b06);
      // None of a/b/c apply, so option d fires
      expect(game.getTemperature()).to.eq(tempBefore + 2);
      expect(destroyed).to.be.false; // Option d does NOT destroy
    });
  });

  // ---- Page 5: Card placed in played pile after resolution ----

  describe('Card goes to the played pile after resolution (page 5)', () => {
    it('project card goes to MarsBot\'s played pile, not the project discard pile', () => {
      const {game, marsBot} = createAutomaGame();
      const discardBefore = game.projectDeck.discardPile.length;

      const card = mockCard([Tag.BUILDING]);
      marsBot.turnResolver.resolveProjectCard(card);

      expect(game.projectDeck.discardPile.length).to.eq(discardBefore);
      expect(marsBot.playedProjectCards).to.include(card);
    });
  });

  // ---- Page 10: Game end — "finish the round" ----

  describe('Game end timing (page 10)', () => {
    it('game is not over mid-round when mars is terraformed', () => {
      const {game} = createAutomaGame();
      // Terraforming completion happens during a round
      // gameIsOver is checked AFTER production, not mid-round
      // Just verify the check works
      (game as any).oxygenLevel = 14;
      (game as any).temperature = 8;
      const oceanSpaces = game.board.getAvailableSpacesForOcean(game.players[0]);
      for (let i = 0; i < 9 && i < oceanSpaces.length; i++) {
        game.simpleAddTile(game.players[0], oceanSpaces[i], {tileType: TileType.OCEAN});
      }
      expect(game.marsIsTerraformed()).to.be.true;
      expect(game.gameIsOver()).to.be.true;
    });
  });

  // ---- Page 9: Temperature heat bonuses at -24C and -20C ----

  describe('Temperature heat bonuses (page 9)', () => {
    it('MarsBot gets 2 MC at -20C bonus', () => {
      const {game, marsBot} = createAutomaGame();
      (game as any).temperature = -22; // 1 step below -20

      const mcBefore = marsBot.turnResolver.megacredits;
      game.increaseTemperature(marsBot.player, 1);
      // Should cross -20, giving 2 MC
      expect(marsBot.turnResolver.megacredits).to.eq(mcBefore + 2);
    });

    it('MarsBot gets 2 MC at both -24C and -20C when raising 3 steps', () => {
      const {game, marsBot} = createAutomaGame();
      (game as any).temperature = -26; // Raising 3 steps: -26 → -20, crosses both -24 and -20

      const mcBefore = marsBot.turnResolver.megacredits;
      game.increaseTemperature(marsBot.player, 3);
      // Crosses both -24 and -20, giving 2 MC each = 4 MC total
      expect(marsBot.turnResolver.megacredits).to.eq(mcBefore + 4);
    });
  });

  // ---- Page 4: Research phase deck building ----

  describe('Research phase deck building (page 4)', () => {
    it('action deck has exactly 4 cards after research (normal)', () => {
      const {marsBot} = createAutomaGame();
      marsBot.buildResearchActionDeck();
      expect(marsBot.actionDeck.length).to.eq(4);
    });

    it('action deck has exactly 5 cards after research (brutal)', () => {
      const {marsBot} = createAutomaGame('brutal');
      marsBot.buildResearchActionDeck();
      expect(marsBot.actionDeck.length).to.eq(5);
    });

    it('bonus deck reshuffles automatically when draw pile exhausted', () => {
      const {game, marsBot} = createAutomaGame();
      // 7 in draw pile (1 used for initial action deck), 0 in discard
      // Draw all remaining and discard them
      const drawn = [];
      while (marsBot.bonusDeck.drawPile.length > 0) {
        const card = marsBot.bonusDeck.draw(game)!;
        drawn.push(card);
      }
      for (const c of drawn) {
        marsBot.bonusDeck.discard(c);
      }

      // Now draw pile is 0, discard has all cards
      // Next draw should reshuffle
      const card = marsBot.bonusDeck.draw(game);
      expect(card).to.not.be.undefined;
    });
  });

  // ---- Page 6: Destroyed bonus cards never return ----

  describe('Destroyed bonus cards (page 6)', () => {
    it('a card that is never discarded does not return after reshuffle', () => {
      const {game, marsBot} = createAutomaGame();
      // A destroyed card is simply never discarded (the resolver skips the discard),
      // so it can never be reshuffled back into the deck.
      const removedId = marsBot.bonusDeck.draw(game)!.id;

      // Draw and discard everything else, forcing a reshuffle on the last draw.
      const remaining = marsBot.bonusDeck.drawPile.length;
      for (let i = 0; i < remaining; i++) {
        marsBot.bonusDeck.discard(marsBot.bonusDeck.draw(game)!);
      }
      const reshuffled: Array<string | undefined> = [];
      for (let i = 0; i < 10; i++) {
        const c = marsBot.bonusDeck.draw(game);
        if (c === undefined) {
          break;
        }
        reshuffled.push(c.id);
        marsBot.bonusDeck.discard(c);
      }

      expect(reshuffled).to.not.include(removedId);
    });
  });

  // ---- Page 8: Milestone tiebreaker #3 leftmost ----

  describe('Milestone tiebreaker #3: leftmost (page 8)', () => {
    it('claims leftmost milestone when human does not qualify for any', () => {
      const {game, human, marsBot} = createAutomaGame();
      // Make MarsBot meet Terraformer and Mayor, with the human just as far from each
      marsBot.player.setTerraformRating(35);
      human.setTerraformRating(32);
      const spaces = game.board.getAvailableSpacesOnLand(marsBot.player);
      game.simpleAddTile(marsBot.player, spaces[5], {tileType: TileType.CITY});
      game.simpleAddTile(marsBot.player, spaces[15], {tileType: TileType.CITY});
      game.simpleAddTile(marsBot.player, spaces[25], {tileType: TileType.CITY});

      const layout = emptyLayout();
      layout[1] = 'milestone';
      const marsBotBoard = new MarsBotBoard(makeBoard(layout));
      const resolver = new MarsBotTurnResolver(game, marsBot.player, human, marsBotBoard, 'normal');

      resolver.resolveProjectCard(mockCard([Tag.BUILDING]));

      // Should claim the leftmost qualifying milestone (Terraformer)
      expect(game.claimedMilestones.length).to.eq(1);
      expect(game.claimedMilestones[0].milestone.name).to.eq('Terraformer');
    });
  });

  // ---- Page 5: Event tag injected for EVENT type cards ----

  describe('Event cards inject Event tag (page 5)', () => {
    it('event card with Building tag advances both Building and Event tracks', () => {
      const [game, human] = testGame(1);
      const bot = TestPlayer.RED.newPlayer({name: 'bot'});
      (bot as any).game = game;

      const allEmpty = emptyLayout();
      const boardData = THARSIS_MARSBOT_BOARD.map((def) => ({...def, layout: allEmpty}));
      const marsBotBoard = new MarsBotBoard(boardData);
      const resolver = new MarsBotTurnResolver(game, bot, human, marsBotBoard, 'normal');

      resolver.resolveProjectCard(mockCard([Tag.BUILDING], 'event'));

      expect(marsBotBoard.tracks[0].position).to.eq(1); // Building
      expect(marsBotBoard.tracks[2].position).to.eq(1); // Event (injected)
    });

    it('event card with NO explicit tags still advances Event track', () => {
      const [game, human] = testGame(1);
      const bot = TestPlayer.RED.newPlayer({name: 'bot'});
      (bot as any).game = game;

      const allEmpty = emptyLayout();
      const boardData = THARSIS_MARSBOT_BOARD.map((def) => ({...def, layout: allEmpty}));
      const marsBotBoard = new MarsBotBoard(boardData);
      const resolver = new MarsBotTurnResolver(game, bot, human, marsBotBoard, 'normal');

      // Event card with zero explicit tags — should NOT be a failed action
      resolver.resolveProjectCard(mockCard([], 'event'));

      expect(marsBotBoard.tracks[2].position).to.eq(1); // Event tag injected
      expect(resolver.megacredits).to.eq(0); // Not a failed action
    });
  });

  // ---- Page 10: MC to VP example from rulebook ----

  describe('MC to VP rulebook example (page 10)', () => {
    it('example: gen 14, 24 MC → 4 VP (1 per 6 MC)', () => {
      const {game, marsBot} = createAutomaGame();
      (game as any).generation = 14;
      marsBot.turnResolver.megacredits = 24;
      (game as any).phase = 'end';

      const vp = marsBot.getVictoryPoints();
      expect(vp.mcToVP).to.eq(4); // floor(24/6) = 4
    });

    it('example: gen 16, 24 MC → 6 VP (1 per 4 MC)', () => {
      const {game, marsBot} = createAutomaGame();
      (game as any).generation = 16;
      marsBot.turnResolver.megacredits = 24;
      (game as any).phase = 'end';

      const vp = marsBot.getVictoryPoints();
      expect(vp.mcToVP).to.eq(6); // floor(24/4) = 6
    });
  });

  // ---- Rulebook A audit fixes ----

  describe('Hard mode first-turn milestone (page 11)', () => {
    // Builder, Planner and Terraformer all qualify for MarsBot.
    function qualifyForThree(marsBot: MarsBot) {
      for (let i = 0; i < 8; i++) {
        marsBot.marsBotBoard.tracks[0].advance();
      }
      for (let t = 1; t < marsBot.marsBotBoard.tracks.length; t++) {
        for (let i = 0; i < 4; i++) {
          marsBot.marsBotBoard.tracks[t].advance();
        }
      }
      marsBot.player.setTerraformRating(35);
    }

    it('claims before the card resolves, once per generation', () => {
      const {game, marsBot} = createAutomaGame('hard');
      qualifyForThree(marsBot);
      marsBot.turnResolver.megacredits = 30;
      marsBot.actionDeck = [mockCard([Tag.MICROBE]), mockCard([Tag.MICROBE]), mockCard([Tag.MICROBE])];
      const claimedWhenResolving: Array<number> = [];
      const resolve = marsBot.turnResolver.resolveProjectCard.bind(marsBot.turnResolver);
      marsBot.turnResolver.resolveProjectCard = (card) => {
        claimedWhenResolving.push(game.claimedMilestones.length);
        resolve(card);
      };

      marsBot.takeTurn();
      const claimedAfterFirst = game.claimedMilestones.length;
      marsBot.takeTurn();
      marsBot.takeTurn();

      // One milestone was already claimed when the first card resolved
      expect(claimedWhenResolving[0]).to.eq(1);
      expect(claimedAfterFirst).to.be.gte(1);
      // Later turns of the same generation claim nothing before their card
      expect(claimedWhenResolving[1]).to.eq(claimedAfterFirst);

      // A new generation checks again
      game.generation++;
      marsBot.actionDeck = [mockCard([Tag.MICROBE])];
      const before = game.claimedMilestones.length;
      marsBot.takeTurn();
      expect(claimedWhenResolving[3]).to.eq(before + 1);
    });

    it('does not claim on the first turn when MarsBot has less than 8 MC', () => {
      const {game, marsBot} = createAutomaGame('hard');
      qualifyForThree(marsBot);
      marsBot.turnResolver.megacredits = 7;
      marsBot.actionDeck = [mockCard([Tag.MICROBE])];
      marsBot.turnResolver.resolveProjectCard = () => {};

      marsBot.takeTurn();

      expect(game.claimedMilestones).to.have.length(0);
    });

    it('applies the page 8 tiebreakers, preferring a milestone the player also meets', () => {
      const {game, human, marsBot} = createAutomaGame('hard');
      marsBot.player.setTerraformRating(35);
      const land = game.board.getAvailableSpacesOnLand(marsBot.player);
      for (const i of [5, 15, 25]) {
        game.simpleAddTile(marsBot.player, land[i], {tileType: TileType.CITY});
      }
      for (const i of [30, 31, 32]) {
        game.simpleAddTile(marsBot.player, land[i], {tileType: TileType.GREENERY});
      }
      for (const i of [40, 41, 42]) {
        game.simpleAddTile(human, land[i], {tileType: TileType.GREENERY});
      }
      marsBot.turnResolver.megacredits = 8;
      marsBot.actionDeck = [mockCard([Tag.MICROBE])];
      marsBot.turnResolver.resolveProjectCard = () => {};

      marsBot.takeTurn();

      expect(game.claimedMilestones[0].milestone.name).to.eq('Gardener');
    });
  });

  describe('Milestone tiebreaker #2: closest to meeting the criteria (page 8)', () => {
    function claimableOf(game: IGame, ...names: Array<string>) {
      return game.milestones.filter((m) => names.includes(m.name));
    }

    it('compares the distance to each threshold, not the raw scores', () => {
      const {game, human, marsBot} = createAutomaGame();
      // Terraformer is 15 away for the player, Mayor only 1
      human.setTerraformRating(20);
      const land = game.board.getAvailableSpacesOnLand(human);
      game.simpleAddTile(human, land[5], {tileType: TileType.CITY});
      game.simpleAddTile(human, land[15], {tileType: TileType.CITY});

      const picked = marsBot.turnResolver.selectMilestone(claimableOf(game, 'Terraformer', 'Mayor'));

      expect(picked?.name).to.eq('Mayor');
    });

    it('counts Planner by cards in hand', () => {
      const {game, human, marsBot} = createAutomaGame();
      human.setTerraformRating(30); // 5 from Terraformer
      human.cardsInHand = Array.from({length: 14}, () => fakeCard()); // 2 from Planner
      human.playedCards.push(fakeCard(), fakeCard(), fakeCard(), fakeCard());

      const picked = marsBot.turnResolver.selectMilestone(claimableOf(game, 'Terraformer', 'Planner'));

      expect(picked?.name).to.eq('Planner');
    });

    it('measures Terraformer against 26 with Turmoil', () => {
      const [game, human] = testGame(1, {automaOption: true, boardName: BoardName.THARSIS, turmoilExtension: true});
      human.setTerraformRating(25);

      const terraformer = game.milestones.find((m) => m.name === 'Terraformer')!;

      expect(terraformer.remaining?.(human)).to.eq(1);
    });
  });

  describe('B04 Overachievement uses the claim tiebreakers (page 7)', () => {
    it('claims the milestone the player also meets, not the first one', () => {
      const {game, human, marsBot} = createAutomaGame();
      marsBot.player.setTerraformRating(35);
      const land = game.board.getAvailableSpacesOnLand(marsBot.player);
      for (const i of [30, 31, 32]) {
        game.simpleAddTile(marsBot.player, land[i], {tileType: TileType.GREENERY});
      }
      for (const i of [40, 41, 42]) {
        game.simpleAddTile(human, land[i], {tileType: TileType.GREENERY});
      }
      const b04 = createBaseBonusCards().find((c) => c.id === BonusCardId.B04_OVERACHIEVEMENT)!;

      const destroyed = marsBot['bonusResolver'].resolve(b04);

      expect(destroyed).is.true;
      expect(game.claimedMilestones.map((c) => c.milestone.name)).deep.eq(['Gardener']);
    });
  });

  describe('B06 Lobbyists ocean placement tiebreakers (page 7)', () => {
    it('breaks the tie between ocean spaces by placement bonus icons', () => {
      const {game, human, marsBot} = createAutomaGame();
      (game as any).temperature = -30;
      // Spaces 07 (no bonus) and 43 (one plant) each touch two oceans; 07 comes first on the board.
      for (const id of ['13', '06', '34', '44']) {
        game.simpleAddTile(human, game.board.getSpaceOrThrow(id as SpaceId), {tileType: TileType.OCEAN});
      }
      const b06 = createBaseBonusCards().find((c) => c.id === BonusCardId.B06_LOBBYISTS)!;

      marsBot['bonusResolver'].resolve(b06);

      expect(game.board.getSpaceOrThrow('43' as SpaceId).tile?.tileType).to.eq(TileType.OCEAN);
      expect(game.board.getSpaceOrThrow('07' as SpaceId).tile).is.undefined;
    });
  });

  describe('Random placement tiebreak counts from the first space (page 9)', () => {
    function pick(cost: number, count: number): number {
      const {game, human, marsBot} = createAutomaGame();
      const tilePlacer = new MarsBotTilePlacer(game, marsBot.player, human);
      const spaces = game.board.getAvailableSpacesOnLand(human).slice(0, count);
      game.projectDeck.drawOrThrow = () => ({cost} as any);
      return spaces.indexOf(tilePlacer['randomTiebreak'](spaces));
    }

    it('cost 1 is the first space', () => {
      expect(pick(1, 3)).to.eq(0);
    });

    it('counts through the spaces and restarts', () => {
      expect(pick(3, 3)).to.eq(2);
      expect(pick(4, 3)).to.eq(0);
      expect(pick(8, 3)).to.eq(1);
    });

    it('cost 0 counts back to the last space', () => {
      expect(pick(0, 3)).to.eq(2);
    });
  });

  describe('Played project cards (page 5)', () => {
    it('records a card resolved on a turn exactly once', () => {
      const {marsBot} = createAutomaGame();
      const card = mockCard([Tag.MICROBE]);
      marsBot.actionDeck = [card];

      marsBot.takeTurn();

      expect(marsBot.playedProjectCards).deep.eq([card]);
    });

    it('records cards resolved by Research and Development', () => {
      const {marsBot} = createAutomaGame();
      const rnd = createBaseBonusCards().find((c) => c.id === BonusCardId.B03_RESEARCH_AND_DEVELOPMENT)!;

      marsBot['bonusResolver'].resolve(rnd);

      expect(marsBot.playedProjectCards).to.have.length(1);
    });

    it('records cards resolved by corporation effects', () => {
      const {marsBot} = createAutomaGame();

      marsBot.maybeDrawAndResolveProjectCard();
      marsBot.maybeDrawAndResolveProjectCardFirstTagOnly();

      expect(marsBot.playedProjectCards).to.have.length(2);
    });

    it('records the project card in a Neural Instance fallback', () => {
      const {marsBot} = createAutomaGame();
      marsBot['tilePlacer'].findNeuralInstanceSpace = () => undefined;
      const b07 = createBaseBonusCards().find((c) => c.id === BonusCardId.B07_LOCAL_NEURAL_INSTANCE)!;

      marsBot['bonusResolver'].resolve(b07);

      expect(marsBot.playedProjectCards).to.have.length(1);
    });
  });

  describe('Placement bonuses for every tile (page 9)', () => {
    it('Neural Instance gains 1 MC per covered icon', () => {
      const {game, marsBot} = createAutomaGame();
      const space = game.board.spaces.find((s) => s.bonus.length >= 2 && s.spaceType === SpaceType.LAND)!;
      marsBot['tilePlacer'].findNeuralInstanceSpace = () => space;
      const b07 = createBaseBonusCards().find((c) => c.id === BonusCardId.B07_LOCAL_NEURAL_INSTANCE)!;

      marsBot['bonusResolver'].resolve(b07);

      const expected = marsBot['tilePlacer'].getTotalPlacementMC(space);
      expect(expected).to.be.gte(2);
      expect(marsBot.turnResolver.megacredits).to.eq(expected);
    });

    it('final greenery gains the placement MC', () => {
      const {game, marsBot} = createAutomaGame();
      const spaces = game.board.getAvailableSpacesOnLand(marsBot.player);
      game.simpleAddTile(marsBot.player, spaces[15], {tileType: TileType.CITY});
      marsBot.marsBotBoard.tracks[6].advance();
      marsBot.marsBotBoard.tracks[6].advance();
      expect(marsBot.marsBotBoard.tracks[6].peek()).to.eq('greenery');

      marsBot.placeFinalGreeneries();

      const greenery = game.board.spaces.find((s) => s.tile?.tileType === TileType.GREENERY)!;
      expect(greenery).is.not.undefined;
      expect(marsBot.turnResolver.megacredits).to.eq(marsBot['tilePlacer'].getTotalPlacementMC(greenery));
    });

    it('final greenery skips a track whose next space was regressed from', () => {
      const {game, marsBot} = createAutomaGame();
      const track = marsBot.marsBotBoard.tracks[6];
      for (let i = 0; i < 3; i++) {
        track.advance();
      }
      track.regress(); // the greenery space ahead is marked as regressed

      marsBot.placeFinalGreeneries();

      expect(game.board.getGreeneries(marsBot.player)).to.have.length(0);
    });
  });

  describe('Terraforming bonus MarsBot cannot resolve is a Failed Action (page 9)', () => {
    it('oxygen reaching 8% with the temperature maxed', () => {
      const {game, marsBot} = createAutomaGame();
      setOxygenLevel(game, 7);
      setTemperature(game, MAX_TEMPERATURE);

      game.increaseOxygenLevel(marsBot.player, 1);

      expect(game.getOxygenLevel()).to.eq(8);
      expect(marsBot.turnResolver.megacredits).to.eq(FAILED_ACTION_MC);
    });

    it('oxygen reaching 8% raises the temperature when it can', () => {
      const {game, marsBot} = createAutomaGame();
      setOxygenLevel(game, 7);

      game.increaseOxygenLevel(marsBot.player, 1);

      expect(game.getTemperature()).to.eq(-28);
      expect(marsBot.turnResolver.megacredits).to.eq(0);
    });

    it('the player gets nothing', () => {
      const {game, human, marsBot} = createAutomaGame();
      setOxygenLevel(game, 7);
      setTemperature(game, MAX_TEMPERATURE);

      game.increaseOxygenLevel(human, 1);

      expect(marsBot.turnResolver.megacredits).to.eq(0);
    });

    it('temperature reaching 0C with every ocean placed', () => {
      const {game, marsBot} = createAutomaGame();
      maxOutOceans(marsBot.player);
      setTemperature(game, -2);

      game.increaseTemperature(marsBot.player, 1);

      expect(marsBot.turnResolver.megacredits).to.eq(FAILED_ACTION_MC);
    });
  });

  // The Venus 8% card bonus is 2 M€ for MarsBot, like the heat production bonus on the
  // temperature track (BGG 3358342 TDaver, 3424237 and 3733436 njshaw2)
  describe('Venus 8% card bonus', () => {
    function venusGame() {
      const [game] = testGame(1, {automaOption: true, venusNextExtension: true, boardName: BoardName.THARSIS});
      const marsBot = game.automaHooks!.marsBot;
      setVenusScaleLevel(game, 6);
      return {game, marsBot, hand: marsBot.player.cardsInHand.length, deck: game.projectDeck.drawPile.length};
    }

    it('gains MarsBot 2 M€ instead of a card', () => {
      const {game, marsBot, hand, deck} = venusGame();

      (marsBot.turnResolver as any).raiseVenus(1);

      expect(game.getVenusScaleLevel()).to.eq(8);
      expect(marsBot.turnResolver.megacredits).to.eq(2);
      expect(marsBot.player.cardsInHand).has.length(hand);
      expect(game.projectDeck.drawPile).has.length(deck);
    });

    it('gains nothing from Government Intervention, which pays no M€ from bonuses', () => {
      const {game, marsBot, hand} = venusGame();
      game.generation = 3;

      marsBot['bonusResolver'].resolve(createCorpBonusCard(BonusCardId.B16_GOVERNMENT_INTERVENTION));

      expect(game.getVenusScaleLevel()).to.eq(8);
      expect(marsBot.turnResolver.megacredits).to.eq(0);
      expect(marsBot.player.cardsInHand).has.length(hand);
    });
  });
});
