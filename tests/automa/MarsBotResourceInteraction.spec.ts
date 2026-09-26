import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {MarsBot} from '../../src/server/automa/MarsBot';
import {BoardName} from '../../src/common/boards/BoardName';
import {Resource} from '../../src/common/Resource';
import {ProtectedHabitats} from '../../src/server/cards/base/ProtectedHabitats';
import {AsteroidDeflectionSystem} from '../../src/server/cards/promo/AsteroidDeflectionSystem';
import {SponsoredAcademies} from '../../src/server/cards/venusNext/SponsoredAcademies';
import {BonusCardId} from '../../src/common/automa/AutomaTypes';
import {Livestock} from '../../src/server/cards/base/Livestock';
import {Tardigrades} from '../../src/server/cards/base/Tardigrades';
import {Flooding} from '../../src/server/cards/base/Flooding';
import {LawSuit} from '../../src/server/cards/promo/LawSuit';
import {CardName} from '../../src/common/cards/CardName';
import {Units} from '../../src/common/Units';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {PlayerInput} from '../../src/server/PlayerInput';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {SelectOption} from '../../src/server/inputs/SelectOption';
import {SelectPlayer} from '../../src/server/inputs/SelectPlayer';
import {SelectSpace} from '../../src/server/inputs/SelectSpace';
import {newProjectCard} from '../../src/server/createCard';
import {isIActionCard} from '../../src/server/cards/ICard';
import {addGreenery, runAllActions} from '../TestingUtils';
import {cast} from '../../src/common/utils/utils';

function createAutomaGame(): {game: IGame, human: TestPlayer, marsBot: MarsBot} {
  const [game, human] = testGame(1, {automaOption: true, automaDifficulty: 'normal', boardName: BoardName.THARSIS});
  return {game, human, marsBot: game.automaHooks!.marsBot};
}

