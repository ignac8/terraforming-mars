import {expect} from 'chai';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {CardName} from '@/common/cards/CardName';
import {getMarsBotCorp} from '@/server/automa/corps/MarsBotCorpRegistry';
import {VITOR_MARSBOT_CORP} from '@/server/automa/corps/prelude/VitorMarsBot';
import {IProjectCard} from '@/server/cards/IProjectCard';
import {AICentral} from '@/server/cards/base/AICentral';
import {Ants} from '@/server/cards/base/Ants';
import {Asteroid} from '@/server/cards/base/Asteroid';
import {BiomassCombustors} from '@/server/cards/base/BiomassCombustors';
import {BribedCommittee} from '@/server/cards/base/BribedCommittee';
import {DustSeals} from '@/server/cards/base/DustSeals';
import {MicroMills} from '@/server/cards/base/MicroMills';
import {SearchForLife} from '@/server/cards/base/SearchForLife';
import {Tardigrades} from '@/server/cards/base/Tardigrades';
import {createAutomaGame, resetCorpRegistry} from '../CorpGame';
import {recordingMarsBot} from '../RecordingMarsBot';

function vitorGain(card: IProjectCard): number {
  const {marsBot} = createAutomaGame();
  const corp = getMarsBotCorp(CardName.VITOR)!;
  marsBot.setCorpAndSetup(corp);
  const mcBefore = marsBot.turnResolver.megacredits;
  corp.effect!.onProjectCardResolved!(marsBot, card);
  return marsBot.turnResolver.megacredits - mcBefore;
}

describe('VitorMarsBot', () => {
  beforeEach(resetCorpRegistry);

  it('removes Overachievement at setup, and it is its action deck bonus card', () => {
    const {marsBot, calls} = recordingMarsBot();

    VITOR_MARSBOT_CORP.setup!(marsBot);

    expect(calls).deep.eq(['removeBonusCard(B04)']);
    expect(VITOR_MARSBOT_CORP.actionDeckBonusCard).eq(BonusCardId.B04_OVERACHIEVEMENT);
  });

  // The VP printed on the card counts, not what it scores now
  it('gains 3 M€ for a card whose printed VP is not negative', () => {
    const gained = [new Ants(), new DustSeals(), new BiomassCombustors(), new MicroMills()].map((card) => {
      const {marsBot, calls} = recordingMarsBot();
      VITOR_MARSBOT_CORP.effect!.onProjectCardResolved!(marsBot, card);
      return calls;
    });

    expect(gained).deep.eq([['gainMc(3)'], ['gainMc(3)'], [], []]);
  });

  it('gains 3 M€ for a card with printed VP', () => {
    expect(vitorGain(new AICentral())).to.eq(3);
  });

  it('gains 3 M€ for a card with variable VP that scores nothing yet', () => {
    expect(vitorGain(new Tardigrades())).to.eq(3);
    expect(vitorGain(new SearchForLife())).to.eq(3);
  });

  it('does NOT gain M€ for cards without VP', () => {
    expect(vitorGain(new Asteroid())).to.eq(0);
  });

  it('does NOT gain M€ for negative VP cards', () => {
    expect(vitorGain(new BribedCommittee())).to.eq(0);
  });
});
