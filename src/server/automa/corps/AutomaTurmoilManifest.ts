import {IMarsBotCorp} from '../MarsBotCorpTypes';
import {Tag} from '../../../common/cards/Tag';
import {CardName} from '../../../common/cards/CardName';
import {BonusCardId} from '../../../common/automa/AutomaTypes';
import {TileType} from '../../../common/TileType';
import {AutomaManifest} from './AutomaManifest';
import {bonusCardPerGen} from './BaseGameCorps';

// ==== TURMOIL (C35-C39) ====

// C35 Lakefront Resorts
const LAKEFRONT_RESORTS: IMarsBotCorp = {
  name: CardName.LAKEFRONT_RESORTS,
  description: 'Setup: 1 white cube on card. Oceans alternate between removing the cube (advance building track) and placing it back.',
  startingTags: [],
  setup: {
    resolve(ctx) {
      ctx.setCorpState('whiteCubeOnCard', 1);
      ctx.gameLog('MarsBot (Lakefront): 1 white cube on card');
    },
  },
  effect: {
    onTilePlaced(ctx, _placedByMarsBot, tileType) {
      if (tileType === TileType.OCEAN) {
        const cube = ctx.getCorpState('whiteCubeOnCard');
        if (cube > 0) {
          ctx.setCorpState('whiteCubeOnCard', 0);
          ctx.advanceTrack(0); // Building track = index 0
          ctx.gameLog('MarsBot (Lakefront): ocean placed, removed cube, advance building track');
        } else {
          ctx.setCorpState('whiteCubeOnCard', 1);
          ctx.gameLog('MarsBot (Lakefront): ocean placed, placed white cube on card');
        }
      }
    },
  },
};

// C36 Pristar (NamuWiki says "Freestar")
const PRISTAR: IMarsBotCorp = {
  name: CardName.PRISTAR,
  description: 'When a global parameter would be raised and a cube is on card: skip the raise, remove cube, +1 TR, +6 MC. Cube is restored each generation.',
  startingTags: [],
  effect: {
    onGlobalParameterRaised(ctx, _parameter) {
      const cube = ctx.getCorpState('whiteCubeOnCard');
      if (cube > 0) {
        ctx.setCorpState('whiteCubeOnCard', 0);
        ctx.raiseTR(1);
        ctx.gainMc(6);
        ctx.gameLog('MarsBot (Pristar): parameter raise intercepted — removed cube, +1 TR, +6 M€, SKIP raise');
        return true; // SKIP the parameter raise
      }
      return false;
    },
  },
  perGeneration: {
    timing: 'beforeActionPhase',
    resolve(ctx) {
      if (ctx.getCorpState('whiteCubeOnCard') === 0) {
        ctx.setCorpState('whiteCubeOnCard', 1);
        ctx.gameLog('MarsBot (Pristar): added white cube on card');
      }
    },
  },
};

// C37 Septem Tribus
const SEPTEM_TRIBUS: IMarsBotCorp = {
  name: CardName.SEPTUM_TRIBUS,
  description: 'Setup: remove Party Politics, add Gray Eminence to bonus deck. Each generation: add Gray Eminence to action deck.',
  startingTags: [],
  setup: {
    resolve(ctx) {
      ctx.removeBonusCardFromDeck(BonusCardId.B21_PARTY_POLITICS);
      ctx.addBonusCardToBonusDeck(BonusCardId.B29_GRAY_EMINENCE);
      ctx.gameLog('MarsBot (Septem Tribus): Party Politics removed, Gray Eminence added');
    },
  },
  perGeneration: bonusCardPerGen(BonusCardId.B29_GRAY_EMINENCE, 'Septem Tribus'),
  associatedBonusCards: [BonusCardId.B29_GRAY_EMINENCE],
};

// C38 Terralabs
const TERRALABS: IMarsBotCorp = {
  name: CardName.TERRALABS_RESEARCH,
  description: 'Tag: Science. Setup: TR -8. Each generation: draw 1 card to action deck (2 cards from generation 9 onward).',
  startingTags: [Tag.SCIENCE],
  setup: {
    resolve(ctx) {
      // Reduce TR by 8
      ctx.raiseTR(-8);
      ctx.gameLog('MarsBot (Terralabs): TR -8');
    },
  },
  perGeneration: {
    timing: 'beforeActionPhase',
    resolve(ctx) {
      const count = ctx.generation <= 8 ? 1 : 2;
      ctx.addProjectCardToActionDeck(count);
      ctx.gameLog(`MarsBot (Terralabs): drew ${count} card(s) to action deck`);
    },
  },
};

// C39 Utopia Invest
const UTOPIA_INVEST: IMarsBotCorp = {
  name: CardName.UTOPIA_INVEST,
  description: 'Tags: Building, Space. Each generation: add Investors bonus card to action deck.',
  startingTags: [Tag.BUILDING, Tag.SPACE],
  perGeneration: bonusCardPerGen(BonusCardId.B32_INVESTORS, 'Utopia Invest'),
  associatedBonusCards: [BonusCardId.B32_INVESTORS],
};

export const AUTOMA_TURMOIL_MANIFEST: AutomaManifest = {
  corps: {
    [CardName.LAKEFRONT_RESORTS]: LAKEFRONT_RESORTS,
    [CardName.PRISTAR]: PRISTAR,
    [CardName.SEPTUM_TRIBUS]: SEPTEM_TRIBUS,
    [CardName.TERRALABS_RESEARCH]: TERRALABS,
    [CardName.UTOPIA_INVEST]: UTOPIA_INVEST,
  },
};
