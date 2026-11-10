import {expect} from 'chai';
import {TileType} from '@/common/TileType';
import {CardName} from '@/common/cards/CardName';
import {getMarsBotCorp} from '@/server/automa/corps/MarsBotCorpRegistry';
import {THARSIS_REPUBLIC_MARSBOT_CORP} from '@/server/automa/corps/base/TharsisRepublicMarsBot';
import {createAutomaGame, resetCorpRegistry} from '../CorpGame';
import {recordingMarsBot} from '../RecordingMarsBot';

// Track index on the Tharsis board
const EVENT = 2;

describe('TharsisRepublicMarsBot', () => {
  beforeEach(resetCorpRegistry);

  // The Setup box (rulebook B p.1)
  it('places a city at setup', () => {
    const {marsBot, calls} = recordingMarsBot();

    THARSIS_REPUBLIC_MARSBOT_CORP.setup!(marsBot);

    expect(calls).deep.eq(['placeCity()']);
  });

  for (const run of [
    {tileType: TileType.CITY, byMarsBot: true, tile: 'MarsBot city', calls: [`advanceTrack(${EVENT})`]},
    {tileType: TileType.CITY, byMarsBot: false, tile: 'player city', calls: ['gainMc(2)']},
    {tileType: TileType.CAPITAL, byMarsBot: false, tile: 'player capital', calls: ['gainMc(2)']},
    {tileType: TileType.GREENERY, byMarsBot: false, tile: 'player greenery', calls: []},
  ]) {
    it(`advances the event track for its own city and gains 2 M€ for a city of the player, ${run.tile}`, () => {
      const {marsBot, calls} = recordingMarsBot();

      THARSIS_REPUBLIC_MARSBOT_CORP.effect!.onTilePlaced!(marsBot, run.byMarsBot, run.tileType, marsBot.game.board.spaces[0]);

      expect(calls).deep.eq(run.calls);
    });
  }

  it('gains 2 M€ when any city placed', () => {
    const {marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.THARSIS_REPUBLIC)!;
    marsBot.setCorpAndSetup(corp);
    const mcBefore = marsBot.turnResolver.megacredits;
    corp.effect!.onTilePlaced!(marsBot, false, TileType.CITY, marsBot.game.board.spaces[0]);
    expect(marsBot.turnResolver.megacredits).to.eq(mcBefore + 2);
  });

  it('advances event track when MarsBot places city, without the 2 M€', () => {
    const {marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.THARSIS_REPUBLIC)!;
    marsBot.setCorpAndSetup(corp);
    marsBot.turnResolver.advanceTrack = (i) => {
      marsBot.marsBotBoard.tracks[i].position++;
      return true;
    };
    const mcBefore = marsBot.turnResolver.megacredits;
    const eventBefore = marsBot.marsBotBoard.tracks[2].position;
    corp.effect!.onTilePlaced!(marsBot, true, TileType.CITY, marsBot.game.board.spaces[0]);
    expect(marsBot.marsBotBoard.tracks[2].position).to.eq(eventBefore + 1);
    expect(marsBot.turnResolver.megacredits).to.eq(mcBefore);
  });

  it('does not trigger on greenery placement', () => {
    const {marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.THARSIS_REPUBLIC)!;
    marsBot.setCorpAndSetup(corp);
    const mcBefore = marsBot.turnResolver.megacredits;
    corp.effect!.onTilePlaced!(marsBot, false, TileType.GREENERY, marsBot.game.board.spaces[0]);
    expect(marsBot.turnResolver.megacredits).to.eq(mcBefore);
  });
});
