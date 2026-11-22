import {expect} from 'chai';
import {TileType} from '@/common/TileType';
import {BonusCardName} from '@/common/automa/BonusCardName';
import {CardName} from '@/common/cards/CardName';
import {inplaceRemove} from '@/common/utils/utils';
import {Game} from '@/server/Game';
import {createBonusCard} from '@/server/automa/bonusCards/MarsBotBonusCards';
import {getMarsBotCorp} from '@/server/automa/corps/MarsBotCorpRegistry';
import {createAutomaGame, resetCorpRegistry} from '../corps/CorpGame';
import {bonusCardsInActionDeck, bonusCardsInBonusDeck} from './BonusCardGame';

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

describe('Overachievement', () => {
  beforeEach(resetCorpRegistry);

  it('does NOT try awards when generation < 6', () => {
    const {game, marsBot} = createAutomaGame();
    game.generation = 4;
    // MarsBot can't claim any milestone (all at 0)
    // Gen < 6 means no award attempt
    const b04 = createBonusCard(BonusCardName.OVERACHIEVEMENT);

    const awardsBefore = game.fundedAwards.length;
    const destroyed = marsBot.actionDeck.playBonusCard(b04);

    expect(game.fundedAwards.length).to.eq(awardsBefore);
    expect(marsBot.megacredits).to.eq(5); // The Failed Action
    expect(destroyed).to.be.false;
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
    marsBot.awardValue = () => 10;
    const b04 = createBonusCard(BonusCardName.OVERACHIEVEMENT);

    marsBot.actionDeck.playBonusCard(b04);

    const miner = game.awards.find((award) => award.name === 'Miner')!;
    expect(game.fundedAwards).deep.eq([{player: marsBot.player, award: miner}]);
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
    const b04 = createBonusCard(BonusCardName.OVERACHIEVEMENT);

    const destroyed = marsBot.actionDeck.playBonusCard(b04);

    const gardener = game.milestones.find((milestone) => milestone.name === 'Gardener')!;
    expect(destroyed).is.true;
    expect(game.claimedMilestones).deep.eq([{player: marsBot.player, milestone: gardener}]);
  });

  it('considers Hoverlord last among tied milestones', () => {
    const {game, marsBot} = setUpTie();
    const b04 = createBonusCard(BonusCardName.OVERACHIEVEMENT);

    marsBot.actionDeck.playBonusCard(b04);

    const terraformer = game.milestones.find((milestone) => milestone.name === 'Terraformer')!;
    expect(game.claimedMilestones).deep.eq([{player: marsBot.player, milestone: terraformer}]);
  });

  it('stays out of the bonus deck after it resolves for Vitor', () => {
    const {marsBot} = createAutomaGame();
    marsBot.setCorpAndSetup(getMarsBotCorp(CardName.VITOR)!);

    marsBot.actionDeck.playBonusCard(createBonusCard(BonusCardName.OVERACHIEVEMENT));

    expect(marsBot.megacredits).eq(5);
    expect(bonusCardsInBonusDeck(marsBot)).does.not.include(BonusCardName.OVERACHIEVEMENT);
  });

  it('stays out of later generations once it removes itself for Vitor, across a reload', () => {
    const {game, marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.VITOR)!;
    marsBot.setCorpAndSetup(corp);
    for (const milestone of game.milestones) {
      milestone.marsBotCanClaim = () => true;
    }

    const destroyed = marsBot.actionDeck.playBonusCard(createBonusCard(BonusCardName.OVERACHIEVEMENT));
    expect(destroyed).is.true;
    expect(game.claimedMilestones).has.length(1);

    corp.beforeActionPhase!(marsBot);
    expect(bonusCardsInActionDeck(marsBot)).does.not.include(BonusCardName.OVERACHIEVEMENT);

    const restored = Game.deserialize(game.serialize()).automaHooks!.marsBot;
    restored.corp!.beforeActionPhase!(restored);
    expect(bonusCardsInActionDeck(restored)).does.not.include(BonusCardName.OVERACHIEVEMENT);
    expect(bonusCardsInBonusDeck(restored)).does.not.include(BonusCardName.OVERACHIEVEMENT);
  });

  it('is still discarded to the bonus deck without Vitor', () => {
    const {marsBot} = createAutomaGame();

    marsBot.actionDeck.playBonusCard(createBonusCard(BonusCardName.OVERACHIEVEMENT));

    const discardedIds = marsBot.bonusDeck.discardPile.map((c) => c.name);
    expect(discardedIds).includes(BonusCardName.OVERACHIEVEMENT);
  });
});
