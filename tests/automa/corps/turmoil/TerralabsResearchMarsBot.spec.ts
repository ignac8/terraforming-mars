import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {getMarsBotCorp} from '@/server/automa/corps/MarsBotCorpRegistry';
import {TERRALABS_RESEARCH_MARSBOT_CORP} from '@/server/automa/corps/turmoil/TerralabsResearchMarsBot';
import {createAutomaGame, resetCorpRegistry} from '../CorpGame';
import {recordingMarsBot} from '../RecordingMarsBot';

// C38
describe('TerralabsResearchMarsBot', () => {
  beforeEach(resetCorpRegistry);

  it('setup takes 8 TR off MarsBot', () => {
    const {marsBot, calls} = recordingMarsBot();

    TERRALABS_RESEARCH_MARSBOT_CORP.setup!(marsBot);

    expect(calls).deep.eq(['raiseTR(-8)']);
  });

  for (const run of [
    {generation: 8, count: 1},
    {generation: 9, count: 2},
  ]) {
    it(`draws ${run.count} card(s) to the action deck in generation ${run.generation}`, () => {
      const {marsBot, calls} = recordingMarsBot();
      marsBot.game.generation = run.generation;

      TERRALABS_RESEARCH_MARSBOT_CORP.beforeActionPhase!(marsBot);

      expect(calls).deep.eq([`drawProjectCardsToActionDeck(${run.count})`]);
    });
  }

  it('reduces TR by 8 on setup', () => {
    const {marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.TERRALABS_RESEARCH)!;
    const trBefore = marsBot.player.terraformRating;
    marsBot.setCorpAndSetup(corp);
    expect(marsBot.player.terraformRating).to.eq(trBefore - 8);
  });

  it('draws 1 card for gen 1-8, 2 cards for gen 9+', () => {
    const {marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.TERRALABS_RESEARCH)!;
    marsBot.setCorpAndSetup(corp);

    const deckBefore = marsBot.actionDeck.length;
    corp.beforeActionPhase!(marsBot); // gen 1 → 1 card
    expect(marsBot.actionDeck.length).to.eq(deckBefore + 1);
  });
});
