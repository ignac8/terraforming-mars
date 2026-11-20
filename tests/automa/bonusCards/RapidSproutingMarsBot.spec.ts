import {expect} from 'chai';
import {TileType} from '@/common/TileType';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {CardName} from '@/common/cards/CardName';
import {createBonusCard} from '@/server/automa/MarsBotBonusCard';
import {getMarsBotCorp} from '@/server/automa/corps/MarsBotCorpRegistry';
import {RapidSproutingMarsBot} from '@/server/automa/bonusCards/RapidSproutingMarsBot';
import {createAutomaGame, resetCorpRegistry} from '../corps/CorpGame';
import {recordingMarsBot} from '../corps/RecordingMarsBot';
import {bonusDeckIds} from './BonusCardGame';

describe('RapidSproutingMarsBot', () => {
  beforeEach(resetCorpRegistry);

  for (const run of [
    {plants: 0, expected: {plants: 1, calls: []}},
    {plants: 1, expected: {plants: 0, calls: ['maybePlaceGreenery()']}},
  ] as const) {
    it('puts a plant on the corporation card, or spends it on a greenery: ' + JSON.stringify(run), () => {
      const {marsBot, calls, corpState} = recordingMarsBot();
      corpState.set('plantResources', run.plants);

      new RapidSproutingMarsBot().resolve(marsBot);

      expect({plants: corpState.get('plantResources'), calls}).deep.eq(run.expected);
    });
  }

  it('spends the plant when no greenery can be placed', () => {
    const {marsBot, corpState} = recordingMarsBot({maybePlaceGreenery: () => false});
    corpState.set('plantResources', 1);

    new RapidSproutingMarsBot().resolve(marsBot);

    expect(corpState.get('plantResources')).eq(0);
  });

  it('first puts a plant on the corporation card, then spends it on a greenery', () => {
    const {game, marsBot} = createAutomaGame();
    const greeneries = () => game.board.getGreeneries(marsBot.player).length;

    marsBot['bonusResolver'].resolve(createBonusCard(BonusCardId.B23_RAPID_SPROUTING));
    expect(greeneries()).to.eq(0);
    expect(marsBot.getCorpState('plantResources')).to.eq(1);

    marsBot['bonusResolver'].resolve(createBonusCard(BonusCardId.B23_RAPID_SPROUTING));
    expect(greeneries()).to.eq(1);
    expect(game.getOxygenLevel()).to.eq(1);
    expect(marsBot.getCorpState('plantResources')).to.eq(0);
  });

  // The plant is spent anyway (our reading), and a bonus card that can't resolve is not a Failed Action
  // (rulebook A, p.5)
  it('spends the plant and takes no Failed Action when no greenery can be placed', () => {
    const {game, human, marsBot} = createAutomaGame();
    marsBot.setCorpState('plantResources', 1);
    for (const space of game.board.getAvailableSpacesOnLand(human)) {
      game.simpleAddTile(human, space, {tileType: TileType.GREENERY});
    }

    marsBot['bonusResolver'].resolve(createBonusCard(BonusCardId.B23_RAPID_SPROUTING));

    expect(game.board.getGreeneries(marsBot.player)).is.empty;
    expect(marsBot.getCorpState('plantResources')).to.eq(0);
    expect(marsBot.turnResolver.megacredits).to.eq(0);
  });

  it('stays out of the bonus deck after it resolves, as the generation card of a corporation', () => {
    const {marsBot} = createAutomaGame();
    marsBot.setCorpAndSetup(getMarsBotCorp(CardName.ECOLINE)!);

    marsBot['bonusResolver'].resolve(createBonusCard(BonusCardId.B23_RAPID_SPROUTING));

    expect(bonusDeckIds(marsBot)).does.not.include(BonusCardId.B23_RAPID_SPROUTING);
  });
});
