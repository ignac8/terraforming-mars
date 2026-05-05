import {expect} from 'chai';
import {CardName} from '../../../src/common/cards/CardName';
import {testGame} from '../../TestGame';
import {IGame} from '../../../src/server/IGame';
import {TestPlayer} from '../../TestPlayer';
import {MarsBot} from '../../../src/server/automa/MarsBot';
import {Tag} from '../../../src/common/cards/Tag';
import {BoardName} from '../../../src/common/boards/BoardName';
import {
  clearMarsBotCorpRegistry, restoreMarsBotCorpRegistry,
  getMarsBotCorp,
} from '../../../src/server/automa/corps/MarsBotCorpRegistry';

function createAutomaGame(): {game: IGame, human: TestPlayer, marsBot: MarsBot} {
  const [game, human] = testGame(1, {
    automaOption: true,
    automaDifficulty: 'normal',
    boardName: BoardName.THARSIS,
  });
  expect(game.marsBot).to.not.be.undefined;
  return {game, human, marsBot: game.marsBot!};
}

describe('Corp Effect Hooks', () => {
  beforeEach(() => {
    clearMarsBotCorpRegistry();
    restoreMarsBotCorpRegistry();
  });

  afterEach(() => {
    restoreMarsBotCorpRegistry();
  });

  describe('C05 Inventrix hasRequirements', () => {
    it('gains 2 M€ for cards with requirements', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.INVENTRIX)!;
      marsBot.setCorpAndSetup(corp);
      const mcBefore = marsBot.turnResolver.mcSupply;
      corp.effect!.onProjectCardResolved!(marsBot.getCorpContext(), {name: 'Req', tags: [], cost: 10, hasRequirements: true, victoryPoints: 0});
      expect(marsBot.turnResolver.mcSupply).to.eq(mcBefore + 2);
    });

    it('does NOT gain M€ for cards without requirements', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.INVENTRIX)!;
      marsBot.setCorpAndSetup(corp);
      const mcBefore = marsBot.turnResolver.mcSupply;
      corp.effect!.onProjectCardResolved!(marsBot.getCorpContext(), {name: 'NoReq', tags: [], cost: 10, hasRequirements: false, victoryPoints: 0});
      expect(marsBot.turnResolver.mcSupply).to.eq(mcBefore);
    });
  });

  describe('C17 Vitor VP check', () => {
    it('gains 3 M€ for positive VP cards', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.VITOR)!;
      marsBot.setCorpAndSetup(corp);
      const mcBefore = marsBot.turnResolver.mcSupply;
      corp.effect!.onProjectCardResolved!(marsBot.getCorpContext(), {name: 'VP+', tags: [], cost: 10, hasRequirements: false, victoryPoints: 1});
      expect(marsBot.turnResolver.mcSupply).to.eq(mcBefore + 3);
    });

    it('does NOT gain M€ for 0 VP cards', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.VITOR)!;
      marsBot.setCorpAndSetup(corp);
      const mcBefore = marsBot.turnResolver.mcSupply;
      corp.effect!.onProjectCardResolved!(marsBot.getCorpContext(), {name: 'VP0', tags: [], cost: 10, hasRequirements: false, victoryPoints: 0});
      expect(marsBot.turnResolver.mcSupply).to.eq(mcBefore);
    });

    it('does NOT gain M€ for negative VP cards', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.VITOR)!;
      marsBot.setCorpAndSetup(corp);
      const mcBefore = marsBot.turnResolver.mcSupply;
      corp.effect!.onProjectCardResolved!(marsBot.getCorpContext(), {name: 'VP-', tags: [], cost: 10, hasRequirements: false, victoryPoints: -1});
      expect(marsBot.turnResolver.mcSupply).to.eq(mcBefore);
    });
  });

  describe('C25 Viron floater + VP', () => {
    it('gains floater and tracks action cards', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.VIRON)!;
      marsBot.setCorpAndSetup(corp);
      corp.effect!.onProjectCardResolved!(marsBot.getCorpContext(), {name: 'Card1', tags: [Tag.BUILDING], cost: 5, hasRequirements: false, victoryPoints: 0});
      expect(marsBot.floaterCount).to.eq(1);
      expect(marsBot.corpSpecificState.get('actionCardsPlayed')).to.eq(1);
    });

    it('vpBonus returns action card count', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.VIRON)!;
      marsBot.setCorpAndSetup(corp);
      marsBot.corpSpecificState.set('actionCardsPlayed', 5);
      expect(corp.effect!.vpBonus!(marsBot.getCorpContext())).to.eq(5);
    });
  });

  describe('C28 Aphrodite onVenusRaised', () => {
    it('gains 2 M€ when Venus raised', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.APHRODITE)!;
      marsBot.setCorpAndSetup(corp);
      const mcBefore = marsBot.turnResolver.mcSupply;
      corp.effect!.onVenusRaised!(marsBot.getCorpContext());
      expect(marsBot.turnResolver.mcSupply).to.eq(mcBefore + 2);
    });
  });

  describe('C10 Tharsis Republic onTilePlaced', () => {
    it('gains 2 M€ when any city placed', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.THARSIS_REPUBLIC)!;
      marsBot.setCorpAndSetup(corp);
      const mcBefore = marsBot.turnResolver.mcSupply;
      corp.effect!.onTilePlaced!(marsBot.getCorpContext(), false, 2); // CITY = 2
      expect(marsBot.turnResolver.mcSupply).to.eq(mcBefore + 2);
    });

    it('advances event track when MarsBot places city', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.THARSIS_REPUBLIC)!;
      marsBot.setCorpAndSetup(corp);
      const eventBefore = marsBot.board.tracks[2].position;
      corp.effect!.onTilePlaced!(marsBot.getCorpContext(), true, 2); // CITY = 2
      expect(marsBot.board.tracks[2].position).to.be.gte(eventBefore + 1);
    });

    it('does not trigger on greenery placement', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.THARSIS_REPUBLIC)!;
      marsBot.setCorpAndSetup(corp);
      const mcBefore = marsBot.turnResolver.mcSupply;
      corp.effect!.onTilePlaced!(marsBot.getCorpContext(), false, 0); // GREENERY = 0
      expect(marsBot.turnResolver.mcSupply).to.eq(mcBefore);
    });
  });

  describe('C35 Lakefront Resorts onTilePlaced', () => {
    it('ocean placed with white cube → remove cube, advance building track', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.LAKEFRONT_RESORTS)!;
      marsBot.setCorpAndSetup(corp);
      expect(marsBot.corpSpecificState.get('whiteCubeOnCard')).to.eq(1);
      const buildingBefore = marsBot.board.tracks[0].position;
      corp.effect!.onTilePlaced!(marsBot.getCorpContext(), false, 1); // OCEAN = 1
      expect(marsBot.corpSpecificState.get('whiteCubeOnCard')).to.eq(0);
      expect(marsBot.board.tracks[0].position).to.be.gte(buildingBefore + 1);
    });

    it('ocean placed without white cube → place white cube', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.LAKEFRONT_RESORTS)!;
      marsBot.setCorpAndSetup(corp);
      marsBot.corpSpecificState.set('whiteCubeOnCard', 0);
      corp.effect!.onTilePlaced!(marsBot.getCorpContext(), false, 1); // OCEAN = 1
      expect(marsBot.corpSpecificState.get('whiteCubeOnCard')).to.eq(1);
    });
  });

  describe('C36 Pristar onGlobalParameterRaised', () => {
    it('intercepts parameter raise when white cube on card', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.PRISTAR)!;
      marsBot.setCorpAndSetup(corp);
      marsBot.corpSpecificState.set('whiteCubeOnCard', 1);
      const trBefore = marsBot.player.terraformRating;
      const mcBefore = marsBot.turnResolver.mcSupply;
      const skip = corp.effect!.onGlobalParameterRaised!(marsBot.getCorpContext(), 'temperature');
      expect(skip).to.be.true;
      expect(marsBot.corpSpecificState.get('whiteCubeOnCard')).to.eq(0);
      expect(marsBot.player.terraformRating).to.eq(trBefore + 1);
      expect(marsBot.turnResolver.mcSupply).to.eq(mcBefore + 6);
    });

    it('does not intercept without white cube', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.PRISTAR)!;
      marsBot.setCorpAndSetup(corp);
      marsBot.corpSpecificState.set('whiteCubeOnCard', 0);
      const skip = corp.effect!.onGlobalParameterRaised!(marsBot.getCorpContext(), 'temperature');
      expect(skip).to.be.false;
    });

    it('per-gen adds white cube when missing', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.PRISTAR)!;
      marsBot.setCorpAndSetup(corp);
      marsBot.corpSpecificState.set('whiteCubeOnCard', 0);
      corp.perGeneration!.resolve(marsBot.getCorpContext());
      expect(marsBot.corpSpecificState.get('whiteCubeOnCard')).to.eq(1);
    });
  });

  describe('C32 Polyphemos discard fewest tags', () => {
    it('discards card with fewest tags from action deck', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.POLYPHEMOS)!;
      marsBot.setCorpAndSetup(corp);
      const deckBefore = marsBot.actionDeck.length;
      corp.perGeneration!.resolve(marsBot.getCorpContext());
      expect(marsBot.actionDeck.length).to.eq(deckBefore - 1);
    });
  });

  describe('C06 Mining Guild MC interception', () => {
    it('intercepts MC gains, card starts at 10', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.MINING_GUILD)!;
      marsBot.setCorpAndSetup(corp);
      expect(marsBot.corpSpecificState.get('mcOnCard')).to.eq(10);
    });

    it('onMcGained returns reduced amount', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.MINING_GUILD)!;
      marsBot.setCorpAndSetup(corp);
      // 5 MC gained, 5 intercepted to card (10 → 5), 0 passes through
      const actual = corp.effect!.onMcGained!(marsBot.getCorpContext(), 5);
      expect(actual).to.eq(0);
      expect(marsBot.corpSpecificState.get('mcOnCard')).to.eq(5);
    });

    it('when card empties, refill + advance building track', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.MINING_GUILD)!;
      marsBot.setCorpAndSetup(corp);
      marsBot.corpSpecificState.set('mcOnCard', 2);
      const buildingBefore = marsBot.board.tracks[0].position;
      const actual = corp.effect!.onMcGained!(marsBot.getCorpContext(), 5);
      expect(actual).to.eq(3); // 5 - 2 intercepted = 3 passes through
      expect(marsBot.corpSpecificState.get('mcOnCard')).to.eq(10); // Refilled
      expect(marsBot.board.tracks[0].position).to.be.gte(buildingBefore + 1);
    });
  });

  describe('Ecoline/Ecotec plant targeting (FAQ)', () => {
    it('plant removal targets plantResources on corp card when present', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.ECOTEC)!;
      marsBot.setCorpAndSetup(corp);
      // Ecotec starts with 2 plant resources
      expect(marsBot.corpSpecificState.get('plantResources')).to.eq(2);
      const mcBefore = marsBot.turnResolver.mcSupply;
      // Remove 3 plants — should take 2 from card, excess lost, NOT from MC supply
      marsBot.player.stock.add('plants' as any, -3);
      expect(marsBot.corpSpecificState.get('plantResources')).to.eq(0);
      expect(marsBot.turnResolver.mcSupply).to.eq(mcBefore); // No MC deducted
    });

    it('non-plant removal still deducts from MC supply', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.ECOTEC)!;
      marsBot.setCorpAndSetup(corp);
      marsBot.turnResolver.mcSupply = 10;
      marsBot.player.stock.add('steel' as any, -3);
      expect(marsBot.turnResolver.mcSupply).to.eq(7);
    });
  });

  describe('Serialization with corp state', () => {
    it('round-trips floaterCount', () => {
      const {marsBot} = createAutomaGame();
      marsBot.floaterCount = 7;
      const state = marsBot.serialize();
      const {marsBot: marsBot2} = createAutomaGame();
      marsBot2.restoreState(state);
      expect(marsBot2.floaterCount).to.eq(7);
    });

    it('round-trips corpSpecificState', () => {
      const {marsBot} = createAutomaGame();
      marsBot.corpSpecificState.set('test', 42);
      const state = marsBot.serialize();
      const {marsBot: marsBot2} = createAutomaGame();
      marsBot2.restoreState(state);
      expect(marsBot2.corpSpecificState.get('test')).to.eq(42);
    });
  });
});
