import {expect} from 'chai';
import {BonusCardName} from '@/common/automa/BonusCardName';
import {CardName} from '@/common/cards/CardName';
import {getMarsBotCorp} from '@/server/automa/corps/MarsBotCorpRegistry';
import {RobinsonIndustriesMarsBot} from '@/server/automa/corps/prelude/RobinsonIndustriesMarsBot';
import {createAutomaGame, resetCorpRegistry} from '../CorpGame';
import {recordingMarsBot} from '../RecordingMarsBot';

describe('RobinsonIndustriesMarsBot', () => {
  beforeEach(resetCorpRegistry);

  it('gains 10 M€ at setup, and Diversification is its action deck bonus card', () => {
    const {marsBot, calls} = recordingMarsBot();

    new RobinsonIndustriesMarsBot().setup(marsBot);

    expect(calls).deep.eq(['gainMc(10)']);
    expect(new RobinsonIndustriesMarsBot().actionDeckBonusCard).eq(BonusCardName.DIVERSIFICATION);
  });

  it('gains 10 M€ on setup', () => {
    const {marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.ROBINSON_INDUSTRIES)!;
    const mcBefore = marsBot.megacredits;
    marsBot.setCorpAndSetup(corp);
    expect(marsBot.megacredits).to.eq(mcBefore + 10);
  });
});
