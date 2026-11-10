import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {Tag} from '@/common/cards/Tag';
import {getMarsBotCorp} from '@/server/automa/corps/MarsBotCorpRegistry';
import {SPIRE_MARSBOT_CORP} from '@/server/automa/corps/prelude2/SpireMarsBot';
import {ArtificialLake} from '@/server/cards/base/ArtificialLake';
import {Asteroid} from '@/server/cards/base/Asteroid';
import {createAutomaGame, fakeCard, resetCorpRegistry} from '../CorpGame';
import {recordingMarsBot} from '../RecordingMarsBot';

describe('SpireMarsBot', () => {
  beforeEach(resetCorpRegistry);

  it('collects a science resource for a card with 2 tags, none for 1, and spends 10 on a city and 1 TR', () => {
    const {marsBot, calls, corpState} = recordingMarsBot();
    const onCard = SPIRE_MARSBOT_CORP.effect!.onProjectCardResolved!;
    corpState.set('scienceResources', 9);

    onCard(marsBot, new ArtificialLake());
    expect(corpState.get('scienceResources')).eq(9);
    onCard(marsBot, new Asteroid());
    SPIRE_MARSBOT_CORP.beforeActionPhase!(marsBot);

    expect(corpState.get('scienceResources')).eq(0);
    expect(calls).deep.eq(['placeCity()', 'raiseTR(1)']);
  });

  it('has mostTags draft priority', () => {
    const corp = getMarsBotCorp(CardName.SPIRE)!;
    expect(corp.draftPriority).to.deep.eq({type: 'mostTags'});
  });

  it('gains science resource for 2+ tag cards', () => {
    const {marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.SPIRE)!;
    marsBot.setCorpAndSetup(corp);
    corp.effect!.onProjectCardResolved!(marsBot, fakeCard('TwoTags', {tags: [Tag.BUILDING, Tag.SPACE], cost: 10}));
    expect(marsBot.corpSpecificState.get('scienceResources')).to.eq(1);
  });

  // A wild tag counts as a tag (Nick, Q&A 19)
  it('counts a wild tag toward the 2 tags', () => {
    const {marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.SPIRE)!;
    marsBot.setCorpAndSetup(corp);
    corp.effect!.onProjectCardResolved!(marsBot, fakeCard('WildAndBuilding', {tags: [Tag.WILD, Tag.BUILDING], cost: 10}));
    expect(marsBot.corpSpecificState.get('scienceResources')).to.eq(1);
  });

  it('does not gain science for 1-tag cards', () => {
    const {marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.SPIRE)!;
    marsBot.setCorpAndSetup(corp);
    corp.effect!.onProjectCardResolved!(marsBot, fakeCard('OneTag', {tags: [Tag.BUILDING], cost: 5}));
    expect(marsBot.corpSpecificState.get('scienceResources') ?? 0).to.eq(0);
  });
});
