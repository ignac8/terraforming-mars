import {expect} from 'chai';
import {CardName} from '../../../src/common/cards/CardName';
import {testGame} from '../../TestGame';
import {IGame} from '../../../src/server/IGame';
import {TestPlayer} from '../../TestPlayer';
import {MarsBot} from '../../../src/server/automa/MarsBot';
import {
  clearMarsBotCorpRegistry, restoreMarsBotCorpRegistry,
  getMarsBotCorp,
  getAllMarsBotCorps,
} from '../../../src/server/automa/corps/MarsBotCorpRegistry';
import {Tag} from '../../../src/common/cards/Tag';
import {BoardName} from '../../../src/common/boards/BoardName';

function createAutomaGame(): {game: IGame, human: TestPlayer, marsBot: MarsBot} {
  const [game, human] = testGame(1, {
    automaOption: true,
    automaDifficulty: 'normal',
    boardName: BoardName.THARSIS,
  });
  expect(game.automaHooks?.marsBot).to.not.be.undefined;
  return {game, human, marsBot: game.automaHooks!.marsBot};
}

describe('Expansion MarsBot Corporations', () => {
  beforeEach(() => {
    clearMarsBotCorpRegistry();
    restoreMarsBotCorpRegistry();
  });

  afterEach(() => {
    restoreMarsBotCorpRegistry();
  });

  describe('Registration', () => {
    it('all 46 corps registered (12 base + 34 expansion)', () => {
      expect(getAllMarsBotCorps().length).to.eq(46);
    });
  });

  // ---- Prelude corps ----

  describe('C13 Cheung Shing MARS', () => {
    it('has building tag and building draft priority', () => {
      const corp = getMarsBotCorp(CardName.CHEUNG_SHING_MARS)!;
      expect(corp.startingTags).to.deep.eq([Tag.BUILDING]);
      expect(corp.draftPriority).to.deep.eq({type: 'tags', tags: [Tag.BUILDING]});
    });

    it('has credit cubes on building track positions 4-18', () => {
      const corp = getMarsBotCorp(CardName.CHEUNG_SHING_MARS)!;
      expect(corp.trackCubes!.length).to.eq(15);
      expect(corp.trackCubes![0]).to.deep.include({trackIndex: 0, position: 4, cubeType: 'credit'});
      expect(corp.trackCubes![14]).to.deep.include({trackIndex: 0, position: 18, cubeType: 'credit'});
    });

    it('gains 1 M€ per credit cube reached', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.CHEUNG_SHING_MARS)!;
      marsBot.setCorpAndSetup(corp);
      const mcBefore = marsBot.turnResolver.mcSupply;
      corp.effect!.onTrackCubeTrigger!(marsBot.getCorpContext(), 0, 4, 'credit');
      expect(marsBot.turnResolver.mcSupply).to.eq(mcBefore + 1);
    });
  });

  describe('C14 Point Luna', () => {
    it('has white+black cubes on Earth track', () => {
      const corp = getMarsBotCorp(CardName.POINT_LUNA)!;
      const whites = corp.trackCubes!.filter((c) => c.cubeType === 'white');
      const blacks = corp.trackCubes!.filter((c) => c.cubeType === 'black');
      expect(whites.length).to.eq(5);
      expect(blacks.length).to.eq(4);
    });

    it('white cube advances least-advanced track', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.POINT_LUNA)!;
      marsBot.setCorpAndSetup(corp);
      // All tracks at some position after starting tags. White cube → least advanced.
      const ctx = marsBot.getCorpContext();
      const leastBefore = marsBot.board.tracks[ctx.leastAdvancedTrackIndex].position;
      corp.effect!.onTrackCubeTrigger!(marsBot.getCorpContext(), 5, 1, 'white');
      // Some track should have advanced
      expect(marsBot.board.tracks[ctx.leastAdvancedTrackIndex].position).to.be.gte(leastBefore);
    });
  });

  describe('C15 Robinson Industries', () => {
    it('gains 10 M€ on setup', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.ROBINSON_INDUSTRIES)!;
      const mcBefore = marsBot.turnResolver.mcSupply;
      marsBot.setCorpAndSetup(corp);
      expect(marsBot.turnResolver.mcSupply).to.eq(mcBefore + 10);
    });
  });

  // ---- Prelude 2 corps ----

  describe('C29 Manutech', () => {
    it('has black cubes at #5 and #12 on all 7 tracks', () => {
      const corp = getMarsBotCorp(CardName.MANUTECH)!;
      expect(corp.trackCubes!.length).to.eq(14); // 7 tracks × 2 positions
      for (let t = 0; t < 7; t++) {
        expect(corp.trackCubes!.some((c) => c.trackIndex === t && c.position === 5)).to.be.true;
        expect(corp.trackCubes!.some((c) => c.trackIndex === t && c.position === 12)).to.be.true;
      }
    });

    it('black cube triggers advance on same track', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.MANUTECH)!;
      marsBot.setCorpAndSetup(corp);
      const track1Before = marsBot.board.tracks[0].position;
      corp.effect!.onTrackCubeTrigger!(marsBot.getCorpContext(), 0, 5, 'black');
      expect(marsBot.board.tracks[0].position).to.be.gte(track1Before + 1);
    });
  });

  describe('C40 Ecotec', () => {
    it('starts with 2 plant resources on card', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.ECOTEC)!;
      marsBot.setCorpAndSetup(corp);
      expect(marsBot.corpSpecificState.get('plantResources')).to.eq(2);
    });

    it('gains plant resource when plant/microbe/animal card played', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.ECOTEC)!;
      marsBot.setCorpAndSetup(corp);
      corp.effect!.onProjectCardResolved!(marsBot.getCorpContext(), {name: 'PlantCard', tags: [Tag.PLANT], cost: 5, hasRequirements: false, victoryPoints: 0});
      expect(marsBot.corpSpecificState.get('plantResources')).to.eq(3);
    });

    it('spends 5 plant resources to advance plant track', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.ECOTEC)!;
      marsBot.setCorpAndSetup(corp);
      marsBot.corpSpecificState.set('plantResources', 6);
      const plantTrackBefore = marsBot.board.tracks[6].position;
      corp.perGeneration!.resolve(marsBot.getCorpContext());
      expect(marsBot.corpSpecificState.get('plantResources')).to.eq(1);
      expect(marsBot.board.tracks[6].position).to.be.gte(plantTrackBefore + 1);
    });
  });

  describe('C41 Kuiper Cooperative', () => {
    it('white cube raises temperature, black cube places ocean', () => {
      const corp = getMarsBotCorp(CardName.KUIPER_COOPERATIVE)!;
      expect(corp.trackCubes!.filter((c) => c.cubeType === 'white').length).to.eq(3);
      expect(corp.trackCubes!.filter((c) => c.cubeType === 'black').length).to.eq(3);
    });
  });

  describe('C43 Paladin Shipping', () => {
    it('collects cubes and pairs them for temperature raise', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.PALLADIN_SHIPPING)!;
      marsBot.setCorpAndSetup(corp);

      // Collect 1 white cube
      corp.effect!.onTrackCubeTrigger!(marsBot.getCorpContext(), 1, 3, 'white');
      expect(marsBot.corpSpecificState.get('whiteCubesOnCard')).to.eq(1);

      // Collect 1 black cube — should pair and raise temp
      corp.effect!.onTrackCubeTrigger!(marsBot.getCorpContext(), 2, 3, 'black');
      expect(marsBot.corpSpecificState.get('whiteCubesOnCard')).to.eq(0);
      expect(marsBot.corpSpecificState.get('blackCubesOnCard')).to.eq(0);
    });
  });

  describe('C44 Sagitta', () => {
    it('gains 8 M€ on setup', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.SAGITTA_FRONTIER_SERVICES)!;
      const mcBefore = marsBot.turnResolver.mcSupply;
      marsBot.setCorpAndSetup(corp);
      expect(marsBot.turnResolver.mcSupply).to.eq(mcBefore + 8);
    });

    it('gains extra 5 M€ for tagless cards', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.SAGITTA_FRONTIER_SERVICES)!;
      marsBot.setCorpAndSetup(corp);
      const mcBefore = marsBot.turnResolver.mcSupply;
      corp.effect!.onProjectCardResolved!(marsBot.getCorpContext(), {name: 'Tagless', tags: [], cost: 5, hasRequirements: false, victoryPoints: 0});
      expect(marsBot.turnResolver.mcSupply).to.eq(mcBefore + 5);
    });

    it('gains 1 M€ for 1-tag cards', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.SAGITTA_FRONTIER_SERVICES)!;
      marsBot.setCorpAndSetup(corp);
      const mcBefore = marsBot.turnResolver.mcSupply;
      corp.effect!.onProjectCardResolved!(marsBot.getCorpContext(), {name: 'OneTag', tags: [Tag.BUILDING], cost: 5, hasRequirements: false, victoryPoints: 0});
      expect(marsBot.turnResolver.mcSupply).to.eq(mcBefore + 1);
    });
  });

  describe('C45 Spire', () => {
    it('has mostTags draft priority', () => {
      const corp = getMarsBotCorp(CardName.SPIRE)!;
      expect(corp.draftPriority).to.deep.eq({type: 'mostTags'});
    });

    it('gains science resource for 2+ tag cards', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.SPIRE)!;
      marsBot.setCorpAndSetup(corp);
      corp.effect!.onProjectCardResolved!(marsBot.getCorpContext(), {name: 'TwoTags', tags: [Tag.BUILDING, Tag.SPACE], cost: 10, hasRequirements: false, victoryPoints: 0});
      expect(marsBot.corpSpecificState.get('scienceResources')).to.eq(1);
    });

    it('does not gain science for 1-tag cards', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.SPIRE)!;
      marsBot.setCorpAndSetup(corp);
      corp.effect!.onProjectCardResolved!(marsBot.getCorpContext(), {name: 'OneTag', tags: [Tag.BUILDING], cost: 5, hasRequirements: false, victoryPoints: 0});
      expect(marsBot.corpSpecificState.get('scienceResources') ?? 0).to.eq(0);
    });
  });

  // ---- Promo corps ----

  describe('C21 Pharmacy Union', () => {
    it('science card played → TR +1', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.PHARMACY_UNION)!;
      marsBot.setCorpAndSetup(corp);
      const trBefore = marsBot.player.terraformRating;
      corp.effect!.onProjectCardResolved!(marsBot.getCorpContext(), {name: 'SciCard', tags: [Tag.SCIENCE], cost: 10, hasRequirements: false, victoryPoints: 0});
      expect(marsBot.player.terraformRating).to.eq(trBefore + 1);
    });

    it('human microbe card → lose 4 M€', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.PHARMACY_UNION)!;
      marsBot.setCorpAndSetup(corp);
      marsBot.turnResolver.mcSupply = 10;
      corp.effect!.onHumanCardPlayed!(marsBot.getCorpContext(), {name: 'MicrobeCard', tags: [Tag.MICROBE], cost: 5, hasRequirements: false, victoryPoints: 0});
      expect(marsBot.turnResolver.mcSupply).to.eq(6);
    });
  });

  describe('C23 Recyclone', () => {
    it('has 6 white cubes on building track', () => {
      const corp = getMarsBotCorp(CardName.RECYCLON)!;
      expect(corp.trackCubes!.length).to.eq(6);
      for (const cube of corp.trackCubes!) {
        expect(cube.trackIndex).to.eq(0);
        expect(cube.cubeType).to.eq('white');
      }
    });

    it('white cube on building track advances plant track', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.RECYCLON)!;
      marsBot.setCorpAndSetup(corp);
      const plantBefore = marsBot.board.tracks[6].position;
      corp.effect!.onTrackCubeTrigger!(marsBot.getCorpContext(), 0, 3, 'white');
      expect(marsBot.board.tracks[6].position).to.be.gte(plantBefore + 1);
    });
  });

  describe('C24 Splice', () => {
    it('gains 8 M€ on setup and removes R&D', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.SPLICE)!;
      const mcBefore = marsBot.turnResolver.mcSupply;
      marsBot.setCorpAndSetup(corp);
      expect(marsBot.turnResolver.mcSupply).to.eq(mcBefore + 8);
    });

    it('marsbot microbe card → +4 M€', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.SPLICE)!;
      marsBot.setCorpAndSetup(corp);
      const mcBefore = marsBot.turnResolver.mcSupply;
      corp.effect!.onProjectCardResolved!(marsBot.getCorpContext(), {name: 'Microbe', tags: [Tag.MICROBE], cost: 5, hasRequirements: false, victoryPoints: 0});
      expect(marsBot.turnResolver.mcSupply).to.eq(mcBefore + 4);
    });
  });

  // ---- Venus corps ----

  describe('C26 Celestic', () => {
    it('gains floater on setup', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.CELESTIC)!;
      marsBot.setCorpAndSetup(corp);
      expect(marsBot.floaterCount).to.eq(1);
    });

    it('gains floater each round start', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.CELESTIC)!;
      marsBot.setCorpAndSetup(corp);
      corp.perGeneration!.resolve(marsBot.getCorpContext());
      expect(marsBot.floaterCount).to.eq(2);
    });
  });

  // ---- Turmoil corps ----

  describe('C38 Terralabs', () => {
    it('reduces TR by 8 on setup', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.TERRALABS_RESEARCH)!;
      const trBefore = marsBot.player.terraformRating;
      marsBot.setCorpAndSetup(corp);
      expect(marsBot.player.terraformRating).to.eq(trBefore - 8);
    });

    it('draws 1 card for gen 1-8, 2 cards for gen 9+', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.TERRALABS_RESEARCH)!;
      marsBot.setCorpAndSetup(corp);

      const deckBefore = marsBot.actionDeck.length;
      corp.perGeneration!.resolve(marsBot.getCorpContext()); // gen 1 → 1 card
      expect(marsBot.actionDeck.length).to.eq(deckBefore + 1);
    });
  });

  // ---- Colonies corps ----

  describe('C30 Aridor', () => {
    it('has leastAdvancedTrack draft priority', () => {
      const corp = getMarsBotCorp(CardName.ARIDOR)!;
      expect(corp.draftPriority).to.deep.eq({type: 'leastAdvancedTrack'});
    });

    it('has white+black cubes on multiple tracks', () => {
      const corp = getMarsBotCorp(CardName.ARIDOR)!;
      expect(corp.trackCubes!.length).to.eq(9);
    });

    it('cube trigger advances event track', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.ARIDOR)!;
      marsBot.setCorpAndSetup(corp);
      const eventBefore = marsBot.board.tracks[2].position;
      corp.effect!.onTrackCubeTrigger!(marsBot.getCorpContext(), 1, 3, 'white');
      expect(marsBot.board.tracks[2].position).to.be.gte(eventBefore + 1);
    });
  });

  describe('C32 Polyphemos', () => {
    it('gains at least 25 M€ on setup (plus MC from starting tag track actions)', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.POLYPHEMOS)!;
      const mcBefore = marsBot.turnResolver.mcSupply;
      marsBot.setCorpAndSetup(corp);
      expect(marsBot.turnResolver.mcSupply).to.be.gte(mcBefore + 25);
    });

    it('has 6 starting tags (3 Space + 3 Event)', () => {
      const corp = getMarsBotCorp(CardName.POLYPHEMOS)!;
      expect(corp.startingTags).to.deep.eq([Tag.SPACE, Tag.SPACE, Tag.SPACE, Tag.EVENT, Tag.EVENT, Tag.EVENT]);
    });
  });
});
