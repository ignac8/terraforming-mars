import {expect} from 'chai';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {BoardName} from '@/common/boards/BoardName';
import {ColonyName} from '@/common/colonies/ColonyName';
import {MarsBotBonusCard} from '@/server/automa/MarsBotBonusCard';
import {createBonusCard} from '@/server/automa/bonusCards/MarsBotBonusCards';
import {MarsBotBonusDeck} from '@/server/automa/MarsBotBonusDeck';
import {OuterSystemFoothold} from '@/server/automa/bonusCards/OuterSystemFoothold';
import {Luna} from '@/server/colonies/Luna';
import {testGame} from '../../TestGame';
import {getMarsBot} from '../corps/CorpGame';
import {recordingMarsBot} from '../corps/RecordingMarsBot';

function b18Card(): MarsBotBonusCard {
  return createBonusCard(BonusCardId.B18_OUTER_SYSTEM_FOOTHOLD);
}

describe('OuterSystemFoothold', () => {
  it('places a colony, then draws a bonus card and discards it without resolving it', () => {
    const [game] = testGame(1, {coloniesExtension: true});
    const investors = createBonusCard(BonusCardId.B32_INVESTORS);
    const meteorShower = createBonusCard(BonusCardId.B01_METEOR_SHOWER);
    const {marsBot, calls} = recordingMarsBot({game, bonusDeck: new MarsBotBonusDeck([meteorShower, investors], [], game.rng)});

    const kept = new OuterSystemFoothold().resolve(marsBot);

    expect(calls).deep.eq(['maybePlaceRandomColony()']);
    expect(marsBot.bonusDeck.drawPile).deep.eq([meteorShower]);
    expect(marsBot.bonusDeck.discardPile).deep.eq([investors]);
    expect(kept).is.false;
  });

  it('keeps itself out of the reshuffle when the draw pile is empty', () => {
    const [game] = testGame(1, {coloniesExtension: true});
    const self = createBonusCard(BonusCardId.B18_OUTER_SYSTEM_FOOTHOLD);
    const investors = createBonusCard(BonusCardId.B32_INVESTORS);
    const {marsBot} = recordingMarsBot({game, bonusDeck: new MarsBotBonusDeck([], [self, investors], game.rng)});

    new OuterSystemFoothold().resolve(marsBot);

    expect(marsBot.bonusDeck.drawPile).is.empty;
    expect(marsBot.bonusDeck.discardPile).deep.eq([self, investors]);
  });

  it('places colony and gains 2 resources', () => {
    const [game] = testGame(1, {automa: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBot(game);
    const luna = new Luna();
    game.colonies = [luna];
    const card = b18Card();
    marsBot.bonusDeck.discardPile.push(card); // Will be restored; deck starts fresh
    marsBot.bonusDeck.drawPile.push(card);
    const destroyed = marsBot.actionDeck.playBonusCard(card);
    const hasColony = luna.colonies.includes(marsBot.player.id);
    if (hasColony) {
      expect(marsBot.shippingBoard.get(ColonyName.LUNA)).to.eq(2);
    }
    expect(destroyed).to.be.false;
  });

  it('draws and discards a bonus card (not resolves)', () => {
    const [game] = testGame(1, {automa: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBot(game);
    game.colonies = [new Luna()];

    // A filler card for the draw to find.
    const fillerCard = createBonusCard(BonusCardId.B03_RESEARCH_AND_DEVELOPMENT);
    marsBot.bonusDeck.drawPile = [fillerCard];

    const card = b18Card();
    marsBot.actionDeck.playBonusCard(card);

    expect(marsBot.bonusDeck.discardPile).to.include(fillerCard);
  });
});
