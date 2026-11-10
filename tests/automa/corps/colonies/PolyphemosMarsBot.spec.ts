import {expect} from 'chai';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {CardName} from '@/common/cards/CardName';
import {Tag} from '@/common/cards/Tag';
import {createBonusCard} from '@/server/automa/MarsBotBonusCard';
import {getMarsBotCorp} from '@/server/automa/corps/MarsBotCorpRegistry';
import {IceCapMelting} from '@/server/cards/base/IceCapMelting';
import {Research} from '@/server/cards/base/Research';
import {createAutomaGame, resetCorpRegistry} from '../CorpGame';

describe('PolyphemosMarsBot', () => {
  beforeEach(resetCorpRegistry);

  it('gains at least 25 M€ on setup (plus MC from starting tag track actions)', () => {
    const {marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.POLYPHEMOS)!;
    const mcBefore = marsBot.turnResolver.megacredits;
    marsBot.setCorpAndSetup(corp);
    expect(marsBot.turnResolver.megacredits).to.be.gte(mcBefore + 25);
  });

  it('has 6 starting tags (3 Space + 3 Event)', () => {
    const corp = getMarsBotCorp(CardName.POLYPHEMOS)!;
    expect(corp.tags).to.deep.eq([Tag.SPACE, Tag.SPACE, Tag.SPACE, Tag.EVENT, Tag.EVENT, Tag.EVENT]);
  });

  it('discards the project card with the fewest tags before the action phase, never a bonus card', () => {
    const {game, marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.POLYPHEMOS)!;
    const iceCapMelting = new IceCapMelting(); // Its Event tag only
    const bonus = createBonusCard(BonusCardId.B03_RESEARCH_AND_DEVELOPMENT);
    marsBot.actionDeck = [bonus, new Research(), iceCapMelting];

    corp.beforeActionPhase!(marsBot);

    expect(marsBot.actionDeck.map((c) => c.name)).to.deep.eq([bonus.name, CardName.RESEARCH]);
    expect(game.projectDeck.discardPile).to.include(iceCapMelting);
  });

  it('discards nothing when the action deck holds no project card', () => {
    const {marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.POLYPHEMOS)!;
    marsBot.actionDeck = [createBonusCard(BonusCardId.B03_RESEARCH_AND_DEVELOPMENT)];

    corp.beforeActionPhase!(marsBot);

    expect(marsBot.actionDeck).has.length(1);
  });

  it('discards card with fewest tags from action deck', () => {
    const {marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.POLYPHEMOS)!;
    marsBot.setCorpAndSetup(corp);
    const deckBefore = marsBot.actionDeck.length;
    corp.beforeActionPhase!(marsBot);
    expect(marsBot.actionDeck.length).to.eq(deckBefore - 1);
  });
});
