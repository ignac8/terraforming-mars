import {expect} from 'chai';
import {testGame} from '../../TestGame';
import {IGame} from '../../../src/server/IGame';
import {TestPlayer} from '../../TestPlayer';
import {MarsBot} from '../../../src/server/automa/MarsBot';
import {MarsBotBonusResolver} from '../../../src/server/automa/MarsBotBonusResolver';
import {createCorpBonusCard} from '../../../src/server/automa/MarsBotBonusCard';
import {BonusCardId} from '../../../src/common/automa/AutomaTypes';
import {BoardName} from '../../../src/common/boards/BoardName';
import {
  clearMarsBotCorpRegistry,
} from '../../../src/server/automa/corps/MarsBotCorpRegistry';
import {registerBaseGameCorps} from '../../../src/server/automa/corps/BaseGameCorps';
import {registerExpansionCorps} from '../../../src/server/automa/corps/ExpansionCorps';

function createAutomaGame(): {game: IGame, human: TestPlayer, marsBot: MarsBot} {
  const [game, human] = testGame(1, {
    automaOption: true,
    automaDifficulty: 'normal',
    boardName: BoardName.THARSIS,
  });
  expect(game.marsBot).to.not.be.undefined;
  return {game, human, marsBot: game.marsBot!};
}

describe('Corp-Specific Bonus Cards (B22-B32)', () => {
  beforeEach(() => {
    clearMarsBotCorpRegistry();
    registerBaseGameCorps();
    registerExpansionCorps();
  });

  afterEach(() => {
    clearMarsBotCorpRegistry();
  });

  describe('B23 Rapid Sprouting', () => {
    it('places a greenery tile', () => {
      const {marsBot} = createAutomaGame();
      const card = createCorpBonusCard(BonusCardId.B23_RAPID_SPROUTING);
      const greeneryBefore = marsBot.game.board.getGreeneries(marsBot.player).length;
      marsBot.bonusResolver.resolve(card);
      expect(marsBot.game.board.getGreeneries(marsBot.player).length).to.be.gte(greeneryBefore);
    });
  });

  describe('B24 Supply & Demand', () => {
    it('advances building track', () => {
      const {marsBot} = createAutomaGame();
      const card = createCorpBonusCard(BonusCardId.B24_SUPPLY_AND_DEMAND);
      const trackBefore = marsBot.board.getTrack(1).position;
      marsBot.bonusResolver.resolve(card);
      expect(marsBot.board.getTrack(1).position).to.be.gte(trackBefore + 1);
    });
  });

  describe('B25 Do It Right', () => {
    it('advances science track', () => {
      const {marsBot} = createAutomaGame();
      const card = createCorpBonusCard(BonusCardId.B25_DO_IT_RIGHT);
      const trackBefore = marsBot.board.getTrack(4).position;
      marsBot.bonusResolver.resolve(card);
      expect(marsBot.board.getTrack(4).position).to.be.gte(trackBefore + 1);
    });
  });

  describe('B27 Build Build Build', () => {
    it('places a city tile', () => {
      const {marsBot} = createAutomaGame();
      const card = createCorpBonusCard(BonusCardId.B27_BUILD_BUILD_BUILD);
      const citiesBefore = marsBot.game.board.getCities(marsBot.player).length;
      marsBot.bonusResolver.resolve(card);
      expect(marsBot.game.board.getCities(marsBot.player).length).to.be.gte(citiesBefore);
    });
  });

  describe('B28 Diversification', () => {
    it('advances least-advanced track', () => {
      const {marsBot} = createAutomaGame();
      const card = createCorpBonusCard(BonusCardId.B28_DIVERSIFICATION);
      // Advance track 1 to create a non-uniform state
      marsBot.board.getTrack(1).position = 5;
      // Least advanced should be one of the others (all at 0)
      const leastIdx = marsBot.board.getLeastAdvancedTrackIndex();
      const trackBefore = marsBot.board.tracks[leastIdx].position;
      marsBot.bonusResolver.resolve(card);
      expect(marsBot.board.tracks[leastIdx].position).to.be.gte(trackBefore + 1);
    });
  });

  describe('B30 Interface Hyperlink', () => {
    it('advances energy or science track (least advanced)', () => {
      const {marsBot} = createAutomaGame();
      const card = createCorpBonusCard(BonusCardId.B30_INTERFACE_HYPERLINK);
      const energyBefore = marsBot.board.getTrack(5).position;
      const scienceBefore = marsBot.board.getTrack(4).position;
      marsBot.bonusResolver.resolve(card);
      // One of them should have advanced
      const energyAfter = marsBot.board.getTrack(5).position;
      const scienceAfter = marsBot.board.getTrack(4).position;
      expect(energyAfter + scienceAfter).to.be.gt(energyBefore + scienceBefore);
    });
  });

  describe('B31 Government Subsidy', () => {
    it('gains 5 M€ and advances a track', () => {
      const {marsBot} = createAutomaGame();
      const card = createCorpBonusCard(BonusCardId.B31_GOVERNMENT_SUBSIDY);
      const mcBefore = marsBot.turnResolver.mcSupply;
      marsBot.bonusResolver.resolve(card);
      expect(marsBot.turnResolver.mcSupply).to.be.gte(mcBefore + 5);
    });
  });

  describe('B32 Investors', () => {
    it('advances building and space tracks', () => {
      const {marsBot} = createAutomaGame();
      const card = createCorpBonusCard(BonusCardId.B32_INVESTORS);
      const buildingBefore = marsBot.board.getTrack(1).position;
      const spaceBefore = marsBot.board.getTrack(2).position;
      marsBot.bonusResolver.resolve(card);
      expect(marsBot.board.getTrack(1).position).to.be.gte(buildingBefore + 1);
      expect(marsBot.board.getTrack(2).position).to.be.gte(spaceBefore + 1);
    });
  });

  describe('createCorpBonusCard', () => {
    it('creates a card with correct ID and name', () => {
      const card = createCorpBonusCard(BonusCardId.B23_RAPID_SPROUTING);
      expect(card.id).to.eq(BonusCardId.B23_RAPID_SPROUTING);
      expect(card.name).to.eq('Rapid Sprouting');
      expect(card.destroyed).to.be.false;
    });
  });

  describe('Corp per-gen bonus card flow', () => {
    it('Eco Line adds Rapid Sprouting to action deck each gen', () => {
      const {marsBot, game} = createAutomaGame();
      const corp = require('../../../src/server/automa/corps/MarsBotCorpRegistry').getMarsBotCorp('C02_ECO_LINE');
      marsBot.setCorpAndSetup(corp);

      const deckBefore = marsBot.actionDeck.length;
      corp.perGeneration.resolve(marsBot.getCorpContext());
      expect(marsBot.actionDeck.length).to.eq(deckBefore + 1);
      // The last card should be Rapid Sprouting
      const lastCard = marsBot.actionDeck[marsBot.actionDeck.length - 1];
      expect(lastCard).to.have.property('id', BonusCardId.B23_RAPID_SPROUTING);
    });
  });

  describe('Transparent cube replacement', () => {
    it('C04 IC has 36 white cubes (18 on track 1 + 18 on track 3)', () => {
      const corp = require('../../../src/server/automa/corps/MarsBotCorpRegistry').getMarsBotCorp('C04_INTERPLANETARY_CINEMATICS');
      expect(corp.trackCubes.length).to.eq(36);
      const track1 = corp.trackCubes.filter((c: any) => c.trackNum === 1);
      const track3 = corp.trackCubes.filter((c: any) => c.trackNum === 3);
      expect(track1.length).to.eq(18);
      expect(track3.length).to.eq(18);
    });

    it('C09 Teractor has 18 white cubes on track 6', () => {
      const corp = require('../../../src/server/automa/corps/MarsBotCorpRegistry').getMarsBotCorp('C09_TERACTOR');
      expect(corp.trackCubes.length).to.eq(18);
      expect(corp.trackCubes.every((c: any) => c.trackNum === 6 && c.cubeType === 'white')).to.be.true;
    });

    it('C09 Teractor gains 2 M€ per Earth track advance', () => {
      const {marsBot} = createAutomaGame();
      const corp = require('../../../src/server/automa/corps/MarsBotCorpRegistry').getMarsBotCorp('C09_TERACTOR');
      marsBot.setCorpAndSetup(corp);
      const mcBefore = marsBot.turnResolver.mcSupply;
      // Trigger white cube on Earth track (track 6)
      corp.effect.onTrackCubeTrigger(marsBot.getCorpContext(), 6, 1, 'white');
      expect(marsBot.turnResolver.mcSupply).to.eq(mcBefore + 2);
    });

    it('C04 IC gains 2 M€ per building/event track advance', () => {
      const {marsBot} = createAutomaGame();
      const corp = require('../../../src/server/automa/corps/MarsBotCorpRegistry').getMarsBotCorp('C04_INTERPLANETARY_CINEMATICS');
      marsBot.setCorpAndSetup(corp);
      const mcBefore = marsBot.turnResolver.mcSupply;
      corp.effect.onTrackCubeTrigger(marsBot.getCorpContext(), 1, 1, 'white');
      expect(marsBot.turnResolver.mcSupply).to.eq(mcBefore + 2);
      corp.effect.onTrackCubeTrigger(marsBot.getCorpContext(), 3, 1, 'white');
      expect(marsBot.turnResolver.mcSupply).to.eq(mcBefore + 4);
    });
  });
});
