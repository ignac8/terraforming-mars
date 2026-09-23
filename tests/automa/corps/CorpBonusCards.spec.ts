import {expect} from 'chai';
import {CardName} from '../../../src/common/cards/CardName';
import {testGame} from '../../TestGame';
import {IGame} from '../../../src/server/IGame';
import {TestPlayer} from '../../TestPlayer';
import {MarsBot} from '../../../src/server/automa/MarsBot';
import {createCorpBonusCard} from '../../../src/server/automa/MarsBotBonusCard';
import {BonusCardId} from '../../../src/common/automa/AutomaTypes';
import {BoardName} from '../../../src/common/boards/BoardName';
import {setTemperature} from '../../TestingUtils';
import {Turmoil} from '../../../src/server/turmoil/Turmoil';
import {
  clearMarsBotCorpRegistry, restoreMarsBotCorpRegistry,
} from '../../../src/server/automa/corps/MarsBotCorpRegistry';

function createAutomaGame(): {game: IGame, human: TestPlayer, marsBot: MarsBot} {
  const [game, human] = testGame(1, {
    automaOption: true,
    automaDifficulty: 'normal',
    boardName: BoardName.THARSIS,
  });
  expect(game.automaHooks?.marsBot).to.not.be.undefined;
  return {game, human, marsBot: game.automaHooks!.marsBot};
}

