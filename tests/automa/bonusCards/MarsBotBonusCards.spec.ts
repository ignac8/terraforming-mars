import {expect} from 'chai';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {MarsBotBonusCard} from '@/server/automa/MarsBotBonusCard';
import {createBonusCard} from '@/server/automa/bonusCards/MarsBotBonusCards';
import {testGame} from '../../TestGame';
import {recordingMarsBot} from '../corps/RecordingMarsBot';

describe('MarsBotBonusCards', () => {
  it('gives a blank card for an id without a class of its own', () => {
    const [game, human, botPlayer] = testGame(2);
    const {marsBot, calls} = recordingMarsBot({game, player: botPlayer, humanPlayer: human});
    const card = createBonusCard(BonusCardId.B09_CORPORATE_COMPETITION_HELLAS);

    const kept = card.resolve(marsBot);

    expect(card.constructor).eq(MarsBotBonusCard);
    expect(calls).is.empty;
    expect(kept).is.false;
  });

  it('makes a new card each time', () => {
    expect(createBonusCard(BonusCardId.B01_METEOR_SHOWER)).not.eq(createBonusCard(BonusCardId.B01_METEOR_SHOWER));
  });
});
