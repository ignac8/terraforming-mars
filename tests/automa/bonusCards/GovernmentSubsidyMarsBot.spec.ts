import {expect} from 'chai';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {createBonusCard} from '@/server/automa/bonusCards/MarsBotBonusCards';
import {GovernmentSubsidyMarsBot} from '@/server/automa/bonusCards/GovernmentSubsidyMarsBot';
import {testGame} from '../../TestGame';
import {createAutomaGame, resetCorpRegistry} from '../corps/CorpGame';
import {recordingMarsBot} from '../corps/RecordingMarsBot';

describe('GovernmentSubsidyMarsBot', () => {
  beforeEach(resetCorpRegistry);

  it('raises TR 1 step', () => {
    const [game, human, botPlayer] = testGame(2);
    const {marsBot} = recordingMarsBot({game, player: botPlayer, humanPlayer: human});
    const tr = botPlayer.terraformRating;

    new GovernmentSubsidyMarsBot().resolve(marsBot);

    expect(botPlayer.terraformRating).eq(tr + 1);
  });

  it('raises TR 1 step', () => {
    const {marsBot} = createAutomaGame();
    const tr = marsBot.player.terraformRating;
    marsBot['bonusResolver'].resolve(createBonusCard(BonusCardId.B31_GOVERNMENT_SUBSIDY));
    expect(marsBot.player.terraformRating).to.eq(tr + 1);
    expect(marsBot.turnResolver.megacredits).to.eq(0);
  });
});
