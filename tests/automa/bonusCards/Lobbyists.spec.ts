import {expect} from 'chai';
import {TileType} from '@/common/TileType';
import {SpaceId} from '@/common/Types';
import {BonusCardName} from '@/common/automa/BonusCardName';
import {GlobalParameter} from '@/common/GlobalParameter';
import {createBonusCard} from '@/server/automa/bonusCards/MarsBotBonusCards';
import {Lobbyists} from '@/server/automa/bonusCards/Lobbyists';
import {setOxygenLevel, setTemperature} from '../../TestingUtils';
import {testGame} from '../../TestGame';
import {createAutomaGame} from '../corps/CorpGame';
import {recordingMarsBot} from '../corps/RecordingMarsBot';

describe('Lobbyists', () => {
  for (const run of [
    {temperature: -28, expected: -24},
    {temperature: -26, expected: -22},
    {temperature: 4, expected: 8},
  ] as const) {
    it('raises the temperature 2 steps and is destroyed when 1 or 2 steps from a bonus or the maximum: ' + JSON.stringify(run), () => {
      const [game, human, botPlayer] = testGame(2);
      const {marsBot} = recordingMarsBot({game, player: botPlayer, humanPlayer: human, megacredits: 0, interceptsParameterRaise: () => false});
      setTemperature(game, run.temperature);

      const destroyed = new Lobbyists().resolve(marsBot);

      expect(game.getTemperature()).eq(run.expected);
      expect(destroyed).is.true;
    });
  }

  it('raises the temperature 1 step when a corp cancels the raise', () => {
    const [game, human, botPlayer] = testGame(2);
    const {marsBot} = recordingMarsBot({
      game, player: botPlayer, humanPlayer: human, megacredits: 0,
      interceptsParameterRaise: (parameter) => parameter === GlobalParameter.TEMPERATURE,
    });
    setTemperature(game, -26);

    new Lobbyists().resolve(marsBot);

    expect(game.getTemperature()).eq(-24);
  });

  for (const run of [
    {oxygen: 6, expected: 8},
    {oxygen: 13, expected: 14},
  ] as const) {
    it('places a greenery, raises the oxygen once more and is destroyed when 1 or 2 steps from a bonus or the maximum: ' + JSON.stringify(run), () => {
      const [game, human, botPlayer] = testGame(2);
      const {marsBot} = recordingMarsBot({game, player: botPlayer, humanPlayer: human, megacredits: 0, interceptsParameterRaise: () => false});
      setOxygenLevel(game, run.oxygen);

      const destroyed = new Lobbyists().resolve(marsBot);

      expect(game.board.getGreeneries(botPlayer)).has.length(1);
      expect(game.getOxygenLevel()).eq(run.expected);
      expect(destroyed).is.true;
    });
  }

  for (const run of [
    // Spaces 07 (no bonus) and 43 (one plant) each touch two of these, and 43 covers more icons.
    // 43 pays 1 M€ for the plant icon and 2 M€ for each adjacent ocean.
    {oceans: ['06', '13', '34', '44'], expected: {after: ['06', '13', '34', '43', '44'], calls: ['gainMc(5)'], destroyed: true}},
    {oceans: ['34'], expected: {after: ['34'], calls: [`advanceFurthestParameter(${BonusCardName.LOBBYISTS})`], destroyed: false}},
  ] as const) {
    it('places an ocean only next to 2 oceans, and is then destroyed: ' + JSON.stringify(run), () => {
      const [game, human, botPlayer] = testGame(2);
      const {marsBot, calls} = recordingMarsBot({game, player: botPlayer, humanPlayer: human, megacredits: 0, interceptsParameterRaise: () => false});
      for (const id of run.oceans) {
        game.simpleAddTile(human, game.board.getSpaceOrThrow(id as SpaceId), {tileType: TileType.OCEAN});
      }

      const destroyed = new Lobbyists().resolve(marsBot);

      const oceanIds = game.board.getOceanSpaces().map((space) => space.id).sort();
      expect(oceanIds).deep.eq(run.expected.after);
      expect(calls).deep.eq(run.expected.calls);
      expect(destroyed).eq(run.expected.destroyed);
    });
  }

  it('otherwise raises the parameter furthest from completion and is kept', () => {
    const [game, human, botPlayer] = testGame(2);
    const {marsBot, calls} = recordingMarsBot({game, player: botPlayer, humanPlayer: human, megacredits: 0, interceptsParameterRaise: () => false});

    const destroyed = new Lobbyists().resolve(marsBot);

    expect(calls).deep.eq([`advanceFurthestParameter(${BonusCardName.LOBBYISTS})`]);
    expect(destroyed).is.false;
  });

  // Detailed options (rulebook pages 6-7)
  it('option (a): temp 1-2 from completion → raise 2 + destroy', () => {
    const {game, marsBot} = createAutomaGame();
    setTemperature(game, 4);

    const b06 = createBonusCard(BonusCardName.LOBBYISTS);

    const destroyed = marsBot.actionDeck.playBonusCard(b06);
    expect(game.getTemperature()).to.eq(8);
    expect(destroyed).to.be.true;
  });

  it('option (d): advance furthest parameter, measured in steps remaining', () => {
    const {game, marsBot} = createAutomaGame();
    // From the start temperature has 19 steps left, oxygen 14 and oceans 9

    const b06 = createBonusCard(BonusCardName.LOBBYISTS);

    const tempBefore = game.getTemperature();
    const destroyed = marsBot.actionDeck.playBonusCard(b06);
    expect(game.getTemperature()).to.eq(tempBefore + 2);
    expect(destroyed).to.be.false;
  });

  // Ocean placement tiebreakers (rulebook page 7)
  it('breaks the tie between ocean spaces by placement bonus icons', () => {
    const {game, human, marsBot} = createAutomaGame();
    setTemperature(game, -30);
    // Spaces 07 (no bonus) and 43 (one plant) each touch two oceans; 07 comes first on the board.
    for (const id of ['13', '06', '34', '44']) {
      game.simpleAddTile(human, game.board.getSpaceOrThrow(id as SpaceId), {tileType: TileType.OCEAN});
    }
    const b06 = createBonusCard(BonusCardName.LOBBYISTS);

    marsBot.actionDeck.playBonusCard(b06);

    expect(game.board.getSpaceOrThrow('43' as SpaceId).tile?.tileType).to.eq(TileType.OCEAN);
    expect(game.board.getSpaceOrThrow('07' as SpaceId).tile).is.undefined;
  });
});
