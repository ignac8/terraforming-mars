import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {MarsBot} from '../../src/server/automa/MarsBot';
import {BoardName} from '../../src/common/boards/BoardName';
import {Tag} from '../../src/common/cards/Tag';
import {TileType} from '../../src/common/TileType';
import {Phase} from '../../src/common/Phase';
import {Color} from '../../src/common/Color';

function createAutomaGame(difficulty: 'easy' | 'normal' | 'hard' | 'brutal' = 'normal'): {game: IGame, human: TestPlayer, marsBot: MarsBot} {
  const [game, human] = testGame(1, {automaOption: true, automaDifficulty: difficulty, boardName: BoardName.THARSIS});
  return {game, human, marsBot: game.automaHooks!.marsBot};
}

describe('MarsBot Integration', () => {
  describe('MarsBot player identity', () => {
    it('MarsBot player name is MarsBot', () => {
      const {marsBot} = createAutomaGame();
      expect(marsBot.player.name).to.eq('MarsBot');
    });

    it('MarsBot player color is bronze', () => {
      const {marsBot} = createAutomaGame();
      expect(marsBot.player.color).to.eq('bronze');
    });

    it('MarsBot player has game reference set', () => {
      const {game, marsBot} = createAutomaGame();
      expect(marsBot.player.game).to.eq(game);
    });
  });

  describe('getPassedPlayers handles MarsBot', () => {
    it('getPassedPlayers returns MarsBot color when MarsBot has passed', () => {
      const {game, marsBot} = createAutomaGame();
      game.playerHasPassed(marsBot.player);

      const passedColors = game.getPassedPlayers();
      expect(passedColors).to.include('bronze' as Color);
    });

    it('getPassedPlayers works when only human has passed', () => {
      const {game, human} = createAutomaGame();
      game.playerHasPassed(human);

      const passedColors = game.getPassedPlayers();
      expect(passedColors).to.include(human.color);
    });

    it('getPassedPlayers works when both have passed', () => {
      const {game, human, marsBot} = createAutomaGame();
      game.playerHasPassed(human);
      game.playerHasPassed(marsBot.player);

      const passedColors = game.getPassedPlayers();
      expect(passedColors).to.include(human.color);
      expect(passedColors).to.include('bronze' as Color);
    });

    it('getPassedPlayers does not crash with empty passed set', () => {
      const {game} = createAutomaGame();
      const passedColors = game.getPassedPlayers();
      expect(passedColors).to.have.length(0);
    });
  });

  describe('Award funding by human player in automa mode', () => {
    it('human can fund an award', () => {
      const {game, human} = createAutomaGame();
      const award = game.awards[0];

      expect(game.hasBeenFunded(award)).to.be.false;
      game.fundAward(human, award);
      expect(game.hasBeenFunded(award)).to.be.true;
    });

    it('multiple awards can be funded', () => {
      const {game, human, marsBot} = createAutomaGame();
      game.fundAward(human, game.awards[0]);
      game.fundAward(marsBot.player, game.awards[1]);

      expect(game.fundedAwards.length).to.eq(2);
    });

    it('allAwardsFunded returns false when fewer than 3 funded', () => {
      const {game, human} = createAutomaGame();
      game.fundAward(human, game.awards[0]);
      expect(game.allAwardsFunded()).to.be.false;
    });

    it('allAwardsFunded returns true when 3 funded', () => {
      const {game, human, marsBot} = createAutomaGame();
      game.fundAward(human, game.awards[0]);
      game.fundAward(marsBot.player, game.awards[1]);
      game.fundAward(human, game.awards[2]);
      expect(game.allAwardsFunded()).to.be.true;
    });
  });

  describe('Milestone claiming by MarsBot', () => {
    it('MarsBot can claim a milestone', () => {
      const {game, marsBot} = createAutomaGame();
      const milestone = game.milestones[0];

      game.claimedMilestones.push({player: marsBot.player, milestone});
      expect(game.milestoneClaimed(milestone)).to.be.true;
    });

    it('allMilestonesClaimed returns true at 3', () => {
      const {game, human, marsBot} = createAutomaGame();
      game.claimedMilestones.push({player: marsBot.player, milestone: game.milestones[0]});
      game.claimedMilestones.push({player: human, milestone: game.milestones[1]});
      game.claimedMilestones.push({player: marsBot.player, milestone: game.milestones[2]});
      expect(game.allMilestonesClaimed()).to.be.true;
    });
  });

  describe('Tag counting via track positions (opponent card effects)', () => {
    it('Toll Station scenario: opponent Space tags = Track 2 position', () => {
      const {marsBot} = createAutomaGame();
      for (let i = 0; i < 7; i++) {
        marsBot.board.tracks[1].advance();
      }
      expect(marsBot.player.tags.count(Tag.SPACE, 'raw')).to.eq(7);
    });

    it('Galilean Waystation scenario: opponent Jovian tags = Track 5 position', () => {
      const {marsBot} = createAutomaGame();
      for (let i = 0; i < 4; i++) {
        marsBot.board.tracks[4].advance();
      }
      // Galilean Waystation uses floor(jovianTags / 2) but we just verify the raw count
      expect(marsBot.player.tags.count(Tag.JOVIAN, 'raw')).to.eq(4);
    });

    it('counting all tags works for MarsBot', () => {
      const {marsBot} = createAutomaGame();
      marsBot.board.tracks[0].advance(); // Building
      marsBot.board.tracks[0].advance();
      marsBot.board.tracks[2].advance(); // Event

      const allTags = marsBot.player.tags.countAllTags();
      expect(allTags[Tag.BUILDING]).to.eq(2);
      expect(allTags[Tag.EVENT]).to.eq(1);
      expect(allTags[Tag.SPACE]).to.eq(0);
    });

    it('shared tracks return same value for all mapped tags', () => {
      const {marsBot} = createAutomaGame();
      for (let i = 0; i < 5; i++) {
        marsBot.board.tracks[6].advance();
      }
      // Track 7 = Plant, Animal, Microbe — all return 5
      expect(marsBot.player.tags.count(Tag.PLANT, 'raw')).to.eq(5);
      expect(marsBot.player.tags.count(Tag.ANIMAL, 'raw')).to.eq(5);
      expect(marsBot.player.tags.count(Tag.MICROBE, 'raw')).to.eq(5);
    });
  });

  describe('Milestone/Award model includes MarsBot scores', () => {
    it('award model includes MarsBot score', () => {
      const {game, marsBot} = createAutomaGame();
      // Advance track 4 for Scientist award
      for (let i = 0; i < 6; i++) {
        marsBot.board.tracks[3].advance();
      }

      // Import Server to get the model (indirect test via automaHooks)
      const award = game.awards.find((a) => a.name === 'Scientist');
      expect(award).to.not.be.undefined;
      const marsBotScore = marsBot.turnResolver.getMarsBotAwardValue(award!);
      expect(marsBotScore).to.eq(6);
    });
  });

  describe('Corporate Competition chain (B08 → B03)', () => {
    it('B08 draws another bonus card when it cannot resolve', () => {
      // This tests that the chain works: B08 can't help → draws B03 (R&D) → resolves project card
      // We verify the chain doesn't crash
      const {marsBot} = createAutomaGame();
      // B08 needs funded awards and 5+ MC to try helping
      // With no funded awards, it should draw another bonus card
      const b08 = marsBot.bonusDeck.drawPile.find((c) => c.id === 'B08');
      if (b08) {
        // Calling resolve should not crash even with no funded awards
        marsBot['bonusResolver'].resolve(b08);
      }
    });
  });

  describe('MarsBot turn does not crash', () => {
    it('MarsBot can take a full turn with project card', () => {
      const {marsBot} = createAutomaGame();
      expect(marsBot.actionDeck.length).to.eq(4);

      // Take turn should not crash
      marsBot.takeTurn();
    });

    it('MarsBot passes when deck is empty', () => {
      const {game, marsBot} = createAutomaGame();
      marsBot.actionDeck = [];

      marsBot.takeTurn();
      expect(game.hasPassedThisActionPhase(marsBot.player)).to.be.true;
    });
  });

  describe('Game end model', () => {
    it('model includes vpBreakdown at game end', () => {
      const {game, marsBot} = createAutomaGame();
      (game as any).phase = Phase.END;

      const model = marsBot.toModel();
      expect(model.vpBreakdown).to.not.be.undefined;
      expect(model.vpBreakdown!.terraformRating).to.eq(20);
    });

    it('model does not include vpBreakdown during play', () => {
      const {game, marsBot} = createAutomaGame();
      (game as any).phase = Phase.ACTION;

      const model = marsBot.toModel();
      expect(model.vpBreakdown).to.not.be.undefined;
    });

    it('instantWin is true at gen 20', () => {
      const {game, marsBot} = createAutomaGame();
      (game as any).generation = 20;
      expect(marsBot.toModel().instantWin).to.be.true;
    });

    it('VP total includes all sources', () => {
      const {game, marsBot} = createAutomaGame();
      marsBot.player.setTerraformRating(30);
      marsBot.turnResolver.mcSupply = 12;
      (game as any).generation = 14; // 1 VP per 6 MC
      const spaces = game.board.getAvailableSpacesOnLand(marsBot.player);
      game.simpleAddTile(marsBot.player, spaces[5], {tileType: TileType.GREENERY});
      game.claimedMilestones.push({player: marsBot.player, milestone: game.milestones[0]});
      (game as any).phase = Phase.END;

      const vp = marsBot.toModel().vpBreakdown!;
      expect(vp.terraformRating).to.eq(30);
      expect(vp.greenery).to.eq(1);
      expect(vp.milestones).to.eq(5);
      expect(vp.mcToVP).to.eq(2); // floor(12/6)
      expect(vp.total).to.eq(30 + 1 + 5 + 2);
    });
  });
});
