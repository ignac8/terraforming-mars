import {expect} from 'chai';
import {BonusCardName} from '@/common/automa/BonusCardName';
import {GlobalParameter} from '@/common/GlobalParameter';
import {TileType} from '@/common/TileType';
import {SpaceId} from '@/common/Types';
import {createBonusCard} from '@/server/automa/bonusCards/MarsBotBonusCards';
import {LobbyistsVenus} from '@/server/automa/bonusCards/LobbyistsVenus';
import {setOxygenLevel, setTemperature, setVenusScaleLevel} from '../../TestingUtils';
import {testGame} from '../../TestGame';
import {createAutomaGame} from '../corps/CorpGame';
import {recordingMarsBot} from '../corps/RecordingMarsBot';

describe('LobbyistsVenus', () => {
  for (const run of [
    {temperature: -26, venus: 6, expected: {temperature: -22, venus: 6, destroyed: true, calls: []}},
    {temperature: -30, venus: 6, expected: {temperature: -30, venus: 10, destroyed: false, calls: []}},
    {temperature: -30, venus: 12, expected: {temperature: -30, venus: 16, destroyed: false, calls: []}},
    {temperature: -30, venus: 2, expected: {temperature: -30, venus: 2, destroyed: false, calls: [`advanceFurthestParameter(${BonusCardName.LOBBYISTS_VENUS})`]}},
  ] as const) {
    it('raises Venus 2 steps and is kept when 1 or 2 steps from a bonus, after the temperature branch: ' + JSON.stringify(run), () => {
      const [game, human, botPlayer] = testGame(2, {venusNextExtension: true});
      const {marsBot, calls} = recordingMarsBot({game, player: botPlayer, humanPlayer: human, megacredits: 0, interceptsParameterRaise: () => false});
      setTemperature(game, run.temperature);
      setVenusScaleLevel(game, run.venus);

      const destroyed = new LobbyistsVenus().resolve(marsBot);

      expect(game.getTemperature()).eq(run.expected.temperature);
      expect(game.getVenusScaleLevel()).eq(run.expected.venus);
      expect(destroyed).eq(run.expected.destroyed);
      expect(calls).deep.eq(run.expected.calls);
    });
  }

  it('raises Venus 1 step when a corp cancels the raise', () => {
    const [game, human, botPlayer] = testGame(2, {venusNextExtension: true});
    const {marsBot} = recordingMarsBot({
      game, player: botPlayer, humanPlayer: human, megacredits: 0,
      interceptsParameterRaise: (parameter) => parameter === GlobalParameter.VENUS,
    });
    setVenusScaleLevel(game, 6);

    new LobbyistsVenus().resolve(marsBot);

    expect(game.getVenusScaleLevel()).eq(8);
  });

  it('places no ocean next to 2 oceans', () => {
    const [game, human, botPlayer] = testGame(2, {venusNextExtension: true});
    const {marsBot} = recordingMarsBot({game, player: botPlayer, humanPlayer: human, megacredits: 0, interceptsParameterRaise: () => false});
    for (const id of ['13', '06', '34', '44']) {
      game.simpleAddTile(human, game.board.getSpaceOrThrow(id as SpaceId), {tileType: TileType.OCEAN});
    }

    new LobbyistsVenus().resolve(marsBot);

    expect(game.board.getOceanSpaces()).has.length(4);
  });

  it('Venus branch triggers at 2 steps from Venus bonus at 16%', () => {
    const {game, marsBot} = createAutomaGame({venusNextExtension: true});
    // Venus at 12% is 2 steps from the bonus at 16%.
    setVenusScaleLevel(game, 12);
    setTemperature(game, 8); // maxed
    setOxygenLevel(game, 14); // maxed
    const card = createBonusCard(BonusCardName.LOBBYISTS_VENUS);
    marsBot.actionDeck.playBonusCard(card);
    expect(game.getVenusScaleLevel()).to.eq(16);
  });

  it('Venus branch does NOT destroy card', () => {
    const {game, marsBot} = createAutomaGame({venusNextExtension: true});
    setVenusScaleLevel(game, 26); // 2 steps from 30% max
    setTemperature(game, 8);
    setOxygenLevel(game, 14);
    const card = createBonusCard(BonusCardName.LOBBYISTS_VENUS);
    const destroyed = marsBot.actionDeck.playBonusCard(card);
    expect(game.getVenusScaleLevel()).to.eq(30);
    expect(destroyed).to.be.false;
  });

  it('temp branch destroys card', () => {
    const {game, marsBot} = createAutomaGame({venusNextExtension: true});
    // Temperature at -26 is 1 step from the heat bonus at -24.
    setTemperature(game, -26);
    const card = createBonusCard(BonusCardName.LOBBYISTS_VENUS);
    const destroyed = marsBot.actionDeck.playBonusCard(card);
    expect(game.getTemperature()).to.eq(-22);
    expect(destroyed).to.be.true;
  });
});
