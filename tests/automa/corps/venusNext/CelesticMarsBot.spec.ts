import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {getMarsBotCorp} from '@/server/automa/corps/MarsBotCorpRegistry';
import {CELESTIC_MARSBOT_CORP} from '@/server/automa/corps/venusNext/CelesticMarsBot';
import {MicroMills} from '@/server/cards/base/MicroMills';
import {createAutomaGame, resetCorpRegistry} from '../CorpGame';
import {recordingMarsBot} from '../RecordingMarsBot';

describe('CelesticMarsBot', () => {
  beforeEach(resetCorpRegistry);

  // The Setup and Round Start boxes (rulebook B p.1, p.3), then the effect
  it('adds a floater at setup, at each round start and for each Failed Action', () => {
    const {marsBot, calls} = recordingMarsBot();

    CELESTIC_MARSBOT_CORP.setup!(marsBot);
    CELESTIC_MARSBOT_CORP.roundStart!(marsBot);
    CELESTIC_MARSBOT_CORP.effect!.onFailedAction!(marsBot);

    expect(calls).deep.eq(['addFloaters(1)', 'addFloaters(1)', 'addFloaters(1)']);
  });

  it('gains floater on setup', () => {
    const {marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.CELESTIC)!;
    marsBot.setCorpAndSetup(corp);
    expect(marsBot.floaters).to.eq(1);
  });

  it('gains floater each round start', () => {
    const {marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.CELESTIC)!;
    marsBot.setCorpAndSetup(corp);
    corp.roundStart!(marsBot);
    expect(marsBot.floaters).to.eq(2);
  });

  it('gains 1 more floater with each Failed Action', () => {
    const {marsBot} = createAutomaGame();
    marsBot.corp = getMarsBotCorp(CardName.CELESTIC)!;
    const mc = marsBot.turnResolver.megacredits;

    marsBot.turnResolver.resolveProjectCard(new MicroMills()); // No tags: a Failed Action

    expect(marsBot.floaters).to.eq(1);
    expect(marsBot.turnResolver.megacredits).to.eq(mc + 5);
  });
});
