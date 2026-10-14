import {expect} from 'chai';
import {testGame} from '../TestGame';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {GameOptions} from '../../src/server/game/GameOptions';
import {MarsBot} from '../../src/server/automa/MarsBot';
import {marsBotAwardScore, marsBotCanClaimMilestone} from '../../src/server/automa/MarsBotMilestoneAwardEval';
import {AutomaGameSetup} from '../../src/server/automa/AutomaGameSetup';
import {BonusCardId} from '../../src/common/automa/AutomaTypes';
import {createCorpBonusCard} from '../../src/server/automa/MarsBotBonusCard';
import {marsBotAwardRule, marsBotMapSet, marsBotMilestoneRule} from '../../src/common/automa/MarsBotMADescriptions';
import {BoardName} from '../../src/common/boards/BoardName';
import {Tag} from '../../src/common/cards/Tag';
import {RandomMAOptionType} from '../../src/common/ma/RandomMAOptionType';
import {getCandidates} from '../../src/server/ma/MilestoneAwardSelector';
import {milestoneManifest} from '../../src/server/milestones/Milestones';
import {awardManifest} from '../../src/server/awards/Awards';
import {MilestoneName} from '../../src/common/ma/MilestoneName';
import {AwardName} from '../../src/common/ma/AwardName';
import {MARSBOT_BOARD_NAMES} from '../../src/common/automa/MarsBotBoards';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {Space} from '../../src/server/boards/Space';
import {TileType} from '../../src/common/TileType';
import {IMilestone} from '../../src/server/milestones/IMilestone';
import {Diversifier} from '../../src/server/milestones/Diversifier';
import {RimSettler} from '../../src/server/milestones/RimSettler';
import {Metallurgist} from '../../src/server/milestones/Metallurgist';
import {Smith} from '../../src/server/milestones/Smith';
import {Tradesman} from '../../src/server/milestones/Tradesman';
import {Coastguard} from '../../src/server/milestones/Irrigator';
import {LandSpecialist} from '../../src/server/milestones/arabiaTerra/LandSpecialist';
import {Engineer} from '../../src/server/milestones/modular/Engineer';
import {Farmer} from '../../src/server/milestones/modular/Farmer';
import {Fundraiser} from '../../src/server/milestones/modular/Fundraiser';
import {Planetologist} from '../../src/server/milestones/modular/Planetologist';
import {Merchant} from '../../src/server/milestones/modular/Merchant';
import {Pioneer} from '../../src/server/milestones/arabiaTerra/Pioneer';
import {Founder} from '../../src/server/awards/modular/Founder';
import {Traveller} from '../../src/server/awards/modular/Traveller';

// The Milestones & Awards expansion plays against the Tharsis board and its own rules.
const MODULAR: Partial<GameOptions> = {randomMA: RandomMAOptionType.UNLIMITED, modularMA: true};

function createGame(options: Partial<GameOptions>) {
  const [game, human] = testGame(1, {automaOption: true, ...options});
  return {game, human, marsBot: game.automaHooks!.marsBot};
}

function setTrack(marsBot: MarsBot, tag: Tag, position: number): void {
  marsBot.marsBotBoard.tracks[marsBot.marsBotBoard.tagToTrack[tag]!].position = position;
}

/** Resolves a bonus card the way a turn does, from the action deck. */
function resolveFromDeck(marsBot: MarsBot, id: BonusCardId): void {
  marsBot['bonusResolver'].resolve(createCorpBonusCard(id));
}

function claims(milestone: IMilestone, marsBot: MarsBot): boolean {
  return marsBotCanClaimMilestone(milestone, marsBot);
}

/** Puts `count` of the bot's greenery tiles next to one ocean. */
function placeTilesNextToOcean(game: ReturnType<typeof createGame>['game'], marsBot: MarsBot, count: number): void {
  const board = game.board;
  const emptyLand = (space: Space) => space.spaceType === SpaceType.LAND && space.tile === undefined;
  const ocean = board.spaces.find((space) =>
    space.spaceType === SpaceType.OCEAN && space.tile === undefined && board.getAdjacentSpaces(space).filter(emptyLand).length >= count)!;
  game.simpleAddTile(marsBot.player, ocean, {tileType: TileType.OCEAN});
  for (const space of board.getAdjacentSpaces(ocean).filter(emptyLand).slice(0, count)) {
    game.simpleAddTile(marsBot.player, space, {tileType: TileType.GREENERY});
  }
}

