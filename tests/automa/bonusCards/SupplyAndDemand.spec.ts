import {expect} from 'chai';
import {BonusCardName} from '@/common/automa/BonusCardName';
import {createBonusCard} from '@/server/automa/bonusCards/MarsBotBonusCards';
import {SupplyAndDemand} from '@/server/automa/bonusCards/SupplyAndDemand';
import {createAutomaGame, resetCorpRegistry} from '../corps/CorpGame';
import {TRACK, recordingMarsBot} from '../corps/RecordingMarsBot';
import {maxTracks} from './BonusCardGame';

describe('SupplyAndDemand', () => {
  beforeEach(resetCorpRegistry);

  for (const run of [
    {mcOnCard: 5, expected: {calls: ['gainMc(3)'], mcOnCardLeft: 2}},
    {mcOnCard: 2, expected: {calls: ['gainMc(2)'], mcOnCardLeft: 0}},
    {mcOnCard: 0, expected: {calls: [`maybeAdvanceTrack(${TRACK.power})`], mcOnCardLeft: 0}},
  ] as const) {
    it('takes up to 3 M€ from the corporation card, or advances the power track: ' + JSON.stringify(run), () => {
      const {marsBot, calls, corpState} = recordingMarsBot();
      corpState.set('mcOnCard', run.mcOnCard);

      new SupplyAndDemand().resolve(marsBot);

      expect(calls).deep.eq(run.expected.calls);
      expect(corpState.get('mcOnCard')).eq(run.expected.mcOnCardLeft);
    });
  }

  it('takes up to 3 M€ from the corporation card', () => {
    const {marsBot} = createAutomaGame();
    marsBot.setCorpState('mcOnCard', 5);
    marsBot.actionDeck.playBonusCard(createBonusCard(BonusCardName.SUPPLY_AND_DEMAND));
    expect(marsBot.megacredits).to.eq(3);
    expect(marsBot.getCorpState('mcOnCard')).to.eq(2);
    expect(marsBot.marsBotBoard.tracks[4].position).to.eq(0);
  });

  it('with no M€ on the card advances the energy track', () => {
    const {marsBot} = createAutomaGame();
    marsBot.actionDeck.playBonusCard(createBonusCard(BonusCardName.SUPPLY_AND_DEMAND));
    expect(marsBot.marsBotBoard.tracks[4].position).to.be.greaterThan(0);
    expect(marsBot.marsBotBoard.tracks[0].position).to.eq(0);
  });

  // A bonus card that can't resolve takes no Failed Action (rulebook A p.5 B.a; BGG 3599965 and
  // 3623553, njshaw2). Project cards still do.
  it('takes no Failed Action when advancing a maxed track', () => {
    const {marsBot} = createAutomaGame();
    maxTracks(marsBot);
    marsBot.actionDeck.playBonusCard(createBonusCard(BonusCardName.SUPPLY_AND_DEMAND));
    expect(marsBot.megacredits).to.eq(0);
  });
});
