import {expect} from 'chai';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {BoardName} from '@/common/boards/BoardName';
import {CardName} from '@/common/cards/CardName';
import {MAX_VENUS_SCALE} from '@/common/constants';
import {createBonusCard} from '@/server/automa/bonusCards/MarsBotBonusCards';
import {getMarsBotCorp} from '@/server/automa/corps/MarsBotCorpRegistry';
import {AphroditeMarsBot} from '@/server/automa/corps/venusNext/AphroditeMarsBot';
import {testGame} from '../../../TestGame';
import {setVenusScaleLevel} from '../../../TestingUtils';
import {createCorpFaqGame, resetCorpRegistry} from '../CorpGame';
import {recordingMarsBot} from '../RecordingMarsBot';

describe('AphroditeMarsBot', () => {
  beforeEach(resetCorpRegistry);

  it('gains 2 M€ for each step Venus is raised', () => {
    const {marsBot, calls} = recordingMarsBot();

    new AphroditeMarsBot().onVenusRaised(marsBot, 3);

    expect(calls).deep.eq(['gainMc(6)']);
  });

  it('gains 2 M€ for every step Venus is raised', () => {
    const [game, human] = testGame(1, {automa: true, venusNextExtension: true, boardName: BoardName.THARSIS});
    const marsBot = game.automaHooks!.marsBot;
    marsBot.setCorpAndSetup(getMarsBotCorp(CardName.APHRODITE)!);
    const mc = marsBot.megacredits;

    game.increaseVenusScaleLevel(human, 2);
    expect(marsBot.megacredits).to.eq(mc + 4);

    game.increaseVenusScaleLevel(marsBot.player, 1);
    expect(marsBot.megacredits).to.eq(mc + 6);
  });

  it('gains nothing once Venus is maxed', () => {
    const [game, human] = testGame(1, {automa: true, venusNextExtension: true, boardName: BoardName.THARSIS});
    const marsBot = game.automaHooks!.marsBot;
    marsBot.setCorpAndSetup(getMarsBotCorp(CardName.APHRODITE)!);
    setVenusScaleLevel(game, MAX_VENUS_SCALE);
    const mc = marsBot.megacredits;

    game.increaseVenusScaleLevel(human, 2);

    expect(marsBot.megacredits).to.eq(mc);
  });

  it('gains the M€ but not the TR when Government Intervention raises Venus', () => {
    const {game, marsBot} = createCorpFaqGame(CardName.APHRODITE);
    game.generation = 3;
    const tr = marsBot.player.terraformRating;
    const mc = marsBot.megacredits;

    marsBot.actionDeck.playBonusCard(createBonusCard(BonusCardId.B16_GOVERNMENT_INTERVENTION));

    expect(game.getVenusScaleLevel()).eq(2);
    expect(marsBot.player.terraformRating).eq(tr);
    expect(marsBot.megacredits).eq(mc + 2);
  });

  it('gains the Aphrodite M€ but not the Venus 8% bonus when Government Intervention raises Venus', () => {
    const {game, marsBot} = createCorpFaqGame(CardName.APHRODITE);
    game.generation = 3;
    setVenusScaleLevel(game, 6);
    const mc = marsBot.megacredits;

    marsBot.actionDeck.playBonusCard(createBonusCard(BonusCardId.B16_GOVERNMENT_INTERVENTION));

    expect(game.getVenusScaleLevel()).eq(8);
    expect(marsBot.megacredits).eq(mc + 2);
  });
});
