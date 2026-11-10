import {expect} from 'chai';
import {TileType} from '@/common/TileType';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {CardName} from '@/common/cards/CardName';
import {SeededRandom} from '@/common/utils/Random';
import {inplaceRemove} from '@/common/utils/utils';
import {Game} from '@/server/Game';
import {createBaseBonusCards, createBonusCard} from '@/server/automa/MarsBotBonusCard';
import {MarsBotBonusDeck} from '@/server/automa/MarsBotBonusDeck';
import {MarsBotBonusResolver} from '@/server/automa/MarsBotBonusResolver';
import {MarsBotTilePlacer} from '@/server/automa/MarsBotTilePlacer';
import {getMarsBotCorp} from '@/server/automa/corps/MarsBotCorpRegistry';
import {createAutomaGame, resetCorpRegistry} from '../corps/CorpGame';
import {actionDeckIds, bonusDeckIds} from './BonusCardGame';

// MarsBot meets Terraformer and Hoverlord; the player is 7 away from both.
function setUpTie() {
  const {game, human, marsBot} = createAutomaGame({venusNextExtension: true});
  const hoverlord = game.milestones.find((m) => m.name === 'Hoverlord')!;
  inplaceRemove(game.milestones, hoverlord);
  game.milestones.unshift(hoverlord); // leftmost
  marsBot.player.setTerraformRating(35);
  marsBot.floaters = 7;
  human.setTerraformRating(28);
  return {game, human, marsBot};
}

describe('OverachievementMarsBot', () => {
  beforeEach(resetCorpRegistry);

  it('does NOT try awards when generation < 6', () => {
    const {game, human, marsBot} = createAutomaGame();
    (game as any).generation = 4;
    // MarsBot can't claim any milestone (all at 0)
    // Gen < 6 means no award attempt

    const cards = createBaseBonusCards();
    const b04 = cards.find((c) => c.id === BonusCardId.B04_OVERACHIEVEMENT)!;
    const tilePlacer = new MarsBotTilePlacer(game, marsBot.player, human);
    const bonusDeck = MarsBotBonusDeck.create(new SeededRandom(99));
    const bonusResolver = new MarsBotBonusResolver(game, marsBot.player, human, marsBot.turnResolver, bonusDeck, tilePlacer);

    const awardsBefore = game.fundedAwards.length;
    const destroyed = bonusResolver.resolve(b04);

    expect(game.fundedAwards.length).to.eq(awardsBefore); // No award funded
    expect(marsBot.turnResolver.megacredits).to.eq(5); // Failed → 5 MC
    expect(destroyed).to.be.false; // Not destroyed
  });

  it('funds the award MarsBot leads by the most', () => {
    const {game, human, marsBot} = createAutomaGame();
    game.generation = 6;
    const leads: Record<string, number> = {Scientist: 1};
    for (const award of game.awards) {
      award.getScore = () => 10 - (leads[award.name] ?? -1);
    }
    // Miner and Thermalist compare the player's resources plus production
    human.steel = 6; // leads Miner by 4
    human.heat = 11;
    marsBot.turnResolver.getMarsBotAwardValue = () => 10;
    const b04 = createBaseBonusCards().find((c) => c.id === BonusCardId.B04_OVERACHIEVEMENT)!;

    marsBot['bonusResolver'].resolve(b04);

    expect(game.fundedAwards.map((f) => f.award.name)).deep.eq(['Miner']);
  });

  // Overachievement uses the claim tiebreakers (rulebook page 7)
  it('claims the milestone the player also meets, not the first one', () => {
    const {game, human, marsBot} = createAutomaGame();
    marsBot.player.setTerraformRating(35);
    const land = game.board.getAvailableSpacesOnLand(marsBot.player);
    for (const i of [30, 31, 32]) {
      game.simpleAddTile(marsBot.player, land[i], {tileType: TileType.GREENERY});
    }
    for (const i of [40, 41, 42]) {
      game.simpleAddTile(human, land[i], {tileType: TileType.GREENERY});
    }
    const b04 = createBaseBonusCards().find((c) => c.id === BonusCardId.B04_OVERACHIEVEMENT)!;

    const destroyed = marsBot['bonusResolver'].resolve(b04);

    expect(destroyed).is.true;
    expect(game.claimedMilestones.map((c) => c.milestone.name)).deep.eq(['Gardener']);
  });

  it('considers Hoverlord last among tied milestones', () => {
    const {game, marsBot} = setUpTie();
    const b04 = createBaseBonusCards().find((c) => c.id === BonusCardId.B04_OVERACHIEVEMENT)!;

    marsBot['bonusResolver'].resolve(b04);

    expect(game.claimedMilestones.map((c) => c.milestone.name)).deep.eq(['Terraformer']);
  });

  it('stays out of the bonus deck after it resolves for Vitor', () => {
    const {marsBot} = createAutomaGame();
    marsBot.setCorpAndSetup(getMarsBotCorp(CardName.VITOR)!);

    marsBot['bonusResolver'].resolve(createBonusCard(BonusCardId.B04_OVERACHIEVEMENT));

    expect(marsBot.turnResolver.megacredits).eq(5);
    expect(bonusDeckIds(marsBot)).does.not.include(BonusCardId.B04_OVERACHIEVEMENT);
  });

  it('stays out of later generations once it removes itself for Vitor, across a reload', () => {
    const {game, marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.VITOR)!;
    marsBot.setCorpAndSetup(corp);
    marsBot.turnResolver.marsBotMeetsMilestone = () => true;

    const destroyed = marsBot['bonusResolver'].resolve(createBonusCard(BonusCardId.B04_OVERACHIEVEMENT));
    expect(destroyed).is.true;
    expect(game.claimedMilestones).has.length(1);

    corp.beforeActionPhase!(marsBot);
    expect(actionDeckIds(marsBot)).does.not.include(BonusCardId.B04_OVERACHIEVEMENT);

    const restored = Game.deserialize(game.serialize()).automaHooks!.marsBot;
    restored.corp!.beforeActionPhase!(restored);
    expect(actionDeckIds(restored)).does.not.include(BonusCardId.B04_OVERACHIEVEMENT);
    expect(bonusDeckIds(restored)).does.not.include(BonusCardId.B04_OVERACHIEVEMENT);
  });

  it('is still discarded to the bonus deck without Vitor', () => {
    const {marsBot} = createAutomaGame();

    marsBot['bonusResolver'].resolve(createBonusCard(BonusCardId.B04_OVERACHIEVEMENT));

    expect(marsBot.bonusDeck.discardPile.map((c) => c.id)).includes(BonusCardId.B04_OVERACHIEVEMENT);
  });
});
