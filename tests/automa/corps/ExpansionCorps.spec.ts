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
  registerMarsBotCorp,
} from '../../../src/server/automa/corps/MarsBotCorpRegistry';
import {Tag} from '../../../src/common/cards/Tag';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {BoardName} from '../../../src/common/boards/BoardName';
import {BonusCardId} from '../../../src/common/automa/AutomaTypes';
import {MicroMills} from '../../../src/server/cards/base/MicroMills';
import {IceCapMelting} from '../../../src/server/cards/base/IceCapMelting';
import {EcoLine} from '../../../src/server/cards/corporation/EcoLine';
import {Space} from '../../../src/server/boards/Space';
import {SpaceType} from '../../../src/common/boards/SpaceType';
import {TileType} from '../../../src/common/TileType';

function createAutomaGame(): {game: IGame, human: TestPlayer, marsBot: MarsBot} {
  const [game, human] = testGame(1, {
    automaOption: true,
    automaDifficulty: 'normal',
    boardName: BoardName.THARSIS,
  });
  expect(game.automaHooks?.marsBot).to.not.be.undefined;
  return {game, human, marsBot: game.automaHooks!.marsBot};
}

function fakeCard(name: string, opts: {tags?: Array<Tag>, cost?: number, requirements?: boolean, victoryPoints?: number} = {}): IProjectCard {
  return {
    name: name as CardName,
    tags: opts.tags ?? [],
    cost: opts.cost ?? 0,
    requirements: opts.requirements ? [{oceans: 1}] : [],
    getVictoryPoints: () => opts.victoryPoints ?? 0,
  } as unknown as IProjectCard;
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
      expect(corp.tags).to.deep.eq([Tag.BUILDING]);
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
      const mcBefore = marsBot.turnResolver.megacredits;
      corp.effect!.onTrackCubeTrigger!(marsBot, 0, 4, 'credit');
      expect(marsBot.turnResolver.megacredits).to.eq(mcBefore + 1);
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
      const leastBefore = marsBot.marsBotBoard.tracks[marsBot.marsBotBoard.getLeastAdvancedTrackIndex()].position;
      corp.effect!.onTrackCubeTrigger!(marsBot, 5, 1, 'white');
      // Some track should have advanced
      expect(marsBot.marsBotBoard.tracks[marsBot.marsBotBoard.getLeastAdvancedTrackIndex()].position).to.be.gte(leastBefore);
    });
  });

  describe('C15 Robinson Industries', () => {
    it('gains 10 M€ on setup', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.ROBINSON_INDUSTRIES)!;
      const mcBefore = marsBot.turnResolver.megacredits;
      marsBot.setCorpAndSetup(corp);
      expect(marsBot.turnResolver.megacredits).to.eq(mcBefore + 10);
    });
  });

  // ---- Prelude 2 corps ----

  describe('C18 Arcadian Communities', () => {
    it('resolves Settlers at setup and puts one Settlers in the first action deck', () => {
      const [game, human] = testGame(1, {automaOption: true, automaCorpOption: true, boardName: BoardName.THARSIS});
      const marsBot = game.automaHooks!.marsBot;
      const corp = getMarsBotCorp(CardName.ARCADIAN_COMMUNITIES)!;
      clearMarsBotCorpRegistry();
      registerMarsBotCorp(corp);
      human.pickedCorporationCard = new EcoLine();

      game.automaHooks!.handlePostCorporationSetup();

      expect(marsBot.corp).to.eq(corp);
      expect(marsBot.markerSpaceIds).has.length(1);
      expect(game.board.getGreeneries(marsBot.player)).is.empty;
      const settlers = marsBot.actionDeck.filter((c) => 'id' in c && c.id === BonusCardId.B22_SETTLERS);
      expect(settlers).has.length(1);
    });

    it('gains 3 M€ when it places a tile on a space holding its marker', () => {
      const {game, marsBot} = createAutomaGame();
      marsBot.setCorpAndSetup(getMarsBotCorp(CardName.ARCADIAN_COMMUNITIES)!);
      const marked = game.board.getSpaceOrThrow(marsBot.markerSpaceIds[0]);
      const mc = marsBot.megacredits;

      game.addCity(marsBot.player, marked);

      expect(marsBot.megacredits).to.eq(mc + 3);
      expect(marsBot.markerSpaceIds).is.empty;
    });

    it('gains nothing for a tile on an unmarked space', () => {
      const {game, marsBot} = createAutomaGame();
      marsBot.setCorpAndSetup(getMarsBotCorp(CardName.ARCADIAN_COMMUNITIES)!);
      const unmarked = game.board.getAvailableSpacesForCity(marsBot.player)
        .find((space) => space.player === undefined)!;
      const mc = marsBot.megacredits;

      game.addCity(marsBot.player, unmarked);

      expect(marsBot.megacredits).to.eq(mc);
      expect(marsBot.markerSpaceIds).has.length(1);
    });
  });

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
      const track1Before = marsBot.marsBotBoard.tracks[0].position;
      corp.effect!.onTrackCubeTrigger!(marsBot, 0, 5, 'black');
      expect(marsBot.marsBotBoard.tracks[0].position).to.be.gte(track1Before + 1);
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
      corp.effect!.onProjectCardResolved!(marsBot, fakeCard('PlantCard', {tags: [Tag.PLANT], cost: 5}));
      expect(marsBot.corpSpecificState.get('plantResources')).to.eq(3);
    });

    it('spends 5 plant resources to advance plant track', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.ECOTEC)!;
      marsBot.setCorpAndSetup(corp);
      marsBot.corpSpecificState.set('plantResources', 6);
      const plantTrackBefore = marsBot.marsBotBoard.tracks[6].position;
      corp.beforeActionPhase!(marsBot);
      expect(marsBot.corpSpecificState.get('plantResources')).to.eq(1);
      expect(marsBot.marsBotBoard.tracks[6].position).to.be.gte(plantTrackBefore + 1);
    });
  });

  describe('C41 Kuiper Cooperative', () => {
    it('white cube raises temperature, black cube places ocean', () => {
      const corp = getMarsBotCorp(CardName.KUIPER_COOPERATIVE)!;
      expect(corp.trackCubes!.filter((c) => c.cubeType === 'white').length).to.eq(3);
      expect(corp.trackCubes!.filter((c) => c.cubeType === 'black').length).to.eq(3);
    });
  });

  describe('C42 Nirgal Enterprises', () => {
    it('scores 2 more in every award', () => {
      const {game, marsBot} = createAutomaGame();
      const scores = () => game.awards.map((award) => marsBot.turnResolver.getMarsBotAwardValue(award));
      const before = scores();

      marsBot.corp = getMarsBotCorp(CardName.NIRGAL_ENTERPRISES)!;

      expect(scores()).to.deep.eq(before.map((score) => score + 2));
    });

    it('wins a funded award at final scoring with its +2', () => {
      const {game, human, marsBot} = createAutomaGame();
      marsBot.corp = getMarsBotCorp(CardName.NIRGAL_ENTERPRISES)!;
      game.fundAward(human, game.awards.find((a) => a.name === 'Scientist')!);
      human.tagsForTest = {science: 2};

      expect(marsBot.getVictoryPoints().awards).to.eq(5);
    });

    it('claims a milestone before the action phase in generations 2-5 and 10+', () => {
      for (const generation of [2, 5, 10, 14]) {
        const {game, marsBot} = createAutomaGame();
        marsBot.corp = getMarsBotCorp(CardName.NIRGAL_ENTERPRISES)!;
        marsBot.marsBotBoard.tracks[0].position = 8; // 8 building tags: Builder
        (game as any).generation = generation;

        marsBot.corp.beforeActionPhase!(marsBot);

        expect(game.claimedMilestones.map((m) => [m.player, m.milestone.name]), `generation ${generation}`)
          .to.deep.eq([[marsBot.player, 'Builder']]);
        expect(game.fundedAwards, `generation ${generation}`).is.empty;
      }
    });

    it('funds an award before the action phase in generations 6-9', () => {
      for (const generation of [6, 9]) {
        const {game, marsBot} = createAutomaGame();
        marsBot.corp = getMarsBotCorp(CardName.NIRGAL_ENTERPRISES)!;
        marsBot.marsBotBoard.tracks[0].position = 8;
        (game as any).generation = generation;

        marsBot.corp.beforeActionPhase!(marsBot);

        expect(game.fundedAwards.map((a) => a.player), `generation ${generation}`).to.deep.eq([marsBot.player]);
        expect(game.claimedMilestones, `generation ${generation}`).is.empty;
      }
    });

    it('takes no Failed Action when it cannot claim or fund', () => {
      const {game, human, marsBot} = createAutomaGame();
      marsBot.corp = getMarsBotCorp(CardName.NIRGAL_ENTERPRISES)!;
      for (const award of game.awards.slice(0, 3)) {
        game.fundAward(human, award);
      }
      const mc = marsBot.turnResolver.megacredits;

      (game as any).generation = 3; // No milestone is met.
      marsBot.corp.beforeActionPhase!(marsBot);
      (game as any).generation = 7; // Every award slot is taken.
      marsBot.corp.beforeActionPhase!(marsBot);

      expect(game.claimedMilestones).is.empty;
      expect(game.fundedAwards).has.length(3);
      expect(marsBot.turnResolver.megacredits).to.eq(mc);
    });
  });

  describe('C43 Paladin Shipping', () => {
    it('collects cubes and pairs them for temperature raise', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.PALLADIN_SHIPPING)!;
      marsBot.setCorpAndSetup(corp);

      // Collect 1 white cube
      corp.effect!.onTrackCubeTrigger!(marsBot, 1, 3, 'white');
      expect(marsBot.corpSpecificState.get('whiteCubesOnCard')).to.eq(1);

      // Collect 1 black cube — should pair and raise temp
      corp.effect!.onTrackCubeTrigger!(marsBot, 2, 3, 'black');
      expect(marsBot.corpSpecificState.get('whiteCubesOnCard')).to.eq(0);
      expect(marsBot.corpSpecificState.get('blackCubesOnCard')).to.eq(0);
    });
  });

  describe('C44 Sagitta', () => {
    it('gains 8 M€ on setup', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.SAGITTA_FRONTIER_SERVICES)!;
      const mcBefore = marsBot.turnResolver.megacredits;
      marsBot.setCorpAndSetup(corp);
      expect(marsBot.turnResolver.megacredits).to.eq(mcBefore + 8);
    });

    it('gains extra 5 M€ for tagless cards', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.SAGITTA_FRONTIER_SERVICES)!;
      marsBot.setCorpAndSetup(corp);
      const mcBefore = marsBot.turnResolver.megacredits;
      corp.effect!.onProjectCardResolved!(marsBot, fakeCard('Tagless', {cost: 5}));
      expect(marsBot.turnResolver.megacredits).to.eq(mcBefore + 5);
    });

    it('pays 10 M€ in all for a tagless card MarsBot plays', () => {
      const {marsBot} = createAutomaGame();
      marsBot.setCorpAndSetup(getMarsBotCorp(CardName.SAGITTA_FRONTIER_SERVICES)!);
      const mcBefore = marsBot.turnResolver.megacredits;
      marsBot.turnResolver.resolveProjectCard(new MicroMills());
      expect(marsBot.turnResolver.megacredits).to.eq(mcBefore + 10);
    });

    it('counts the Event tag, so an event with no printed tags pays 1 M€', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.SAGITTA_FRONTIER_SERVICES)!;
      marsBot.setCorpAndSetup(corp);
      const mcBefore = marsBot.turnResolver.megacredits;
      corp.effect!.onProjectCardResolved!(marsBot, new IceCapMelting());
      expect(marsBot.turnResolver.megacredits).to.eq(mcBefore + 1);
    });

    it('gains 1 M€ for 1-tag cards', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.SAGITTA_FRONTIER_SERVICES)!;
      marsBot.setCorpAndSetup(corp);
      const mcBefore = marsBot.turnResolver.megacredits;
      corp.effect!.onProjectCardResolved!(marsBot, fakeCard('OneTag', {tags: [Tag.BUILDING], cost: 5}));
      expect(marsBot.turnResolver.megacredits).to.eq(mcBefore + 1);
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
      corp.effect!.onProjectCardResolved!(marsBot, fakeCard('TwoTags', {tags: [Tag.BUILDING, Tag.SPACE], cost: 10}));
      expect(marsBot.corpSpecificState.get('scienceResources')).to.eq(1);
    });

    it('does not gain science for 1-tag cards', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.SPIRE)!;
      marsBot.setCorpAndSetup(corp);
      corp.effect!.onProjectCardResolved!(marsBot, fakeCard('OneTag', {tags: [Tag.BUILDING], cost: 5}));
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
      corp.effect!.onProjectCardResolved!(marsBot, fakeCard('SciCard', {tags: [Tag.SCIENCE], cost: 10}));
      expect(marsBot.player.terraformRating).to.eq(trBefore + 1);
    });

    it('human microbe card → lose 4 M€', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.PHARMACY_UNION)!;
      marsBot.setCorpAndSetup(corp);
      marsBot.turnResolver.megacredits = 10;
      corp.effect!.onHumanCardPlayed!(marsBot, fakeCard('MicrobeCard', {tags: [Tag.MICROBE], cost: 5}));
      expect(marsBot.turnResolver.megacredits).to.eq(6);
    });
  });

  describe('C22 Philares', () => {
    /** An empty land space with no tile within two spaces of it. */
    function quietSpace(game: IGame, marsBot: MarsBot): Space {
      const board = game.board;
      return board.getAvailableSpacesOnLand(marsBot.player).find((space) => {
        const adj = board.getAdjacentSpaces(space);
        return adj.length === 6 && adj.every((s) => s.spaceType === SpaceType.LAND &&
          board.getAdjacentSpaces(s).every((t) => t.tile === undefined));
      })!;
    }

    function createPhilaresGame(): {game: IGame, human: TestPlayer, marsBot: MarsBot} {
      const {game, human, marsBot} = createAutomaGame();
      marsBot.setCorpAndSetup(getMarsBotCorp(CardName.PHILARES)!);
      marsBot.setCorpState('scienceResources', 0);
      return {game, human, marsBot};
    }

    it('setup places a greenery, resolves Local Neural Instance and removes it', () => {
      const {game, marsBot} = createAutomaGame();
      marsBot.addBonusCardToActionDeck(BonusCardId.B07_LOCAL_NEURAL_INSTANCE);

      marsBot.setCorpAndSetup(getMarsBotCorp(CardName.PHILARES)!);

      expect(game.board.getGreeneries(marsBot.player)).has.length(1);
      expect(marsBot.neuralInstanceSpace?.tile?.tileType).to.eq(TileType.NEURAL_INSTANCE);
      expect(marsBot.getCorpState('scienceResources')).to.eq(1);
      const bonusIds = [...marsBot.bonusDeck.drawPile, ...marsBot.bonusDeck.discardPile].map((c) => c.id);
      expect(bonusIds).does.not.include(BonusCardId.B07_LOCAL_NEURAL_INSTANCE);
      expect(bonusIds).includes(BonusCardId.B27_BUILD_BUILD_BUILD);
      expect(marsBot.actionDeck.some((c) => 'id' in c && c.id === BonusCardId.B07_LOCAL_NEURAL_INSTANCE)).is.false;
    });

    it('gains a science resource when MarsBot places a tile next to the player\'s tile', () => {
      const {game, human, marsBot} = createPhilaresGame();
      const space = quietSpace(game, marsBot);
      game.simpleAddTile(human, game.board.getAdjacentSpaces(space)[0], {tileType: TileType.GREENERY});

      game.addCity(marsBot.player, space);

      expect(marsBot.getCorpState('scienceResources')).to.eq(1);
    });

    it('gains a science resource when the player places a tile next to MarsBot\'s tile', () => {
      const {game, human, marsBot} = createPhilaresGame();
      const space = quietSpace(game, marsBot);
      game.simpleAddTile(marsBot.player, game.board.getAdjacentSpaces(space)[0], {tileType: TileType.GREENERY});

      game.addCity(human, space);

      expect(marsBot.getCorpState('scienceResources')).to.eq(1);
    });

    it('gains one science resource for each of the other side\'s tiles the new tile touches', () => {
      const {game, human, marsBot} = createPhilaresGame();
      const space = quietSpace(game, marsBot);
      const [first, second] = game.board.getAdjacentSpaces(space);
      game.simpleAddTile(human, first, {tileType: TileType.GREENERY});
      game.simpleAddTile(human, second, {tileType: TileType.GREENERY});

      game.addCity(marsBot.player, space);

      expect(marsBot.getCorpState('scienceResources')).to.eq(2);
    });

    it('spends 4 science resources to advance the most advanced track that is not maxed', () => {
      const {game, human, marsBot} = createPhilaresGame();
      marsBot.setCorpState('scienceResources', 3);
      const tracks = marsBot.marsBotBoard.tracks;
      tracks[0].position = tracks[0].definition.layout.length - 1;
      tracks[1].position = 10;
      const advanced: Array<number> = [];
      marsBot.turnResolver.advanceTrack = (i) => {
        advanced.push(i);
      };
      const space = quietSpace(game, marsBot);
      game.simpleAddTile(human, game.board.getAdjacentSpaces(space)[0], {tileType: TileType.GREENERY});

      game.addCity(marsBot.player, space);

      expect(advanced).to.deep.eq([1]);
      expect(marsBot.getCorpState('scienceResources')).to.eq(0);
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
      const plantBefore = marsBot.marsBotBoard.tracks[6].position;
      corp.effect!.onTrackCubeTrigger!(marsBot, 0, 3, 'white');
      expect(marsBot.marsBotBoard.tracks[6].position).to.be.gte(plantBefore + 1);
    });
  });

  describe('C24 Splice', () => {
    it('gains 8 M€ on setup and removes R&D', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.SPLICE)!;
      const mcBefore = marsBot.turnResolver.megacredits;
      marsBot.setCorpAndSetup(corp);
      expect(marsBot.turnResolver.megacredits).to.eq(mcBefore + 8);
    });

    it('marsbot microbe card → +4 M€', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.SPLICE)!;
      marsBot.setCorpAndSetup(corp);
      const mcBefore = marsBot.turnResolver.megacredits;
      corp.effect!.onProjectCardResolved!(marsBot, fakeCard('Microbe', {tags: [Tag.MICROBE], cost: 5}));
      expect(marsBot.turnResolver.megacredits).to.eq(mcBefore + 4);
    });
  });

  // ---- Venus corps ----

  describe('C26 Celestic', () => {
    it('gains floater on setup', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.CELESTIC)!;
      marsBot.setCorpAndSetup(corp);
      expect(marsBot.floaters).to.eq(1);
    });

    it('gains floater each round start', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.CELESTIC)!;
      marsBot.setCorpAndSetup(corp);
      corp.roundStart!(marsBot);
      expect(marsBot.floaters).to.eq(2);
    });
  });

  describe('C27 Morningstar', () => {
    function createVenusAutomaGame(): {game: IGame, marsBot: MarsBot} {
      const [game] = testGame(1, {
        automaOption: true,
        automaDifficulty: 'normal',
        venusNextExtension: true,
        boardName: BoardName.THARSIS,
      });
      return {game, marsBot: game.automaHooks!.marsBot};
    }

    it('places credit cubes on the Venus track', () => {
      const {marsBot} = createVenusAutomaGame();
      marsBot.setCorpAndSetup(getMarsBotCorp(CardName.MORNING_STAR_INC)!);
      for (const position of [5, 6, 7, 8, 9, 11, 12]) {
        expect(marsBot.hasCubeAt(7, position)?.cubeType, `Venus ${position}`).to.eq('credit');
      }
      expect(marsBot.hasCubeAt(7, 10)).to.be.undefined;
    });

    it('pays 1 M€ when the Venus track reaches a credit cube', () => {
      const {marsBot} = createVenusAutomaGame();
      marsBot.setCorpAndSetup(getMarsBotCorp(CardName.MORNING_STAR_INC)!);
      marsBot.marsBotBoard.tracks[7].position = 4;
      const mc = marsBot.turnResolver.megacredits;

      marsBot.advanceTrack(7);

      expect(marsBot.turnResolver.megacredits).to.eq(mc + 1);
    });

    it('removes the Venus Next Lobbyists from the bonus deck', () => {
      const {marsBot} = createVenusAutomaGame();
      const deck = marsBot['bonusDeck'];
      const ids = () => [...deck.drawPile, ...deck.discardPile, ...marsBot.actionDeck].map((c) => (c as {id?: BonusCardId}).id);
      expect(ids()).to.include(BonusCardId.B15_LOBBYISTS_VENUS);
      marsBot.setCorpAndSetup(getMarsBotCorp(CardName.MORNING_STAR_INC)!);
      expect(ids()).to.not.include(BonusCardId.B15_LOBBYISTS_VENUS);
      expect(ids()).to.include(BonusCardId.B26_VENUSIAN_LOBBY);
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
      corp.beforeActionPhase!(marsBot); // gen 1 → 1 card
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
      const eventBefore = marsBot.marsBotBoard.tracks[2].position;
      corp.effect!.onTrackCubeTrigger!(marsBot, 1, 3, 'white');
      expect(marsBot.marsBotBoard.tracks[2].position).to.be.gte(eventBefore + 1);
    });
  });

  describe('C32 Polyphemos', () => {
    it('gains at least 25 M€ on setup (plus MC from starting tag track actions)', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.POLYPHEMOS)!;
      const mcBefore = marsBot.turnResolver.megacredits;
      marsBot.setCorpAndSetup(corp);
      expect(marsBot.turnResolver.megacredits).to.be.gte(mcBefore + 25);
    });

    it('has 6 starting tags (3 Space + 3 Event)', () => {
      const corp = getMarsBotCorp(CardName.POLYPHEMOS)!;
      expect(corp.tags).to.deep.eq([Tag.SPACE, Tag.SPACE, Tag.SPACE, Tag.EVENT, Tag.EVENT, Tag.EVENT]);
    });
  });
});