describe('Corp-Specific Bonus Cards (B22-B32)', () => {
  beforeEach(() => {
    clearMarsBotCorpRegistry();
    restoreMarsBotCorpRegistry();
  });

  afterEach(() => {
    restoreMarsBotCorpRegistry();
  });

  describe('B23 Rapid Sprouting', () => {
    it('first puts a plant on the corporation card, then spends it on a greenery', () => {
      const {game, marsBot} = createAutomaGame();
      const greeneries = () => game.board.getGreeneries(marsBot.player).length;

      marsBot['bonusResolver'].resolve(createCorpBonusCard(BonusCardId.B23_RAPID_SPROUTING));
      expect(greeneries()).to.eq(0);
      expect(marsBot.getCorpState('plantOnCard')).to.eq(1);

      marsBot['bonusResolver'].resolve(createCorpBonusCard(BonusCardId.B23_RAPID_SPROUTING));
      expect(greeneries()).to.eq(1);
      expect(game.getOxygenLevel()).to.eq(1);
      expect(marsBot.getCorpState('plantOnCard')).to.eq(0);
    });
  });

  describe('B24 Supply & Demand', () => {
    it('takes up to 3 M€ from the corporation card', () => {
      const {marsBot} = createAutomaGame();
      marsBot.setCorpState('mcOnCard', 5);
      marsBot['bonusResolver'].resolve(createCorpBonusCard(BonusCardId.B24_SUPPLY_AND_DEMAND));
      expect(marsBot.turnResolver.megacredits).to.eq(3);
      expect(marsBot.getCorpState('mcOnCard')).to.eq(2);
      expect(marsBot.marsBotBoard.tracks[4].position).to.eq(0);
    });

    it('with no M€ on the card advances the energy track', () => {
      const {marsBot} = createAutomaGame();
      marsBot['bonusResolver'].resolve(createCorpBonusCard(BonusCardId.B24_SUPPLY_AND_DEMAND));
      expect(marsBot.marsBotBoard.tracks[4].position).to.be.greaterThan(0);
      expect(marsBot.marsBotBoard.tracks[0].position).to.eq(0);
    });
  });

  describe('B25 Do It Right', () => {
    it('raises the temperature 2 steps when it is 1 or 2 steps from a bonus', () => {
      const {game, marsBot} = createAutomaGame();
      setTemperature(game, -26);
      marsBot['bonusResolver'].resolve(createCorpBonusCard(BonusCardId.B25_DO_IT_RIGHT));
      expect(game.getTemperature()).to.eq(-22);
    });

    it('does nothing when no branch applies', () => {
      const {game, marsBot} = createAutomaGame();
      const tr = marsBot.player.terraformRating;
      marsBot['bonusResolver'].resolve(createCorpBonusCard(BonusCardId.B25_DO_IT_RIGHT));
      expect(game.getTemperature()).to.eq(-30);
      expect(game.getOxygenLevel()).to.eq(0);
      expect(marsBot.player.terraformRating).to.eq(tr);
      expect(marsBot.marsBotBoard.tracks[3].position).to.eq(0);
    });
  });

  describe('B26 Venusian Lobby', () => {
    it('raises Venus, advances the Venus track and raises the furthest parameter', () => {
      const [game] = testGame(1, {automaOption: true, venusNextExtension: true, boardName: BoardName.THARSIS});
      const marsBot = game.automaHooks!.marsBot;
      marsBot['bonusResolver'].resolve(createCorpBonusCard(BonusCardId.B26_VENUSIAN_LOBBY));
      expect(game.getVenusScaleLevel()).to.eq(2);
      expect(marsBot.marsBotBoard.tracks[7].position).to.eq(1);
      // Everything is at its start, so oxygen goes first
      expect(game.getOxygenLevel()).to.eq(1);
    });
  });

  describe('B27 Build Build Build', () => {
    it('places a city tile', () => {
      const {marsBot} = createAutomaGame();
      const card = createCorpBonusCard(BonusCardId.B27_BUILD_BUILD_BUILD);
      const citiesBefore = marsBot.game.board.getCities(marsBot.player).length;
      marsBot['bonusResolver'].resolve(card);
      expect(marsBot.game.board.getCities(marsBot.player).length).to.be.gte(citiesBefore);
    });
  });

  describe('B28 Diversification', () => {
    it('loses up to 4 M€ after advancing', () => {
      const {marsBot} = createAutomaGame();
      marsBot.turnResolver.advanceTrack = () => {};
      marsBot.turnResolver.megacredits = 6;
      marsBot['bonusResolver'].resolve(createCorpBonusCard(BonusCardId.B28_DIVERSIFICATION));
      expect(marsBot.turnResolver.megacredits).to.eq(2);
      marsBot['bonusResolver'].resolve(createCorpBonusCard(BonusCardId.B28_DIVERSIFICATION));
      expect(marsBot.turnResolver.megacredits).to.eq(0);
    });

    it('advances least-advanced track', () => {
      const {marsBot} = createAutomaGame();
      const card = createCorpBonusCard(BonusCardId.B28_DIVERSIFICATION);
      // Advance track 1 to create a non-uniform state
      marsBot.marsBotBoard.tracks[0].position = 5;
      // Least advanced should be one of the others (all at 0)
      const leastIdx = marsBot.marsBotBoard.getLeastAdvancedTrackIndex();
      const trackBefore = marsBot.marsBotBoard.tracks[leastIdx].position;
      marsBot['bonusResolver'].resolve(card);
      expect(marsBot.marsBotBoard.tracks[leastIdx].position).to.be.gte(trackBefore + 1);
    });
  });

  describe('B29 Gray Eminence', () => {
    function turmoilGame() {
      const [game] = testGame(1, {automaOption: true, turmoilExtension: true, boardName: BoardName.THARSIS});
      const marsBot = game.automaHooks!.marsBot;
      return {game, marsBot, turmoil: game.turmoil!};
    }
    const botDelegates = (turmoil: Turmoil, marsBot: MarsBot) =>
      turmoil.parties.map((party) => party.delegates.get(marsBot.player));

    it('places 2 delegates, each in a party with the fewest MarsBot delegates', () => {
      const {marsBot, turmoil} = turmoilGame();
      const before = botDelegates(turmoil, marsBot);
      expect(Math.max(...before)).to.eq(0);
      marsBot['bonusResolver'].resolve(createCorpBonusCard(BonusCardId.B29_GRAY_EMINENCE));
      const after = botDelegates(turmoil, marsBot);
      expect(after.reduce((a, b) => a + b, 0)).to.eq(2);
      expect(Math.max(...after)).to.eq(1);
    });

    it('gains 2 M€ for each delegate it cannot place', () => {
      const {marsBot, turmoil} = turmoilGame();
      turmoil.delegateReserve.remove(marsBot.player, turmoil.delegateReserve.get(marsBot.player) - 1);
      marsBot['bonusResolver'].resolve(createCorpBonusCard(BonusCardId.B29_GRAY_EMINENCE));
      expect(botDelegates(turmoil, marsBot).reduce((a, b) => a + b, 0)).to.eq(1);
      expect(marsBot.turnResolver.megacredits).to.eq(2);
    });
  });

  describe('B30 Interface Hyperlink', () => {
    it('advances energy or science track (least advanced)', () => {
      const {marsBot} = createAutomaGame();
      const card = createCorpBonusCard(BonusCardId.B30_INTERFACE_HYPERLINK);
      const energyBefore = marsBot.marsBotBoard.tracks[4].position;
      const scienceBefore = marsBot.marsBotBoard.tracks[3].position;
      marsBot['bonusResolver'].resolve(card);
      // One of them should have advanced
      const energyAfter = marsBot.marsBotBoard.tracks[4].position;
      const scienceAfter = marsBot.marsBotBoard.tracks[3].position;
      expect(energyAfter + scienceAfter).to.be.gt(energyBefore + scienceBefore);
    });
  });

  describe('B31 Government Subsidy', () => {
    it('raises TR 1 step', () => {
      const {marsBot} = createAutomaGame();
      const tr = marsBot.player.terraformRating;
      marsBot['bonusResolver'].resolve(createCorpBonusCard(BonusCardId.B31_GOVERNMENT_SUBSIDY));
      expect(marsBot.player.terraformRating).to.eq(tr + 1);
      expect(marsBot.turnResolver.megacredits).to.eq(0);
    });
  });

  describe('B32 Investors', () => {
    function setTracks(marsBot: MarsBot, positions: Array<number>) {
      positions.forEach((position, i) => {
        marsBot.marsBotBoard.tracks[i].position = position;
      });
    }

    it('in an even generation advances the least-advanced track and moves the most-advanced one back', () => {
      const {game, marsBot} = createAutomaGame();
      game.generation = 2;
      setTracks(marsBot, [5, 3, 1, 4, 4, 6, 2]);

      marsBot['bonusResolver'].resolve(createCorpBonusCard(BonusCardId.B32_INVESTORS));

      expect(marsBot.marsBotBoard.tracks.map((t) => t.position)).deep.eq([5, 3, 2, 4, 4, 5, 2]);
      expect(marsBot.turnResolver.megacredits).to.eq(0);
    });

    it('does not re-trigger the space it moved the most-advanced track back from', () => {
      const {game, marsBot} = createAutomaGame();
      game.generation = 2;
      setTracks(marsBot, [5, 3, 1, 4, 4, 6, 2]);

      marsBot['bonusResolver'].resolve(createCorpBonusCard(BonusCardId.B32_INVESTORS));

      expect(marsBot.marsBotBoard.tracks[5].regressedPositions.has(6)).is.true;
    });

    it('breaks ties toward the upper track', () => {
      const {game, marsBot} = createAutomaGame();
      game.generation = 4;
      setTracks(marsBot, [4, 1, 1, 4, 2, 2, 3]);

      marsBot['bonusResolver'].resolve(createCorpBonusCard(BonusCardId.B32_INVESTORS));

      expect(marsBot.marsBotBoard.tracks.map((t) => t.position)).deep.eq([3, 2, 1, 4, 2, 2, 3]);
    });

    it('in an odd generation gains 1 M€ per space of the least-advanced track and moves nothing', () => {
      const {game, marsBot} = createAutomaGame();
      game.generation = 3;
      setTracks(marsBot, [5, 3, 2, 4, 4, 6, 3]);

      marsBot['bonusResolver'].resolve(createCorpBonusCard(BonusCardId.B32_INVESTORS));

      expect(marsBot.marsBotBoard.tracks.map((t) => t.position)).deep.eq([5, 3, 2, 4, 4, 6, 3]);
      expect(marsBot.turnResolver.megacredits).to.eq(2);
    });
  });

  describe('createCorpBonusCard', () => {
    it('creates a card with correct ID and name', () => {
      const card = createCorpBonusCard(BonusCardId.B23_RAPID_SPROUTING);
      expect(card.id).to.eq(BonusCardId.B23_RAPID_SPROUTING);
      expect(card.name).to.eq(CardName.AUTOMA_RAPID_SPROUTING);
    });
  });

  describe('Corp per-gen bonus card flow', () => {
    it('Eco Line adds Rapid Sprouting to action deck each gen', () => {
      const {marsBot} = createAutomaGame();
      const corp = require('../../../src/server/automa/corps/MarsBotCorpRegistry').getMarsBotCorp(CardName.ECOLINE);
      marsBot.setCorpAndSetup(corp);

      const deckBefore = marsBot.actionDeck.length;
      corp.beforeActionPhase(marsBot);
      expect(marsBot.actionDeck.length).to.eq(deckBefore + 1);
      // The last card should be Rapid Sprouting
      const lastCard = marsBot.actionDeck[marsBot.actionDeck.length - 1];
      expect(lastCard).to.have.property('id', BonusCardId.B23_RAPID_SPROUTING);
    });
  });

  describe('Transparent cube replacement', () => {
    it('C04 IC has 36 white cubes (18 on track 1 + 18 on track 3)', () => {
      const corp = require('../../../src/server/automa/corps/MarsBotCorpRegistry').getMarsBotCorp(CardName.INTERPLANETARY_CINEMATICS);
      expect(corp.trackCubes.length).to.eq(36);
      const track1 = corp.trackCubes.filter((c: any) => c.trackIndex === 0);
      const track3 = corp.trackCubes.filter((c: any) => c.trackIndex === 2);
      expect(track1.length).to.eq(18);
      expect(track3.length).to.eq(18);
    });

    it('C09 Teractor has 18 white cubes on track 6', () => {
      const corp = require('../../../src/server/automa/corps/MarsBotCorpRegistry').getMarsBotCorp(CardName.TERACTOR);
      expect(corp.trackCubes.length).to.eq(18);
      expect(corp.trackCubes.every((c: any) => c.trackIndex === 5 && c.cubeType === 'white')).to.be.true;
    });

    it('C09 Teractor gains 2 M€ per Earth track advance', () => {
      const {marsBot} = createAutomaGame();
      const corp = require('../../../src/server/automa/corps/MarsBotCorpRegistry').getMarsBotCorp(CardName.TERACTOR);
      marsBot.setCorpAndSetup(corp);
      const mcBefore = marsBot.turnResolver.megacredits;
      // Trigger white cube on Earth track (track 6)
      corp.effect.onTrackCubeTrigger(marsBot, 5, 1, 'white');
      expect(marsBot.turnResolver.megacredits).to.eq(mcBefore + 2);
    });

    it('C04 IC gains 2 M€ per building/event track advance', () => {
      const {marsBot} = createAutomaGame();
      const corp = require('../../../src/server/automa/corps/MarsBotCorpRegistry').getMarsBotCorp(CardName.INTERPLANETARY_CINEMATICS);
      marsBot.setCorpAndSetup(corp);
      const mcBefore = marsBot.turnResolver.megacredits;
      corp.effect.onTrackCubeTrigger(marsBot, 0, 1, 'white');
      expect(marsBot.turnResolver.megacredits).to.eq(mcBefore + 2);
      corp.effect.onTrackCubeTrigger(marsBot, 2, 1, 'white');
      expect(marsBot.turnResolver.megacredits).to.eq(mcBefore + 4);
    });
  });
});
