import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {MarsBot} from '../../src/server/automa/MarsBot';
import {MarsBotTilePlacer} from '../../src/server/automa/MarsBotTilePlacer';
import {standaloneMarsBot} from './corps/CorpGame';
import {THARSIS_MARSBOT_BOARD} from '../../src/server/automa/boards/TharsisMarsBot';
import {TrackAction, TrackDefinition} from '../../src/common/automa/AutomaTypes';
import {BoardName} from '../../src/common/boards/BoardName';
import {CardType} from '../../src/common/cards/CardType';
import {Tag} from '../../src/common/cards/Tag';
import {TileType} from '../../src/common/TileType';
import {fakeCard, maxOutOceans, setOxygenLevel, setTemperature, setVenusScaleLevel} from '../TestingUtils';
import {FAILED_ACTION_MC} from '../../src/common/automa/AutomaTypes';
import {MAX_TEMPERATURE} from '../../src/common/constants';
import {selectMilestone} from '../../src/server/automa/MarsBotMilestoneAwardEval';

function createAutomaGame(difficulty: 'easy' | 'normal' | 'hard' | 'brutal' = 'normal'): {game: IGame, human: TestPlayer, marsBot: MarsBot} {
  const [game, human] = testGame(1, {automa: true, automaDifficulty: difficulty, boardName: BoardName.THARSIS});
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

describe('MarsBot Deep Rules Tests', () => {
  describe('Expansion icons ignored when expansion not in use (page 8)', () => {
    it('venus action is ignored (no Failed Action) when Venus not enabled', () => {
      const [game, human] = testGame(1); // No Venus expansion
      const botPlayer = TestPlayer.RED.newPlayer({name: 'bot'});
      botPlayer.game = game;

      const layout = emptyLayout();
      layout[1] = 'venus';
      const marsBot = standaloneMarsBot(game, botPlayer, human, makeBoard(layout));
      const marsBotBoard = marsBot.marsBotBoard;
      const resolver = marsBot.turnResolver;

      resolver.resolveProjectCard(fakeCard({cost: 5, tags: [Tag.BUILDING], type: CardType.AUTOMATED}));
      // Venus should be ignored, NOT a failed action
      expect(marsBot.megacredits).to.eq(0); // No 5 MC from failed action
      expect(marsBotBoard.tracks[0].position).to.eq(1); // Track still advanced
    });

    it('venus2 action is ignored when Venus not enabled', () => {
      const [game, human] = testGame(1);
      const botPlayer = TestPlayer.RED.newPlayer({name: 'bot'});
      botPlayer.game = game;

      const layout = emptyLayout();
      layout[1] = 'venus2';
      const marsBot = standaloneMarsBot(game, botPlayer, human, makeBoard(layout));
      const resolver = marsBot.turnResolver;

      resolver.resolveProjectCard(fakeCard({cost: 5, tags: [Tag.BUILDING], type: CardType.AUTOMATED}));
      expect(marsBot.megacredits).to.eq(0);
    });
  });

  describe('Terraforming bonus chains (page 9)', () => {
    it('oxygen at 8 triggers temperature raise (bonus step)', () => {
      const {game, marsBot} = createAutomaGame();
      // Set oxygen to 7 so next raise hits 8 (bonus: raise temperature)
      setOxygenLevel(game, 7);
      const tempBefore = game.getTemperature();
      const trBefore = marsBot.player.terraformRating;

      const layout = emptyLayout();
      layout[1] = 'greenery'; // Greenery raises oxygen
      // Place a city for greenery placement rules
      const spaces = game.board.getAvailableSpacesOnLand(marsBot.player);
      game.simpleAddTile(marsBot.player, spaces[15], {tileType: TileType.CITY});

      const resolver = standaloneMarsBot(game, marsBot.player, marsBot.humanPlayer, makeBoard(layout)).turnResolver;
      resolver.resolveProjectCard(fakeCard({cost: 5, tags: [Tag.BUILDING], type: CardType.AUTOMATED}));

      expect(game.getOxygenLevel()).to.eq(8);
      // Temperature should have increased by 2 (1 step = 2°C from the bonus)
      expect(game.getTemperature()).to.eq(tempBefore + 2);
      // TR: +1 for oxygen + +1 for temperature bonus = 2 more TR
      expect(marsBot.player.terraformRating).to.be.gte(trBefore + 2);
    });
  });

  describe('Multiple tags where one track is maxed (page 5)', () => {
    it('maxed track gets Failed Action, other track still advances', () => {
      const [game, human] = testGame(1);
      const botPlayer = TestPlayer.RED.newPlayer({name: 'bot'});
      botPlayer.game = game;

      const allEmpty = emptyLayout();
      const boardData = THARSIS_MARSBOT_BOARD.map((def) => ({...def, layout: allEmpty}));
      const marsBot = standaloneMarsBot(game, botPlayer, human, boardData);
      const marsBotBoard = marsBot.marsBotBoard;
      const resolver = marsBot.turnResolver;

      // Max out Track 1 (Building)
      for (let i = 0; i < 18; i++) {
        marsBotBoard.tracks[0].advance();
      }
      expect(marsBotBoard.tracks[0].position).to.eq(18);

      resolver.resolveProjectCard(fakeCard({cost: 5, tags: [Tag.BUILDING, Tag.SPACE], type: CardType.AUTOMATED}));

      // Building track maxed → Failed Action (5 MC)
      // Space track should still advance
      expect(marsBot.megacredits).to.eq(5);
      expect(marsBotBoard.tracks[1].position).to.eq(1);
      expect(marsBotBoard.tracks[0].position).to.eq(18); // Unchanged
    });
  });

  describe('MarsBot does not pay for milestones or awards (page 8)', () => {
    it('milestone claim does not deduct MC from megacredits', () => {
      const [game, human] = testGame(1);
      const botPlayer = TestPlayer.RED.newPlayer({name: 'bot'});
      botPlayer.game = game;
      botPlayer.setTerraformRating(35); // Meets Terraformer

      const layout = emptyLayout();
      layout[1] = 'milestone';
      const marsBot = standaloneMarsBot(game, botPlayer, human, makeBoard(layout));
      const resolver = marsBot.turnResolver;
      marsBot.megacredits = 10;

      resolver.resolveProjectCard(fakeCard({cost: 5, tags: [Tag.BUILDING], type: CardType.AUTOMATED}));
      // A Failed Action can raise it when the milestone cannot be claimed.
      expect(marsBot.megacredits).to.be.gte(10);
    });

    it('award funding does not deduct MC from megacredits', () => {
      const [game, human] = testGame(1);
      const botPlayer = TestPlayer.RED.newPlayer({name: 'bot'});
      botPlayer.game = game;

      // Give bot some tiles so it's ahead on Landlord
      const spaces = game.board.getAvailableSpacesOnLand(botPlayer);
      game.simpleAddTile(botPlayer, spaces[5], {tileType: TileType.GREENERY});
      game.simpleAddTile(botPlayer, spaces[10], {tileType: TileType.CITY});

      const layout = emptyLayout();
      layout[1] = 'award';
      const marsBot = standaloneMarsBot(game, botPlayer, human, makeBoard(layout));
      const resolver = marsBot.turnResolver;
      marsBot.megacredits = 10;

      resolver.resolveProjectCard(fakeCard({cost: 5, tags: [Tag.BUILDING], type: CardType.AUTOMATED}));
      expect(marsBot.megacredits).to.be.gte(10);
    });
  });

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

  describe('Card goes to the played pile after resolution (page 5)', () => {
    it("project card goes to MarsBot's played pile, not the project discard pile", () => {
      const {game, marsBot} = createAutomaGame();
      const discardBefore = game.projectDeck.discardPile.length;

      const card = fakeCard({cost: 5, tags: [Tag.BUILDING], type: CardType.AUTOMATED});
      marsBot.resolveProjectCard(card);

      expect(game.projectDeck.discardPile.length).to.eq(discardBefore);
      expect(marsBot.playedProjectCards).to.include(card);
    });
  });

  describe('Temperature heat bonuses (page 9)', () => {
    it('MarsBot gets 2 MC at -20C bonus', () => {
      const {game, marsBot} = createAutomaGame();
      setTemperature(game, -22); // 1 step below -20

      const mcBefore = marsBot.megacredits;
      game.increaseTemperature(marsBot.player, 1);
      // Should cross -20, giving 2 MC
      expect(marsBot.megacredits).to.eq(mcBefore + 2);
    });

    it('MarsBot gets 2 MC at both -24C and -20C when raising 3 steps', () => {
      const {game, marsBot} = createAutomaGame();
      setTemperature(game, -26); // Raising 3 steps: -26 → -20, crosses both -24 and -20

      const mcBefore = marsBot.megacredits;
      game.increaseTemperature(marsBot.player, 3);
      // Crosses both -24 and -20, giving 2 MC each = 4 MC total
      expect(marsBot.megacredits).to.eq(mcBefore + 4);
    });
  });

  describe('Research phase deck building (page 4)', () => {
    it('action deck has exactly 4 cards after research (normal)', () => {
      const {marsBot} = createAutomaGame();
      marsBot.actionDeck.buildResearch();
      expect(marsBot.actionDeck.cards.length).to.eq(4);
    });

    it('action deck has exactly 5 cards after research (brutal)', () => {
      const {marsBot} = createAutomaGame('brutal');
      marsBot.actionDeck.buildResearch();
      expect(marsBot.actionDeck.cards.length).to.eq(5);
    });

    it('bonus deck reshuffles automatically when draw pile exhausted', () => {
      const {game, marsBot} = createAutomaGame();
      // 7 in draw pile (1 used for initial action deck), 0 in discard
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

  describe('Destroyed bonus cards (page 6)', () => {
    it('a card that is never discarded does not return after reshuffle', () => {
      const {game, marsBot} = createAutomaGame();
      // A destroyed card is simply never discarded (the resolver skips the discard),
      // so it can never be reshuffled back into the deck.
      const removed = marsBot.bonusDeck.draw(game)!.name;

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
        reshuffled.push(c.name);
        marsBot.bonusDeck.discard(c);
      }

      expect(reshuffled).to.not.include(removed);
    });
  });

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
      const standalone = standaloneMarsBot(game, marsBot.player, human, makeBoard(layout));
      const resolver = standalone.turnResolver;

      resolver.resolveProjectCard(fakeCard({cost: 5, tags: [Tag.BUILDING], type: CardType.AUTOMATED}));

      const terraformer = game.milestones.find((m) => m.name === 'Terraformer')!;
      expect(game.claimedMilestones).deep.eq([{player: marsBot.player, milestone: terraformer}]);
    });
  });

  describe('Event cards inject Event tag (page 5)', () => {
    it('event card with Building tag advances both Building and Event tracks', () => {
      const [game, human] = testGame(1);
      const botPlayer = TestPlayer.RED.newPlayer({name: 'bot'});
      botPlayer.game = game;

      const allEmpty = emptyLayout();
      const boardData = THARSIS_MARSBOT_BOARD.map((def) => ({...def, layout: allEmpty}));
      const marsBot = standaloneMarsBot(game, botPlayer, human, boardData);
      const marsBotBoard = marsBot.marsBotBoard;
      const resolver = marsBot.turnResolver;

      resolver.resolveProjectCard(fakeCard({cost: 5, tags: [Tag.BUILDING], type: CardType.EVENT}));

      expect(marsBotBoard.tracks[0].position).to.eq(1); // Building
      expect(marsBotBoard.tracks[2].position).to.eq(1); // Event (injected)
    });

    it('event card with NO explicit tags still advances Event track', () => {
      const [game, human] = testGame(1);
      const botPlayer = TestPlayer.RED.newPlayer({name: 'bot'});
      botPlayer.game = game;

      const allEmpty = emptyLayout();
      const boardData = THARSIS_MARSBOT_BOARD.map((def) => ({...def, layout: allEmpty}));
      const marsBot = standaloneMarsBot(game, botPlayer, human, boardData);
      const marsBotBoard = marsBot.marsBotBoard;
      const resolver = marsBot.turnResolver;

      // Event card with zero explicit tags — should NOT be a failed action
      resolver.resolveProjectCard(fakeCard({cost: 5, tags: [], type: CardType.EVENT}));

      expect(marsBotBoard.tracks[2].position).to.eq(1); // Event tag injected
      expect(marsBot.megacredits).to.eq(0); // Not a failed action
    });
  });

  describe('MC to VP rulebook example (page 10)', () => {
    it('example: gen 14, 24 MC → 4 VP (1 per 6 MC)', () => {
      const {game, marsBot} = createAutomaGame();
      game.generation = 14;
      marsBot.megacredits = 24;
      game.phase = 'end';

      const vp = marsBot.getVictoryPoints();
      expect(vp.mcToVP).to.eq(4); // floor(24/6) = 4
    });

    it('example: gen 16, 24 MC → 6 VP (1 per 4 MC)', () => {
      const {game, marsBot} = createAutomaGame();
      game.generation = 16;
      marsBot.megacredits = 24;
      game.phase = 'end';

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
      marsBot.megacredits = 30;
      marsBot.actionDeck.cards = [
        fakeCard({cost: 5, tags: [Tag.MICROBE], type: CardType.AUTOMATED}),
        fakeCard({cost: 5, tags: [Tag.MICROBE], type: CardType.AUTOMATED}),
        fakeCard({cost: 5, tags: [Tag.MICROBE], type: CardType.AUTOMATED}),
      ];
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
      marsBot.actionDeck.cards = [fakeCard({cost: 5, tags: [Tag.MICROBE], type: CardType.AUTOMATED})];
      const before = game.claimedMilestones.length;
      marsBot.takeTurn();
      expect(claimedWhenResolving[3]).to.eq(before + 1);
    });

    it('does not claim on the first turn when MarsBot has less than 8 MC', () => {
      const {game, marsBot} = createAutomaGame('hard');
      qualifyForThree(marsBot);
      marsBot.megacredits = 7;
      marsBot.actionDeck.cards = [fakeCard({cost: 5, tags: [Tag.MICROBE], type: CardType.AUTOMATED})];
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
      marsBot.megacredits = 8;
      marsBot.actionDeck.cards = [fakeCard({cost: 5, tags: [Tag.MICROBE], type: CardType.AUTOMATED})];
      marsBot.turnResolver.resolveProjectCard = () => {};

      marsBot.takeTurn();

      const gardener = game.milestones.find((m) => m.name === 'Gardener')!;
      expect(game.claimedMilestones[0].milestone).to.eq(gardener);
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

      const picked = selectMilestone(marsBot, claimableOf(game, 'Terraformer', 'Mayor'));

      expect(picked?.name).to.eq('Mayor');
    });

    it('counts Planner by cards in hand', () => {
      const {game, human, marsBot} = createAutomaGame();
      human.setTerraformRating(30); // 5 from Terraformer
      human.cardsInHand = Array.from({length: 14}, () => fakeCard()); // 2 from Planner
      human.playedCards.push(fakeCard(), fakeCard(), fakeCard(), fakeCard());

      const picked = selectMilestone(marsBot, claimableOf(game, 'Terraformer', 'Planner'));

      expect(picked?.name).to.eq('Planner');
    });

    it('measures Terraformer against 26 with Turmoil', () => {
      const [game, human] = testGame(1, {automa: true, boardName: BoardName.THARSIS, turmoilExtension: true});
      human.setTerraformRating(25);

      const terraformer = game.milestones.find((m) => m.name === 'Terraformer')!;

      expect(terraformer.stepsToMeet?.(human)).to.eq(1);
    });
  });

  describe('Random placement tiebreak counts from the first space (page 9)', () => {
    function pick(cost: number, count: number): number {
      const {game, human, marsBot} = createAutomaGame();
      const tilePlacer = new MarsBotTilePlacer(marsBot);
      const spaces = game.board.getAvailableSpacesOnLand(human).slice(0, count);
      game.projectDeck.drawOrThrow = () => fakeCard({cost});
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
      const card = fakeCard({cost: 5, tags: [Tag.MICROBE], type: CardType.AUTOMATED});
      marsBot.actionDeck.cards = [card];

      marsBot.takeTurn();

      expect(marsBot.playedProjectCards).deep.eq([card]);
    });

    it('records cards resolved by corporation effects', () => {
      const {marsBot} = createAutomaGame();

      marsBot.maybeDrawAndResolveProjectCard();
      marsBot.maybeDrawAndResolveProjectCardFirstTagOnly();

      expect(marsBot.playedProjectCards).to.have.length(2);
    });
  });

  describe('Placement bonuses for every tile (page 9)', () => {
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
      const placementMC = marsBot['tilePlacer'].getTotalPlacementMC(greenery);
      expect(marsBot.megacredits).to.eq(placementMC);
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
      expect(marsBot.megacredits).to.eq(FAILED_ACTION_MC);
    });

    it('oxygen reaching 8% raises the temperature when it can', () => {
      const {game, marsBot} = createAutomaGame();
      setOxygenLevel(game, 7);

      game.increaseOxygenLevel(marsBot.player, 1);

      expect(game.getTemperature()).to.eq(-28);
      expect(marsBot.megacredits).to.eq(0);
    });

    it('the player gets nothing', () => {
      const {game, human, marsBot} = createAutomaGame();
      setOxygenLevel(game, 7);
      setTemperature(game, MAX_TEMPERATURE);

      game.increaseOxygenLevel(human, 1);

      expect(marsBot.megacredits).to.eq(0);
    });

    it('temperature reaching 0C with every ocean placed', () => {
      const {game, marsBot} = createAutomaGame();
      maxOutOceans(marsBot.player);
      setTemperature(game, -2);

      game.increaseTemperature(marsBot.player, 1);

      expect(marsBot.megacredits).to.eq(FAILED_ACTION_MC);
    });
  });

  // The Venus 8% card bonus is 2 M€ for MarsBot, like the heat production bonus on the
  // temperature track (BGG 3358342 TDaver, 3424237 and 3733436 njshaw2)
  describe('Venus 8% card bonus', () => {
    function venusGame() {
      const [game] = testGame(1, {automa: true, venusNextExtension: true, boardName: BoardName.THARSIS});
      const marsBot = game.automaHooks!.marsBot;
      setVenusScaleLevel(game, 6);
      return {game, marsBot, hand: marsBot.player.cardsInHand.length, deck: game.projectDeck.drawPile.length};
    }

    it('gains MarsBot 2 M€ instead of a card', () => {
      const {game, marsBot, hand, deck} = venusGame();

      marsBot.turnResolver['raiseVenus'](1);

      expect(game.getVenusScaleLevel()).to.eq(8);
      expect(marsBot.megacredits).to.eq(2);
      expect(marsBot.player.cardsInHand).has.length(hand);
      expect(game.projectDeck.drawPile).has.length(deck);
    });
  });
});
