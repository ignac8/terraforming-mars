import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {getMarsBotCorp} from '@/server/automa/corps/MarsBotCorpRegistry';
import {VIRON_MARSBOT_CORP} from '@/server/automa/corps/venusNext/VironMarsBot';
import {Asteroid} from '@/server/cards/base/Asteroid';
import {Birds} from '@/server/cards/base/Birds';
import {Decomposers} from '@/server/cards/base/Decomposers';
import {MarsUniversity} from '@/server/cards/base/MarsUniversity';
import {createAutomaGame, resetCorpRegistry} from '../CorpGame';
import {recordingMarsBot} from '../RecordingMarsBot';

describe('VironMarsBot', () => {
  beforeEach(resetCorpRegistry);

  // C25: a blue card with a red arrow is an active card with an action
  it('adds a floater and scores a VP for each active card with an action', () => {
    const {marsBot, calls} = recordingMarsBot();
    const effect = VIRON_MARSBOT_CORP.effect!;

    effect.onProjectCardResolved!(marsBot, new Birds());
    effect.onProjectCardResolved!(marsBot, new Decomposers());

    expect(calls).deep.eq(['addFloaters(1)']);
    expect(effect.vpBonus!(marsBot)).eq(1);
  });

  it('gains a floater and counts the card only for active cards with an action', () => {
    const {marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.VIRON)!;
    marsBot.setCorpAndSetup(corp);
    corp.effect!.onProjectCardResolved!(marsBot, new Birds());
    expect(marsBot.floaters).to.eq(1);
    expect(marsBot.corpSpecificState.get('actionCardsPlayed')).to.eq(1);

    // An active card with only an effect, and an event, count for nothing
    corp.effect!.onProjectCardResolved!(marsBot, new MarsUniversity());
    corp.effect!.onProjectCardResolved!(marsBot, new Asteroid());
    expect(marsBot.floaters).to.eq(1);
    expect(marsBot.corpSpecificState.get('actionCardsPlayed')).to.eq(1);
  });

  it('vpBonus returns action card count', () => {
    const {marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.VIRON)!;
    marsBot.setCorpAndSetup(corp);
    marsBot.corpSpecificState.set('actionCardsPlayed', 5);
    expect(corp.effect!.vpBonus!(marsBot)).to.eq(5);
  });
});
