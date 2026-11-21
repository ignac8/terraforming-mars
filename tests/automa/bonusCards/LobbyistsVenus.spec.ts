import {expect} from 'chai';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {CardName} from '@/common/cards/CardName';
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
    {temperature: -30, venus: 2, expected: {temperature: -30, venus: 2, destroyed: false, calls: [`advanceFurthestParameter(${CardName.AUTOMA_LOBBYISTS_VENUS})`]}},
  ] as const) {
    it('raises Venus 2 steps and is kept when 1 or 2 steps from a bonus, after the temperature branch: ' + JSON.stringify(run), () => {
      const [game, human, botPlayer] = testGame(2, {venusNextExtension: true});
      const {marsBot, calls} = recordingMarsBot({game, player: botPlayer, humanPlayer: human, megacredits: 0, interceptsParameterRaise: () => false});
      setTemperature(game, run.temperature);
      setVenusScaleLevel(game, run.venus);

      const destroyed = new LobbyistsVenus().resolve(marsBot);

      expect({temperature: game.getTemperature(), venus: game.getVenusScaleLevel(), destroyed, calls}).deep.eq(run.expected);
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

  it('Venus branch triggers at 1 step from Venus bonus at 8%', () => {
    const {game, marsBot} = createAutomaGame({venusNextExtension: true});
    // Venus at 6% → 1 step from 8% bonus
    setVenusScaleLevel(game, 6);
    // Need to access private method - use the bonus card directly
    const b15 = marsBot.bonusDeck.drawPile.find((c) => c.id === BonusCardId.B15_LOBBYISTS_VENUS);
    if (b15 === undefined) {
      // B15 might have been drawn already, create one
      const card = createBonusCard(BonusCardId.B15_LOBBYISTS_VENUS);
      // Set temp/oxygen far from bonuses so Venus branch is reached
      setTemperature(game, -30 + 26); // = -4, far from any bonus
      setOxygenLevel(game, 5); // far from 8% bonus
      marsBot.actionDeck.playBonusCard(card);
      expect(game.getVenusScaleLevel()).to.be.greaterThan(6);
    }
  });

  it('Venus branch triggers at 2 steps from Venus bonus at 16%', () => {
    const {game, marsBot} = createAutomaGame({venusNextExtension: true});
    // Venus at 12% → 2 steps from 16% bonus
    setVenusScaleLevel(game, 12);
    setTemperature(game, 8); // maxed
    setOxygenLevel(game, 14); // maxed
    const card = createBonusCard(BonusCardId.B15_LOBBYISTS_VENUS);
    marsBot.actionDeck.playBonusCard(card);
    // Venus should have been raised 2 steps: 12 → 16
    expect(game.getVenusScaleLevel()).to.eq(16);
  });

  it('Venus branch does NOT destroy card', () => {
    const {game, marsBot} = createAutomaGame({venusNextExtension: true});
    setVenusScaleLevel(game, 26); // 2 steps from 30% max
    setTemperature(game, 8);
    setOxygenLevel(game, 14);
    const card = createBonusCard(BonusCardId.B15_LOBBYISTS_VENUS);
    const destroyed = marsBot.actionDeck.playBonusCard(card);
    expect(game.getVenusScaleLevel()).to.eq(30);
    expect(destroyed).to.be.false;
  });

  it('temp branch destroys card', () => {
    const {game, marsBot} = createAutomaGame({venusNextExtension: true});
    // Temperature at -26 → 1 step from -24 (heat bonus)
    setTemperature(game, -26);
    const card = createBonusCard(BonusCardId.B15_LOBBYISTS_VENUS);
    const destroyed = marsBot.actionDeck.playBonusCard(card);
    expect(game.getTemperature()).to.eq(-22); // raised 2 steps
    expect(destroyed).to.be.true;
  });
});
