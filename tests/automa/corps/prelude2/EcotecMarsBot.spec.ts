import {expect} from 'chai';
import {Resource} from '@/common/Resource';
import {CardName} from '@/common/cards/CardName';
import {Tag} from '@/common/cards/Tag';
import {getMarsBotCorp} from '@/server/automa/corps/MarsBotCorpRegistry';
import {ECOTEC_MARSBOT_CORP} from '@/server/automa/corps/prelude2/EcotecMarsBot';
import {runAllActions} from '../../../TestingUtils';
import {chooseSource, createAutomaGame, createCorpFaqGame, fakeCard, resetCorpRegistry} from '../CorpGame';
import {recordingMarsBot, trackCubes} from '../RecordingMarsBot';

// Track index on the Tharsis board
const PLANT = 6;

describe('EcotecMarsBot', () => {
  beforeEach(resetCorpRegistry);

  it('collects plant resources, 2 from setup and 1 for each Plant, Microbe and Animal tag, and spends 5', () => {
    const {marsBot, calls, corpState} = recordingMarsBot();

    ECOTEC_MARSBOT_CORP.setup!(marsBot);
    for (const tag of [Tag.PLANT, Tag.MICROBE, Tag.ANIMAL, Tag.SPACE]) {
      ECOTEC_MARSBOT_CORP.effect!.onTagResolved!(marsBot, tag);
    }
    ECOTEC_MARSBOT_CORP.beforeActionPhase!(marsBot);

    expect(corpState.get('plantResources')).eq(0);
    expect(calls).deep.eq([`advanceTrack(${PLANT})`]);
  });

  it('has a white cube on every space of the plant track', () => {
    expect(trackCubes(ECOTEC_MARSBOT_CORP)).deep.eq(Array.from({length: 18}, (_, i) => `plant white ${i + 1}`));
  });

  it('starts with 2 plants from the Setup box and 1 from its starting plant tag', () => {
    const {marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.ECOTEC)!;
    marsBot.setCorpAndSetup(corp);
    expect(marsBot.corpSpecificState.get('plantResources')).to.eq(3);
  });

  it('gains a plant resource per plant, microbe or animal tag', () => {
    const {marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.ECOTEC)!;
    marsBot.setCorpAndSetup(corp);
    marsBot.turnResolver.resolveProjectCard(fakeCard('PlantCard', {tags: [Tag.PLANT, Tag.MICROBE, Tag.SPACE], cost: 5}));
    expect(marsBot.corpSpecificState.get('plantResources')).to.eq(5);
  });

  it('ignores other tags', () => {
    const {marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.ECOTEC)!;
    marsBot.setCorpAndSetup(corp);
    marsBot.turnResolver.resolveProjectCard(fakeCard('SpaceCard', {tags: [Tag.SPACE, Tag.BUILDING], cost: 5}));
    expect(marsBot.corpSpecificState.get('plantResources')).to.eq(3);
  });

  it('spends 5 plant resources to advance plant track', () => {
    const {marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.ECOTEC)!;
    marsBot.setCorpAndSetup(corp);
    marsBot.corpSpecificState.set('plantResources', 6);
    const plantTrackBefore = marsBot.marsBotBoard.tracks[6].position;
    corp.beforeActionPhase!(marsBot);
    expect(marsBot.corpSpecificState.get('plantResources')).to.eq(1);
    expect(marsBot.marsBotBoard.tracks[6].position).to.be.gte(plantTrackBefore + 1);
  });

  it('plant removal targets plantResources on corp card when present', () => {
    const {marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.ECOTEC)!;
    marsBot.setCorpAndSetup(corp);
    // Ecotec starts with 2 plant resources and 1 more from its starting plant tag
    expect(marsBot.corpSpecificState.get('plantResources')).to.eq(3);
    const mcBefore = marsBot.turnResolver.megacredits;
    // Remove 4 plants — should take 3 from card, excess lost, NOT from MC supply
    marsBot.player.stock.add('plants' as any, -4);
    expect(marsBot.corpSpecificState.get('plantResources')).to.eq(0);
    expect(marsBot.turnResolver.megacredits).to.eq(mcBefore); // No MC deducted
  });

  it('non-plant removal still deducts from MC supply', () => {
    const {marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.ECOTEC)!;
    marsBot.setCorpAndSetup(corp);
    marsBot.turnResolver.megacredits = 10;
    marsBot.player.stock.add('steel' as any, -3);
    expect(marsBot.turnResolver.megacredits).to.eq(7);
  });

  // Corporation FAQ (rulebook B, p.4): the player may destroy or steal the plants on the corporation card
  it('steals the Ecotec plants, and the excess is lost', () => {
    const {game, human, marsBot} = createCorpFaqGame(CardName.ECOTEC);
    marsBot.turnResolver.megacredits = 20;

    marsBot.player.stock.steal(Resource.PLANTS, 4, human);
    chooseSource(game, human, 0);

    expect(human.plants).eq(3);
    expect(marsBot.getCorpState('plantResources')).eq(0);
    expect(marsBot.turnResolver.megacredits).eq(20);
  });

  it('steals from the M€ supply when the corporation card has no plants', () => {
    const {human, marsBot} = createCorpFaqGame(CardName.ECOTEC);
    marsBot.setCorpState('plantResources', 0);
    marsBot.turnResolver.megacredits = 20;

    marsBot.player.stock.steal(Resource.PLANTS, 3, human);

    expect(human.plants).eq(3);
    expect(marsBot.turnResolver.megacredits).eq(17);
  });

  it('counts the plants on the card for Crash Site Cleanup and Law Suit when the player steals them', () => {
    const {game, human, marsBot} = createCorpFaqGame(CardName.ECOTEC);

    marsBot.player.stock.steal(Resource.PLANTS, 4, human);
    runAllActions(game);

    expect(marsBot.getCorpState('plantResources')).eq(0);
    expect(game.someoneHasRemovedOtherPlayersPlants).is.true;
    expect(marsBot.player.removingPlayers).to.include(human.id);
  });
});
