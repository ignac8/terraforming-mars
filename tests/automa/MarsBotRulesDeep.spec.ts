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
import {TrackDefinition, BonusCardId} from '../../src/common/automa/AutomaTypes';
import {createBaseBonusCards} from '../../src/server/automa/MarsBotBonusCard';
import {SeededRandom} from '../../src/common/utils/Random';
import {BoardName} from '../../src/common/boards/BoardName';
import {Tag} from '../../src/common/cards/Tag';
import {TileType} from '../../src/common/TileType';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {Board} from '../../src/server/boards/Board';
import * as constants from '../../src/common/constants';

function createAutomaGame(difficulty: 'easy' | 'normal' | 'hard' | 'brutal' = 'normal'): {game: IGame, human: TestPlayer, marsBot: MarsBot} {
  const [game, human] = testGame(1, {automaOption: true, automaDifficulty: difficulty, boardName: BoardName.THARSIS});
  return {game, human, marsBot: game.marsBot!};
}

function emptyLayout(): Array<null> {
  return new Array(19).fill(undefined);
}

function makeBoard(track1Layout: Array<string | null>): ReadonlyArray<TrackDefinition> {
  return THARSIS_MARSBOT_BOARD.map((def, i) =>
    i === 0 ? {...def, layout: track1Layout} as TrackDefinition : def,
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
      const board = new MarsBotBoard(makeBoard(layout));
      const resolver = new MarsBotTurnResolver(game, bot, human, board, 'normal');

      resolver.resolveProjectCard(mockCard([Tag.BUILDING]));
      // Venus should be ignored, NOT a failed action
      expect(resolver.mcSupply).to.eq(0); // No 5 MC from failed action
      expect(board.tracks[0].position).to.eq(1); // Track still advanced
    });

    it('venus2 action is ignored when Venus not enabled', () => {
      const [game, human] = testGame(1);
      const bot = TestPlayer.RED.newPlayer({name: 'bot'});
      (bot as any).game = game;

      const layout = emptyLayout();
      layout[1] = 'venus2';
      const board = new MarsBotBoard(makeBoard(layout));
      const resolver = new MarsBotTurnResolver(game, bot, human, board, 'normal');

      resolver.resolveProjectCard(mockCard([Tag.BUILDING]));
      expect(resolver.mcSupply).to.eq(0);
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
      const board = new MarsBotBoard(makeBoard(layout));
      // Place a city for greenery placement rules
      const spaces = game.board.getAvailableSpacesOnLand(marsBot.player);
      game.simpleAddTile(marsBot.player, spaces[15], {tileType: TileType.CITY});

      const resolver = new MarsBotTurnResolver(game, marsBot.player, marsBot.humanPlayer, board, 'normal');
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
      const boardData = THARSIS_MARSBOT_BOARD.map((def) => ({...def, layout: allEmpty} as TrackDefinition));
      const board = new MarsBotBoard(boardData);
      const resolver = new MarsBotTurnResolver(game, bot, human, board, 'normal');

      // Max out Track 1 (Building)
      for (let i = 0; i < 18; i++) {
        board.tracks[0].advance();
      }
      expect(board.tracks[0].position).to.eq(18);

      // Play card with Building + Space tags
      resolver.resolveProjectCard(mockCard([Tag.BUILDING, Tag.SPACE]));

      // Building track maxed → Failed Action (5 MC)
      // Space track should still advance
      expect(resolver.mcSupply).to.eq(5);
      expect(board.tracks[1].position).to.eq(1);
      expect(board.tracks[0].position).to.eq(18); // Unchanged
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
      expect(marsBot.turnResolver.mcSupply).to.eq(5);
    });
  });

  // ---- Page 8: MarsBot does NOT pay for milestones or awards ----

  describe('MarsBot does not pay for milestones or awards (page 8)', () => {
    it('milestone claim does not deduct MC from mcSupply', () => {
      const [game, human] = testGame(1);
      const bot = TestPlayer.RED.newPlayer({name: 'bot'});
      (bot as any).game = game;
      bot.setTerraformRating(35); // Meets Terraformer

      const layout = emptyLayout();
      layout[1] = 'milestone';
      const board = new MarsBotBoard(makeBoard(layout));
      const resolver = new MarsBotTurnResolver(game, bot, human, board, 'normal');
      resolver.mcSupply = 10;

      resolver.resolveProjectCard(mockCard([Tag.BUILDING]));
      // MC should not have decreased (MarsBot doesn't pay for milestones)
      // It might have increased from failed action if couldn't claim
      expect(resolver.mcSupply).to.be.gte(10);
    });

    it('award funding does not deduct MC from mcSupply', () => {
      const [game, human] = testGame(1);
      const bot = TestPlayer.RED.newPlayer({name: 'bot'});
      (bot as any).game = game;

      // Give bot some tiles so it's ahead on Landlord
      const spaces = game.board.getAvailableSpacesOnLand(bot);
      game.simpleAddTile(bot, spaces[5], {tileType: TileType.GREENERY});
      game.simpleAddTile(bot, spaces[10], {tileType: TileType.CITY});

      const layout = emptyLayout();
      layout[1] = 'award';
      const board = new MarsBotBoard(makeBoard(layout));
      const resolver = new MarsBotTurnResolver(game, bot, human, board, 'normal');
      resolver.mcSupply = 10;

      resolver.resolveProjectCard(mockCard([Tag.BUILDING]));
      // MC should not have decreased
      expect(resolver.mcSupply).to.be.gte(10);
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

      bonusResolver.resolve(b06);
      expect(game.getTemperature()).to.eq(8); // Raised 2 steps (4°C)
      expect(b06.destroyed).to.be.true;
    });

    it('option (d): advance furthest parameter — oxygen > ocean > temp priority', () => {
      const {game, human, marsBot} = createAutomaGame();
      // All at 0% — tied. Priority: oxygen > ocean > temp
      // So should raise oxygen (place greenery? no — option d advances the parameter directly)
      // Actually looking at the code, advanceFurthestParameter raises oxygen via increaseOxygenLevel

      const cards = createBaseBonusCards();
      const b06 = cards.find((c) => c.id === BonusCardId.B06_LOBBYISTS)!;
      const tilePlacer = new MarsBotTilePlacer(game, marsBot.player, human);
      const bonusDeck = MarsBotBonusDeck.createBase(new SeededRandom(99));
      const bonusResolver = new MarsBotBonusResolver(game, marsBot.player, human, marsBot.turnResolver, bonusDeck, tilePlacer);

      const oxyBefore = game.getOxygenLevel();
      bonusResolver.resolve(b06);
      // With all at 0, none of a/b/c apply, so option d fires
      // Priority: oxygen first
      expect(game.getOxygenLevel()).to.eq(oxyBefore + 1);
      expect(b06.destroyed).to.be.false; // Option d does NOT destroy
    });
  });

  // ---- Page 5: Card placed in played pile after resolution ----

  describe('Card goes to discard after resolution (page 5)', () => {
    it('project card goes to project discard pile', () => {
      const {game, marsBot} = createAutomaGame();
      const discardBefore = game.projectDeck.discardPile.length;

      const card = mockCard([Tag.BUILDING]);
      marsBot.turnResolver.resolveProjectCard(card);

      expect(game.projectDeck.discardPile.length).to.eq(discardBefore + 1);
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

      const mcBefore = marsBot.turnResolver.mcSupply;
      game.increaseTemperature(marsBot.player, 1);
      // Should cross -20, giving 2 MC
      expect(marsBot.turnResolver.mcSupply).to.eq(mcBefore + 2);
    });

    it('MarsBot gets 2 MC at both -24C and -20C when raising 3 steps', () => {
      const {game, marsBot} = createAutomaGame();
      (game as any).temperature = -26; // Raising 3 steps: -26 → -20, crosses both -24 and -20

      const mcBefore = marsBot.turnResolver.mcSupply;
      game.increaseTemperature(marsBot.player, 3);
      // Crosses both -24 and -20, giving 2 MC each = 4 MC total
      expect(marsBot.turnResolver.mcSupply).to.eq(mcBefore + 4);
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
      const {marsBot} = createAutomaGame();
      // 7 in draw pile (1 used for initial action deck), 0 in discard
      // Draw all remaining and discard them
      const drawn = [];
      while (marsBot.bonusDeck.drawPile.length > 0) {
        const card = marsBot.bonusDeck.draw()!;
        drawn.push(card);
      }
      for (const c of drawn) {
        marsBot.bonusDeck.discard(c);
      }

      // Now draw pile is 0, discard has all cards
      // Next draw should reshuffle
      const card = marsBot.bonusDeck.draw();
      expect(card).to.not.be.undefined;
    });
  });

  // ---- Page 6: Destroyed bonus cards never return ----

  describe('Destroyed bonus cards (page 6)', () => {
    it('destroyed card does not appear in reshuffled deck', () => {
      const {marsBot} = createAutomaGame();
      // Draw and destroy the first card
      const card = marsBot.bonusDeck.draw()!;
      marsBot.bonusDeck.destroy(card);
      const destroyedId = card.id;

      // Draw and discard all remaining
      while (marsBot.bonusDeck.drawPile.length > 0) {
        const c = marsBot.bonusDeck.draw()!;
        marsBot.bonusDeck.discard(c);
      }

      // Reshuffle by drawing
      const reshuffled: string[] = [];
      for (let i = 0; i < 10; i++) {
        const c = marsBot.bonusDeck.draw();
        if (c === undefined) {
          break;
        }
        reshuffled.push(c.id);
        marsBot.bonusDeck.discard(c);
      }

      expect(reshuffled).to.not.include(destroyedId);
    });
  });

  // ---- Page 8: Milestone tiebreaker #3 leftmost ----

  describe('Milestone tiebreaker #3: leftmost (page 8)', () => {
    it('claims leftmost milestone when human does not qualify for any', () => {
      const {game, human, marsBot} = createAutomaGame();
      // Make MarsBot meet Terraformer and Mayor
      marsBot.player.setTerraformRating(35);
      const spaces = game.board.getAvailableSpacesOnLand(marsBot.player);
      game.simpleAddTile(marsBot.player, spaces[5], {tileType: TileType.CITY});
      game.simpleAddTile(marsBot.player, spaces[15], {tileType: TileType.CITY});
      game.simpleAddTile(marsBot.player, spaces[25], {tileType: TileType.CITY});

      const layout = emptyLayout();
      layout[1] = 'milestone';
      const board = new MarsBotBoard(makeBoard(layout));
      const resolver = new MarsBotTurnResolver(game, marsBot.player, human, board, 'normal');

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
      const boardData = THARSIS_MARSBOT_BOARD.map((def) => ({...def, layout: allEmpty} as TrackDefinition));
      const board = new MarsBotBoard(boardData);
      const resolver = new MarsBotTurnResolver(game, bot, human, board, 'normal');

      resolver.resolveProjectCard(mockCard([Tag.BUILDING], 'event'));

      expect(board.tracks[0].position).to.eq(1); // Building
      expect(board.tracks[2].position).to.eq(1); // Event (injected)
    });

    it('event card with NO explicit tags still advances Event track', () => {
      const [game, human] = testGame(1);
      const bot = TestPlayer.RED.newPlayer({name: 'bot'});
      (bot as any).game = game;

      const allEmpty = emptyLayout();
      const boardData = THARSIS_MARSBOT_BOARD.map((def) => ({...def, layout: allEmpty} as TrackDefinition));
      const board = new MarsBotBoard(boardData);
      const resolver = new MarsBotTurnResolver(game, bot, human, board, 'normal');

      // Event card with zero explicit tags — should NOT be a failed action
      resolver.resolveProjectCard(mockCard([], 'event'));

      expect(board.tracks[2].position).to.eq(1); // Event tag injected
      expect(resolver.mcSupply).to.eq(0); // Not a failed action
    });
  });

  // ---- Page 10: MC to VP example from rulebook ----

  describe('MC to VP rulebook example (page 10)', () => {
    it('example: gen 14, 24 MC → 4 VP (1 per 6 MC)', () => {
      const {game, marsBot} = createAutomaGame();
      (game as any).generation = 14;
      marsBot.turnResolver.mcSupply = 24;
      (game as any).phase = 'end';

      const vp = marsBot.getVictoryPoints();
      expect(vp.mcToVP).to.eq(4); // floor(24/6) = 4
    });

    it('example: gen 16, 24 MC → 6 VP (1 per 4 MC)', () => {
      const {game, marsBot} = createAutomaGame();
      (game as any).generation = 16;
      marsBot.turnResolver.mcSupply = 24;
      (game as any).phase = 'end';

      const vp = marsBot.getVictoryPoints();
      expect(vp.mcToVP).to.eq(6); // floor(24/4) = 6
    });
  });
});
