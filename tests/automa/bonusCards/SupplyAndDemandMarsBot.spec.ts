import {expect} from 'chai';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {createBonusCard} from '@/server/automa/MarsBotBonusCard';
import {SupplyAndDemandMarsBot} from '@/server/automa/bonusCards/SupplyAndDemandMarsBot';
import {createAutomaGame, resetCorpRegistry} from '../corps/CorpGame';
import {TRACK, recordingMarsBot} from '../corps/RecordingMarsBot';
import {maxTracks} from './BonusCardGame';

describe('SupplyAndDemandMarsBot', () => {
  beforeEach(resetCorpRegistry);

  for (const run of [
    {mcOnCard: 5, expected: {calls: ['gainMc(3)'], mcOnCardLeft: 2}},
    {mcOnCard: 2, expected: {calls: ['gainMc(2)'], mcOnCardLeft: 0}},
    {mcOnCard: 0, expected: {calls: [`maybeAdvanceTrack(${TRACK.power})`], mcOnCardLeft: 0}},
  ] as const) {
    it('takes up to 3 M€ from the corporation card, or advances the power track: ' + JSON.stringify(run), () => {
      const {marsBot, calls, corpState} = recordingMarsBot();
      corpState.set('mcOnCard', run.mcOnCard);

      new SupplyAndDemandMarsBot().resolve(marsBot);

      expect(calls).deep.eq(run.expected.calls);
      expect(corpState.get('mcOnCard')).eq(run.expected.mcOnCardLeft);
    });
  }

  it('takes up to 3 M€ from the corporation card', () => {
    const {marsBot} = createAutomaGame();
    marsBot.setCorpState('mcOnCard', 5);
    marsBot['bonusResolver'].resolve(createBonusCard(BonusCardId.B24_SUPPLY_AND_DEMAND));
    expect(marsBot.turnResolver.megacredits).to.eq(3);
    expect(marsBot.getCorpState('mcOnCard')).to.eq(2);
    expect(marsBot.marsBotBoard.tracks[4].position).to.eq(0);
  });

  it('with no M€ on the card advances the energy track', () => {
    const {marsBot} = createAutomaGame();
    marsBot['bonusResolver'].resolve(createBonusCard(BonusCardId.B24_SUPPLY_AND_DEMAND));
    expect(marsBot.marsBotBoard.tracks[4].position).to.be.greaterThan(0);
    expect(marsBot.marsBotBoard.tracks[0].position).to.eq(0);
  });

  // A bonus card that can't resolve takes no Failed Action (rulebook A p.5 B.a; BGG 3599965 and
  // 3623553, njshaw2). Project cards still do.
  it('takes no Failed Action when advancing a maxed track', () => {
    const {marsBot} = createAutomaGame();
    maxTracks(marsBot);
    marsBot['bonusResolver'].resolve(createBonusCard(BonusCardId.B24_SUPPLY_AND_DEMAND));
    expect(marsBot.turnResolver.megacredits).to.eq(0);
  });
});
