import {expect} from 'chai';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {BoardName} from '@/common/boards/BoardName';
import {GlobalParameter} from '@/common/GlobalParameter';
import {Tag} from '@/common/cards/Tag';
import {createBonusCard} from '@/server/automa/MarsBotBonusCard';
import {MarsBotBoard} from '@/server/automa/MarsBotBoard';
import {THARSIS_MARSBOT_BOARD} from '@/server/automa/boards/TharsisMarsBot';
import {VENUS_MARSBOT_TRACK} from '@/server/automa/boards/VenusMarsBot';
import {VenusianLobbyMarsBot} from '@/server/automa/bonusCards/VenusianLobbyMarsBot';
import {testGame} from '../../TestGame';
import {resetCorpRegistry} from '../corps/CorpGame';
import {TRACK, recordingMarsBot} from '../corps/RecordingMarsBot';
import {maxTracks} from './BonusCardGame';

describe('VenusianLobbyMarsBot', () => {
  beforeEach(resetCorpRegistry);

  for (const run of [
    {intercepted: false, venus: 2},
    {intercepted: true, venus: 0},
  ] as const) {
    it('raises Venus unless a corp cancels it, advances the Venus track and raises the furthest parameter: ' + JSON.stringify(run), () => {
      const [game, human, botPlayer] = testGame(2, {venusNextExtension: true});
      const marsBotBoard = new MarsBotBoard([...THARSIS_MARSBOT_BOARD, VENUS_MARSBOT_TRACK]);
      const {marsBot, calls} = recordingMarsBot({
        game, player: botPlayer, humanPlayer: human, megacredits: 0, marsBotBoard,
        interceptsParameterRaise: (parameter) => run.intercepted && parameter === GlobalParameter.VENUS,
      });

      new VenusianLobbyMarsBot().resolve(marsBot);

      expect(game.getVenusScaleLevel()).eq(run.venus);
      expect(calls).deep.eq([`advanceTrack(${marsBotBoard.tagToTrack[Tag.VENUS]})`]);
      // Temperature has the most steps left
      expect(game.getTemperature()).eq(-28);
    });
  }

  it('advances the least-advanced track without Venus Next', () => {
    const [game, human, botPlayer] = testGame(2);
    const {marsBot, calls} = recordingMarsBot({game, player: botPlayer, humanPlayer: human, megacredits: 0, interceptsParameterRaise: () => false});
    for (const track of marsBot.marsBotBoard.tracks) {
      track.position = 3;
    }
    marsBot.marsBotBoard.tracks[TRACK.science].position = 1;

    new VenusianLobbyMarsBot().resolve(marsBot);

    expect(calls).deep.eq([`advanceTrack(${TRACK.science})`]);
    expect(game.getTemperature()).eq(-30);
  });

  it('raises Venus, advances the Venus track and raises the furthest parameter', () => {
    const [game] = testGame(1, {automa: true, venusNextExtension: true, boardName: BoardName.THARSIS});
    const marsBot = game.automaHooks!.marsBot;
    marsBot['bonusResolver'].resolve(createBonusCard(BonusCardId.B26_VENUSIAN_LOBBY));
    expect(game.getVenusScaleLevel()).to.eq(2);
    expect(marsBot.marsBotBoard.tracks[7].position).to.eq(1);
    // Everything is at its start, and temperature has the most steps left (19, against 14 and 9)
    expect(game.getTemperature()).to.eq(-28);
    expect(game.getOxygenLevel()).to.eq(0);
  });

  // A bonus card that can't resolve takes no Failed Action (rulebook A p.5 B.a; BGG 3599965 and
  // 3623553, njshaw2). Project cards still do.
  it('takes no Failed Action when advancing a maxed track', () => {
    const [game] = testGame(1, {automa: true, venusNextExtension: true, boardName: BoardName.THARSIS});
    const marsBot = game.automaHooks!.marsBot;
    maxTracks(marsBot);
    marsBot['bonusResolver'].resolve(createBonusCard(BonusCardId.B26_VENUSIAN_LOBBY));
    expect(game.getVenusScaleLevel()).to.eq(2);
    expect(marsBot.turnResolver.megacredits).to.eq(0);
  });
});
