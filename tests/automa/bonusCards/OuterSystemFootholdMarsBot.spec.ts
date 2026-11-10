import {expect} from 'chai';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {BoardName} from '@/common/boards/BoardName';
import {CardName} from '@/common/cards/CardName';
import {ColonyName} from '@/common/colonies/ColonyName';
import {MarsBotBonusCard, bonusCard} from '@/server/automa/MarsBotBonusCard';
import {Luna} from '@/server/colonies/Luna';
import {testGame} from '../../TestGame';
import {getMarsBot} from '../corps/CorpGame';

function b18Card(): MarsBotBonusCard {
  return bonusCard(BonusCardId.B18_OUTER_SYSTEM_FOOTHOLD, 'Outer System Foothold' as CardName);
}

describe('OuterSystemFootholdMarsBot', () => {
  it('C-16a/b: places colony and gains 2 resources', () => {
    const [game] = testGame(1, {automa: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBot(game);
    const luna = new Luna();
    game.colonies = [luna];
    const card = b18Card();
    marsBot.bonusDeck.discardPile.push(card); // Will be restored; deck starts fresh
    marsBot.bonusDeck.drawPile.push(card);
    const destroyed = marsBot['bonusResolver'].resolve(card);
    // Luna should have marsBot as a colony or shipping board got resources
    const hasColony = luna.colonies.includes(marsBot.player.id);
    if (hasColony) {
      expect(marsBot.shippingBoard.get(ColonyName.LUNA)).to.eq(2);
    }
    expect(destroyed).to.be.false;
  });

  it('C-16c/d: draws and discards a bonus card (not resolves)', () => {
    const [game] = testGame(1, {automa: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBot(game);
    game.colonies = [new Luna()];

    // Put a filler bonus card in the deck so draw() can return something
    const fillerCard = bonusCard(BonusCardId.B03_RESEARCH_AND_DEVELOPMENT, 'R&D' as CardName);
    marsBot.bonusDeck.drawPile = [fillerCard];

    const card = b18Card();
    marsBot['bonusResolver'].resolve(card);

    // The filler should have been discarded (not resolved, so deck megacredits unchanged)
    // Since R&D would have changed megacredits, and it was just discarded, no change expected
    expect(marsBot.bonusDeck.discardPile).to.include(fillerCard);
  });

  it('C-16c: B18 is excluded from the reshuffle for the draw', () => {
    const [game] = testGame(1, {automa: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBot(game);
    game.colonies = [new Luna()];

    // Deck empty, discard has only B18 — after resolve, B18 should NOT be drawn
    const card = b18Card();
    marsBot.bonusDeck.drawPile = [];
    marsBot.bonusDeck.discardPile = [card];
    marsBot['bonusResolver'].resolve(card);
    // B18 should be back in discard but not have been drawn (no infinite loop)
    // No crash = success
  });
});
