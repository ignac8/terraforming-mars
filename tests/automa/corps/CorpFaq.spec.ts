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
import {runAllActions, setVenusScaleLevel} from '../../TestingUtils';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {cast} from '../../../src/common/utils/utils';

// Rulebook B, p.3, corporation FAQ.
function createAutomaGame(corpName: CardName): {game: IGame, human: TestPlayer, marsBot: MarsBot} {
  const [game, human] = testGame(1, {automaOption: true, venusNextExtension: true, boardName: BoardName.THARSIS});
  const marsBot = game.automaHooks!.marsBot;
  marsBot.setCorpAndSetup(getMarsBotCorp(corpName)!);
  return {game, human, marsBot};
}

/** Answers the player's choice between the plants on MarsBot's corporation card (0) and its other sources (1). */
function chooseSource(game: IGame, human: TestPlayer, index: number): void {
  runAllActions(game);
  cast(human.popWaitingFor(), OrOptions).options[index].process({type: 'option'}, human);
  runAllActions(game);
}

function rapidSprouting(marsBot: MarsBot): void {
  marsBot['bonusResolver'].resolve(createCorpBonusCard(BonusCardId.B23_RAPID_SPROUTING));
}

describe('MarsBot corporation FAQ', () => {
  describe('Ecoline and Ecotec: the player may destroy or steal the plants on the corporation card', () => {
    it('destroys Ecoline\'s plant, and the excess is lost', () => {
      const {game, human, marsBot} = createAutomaGame(CardName.ECOLINE);
      rapidSprouting(marsBot);
      marsBot.turnResolver.megacredits = 20;

      marsBot.player.stock.add(Resource.PLANTS, -3, {from: {player: human}});
      chooseSource(game, human, 0);

      expect(marsBot.getCorpState('plantResources')).eq(0);
      expect(marsBot.turnResolver.megacredits).eq(20);
    });

    // "you can remove either 2mc or that 1 plant. You cannot remove 1 MC and 1 plant" (TDaver, BGG 3341536)
    it('lets the player destroy from the M€ supply instead, leaving the plant', () => {
      const {game, human, marsBot} = createAutomaGame(CardName.ECOLINE);
      rapidSprouting(marsBot);
      marsBot.turnResolver.megacredits = 20;

      marsBot.player.stock.add(Resource.PLANTS, -3, {from: {player: human}});
      chooseSource(game, human, 1);

      expect(marsBot.getCorpState('plantResources')).eq(1);
      expect(marsBot.turnResolver.megacredits).eq(17);
    });

    it('takes the plant without asking when the M€ supply is empty', () => {
      const {game, human, marsBot} = createAutomaGame(CardName.ECOLINE);
      rapidSprouting(marsBot);

      marsBot.player.stock.add(Resource.PLANTS, -3, {from: {player: human}});
      runAllActions(game);

      expect(human.popWaitingFor()).is.undefined;
      expect(marsBot.getCorpState('plantResources')).eq(0);
    });

    it('Rapid Sprouting spends a plant the player left on Ecoline', () => {
      const {game, marsBot} = createAutomaGame(CardName.ECOLINE);
      rapidSprouting(marsBot);
      rapidSprouting(marsBot);

      expect(game.board.getGreeneries(marsBot.player)).has.length(1);
      expect(marsBot.getCorpState('plantResources')).eq(0);
    });

    it('steals Ecoline\'s plant, and the excess is lost', () => {
      const {game, human, marsBot} = createAutomaGame(CardName.ECOLINE);
      rapidSprouting(marsBot);
      marsBot.turnResolver.megacredits = 20;

      marsBot.player.stock.steal(Resource.PLANTS, 3, human);
      chooseSource(game, human, 0);

      expect(human.plants).eq(1);
      expect(marsBot.getCorpState('plantResources')).eq(0);
      expect(marsBot.turnResolver.megacredits).eq(20);
    });

    it('steals Ecotec\'s plants, and the excess is lost', () => {
      const {game, human, marsBot} = createAutomaGame(CardName.ECOTEC);
      marsBot.turnResolver.megacredits = 20;

      marsBot.player.stock.steal(Resource.PLANTS, 4, human);
      chooseSource(game, human, 0);

      expect(human.plants).eq(3);
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

    it('counts the card\'s plants for Crash Site Cleanup and Law Suit when the player destroys them', () => {
      const {game, human, marsBot} = createAutomaGame(CardName.ECOLINE);
      rapidSprouting(marsBot);
      marsBot.turnResolver.megacredits = 20;

      marsBot.player.stock.add(Resource.PLANTS, -3, {from: {player: human}});
      chooseSource(game, human, 0);

      expect(game.someoneHasRemovedOtherPlayersPlants).is.true;
      expect(marsBot.player.removingPlayers).to.include(human.id);
    });

    it('counts the card\'s plants for Crash Site Cleanup and Law Suit when the player steals them', () => {
      const {game, human, marsBot} = createAutomaGame(CardName.ECOTEC);

      marsBot.player.stock.steal(Resource.PLANTS, 4, human);
      runAllActions(game);

      expect(marsBot.getCorpState('plantResources')).eq(0);
      expect(game.someoneHasRemovedOtherPlayersPlants).is.true;
      expect(marsBot.player.removingPlayers).to.include(human.id);
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

    it('gains Aphrodite\'s M€ but not the Venus 8% bonus', () => {
      const {game, marsBot} = createAutomaGame(CardName.APHRODITE);
      game.generation = 3;
      setVenusScaleLevel(game, 6);
      const mc = marsBot.turnResolver.megacredits;

      marsBot['bonusResolver'].resolve(createCorpBonusCard(BonusCardId.B16_GOVERNMENT_INTERVENTION));

      expect(game.getVenusScaleLevel()).eq(8);
      expect(marsBot.turnResolver.megacredits).eq(mc + 2);
    });
  });
});
