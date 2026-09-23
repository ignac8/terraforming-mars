import {expect} from 'chai';
import {testGame} from '../../TestGame';
import {AutomaGameHooks} from '../../../src/server/automa/AutomaGameHooks';
import {MarsBot} from '../../../src/server/automa/MarsBot';
import {ColonyName} from '../../../src/common/colonies/ColonyName';
import {BoardName} from '../../../src/common/boards/BoardName';
import {MarsBotBoard} from '../../../src/server/automa/MarsBotBoard';
import {Tag} from '../../../src/common/cards/Tag';
import {CardName} from '../../../src/common/cards/CardName';
import {getMarsBotCorp} from '../../../src/server/automa/corps/MarsBotCorpRegistry';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {cast} from '../../../src/common/utils/utils';

function getMarsBot(game: ReturnType<typeof testGame>[0]): MarsBot {
  return (game.automaHooks as AutomaGameHooks).marsBot;
}

describe('FloaterHandling (C-8, C-9, C-14, C-X2)', () => {
  describe('C-14: floater track action without Venus Next', () => {
    it('adds to Titan storage instead of floaters (1 floater)', () => {
      const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const titanBefore = marsBot.shippingBoard.get(ColonyName.TITAN);
      const floatersBefore = marsBot.floaters;

      marsBot.turnResolver['resolveTrackAction']('floater', 0);

      expect(marsBot.shippingBoard.get(ColonyName.TITAN)).to.eq(titanBefore + 1);
      expect(marsBot.floaters).to.eq(floatersBefore); // No change to floaters
    });

    it('adds to Titan storage instead of floaters (2 floaters)', () => {
      const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const titanBefore = marsBot.shippingBoard.get(ColonyName.TITAN);

      marsBot.turnResolver['resolveTrackAction']('floater2', 0);

      expect(marsBot.shippingBoard.get(ColonyName.TITAN)).to.eq(titanBefore + 2);
    });

    it('C-13: without Venus or Colonies, floater track action is ignored', () => {
      const [game] = testGame(1, {automaOption: true, coloniesExtension: false, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const titanBefore = marsBot.shippingBoard.get(ColonyName.TITAN);
      const floatersBefore = marsBot.floaters;

      marsBot.turnResolver['resolveTrackAction']('floater', 0);

      expect(marsBot.shippingBoard.get(ColonyName.TITAN)).to.eq(titanBefore);
      expect(marsBot.floaters).to.eq(floatersBefore);
    });
  });

  describe('C-8: floater track action with Venus Next', () => {
    it('adds to floaters when Venus Next is active', () => {
      const [game] = testGame(1, {
        automaOption: true,
        coloniesExtension: true,
        venusNextExtension: true,
        boardName: BoardName.THARSIS,
      });
      const marsBot = getMarsBot(game);
      const floatersBefore = marsBot.floaters;
      const titanBefore = marsBot.shippingBoard.get(ColonyName.TITAN);

      marsBot.turnResolver['resolveTrackAction']('floater', 0);

      expect(marsBot.floaters).to.eq(floatersBefore + 1);
      expect(marsBot.shippingBoard.get(ColonyName.TITAN)).to.eq(titanBefore); // No Titan storage
    });
  });

  describe('C-X2: canSpendFloatersForExtraCard with Colonies + no Venus', () => {
    it('spends 5 Titan floaters for an extra card during research phase', () => {
      const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      marsBot.shippingBoard.add(ColonyName.TITAN, 5, marsBot);

      // Trigger research phase (gen 2+)
      game.generation = 2;
      game.automaHooks!.handleResearchPhase();

      // 5 floaters should be spent
      expect(marsBot.shippingBoard.get(ColonyName.TITAN)).to.eq(0);
    });

    it('does not spend floaters when Titan storage has <5 tokens', () => {
      const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      marsBot.shippingBoard.add(ColonyName.TITAN, 3, marsBot);

      game.generation = 2;
      game.automaHooks!.handleResearchPhase();
      // No spending — Titan should remain at 3
      expect(marsBot.shippingBoard.get(ColonyName.TITAN)).to.eq(3);
    });
  });

  describe('C-9: floater spending spends from Titan storage', () => {
    it('deducts 5 from Titan storage when extra card is claimed', () => {
      const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      marsBot.shippingBoard.add(ColonyName.TITAN, 7, marsBot); // 7 floaters in Titan

      game.generation = 2;
      game.automaHooks!.handleResearchPhase();

      // 5 should be spent, leaving 2
      expect(marsBot.shippingBoard.get(ColonyName.TITAN)).to.eq(2);
    });
  });

  describe('C-23: corporation floaters', () => {
    it('go to Titan storage without Venus Next', () => {
      const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const corp = getMarsBotCorp(CardName.CELESTIC)!;

      corp.setup!(marsBot);
      corp.roundStart!(marsBot);

      expect(marsBot.shippingBoard.get(ColonyName.TITAN)).to.eq(2);
      expect(marsBot.floaters).to.eq(0);
    });

    it('go to the floater pool with Venus Next', () => {
      const [game] = testGame(1, {automaOption: true, coloniesExtension: true, venusNextExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const corp = getMarsBotCorp(CardName.CELESTIC)!;

      corp.setup!(marsBot);
      corp.roundStart!(marsBot);

      expect(marsBot.floaters).to.eq(2);
      expect(marsBot.shippingBoard.get(ColonyName.TITAN)).to.eq(0);
    });

    it('are spent from Titan storage without Venus Next', () => {
      const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      marsBot.shippingBoard.add(ColonyName.TITAN, 3, marsBot);

      marsBot.spendFloaters(2);

      expect(marsBot.shippingBoard.get(ColonyName.TITAN)).to.eq(1);
      expect(marsBot.floaters).to.eq(0);
    });

    it('keeping a 4th drafted card spends 5 floaters from Titan storage without Venus Next', () => {
      const [game, human] = testGame(1, {automaOption: true, coloniesExtension: true, draftVariant: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      marsBot.shippingBoard.add(ColonyName.TITAN, 5, marsBot);

      game.gotoResearchPhase();
      for (let round = 0; round < 4; round++) {
        const selectCard = cast(human.getWaitingFor(), SelectCard<IProjectCard>);
        selectCard.cb([selectCard.cards[0]]);
      }

      expect(marsBot.shippingBoard.get(ColonyName.TITAN)).to.eq(0);
      expect(marsBot.floaters).to.eq(0);
    });
  });

  describe('MarsBotShippingBoard.spend()', () => {
    it('deducts from storage without going below 0', () => {
      const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      marsBot.shippingBoard.add(ColonyName.TITAN, 3, marsBot);
      marsBot.shippingBoard.spend(ColonyName.TITAN, 10);
      expect(marsBot.shippingBoard.get(ColonyName.TITAN)).to.eq(0);
    });

    it('reduces storage by the given amount', () => {
      const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      marsBot.shippingBoard.add(ColonyName.TITAN, 5, marsBot);
      marsBot.shippingBoard.spend(ColonyName.TITAN, 2);
      expect(marsBot.shippingBoard.get(ColonyName.TITAN)).to.eq(3);
    });
  });

  describe('C-14: Titan storage overflow NOT triggered for floaters', () => {
    it('Titan storage can hold more than 5 without triggering C-12', () => {
      const [game] = testGame(1, {automaOption: true, coloniesExtension: true, boardName: BoardName.THARSIS});
      const marsBot = getMarsBot(game);
      const board: MarsBotBoard = marsBot.marsBotBoard;
      const eventIdx = board.tagToTrack[Tag.EVENT]!;
      const before = board.tracks[eventIdx].position;

      // Add 6 floaters to Titan (via floater track actions)
      for (let i = 0; i < 6; i++) {
        marsBot.turnResolver['resolveTrackAction']('floater', 0);
      }

      // No track advancement should happen (Titan is exempt from C-12)
      expect(board.tracks[eventIdx].position).to.eq(before);
      expect(marsBot.shippingBoard.get(ColonyName.TITAN)).to.eq(6);
    });
  });
});
