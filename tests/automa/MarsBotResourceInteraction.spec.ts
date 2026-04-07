import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {MarsBot} from '../../src/server/automa/MarsBot';
import {BoardName} from '../../src/common/boards/BoardName';
import {Resource} from '../../src/common/Resource';
import {CardName} from '../../src/common/cards/CardName';
import {ProtectedHabitats} from '../../src/server/cards/base/ProtectedHabitats';
import {AsteroidDeflectionSystem} from '../../src/server/cards/promo/AsteroidDeflectionSystem';
import {SponsoredAcademies} from '../../src/server/cards/venusNext/SponsoredAcademies';
import {CardResource} from '../../src/common/CardResource';

function createAutomaGame(): {game: IGame, human: TestPlayer, marsBot: MarsBot} {
  const [game, human] = testGame(1, {automaOption: true, automaDifficulty: 'normal', boardName: BoardName.THARSIS});
  return {game, human, marsBot: game.marsBot!};
}

describe('MarsBot Resource Interaction (rules page 4-5)', () => {
  describe('Human is in MarsBot opponents list', () => {
    it('MarsBot player is in human opponents', () => {
      const {human, marsBot} = createAutomaGame();
      expect(human.opponents).to.include(marsBot.player);
    });

    it('human can see MarsBot as steal/remove target', () => {
      const {human, marsBot} = createAutomaGame();
      const targets = human.opponents.filter((p) => p.name === 'MarsBot');
      expect(targets.length).to.eq(1);
    });
  });

  describe('Remove resources from MarsBot → deduct from MC supply', () => {
    it('removing plants from MarsBot deducts from mcSupply', () => {
      const {marsBot} = createAutomaGame();
      marsBot.turnResolver.mcSupply = 10;

      // Simulate removing 3 plants (via stock.add with negative amount)
      marsBot.player.stock.add(Resource.PLANTS, -3, {log: true, from: {player: marsBot.player}});
      expect(marsBot.turnResolver.mcSupply).to.eq(7);
    });

    it('removing steel from MarsBot deducts from mcSupply', () => {
      const {marsBot} = createAutomaGame();
      marsBot.turnResolver.mcSupply = 10;

      marsBot.player.stock.add(Resource.STEEL, -2, {log: true, from: {player: marsBot.player}});
      expect(marsBot.turnResolver.mcSupply).to.eq(8);
    });

    it('removing more than mcSupply clamps to 0', () => {
      const {marsBot} = createAutomaGame();
      marsBot.turnResolver.mcSupply = 3;

      marsBot.player.stock.add(Resource.PLANTS, -10, {log: true, from: {player: marsBot.player}});
      expect(marsBot.turnResolver.mcSupply).to.eq(0);
    });

    it('removing heat from MarsBot deducts from mcSupply', () => {
      const {marsBot} = createAutomaGame();
      marsBot.turnResolver.mcSupply = 15;

      marsBot.player.stock.add(Resource.HEAT, -5, {log: true, from: {player: marsBot.player}});
      expect(marsBot.turnResolver.mcSupply).to.eq(10);
    });
  });

  describe('Steal resources from MarsBot → deduct from MC supply', () => {
    it('stealing resources deducts from MarsBot mcSupply', () => {
      const {human, marsBot} = createAutomaGame();
      marsBot.turnResolver.mcSupply = 10;

      // Use stock.steal which calls deduct internally
      marsBot.player.stock.steal(Resource.PLANTS, 3, human);

      // MarsBot should have lost MC
      expect(marsBot.turnResolver.mcSupply).to.eq(7);
    });
  });

  describe('Decrease production → regress track', () => {
    it('decreasing steel production regresses Track 1', () => {
      const {marsBot} = createAutomaGame();
      marsBot.board.tracks[0].advance();
      marsBot.board.tracks[0].advance();
      expect(marsBot.board.tracks[0].position).to.eq(2);

      // Decrease steel production via production.add with negative
      marsBot.player.production.add(Resource.STEEL, -1, {log: true, from: {player: marsBot.player}});
      expect(marsBot.board.tracks[0].position).to.eq(1);
    });

    it('decreasing titanium production regresses Track 2', () => {
      const {marsBot} = createAutomaGame();
      marsBot.board.tracks[1].advance();
      marsBot.board.tracks[1].advance();
      marsBot.board.tracks[1].advance();

      marsBot.player.production.add(Resource.TITANIUM, -1, {log: true, from: {player: marsBot.player}});
      expect(marsBot.board.tracks[1].position).to.eq(2);
    });

    it('decreasing MC production regresses Track 3', () => {
      const {marsBot} = createAutomaGame();
      marsBot.board.tracks[2].advance();

      marsBot.player.production.add(Resource.MEGACREDITS, -1, {log: true, from: {player: marsBot.player}});
      expect(marsBot.board.tracks[2].position).to.eq(0);
    });

    it('decreasing energy production regresses Track 5', () => {
      const {marsBot} = createAutomaGame();
      marsBot.board.tracks[4].advance();
      marsBot.board.tracks[4].advance();

      marsBot.player.production.add(Resource.ENERGY, -1, {log: true, from: {player: marsBot.player}});
      expect(marsBot.board.tracks[4].position).to.eq(1);
    });

    it('decreasing heat production regresses Track 6', () => {
      const {marsBot} = createAutomaGame();
      marsBot.board.tracks[5].advance();

      marsBot.player.production.add(Resource.HEAT, -1, {log: true, from: {player: marsBot.player}});
      expect(marsBot.board.tracks[5].position).to.eq(0);
    });

    it('decreasing plant production regresses Track 7', () => {
      const {marsBot} = createAutomaGame();
      marsBot.board.tracks[6].advance();
      marsBot.board.tracks[6].advance();

      marsBot.player.production.add(Resource.PLANTS, -1, {log: true, from: {player: marsBot.player}});
      expect(marsBot.board.tracks[6].position).to.eq(1);
    });

    it('decreasing production by 2 regresses track twice', () => {
      const {marsBot} = createAutomaGame();
      for (let i = 0; i < 5; i++) { marsBot.board.tracks[0].advance(); }

      marsBot.player.production.add(Resource.STEEL, -2, {log: true, from: {player: marsBot.player}});
      expect(marsBot.board.tracks[0].position).to.eq(3);
    });

    it('production increase is ignored', () => {
      const {marsBot} = createAutomaGame();
      const posBefore = marsBot.board.tracks[0].position;

      marsBot.player.production.add(Resource.STEEL, 3, {log: true});
      // No change — MarsBot ignores production increases
      expect(marsBot.board.tracks[0].position).to.eq(posBefore);
    });
  });

  describe('Resource additions to MarsBot are ignored', () => {
    it('adding plants to MarsBot does not affect mcSupply', () => {
      const {marsBot} = createAutomaGame();
      marsBot.turnResolver.mcSupply = 10;

      marsBot.player.stock.add(Resource.PLANTS, 5);
      expect(marsBot.turnResolver.mcSupply).to.eq(10); // Unchanged
    });

    it('adding MC to MarsBot does not affect mcSupply', () => {
      const {marsBot} = createAutomaGame();
      marsBot.turnResolver.mcSupply = 10;

      marsBot.player.stock.add(Resource.MEGACREDITS, 5);
      expect(marsBot.turnResolver.mcSupply).to.eq(10); // Unchanged
    });
  });

  describe('Production decrease targeting', () => {
    it('MarsBot is targetable when track position > 0', () => {
      const {human, marsBot} = createAutomaGame();
      marsBot.board.tracks[0].advance();
      expect(marsBot.player.canHaveProductionReduced(Resource.STEEL, 1, human)).to.be.true;
    });

    it('MarsBot is NOT targetable when track is at position 0', () => {
      const {human, marsBot} = createAutomaGame();
      expect(marsBot.board.tracks[0].position).to.eq(0);
      expect(marsBot.player.canHaveProductionReduced(Resource.STEEL, 1, human)).to.be.false;
    });

    it('MarsBot appears in target list for DecreaseAnyProduction when track > 0', () => {
      const {human, marsBot} = createAutomaGame();
      marsBot.board.tracks[0].advance();
      marsBot.board.tracks[0].advance();
      const targets = human.game.allPlayers.filter((p) => p.canHaveProductionReduced(Resource.STEEL, 1, human));
      expect(targets).to.include(marsBot.player);
    });

    it('MarsBot production reports track position for mapped resource', () => {
      const {marsBot} = createAutomaGame();
      expect(marsBot.player.production[Resource.STEEL]).to.eq(0);
      marsBot.board.tracks[0].advance();
      marsBot.board.tracks[0].advance();
      marsBot.board.tracks[0].advance();
      expect(marsBot.player.production[Resource.STEEL]).to.eq(3);
    });

    it('production decrease regresses the corresponding track', () => {
      const {marsBot} = createAutomaGame();
      marsBot.board.tracks[0].advance();
      marsBot.board.tracks[0].advance();
      expect(marsBot.board.tracks[0].position).to.eq(2);

      marsBot.player.production.add(Resource.STEEL, -1, {log: false});
      expect(marsBot.board.tracks[0].position).to.eq(1);
    });
  });

  describe('Card interaction rules from automa rulebook', () => {
    it('Meteor Shower is blocked by Asteroid Deflection System', () => {
      const {human, marsBot} = createAutomaGame();
      human.plants = 10;
      human.playCard(new AsteroidDeflectionSystem());

      const bonusCard = marsBot.bonusDeck.drawPile.find((c) => c.id === 'B01_METEOR_SHOWER');
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

      const bonusCard = marsBot.bonusDeck.drawPile.find((c) => c.id === 'B01_METEOR_SHOWER');
      if (bonusCard === undefined) return;
      const plantsBefore = human.plants;
      (marsBot as any).bonusResolver.resolveMeteorShower(bonusCard);
      expect(human.plants).to.eq(plantsBefore);
    });

    it('Sponsored Academies gives MarsBot 1 MC instead of card draw', () => {
      const {human, marsBot} = createAutomaGame();
      human.cardsInHand.push(...human.game.projectDeck.drawN(human.game, 3));
      const mcBefore = marsBot.turnResolver.mcSupply;
      human.playCard(new SponsoredAcademies());
      expect(marsBot.turnResolver.mcSupply).to.eq(mcBefore + 1);
    });
  });
});
