import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {getMarsBotCorp} from '@/server/automa/corps/MarsBotCorpRegistry';
import {CREDICOR_MARSBOT_CORP} from '@/server/automa/corps/base/CrediCorMarsBot';
import {ArtificialLake} from '@/server/cards/base/ArtificialLake';
import {MagneticFieldGenerators} from '@/server/cards/base/MagneticFieldGenerators';
import {createAutomaGame, fakeCard, resetCorpRegistry} from '../CorpGame';
import {recordingMarsBot} from '../RecordingMarsBot';

describe('CrediCorMarsBot', () => {
  beforeEach(resetCorpRegistry);

  for (const run of [
    {card: new MagneticFieldGenerators(), cost: 20, calls: ['gainMc(4)']},
    {card: new ArtificialLake(), cost: 15, calls: []},
  ]) {
    it(`gains 4 M€ for a card that costs 20 or more, card that costs ${run.cost}`, () => {
      const {marsBot, calls} = recordingMarsBot();

      CREDICOR_MARSBOT_CORP.effect!.onProjectCardResolved!(marsBot, run.card);

      expect(calls).deep.eq(run.calls);
    });
  }

  it('gains 4 M€ when card costs 20+', () => {
    const {marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.CREDICOR)!;
    marsBot.setCorpAndSetup(corp);

    const mcBefore = marsBot.turnResolver.megacredits;
    corp.effect!.onProjectCardResolved!(marsBot, fakeCard('Expensive', {cost: 25}));
    expect(marsBot.turnResolver.megacredits).to.eq(mcBefore + 4);
  });

  it('does not gain M€ when card costs less than 20', () => {
    const {marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.CREDICOR)!;
    marsBot.setCorpAndSetup(corp);

    const mcBefore = marsBot.turnResolver.megacredits;
    corp.effect!.onProjectCardResolved!(marsBot, fakeCard('Cheap', {cost: 15}));
    expect(marsBot.turnResolver.megacredits).to.eq(mcBefore);
  });

  it('has mostExpensive draft priority', () => {
    const corp = getMarsBotCorp(CardName.CREDICOR)!;
    expect(corp.draftPriority).to.deep.eq({type: 'mostExpensive'});
  });
});