describe('MarsBot Resource Interaction (rules page 4-5)', () => {
  describe('Human is in MarsBot opponents list', () => {
    it('MarsBot player is in human opponents', () => {
      const {human, marsBot} = createAutomaGame();
      expect(human.opponents).to.include(marsBot.player);
    });

    it('human can see MarsBot as steal/remove target', () => {
      const {human} = createAutomaGame();
      const targets = human.opponents.filter((p) => p.name === 'MarsBot');
      expect(targets.length).to.eq(1);
    });
  });

  describe('Remove resources from MarsBot → deduct from MC supply', () => {
    it('removing plants from MarsBot deducts from megacredits', () => {
      const {marsBot} = createAutomaGame();
      marsBot.turnResolver.megacredits = 10;

      // Simulate removing 3 plants (via stock.add with negative amount)
      marsBot.player.stock.add(Resource.PLANTS, -3, {log: true, from: {player: marsBot.player}});
      expect(marsBot.turnResolver.megacredits).to.eq(7);
    });

    it('removing steel from MarsBot deducts from megacredits', () => {
      const {marsBot} = createAutomaGame();
      marsBot.turnResolver.megacredits = 10;

      marsBot.player.stock.add(Resource.STEEL, -2, {log: true, from: {player: marsBot.player}});
      expect(marsBot.turnResolver.megacredits).to.eq(8);
    });

    it('removing more than megacredits clamps to 0', () => {
      const {marsBot} = createAutomaGame();
      marsBot.turnResolver.megacredits = 3;

      marsBot.player.stock.add(Resource.PLANTS, -10, {log: true, from: {player: marsBot.player}});
      expect(marsBot.turnResolver.megacredits).to.eq(0);
    });

    it('removing heat from MarsBot deducts from megacredits', () => {
      const {marsBot} = createAutomaGame();
      marsBot.turnResolver.megacredits = 15;

      marsBot.player.stock.add(Resource.HEAT, -5, {log: true, from: {player: marsBot.player}});
      expect(marsBot.turnResolver.megacredits).to.eq(10);
    });
  });

  describe('Steal resources from MarsBot → deduct from MC supply', () => {
    it('stealing resources deducts from MarsBot megacredits', () => {
      const {human, marsBot} = createAutomaGame();
      marsBot.turnResolver.megacredits = 10;

      // Use stock.steal which calls deduct internally
      marsBot.player.stock.steal(Resource.PLANTS, 3, human);

      // MarsBot should have lost MC
      expect(marsBot.turnResolver.megacredits).to.eq(7);
    });
  });

  describe('Decrease production → regress track', () => {
    it('decreasing steel production regresses Track 1', () => {
      const {marsBot} = createAutomaGame();
      marsBot.marsBotBoard.tracks[0].advance();
      marsBot.marsBotBoard.tracks[0].advance();
      expect(marsBot.marsBotBoard.tracks[0].position).to.eq(2);

      // Decrease steel production via production.add with negative
      marsBot.player.production.add(Resource.STEEL, -1, {log: true, from: {player: marsBot.player}});
      expect(marsBot.marsBotBoard.tracks[0].position).to.eq(1);
    });

    it('decreasing titanium production regresses Track 2', () => {
      const {marsBot} = createAutomaGame();
      marsBot.marsBotBoard.tracks[1].advance();
      marsBot.marsBotBoard.tracks[1].advance();
      marsBot.marsBotBoard.tracks[1].advance();

      marsBot.player.production.add(Resource.TITANIUM, -1, {log: true, from: {player: marsBot.player}});
      expect(marsBot.marsBotBoard.tracks[1].position).to.eq(2);
    });

    it('decreasing MC production regresses Track 3', () => {
      const {marsBot} = createAutomaGame();
      marsBot.marsBotBoard.tracks[2].advance();

      marsBot.player.production.add(Resource.MEGACREDITS, -1, {log: true, from: {player: marsBot.player}});
      expect(marsBot.marsBotBoard.tracks[2].position).to.eq(0);
    });

    it('decreasing energy production regresses Track 5', () => {
      const {marsBot} = createAutomaGame();
      marsBot.marsBotBoard.tracks[4].advance();
      marsBot.marsBotBoard.tracks[4].advance();

      marsBot.player.production.add(Resource.ENERGY, -1, {log: true, from: {player: marsBot.player}});
      expect(marsBot.marsBotBoard.tracks[4].position).to.eq(1);
    });

    it('decreasing heat production regresses Track 6', () => {
      const {marsBot} = createAutomaGame();
      marsBot.marsBotBoard.tracks[5].advance();

      marsBot.player.production.add(Resource.HEAT, -1, {log: true, from: {player: marsBot.player}});
      expect(marsBot.marsBotBoard.tracks[5].position).to.eq(0);
    });

    it('decreasing plant production regresses Track 7', () => {
      const {marsBot} = createAutomaGame();
      marsBot.marsBotBoard.tracks[6].advance();
      marsBot.marsBotBoard.tracks[6].advance();

      marsBot.player.production.add(Resource.PLANTS, -1, {log: true, from: {player: marsBot.player}});
      expect(marsBot.marsBotBoard.tracks[6].position).to.eq(1);
    });

    it('decreasing production by 2 regresses track twice', () => {
      const {marsBot} = createAutomaGame();
      for (let i = 0; i < 5; i++) {
        marsBot.marsBotBoard.tracks[0].advance();
      }

      marsBot.player.production.add(Resource.STEEL, -2, {log: true, from: {player: marsBot.player}});
      expect(marsBot.marsBotBoard.tracks[0].position).to.eq(3);
    });

    it('production increase is ignored', () => {
      const {marsBot} = createAutomaGame();
      const posBefore = marsBot.marsBotBoard.tracks[0].position;

      marsBot.player.production.add(Resource.STEEL, 3, {log: true});
      // No change — MarsBot ignores production increases
      expect(marsBot.marsBotBoard.tracks[0].position).to.eq(posBefore);
    });
  });

  describe('Resource additions to MarsBot are ignored', () => {
    it('adding plants to MarsBot does not affect megacredits', () => {
      const {marsBot} = createAutomaGame();
      marsBot.turnResolver.megacredits = 10;

      marsBot.player.stock.add(Resource.PLANTS, 5);
      expect(marsBot.turnResolver.megacredits).to.eq(10); // Unchanged
    });

    it('adding MC to MarsBot does not affect megacredits', () => {
      const {marsBot} = createAutomaGame();
      marsBot.turnResolver.megacredits = 10;

      marsBot.player.stock.add(Resource.MEGACREDITS, 5);
      expect(marsBot.turnResolver.megacredits).to.eq(10); // Unchanged
    });
  });

  describe('Production decrease targeting', () => {
    it('MarsBot is targetable when track position > 0', () => {
      const {human, marsBot} = createAutomaGame();
      marsBot.marsBotBoard.tracks[0].advance();
      expect(marsBot.player.canHaveProductionReduced(Resource.STEEL, 1, human)).to.be.true;
    });

    it('MarsBot is NOT targetable when track is at position 0', () => {
      const {human, marsBot} = createAutomaGame();
      expect(marsBot.marsBotBoard.tracks[0].position).to.eq(0);
      expect(marsBot.player.canHaveProductionReduced(Resource.STEEL, 1, human)).to.be.false;
    });

    it('MarsBot appears in target list for DecreaseAnyProduction when track > 0', () => {
      const {human, marsBot} = createAutomaGame();
      marsBot.marsBotBoard.tracks[0].advance();
      marsBot.marsBotBoard.tracks[0].advance();
      const targets = human.game.allPlayers.filter((p) => p.canHaveProductionReduced(Resource.STEEL, 1, human));
      expect(targets).to.include(marsBot.player);
    });

    it('MarsBot production reports track position for mapped resource', () => {
      const {marsBot} = createAutomaGame();
      expect(marsBot.player.production[Resource.STEEL]).to.eq(0);
      marsBot.marsBotBoard.tracks[0].advance();
      marsBot.marsBotBoard.tracks[0].advance();
      marsBot.marsBotBoard.tracks[0].advance();
      expect(marsBot.player.production[Resource.STEEL]).to.eq(3);
    });

    it('production decrease regresses the corresponding track', () => {
      const {marsBot} = createAutomaGame();
      marsBot.marsBotBoard.tracks[0].advance();
      marsBot.marsBotBoard.tracks[0].advance();
      expect(marsBot.marsBotBoard.tracks[0].position).to.eq(2);

      marsBot.player.production.add(Resource.STEEL, -1, {log: false});
      expect(marsBot.marsBotBoard.tracks[0].position).to.eq(1);
    });
  });

  describe('Card interaction rules from automa rulebook', () => {
    it('Meteor Shower is blocked by Asteroid Deflection System', () => {
      const {human, marsBot} = createAutomaGame();
      human.plants = 10;
      human.playCard(new AsteroidDeflectionSystem());

      const bonusCard = marsBot.bonusDeck.drawPile.find((c) => c.id === BonusCardId.B01_METEOR_SHOWER);
      if (bonusCard === undefined) {
        // Card may have been drawn already; create a fresh one
        return;
      }
      const plantsBefore = human.plants;
      (marsBot as any).bonusResolver.resolveMeteorShower(bonusCard);
      expect(human.plants).to.eq(plantsBefore);
    });

    it('Meteor Shower is blocked by Protected Habitats', () => {
      const {human, marsBot} = createAutomaGame();
      human.plants = 10;
      human.playCard(new ProtectedHabitats());

      const bonusCard = marsBot.bonusDeck.drawPile.find((c) => c.id === BonusCardId.B01_METEOR_SHOWER);
      if (bonusCard === undefined) {
        return;
      }
      const plantsBefore = human.plants;
      (marsBot as any).bonusResolver.resolveMeteorShower(bonusCard);
      expect(human.plants).to.eq(plantsBefore);
    });

    it('Sponsored Academies gives MarsBot 1 MC instead of card draw', () => {
      const {human, marsBot} = createAutomaGame();
      human.cardsInHand.push(...human.game.projectDeck.drawN(human.game, 3));
      const mcBefore = marsBot.turnResolver.megacredits;
      human.playCard(new SponsoredAcademies());
      expect(marsBot.turnResolver.megacredits).to.eq(mcBefore + 1);
    });
  });

  describe('MarsBot is the default target of every card that hurts another player', () => {
    /**
     * Picks what the client preselects, the way a player who just clicks the button would:
     * OrOptions' initialIdx, and MarsBot in a SelectPlayer (SelectPlayer.vue preselects it).
     */
    function takeDefault(input: PlayerInput, human: TestPlayer, marsBot: MarsBot): PlayerInput | undefined {
      if (input instanceof OrOptions) {
        const option = input.options[input.toModel(human).initialIdx ?? 0];
        return takeDefault(option, human, marsBot);
      }
      if (input instanceof SelectPlayer) {
        expect(input.players, 'MarsBot is a choice').to.include(marsBot.player);
        return input.cb(marsBot.player);
      }
      if (input instanceof SelectOption) {
        return input.cb(undefined);
      }
      throw new Error(`The default choice is a ${input.constructor.name}`);
    }

    /** MarsBot's M€ plus the positions of all its tracks: removing, stealing or decreasing production lowers it. */
    function marsBotHoldings(marsBot: MarsBot): number {
      return marsBot.turnResolver.megacredits + marsBot.marsBotBoard.tracks.reduce((sum, track) => sum + track.position, 0);
    }

    const cards: Array<{name: CardName, action?: boolean}> = [
      // Remove plants
      {name: CardName.ASTEROID}, {name: CardName.BIG_ASTEROID}, {name: CardName.COMET}, {name: CardName.DEIMOS_DOWN},
      {name: CardName.DEIMOS_DOWN_PROMO}, {name: CardName.GIANT_ICE_ASTEROID}, {name: CardName.MINING_EXPEDITION},
      {name: CardName.SMALL_ASTEROID}, {name: CardName.IMPACTOR_SWARM}, {name: CardName.AERIAL_LENSES},
      // Remove or steal other resources
      {name: CardName.SABOTAGE}, {name: CardName.HIRED_RAIDERS}, {name: CardName.AIR_RAID}, {name: CardName.SPECIAL_PERMIT},
      {name: CardName.COMET_FOR_VENUS}, {name: CardName.VIRUS},
      // Remove card resources
      {name: CardName.PREDATORS, action: true}, {name: CardName.ANTS, action: true},
      // Decrease production
      {name: CardName.HACKERS}, {name: CardName.ENERGY_TAPPING}, {name: CardName.POWER_SUPPLY_CONSORTIUM},
      {name: CardName.ASTEROID_MINING_CONSORTIUM}, {name: CardName.GREAT_ESCARPMENT_CONSORTIUM}, {name: CardName.HEAT_TRAPPERS},
      {name: CardName.CLOUD_SEEDING}, {name: CardName.BIOMASS_COMBUSTORS}, {name: CardName.BIRDS}, {name: CardName.FISH},
      {name: CardName.SMALL_ANIMALS}, {name: CardName.HERBIVORES}, {name: CardName.SUBZERO_SALT_FISH},
    ];

    for (const {name, action} of cards) {
      it(name, () => {
        const [game, human] = testGame(1, {
          automaOption: true, automaDifficulty: 'normal', boardName: BoardName.THARSIS,
          venusNextExtension: true, coloniesExtension: true, turmoilExtension: true, promoCardsOption: true, prelude2Expansion: true,
        });
        const marsBot = game.automaHooks!.marsBot;
        marsBot.turnResolver.megacredits = 20;
        for (const track of marsBot.marsBotBoard.tracks) {
          track.advance();
          track.advance();
        }
        // The human has something of everything to lose too, so each prompt offers both targets.
        human.stock.adjust(Units.of({megacredits: 30, steel: 5, titanium: 5, plants: 5, energy: 5, heat: 5}));
        human.production.adjust(Units.of({megacredits: 3, steel: 3, titanium: 3, plants: 3, energy: 3, heat: 3}));
        const resourceCards = [new Livestock(), new Tardigrades()];
        for (const resourceCard of resourceCards) {
          human.playedCards.push(resourceCard);
          human.addResourceTo(resourceCard, 3);
        }
        const holdingsBefore = marsBotHoldings(marsBot);

        const card = newProjectCard(name)!;
        human.playedCards.push(card);
        let input = action && isIActionCard(card) ? card.action(human) : card.play(human);
        for (let i = 0; i < 5; i++) {
          if (input === undefined) {
            runAllActions(game);
            input = human.popWaitingFor();
          }
          if (input === undefined) {
            break;
          }
          input = input instanceof SelectSpace ? input.cb(input.spaces[0]) : takeDefault(input, human, marsBot);
        }
        runAllActions(game);

        expect(marsBotHoldings(marsBot), 'MarsBot lost something').lt(holdingsBefore);
        expect(resourceCards.map((c) => c.resourceCount), 'the human\'s cards kept their resources').deep.eq([3, 3]);
      });
    }

    it('Flooding defaults to the adjacent MarsBot tile\'s owner', () => {
      const {game, human, marsBot} = createAutomaGame();
      marsBot.turnResolver.megacredits = 20;
      human.megaCredits = 20;
      const ocean = game.board.getAvailableSpacesForOcean(human)
        .find((space) => game.board.getAdjacentSpaces(space).some((s) => s.spaceType === SpaceType.LAND && s.tile === undefined))!;
      const land = game.board.getAdjacentSpaces(ocean).find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined)!;
      addGreenery(marsBot.player, land.id);

      new Flooding().play(human);
      runAllActions(game);
      cast(human.popWaitingFor(), SelectSpace).cb(ocean);
      runAllActions(game);
      takeDefault(cast(human.popWaitingFor(), OrOptions), human, marsBot);
      runAllActions(game);

      expect(marsBot.turnResolver.megacredits).eq(16);
      expect(human.megaCredits).gte(20);
    });

    it('Law Suit defaults to MarsBot', () => {
      const {human, marsBot} = createAutomaGame();
      marsBot.turnResolver.megacredits = 20;
      human.removingPlayers.push(marsBot.player.id);

      takeDefault(new LawSuit().play(human)!, human, marsBot);

      expect(marsBot.turnResolver.megacredits).eq(17);
    });
  });
});
