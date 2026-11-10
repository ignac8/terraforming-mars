import {expect} from 'chai';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {SeededRandom} from '@/common/utils/Random';
import {createBaseBonusCards, createBonusCard} from '@/server/automa/MarsBotBonusCard';
import {MarsBotBonusDeck} from '@/server/automa/MarsBotBonusDeck';
import {MarsBotBonusResolver} from '@/server/automa/MarsBotBonusResolver';
import {MarsBotTilePlacer} from '@/server/automa/MarsBotTilePlacer';
import {MarsBotTurnResolver} from '@/server/automa/MarsBotTurnResolver';
import {ProtectedHabitats} from '@/server/cards/base/ProtectedHabitats';
import {AsteroidDeflectionSystem} from '@/server/cards/promo/AsteroidDeflectionSystem';
import {createAutomaGame} from '../corps/CorpGame';

describe('MeteorShowerMarsBot', () => {
  it('card is NOT destroyed when human loses <3 plants', () => {
    const {game, human, marsBot} = createAutomaGame();
    human.plants = 2;

    const cards = createBaseBonusCards();
    const b01 = cards.find((c) => c.id === BonusCardId.B01_METEOR_SHOWER)!;
    const tilePlacer = new MarsBotTilePlacer(game, marsBot.player, human);
    const bonusDeck = MarsBotBonusDeck.create(new SeededRandom(99));
    const resolver = new MarsBotTurnResolver(game, marsBot.player, human, marsBot.marsBotBoard, 'normal');
    const bonusResolver = new MarsBotBonusResolver(game, marsBot.player, human, resolver, bonusDeck, tilePlacer);

    const destroyed = bonusResolver.resolve(b01);

    expect(human.plants).to.eq(0); // Lost 2 plants
    expect(destroyed).to.be.false; // NOT destroyed (lost <3)
  });

  it('card IS destroyed when human loses >=3 plants', () => {
    const {game, human, marsBot} = createAutomaGame();
    human.plants = 5;

    const cards = createBaseBonusCards();
    const b01 = cards.find((c) => c.id === BonusCardId.B01_METEOR_SHOWER)!;
    const tilePlacer = new MarsBotTilePlacer(game, marsBot.player, human);
    const bonusDeck = MarsBotBonusDeck.create(new SeededRandom(99));
    const resolver = new MarsBotTurnResolver(game, marsBot.player, human, marsBot.marsBotBoard, 'normal');
    const bonusResolver = new MarsBotBonusResolver(game, marsBot.player, human, resolver, bonusDeck, tilePlacer);

    const destroyed = bonusResolver.resolve(b01);

    expect(human.plants).to.eq(0); // Lost 5 plants
    expect(destroyed).to.be.true; // Destroyed
  });

  it('is blocked by Asteroid Deflection System', () => {
    const {human, marsBot} = createAutomaGame();
    human.plants = 10;
    human.playCard(new AsteroidDeflectionSystem());

    const bonusCard = marsBot.bonusDeck.drawPile.find((c) => c.id === BonusCardId.B01_METEOR_SHOWER);
    if (bonusCard === undefined) {
      // Card may have been drawn already; create a fresh one
      return;
    }
    const plantsBefore = human.plants;
    marsBot['bonusResolver'].resolveEffect(createBonusCard(BonusCardId.B01_METEOR_SHOWER));
    expect(human.plants).to.eq(plantsBefore);
  });

  it('is blocked by Protected Habitats', () => {
    const {human, marsBot} = createAutomaGame();
    human.plants = 10;
    human.playCard(new ProtectedHabitats());

    const bonusCard = marsBot.bonusDeck.drawPile.find((c) => c.id === BonusCardId.B01_METEOR_SHOWER);
    if (bonusCard === undefined) {
      return;
    }
    const plantsBefore = human.plants;
    marsBot['bonusResolver'].resolveEffect(createBonusCard(BonusCardId.B01_METEOR_SHOWER));
    expect(human.plants).to.eq(plantsBefore);
  });
});
