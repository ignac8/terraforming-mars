import {expect} from 'chai';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {createBonusCard} from '@/server/automa/bonusCards/MarsBotBonusCards';
import {Diversification} from '@/server/automa/bonusCards/Diversification';
import {createAutomaGame, resetCorpRegistry} from '../corps/CorpGame';
import {setAllTracks} from '../FakeMarsBot';
import {TRACK, recordingMarsBot} from '../corps/RecordingMarsBot';
import {maxTracks} from './BonusCardGame';

describe('Diversification', () => {
  beforeEach(resetCorpRegistry);

  it('advances the least-advanced track, then loses up to 4 M€', () => {
    const {marsBot, calls} = recordingMarsBot();
    setAllTracks(marsBot, 4);
    marsBot.marsBotBoard.tracks[TRACK.science].position = 2;

    new Diversification().resolve(marsBot);

    expect(calls).deep.eq([`maybeAdvanceTrack(${TRACK.science})`, 'loseMc(4)']);
  });

  it('loses up to 4 M€ after advancing', () => {
    const {marsBot} = createAutomaGame();
    marsBot.turnResolver.advanceTrack = () => true;
    marsBot.megacredits = 6;
    marsBot.actionDeck.playBonusCard(createBonusCard(BonusCardId.B28_DIVERSIFICATION));
    expect(marsBot.megacredits).to.eq(2);
    marsBot.actionDeck.playBonusCard(createBonusCard(BonusCardId.B28_DIVERSIFICATION));
    expect(marsBot.megacredits).to.eq(0);
  });

  it('advances least-advanced track', () => {
    const {marsBot} = createAutomaGame();
    const card = createBonusCard(BonusCardId.B28_DIVERSIFICATION);
    marsBot.marsBotBoard.tracks[0].position = 5;
    const leastIdx = marsBot.marsBotBoard.getLeastAdvancedTrackIndex();
    const trackBefore = marsBot.marsBotBoard.tracks[leastIdx].position;
    marsBot.actionDeck.playBonusCard(card);
    expect(marsBot.marsBotBoard.tracks[leastIdx].position).to.be.gte(trackBefore + 1);
  });

  // A bonus card that can't resolve takes no Failed Action (rulebook A p.5 B.a; BGG 3599965 and
  // 3623553, njshaw2). Project cards still do.
  it('takes no Failed Action when advancing a maxed track', () => {
    const {marsBot} = createAutomaGame();
    maxTracks(marsBot);
    marsBot.megacredits = 4;
    marsBot.actionDeck.playBonusCard(createBonusCard(BonusCardId.B28_DIVERSIFICATION));
    expect(marsBot.megacredits).to.eq(0);
  });
});
