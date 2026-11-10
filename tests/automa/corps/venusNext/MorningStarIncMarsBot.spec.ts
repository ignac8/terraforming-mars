import {expect} from 'chai';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {BoardName} from '@/common/boards/BoardName';
import {CardName} from '@/common/cards/CardName';
import {IGame} from '@/server/IGame';
import {MarsBot} from '@/server/automa/MarsBot';
import {THARSIS_MARSBOT_BOARD} from '@/server/automa/boards/TharsisMarsBot';
import {VENUS_MARSBOT_TRACK} from '@/server/automa/boards/VenusMarsBot';
import {getMarsBotCorp} from '@/server/automa/corps/MarsBotCorpRegistry';
import {MORNING_STAR_INC_MARSBOT_CORP} from '@/server/automa/corps/venusNext/MorningStarIncMarsBot';
import {testGame} from '../../../TestGame';
import {resetCorpRegistry} from '../CorpGame';
import {recordingMarsBot, trackCubes} from '../RecordingMarsBot';

function createVenusAutomaGame(): {game: IGame, marsBot: MarsBot} {
  const [game] = testGame(1, {
    automa: true,
    automaDifficulty: 'normal',
    venusNextExtension: true,
    boardName: BoardName.THARSIS,
  });
  return {game, marsBot: game.automaHooks!.marsBot};
}

describe('MorningStarIncMarsBot', () => {
  beforeEach(resetCorpRegistry);

  // With Venus Next the bonus deck's Lobbyists is B15. Its silver resource cubes sit on the Venus track (rulebook B p.3)
  it('swaps Lobbyists for Venusian Lobby, and its silver resource cubes pay 5 M€', () => {
    const {marsBot, calls} = recordingMarsBot();

    MORNING_STAR_INC_MARSBOT_CORP.setup!(marsBot);
    MORNING_STAR_INC_MARSBOT_CORP.effect!.onTrackCubeTrigger!(marsBot, 7, 5, 'credit');

    expect(calls).deep.eq(['removeBonusCard(B06)', 'removeBonusCard(B15)', 'addBonusCardToBonusDeck(B26)', 'gainMc(5)']);
    expect(trackCubes(MORNING_STAR_INC_MARSBOT_CORP, [...THARSIS_MARSBOT_BOARD, VENUS_MARSBOT_TRACK]))
      .deep.eq([5, 6, 7, 8, 9, 11, 12].map((position) => `venus credit ${position}`));
  });

  for (const position of [5, 6, 7, 8, 9, 11, 12]) {
    it('places credit cubes on the Venus track: ' + JSON.stringify({position}), () => {
      const {marsBot} = createVenusAutomaGame();
      marsBot.setCorpAndSetup(getMarsBotCorp(CardName.MORNING_STAR_INC)!);
      expect(marsBot.hasCubeAt(7, position)?.cubeType, `Venus ${position}`).to.eq('credit');
    });
  }

  it('places no credit cube on Venus #10', () => {
    const {marsBot} = createVenusAutomaGame();
    marsBot.setCorpAndSetup(getMarsBotCorp(CardName.MORNING_STAR_INC)!);
    expect(marsBot.hasCubeAt(7, 10)).to.be.undefined;
  });

  it('pays 5 M€, a silver resource cube, when the Venus track reaches a credit cube', () => {
    const {marsBot} = createVenusAutomaGame();
    marsBot.setCorpAndSetup(getMarsBotCorp(CardName.MORNING_STAR_INC)!);
    marsBot.marsBotBoard.tracks[7].position = 4;
    const mc = marsBot.turnResolver.megacredits;

    marsBot.advanceTrack(7);

    expect(marsBot.turnResolver.megacredits).to.eq(mc + 5);
  });

  it('removes the Venus Next Lobbyists from the bonus deck', () => {
    const {marsBot} = createVenusAutomaGame();
    const deck = marsBot['bonusDeck'];
    const ids = () => [...deck.drawPile, ...deck.discardPile, ...marsBot.actionDeck].map((c) => (c as {id?: BonusCardId}).id);
    expect(ids()).to.include(BonusCardId.B15_LOBBYISTS_VENUS);
    marsBot.setCorpAndSetup(getMarsBotCorp(CardName.MORNING_STAR_INC)!);
    expect(ids()).to.not.include(BonusCardId.B15_LOBBYISTS_VENUS);
    expect(ids()).to.include(BonusCardId.B26_VENUSIAN_LOBBY);
  });
});
