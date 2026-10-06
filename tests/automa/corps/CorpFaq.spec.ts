import {expect} from 'chai';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {MarsBot} from '../../../src/server/automa/MarsBot';
import {BoardName} from '../../../src/common/boards/BoardName';
import {CardName} from '../../../src/common/cards/CardName';
import {Resource} from '../../../src/common/Resource';
import {BonusCardId} from '../../../src/common/automa/AutomaTypes';
import {createCorpBonusCard} from '../../../src/server/automa/MarsBotBonusCard';
import {getMarsBotCorp} from '../../../src/server/automa/corps/MarsBotCorpRegistry';

// Rulebook B, p.3, corporation FAQ.
function createAutomaGame(corpName: CardName): {game: IGame, human: TestPlayer, marsBot: MarsBot} {
  const [game, human] = testGame(1, {automaOption: true, venusNextExtension: true, boardName: BoardName.THARSIS});
  const marsBot = game.automaHooks!.marsBot;
  marsBot.setCorpAndSetup(getMarsBotCorp(corpName)!);
  return {game, human, marsBot};
}

function rapidSprouting(marsBot: MarsBot): void {
  marsBot['bonusResolver'].resolve(createCorpBonusCard(BonusCardId.B23_RAPID_SPROUTING));
}

describe('MarsBot corporation FAQ', () => {
  describe('Ecoline and Ecotec: the player may destroy or steal the plants on the corporation card', () => {
    it('destroys Ecoline\'s plant, and the excess is lost', () => {
      const {human, marsBot} = createAutomaGame(CardName.ECOLINE);
      rapidSprouting(marsBot);
      marsBot.turnResolver.megacredits = 20;

      marsBot.player.stock.add(Resource.PLANTS, -3, {from: {player: human}});

      expect(marsBot.getCorpState('plantResources')).eq(0);
      expect(marsBot.turnResolver.megacredits).eq(20);
    });

    it('Rapid Sprouting spends a plant the player left on Ecoline', () => {
      const {game, marsBot} = createAutomaGame(CardName.ECOLINE);
      rapidSprouting(marsBot);
      rapidSprouting(marsBot);

      expect(game.board.getGreeneries(marsBot.player)).has.length(1);
      expect(marsBot.getCorpState('plantResources')).eq(0);
    });

    it('steals Ecoline\'s plant, and the excess is lost', () => {
      const {human, marsBot} = createAutomaGame(CardName.ECOLINE);
      rapidSprouting(marsBot);
      marsBot.turnResolver.megacredits = 20;

      marsBot.player.stock.steal(Resource.PLANTS, 3, human);

      expect(human.plants).eq(1);
      expect(marsBot.getCorpState('plantResources')).eq(0);
      expect(marsBot.turnResolver.megacredits).eq(20);
    });

    it('steals Ecotec\'s plants, and the excess is lost', () => {
      const {human, marsBot} = createAutomaGame(CardName.ECOTEC);
      marsBot.turnResolver.megacredits = 20;

      marsBot.player.stock.steal(Resource.PLANTS, 3, human);

      expect(human.plants).eq(2);
      expect(marsBot.getCorpState('plantResources')).eq(0);
      expect(marsBot.turnResolver.megacredits).eq(20);
    });

    it('steals from the M€ supply when the corporation card has no plants', () => {
      const {human, marsBot} = createAutomaGame(CardName.ECOTEC);
      marsBot.setCorpState('plantResources', 0);
      marsBot.turnResolver.megacredits = 20;

      marsBot.player.stock.steal(Resource.PLANTS, 3, human);

      expect(human.plants).eq(3);
      expect(marsBot.turnResolver.megacredits).eq(17);
    });

    it('reads an Ecoline plant from older saves', () => {
      const {game} = createAutomaGame(CardName.ECOLINE);
      const serialized = JSON.parse(JSON.stringify(game.serialize()));
      serialized.automaState.corpSpecificState = {plantOnCard: 1};

      const restored = Game.deserialize(serialized).automaHooks!.marsBot;

      expect(restored.getCorpState('plantResources')).eq(1);
      expect(restored.corpSpecificState.has('plantOnCard')).is.false;
    });
  });

  describe('Aphrodite: MarsBot gains 2 M€ when Government Intervention raises Venus', () => {
    it('gains the M€ but not the TR', () => {
      const {game, marsBot} = createAutomaGame(CardName.APHRODITE);
      game.generation = 3;
      const tr = marsBot.player.terraformRating;
      const mc = marsBot.turnResolver.megacredits;

      marsBot['bonusResolver'].resolve(createCorpBonusCard(BonusCardId.B16_GOVERNMENT_INTERVENTION));

      expect(game.getVenusScaleLevel()).eq(2);
      expect(marsBot.player.terraformRating).eq(tr);
      expect(marsBot.turnResolver.megacredits).eq(mc + 2);
    });
  });
});
