import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {MarsBot} from '../../src/server/automa/MarsBot';
import {BoardName} from '../../src/common/boards/BoardName';
import {ColonyName} from '../../src/common/colonies/ColonyName';
import {CardResource} from '../../src/common/CardResource';
import {Resource} from '../../src/common/Resource';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {PlayerInput} from '../../src/server/PlayerInput';
import {StealResources} from '../../src/server/deferredActions/StealResources';
import {RemoveResourcesFromCard} from '../../src/server/deferredActions/RemoveResourcesFromCard';
import {HiredRaiders} from '../../src/server/cards/base/HiredRaiders';
import {Tardigrades} from '../../src/server/cards/base/Tardigrades';
import {Units} from '../../src/common/Units';
import {runAllActions} from '../TestingUtils';
import {cast} from '../../src/common/utils/utils';

// C-25 (rulebook C, p.5): resources on Ceres, Luna, Io, Enceladus, Ganymede, Callisto, Miranda
// and Triton are resources of the indicated type for the player's cards. The player may steal or
// remove from them as usual, and picks between them and the M€ supply (BGG 3599965).
describe('MarsBot colony storage as stock resources (C-25)', () => {
  function createAutomaGame(): {game: IGame, human: TestPlayer, marsBot: MarsBot} {
    const [game, human] = testGame(1, {
      automaOption: true, automaDifficulty: 'normal', boardName: BoardName.THARSIS, coloniesExtension: true,
    });
    return {game, human, marsBot: game.automaHooks!.marsBot};
  }

  function titleOf(input: PlayerInput): string {
    return typeof input.title === 'string' ? input.title : input.title.message;
  }

  /** Runs the deferred actions and returns the choice they ask the human for. */
  function prompt(game: IGame, human: TestPlayer): OrOptions {
    runAllActions(game);
    return cast(human.popWaitingFor(), OrOptions);
  }

  function choose(or: OrOptions, index: number, human: TestPlayer, amount?: number) {
    or.options[index].process(amount === undefined ? {type: 'option'} : {type: 'amount', amount}, human);
  }

  describe('stealing', () => {
    it('asks the player to pick the M€ supply or the Ceres storage', () => {
      const {game, human, marsBot} = createAutomaGame();
      marsBot.turnResolver.megacredits = 10;
      marsBot.shippingBoard.storage.set(ColonyName.CERES, 3);

      marsBot.player.stock.steal(Resource.STEEL, 2, human);

      // Nothing happens until the player answers
      expect(human.steel).eq(0);
      const or = prompt(game, human);
      expect(or.options.map(titleOf)).deep.eq([
        'Take ${0} from MarsBot\'s M€ supply',
        'Take ${0} from MarsBot\'s ${1} colony storage',
        'Take ${0} from MarsBot\'s ${1} colony storage and ${2} from its M€ supply',
      ]);
    });

    it('takes from the Ceres storage when the player chooses it', () => {
      const {game, human, marsBot} = createAutomaGame();
      marsBot.turnResolver.megacredits = 10;
      marsBot.shippingBoard.storage.set(ColonyName.CERES, 3);

      marsBot.player.stock.steal(Resource.STEEL, 2, human);
      choose(prompt(game, human), 1, human);

      expect(marsBot.shippingBoard.get(ColonyName.CERES)).eq(1);
      expect(marsBot.turnResolver.megacredits).eq(10);
      expect(human.steel).eq(2);
    });

    it('takes from the M€ supply when the player chooses it', () => {
      const {game, human, marsBot} = createAutomaGame();
      marsBot.turnResolver.megacredits = 10;
      marsBot.shippingBoard.storage.set(ColonyName.CERES, 3);

      marsBot.player.stock.steal(Resource.STEEL, 2, human);
      choose(prompt(game, human), 0, human);

      expect(marsBot.shippingBoard.get(ColonyName.CERES)).eq(3);
      expect(marsBot.turnResolver.megacredits).eq(8);
      expect(human.steel).eq(2);
    });

    it('splits one steal between the supply and the storage', () => {
      const {game, human, marsBot} = createAutomaGame();
      marsBot.turnResolver.megacredits = 10;
      marsBot.shippingBoard.storage.set(ColonyName.CERES, 3);

      marsBot.player.stock.steal(Resource.STEEL, 3, human);
      const or = prompt(game, human);
      expect(titleOf(or.options[2])).eq('Take how many from MarsBot\'s ${0} colony storage? The rest comes from its M€ supply');
      expect(or.options[2].toModel(human)).deep.include({type: 'amount', min: 1, max: 2});
      choose(or, 2, human, 2);

      expect(marsBot.shippingBoard.get(ColonyName.CERES)).eq(1);
      expect(marsBot.turnResolver.megacredits).eq(9);
      expect(human.steel).eq(3);
    });

    it('rejects a split outside what the steal allows', () => {
      const {game, human, marsBot} = createAutomaGame();
      marsBot.turnResolver.megacredits = 10;
      marsBot.shippingBoard.storage.set(ColonyName.CERES, 3);

      marsBot.player.stock.steal(Resource.STEEL, 3, human);
      const or = prompt(game, human);

      expect(() => choose(or, 2, human, 3)).to.throw(/too high/);
      expect(() => choose(or, 2, human, 0)).to.throw(/too low/);
    });

    it('gives the thief only what is left when two steals are queued', () => {
      const {game, human, marsBot} = createAutomaGame();
      marsBot.turnResolver.megacredits = 3;
      marsBot.shippingBoard.storage.set(ColonyName.CERES, 3);

      marsBot.player.stock.steal(Resource.STEEL, 4, human);
      marsBot.player.stock.steal(Resource.STEEL, 4, human);
      // 2 from storage and 2 from the supply leaves 1 in each
      choose(prompt(game, human), 0, human, 2);
      expect(human.steel).eq(4);
      // The second steal was sized for 6 in stock: it can only take the 2 that remain
      choose(prompt(game, human), 0, human, 3);

      expect(marsBot.shippingBoard.get(ColonyName.CERES)).eq(0);
      expect(marsBot.turnResolver.megacredits).eq(0);
      expect(human.steel).eq(6);
    });

    it('offers a single mixed option when only one split is possible', () => {
      const {game, human, marsBot} = createAutomaGame();
      marsBot.turnResolver.megacredits = 1;
      marsBot.shippingBoard.storage.set(ColonyName.CERES, 5);

      marsBot.player.stock.steal(Resource.STEEL, 4, human);
      const or = prompt(game, human);

      // The supply covers 1, so at least 3 must come from storage: all 4, or exactly 3 + 1
      expect(or.options.map(titleOf)).deep.eq([
        'Take ${0} from MarsBot\'s ${1} colony storage',
        'Take ${0} from MarsBot\'s ${1} colony storage and ${2} from its M€ supply',
      ]);
      choose(or, 1, human);
      expect(marsBot.shippingBoard.get(ColonyName.CERES)).eq(2);
      expect(marsBot.turnResolver.megacredits).eq(0);
      expect(human.steel).eq(4);
    });

    it('does not ask when the storage is empty, and takes M€ as before', () => {
      const {game, human, marsBot} = createAutomaGame();
      marsBot.turnResolver.megacredits = 10;

      marsBot.player.stock.steal(Resource.STEEL, 2, human);

      expect(marsBot.turnResolver.megacredits).eq(8);
      expect(human.steel).eq(2);
      runAllActions(game);
      expect(human.popWaitingFor()).is.undefined;
    });

    it('ignores a storage area that holds another resource', () => {
      const {game, human, marsBot} = createAutomaGame();
      marsBot.turnResolver.megacredits = 10;
      marsBot.shippingBoard.storage.set(ColonyName.TRITON, 4);

      marsBot.player.stock.steal(Resource.STEEL, 2, human);

      expect(marsBot.turnResolver.megacredits).eq(8);
      expect(marsBot.shippingBoard.get(ColonyName.TRITON)).eq(4);
      runAllActions(game);
      expect(human.popWaitingFor()).is.undefined;
    });

    it('takes from the storage without asking when the M€ supply is empty', () => {
      const {game, human, marsBot} = createAutomaGame();
      marsBot.turnResolver.megacredits = 0;
      marsBot.shippingBoard.storage.set(ColonyName.CERES, 3);

      marsBot.player.stock.steal(Resource.STEEL, 2, human);

      expect(marsBot.shippingBoard.get(ColonyName.CERES)).eq(1);
      expect(human.steel).eq(2);
      runAllActions(game);
      expect(human.popWaitingFor()).is.undefined;
    });

    it('takes both when asked for more than either holds, without asking', () => {
      const {game, human, marsBot} = createAutomaGame();
      marsBot.turnResolver.megacredits = 1;
      marsBot.shippingBoard.storage.set(ColonyName.CERES, 2);

      marsBot.player.stock.steal(Resource.STEEL, 5, human);

      expect(marsBot.turnResolver.megacredits).eq(0);
      expect(marsBot.shippingBoard.get(ColonyName.CERES)).eq(0);
      expect(human.steel).eq(3);
      runAllActions(game);
      expect(human.popWaitingFor()).is.undefined;
    });

    const resources: Array<[Resource, ColonyName]> = [
      [Resource.MEGACREDITS, ColonyName.LUNA],
      [Resource.STEEL, ColonyName.CERES],
      [Resource.TITANIUM, ColonyName.TRITON],
      [Resource.PLANTS, ColonyName.GANYMEDE],
      [Resource.ENERGY, ColonyName.CALLISTO],
      [Resource.HEAT, ColonyName.IO],
    ];
    for (const [resource, colony] of resources) {
      it(`steals ${resource} from ${colony} storage`, () => {
        const {game, human, marsBot} = createAutomaGame();
        marsBot.turnResolver.megacredits = 10;
        marsBot.shippingBoard.storage.set(colony, 4);
        human.stock.override(Units.EMPTY);

        marsBot.player.stock.steal(resource, 2, human);
        choose(prompt(game, human), 1, human);

        expect(marsBot.shippingBoard.get(colony)).eq(2);
        expect(marsBot.turnResolver.megacredits).eq(10);
        expect(human.stock.get(resource)).eq(2);
      });
    }

    it('is reachable through the Steal Resources action when only the storage holds steel', () => {
      const {game, human, marsBot} = createAutomaGame();
      marsBot.turnResolver.megacredits = 0;
      marsBot.shippingBoard.storage.set(ColonyName.CERES, 3);

      const or = cast(new StealResources(human, Resource.STEEL, 2).execute(), OrOptions);
      or.options[0].process({type: 'option'}, human);
      runAllActions(game);

      expect(marsBot.shippingBoard.get(ColonyName.CERES)).eq(1);
      expect(human.steel).eq(2);
    });

    it('is offered by Hired Raiders as a steel steal and then asks for the source', () => {
      const {game, human, marsBot} = createAutomaGame();
      marsBot.turnResolver.megacredits = 10;
      marsBot.shippingBoard.storage.set(ColonyName.CERES, 5);

      const cardOptions = cast(new HiredRaiders().play(human), OrOptions);
      const steelOption = cardOptions.options.find((o) => titleOf(o).includes('steel'))!;
      steelOption.cb(undefined);
      const or = prompt(game, human);
      choose(or, 1, human);

      expect(marsBot.shippingBoard.get(ColonyName.CERES)).eq(3);
      expect(human.steel).eq(2);
    });

    it('reports the storage as part of the resource a card checks for', () => {
      const {marsBot} = createAutomaGame();
      marsBot.turnResolver.megacredits = 4;
      marsBot.shippingBoard.storage.set(ColonyName.CERES, 3);
      marsBot.shippingBoard.storage.set(ColonyName.LUNA, 2);

      expect(marsBot.player.steel).eq(7);
      expect(marsBot.player.titanium).eq(4);
      expect(marsBot.player.megaCredits).eq(6);
    });

    it('lets a card target MarsBot whose only steel is in storage', () => {
      const {human, marsBot} = createAutomaGame();
      marsBot.turnResolver.megacredits = 0;
      marsBot.shippingBoard.storage.set(ColonyName.CERES, 3);

      expect(StealResources.getCandidates(human, Resource.STEEL, 2)).deep.eq([marsBot.player]);
    });

    it('keeps spending to the M€ supply', () => {
      const {marsBot} = createAutomaGame();
      marsBot.turnResolver.megacredits = 2;
      marsBot.shippingBoard.storage.set(ColonyName.LUNA, 5);

      expect(marsBot.megacredits).eq(2);
      expect(marsBot.player.stock.has(Units.of({megacredits: 3}))).is.false;
    });
  });

  describe('removing', () => {
    it('removes titanium from the Triton storage when the player chooses it', () => {
      const {game, human, marsBot} = createAutomaGame();
      marsBot.turnResolver.megacredits = 10;
      marsBot.shippingBoard.storage.set(ColonyName.TRITON, 4);

      marsBot.player.attack(human, Resource.TITANIUM, 3, {log: true});
      runAllActions(game);
      const or = cast(human.popWaitingFor(), OrOptions);
      choose(or, 1, human);

      expect(marsBot.shippingBoard.get(ColonyName.TRITON)).eq(1);
      expect(marsBot.turnResolver.megacredits).eq(10);
      expect(human.titanium).eq(0);
    });

    it('removes M€ from the Luna storage', () => {
      const {game, human, marsBot} = createAutomaGame();
      marsBot.turnResolver.megacredits = 10;
      marsBot.shippingBoard.storage.set(ColonyName.LUNA, 4);

      marsBot.player.attack(human, Resource.MEGACREDITS, 4, {log: true});
      runAllActions(game);
      choose(cast(human.popWaitingFor(), OrOptions), 1, human);

      expect(marsBot.shippingBoard.get(ColonyName.LUNA)).eq(0);
      expect(marsBot.turnResolver.megacredits).eq(10);
    });

    it('removes from the M€ supply when the player chooses it', () => {
      const {game, human, marsBot} = createAutomaGame();
      marsBot.turnResolver.megacredits = 10;
      marsBot.shippingBoard.storage.set(ColonyName.TRITON, 4);

      marsBot.player.attack(human, Resource.TITANIUM, 3, {log: true});
      runAllActions(game);
      choose(cast(human.popWaitingFor(), OrOptions), 0, human);

      expect(marsBot.shippingBoard.get(ColonyName.TRITON)).eq(4);
      expect(marsBot.turnResolver.megacredits).eq(7);
    });

    it('does not ask when the storage is empty', () => {
      const {game, human, marsBot} = createAutomaGame();
      marsBot.turnResolver.megacredits = 10;

      marsBot.player.attack(human, Resource.TITANIUM, 3, {log: true});
      runAllActions(game);

      expect(marsBot.turnResolver.megacredits).eq(7);
      expect(human.popWaitingFor()).is.undefined;
    });

    it('lets Law Suit see the removal from storage', () => {
      const {game, human, marsBot} = createAutomaGame();
      marsBot.turnResolver.megacredits = 0;
      marsBot.shippingBoard.storage.set(ColonyName.GANYMEDE, 4);

      marsBot.player.attack(human, Resource.PLANTS, 2, {log: true});
      runAllActions(game);

      expect(marsBot.shippingBoard.get(ColonyName.GANYMEDE)).eq(2);
      expect(marsBot.player.removingPlayers).include(human.id);
    });

    it('does not offer storage for removals that no player makes', () => {
      const {marsBot} = createAutomaGame();
      marsBot.turnResolver.megacredits = 10;
      marsBot.shippingBoard.storage.set(ColonyName.GANYMEDE, 4);

      marsBot.player.stock.deduct(Resource.PLANTS, 3, {log: true, from: {globalEvent: 'Eco Sabotage' as any}});

      expect(marsBot.turnResolver.megacredits).eq(7);
      expect(marsBot.shippingBoard.get(ColonyName.GANYMEDE)).eq(4);
    });

    it('card resource removal from the M€ supply leaves the Luna storage alone', () => {
      const {human, marsBot} = createAutomaGame();
      marsBot.turnResolver.megacredits = 10;
      marsBot.shippingBoard.storage.set(ColonyName.LUNA, 4);
      marsBot.shippingBoard.storage.set(ColonyName.ENCELADUS, 3);

      const tardigrades = new Tardigrades();
      human.playedCards.push(tardigrades);
      const options = cast(new RemoveResourcesFromCard(human, CardResource.MICROBE, 2, {source: 'opponents'}).execute(), OrOptions);
      options.options[0].process({type: 'option'}, human);

      expect(marsBot.turnResolver.megacredits).eq(8);
      expect(marsBot.shippingBoard.get(ColonyName.LUNA)).eq(4);
    });
  });

  describe('Ecoline and Ecotec plants', () => {
    // FAQ (rulebook B, p.3): the player may target the corporation card; TDaver, BGG 3341536
    it('lets the player steal plants from the corp card', () => {
      const {game, human, marsBot} = createAutomaGame();
      marsBot.turnResolver.megacredits = 10;
      marsBot.shippingBoard.storage.set(ColonyName.GANYMEDE, 4);
      marsBot.corpSpecificState.set('plantResources', 3);

      marsBot.player.stock.steal(Resource.PLANTS, 2, human);
      const or = prompt(game, human);
      expect(or.options.map(titleOf)).deep.eq([
        '${0} ${1} plants from MarsBot\'s corporation card (the rest is lost)',
        '${0} ${1} from MarsBot\'s M€ supply or its ${2} colony storage',
      ]);
      choose(or, 0, human);

      expect(marsBot.corpSpecificState.get('plantResources')).eq(1);
      expect(marsBot.shippingBoard.get(ColonyName.GANYMEDE)).eq(4);
      expect(marsBot.turnResolver.megacredits).eq(10);
      expect(human.plants).eq(2);
      runAllActions(game);
      expect(human.popWaitingFor()).is.undefined;
    });

    it('lets the player steal from the Ganymede storage instead, leaving the corp card', () => {
      const {game, human, marsBot} = createAutomaGame();
      marsBot.turnResolver.megacredits = 10;
      marsBot.shippingBoard.storage.set(ColonyName.GANYMEDE, 4);
      marsBot.corpSpecificState.set('plantResources', 3);

      marsBot.player.stock.steal(Resource.PLANTS, 2, human);
      choose(prompt(game, human), 1, human);
      choose(prompt(game, human), 1, human);

      expect(marsBot.corpSpecificState.get('plantResources')).eq(3);
      expect(marsBot.shippingBoard.get(ColonyName.GANYMEDE)).eq(2);
      expect(human.plants).eq(2);
    });

    it('takes a removal that no player makes off the corp card, without asking', () => {
      const {game, human, marsBot} = createAutomaGame();
      marsBot.turnResolver.megacredits = 10;
      marsBot.corpSpecificState.set('plantResources', 3);

      marsBot.player.stock.add(Resource.PLANTS, -2);
      runAllActions(game);

      expect(human.popWaitingFor()).is.undefined;
      expect(marsBot.corpSpecificState.get('plantResources')).eq(1);
      expect(marsBot.turnResolver.megacredits).eq(10);
    });

    it('lets the player remove plants from the corp card', () => {
      const {game, human, marsBot} = createAutomaGame();
      marsBot.turnResolver.megacredits = 10;
      marsBot.shippingBoard.storage.set(ColonyName.GANYMEDE, 4);
      marsBot.corpSpecificState.set('plantResources', 3);

      marsBot.player.attack(human, Resource.PLANTS, 5, {log: true});
      choose(prompt(game, human), 0, human);
      runAllActions(game);

      // The excess is lost
      expect(marsBot.corpSpecificState.get('plantResources')).eq(0);
      expect(marsBot.shippingBoard.get(ColonyName.GANYMEDE)).eq(4);
      expect(marsBot.turnResolver.megacredits).eq(10);
      expect(human.popWaitingFor()).is.undefined;
    });

    it('offers the Ganymede storage once the corp card is out of plants', () => {
      const {game, human, marsBot} = createAutomaGame();
      marsBot.turnResolver.megacredits = 10;
      marsBot.shippingBoard.storage.set(ColonyName.GANYMEDE, 4);
      marsBot.corpSpecificState.set('plantResources', 0);

      marsBot.player.stock.steal(Resource.PLANTS, 2, human);
      choose(prompt(game, human), 1, human);

      expect(marsBot.shippingBoard.get(ColonyName.GANYMEDE)).eq(2);
      expect(human.plants).eq(2);
    });
  });

  describe('state', () => {
    it('keeps the storage in the serialized shipping board', () => {
      const {game, human, marsBot} = createAutomaGame();
      marsBot.turnResolver.megacredits = 10;
      marsBot.shippingBoard.storage.set(ColonyName.CERES, 3);

      marsBot.player.stock.steal(Resource.STEEL, 2, human);
      choose(prompt(game, human), 1, human);

      expect(marsBot.shippingBoard.serialize()).deep.eq({[ColonyName.CERES]: 1});
    });

    it('leaves a game without MarsBot alone', () => {
      const [, player, opponent] = testGame(2);
      opponent.stock.steel = 5;

      opponent.stock.steal(Resource.STEEL, 2, player);

      expect(opponent.steel).eq(3);
      expect(player.steel).eq(2);
    });
  });
});
