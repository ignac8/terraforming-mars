import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Game} from '../../src/server/Game';
import {Phase} from '../../src/common/Phase';
import {MarsBot} from '../../src/server/automa/MarsBot';
import {BoardName} from '../../src/common/boards/BoardName';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {getMarsBotCorp} from '../../src/server/automa/corps/MarsBotCorpRegistry';
import {CardName} from '../../src/common/cards/CardName';
import {formatMessage} from '../TestingUtils';

function createAutomaGameWithDraft(): {game: IGame, human: TestPlayer, marsBot: MarsBot} {
  const [game, human] = testGame(1, {
    automa: true,
    automaDifficulty: 'normal',
    boardName: BoardName.THARSIS,
    draftVariant: true,
  });
  return {game, human, marsBot: game.automaHooks!.marsBot};
}

function createAutomaGameNoDraft(): {game: IGame, human: TestPlayer, marsBot: MarsBot} {
  const [game, human] = testGame(1, {
    automa: true,
    automaDifficulty: 'normal',
    boardName: BoardName.THARSIS,
    draftVariant: false,
  });
  return {game, human, marsBot: game.automaHooks!.marsBot};
}

describe('MarsBot Draft Variant', () => {
  describe('Non-drafting research (default)', () => {
    it('MarsBot gets 4 cards without draft', () => {
      const {marsBot} = createAutomaGameNoDraft();
      marsBot.actionDeck.buildResearch();
      expect(marsBot.actionDeck.cards.length).to.eq(4);
    });
  });

  describe('Draft research phase', () => {
    it('draft presents SelectCard to human player', () => {
      const {game, human} = createAutomaGameWithDraft();
      game.gotoResearchPhase();

      const waitingFor = human.getWaitingFor();
      expect(waitingFor).to.not.be.undefined;
      expect(waitingFor).to.be.instanceOf(SelectCard);
    });

    it('draft round 1 offers 4 cards', () => {
      const {game, human} = createAutomaGameWithDraft();
      game.gotoResearchPhase();

      const waitingFor = human.getWaitingFor() as SelectCard<IProjectCard>;
      expect(waitingFor.cards.length).to.eq(4);
    });

    it('after picking 1 card, next round offers 3 cards (swapped pile)', () => {
      const {game, human} = createAutomaGameWithDraft();
      game.gotoResearchPhase();

      const round1 = human.getWaitingFor() as SelectCard<IProjectCard>;
      const firstCard = round1.cards[0];

      round1.cb([firstCard]);

      const round2 = human.getWaitingFor() as SelectCard<IProjectCard>;
      expect(round2).to.not.be.undefined;
      expect(round2.cards.length).to.eq(3);
    });

    it('after 4 rounds of picking, human has buy phase', () => {
      const {game, human} = createAutomaGameWithDraft();
      game.gotoResearchPhase();

      for (let round = 0; round < 4; round++) {
        const selectCard = human.getWaitingFor() as SelectCard<IProjectCard>;
        expect(selectCard).to.not.be.undefined;
        expect(selectCard.cards.length).to.eq(4 - round);
        selectCard.cb([selectCard.cards[0]]);
      }

      const buyPhase = human.getWaitingFor();
      expect(buyPhase).to.not.be.undefined;
    });

    it('MarsBot gets 4 drafted cards → 3 kept + 1 bonus = 4 action deck', () => {
      const {game, human, marsBot} = createAutomaGameWithDraft();
      game.gotoResearchPhase();

      for (let round = 0; round < 4; round++) {
        const selectCard = human.getWaitingFor() as SelectCard<IProjectCard>;
        selectCard.cb([selectCard.cards[0]]);
      }

      // 4 drafted cards, 1 discarded, plus 1 bonus card.
      expect(marsBot.actionDeck.cards.length).to.eq(4);
    });

    it('project deck reduces by 8 cards (two piles of 4)', () => {
      const {game} = createAutomaGameWithDraft();
      const deckSizeBefore = game.projectDeck.drawPile.length;

      game.gotoResearchPhase();

      const totalDrawn = deckSizeBefore - game.projectDeck.drawPile.length;
      expect(totalDrawn).to.eq(8);
    });

    it('MarsBot discards 1 drafted card to project discard', () => {
      const {game, human} = createAutomaGameWithDraft();
      const discardBefore = game.projectDeck.discardPile.length;

      game.gotoResearchPhase();

      for (let round = 0; round < 4; round++) {
        const selectCard = human.getWaitingFor() as SelectCard<IProjectCard>;
        selectCard.cb([selectCard.cards[0]]);
      }

      expect(game.projectDeck.discardPile.length).to.eq(discardBefore + 1);
    });

    // With a draft priority the player sees every card MarsBot keeps and the one it discards (rulebook B p.2, Nick BGG 3542834).
    it("logs MarsBot's picks and discard when it has a draft priority", () => {
      const {game, human, marsBot} = createAutomaGameWithDraft();
      marsBot.setCorpAndSetup(getMarsBotCorp(CardName.SATURN_SYSTEMS)!);
      game.gameLog.length = 0;
      game.gotoResearchPhase();

      for (let round = 0; round < 4; round++) {
        const selectCard = human.getWaitingFor() as SelectCard<IProjectCard>;
        selectCard.cb([selectCard.cards[0]]);
      }

      const messages = game.gameLog.map(formatMessage);
      const draftMessages = messages.filter((message) => message.startsWith('MarsBot drafts '));
      expect(draftMessages).has.length(4);
      const discarded = game.projectDeck.discardPile[game.projectDeck.discardPile.length - 1];
      expect(messages).to.include(`MarsBot discards ${discarded.name} after the draft`);
    });

    it("does not log MarsBot's picks without a draft priority", () => {
      const {game, human} = createAutomaGameWithDraft();
      game.gotoResearchPhase();

      for (let round = 0; round < 4; round++) {
        const selectCard = human.getWaitingFor() as SelectCard<IProjectCard>;
        selectCard.cb([selectCard.cards[0]]);
      }

      const messages = game.gameLog.map(formatMessage);
      const draftMessages = messages.filter((message) => message.startsWith('MarsBot drafts '));
      expect(draftMessages).is.empty;
    });

    it('swapped piles mean the human sees the other pile each round', () => {
      const {game, human} = createAutomaGameWithDraft();
      game.gotoResearchPhase();

      const round1Cards = [...(human.getWaitingFor() as SelectCard<IProjectCard>).cards];
      (human.getWaitingFor() as SelectCard<IProjectCard>).cb([round1Cards[0]]);

      const round2Cards = [...(human.getWaitingFor() as SelectCard<IProjectCard>).cards];
      expect(round2Cards).has.length(3);
      expect(round2Cards.filter((card) => round1Cards.includes(card))).is.empty;
    });
  });

  describe('buildResearchFromDraft', () => {
    it('builds deck from 4 drafted cards: discard 1, add bonus, total 4', () => {
      const {game, marsBot} = createAutomaGameNoDraft();
      const cards = game.projectDeck.drawN(game, 4);
      marsBot.actionDeck.buildResearchFromDraft(cards);
      expect(marsBot.actionDeck.cards.length).to.eq(4);
    });

    it('discards 1 card to project discard pile', () => {
      const {game, marsBot} = createAutomaGameNoDraft();
      const discardBefore = game.projectDeck.discardPile.length;
      const cards = game.projectDeck.drawN(game, 4);
      marsBot.actionDeck.buildResearchFromDraft(cards);
      expect(game.projectDeck.discardPile.length).to.eq(discardBefore + 1);
    });
  });

  describe('Draft disabled in automa mode', () => {
    it('standard draft phase is bypassed for automa', () => {
      const {game} = createAutomaGameWithDraft();

      (game as Game)['startGeneration']();

      expect(game.phase).to.eq(Phase.RESEARCH);
    });
  });
});
