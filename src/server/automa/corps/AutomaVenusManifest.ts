import {IMarsBotCorp} from '../MarsBotCorpTypes';
import {Tag} from '../../../common/cards/Tag';
import {CardName} from '../../../common/cards/CardName';
import {BonusCardId} from '../../../common/automa/AutomaTypes';
import {AutomaManifest} from './AutomaManifest';

// ==== VENUS NEXT (C25-C28, C34) ====

// C25 Viron (NamuWiki says "Byron")
const VIRON: IMarsBotCorp = {
  name: CardName.VIRON,
  description: 'Tag: Microbe. Each card resolved adds 1 floater. VP bonus equal to total cards resolved.',
  startingTags: [Tag.MICROBE],
  effect: {
    onProjectCardResolved(ctx, _card) {
      ctx.addFloaters(1);
      ctx.setCorpState('actionCardsPlayed', ctx.getCorpState('actionCardsPlayed') + 1);
      ctx.gameLog('MarsBot (Viron): card played, +1 floater');
    },
    vpBonus(ctx) {
      return ctx.getCorpState('actionCardsPlayed');
    },
  },
};

// C26 Celestic
const CELESTIC: IMarsBotCorp = {
  name: CardName.CELESTIC,
  description: 'Tag: Venus. Draft: Venus > Jovian. Setup: +1 floater. Each round start: +1 floater.',
  startingTags: [Tag.VENUS],
  draftPriority: {type: 'tags', tags: [Tag.VENUS, Tag.JOVIAN]},
  setup: {
    resolve(ctx) {
      ctx.addFloaters(1);
      ctx.gameLog('MarsBot (Celestic): +1 floater');
    },
  },
  effect: {
    // Failed action -> +1 additional floater (on top of normal failed action)
    // This would need to hook into the failed action handler
  },
  perGeneration: {
    timing: 'roundStart',
    resolve(ctx) {
      ctx.addFloaters(1);
      ctx.gameLog('MarsBot (Celestic): round start, +1 floater');
    },
  },
};

// C27 Morningstar Inc.
const MORNINGSTAR: IMarsBotCorp = {
  name: CardName.MORNING_STAR_INC,
  description: 'Tags: 2 Venus. Setup: remove Lobbyists, add Venusian Lobby. Credit cubes on Venus track earn 1 MC each.',
  startingTags: [Tag.VENUS, Tag.VENUS],
  setup: {
    resolve(ctx) {
      ctx.removeBonusCardFromDeck(BonusCardId.B06_LOBBYISTS);
      ctx.addBonusCardToBonusDeck(BonusCardId.B26_VENUSIAN_LOBBY);
      ctx.gameLog('MarsBot (Morningstar): Lobbyists removed, Venusian Lobby added');
    },
  },
  // Credit cubes on Venus track positions 5-9, 11-12
  // Venus track is track 8 (index 7) when Venus expansion is enabled
  // These cubes are on the separate Venus board
  effect: {
    onTrackCubeTrigger(ctx, _trackIndex, _position, cubeType) {
      if (cubeType === 'credit') {
        ctx.gainMc(1);
        ctx.gameLog('MarsBot (Morningstar): credit cube, +1 M€');
      }
    },
  },
  associatedBonusCards: [BonusCardId.B26_VENUSIAN_LOBBY],
};

// C28 Aphrodite
const APHRODITE: IMarsBotCorp = {
  name: CardName.APHRODITE,
  description: 'Tag: Plant. Draft: Plant > Animal > Venus. Whenever Venus is raised, earn 2 MC.',
  startingTags: [Tag.PLANT],
  draftPriority: {type: 'tags', tags: [Tag.PLANT, Tag.ANIMAL, Tag.VENUS]},
  effect: {
    onVenusRaised(ctx) {
      ctx.gainMc(2);
      ctx.gameLog('MarsBot (Aphrodite): Venus raised, +2 M€');
    },
  },
};

// C34 Stormcraft
const STORMCRAFT: IMarsBotCorp = {
  name: CardName.STORMCRAFT_INCORPORATED,
  description: 'Tag: Jovian. Setup: +1 floater. Each round start: +1 floater. Spending floaters for an extra card also raises temperature +1.',
  startingTags: [Tag.JOVIAN],
  setup: {
    resolve(ctx) {
      ctx.addFloaters(1);
      ctx.gameLog('MarsBot (Stormcraft): +1 floater');
    },
  },
  // Effect: spending floaters for extra card -> temp +1
  perGeneration: {
    timing: 'roundStart',
    resolve(ctx) {
      ctx.addFloaters(1);
      ctx.gameLog('MarsBot (Stormcraft): round start, +1 floater');
    },
  },
};

export const AUTOMA_VENUS_MANIFEST: AutomaManifest = {
  corps: {
    [CardName.VIRON]: VIRON,
    [CardName.CELESTIC]: CELESTIC,
    [CardName.MORNING_STAR_INC]: MORNINGSTAR,
    [CardName.APHRODITE]: APHRODITE,
    [CardName.STORMCRAFT_INCORPORATED]: STORMCRAFT,
  },
};
