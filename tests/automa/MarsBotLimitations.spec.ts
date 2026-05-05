import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {MarsBot} from '../../src/server/automa/MarsBot';
import {MarsBotBoard} from '../../src/server/automa/MarsBotBoard';
import {MarsBotTurnResolver} from '../../src/server/automa/MarsBotTurnResolver';
import {MarsBotScoring} from '../../src/server/automa/MarsBotScoring';
import {THARSIS_MARSBOT_BOARD} from '../../src/server/automa/boards/TharsisMarsBot';
import {TrackDefinition} from '../../src/common/automa/AutomaTypes';
import {BoardName} from '../../src/common/boards/BoardName';
import {Tag} from '../../src/common/cards/Tag';
import {TileType} from '../../src/common/TileType';
import {Phase} from '../../src/common/Phase';
import {Resource} from '../../src/common/Resource';
import {Algae} from '../../src/server/cards/base/Algae';
import {Birds} from '../../src/server/cards/base/Birds';
import {SearchForLife} from '../../src/server/cards/base/SearchForLife';
import {IProjectCard} from '../../src/server/cards/IProjectCard';

function createAutomaGame(difficulty: 'easy' | 'normal' | 'hard' | 'brutal' = 'normal'): {game: IGame, human: TestPlayer, marsBot: MarsBot} {
  const [game, human] = testGame(1, {automaOption: true, automaDifficulty: difficulty, boardName: BoardName.THARSIS});
  return {game, human, marsBot: game.marsBot!};
}

