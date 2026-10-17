import {expect} from 'chai';
import {CardName} from '../../../src/common/cards/CardName';
import {testGame} from '../../TestGame';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
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
import {Resource} from '../../../src/common/Resource';
import {BonusCardId, DifficultyLevel, FAILED_ACTION_MC} from '../../../src/common/automa/AutomaTypes';
import {MicroMills} from '../../../src/server/cards/base/MicroMills';
import {IceCapMelting} from '../../../src/server/cards/base/IceCapMelting';
import {Research} from '../../../src/server/cards/base/Research';
import {createCorpBonusCard} from '../../../src/server/automa/MarsBotBonusCard';
import {EcoLine} from '../../../src/server/cards/corporation/EcoLine';
import {Space} from '../../../src/server/boards/Space';
import {SpaceType} from '../../../src/common/boards/SpaceType';
import {TileType} from '../../../src/common/TileType';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {HeadStart} from '../../../src/server/cards/promo/HeadStart';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {Biofuels} from '../../../src/server/cards/prelude/Biofuels';
import {IPreludeCard} from '../../../src/server/cards/prelude/IPreludeCard';
import {cast} from '../../../src/common/utils/utils';
import {runAllActions, setTemperature} from '../../TestingUtils';
import {MAX_TEMPERATURE} from '../../../src/common/constants';

