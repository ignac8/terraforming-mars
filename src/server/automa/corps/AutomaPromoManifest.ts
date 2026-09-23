import {IMarsBotCorp} from '../MarsBotCorpTypes';
import {Tag} from '../../../common/cards/Tag';
import {CardName} from '../../../common/cards/CardName';
import {BonusCardId} from '../../../common/automa/AutomaTypes';
import {AutomaManifest} from './AutomaManifest';
import {Space} from '../../boards/Space';

// ==== PROMO (C21-C24) ====

// C21 Pharmacy Union
const PHARMACY_UNION: IMarsBotCorp = {
  name: CardName.PHARMACY_UNION,
  description: 'Tag: Science. Draft: Science. Setup: remove Meteor Shower. Science cards give +1 TR. When human plays a Microbe card, lose 4 MC.',
  tags: [Tag.SCIENCE],
  draftPriority: {type: 'tags', tags: [Tag.SCIENCE]},
  setup(bot) {
    bot.removeBonusCard(BonusCardId.B01_METEOR_SHOWER);
    bot.game.log('MarsBot (Pharmacy Union): Meteor Shower removed, science card added to bonus deck');
  },
  effect: {
    onProjectCardResolved(bot, card) {
      if (card.tags.includes(Tag.SCIENCE)) {
        bot.raiseTR(1);
        bot.game.log('MarsBot (Pharmacy Union): science card, TR +1');
      }
    },
    onHumanCardPlayed(bot, card) {
      if (card.tags.includes(Tag.MICROBE)) {
        bot.megacredits = Math.max(0, bot.megacredits - 4);
        bot.game.log('MarsBot (Pharmacy Union): human played microbe, -4 M€');
      }
    },
  },
};

// C22 Philares
const PHILARES: IMarsBotCorp = {
  name: CardName.PHILARES,
  description: 'Setup: place greenery, +1 science resource, resolve and remove Local Neural Instance, add Build Build Build to bonus deck. ' +
    'Each new adjacency between its tile and the player\'s tile: +1 science resource. ' +
    'Spend 4 science resources to advance the most-advanced track that is not maxed.',
  tags: [],
  setup(bot) {
    bot.placeGreenery();
    bot.setCorpState('scienceResources', 1);
    bot.removeBonusCard(BonusCardId.B07_LOCAL_NEURAL_INSTANCE);
    bot.resolveBonusCard(BonusCardId.B07_LOCAL_NEURAL_INSTANCE);
    bot.addBonusCardToBonusDeck(BonusCardId.B27_BUILD_BUILD_BUILD);
    bot.game.log('MarsBot (Philares): placed greenery, +1 science resource, Local Neural Instance removed, B27 added');
  },
  effect: {
    // Oceans belong to no one, so they never make an adjacency
    onTilePlaced(bot, placedByMarsBot, _tileType, space) {
      if (space.player === undefined) {
        return;
      }
      const otherSide = (s: Space) => placedByMarsBot ? s.player !== bot.player : s.player === bot.player;
      const adjacencies = bot.game.board.getAdjacentSpaces(space)
        .filter((s) => s.tile !== undefined && s.player !== undefined && otherSide(s)).length;
      if (adjacencies === 0) {
        return;
      }
      bot.setCorpState('scienceResources', bot.getCorpState('scienceResources') + adjacencies);
      bot.game.log('MarsBot (Philares): +${0} science resource(s) from new adjacencies with the player', (b) => b.number(adjacencies));
      while (bot.getCorpState('scienceResources') >= 4) {
        const trackIndex = bot.marsBotBoard.getMostAdvancedNonMaxedTrackIndex();
        if (trackIndex === undefined) {
          return;
        }
        bot.setCorpState('scienceResources', bot.getCorpState('scienceResources') - 4);
        bot.game.log('MarsBot (Philares): spends 4 science resources to advance its most-advanced track');
        bot.advanceTrack(trackIndex);
      }
    },
  },
};

// C23 Recyclone
const RECYCLONE: IMarsBotCorp = {
  name: CardName.RECYCLON,
  description: 'Tag: Microbe. Draft: Building. White cubes on building track. Each white cube advances the plant track.',
  tags: [Tag.MICROBE],
  draftPriority: {type: 'tags', tags: [Tag.BUILDING]},
  trackCubes: [
    {trackIndex: 0, position: 3, cubeType: 'white'},
    {trackIndex: 0, position: 6, cubeType: 'white'},
    {trackIndex: 0, position: 9, cubeType: 'white'},
    {trackIndex: 0, position: 12, cubeType: 'white'},
    {trackIndex: 0, position: 15, cubeType: 'white'},
    {trackIndex: 0, position: 18, cubeType: 'white'},
  ],
  effect: {
    onTrackCubeTrigger(bot, trackIndex, _position, cubeType) {
      if (cubeType === 'white' && trackIndex === 0) {
        bot.advanceTrack(6); // Plant track = index 6
        bot.game.log('MarsBot (Recyclone): white cube on building track — advance plant track');
      }
    },
  },
};

// C24 Splice
const SPLICE: IMarsBotCorp = {
  name: CardName.SPLICE,
  description: 'Tag: Plant. Draft: Microbe. Setup: +8 MC, remove R&D. Microbe cards earn 4 MC. When human plays a Microbe card, earn 2 MC.',
  tags: [Tag.PLANT],
  draftPriority: {type: 'tags', tags: [Tag.MICROBE]},
  setup(bot) {
    bot.gainMc(8);
    bot.removeBonusCard(BonusCardId.B03_RESEARCH_AND_DEVELOPMENT);
    bot.game.log('MarsBot (Splice): +8 M€, R&D removed, microbe card added to bonus deck');
  },
  effect: {
    onProjectCardResolved(bot, card) {
      if (card.tags.includes(Tag.MICROBE)) {
        bot.gainMc(4);
        bot.game.log('MarsBot (Splice): microbe card, +4 M€');
      }
    },
    onHumanCardPlayed(bot, card) {
      if (card.tags.includes(Tag.MICROBE)) {
        bot.gainMc(2);
        bot.game.log('MarsBot (Splice): human played microbe, +2 M€');
      }
    },
  },
};

export const AUTOMA_PROMO_MANIFEST: AutomaManifest = {
  corps: {
    [CardName.PHARMACY_UNION]: PHARMACY_UNION,
    [CardName.PHILARES]: PHILARES,
    [CardName.RECYCLON]: RECYCLONE,
    [CardName.SPLICE]: SPLICE,
  },
};
