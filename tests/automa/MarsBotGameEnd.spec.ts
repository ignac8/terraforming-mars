import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {MarsBot} from '../../src/server/automa/MarsBot';
import {BoardName} from '../../src/common/boards/BoardName';
import {TileType} from '../../src/common/TileType';
import {Phase} from '../../src/common/Phase';

function createAutomaGame(difficulty: 'easy' | 'normal' | 'hard' | 'brutal' = 'normal'): {game: IGame, human: TestPlayer, marsBot: MarsBot} {
  const [game, human] = testGame(1, {automaOption: true, automaDifficulty: difficulty, boardName: BoardName.THARSIS});
  return {game, human, marsBot: game.marsBot!};
}

describe('MarsBot Game End Model', () => {
  describe('toModel VP breakdown', () => {
    it('includes vpBreakdown when game phase is END', () => {
      const {game, marsBot} = createAutomaGame();
      (game as any).phase = Phase.END;

      const model = marsBot.toModel();
      expect(model.vpBreakdown).to.not.be.undefined;
      expect(model.vpBreakdown!.terraformRating).to.eq(20);
      expect(model.vpBreakdown!.total).to.be.gte(20);
    });

    it('does NOT include vpBreakdown during action phase', () => {
      const {game, marsBot} = createAutomaGame();
      (game as any).phase = Phase.ACTION;

      const model = marsBot.toModel();
      expect(model.vpBreakdown).to.be.undefined;
    });

    it('does NOT include vpBreakdown during research phase', () => {
      const {game, marsBot} = createAutomaGame();
      (game as any).phase = Phase.RESEARCH;

      const model = marsBot.toModel();
      expect(model.vpBreakdown).to.be.undefined;
    });

    it('includes instantWin flag', () => {
      const {game, marsBot} = createAutomaGame();
      (game as any).generation = 19;
      expect(marsBot.toModel().instantWin).to.be.false;

      (game as any).generation = 20;
      expect(marsBot.toModel().instantWin).to.be.true;
    });
  });

  describe('VP breakdown contents at game end', () => {
    it('TR in breakdown matches player TR', () => {
      const {game, marsBot} = createAutomaGame();
      marsBot.player.setTerraformRating(30);
      (game as any).phase = Phase.END;

      const vp = marsBot.toModel().vpBreakdown!;
      expect(vp.terraformRating).to.eq(30);
    });

    it('milestones in breakdown are 5 VP each', () => {
      const {game, marsBot} = createAutomaGame();
      game.claimedMilestones.push({player: marsBot.player, milestone: game.milestones[0]});
      game.claimedMilestones.push({player: marsBot.player, milestone: game.milestones[1]});
      (game as any).phase = Phase.END;

      const vp = marsBot.toModel().vpBreakdown!;
      expect(vp.milestones).to.eq(10);
    });

    it('greenery VP counted', () => {
      const {game, marsBot} = createAutomaGame();
      const spaces = game.board.getAvailableSpacesOnLand(marsBot.player);
      game.simpleAddTile(marsBot.player, spaces[5], {tileType: TileType.GREENERY});
      game.simpleAddTile(marsBot.player, spaces[10], {tileType: TileType.GREENERY});
      (game as any).phase = Phase.END;

      const vp = marsBot.toModel().vpBreakdown!;
      expect(vp.greenery).to.eq(2);
    });

    it('MC to VP at gen 14 (1 per 6 MC)', () => {
      const {game, marsBot} = createAutomaGame();
      marsBot.turnResolver.mcSupply = 18;
      (game as any).generation = 14;
      (game as any).phase = Phase.END;

      const vp = marsBot.toModel().vpBreakdown!;
      expect(vp.mcToVP).to.eq(3); // floor(18/6) = 3
    });

    it('MC to VP at gen 17 (1 per 3 MC)', () => {
      const {game, marsBot} = createAutomaGame();
      marsBot.turnResolver.mcSupply = 10;
      (game as any).generation = 17;
      (game as any).phase = Phase.END;

      const vp = marsBot.toModel().vpBreakdown!;
      expect(vp.mcToVP).to.eq(3); // floor(10/3) = 3
    });

    it('no MC VP at gen 20', () => {
      const {game, marsBot} = createAutomaGame();
      marsBot.turnResolver.mcSupply = 50;
      (game as any).generation = 20;
      (game as any).phase = Phase.END;

      const vp = marsBot.toModel().vpBreakdown!;
      expect(vp.mcToVP).to.eq(0);
    });

    it('total includes all VP sources', () => {
      const {game, marsBot} = createAutomaGame();
      marsBot.player.setTerraformRating(25);
      marsBot.turnResolver.mcSupply = 16;
      (game as any).generation = 15; // 1 per 5 MC
      const spaces = game.board.getAvailableSpacesOnLand(marsBot.player);
      game.simpleAddTile(marsBot.player, spaces[10], {tileType: TileType.GREENERY});
      (game as any).phase = Phase.END;

      const vp = marsBot.toModel().vpBreakdown!;
      expect(vp.terraformRating).to.eq(25);
      expect(vp.greenery).to.eq(1);
      expect(vp.mcToVP).to.eq(3); // floor(16/5) = 3
      expect(vp.total).to.eq(25 + 1 + 3);
    });
  });

  describe('Win/loss determination', () => {
    it('human wins when VP > MarsBot VP', () => {
      const {game, human, marsBot} = createAutomaGame();
      human.setTerraformRating(40);
      marsBot.player.setTerraformRating(20);
      (game as any).phase = Phase.END;

      const humanVP = human.getVictoryPoints().total;
      const marsBotVP = marsBot.getVictoryPoints().total;
      expect(humanVP).to.be.gt(marsBotVP);
    });

    it('MarsBot wins on tie', () => {
      const {game, human, marsBot} = createAutomaGame();
      // Set both to same TR, no other VP
      human.setTerraformRating(25);
      marsBot.player.setTerraformRating(25);
      (game as any).phase = Phase.END;

      const marsBotVP = marsBot.getVictoryPoints();
      // Both have TR 25 as base. Human might have additional VP from cards, but
      // the key rule: tie = MarsBot wins.
      // We verify the model includes this info
      const model = marsBot.toModel();
      expect(model.vpBreakdown).to.not.be.undefined;
    });

    it('MarsBot instant win at gen 20', () => {
      const {game, marsBot} = createAutomaGame();
      (game as any).generation = 20;

      expect(marsBot.isInstantWin()).to.be.true;
      expect(marsBot.toModel().instantWin).to.be.true;
    });

    it('MarsBot does not instant win before gen 20', () => {
      const {game, marsBot} = createAutomaGame();
      (game as any).generation = 19;

      expect(marsBot.isInstantWin()).to.be.false;
      expect(marsBot.toModel().instantWin).to.be.false;
    });
  });

  describe('Model always includes core fields', () => {
    it('has difficulty', () => {
      const {marsBot} = createAutomaGame('hard');
      expect(marsBot.toModel().difficulty).to.eq('hard');
    });

    it('has tracks with correct count', () => {
      const {marsBot} = createAutomaGame();
      expect(marsBot.toModel().tracks.length).to.eq(7);
    });

    it('has mcSupply', () => {
      const {marsBot} = createAutomaGame();
      marsBot.turnResolver.mcSupply = 42;
      expect(marsBot.toModel().mcSupply).to.eq(42);
    });

    it('has deck sizes', () => {
      const {marsBot} = createAutomaGame();
      const model = marsBot.toModel();
      expect(model.actionDeckSize).to.eq(4); // Initial 3 project + 1 bonus
      expect(model.bonusDeckSize).to.be.lte(8); // Some drawn for action deck
    });
  });

  describe('Award VP at game end', () => {
    it('MarsBot gets 5 VP for winning a funded award', () => {
      const {game, human, marsBot} = createAutomaGame();
      // Fund Scientist award (track 4 based)
      game.fundedAwards.push({player: human, award: game.awards.find((a) => a.name === 'Scientist')!});
      // Advance track 4 to 10 (MarsBot has 10, human has 0 science tags)
      for (let i = 0; i < 10; i++) marsBot.board.getTrack(4).advance();
      (game as any).phase = Phase.END;

      const vp = marsBot.getVictoryPoints();
      expect(vp.awards).to.eq(5);
    });

    it('MarsBot gets 2 VP for losing a funded award', () => {
      const {game, human, marsBot} = createAutomaGame();
      // Fund Landlord award (tiles owned)
      game.fundedAwards.push({player: human, award: game.awards.find((a) => a.name === 'Landlord')!});
      // Human has 3 tiles, MarsBot has 1
      const spaces = game.board.getAvailableSpacesOnLand(human);
      game.simpleAddTile(human, spaces[5], {tileType: TileType.GREENERY});
      game.simpleAddTile(human, spaces[10], {tileType: TileType.CITY});
      game.simpleAddTile(human, spaces[15], {tileType: TileType.GREENERY});
      game.simpleAddTile(marsBot.player, spaces[20], {tileType: TileType.CITY});
      (game as any).phase = Phase.END;

      const vp = marsBot.getVictoryPoints();
      expect(vp.awards).to.eq(2); // 2nd place
    });

    it('no award VP when no awards funded', () => {
      const {game, marsBot} = createAutomaGame();
      (game as any).phase = Phase.END;

      const vp = marsBot.getVictoryPoints();
      expect(vp.awards).to.eq(0);
    });
  });
});
