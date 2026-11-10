import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {Tag} from '@/common/cards/Tag';
import {getMarsBotCorp} from '@/server/automa/corps/MarsBotCorpRegistry';
import {SAGITTA_FRONTIER_SERVICES_MARSBOT_CORP} from '@/server/automa/corps/prelude2/SagittaFrontierServicesMarsBot';
import {ArtificialLake} from '@/server/cards/base/ArtificialLake';
import {Asteroid} from '@/server/cards/base/Asteroid';
import {IceCapMelting} from '@/server/cards/base/IceCapMelting';
import {MicroMills} from '@/server/cards/base/MicroMills';
import {createAutomaGame, fakeCard, resetCorpRegistry} from '../CorpGame';
import {recordingMarsBot} from '../RecordingMarsBot';

describe('SagittaFrontierServicesMarsBot', () => {
  beforeEach(resetCorpRegistry);

  it('gains 8 M€ at setup', () => {
    const {marsBot, calls} = recordingMarsBot();

    SAGITTA_FRONTIER_SERVICES_MARSBOT_CORP.setup!(marsBot);

    expect(calls).deep.eq(['gainMc(8)']);
  });

  // A tagless card pays the Failed Action amount again, and an event counts its Event tag
  it('pays more M€ for a card with no tags than for one tag, and nothing for two', () => {
    const paid = [new MicroMills(), new ArtificialLake(), new Asteroid()].map((card) => {
      const {marsBot, calls} = recordingMarsBot({failedActionMc: 5});
      SAGITTA_FRONTIER_SERVICES_MARSBOT_CORP.effect!.onProjectCardResolved!(marsBot, card);
      return calls;
    });

    expect(paid).deep.eq([['gainMc(5)'], ['gainMc(1)'], []]);
  });

  it('gains 8 M€ on setup', () => {
    const {marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.SAGITTA_FRONTIER_SERVICES)!;
    const mcBefore = marsBot.turnResolver.megacredits;
    marsBot.setCorpAndSetup(corp);
    expect(marsBot.turnResolver.megacredits).to.eq(mcBefore + 8);
  });

  it('gains extra 5 M€ for tagless cards', () => {
    const {marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.SAGITTA_FRONTIER_SERVICES)!;
    marsBot.setCorpAndSetup(corp);
    const mcBefore = marsBot.turnResolver.megacredits;
    corp.effect!.onProjectCardResolved!(marsBot, fakeCard('Tagless', {cost: 5}));
    expect(marsBot.turnResolver.megacredits).to.eq(mcBefore + 5);
  });

  it('pays 10 M€ in all for a tagless card MarsBot plays', () => {
    const {marsBot} = createAutomaGame();
    marsBot.setCorpAndSetup(getMarsBotCorp(CardName.SAGITTA_FRONTIER_SERVICES)!);
    const mcBefore = marsBot.turnResolver.megacredits;
    marsBot.turnResolver.resolveProjectCard(new MicroMills());
    expect(marsBot.turnResolver.megacredits).to.eq(mcBefore + 10);
  });

  // Our reading: the tagless card pays double whatever the Failed Action pays (3 M€ on Easy)
  it('pays double the Easy Failed Action for a tagless card', () => {
    const {marsBot} = createAutomaGame({automaDifficulty: 'easy'});
    marsBot.setCorpAndSetup(getMarsBotCorp(CardName.SAGITTA_FRONTIER_SERVICES)!);
    const mcBefore = marsBot.turnResolver.megacredits;
    marsBot.turnResolver.resolveProjectCard(new MicroMills());
    expect(marsBot.turnResolver.megacredits).to.eq(mcBefore + 6);
  });

  it('counts the Event tag, so an event with no printed tags pays 1 M€', () => {
    const {marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.SAGITTA_FRONTIER_SERVICES)!;
    marsBot.setCorpAndSetup(corp);
    const mcBefore = marsBot.turnResolver.megacredits;
    corp.effect!.onProjectCardResolved!(marsBot, new IceCapMelting());
    expect(marsBot.turnResolver.megacredits).to.eq(mcBefore + 1);
  });

  it('gains 1 M€ for 1-tag cards', () => {
    const {marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.SAGITTA_FRONTIER_SERVICES)!;
    marsBot.setCorpAndSetup(corp);
    const mcBefore = marsBot.turnResolver.megacredits;
    corp.effect!.onProjectCardResolved!(marsBot, fakeCard('OneTag', {tags: [Tag.BUILDING], cost: 5}));
    expect(marsBot.turnResolver.megacredits).to.eq(mcBefore + 1);
  });
});
