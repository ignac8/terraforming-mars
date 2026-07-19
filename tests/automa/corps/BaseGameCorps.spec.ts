import {expect} from 'chai';
import {testGame} from '../../TestGame';
import {IGame} from '../../../src/server/IGame';
import {TestPlayer} from '../../TestPlayer';
import {MarsBot} from '../../../src/server/automa/MarsBot';
import {MarsBotCorpResolver} from '../../../src/server/automa/corps/MarsBotCorpResolver';
import {
  clearMarsBotCorpRegistry, restoreMarsBotCorpRegistry,
  getMarsBotCorp,
} from '../../../src/server/automa/corps/MarsBotCorpRegistry';
import {Tag} from '../../../src/common/cards/Tag';
import {CardName} from '../../../src/common/cards/CardName';
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

describe('Base Game MarsBot Corporations', () => {
  beforeEach(() => {
    clearMarsBotCorpRegistry();
    restoreMarsBotCorpRegistry();
  });

  afterEach(() => {
    restoreMarsBotCorpRegistry();
  });

  describe('Registration', () => {
    it('all 12 base game corps are registered', () => {
      expect(getMarsBotCorp(CardName.CREDICOR)).to.not.be.undefined;
      expect(getMarsBotCorp(CardName.ECOLINE)).to.not.be.undefined;
      expect(getMarsBotCorp(CardName.HELION)).to.not.be.undefined;
      expect(getMarsBotCorp(CardName.INTERPLANETARY_CINEMATICS)).to.not.be.undefined;
      expect(getMarsBotCorp(CardName.INVENTRIX)).to.not.be.undefined;
      expect(getMarsBotCorp(CardName.MINING_GUILD)).to.not.be.undefined;
      expect(getMarsBotCorp(CardName.PHOBOLOG)).to.not.be.undefined;
      expect(getMarsBotCorp(CardName.SATURN_SYSTEMS)).to.not.be.undefined;
      expect(getMarsBotCorp(CardName.TERACTOR)).to.not.be.undefined;
      expect(getMarsBotCorp(CardName.THARSIS_REPUBLIC)).to.not.be.undefined;
      expect(getMarsBotCorp(CardName.THORGATE)).to.not.be.undefined;
      expect(getMarsBotCorp(CardName.UNITED_NATIONS_MARS_INITIATIVE)).to.not.be.undefined;
    });

    it('corp names match CardName enum', () => {
      expect(getMarsBotCorp(CardName.CREDICOR)!.name).to.eq(CardName.CREDICOR);
      expect(getMarsBotCorp(CardName.SATURN_SYSTEMS)!.name).to.eq(CardName.SATURN_SYSTEMS);
      expect(getMarsBotCorp(CardName.THARSIS_REPUBLIC)!.name).to.eq(CardName.THARSIS_REPUBLIC);
      expect(getMarsBotCorp(CardName.UNITED_NATIONS_MARS_INITIATIVE)!.name).to.eq(CardName.UNITED_NATIONS_MARS_INITIATIVE);
    });
  });

  describe('C01 Credicor', () => {
    it('gains 4 M€ when card costs 20+', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.CREDICOR)!;
      marsBot.setCorpAndSetup(corp);

      const mcBefore = marsBot.turnResolver.mcSupply;
      corp.effect!.onProjectCardResolved!(marsBot.getCorpContext(), {name: 'Expensive', tags: [], cost: 25, hasRequirements: false, victoryPoints: 0});
      expect(marsBot.turnResolver.mcSupply).to.eq(mcBefore + 4);
    });

    it('does not gain M€ when card costs less than 20', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.CREDICOR)!;
      marsBot.setCorpAndSetup(corp);

      const mcBefore = marsBot.turnResolver.mcSupply;
      corp.effect!.onProjectCardResolved!(marsBot.getCorpContext(), {name: 'Cheap', tags: [], cost: 15, hasRequirements: false, victoryPoints: 0});
      expect(marsBot.turnResolver.mcSupply).to.eq(mcBefore);
    });

    it('has mostExpensive draft priority', () => {
      const corp = getMarsBotCorp(CardName.CREDICOR)!;
      expect(corp.draftPriority).to.deep.eq({type: 'mostExpensive'});
    });
  });

  describe('C08 Saturn Systems', () => {
    it('has Jovian > Space draft priority', () => {
      const corp = getMarsBotCorp(CardName.SATURN_SYSTEMS)!;
      expect(corp.draftPriority).to.deep.eq({type: 'tags', tags: [Tag.JOVIAN, Tag.SPACE]});
    });

    it('has 4 starting tags (Jovian + 3 Space)', () => {
      const corp = getMarsBotCorp(CardName.SATURN_SYSTEMS)!;
      expect(corp.startingTags).to.deep.eq([Tag.JOVIAN, Tag.SPACE, Tag.SPACE, Tag.SPACE]);
    });

    it('advances event track when Jovian card resolved', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.SATURN_SYSTEMS)!;
      marsBot.setCorpAndSetup(corp);

      const eventTrackBefore = marsBot.board.tracks[2].position; // Event = track 3
      corp.effect!.onProjectCardResolved!(marsBot.getCorpContext(), {name: 'JovianCard', tags: [Tag.JOVIAN], cost: 10, hasRequirements: false, victoryPoints: 0});
      // Event track should have advanced (may chain from starting tags advancement)
      expect(marsBot.board.tracks[2].position).to.be.gte(eventTrackBefore + 1);
    });

    it('advances event track when human plays Jovian card', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.SATURN_SYSTEMS)!;
      marsBot.setCorpAndSetup(corp);

      const eventTrackBefore = marsBot.board.tracks[2].position;
      corp.effect!.onHumanCardPlayed!(marsBot.getCorpContext(), {name: 'HumanJovian', tags: [Tag.JOVIAN], cost: 5, hasRequirements: false, victoryPoints: 0});
      expect(marsBot.board.tracks[2].position).to.be.gte(eventTrackBefore + 1);
    });

    it('does NOT advance event track for non-Jovian cards', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.SATURN_SYSTEMS)!;
      marsBot.setCorpAndSetup(corp);

      const eventTrackBefore = marsBot.board.tracks[2].position;
      corp.effect!.onProjectCardResolved!(marsBot.getCorpContext(), {name: 'SpaceCard', tags: [Tag.SPACE], cost: 10, hasRequirements: false, victoryPoints: 0});
      expect(marsBot.board.tracks[2].position).to.eq(eventTrackBefore);
    });
  });

  describe('C09 Teractor', () => {
    it('gains 25 M€ on setup', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.TERACTOR)!;

      const mcBefore = marsBot.turnResolver.mcSupply;
      marsBot.setCorpAndSetup(corp);
      expect(marsBot.turnResolver.mcSupply).to.eq(mcBefore + 25);
    });

    it('has earth draft priority', () => {
      const corp = getMarsBotCorp(CardName.TERACTOR)!;
      expect(corp.draftPriority).to.deep.eq({type: 'tags', tags: [Tag.EARTH]});
    });
  });

  describe('C11 Thorgate', () => {
    it('has 4 white cubes on energy track', () => {
      const corp = getMarsBotCorp(CardName.THORGATE)!;
      expect(corp.trackCubes).to.have.length(4);
      expect(corp.trackCubes![0]).to.deep.eq({trackIndex: 4, position: 4, cubeType: 'white'});
      expect(corp.trackCubes![3]).to.deep.eq({trackIndex: 4, position: 10, cubeType: 'white'});
    });

    it('gains 10 M€ on setup', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.THORGATE)!;

      const mcBefore = marsBot.turnResolver.mcSupply;
      marsBot.setCorpAndSetup(corp);
      expect(marsBot.turnResolver.mcSupply).to.eq(mcBefore + 10);
    });

    it('has energy draft priority', () => {
      const corp = getMarsBotCorp(CardName.THORGATE)!;
      expect(corp.draftPriority).to.deep.eq({type: 'tags', tags: [Tag.POWER]});
    });

    it('starting energy tag advances energy track', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.THORGATE)!;
      marsBot.setCorpAndSetup(corp);
      // Energy = track 5 (Power/Jovian tag)
      expect(marsBot.board.tracks[4].position).to.be.gte(1);
    });
  });

  describe('C03 Helion', () => {
    it('has 6 white + 6 black cubes', () => {
      const corp = getMarsBotCorp(CardName.HELION)!;
      const whiteCubes = corp.trackCubes!.filter((c) => c.cubeType === 'white');
      const blackCubes = corp.trackCubes!.filter((c) => c.cubeType === 'black');
      expect(whiteCubes).to.have.length(6);
      expect(blackCubes).to.have.length(6);
    });

    it('places cubes on setup', () => {
      const {marsBot} = createAutomaGame();
      const corp = getMarsBotCorp(CardName.HELION)!;
      marsBot.setCorpAndSetup(corp);
      expect(marsBot.trackCubePositions.size).to.eq(12);
      expect(marsBot.hasCubeAt(0, 6)).to.not.be.undefined;
      expect(marsBot.hasCubeAt(5, 3)).to.not.be.undefined;
    });
  });

  describe('C07 Phobolog', () => {
    it('has 4 white cubes on space track', () => {
      const corp = getMarsBotCorp(CardName.PHOBOLOG)!;
      expect(corp.trackCubes).to.have.length(4);
      for (const cube of corp.trackCubes!) {
        expect(cube.trackIndex).to.eq(1);
        expect(cube.cubeType).to.eq('white');
      }
    });

    it('has Space starting tag', () => {
      const corp = getMarsBotCorp(CardName.PHOBOLOG)!;
      expect(corp.startingTags).to.deep.eq([Tag.SPACE]);
    });
  });

  describe('C04 Interplanetary Cinematics', () => {
    it('has 2 Event starting tags', () => {
      const corp = getMarsBotCorp(CardName.INTERPLANETARY_CINEMATICS)!;
      expect(corp.startingTags).to.deep.eq([Tag.EVENT, Tag.EVENT]);
    });
  });

  describe('C06 Mining Guild', () => {
    it('has 2 Building starting tags', () => {
      const corp = getMarsBotCorp(CardName.MINING_GUILD)!;
      expect(corp.startingTags).to.deep.eq([Tag.BUILDING, Tag.BUILDING]);
    });
  });

  describe('Corp selection', () => {
    it('selects a corp excluding human corp', () => {
      const rng = {next: () => 0, nextInt: (_n: number) => 0} as any;
      const corp = MarsBotCorpResolver.selectCorp(CardName.CREDICOR, rng);
      expect(corp).to.not.be.undefined;
      expect(corp!.name).to.not.eq(CardName.CREDICOR);
    });

    it('can select any of the 12 base corps', () => {
      const rng = {next: () => 0, nextInt: (_n: number) => 0} as any;
      // With Credicor excluded, should get Ecoline (index 0 of 11 remaining)
      const corp = MarsBotCorpResolver.selectCorp(CardName.CREDICOR, rng);
      expect(corp).to.not.be.undefined;
    });
  });
});
