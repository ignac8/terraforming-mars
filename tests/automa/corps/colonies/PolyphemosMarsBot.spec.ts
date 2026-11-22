import {expect} from 'chai';
import {BonusCardName} from '@/common/automa/BonusCardName';
import {CardName} from '@/common/cards/CardName';
import {Tag} from '@/common/cards/Tag';
import {createBonusCard} from '@/server/automa/bonusCards/MarsBotBonusCards';
import {getMarsBotCorp} from '@/server/automa/corps/MarsBotCorpRegistry';
import {PolyphemosMarsBot} from '@/server/automa/corps/colonies/PolyphemosMarsBot';
import {IceCapMelting} from '@/server/cards/base/IceCapMelting';
import {Research} from '@/server/cards/base/Research';
import {createAutomaGame, resetCorpRegistry} from '../CorpGame';
import {recordingMarsBot} from '../RecordingMarsBot';

describe('PolyphemosMarsBot', () => {
  beforeEach(resetCorpRegistry);

  it('gains 25 M€ at setup and discards a project card before the action phase', () => {
    const {marsBot, calls} = recordingMarsBot();
    const corp = new PolyphemosMarsBot();

    corp.setup(marsBot);
    corp.beforeActionPhase(marsBot);

    expect(calls).deep.eq(['gainMc(25)', 'maybeDiscardProjectCardWithFewestTags()']);
  });

  it('gains at least 25 M€ on setup (plus MC from starting tag track actions)', () => {
    const {marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.POLYPHEMOS)!;
    const mcBefore = marsBot.megacredits;
    marsBot.setCorpAndSetup(corp);
    expect(marsBot.megacredits).to.be.gte(mcBefore + 25);
  });

  it('has 6 starting tags (3 Space + 3 Event)', () => {
    const corp = getMarsBotCorp(CardName.POLYPHEMOS)!;
    expect(corp.tags).to.deep.eq([Tag.SPACE, Tag.SPACE, Tag.SPACE, Tag.EVENT, Tag.EVENT, Tag.EVENT]);
  });

  it('discards the project card with the fewest tags before the action phase, never a bonus card', () => {
    const {game, marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.POLYPHEMOS)!;
    const iceCapMelting = new IceCapMelting(); // Its Event tag only
    const bonus = createBonusCard(BonusCardName.RESEARCH_AND_DEVELOPMENT);
    marsBot.actionDeck.cards = [bonus, new Research(), iceCapMelting];

    corp.beforeActionPhase!(marsBot);

    const names = marsBot.actionDeck.cards.map((card) => card.name);
    expect(names).to.deep.eq([bonus.name, CardName.RESEARCH]);
    expect(game.projectDeck.discardPile).to.include(iceCapMelting);
  });

  it('discards nothing when the action deck holds no project card', () => {
    const {marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.POLYPHEMOS)!;
    marsBot.actionDeck.cards = [createBonusCard(BonusCardName.RESEARCH_AND_DEVELOPMENT)];

    corp.beforeActionPhase!(marsBot);

    expect(marsBot.actionDeck.cards).has.length(1);
  });

  it('discards card with fewest tags from action deck', () => {
    const {marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.POLYPHEMOS)!;
    marsBot.setCorpAndSetup(corp);
    const deckBefore = marsBot.actionDeck.cards.length;
    corp.beforeActionPhase!(marsBot);
    expect(marsBot.actionDeck.cards.length).to.eq(deckBefore - 1);
  });
});
