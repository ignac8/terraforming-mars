import {expect} from 'chai';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {createBonusCard} from '@/server/automa/MarsBotBonusCard';
import {DiversificationMarsBot} from '@/server/automa/bonusCards/DiversificationMarsBot';
import {createAutomaGame, resetCorpRegistry} from '../corps/CorpGame';
import {setAllTracks} from '../FakeMarsBot';
import {TRACK, recordingMarsBot} from '../corps/RecordingMarsBot';
import {maxTracks} from './BonusCardGame';

describe('DiversificationMarsBot', () => {
  beforeEach(resetCorpRegistry);

  for (const run of [
    {megacredits: 6, megacreditsLeft: 2},
    {megacredits: 3, megacreditsLeft: 0},
  ] as const) {
    it('advances the least-advanced track, then loses up to 4 M€: ' + JSON.stringify(run), () => {
      const {marsBot, calls} = recordingMarsBot({megacredits: run.megacredits});
      setAllTracks(marsBot, 4);
      marsBot.marsBotBoard.tracks[TRACK.science].position = 2;

      new DiversificationMarsBot().resolve(marsBot);

      expect(calls).deep.eq([`maybeAdvanceTrack(${TRACK.science})`]);
      expect(marsBot.megacredits).eq(run.megacreditsLeft);
    });
  }

  it('loses up to 4 M€ after advancing', () => {
    const {marsBot} = createAutomaGame();
    marsBot.turnResolver.advanceTrack = () => true;
    marsBot.turnResolver.megacredits = 6;
    marsBot['bonusResolver'].resolve(createBonusCard(BonusCardId.B28_DIVERSIFICATION));
    expect(marsBot.turnResolver.megacredits).to.eq(2);
    marsBot['bonusResolver'].resolve(createBonusCard(BonusCardId.B28_DIVERSIFICATION));
    expect(marsBot.turnResolver.megacredits).to.eq(0);
  });

  it('advances least-advanced track', () => {
    const {marsBot} = createAutomaGame();
    const card = createBonusCard(BonusCardId.B28_DIVERSIFICATION);
    // Advance track 1 to create a non-uniform state
    marsBot.marsBotBoard.tracks[0].position = 5;
    // Least advanced should be one of the others (all at 0)
    const leastIdx = marsBot.marsBotBoard.getLeastAdvancedTrackIndex();
    const trackBefore = marsBot.marsBotBoard.tracks[leastIdx].position;
    marsBot['bonusResolver'].resolve(card);
    expect(marsBot.marsBotBoard.tracks[leastIdx].position).to.be.gte(trackBefore + 1);
  });

  // A bonus card that can't resolve takes no Failed Action (rulebook A p.5 B.a; BGG 3599965 and
  // 3623553, njshaw2). Project cards still do.
  it('takes no Failed Action when advancing a maxed track', () => {
    const {marsBot} = createAutomaGame();
    maxTracks(marsBot);
    marsBot.turnResolver.megacredits = 4;
    marsBot['bonusResolver'].resolve(createBonusCard(BonusCardId.B28_DIVERSIFICATION));
    expect(marsBot.turnResolver.megacredits).to.eq(0);
  });
});