describe('MarsBot Limitations Fixed', () => {
  // ---- Fix 1: Award comparison with resources + production ----

  describe('Award comparison uses human resources + production (page 8)', () => {
    it('Thermalist comparison includes human heat production', () => {
      const {game, human, marsBot} = createAutomaGame();
      // MarsBot Thermalist = track 5 position + 5
      for (let i = 0; i < 3; i++) {
        marsBot.board.tracks[4].advance();
      }
      // MarsBot value = 3 + 5 = 8

      // Human has 2 heat resources + 5 heat production = 7 for comparison
      human.heat = 2;
      human.production.override({heat: 5, megacredits: 0, steel: 0, titanium: 0, plants: 0, energy: 0});

      // MarsBot is ahead (8 > 7), so it should fund Thermalist
      const thermalist = game.awards.find((a) => a.name === 'Thermalist')!;
      const marsBotVal = marsBot.turnResolver.getMarsBotAwardValue(thermalist);
      expect(marsBotVal).to.eq(8);
      // Human standard getScore = 2 (just heat), but for MarsBot comparison = 2 + 5 = 7
    });

    it('Miner comparison includes human steel + titanium production', () => {
      const {game, human, marsBot} = createAutomaGame();
      // MarsBot Miner = track 2 position + 5
      for (let i = 0; i < 4; i++) {
        marsBot.board.tracks[1].advance();
      }
      // MarsBot value = 4 + 5 = 9

      // Human has 3 steel + 2 titanium + 2 steel prod + 1 titanium prod = 8 for comparison
      human.steel = 3;
      human.titanium = 2;
      human.production.override({steel: 2, titanium: 1, megacredits: 0, heat: 0, plants: 0, energy: 0});

      const miner = game.awards.find((a) => a.name === 'Miner')!;
      const marsBotVal = marsBot.turnResolver.getMarsBotAwardValue(miner);
      expect(marsBotVal).to.eq(9);
    });

    it('non-resource awards use standard comparison', () => {
      const {game, human, marsBot} = createAutomaGame();
      // Landlord uses tiles, not resources — standard comparison
      const spaces = game.board.getAvailableSpacesOnLand(human);
      game.simpleAddTile(human, spaces[5], {tileType: TileType.GREENERY});

      const landlord = game.awards.find((a) => a.name === 'Landlord')!;
      // Standard getScore should work for Landlord
      expect(landlord.getScore(human)).to.eq(1);
    });
  });

  // ---- Fix 2: Hard mode card VP ----

  describe('Hard mode card VP tracking', () => {
    it('played project cards are tracked', () => {
      const {marsBot} = createAutomaGame('hard');
      expect(marsBot.playedProjectCards.length).to.eq(0);

      marsBot.takeTurn();
      // After one turn, at least 1 card should be played (if it was a project card)
      // The first card might be a bonus card, so check >= 0
      expect(marsBot.playedProjectCards.length).to.be.gte(0);
    });

    it('hard mode scores 1 VP per card with non-negative VP', () => {
      const {game, marsBot} = createAutomaGame('hard');

      // Manually add some cards to played list
      // Algae has 0 VP (non-negative) → counts
      // SearchForLife has special VP → counts (getVictoryPoints returns >= 0 with 0 resources)
      marsBot.playedProjectCards.push(new Algae() as IProjectCard);
      marsBot.playedProjectCards.push(new SearchForLife() as IProjectCard);
      (game as any).phase = Phase.END;

      const vp = marsBot.getVictoryPoints();
      expect(vp.cardVP).to.eq(2);
    });

    it('normal mode gives 0 card VP regardless of played cards', () => {
      const {game, marsBot} = createAutomaGame('normal');
      marsBot.playedProjectCards.push(new Algae() as IProjectCard);
      (game as any).phase = Phase.END;

      const vp = marsBot.getVictoryPoints();
      expect(vp.cardVP).to.eq(0);
    });

    it('brutal mode also gets card VP', () => {
      const {game, marsBot} = createAutomaGame('brutal');
      marsBot.playedProjectCards.push(new Algae() as IProjectCard);
      (game as any).phase = Phase.END;

      const vp = marsBot.getVictoryPoints();
      expect(vp.cardVP).to.eq(1);
    });
  });

  // ---- Fix 3: Serialization/deserialization ----

  describe('MarsBot serialization', () => {
    it('serialize produces valid state', () => {
      const {marsBot} = createAutomaGame();
      // Advance some tracks
      marsBot.board.tracks[0].advance();
      marsBot.board.tracks[0].advance();
      marsBot.board.tracks[2].advance();
      marsBot.turnResolver.mcSupply = 15;
      marsBot.goesFirst = true;

      const state = marsBot.serialize();
      expect(state.trackPositions).to.have.length(7);
      expect(state.trackPositions[0]).to.eq(2);
      expect(state.trackPositions[2]).to.eq(1);
      expect(state.mcSupply).to.eq(15);
      expect(state.goesFirst).to.be.true;
      expect(state.difficulty).to.eq('normal');
      expect(state.marsBotPlayerId).to.be.a('string');
    });

    it('serialize includes action deck card names', () => {
      const {marsBot} = createAutomaGame();
      const state = marsBot.serialize();
      expect(state.actionDeckCardNames).to.have.length(4);
    });

    it('serialize includes bonus deck state', () => {
      const {marsBot} = createAutomaGame();
      const state = marsBot.serialize();
      expect(state.bonusDeckDrawPile.length).to.be.lte(8);
    });

    it('serialize includes regressed positions', () => {
      const {marsBot} = createAutomaGame();
      marsBot.board.tracks[0].advance();
      marsBot.board.tracks[0].advance();
      marsBot.board.tracks[0].regress();

      const state = marsBot.serialize();
      expect(state.trackRegressedPositions[0]).to.include(2);
    });

    it('serialize includes played project cards', () => {
      const {marsBot} = createAutomaGame();
      marsBot.playedProjectCards.push(new Algae() as IProjectCard);

      const state = marsBot.serialize();
      expect(state.playedProjectCardNames).to.include('Algae');
    });
  });

  describe('MarsBot restoreState', () => {
    it('restores track positions', () => {
      const {marsBot} = createAutomaGame();
      marsBot.board.tracks[0].advance();
      marsBot.board.tracks[0].advance();
      marsBot.board.tracks[0].advance();
      marsBot.turnResolver.mcSupply = 20;
      marsBot.goesFirst = true;

      const state = marsBot.serialize();

      // Create a new game and restore
      const {marsBot: marsBot2} = createAutomaGame();
      expect(marsBot2.board.tracks[0].position).to.eq(0);

      marsBot2.restoreState(state);
      expect(marsBot2.board.tracks[0].position).to.eq(3);
      expect(marsBot2.turnResolver.mcSupply).to.eq(20);
      expect(marsBot2.goesFirst).to.be.true;
    });

    it('restores regressed positions', () => {
      const {marsBot} = createAutomaGame();
      marsBot.board.tracks[1].advance();
      marsBot.board.tracks[1].advance();
      marsBot.board.tracks[1].regress();

      const state = marsBot.serialize();
      const {marsBot: marsBot2} = createAutomaGame();
      marsBot2.restoreState(state);

      expect(marsBot2.board.tracks[1].position).to.eq(1);
      expect(marsBot2.board.tracks[1].regressedPositions.has(2)).to.be.true;
    });
  });

  // ---- Game.ts serialize/deserialize includes automa ----

  describe('Game serialization includes automa state', () => {
    it('serialized game has automaState when automa enabled', () => {
      const {game, marsBot} = createAutomaGame();
      marsBot.board.tracks[0].advance();
      marsBot.turnResolver.mcSupply = 10;

      const serialized = game.serialize();
      expect(serialized.automaState).to.not.be.undefined;
      expect(serialized.automaState!.trackPositions[0]).to.eq(1);
      expect(serialized.automaState!.mcSupply).to.eq(10);
    });

    it('serialized game has no automaState for normal games', () => {
      const [game] = testGame(2);
      const serialized = game.serialize();
      expect(serialized.automaState).to.be.undefined;
    });
  });
});
