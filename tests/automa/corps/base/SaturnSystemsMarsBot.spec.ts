import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {Tag} from '@/common/cards/Tag';
import {getMarsBotCorp} from '@/server/automa/corps/MarsBotCorpRegistry';
import {SATURN_SYSTEMS_MARSBOT_CORP} from '@/server/automa/corps/base/SaturnSystemsMarsBot';
import {Asteroid} from '@/server/cards/base/Asteroid';
import {AsteroidMining} from '@/server/cards/base/AsteroidMining';
import {createAutomaGame, fakeCard, resetCorpRegistry} from '../CorpGame';
import {recordingMarsBot} from '../RecordingMarsBot';

// Track index on the Tharsis board
const EVENT = 2;

describe('SaturnSystemsMarsBot', () => {
  beforeEach(resetCorpRegistry);

  // A Jovian card of either side (rulebook B p.4)
  for (const run of [
    {card: new AsteroidMining(), tag: 'Jovian', calls: [`advanceTrack(${EVENT})`]},
    {card: new Asteroid(), tag: 'space', calls: []},
  ]) {
    it(`advances the event track for a Jovian card MarsBot resolves, ${run.tag} card`, () => {
      const {marsBot, calls} = recordingMarsBot();

      SATURN_SYSTEMS_MARSBOT_CORP.effect!.onProjectCardResolved!(marsBot, run.card);

      expect(calls).deep.eq(run.calls);
    });

    it(`advances the event track for a Jovian card the player plays, ${run.tag} card`, () => {
      const {marsBot, calls} = recordingMarsBot();

      SATURN_SYSTEMS_MARSBOT_CORP.effect!.onHumanCardPlayed!(marsBot, run.card);

      expect(calls).deep.eq(run.calls);
    });
  }

  it('has Jovian > Space draft priority', () => {
    const corp = getMarsBotCorp(CardName.SATURN_SYSTEMS)!;
    expect(corp.draftPriority).to.deep.eq({type: 'tags', tags: [Tag.JOVIAN, Tag.SPACE]});
  });

  it('has 4 starting tags (Jovian + 3 Space)', () => {
    const corp = getMarsBotCorp(CardName.SATURN_SYSTEMS)!;
    expect(corp.tags).to.deep.eq([Tag.JOVIAN, Tag.SPACE, Tag.SPACE, Tag.SPACE]);
  });

  it('advances event track when Jovian card resolved', () => {
    const {marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.SATURN_SYSTEMS)!;
    marsBot.setCorpAndSetup(corp);

    const eventTrackBefore = marsBot.marsBotBoard.tracks[2].position; // Event = track 3
    corp.effect!.onProjectCardResolved!(marsBot, fakeCard('JovianCard', {tags: [Tag.JOVIAN], cost: 10}));
    // Event track should have advanced (may chain from starting tags advancement)
    expect(marsBot.marsBotBoard.tracks[2].position).to.be.gte(eventTrackBefore + 1);
  });

  it('advances event track when human plays Jovian card', () => {
    const {marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.SATURN_SYSTEMS)!;
    marsBot.setCorpAndSetup(corp);

    const eventTrackBefore = marsBot.marsBotBoard.tracks[2].position;
    corp.effect!.onHumanCardPlayed!(marsBot, fakeCard('HumanJovian', {tags: [Tag.JOVIAN], cost: 5}));
    expect(marsBot.marsBotBoard.tracks[2].position).to.be.gte(eventTrackBefore + 1);
  });

  it('does NOT advance event track for non-Jovian cards', () => {
    const {marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.SATURN_SYSTEMS)!;
    marsBot.setCorpAndSetup(corp);

    const eventTrackBefore = marsBot.marsBotBoard.tracks[2].position;
    corp.effect!.onProjectCardResolved!(marsBot, fakeCard('SpaceCard', {tags: [Tag.SPACE], cost: 10}));
    expect(marsBot.marsBotBoard.tracks[2].position).to.eq(eventTrackBefore);
  });
});
