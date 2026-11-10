import {expect} from 'chai';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {CardName} from '@/common/cards/CardName';
import {getMarsBotCorp} from '@/server/automa/corps/MarsBotCorpRegistry';
import {ROBINSON_INDUSTRIES_MARSBOT_CORP} from '@/server/automa/corps/prelude/RobinsonIndustriesMarsBot';
import {createAutomaGame, resetCorpRegistry} from '../CorpGame';
import {recordingMarsBot} from '../RecordingMarsBot';

describe('RobinsonIndustriesMarsBot', () => {
  beforeEach(resetCorpRegistry);

  it('gains 10 M€ at setup, and Diversification is its action deck bonus card', () => {
    const {marsBot, calls} = recordingMarsBot();

    ROBINSON_INDUSTRIES_MARSBOT_CORP.setup!(marsBot);

    expect(calls).deep.eq(['gainMc(10)']);
    expect(ROBINSON_INDUSTRIES_MARSBOT_CORP.actionDeckBonusCard).eq(BonusCardId.B28_DIVERSIFICATION);
  });

  it('gains 10 M€ on setup', () => {
    const {marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.ROBINSON_INDUSTRIES)!;
    const mcBefore = marsBot.turnResolver.megacredits;
    marsBot.setCorpAndSetup(corp);
    expect(marsBot.turnResolver.megacredits).to.eq(mcBefore + 10);
  });
});
