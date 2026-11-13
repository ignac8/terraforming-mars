import {expect} from 'chai';
import {BonusCardId, MARSBOT_STARTING_TR} from '@/common/automa/AutomaTypes';
import {BoardName} from '@/common/boards/BoardName';
import {CardName} from '@/common/cards/CardName';
import {Tag} from '@/common/cards/Tag';
import {MarsBot} from '@/server/automa/MarsBot';
import {createBaseBonusCards} from '@/server/automa/MarsBotBonusCard';
import {getMarsBotCorp} from '@/server/automa/corps/MarsBotCorpRegistry';
import {NIRGAL_ENTERPRISES_MARSBOT_CORP} from '@/server/automa/corps/prelude2/NirgalEnterprisesMarsBot';
import {TERRALABS_RESEARCH_MARSBOT_CORP} from '@/server/automa/corps/turmoil/TerralabsResearchMarsBot';
import {Mine} from '@/server/cards/base/Mine';
import {testGame} from '../TestGame';
import {createAutomaGame, resetCorpRegistry} from './corps/CorpGame';
import {recordingMarsBot} from './corps/RecordingMarsBot';

function recorder(boardName: BoardName, generation: number) {
  const [game] = testGame(1, {boardName});
  game.generation = generation;
  return recordingMarsBot({game});
}

function amazonisGame() {
  return createAutomaGame({boardName: BoardName.AMAZONIS_PLANITIA});
}

function track(marsBot: MarsBot, tag: Tag): number {
  return marsBot.marsBotBoard.tagToTrack[tag]!;
}