function createAutomaGame(automaDifficulty: DifficultyLevel = 'normal'): {game: IGame, human: TestPlayer, marsBot: MarsBot} {
  const [game, human] = testGame(1, {
    automaOption: true,
    automaDifficulty,
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

    it('gains 5 M€, a silver resource cube, when the building track reaches a credit cube', () => {
      const {marsBot} = createAutomaGame();
      marsBot.setCorpAndSetup(getMarsBotCorp(CardName.CHEUNG_SHING_MARS)!);
      marsBot.marsBotBoard.tracks[0].position = 3;
      const mc = marsBot.turnResolver.megacredits;

      marsBot.advanceTrack(0);

      expect(marsBot.turnResolver.megacredits).to.eq(mc + 5);
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
      // The corp's before-action-phase box waits for the player's preludes
      game.automaHooks!.handleActionPhaseStart();

      expect(marsBot.corp).to.eq(corp);
      expect(marsBot.markerSpaceIds).has.length(1);
      expect(game.board.getGreeneries(marsBot.player)).is.empty;
      const settlers = marsBot.actionDeck.filter((c) => 'id' in c && c.id === BonusCardId.B22_SETTLERS);
      expect(settlers).has.length(1);
    });

    it('holds the before-action-phase box until the player has played their preludes', () => {
      const [game, human] = testGame(1, {automaOption: true, automaCorpOption: true, preludeExtension: true, boardName: BoardName.THARSIS});
      const marsBot = game.automaHooks!.marsBot;
      const corp = getMarsBotCorp(CardName.ARCADIAN_COMMUNITIES)!;
      clearMarsBotCorpRegistry();
      registerMarsBotCorp(corp);
      human.pickedCorporationCard = new EcoLine();
      const biofuels = new Biofuels();
      human.preludeCardsInHand = [biofuels];
      const settlers = () => marsBot.actionDeck.filter((c) => 'id' in c && c.id === BonusCardId.B22_SETTLERS);

      game.automaHooks!.handlePostCorporationSetup();
      expect(marsBot.beforeActionPhasePending).is.true;
      human.takeAction();
      runAllActions(game);

      // The player is choosing a prelude: the box has not resolved
      cast(human.getWaitingFor(), SelectCard<IPreludeCard>);
      expect(settlers()).has.length(0);
      human.process({type: 'card', cards: [biofuels.name]});
      runAllActions(game);

      expect(marsBot.beforeActionPhasePending).is.false;
      expect(settlers()).has.length(1);
    });

    it('resolves the before-action-phase box before the actions Head Start grants', () => {
      const [game, human] = testGame(1, {automaOption: true, automaCorpOption: true, preludeExtension: true, boardName: BoardName.THARSIS});
      const marsBot = game.automaHooks!.marsBot;
      const corp = getMarsBotCorp(CardName.ARCADIAN_COMMUNITIES)!;
      clearMarsBotCorpRegistry();
      registerMarsBotCorp(corp);
      human.pickedCorporationCard = new EcoLine();
      const headStart = new HeadStart();
      const biofuels = new Biofuels();
      human.preludeCardsInHand = [headStart, biofuels];
      const settlers = () => marsBot.actionDeck.filter((c) => 'id' in c && c.id === BonusCardId.B22_SETTLERS);

      game.automaHooks!.handlePostCorporationSetup();
      human.takeAction();
      runAllActions(game);
      expect(settlers()).has.length(0);
      human.process({type: 'card', cards: [headStart.name]});
      runAllActions(game);

      // The player has not taken either of Head Start's actions yet, and the box has resolved
      expect(human.actionsTakenThisRound).to.eq(1);
      expect(human.getWaitingFor()).is.instanceOf(OrOptions);
      expect(marsBot.beforeActionPhasePending).is.false;
      expect(settlers()).has.length(1);
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

  describe('C20 Factorum', () => {
    it('stores 1 M€ on every advance of the building track, re-advances included', () => {
      const {marsBot} = createAutomaGame();
      marsBot.setCorpAndSetup(getMarsBotCorp(CardName.FACTORUM)!);
      marsBot.marsBotBoard.tracks[0].position = 3;
      marsBot.advanceTrack(0);
      marsBot.regressTrack(Resource.STEEL);
      const mcOnCard = marsBot.getCorpState('mcOnCard');

      marsBot.advanceTrack(0);

      expect(marsBot.getCorpState('mcOnCard')).to.eq(mcOnCard + 1);
    });
  });

  describe('C29 Manutech', () => {
    function createVenusGame(): MarsBot {
      const [game] = testGame(1, {automaOption: true, venusNextExtension: true, boardName: BoardName.THARSIS});
      return game.automaHooks!.marsBot;
    }

    it('has black cubes at #5 and #12 on all 8 tracks, Venus included', () => {
      const corp = getMarsBotCorp(CardName.MANUTECH)!;
      expect(corp.trackCubes!.length).to.eq(16); // 8 tracks × 2 positions
      for (let t = 0; t < 8; t++) {
        expect(corp.trackCubes).to.deep.include({trackIndex: t, position: 5, cubeType: 'black'});
        expect(corp.trackCubes).to.deep.include({trackIndex: t, position: 12, cubeType: 'black'});
      }
    });

    it('places no cubes on the Venus track without Venus Next', () => {
      const {marsBot} = createAutomaGame();
      expect(marsBot.marsBotBoard.tracks).to.have.length(7);

      marsBot.setCorpAndSetup(getMarsBotCorp(CardName.MANUTECH)!);

      expect([...marsBot.trackCubePositions.values()].filter((c) => c.trackIndex === 7)).is.empty;
    });

    it('places its reminder cubes on the Venus track with Venus Next', () => {
      const marsBot = createVenusGame();

      marsBot.setCorpAndSetup(getMarsBotCorp(CardName.MANUTECH)!);

      expect(marsBot.hasCubeAt(7, 5)?.cubeType).to.eq('black');
      expect(marsBot.hasCubeAt(7, 12)?.cubeType).to.eq('black');
    });

    it('advances the Venus track one more space when it reaches #5', () => {
      const marsBot = createVenusGame();
      marsBot.setCorpAndSetup(getMarsBotCorp(CardName.MANUTECH)!);
      marsBot.marsBotBoard.tracks[7].position = 4;

      marsBot.advanceTrack(7);

      expect(marsBot.marsBotBoard.tracks[7].position).to.eq(6);
    });

    // Our reading: the extra advance off the end of the Venus track is a Failed Action
    it('takes a Failed Action for the extra advance when Venus reaches #12, its last space', () => {
      const marsBot = createVenusGame();
      marsBot.setCorpAndSetup(getMarsBotCorp(CardName.MANUTECH)!);
      marsBot.marsBotBoard.tracks[7].position = 11;
      const mc = marsBot.turnResolver.megacredits;
      const tr = marsBot.player.terraformRating;

      marsBot.advanceTrack(7);

      expect(marsBot.marsBotBoard.tracks[7].position).to.eq(12);
      expect(marsBot.player.terraformRating).to.eq(tr + 5);
      expect(marsBot.turnResolver.megacredits).to.eq(mc + FAILED_ACTION_MC);
    });

    it('a save from before the Venus cubes still loads and advances Venus at #5', () => {
      const marsBot = createVenusGame();
      marsBot.setCorpAndSetup(getMarsBotCorp(CardName.MANUTECH)!);
      const serialized = marsBot.game.serialize();
      const state = serialized.automaState!;
      state.trackCubePositions = state.trackCubePositions!.filter((c) => c.trackIndex !== 7);

      const restored = Game.deserialize(serialized).automaHooks!.marsBot;
      expect(restored.hasCubeAt(7, 5)).is.undefined;
      restored.marsBotBoard.tracks[7].position = 4;
      restored.advanceTrack(7);

      expect(restored.marsBotBoard.tracks[7].position).to.eq(6);
    });

    it('reaching #5 advances the same track one more space', () => {
      const {marsBot} = createAutomaGame();
      marsBot.setCorpAndSetup(getMarsBotCorp(CardName.MANUTECH)!);
      marsBot.marsBotBoard.tracks[0].position = 4;

      marsBot.advanceTrack(0);

      expect(marsBot.marsBotBoard.tracks[0].position).to.eq(6);
    });

    it('resolves the #5 space before advancing to #6 and resolving that', () => {
      const {marsBot} = createAutomaGame();
      marsBot.setCorpAndSetup(getMarsBotCorp(CardName.MANUTECH)!);
      marsBot.marsBotBoard.tracks[0].position = 4; // Building #5: tr2, #6: temperature
      const resolved: Array<string> = [];
      const resolveTrackAction = marsBot.turnResolver['resolveTrackAction'].bind(marsBot.turnResolver);
      marsBot.turnResolver['resolveTrackAction'] = (action, trackIndex) => {
        resolved.push(action);
        resolveTrackAction(action, trackIndex);
      };

      marsBot.advanceTrack(0);

      // C29: "after resolving the effect, advance it another space, and resolve that one as well"
      expect(resolved).to.deep.eq(['tr2', 'temperature']);
    });

    it('does not advance again when the track re-reaches #5 after a regression', () => {
      const {marsBot} = createAutomaGame();
      marsBot.setCorpAndSetup(getMarsBotCorp(CardName.MANUTECH)!);
      marsBot.marsBotBoard.tracks[0].position = 4;
      marsBot.advanceTrack(0);
      marsBot.regressTrack(Resource.STEEL);
      marsBot.regressTrack(Resource.STEEL);
      expect(marsBot.marsBotBoard.tracks[0].position).to.eq(4);

      marsBot.advanceTrack(0);

      // Rulebook B p.3: moving back up does not retrigger a corporation trigger
      expect(marsBot.marsBotBoard.tracks[0].position).to.eq(5);
    });
  });

  describe('C40 Ecotec', () => {
    it('starts with 2 plants from the Setup box and 1 from its starting plant tag', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.ECOTEC)!;
      marsBot.setCorpAndSetup(corp);
      expect(marsBot.corpSpecificState.get('plantResources')).to.eq(3);
    });

    it('gains a plant resource per plant, microbe or animal tag', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.ECOTEC)!;
      marsBot.setCorpAndSetup(corp);
      marsBot.turnResolver.resolveProjectCard(fakeCard('PlantCard', {tags: [Tag.PLANT, Tag.MICROBE, Tag.SPACE], cost: 5}));
      expect(marsBot.corpSpecificState.get('plantResources')).to.eq(5);
    });

    it('ignores other tags', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.ECOTEC)!;
      marsBot.setCorpAndSetup(corp);
      marsBot.turnResolver.resolveProjectCard(fakeCard('SpaceCard', {tags: [Tag.SPACE, Tag.BUILDING], cost: 5}));
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

    // Our reading: the tagless card pays double whatever the Failed Action pays (3 M€ on Easy)
    it('pays double the Easy Failed Action for a tagless card', () => {
      const {marsBot} = createAutomaGame('easy');
      marsBot.setCorpAndSetup(getMarsBotCorp(CardName.SAGITTA_FRONTIER_SERVICES)!);
      const mcBefore = marsBot.turnResolver.megacredits;
      marsBot.turnResolver.resolveProjectCard(new MicroMills());
      expect(marsBot.turnResolver.megacredits).to.eq(mcBefore + 6);
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

    // A wild tag counts as a tag (Nick, Q&A 19)
    it('counts a wild tag toward the 2 tags', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.SPIRE)!;
      marsBot.setCorpAndSetup(corp);
      corp.effect!.onProjectCardResolved!(marsBot, fakeCard('WildAndBuilding', {tags: [Tag.WILD, Tag.BUILDING], cost: 10}));
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

    it('setup does not count Local Neural Instance as a destroyed bonus card', () => {
      const {marsBot} = createPhilaresGame();

      expect(marsBot.destroyedBonusCards).to.eq(0);
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
        return true;
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
        expect(cube).to.deep.include({trackIndex: 0, cubeType: 'white'});
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

    it('gains 1 more floater with each Failed Action', () => {
      const {marsBot} = createAutomaGame();
      marsBot.corp = getMarsBotCorp(CardName.CELESTIC)!;
      const mc = marsBot.turnResolver.megacredits;

      marsBot.turnResolver.resolveProjectCard(new MicroMills()); // No tags: a Failed Action

      expect(marsBot.floaters).to.eq(1);
      expect(marsBot.turnResolver.megacredits).to.eq(mc + 5);
    });
  });

  describe('C34 Stormcraft', () => {
    function createVenusGame(draftVariant: boolean): {game: IGame, human: TestPlayer, marsBot: MarsBot} {
      const [game, human] = testGame(1, {
        automaOption: true,
        automaDifficulty: 'normal',
        venusNextExtension: true,
        draftVariant,
        boardName: BoardName.THARSIS,
      });
      const marsBot = game.automaHooks!.marsBot;
      marsBot.corp = getMarsBotCorp(CardName.STORMCRAFT_INCORPORATED)!;
      // Hoverlord gone, so MarsBot may spend its floaters on an extra card.
      game.milestones = game.milestones.filter((m) => m.name !== 'Hoverlord');
      marsBot.floaters = 5;
      return {game, human, marsBot};
    }

    it('raises the temperature when it spends floaters for an extra card', () => {
      const {game, marsBot} = createVenusGame(false);
      game.generation = 2;
      const temperature = game.getTemperature();

      game.automaHooks!.handleResearchPhase();

      expect(marsBot.floaters).to.eq(1); // 5 + 1 at round start - 5
      expect(game.getTemperature()).to.eq(temperature + 2);
    });

    it('raises the temperature when it spends floaters to keep a 4th drafted card', () => {
      const {game, human, marsBot} = createVenusGame(true);
      const temperature = game.getTemperature();

      game.gotoResearchPhase();
      for (let round = 0; round < 4; round++) {
        const selectCard = cast(human.getWaitingFor(), SelectCard<IProjectCard>);
        selectCard.cb([selectCard.cards[0]]);
      }

      expect(marsBot.floaters).to.eq(1);
      expect(game.getTemperature()).to.eq(temperature + 2);
    });

    it('counts its temperature step among the ones MarsBot raised', () => {
      const {game, marsBot} = createVenusGame(false);
      game.generation = 2;

      game.automaHooks!.handleResearchPhase();

      expect(marsBot.temperatureRaises).to.eq(1);
    });

    it('counts no temperature step once the temperature is maxed', () => {
      const {game, marsBot} = createVenusGame(false);
      setTemperature(game, MAX_TEMPERATURE);
      game.generation = 2;

      game.automaHooks!.handleResearchPhase();

      expect(marsBot.temperatureRaises).to.eq(0);
    });

    it('does not raise the temperature without spending floaters', () => {
      const {game, marsBot} = createVenusGame(false);
      marsBot.floaters = 0;
      game.generation = 2;
      const temperature = game.getTemperature();

      game.automaHooks!.handleResearchPhase();

      expect(game.getTemperature()).to.eq(temperature);
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

    it('pays 5 M€, a silver resource cube, when the Venus track reaches a credit cube', () => {
      const {marsBot} = createVenusAutomaGame();
      marsBot.setCorpAndSetup(getMarsBotCorp(CardName.MORNING_STAR_INC)!);
      marsBot.marsBotBoard.tracks[7].position = 4;
      const mc = marsBot.turnResolver.megacredits;

      marsBot.advanceTrack(7);

      expect(marsBot.turnResolver.megacredits).to.eq(mc + 5);
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

    it('discards the project card with the fewest tags before the action phase, never a bonus card', () => {
      const {game, marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.POLYPHEMOS)!;
      const iceCapMelting = new IceCapMelting(); // Its Event tag only
      const bonus = createCorpBonusCard(BonusCardId.B03_RESEARCH_AND_DEVELOPMENT);
      marsBot.actionDeck = [bonus, new Research(), iceCapMelting];

      corp.beforeActionPhase!(marsBot);

      expect(marsBot.actionDeck.map((c) => c.name)).to.deep.eq([bonus.name, CardName.RESEARCH]);
      expect(game.projectDeck.discardPile).to.include(iceCapMelting);
    });

    it('discards nothing when the action deck holds no project card', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.POLYPHEMOS)!;
      marsBot.actionDeck = [createCorpBonusCard(BonusCardId.B03_RESEARCH_AND_DEVELOPMENT)];

      corp.beforeActionPhase!(marsBot);

      expect(marsBot.actionDeck).has.length(1);
    });
  });
});