describe('MarsBot map milestones and awards', () => {
  describe('Hellas', () => {
    it('Rim Settler needs space 6 on the Jovian track', () => {
      const {marsBot} = createGame({boardName: BoardName.HELLAS});
      setTrack(marsBot, Tag.JOVIAN, 5);
      expect(claims(new RimSettler(), marsBot)).is.false;
      setTrack(marsBot, Tag.JOVIAN, 6);
      expect(claims(new RimSettler(), marsBot)).is.true;
    });

    it('Rim Settler with the modular milestones needs space 5 on the Energy track', () => {
      const {marsBot} = createGame({boardName: BoardName.HELLAS, ...MODULAR});
      setTrack(marsBot, Tag.POWER, 4);
      expect(claims(new RimSettler(), marsBot)).is.false;
      setTrack(marsBot, Tag.POWER, 5);
      expect(claims(new RimSettler(), marsBot)).is.true;
    });

    it('Diversifier needs space 3 on every track', () => {
      const {marsBot} = createGame({boardName: BoardName.HELLAS});
      const tracks = marsBot.marsBotBoard.tracks;
      tracks.forEach((track) => track.position = 3);
      expect(claims(new Diversifier(), marsBot)).is.true;
      tracks[2].position = 2;
      expect(claims(new Diversifier(), marsBot)).is.false;
    });

    it('Diversifier with Venus needs 7 of the 8 tracks at space 3', () => {
      const {marsBot} = createGame({boardName: BoardName.HELLAS, venusNextExtension: true});
      const tracks = marsBot.marsBotBoard.tracks;
      expect(tracks).has.length(8);
      tracks.forEach((track) => track.position = 3);
      tracks[7].position = 0;
      expect(claims(new Diversifier(), marsBot)).is.true;
      tracks[2].position = 2;
      expect(claims(new Diversifier(), marsBot)).is.false;
    });
  });

  describe('Terra Cimmeria', () => {
    it('Financier (Fundraiser) needs space 10 on the Event track', () => {
      const {marsBot} = createGame({boardName: BoardName.TERRA_CIMMERIA_NOVA});
      setTrack(marsBot, Tag.EVENT, 9);
      expect(claims(new Fundraiser(), marsBot)).is.false;
      setTrack(marsBot, Tag.EVENT, 10);
      expect(claims(new Fundraiser(), marsBot)).is.true;
    });

    it('Fundraiser with the modular milestones needs space 8 on the Event track', () => {
      const {marsBot} = createGame({boardName: BoardName.TERRA_CIMMERIA_NOVA, ...MODULAR});
      setTrack(marsBot, Tag.EVENT, 7);
      expect(claims(new Fundraiser(), marsBot)).is.false;
      setTrack(marsBot, Tag.EVENT, 8);
      expect(claims(new Fundraiser(), marsBot)).is.true;
    });

    it('Planetologist adds the Earth and Venus tracks up to 5', () => {
      const {marsBot} = createGame({boardName: BoardName.TERRA_CIMMERIA_NOVA, venusNextExtension: true});
      setTrack(marsBot, Tag.EARTH, 3);
      setTrack(marsBot, Tag.VENUS, 1);
      expect(claims(new Planetologist(), marsBot)).is.false;
      setTrack(marsBot, Tag.VENUS, 2);
      expect(claims(new Planetologist(), marsBot)).is.true;
    });

    it('Planetologist with the modular milestones wants two tracks at space 3', () => {
      const {marsBot} = createGame({boardName: BoardName.TERRA_CIMMERIA_NOVA, venusNextExtension: true, ...MODULAR});
      setTrack(marsBot, Tag.EARTH, 4);
      setTrack(marsBot, Tag.VENUS, 2);
      expect(claims(new Planetologist(), marsBot)).is.false;
      setTrack(marsBot, Tag.POWER, 3);
      setTrack(marsBot, Tag.EARTH, 3);
      expect(claims(new Planetologist(), marsBot)).is.true;
    });

    it('Coast Guard stays at 3 tiles next to an ocean', () => {
      const {game, marsBot} = createGame({boardName: BoardName.TERRA_CIMMERIA_NOVA});
      placeTilesNextToOcean(game, marsBot, 3);
      expect(claims(new Coastguard(), marsBot)).is.true;
    });

    it('Coastguard with the modular milestones needs 4 tiles next to an ocean', () => {
      const {game, marsBot} = createGame({boardName: BoardName.TERRA_CIMMERIA_NOVA, ...MODULAR});
      placeTilesNextToOcean(game, marsBot, 3);
      expect(claims(new Coastguard(), marsBot)).is.false;
    });

    it('the Neural Instance tile is a special tile for MarsBot only', () => {
      const {game, human, marsBot} = createGame({boardName: BoardName.TERRA_CIMMERIA_NOVA});
      const open = (space: Space) => space.spaceType === SpaceType.LAND && space.tile === undefined;
      const center = game.board.spaces.find((space) => open(space) && game.board.getAdjacentSpaces(space).filter(open).length >= 2)!;
      const [botNeighbor, humanNeighbor] = game.board.getAdjacentSpaces(center).filter(open);
      game.simpleAddTile(marsBot.player, center, {tileType: TileType.NEURAL_INSTANCE});
      game.simpleAddTile(marsBot.player, botNeighbor, {tileType: TileType.GREENERY});
      game.simpleAddTile(human, humanNeighbor, {tileType: TileType.GREENERY});

      expect(marsBotAwardScore(new Founder(), marsBot)).to.eq(1);
      expect(new Founder().getScore(human)).to.eq(0);
    });
  });

  describe('Utopia Planitia', () => {
    it('Specialist needs 3 destroyed bonus cards', () => {
      const {marsBot} = createGame({boardName: BoardName.UTOPIA_PLANITIA});
      marsBot.destroyedBonusCards = 2;
      expect(claims(new LandSpecialist(), marsBot)).is.false;
      marsBot.destroyedBonusCards = 3;
      expect(claims(new LandSpecialist(), marsBot)).is.true;
    });

    it('counts a bonus card destroyed while resolving', () => {
      const {marsBot} = createGame({boardName: BoardName.UTOPIA_PLANITIA});
      expect(marsBot.destroyedBonusCards).to.eq(0);

      resolveFromDeck(marsBot, BonusCardId.B07_LOCAL_NEURAL_INSTANCE);

      expect(marsBot.destroyedBonusCards).to.eq(1);
    });

    it('does not count a bonus card a corporation resolves and removes in setup', () => {
      const {marsBot} = createGame({boardName: BoardName.UTOPIA_PLANITIA});

      marsBot.resolveBonusCard(BonusCardId.B07_LOCAL_NEURAL_INSTANCE);

      expect(marsBot.destroyedBonusCards).to.eq(0);
    });

    it('does not count a bonus card shuffled back into the bonus deck', () => {
      const {marsBot} = createGame({boardName: BoardName.UTOPIA_PLANITIA});

      resolveFromDeck(marsBot, BonusCardId.B27_BUILD_BUILD_BUILD);

      expect(marsBot.destroyedBonusCards).to.eq(0);
    });

    it('does not count a bonus card that stays in play', () => {
      const {marsBot} = createGame({boardName: BoardName.UTOPIA_PLANITIA});

      resolveFromDeck(marsBot, BonusCardId.B02_INVASIVE_SPECIES);

      expect(marsBot.destroyedBonusCards).to.eq(0);
    });

    it('the destroyed bonus card count survives a reload', () => {
      const {game, marsBot} = createGame({boardName: BoardName.UTOPIA_PLANITIA});
      marsBot.destroyedBonusCards = 2;

      const restored = Game.deserialize(game.serialize());

      expect(restored.automaHooks!.marsBot.destroyedBonusCards).to.eq(2);
    });

    it('a fresh game starts without destroyed bonus cards', () => {
      const {game} = createGame({boardName: BoardName.UTOPIA_PLANITIA});

      expect(game.serialize().automaState?.destroyedBonusCards).is.undefined;
      expect(Game.deserialize(game.serialize()).automaHooks!.marsBot.destroyedBonusCards).to.eq(0);
    });

    it('Trader (Tradesman) needs space 2 on the Energy, Earth and Venus tracks', () => {
      const {marsBot} = createGame({boardName: BoardName.UTOPIA_PLANITIA, venusNextExtension: true});
      setTrack(marsBot, Tag.POWER, 2);
      setTrack(marsBot, Tag.EARTH, 2);
      setTrack(marsBot, Tag.VENUS, 1);
      expect(claims(new Tradesman(), marsBot)).is.false;
      setTrack(marsBot, Tag.VENUS, 2);
      expect(claims(new Tradesman(), marsBot)).is.true;
    });

    it('Trader (Tradesman) is left out without Venus Next', () => {
      const {game} = createGame({boardName: BoardName.UTOPIA_PLANITIA});

      expect(game.milestones.map((milestone) => milestone.name)).does.not.include('Tradesman');
    });

    it('Metallurgist (Smith) needs the Building and Space tracks to add up to 7', () => {
      const {marsBot} = createGame({boardName: BoardName.UTOPIA_PLANITIA});
      setTrack(marsBot, Tag.BUILDING, 3);
      setTrack(marsBot, Tag.SPACE, 3);
      expect(claims(new Smith(), marsBot)).is.false;
      setTrack(marsBot, Tag.SPACE, 4);
      expect(claims(new Smith(), marsBot)).is.true;
    });

    it('Metallurgist with the modular milestones needs 9', () => {
      const {marsBot} = createGame({boardName: BoardName.UTOPIA_PLANITIA, ...MODULAR});
      setTrack(marsBot, Tag.BUILDING, 4);
      setTrack(marsBot, Tag.SPACE, 4);
      expect(claims(new Metallurgist(), marsBot)).is.false;
      setTrack(marsBot, Tag.SPACE, 5);
      expect(claims(new Metallurgist(), marsBot)).is.true;
    });
  });

  describe('Vastitas Borealis', () => {
    it('Farmer needs space 6 on the Science/Microbe track', () => {
      const {marsBot} = createGame({boardName: BoardName.VASTITAS_BOREALIS_NOVA});
      setTrack(marsBot, Tag.SCIENCE, 5);
      setTrack(marsBot, Tag.PLANT, 5);
      expect(claims(new Farmer(), marsBot)).is.false;
      setTrack(marsBot, Tag.SCIENCE, 6);
      expect(claims(new Farmer(), marsBot)).is.true;
    });

    it('Farmer needs space 6 on the Plant/Animal track', () => {
      const {marsBot} = createGame({boardName: BoardName.VASTITAS_BOREALIS_NOVA});
      setTrack(marsBot, Tag.PLANT, 6);
      expect(claims(new Farmer(), marsBot)).is.true;
    });

    it('Farmer with the modular milestones needs space 7 on the bio track', () => {
      const {marsBot} = createGame({boardName: BoardName.VASTITAS_BOREALIS_NOVA, ...MODULAR});
      setTrack(marsBot, Tag.PLANT, 6);
      expect(claims(new Farmer(), marsBot)).is.false;
      setTrack(marsBot, Tag.PLANT, 7);
      expect(claims(new Farmer(), marsBot)).is.true;
    });

    it('Engineer adds the Jovian/Earth and Energy/City tracks up to 10', () => {
      const {marsBot} = createGame({boardName: BoardName.VASTITAS_BOREALIS_NOVA});
      setTrack(marsBot, Tag.POWER, 5);
      setTrack(marsBot, Tag.EARTH, 4);
      expect(claims(new Engineer(), marsBot)).is.false;
      setTrack(marsBot, Tag.JOVIAN, 5);
      expect(claims(new Engineer(), marsBot)).is.true;
    });

    it('Engineer with the modular milestones adds the Energy and Earth tracks', () => {
      const {marsBot} = createGame({boardName: BoardName.VASTITAS_BOREALIS_NOVA, ...MODULAR});
      setTrack(marsBot, Tag.POWER, 5);
      setTrack(marsBot, Tag.EARTH, 4);
      expect(claims(new Engineer(), marsBot)).is.false;
      setTrack(marsBot, Tag.EARTH, 5);
      expect(claims(new Engineer(), marsBot)).is.true;
    });

    it('Traveller scores the Jovian/Earth track plus 5', () => {
      const {marsBot} = createGame({boardName: BoardName.VASTITAS_BOREALIS_NOVA});
      setTrack(marsBot, Tag.EARTH, 3);
      expect(marsBotAwardScore(new Traveller(), marsBot)).to.eq(8);
    });

    it('Traveller with the modular awards scores the higher of Earth and Jovian plus 5', () => {
      const {marsBot} = createGame({boardName: BoardName.VASTITAS_BOREALIS_NOVA, ...MODULAR});
      setTrack(marsBot, Tag.EARTH, 3);
      setTrack(marsBot, Tag.JOVIAN, 6);
      expect(marsBotAwardScore(new Traveller(), marsBot)).to.eq(11);
    });
  });

  describe('modular milestone filtering', () => {
    it('keeps Merchant without Venus Next, it needs no Venus track', () => {
      const names = (venus: boolean) => AutomaGameSetup.filterMilestones(
        [new Merchant(), new Planetologist(), new Tradesman()], {venusNextExtension: venus} as GameOptions).map((m) => m.name);
      expect(names(false)).to.deep.eq(['Merchant']);
      expect(names(true)).to.deep.eq(['Merchant', 'Planetologist', 'Tradesman']);
    });
  });

  // Our reading: random milestones and awards deal only those the automa rules support
  describe('random milestones and awards', () => {
    it('leaves out the ones the automa rules do not cover', () => {
      const [game] = testGame(1, {automaOption: true, randomMA: RandomMAOptionType.UNLIMITED, includeFanMA: true, venusNextExtension: true});
      const [milestones, awards] = getCandidates(game.gameOptions);

      expect(milestones).to.include.members(['Terraformer', 'Polar Explorer', 'Hoverlord']);
      for (const name of ['Minimalist', 'Tropicalist', 'Economizer', 'Capitalist']) {
        expect(milestones).to.not.include(name);
      }
      expect(awards).to.include.members(['Landlord', 'Desert Settler', 'Venuphile']);
      for (const name of ['Curator', 'Tourist', 'Urbanist', 'Warmonger', 'Innovator', 'Physicist']) {
        expect(awards).to.not.include(name);
      }
    });

    const ALL_EXPANSIONS = {venusNextExtension: true, turmoilExtension: true} as GameOptions;

    it('supports exactly the milestones and awards rulebook C gives MarsBot a rule for', () => {
      const milestones = (Object.keys(milestoneManifest.all) as Array<MilestoneName>)
        .filter((name) => AutomaGameSetup.supportsMilestone(name, ALL_EXPANSIONS));
      const awards = (Object.keys(awardManifest.all) as Array<AwardName>)
        .filter((name) => AutomaGameSetup.supportsAward(name, ALL_EXPANSIONS));

      expect(milestones).to.have.members([
        'Agronomist', 'Architect', 'Briber', 'Builder', 'Builder7', 'C. Forester', 'Coastguard', 'Diversifier',
        'Ecologist', 'Energizer', 'Engineer', 'Farmer', 'Fundraiser', 'Gardener', 'Generalist', 'Geologist',
        'Hoverlord', 'Hydrologist', 'Land Specialist', 'Landshaper', 'Legend', 'Legend4', 'Lobbyist', 'Mayor',
        'Merchant', 'Metallurgist', 'Philantropist', 'Pioneer', 'Planetologist', 'Planner',
        'Polar Explorer', 'Producer', 'Researcher', 'Rim Settler', 'Smith', 'Spacefarer4', 'Specialist', 'Sponsor',
        'Tactician', 'Tactician4', 'Terraformer', 'Terran', 'Terran5', 'Thawer', 'Trader', 'Tradesman', 'Tycoon', 'Tycoon10',
        'V. Spacefarer',
      ]);
      expect(awards).to.have.members([
        'A. Zoologist', 'Administrator', 'Banker', 'Benefactor', 'Biologist', 'Blacksmith', 'Botanist', 'Celebrity',
        'Collector', 'Constructor', 'Contractor', 'Cultivator', 'Desert Settler', 'Electrician',
        'Estate Dealer', 'Excentric', 'Forecaster', 'Founder', 'Highlander', 'Incorporator', 'Industrialist',
        'Investor', 'Landlord', 'Landscaper', 'Magnate', 'Manufacturer', 'Metropolist', 'Miner', 'Mogul',
        'Politician', 'Promoter', 'Scientist', 'Space Baron', 'Suburbian', 'Thermalist', 'Traveller', 'Venuphile',
        'Visionary',
      ]);
    });

    // A milestone or award upstream adds to the random pool gets no MarsBot rule
    it('does not support a new milestone or award just because it can be dealt at random', () => {
      const milestones = milestoneManifest.all as Record<string, unknown>;
      const awards = awardManifest.all as Record<string, unknown>;
      milestones['New Milestone'] = {...milestoneManifest.all['Mayor'], random: 'both'};
      awards['New Award'] = {...awardManifest.all['Landlord'], random: 'both'};
      try {
        expect(AutomaGameSetup.supportsMilestone('New Milestone' as MilestoneName, ALL_EXPANSIONS)).is.false;
        expect(AutomaGameSetup.supportsAward('New Award' as AwardName, ALL_EXPANSIONS)).is.false;
      } finally {
        delete milestones['New Milestone'];
        delete awards['New Award'];
      }
    });

    it('still deals 5 of each, all supported', () => {
      for (const modularMA of [false, true]) {
        for (let i = 0; i < 10; i++) {
          const [game] = testGame(1, {automaOption: true, randomMA: RandomMAOptionType.UNLIMITED, includeFanMA: true, modularMA});
          expect(game.milestones, `modular ${modularMA}`).has.length(5);
          expect(game.awards, `modular ${modularMA}`).has.length(5);
          for (const milestone of game.milestones) {
            expect(AutomaGameSetup.supportsMilestone(milestone.name, game.gameOptions), milestone.name).is.true;
          }
          for (const award of game.awards) {
            expect(AutomaGameSetup.supportsAward(award.name, game.gameOptions), award.name).is.true;
          }
        }
      }
    });
  });

  describe('descriptions', () => {
    it('a map set uses its own wording', () => {
      expect(marsBotMilestoneRule('Rim Settler', BoardName.HELLAS)).to.eq('Science/Jovian track ≥ 6');
      expect(marsBotMilestoneRule('Fundraiser', BoardName.TERRA_CIMMERIA_NOVA)).to.eq('Event track ≥ 10');
      expect(marsBotMilestoneRule('Farmer', BoardName.VASTITAS_BOREALIS_NOVA)).to.eq('Science/Microbe track or Bio track ≥ 6');
      expect(marsBotAwardRule('Traveller', BoardName.VASTITAS_BOREALIS_NOVA)).to.eq('Earth/Jovian track + 5');
    });

    it('Agronomist counts the Plant/Animal track on Vastitas Borealis, the Bio track elsewhere', () => {
      expect(marsBotMilestoneRule('Agronomist', BoardName.VASTITAS_BOREALIS_NOVA)).to.eq('Plant/Animal track ≥ 4');
      expect(marsBotMilestoneRule('Agronomist')).to.eq('Bio track ≥ 4');
    });

    it('describes the rest of the Milestones & Awards expansion', () => {
      for (const name of ['Trader', 'Sponsor', 'Lobbyist', 'Pioneer'] as const) {
        expect(marsBotMilestoneRule(name), name).is.a('string');
      }
      for (const name of ['Biologist', 'Constructor'] as const) {
        expect(marsBotAwardRule(name), name).is.a('string');
      }
    });

    // The descriptions are the "MarsBot: ..." hints on the board's milestones and awards
    it('describe every milestone and award MarsBot plays against', () => {
      const options = {venusNextExtension: true, turmoilExtension: true} as GameOptions;
      for (const board of MARSBOT_BOARD_NAMES) {
        for (const name of milestoneManifest.boards[board]) {
          expect(marsBotMilestoneRule(name, board), `${board} ${name}`).is.a('string');
        }
        for (const name of awardManifest.boards[board]) {
          expect(marsBotAwardRule(name, board), `${board} ${name}`).is.a('string');
        }
      }
      for (const name of Object.keys(milestoneManifest.all) as Array<MilestoneName>) {
        if (AutomaGameSetup.supportsMilestone(name, options)) {
          expect(marsBotMilestoneRule(name), name).is.a('string');
        }
      }
      for (const name of Object.keys(awardManifest.all) as Array<AwardName>) {
        if (AutomaGameSetup.supportsAward(name, options)) {
          expect(marsBotAwardRule(name), name).is.a('string');
        }
      }
    });

    it('the modular wording is the default', () => {
      expect(marsBotMilestoneRule('Rim Settler')).to.eq('Energy track ≥ 5');
      expect(marsBotMilestoneRule('Fundraiser')).to.eq('Event track ≥ 8');
      expect(marsBotMilestoneRule('Farmer')).to.eq('Bio track ≥ 7');
    });

    it('a map set falls back to the default for milestones it does not reword', () => {
      expect(marsBotMilestoneRule('Energizer', BoardName.HELLAS)).to.eq('Energy track ≥ 6');
    });

    it('the map set applies unless the Milestones & Awards expansion is on', () => {
      const options = {boardName: BoardName.HELLAS, modularMA: false};
      expect(marsBotMapSet(options)).to.eq(BoardName.HELLAS);
      expect(marsBotMapSet({...options, modularMA: true})).is.undefined;
    });

    it('random milestones and awards still use the map rule of the map\'s own milestone', () => {
      const {marsBot} = createGame({boardName: BoardName.HELLAS, randomMA: RandomMAOptionType.UNLIMITED});
      setTrack(marsBot, Tag.JOVIAN, 6);
      expect(claims(new RimSettler(), marsBot)).is.true;
      setTrack(marsBot, Tag.JOVIAN, 5);
      expect(claims(new RimSettler(), marsBot)).is.false;
    });

    it('random milestones from another map use the generic rule', () => {
      const {marsBot} = createGame({boardName: BoardName.HELLAS, randomMA: RandomMAOptionType.UNLIMITED});
      setTrack(marsBot, Tag.EVENT, 8);
      expect(claims(new Fundraiser(), marsBot)).is.true;
    });

    it('modular games play the Tharsis board', () => {
      expect(AutomaGameSetup.marsBotBoardName({boardName: BoardName.HELLAS, ...MODULAR} as GameOptions)).to.eq(BoardName.THARSIS);
    });
  });

  describe('Pioneer colony cubes', () => {
    /** Deals `Pioneer` as the only milestone and reruns the cube setup. */
    function dealPioneer(game: IGame, marsBot: MarsBot): void {
      game.milestones = [new Pioneer()];
      game.awards = [];
      marsBot.hasColonyCubes = false;
      marsBot.colonyCubePositions = new Set();
      (AutomaGameSetup as any).placeColonyCubes(game, marsBot);
    }

    it('Utopia Planitia\'s own Pioneer places no colony cubes', () => {
      const {game, marsBot} = createGame({boardName: BoardName.UTOPIA_PLANITIA});
      expect(game.milestones.map((m) => m.name)).to.include('Pioneer');
      expect(marsBot.hasColonyCubes).is.false;
      expect(marsBotMilestoneRule('Pioneer', BoardName.UTOPIA_PLANITIA)).to.eq('4+ colonies');
    });

    it('the modular Pioneer places colony cubes', () => {
      const {game, marsBot} = createGame({boardName: BoardName.UTOPIA_PLANITIA, ...MODULAR});
      dealPioneer(game, marsBot);
      expect(marsBot.hasColonyCubes).is.true;
      expect(marsBot.colonyCubePositions.size).to.eq(3);
      expect(marsBotMilestoneRule('Pioneer')).to.match(/^4\+ colonies \(cubes/);
    });

    it('Pioneer dealt at random on another map places colony cubes', () => {
      const {game, marsBot} = createGame({boardName: BoardName.THARSIS, randomMA: RandomMAOptionType.LIMITED});
      dealPioneer(game, marsBot);
      expect(marsBot.hasColonyCubes).is.true;
    });
  });
});