describe('MarsBotAmazonisRules', () => {
  beforeEach(resetCorpRegistry);

  describe('Terralabs', () => {
    for (const run of [
      {boardName: BoardName.AMAZONIS_PLANITIA, generation: 9, count: 1},
      {boardName: BoardName.AMAZONIS_PLANITIA, generation: 10, count: 2},
      {boardName: BoardName.THARSIS, generation: 9, count: 2},
    ]) {
      it(`draws ${run.count} card(s) in generation ${run.generation} on ${run.boardName}`, () => {
        const {marsBot, calls} = recorder(run.boardName, run.generation);

        TERRALABS_RESEARCH_MARSBOT_CORP.beforeActionPhase!(marsBot);

        expect(calls).deep.eq([`drawProjectCardsToActionDeck(${run.count})`]);
      });
    }
  });

  describe('Overachievement', () => {
    function resolveOverachievement(generation: number) {
      const {game, marsBot} = amazonisGame();
      game.generation = generation;
      marsBot.turnResolver.marsBotMeetsMilestone = () => false;
      marsBot.turnResolver.getMarsBotAwardValue = () => 10;
      for (const award of game.awards) {
        award.getScore = () => 0;
      }
      const b04 = createBaseBonusCards().find((c) => c.id === BonusCardId.B04_OVERACHIEVEMENT)!;

      marsBot['bonusResolver'].resolve(b04);

      return {game, marsBot};
    }

    it('funds an award from generation 7', () => {
      const {game} = resolveOverachievement(7);

      expect(game.fundedAwards).has.length(1);
    });

    it('funds no award in generation 6 and takes 5 M€ instead', () => {
      const {game, marsBot} = resolveOverachievement(6);

      expect(game.fundedAwards).is.empty;
      expect(marsBot.turnResolver.megacredits).eq(5);
    });
  });

  describe('Nirgal Enterprises', () => {
    const milestone = 'maybeClaimMilestone()';
    const award = 'maybeFundAward()';
    for (const [generation, expected] of [
      [1, []], [2, [milestone]], [6, [milestone]], [7, [award]], [10, [award]], [11, [milestone]],
    ] as const) {
      it(`claims a milestone in generations 2 to 6 and from 11, and funds an award in 7 to 10, generation ${generation}`, () => {
        const {marsBot, calls} = recorder(BoardName.AMAZONIS_PLANITIA, generation);

        NIRGAL_ENTERPRISES_MARSBOT_CORP.beforeActionPhase!(marsBot);

        expect(calls).deep.eq(expected);
      });
    }

    it('funds an award rather than claim a milestone in generation 10', () => {
      const {game, marsBot} = amazonisGame();
      marsBot.corp = getMarsBotCorp(CardName.NIRGAL_ENTERPRISES)!;
      marsBot.turnResolver.marsBotMeetsMilestone = () => true;
      marsBot.turnResolver.getMarsBotAwardValue = () => 10;
      for (const award of game.awards) {
        award.getScore = () => 0;
      }
      game.generation = 10;

      marsBot.corp.beforeActionPhase!(marsBot);

      expect(game.fundedAwards).has.length(1);
      expect(game.claimedMilestones).is.empty;
    });

    it('claims a milestone in generation 6 and funds no award', () => {
      const {game, marsBot} = amazonisGame();
      marsBot.corp = getMarsBotCorp(CardName.NIRGAL_ENTERPRISES)!;
      marsBot.turnResolver.marsBotMeetsMilestone = () => true;
      marsBot.turnResolver.getMarsBotAwardValue = () => 10;
      game.generation = 6;

      marsBot.corp.beforeActionPhase!(marsBot);

      expect(game.claimedMilestones).has.length(1);
      expect(game.fundedAwards).is.empty;
    });
  });

  describe('starting TR with Turmoil', () => {
    for (const run of [
      {boardName: BoardName.AMAZONIS_PLANITIA, reduction: 10, expected: 9},
      {boardName: BoardName.AMAZONIS_PLANITIA, reduction: 7, expected: 12},
      {boardName: BoardName.THARSIS, reduction: 10, expected: 10},
      {boardName: BoardName.THARSIS, reduction: 7, expected: 13},
    ] as const) {
      it(`starts MarsBot at ${run.expected} TR with reduction ${run.reduction} on ${run.boardName}`, () => {
        const [game] = testGame(1, {
          automa: true,
          turmoilExtension: true,
          boardName: run.boardName,
          automaTurmoilTRReduction: run.reduction,
        });

        expect(game.automaHooks!.marsBot.player.terraformRating).eq(run.expected);
      });
    }

    it('starts MarsBot at 20 TR on Amazonis Planitia without Turmoil', () => {
      const [game] = testGame(1, {automa: true, boardName: BoardName.AMAZONIS_PLANITIA});

      expect(game.automaHooks!.marsBot.player.terraformRating).eq(MARSBOT_STARTING_TR);
    });
  });

  describe('Corporate Competition', () => {
    function helper(marsBot: MarsBot, awardName: string): boolean {
      return marsBot['bonusResolver']['tryHelperAction'](awardName);
    }

    /** Funds the award for the player, which leads it by 1, and gives MarsBot 10 M€. */
    function competeFor(awardName: string) {
      const {game, human, marsBot} = amazonisGame();
      marsBot.turnResolver.megacredits = 10;
      const award = game.awards.find((a) => a.name === awardName)!;
      game.fundAward(human, award);
      award.getScore = () => 11;
      marsBot.turnResolver.getMarsBotAwardValue = () => 10;
      const b08 = createBaseBonusCards().find((c) => c.id === BonusCardId.B08_CORPORATE_COMPETITION)!;
      return {game, marsBot, b08};
    }

    it('Physicist advances the less advanced of the Science and Space tracks', () => {
      const {marsBot} = amazonisGame();
      const science = track(marsBot, Tag.SCIENCE);
      const space = track(marsBot, Tag.SPACE);
      marsBot.marsBotBoard.tracks[science].position = 3;
      marsBot.marsBotBoard.tracks[space].position = 5;

      expect(helper(marsBot, 'Physicist')).is.true;
      expect(marsBot.marsBotBoard.tracks[science].position).eq(4);
      expect(marsBot.marsBotBoard.tracks[space].position).eq(5);

      marsBot.marsBotBoard.tracks[science].position = 6;
      expect(helper(marsBot, 'Physicist')).is.true;
      expect(marsBot.marsBotBoard.tracks[science].position).eq(6);
      expect(marsBot.marsBotBoard.tracks[space].position).eq(6);
    });

    it('Innovator flips a project card and plays it', () => {
      const {game, marsBot} = amazonisGame();
      const mine = new Mine();
      game.projectDeck.drawPile.push(mine);

      expect(helper(marsBot, 'Innovator')).is.true;

      expect(marsBot.playedProjectCards).to.include(mine);
    });

    it('a funded Physicist makes Corporate Competition push the Space track, the upper of two tied tracks', () => {
      const {marsBot, b08} = competeFor('Physicist');

      marsBot['bonusResolver'].resolve(b08);

      expect(marsBot.marsBotBoard.tracks[track(marsBot, Tag.SPACE)].position).greaterThan(0);
      expect(marsBot.marsBotBoard.tracks[track(marsBot, Tag.SCIENCE)].position).eq(0);
    });

    it('a funded Innovator makes Corporate Competition flip a card', () => {
      const {game, marsBot, b08} = competeFor('Innovator');
      const mine = new Mine();
      game.projectDeck.drawPile.push(mine);

      marsBot['bonusResolver'].resolve(b08);

      expect(marsBot.playedProjectCards).to.include(mine);
    });
  });
});
