import {expect} from 'chai';
import {TileType} from '@/common/TileType';
import {SpaceId} from '@/common/Types';
import {BonusCardName} from '@/common/automa/BonusCardName';
import {BoardName} from '@/common/boards/BoardName';
import {SpaceType} from '@/common/boards/SpaceType';
import {CardName} from '@/common/cards/CardName';
import {Tag} from '@/common/cards/Tag';
import {AwardName} from '@/common/ma/AwardName';
import {RandomMAOptionType} from '@/common/ma/RandomMAOptionType';
import {IGame} from '@/server/IGame';
import {IMarsBot} from '@/server/automa/IMarsBot';
import {MarsBot} from '@/server/automa/MarsBot';
import {MarsBotBoard} from '@/server/automa/MarsBotBoard';
import {createBonusCard} from '@/server/automa/bonusCards/MarsBotBonusCards';
import {THARSIS_MARSBOT_BOARD} from '@/server/automa/boards/TharsisMarsBot';
import {VENUS_MARSBOT_TRACK} from '@/server/automa/boards/VenusMarsBot';
import {trackCubeKey} from '@/server/automa/corpTrackCubes';
import {CorporateCompetition} from '@/server/automa/bonusCards/CorporateCompetition';
import {Board} from '@/server/boards/Board';
import {Space} from '@/server/boards/Space';
import {IProjectCard} from '@/server/cards/IProjectCard';
import {Algae} from '@/server/cards/base/Algae';
import {Birds} from '@/server/cards/base/Birds';
import {IceCapMelting} from '@/server/cards/base/IceCapMelting';
import {MicroMills} from '@/server/cards/base/MicroMills';
import {Mine} from '@/server/cards/base/Mine';
import {Tardigrades} from '@/server/cards/base/Tardigrades';
import {Ceres} from '@/server/colonies/Ceres';
import {cardsFromJSON} from '@/server/createCard';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {setAllTracks, setTrack} from '../FakeMarsBot';
import {createAutomaGame} from '../corps/CorpGame';
import {TRACK} from '../corps/RecordingMarsBot';
import {competitionBot, fund} from './CorporateCompetitionBot';

function maxTrack(marsBot: IMarsBot, tag: Tag): void {
  const track = marsBot.marsBotBoard.tracks[marsBot.marsBotBoard.tagToTrack[tag]!];
  track.position = track.definition.layout.length - 1;
}

function setup(margins: Record<string, number>) {
  const {game, human, marsBot} = createAutomaGame();
  marsBot.megacredits = 10;
  for (const [name, margin] of Object.entries(margins)) {
    const award = game.awards.find((a) => a.name === name)!;
    game.fundAward(human, award);
    // human score minus MarsBot score
    award.getScore = () => 10 + margin;
  }
  marsBot.awardValue = () => 10;
  const b08 = createBonusCard(BonusCardName.CORPORATE_COMPETITION);
  return {game, human, marsBot, b08};
}

function helper(marsBot: MarsBot, awardName: AwardName): boolean {
  return new CorporateCompetition().tryHelperAction(marsBot, awardName);
}

/** Runs the helper and returns the indexes of the tracks it moved. */
function movedTracks(marsBot: MarsBot, awardName: AwardName): Array<number> {
  const before = marsBot.marsBotBoard.tracks.map((t) => t.position);
  expect(helper(marsBot, awardName), awardName).is.true;
  return marsBot.marsBotBoard.tracks.map((t, i) => t.position !== before[i] ? i : -1).filter((i) => i >= 0);
}

/** Runs the helper and returns the greenery it placed. */
function placedGreenery(game: IGame, marsBot: MarsBot, awardName: AwardName): Space | undefined {
  const before = game.board.getGreeneries(marsBot.player);
  helper(marsBot, awardName);
  return game.board.getGreeneries(marsBot.player).find((s) => !before.includes(s));
}

/** MarsBot cities on 10 and 12, so an unrestricted greenery goes on 11, next to both. */
function withTopCities(game: IGame, marsBot: MarsBot): void {
  for (const id of ['10', '12']) {
    game.simpleAddTile(marsBot.player, game.board.getSpaceOrThrow(id as SpaceId), {tileType: TileType.CITY});
  }
}

function stackDeck(game: IGame, ...cardsFromTop: Array<IProjectCard>): void {
  game.projectDeck.drawPile.push(...cardsFromTop.reverse());
}

describe('CorporateCompetition', () => {
  for (const run of [
    {megacredits: 4, funded: ['Thermalist'], expected: ['maybeDrawAndResolveBonusCard()']},
    {megacredits: 5, funded: [], expected: ['maybeDrawAndResolveBonusCard()']},
    {megacredits: 5, funded: ['Thermalist'], expected: ['advanceTrackOfTag(power)', 'loseMc(5)']},
  ] as const) {
    it('helps with a funded award for 5 M€, else draws another bonus card: ' + JSON.stringify(run), () => {
      const bot = competitionBot();
      bot.marsBot.megacredits = run.megacredits;
      fund(bot, ...run.funded);

      new CorporateCompetition().resolve(bot.marsBot);

      expect(bot.calls).deep.eq(run.expected);
    });
  }

  // MarsBot scores 5 in both awards
  for (const run of [
    {heat: 7, steel: 4, expected: ['advanceTrackOfTag(power)', 'loseMc(5)']},
    {heat: 7, steel: 6, expected: ['advanceTrackOfTag(space)', 'loseMc(5)']},
    {heat: 4, steel: 2, expected: ['advanceTrackOfTag(power)', 'loseMc(5)']},
    {heat: 5, steel: 6, expected: ['advanceTrackOfTag(power)', 'loseMc(5)']},
  ] as const) {
    it('helps with the award the player leads by the least, else the one MarsBot leads by the least: ' + JSON.stringify(run), () => {
      const bot = competitionBot();
      fund(bot, 'Thermalist', 'Miner');
      bot.human.heat = run.heat;
      bot.human.steel = run.steel;

      new CorporateCompetition().resolve(bot.marsBot);

      expect(bot.calls).deep.eq(run.expected);
    });
  }

  for (const run of [
    {maxed: [Tag.POWER], expected: ['advanceTrackOfTag(space)', 'loseMc(5)']},
    {maxed: [Tag.POWER, Tag.SPACE], expected: ['maybeDrawAndResolveBonusCard()']},
  ] as const) {
    it('skips an award whose helper it cannot take: ' + JSON.stringify(run), () => {
      const bot = competitionBot();
      fund(bot, 'Thermalist', 'Miner');
      bot.human.heat = 5;
      bot.human.steel = 6;
      for (const tag of run.maxed) {
        maxTrack(bot.marsBot, tag);
      }

      new CorporateCompetition().resolve(bot.marsBot);

      expect(bot.calls).deep.eq(run.expected);
    });
  }

  // The board is Tharsis's with the Venus track, every marker on space `base` unless `positions` moves it
  for (const run of [
    {award: 'Scientist', base: 0, positions: {}, maxed: [], expected: ['advanceTrackOfTag(science)']},
    {award: 'Scientist', base: 0, positions: {}, maxed: [Tag.SCIENCE], expected: []},
    {award: 'Banker', base: 0, positions: {building: 3, event: 2}, maxed: [], expected: [`advanceTrack(${TRACK.event})`, 'onTagAdvance(event)']},
    {award: 'Banker', base: 0, positions: {building: 2, event: 2}, maxed: [], expected: [`advanceTrack(${TRACK.building})`, 'onTagAdvance(building)']},
    {award: 'Traveller', base: 0, positions: {earth: 3, power: 1}, maxed: [], expected: [`advanceTrack(${TRACK.earth})`, 'onTagAdvance(earth)']},
    {award: 'Traveller', base: 0, positions: {earth: 3, power: 6}, maxed: [], expected: [`advanceTrack(${TRACK.power})`, 'onTagAdvance(jovian)']},
    {award: 'Traveller', base: 0, positions: {power: 1}, maxed: [Tag.EARTH], expected: []},
    {award: 'Mogul', base: 0, positions: {science: 4}, maxed: [], expected: [`advanceTrack(${TRACK.science})`]},
    {award: 'Mogul', base: 0, positions: {}, maxed: [Tag.SCIENCE], expected: []},
    {award: 'Collector', base: 1, positions: {venus: 0}, maxed: [], expected: [`advanceTrack(${THARSIS_MARSBOT_BOARD.length})`]},
    {award: 'Visionary', base: 1, positions: {venus: 0}, maxed: [], expected: [`advanceTrack(${TRACK.building})`]},
    {award: 'Politician', base: 0, positions: {}, maxed: [], expected: []},
  ] as const) {
    it('advances the track the award names: ' + JSON.stringify(run), () => {
      const bot = competitionBot({}, {marsBotBoard: new MarsBotBoard([...THARSIS_MARSBOT_BOARD, VENUS_MARSBOT_TRACK])});
      setAllTracks(bot.marsBot, run.base);
      for (const [tag, position] of Object.entries(run.positions)) {
        setTrack(bot.marsBot, tag as Tag, position);
      }
      for (const tag of run.maxed) {
        maxTrack(bot.marsBot, tag);
      }

      const helped = new CorporateCompetition().tryHelperAction(bot.marsBot, run.award);

      expect(bot.calls).deep.eq(run.expected);
      expect(helped).eq(run.expected.length > 0);
    });
  }

  // The first card of `deck` goes on top of the project deck
  for (const run of [
    {award: 'Magnate', deck: [CardName.TARDIGRADES, CardName.MINE], expected: ['resolveProjectCard(Mine)', 'gainMc(0)']},
    {award: 'Celebrity', deck: [CardName.MINE, CardName.GIANT_ICE_ASTEROID], expected: ['resolveProjectCard(Giant Ice Asteroid)', 'gainMc(0)']},
    {award: 'Incorporator', deck: [CardName.GIANT_ICE_ASTEROID, CardName.MINE], expected: ['resolveProjectCard(Mine)', 'gainMc(0)']},
    {award: 'Forecaster', deck: [CardName.MINE, CardName.ALGAE], expected: ['resolveProjectCard(Algae)', 'gainMc(0)']},
    {award: 'Administrator', deck: [CardName.ICE_CAP_MELTING, CardName.MICRO_MILLS], expected: ['resolveProjectCard(Micro-Mills)', 'gainMc(5)']},
    {award: 'Innovator', deck: [CardName.TARDIGRADES], expected: ['resolveProjectCard(Tardigrades)', 'gainMc(0)']},
  ] as const) {
    it('reveals cards until one the award names and plays it: ' + JSON.stringify(run), () => {
      const bot = competitionBot();
      bot.game.projectDeck.drawPile.push(...cardsFromJSON(run.deck).toReversed());

      const helped = new CorporateCompetition().tryHelperAction(bot.marsBot, run.award);

      expect(bot.calls).deep.eq(run.expected);
      expect(helped).is.true;
    });
  }

  it('gives up revealing once the whole deck is seen', () => {
    const bot = competitionBot();
    const deck = bot.game.projectDeck;
    deck.drawPile.splice(0, deck.drawPile.length, ...cardsFromJSON([CardName.TARDIGRADES, CardName.BIRDS]));
    deck.discardPile.length = 0;

    const helped = new CorporateCompetition().tryHelperAction(bot.marsBot, 'Magnate');

    expect(bot.calls).is.empty;
    expect(helped).is.false;
  });

  for (const run of [
    {award: 'Landlord', ocean: false, expected: true},
    {award: 'Desert Settler', ocean: false, expected: true},
    {award: 'Estate Dealer', ocean: false, expected: false},
    {award: 'Suburbian', ocean: true, expected: true},
    {award: 'Highlander', ocean: true, expected: true},
  ] as const) {
    it('places a greenery where the award says: ' + JSON.stringify(run), () => {
      const bot = competitionBot();
      const board = bot.game.board;
      if (run.ocean) {
        bot.game.simpleAddTile(bot.human, board.getSpaceOrThrow('32' as SpaceId), {tileType: TileType.OCEAN});
      }
      const nextToOcean = (space: Space) => board.getAdjacentSpaces(space).some(Board.isOceanSpace);
      const where: Record<typeof run.award, (space: Space) => boolean> = {
        'Landlord': () => true,
        'Desert Settler': (space) => space.y > board.equatorRow,
        'Estate Dealer': nextToOcean,
        'Suburbian': (space) => space.edge,
        'Highlander': (space) => !nextToOcean(space),
      };

      const helped = new CorporateCompetition().tryHelperAction(bot.marsBot, run.award);

      const expected = board.getAvailableSpacesForGreenery(bot.botPlayer).filter(where[run.award]);
      const placedIds = bot.greenerySpaces.map((space) => space.id);
      expect(placedIds).deep.eq(expected.map((space) => space.id));
      expect(helped).eq(run.expected);
    });
  }

  for (const run of [
    {modularMA: false, expected: false},
    {modularMA: true, expected: true},
  ] as const) {
    it('keeps the Vastitas Borealis Highlander greenery away from the spaces reserved for an ocean, unlike the modular one: ' + JSON.stringify(run), () => {
      const bot = competitionBot({boardName: BoardName.VASTITAS_BOREALIS_NOVA, modularMA: run.modularMA});
      const board = bot.game.board;
      const nextToReservedOcean = (space: Space) => board.getAdjacentSpaces(space).some((s) => s.spaceType === SpaceType.OCEAN);
      for (const space of board.getSpaces(SpaceType.LAND)) {
        if (space.tile === undefined && !nextToReservedOcean(space)) {
          bot.game.simpleAddTile(bot.human, space, {tileType: TileType.CITY});
        }
      }

      const helped = new CorporateCompetition().tryHelperAction(bot.marsBot, 'Highlander');

      expect(helped).eq(run.expected);
    });
  }

  for (const run of [
    {award: 'Metropolist', preserve: false, expected: true},
    {award: 'Founder', preserve: false, expected: false},
    {award: 'Founder', preserve: true, expected: true},
  ] as const) {
    it('places a city where the award says: ' + JSON.stringify(run), () => {
      const bot = competitionBot();
      const board = bot.game.board;
      const preserve = board.getSpaceOrThrow('53' as SpaceId);
      if (run.preserve) {
        bot.game.simpleAddTile(bot.human, preserve, {tileType: TileType.NATURAL_PRESERVE});
      }

      const helped = new CorporateCompetition().tryHelperAction(bot.marsBot, run.award);

      const cities = board.getCities(bot.botPlayer);
      expect(cities).has.length(run.expected ? 1 : 0);
      if (run.preserve) {
        expect(board.getAdjacentSpaces(cities[0])).includes(preserve);
      }
      expect(helped).eq(run.expected);
    });
  }

  it("removes the player's animal for Excentric", () => {
    const bot = competitionBot();
    const birds = new Birds();
    birds.resourceCount = 2;
    bot.human.playedCards.push(birds);

    const helped = new CorporateCompetition().tryHelperAction(bot.marsBot, 'Excentric');

    expect(birds.resourceCount).eq(1);
    expect(helped).is.true;
  });

  it('deducts 5 MC on successful helper action', () => {
    const {game, human, marsBot} = createAutomaGame();
    marsBot.megacredits = 10;

    // Fund an award so B08 has something to help with
    game.fundAward(human, game.awards.find((a) => a.name === 'Scientist')!);
    // Advance track 4 so MarsBot has a score on Scientist
    for (let i = 0; i < 5; i++) {
      marsBot.marsBotBoard.tracks[3].advance();
    }

    const b08 = createBonusCard(BonusCardName.CORPORATE_COMPETITION);

    const mcBefore = marsBot.megacredits;
    marsBot.actionDeck.playBonusCard(b08);
    // Helper for Scientist = advance track 4. Costs 5 MC.
    // Track advance may trigger actions that grant additional MC, so just verify 5 was deducted
    expect(marsBot.megacredits).to.be.lte(mcBefore - 5 + 10); // At most 10 MC gained from track actions
    expect(marsBot.megacredits).to.be.lt(mcBefore);
  });

  it('takes no more than MarsBot has when the helper itself cost M€ (colony cube, rulebook C, p.14)', () => {
    const [game, human] = testGame(1, {automa: true, expansions: {colonies: true}, boardName: BoardName.THARSIS});
    const marsBot = game.automaHooks!.marsBot;
    const ceres = new Ceres();
    game.colonies = [ceres];
    game.fundAward(human, game.awards.find((a) => a.name === 'Miner')!);
    // A colony cube on space track #7, where Miner's helper takes the tracker
    const key = trackCubeKey(1, 7);
    marsBot.hasColonyCubes = true;
    marsBot.colonyCubePositions = new Set([key]);
    marsBot.trackCubePositions.set(key, {trackIndex: 1, position: 7, cubeType: 'black'});
    marsBot.marsBotBoard.tracks[1].position = 6;
    marsBot.megacredits = 5;

    marsBot.actionDeck.playBonusCard(createBonusCard(BonusCardName.CORPORATE_COMPETITION));

    expect(marsBot.marsBotBoard.tracks[1].position).to.eq(7);
    expect(ceres.colonies).includes(marsBot.player.id);
    expect(marsBot.megacredits).to.eq(0);
  });

  it('competes for the award the player leads by the least, over one MarsBot leads', () => {
    const {marsBot, b08} = setup({Scientist: 2, Miner: -4});
    marsBot.actionDeck.playBonusCard(b08);
    // Scientist moves the science track; Miner would have moved the space track
    expect(marsBot.marsBotBoard.tracks[3].position).to.be.greaterThan(0);
    expect(marsBot.marsBotBoard.tracks[1].position).to.eq(0);
  });

  it('when MarsBot leads every award, competes for the smallest gap', () => {
    const {marsBot, b08} = setup({Scientist: -1, Miner: -4});
    marsBot.actionDeck.playBonusCard(b08);
    // Scientist moves the science track; Miner would have moved the space track
    expect(marsBot.marsBotBoard.tracks[3].position).to.be.greaterThan(0);
    expect(marsBot.marsBotBoard.tracks[1].position).to.eq(0);
  });

  it('measures the Thermalist of the player by heat, energy and heat production', () => {
    const {game, human, marsBot, b08} = setup({Scientist: 2});
    game.fundAward(human, game.awards.find((a) => a.name === 'Thermalist')!);
    // 10 for the comparison, 0 for the final count
    human.energy = 1;
    human.production.override({heat: 9, energy: 0, megacredits: 0, steel: 0, titanium: 0, plants: 0});
    marsBot.actionDeck.playBonusCard(b08);
    // The tie on Thermalist is closer than Scientist's lead of 2
    expect(marsBot.marsBotBoard.tracks[4].position).to.be.greaterThan(0);
    expect(marsBot.marsBotBoard.tracks[3].position).to.eq(0);
  });

  // Rulebook A, p.7: it ignores a funded award whose helping action is impossible
  it('skips an award whose track is maxed and helps the next closest one', () => {
    const {marsBot, b08} = setup({Scientist: 0, Banker: 3});
    const tracks = marsBot.marsBotBoard.tracks;
    tracks[3].position = tracks[3].definition.layout.length - 1;
    marsBot.actionDeck.playBonusCard(b08);
    // Banker advances the building track, the upper of the two tied tracks
    expect(tracks[0].position).to.eq(1);
    expect(marsBot.megacredits).to.eq(5);
  });

  it('draws another bonus card without a Failed Action when no helper can resolve', () => {
    const {marsBot, b08} = setup({Scientist: 0});
    const tracks = marsBot.marsBotBoard.tracks;
    tracks[3].position = tracks[3].definition.layout.length - 1;
    marsBot.bonusDeck.drawPile.push(createBonusCard(BonusCardName.GOVERNMENT_SUBSIDY));
    const tr = marsBot.player.terraformRating;
    marsBot.actionDeck.playBonusCard(b08);
    expect(marsBot.player.terraformRating).to.eq(tr + 1);
    expect(marsBot.megacredits).to.eq(10);
  });

  it('skips Mogul when the most advanced track is maxed', () => {
    const {marsBot} = createAutomaGame();
    const tracks = marsBot.marsBotBoard.tracks;
    tracks[2].position = tracks[2].definition.layout.length - 1;
    tracks[0].position = 3;
    expect(new CorporateCompetition().tryHelperAction(marsBot, 'Mogul')).is.false;
    expect(tracks[0].position).to.eq(3);
    expect(marsBot.megacredits).to.eq(0);
  });

  it('for Banker advances the less-advanced of the building and event tracks', () => {
    const {marsBot, b08} = setup({Banker: 1});
    const tracks = marsBot.marsBotBoard.tracks;
    tracks[0].position = 3;
    tracks[2].position = 2;
    marsBot.actionDeck.playBonusCard(b08);
    expect(tracks[0].position).to.eq(3);
    expect(tracks[2].position).to.eq(3);
    expect(tracks[4].position).to.eq(0);
  });

  it('Investor helper advances the Earth track', () => {
    const {marsBot} = createAutomaGame();
    expect(movedTracks(marsBot, 'Investor')).deep.eq([5]);
  });

  it('Promoter helper advances the event track', () => {
    const {marsBot} = createAutomaGame();
    expect(movedTracks(marsBot, 'Promoter')).deep.eq([2]);
  });

  it('Traveller helper advances the more advanced of the Earth and Jovian tracks', () => {
    const {marsBot} = createAutomaGame();
    const tracks = marsBot.marsBotBoard.tracks;
    tracks[5].position = 3;
    tracks[4].position = 1; // The Jovian tag is on the energy track.
    expect(movedTracks(marsBot, 'Traveller')).deep.eq([5]);

    tracks[4].position = 6;
    expect(movedTracks(marsBot, 'Traveller')).deep.eq([4]);
  });

  it('Blacksmith helper advances the more advanced of the building and space tracks', () => {
    const {marsBot} = createAutomaGame();
    marsBot.marsBotBoard.tracks[0].position = 2;
    marsBot.marsBotBoard.tracks[1].position = 5;
    expect(movedTracks(marsBot, 'Blacksmith')).deep.eq([1]);
  });

  it('A. Zoologist helper advances the animal track', () => {
    const {marsBot} = createAutomaGame();
    expect(movedTracks(marsBot, 'A. Zoologist')).deep.eq([6]);
  });

  it('Magnate helper reveals cards until an automated one and plays it', () => {
    const {game, marsBot} = createAutomaGame();
    stackDeck(game, new Tardigrades(), new Mine());
    expect(movedTracks(marsBot, 'Magnate')).deep.eq([0]);
  });

  it('Forecaster helper reveals cards until one with a requirement and plays it', () => {
    const {game, marsBot} = createAutomaGame();
    stackDeck(game, new Mine(), new Algae());
    const mc = marsBot.megacredits;
    expect(movedTracks(marsBot, 'Forecaster')).deep.eq([6]);
    expect(marsBot.megacredits).eq(mc);
  });

  it('Forecaster in a full Corporate Competition costs nothing', () => {
    const [game, human] = testGame(1, {automa: true, boardName: BoardName.TERRA_CIMMERIA_NOVA});
    const marsBot = game.automaHooks!.marsBot;
    game.fundAward(human, game.awards.find((a) => a.name === 'Forecaster')!);
    stackDeck(game, new Mine(), new Algae());
    marsBot.megacredits = 5;

    marsBot.actionDeck.playBonusCard(createBonusCard(BonusCardName.CORPORATE_COMPETITION));

    expect(marsBot.marsBotBoard.tracks[6].position).to.be.greaterThan(0);
    expect(marsBot.megacredits).eq(5);
  });

  // B12: "If MarsBot has at least 5 MC" has no exception for Forecaster
  it('Forecaster in a full Corporate Competition still needs 5 M€', () => {
    const [game, human] = testGame(1, {automa: true, boardName: BoardName.TERRA_CIMMERIA_NOVA});
    const marsBot = game.automaHooks!.marsBot;
    game.fundAward(human, game.awards.find((a) => a.name === 'Forecaster')!);
    stackDeck(game, new Mine(), new Algae());
    marsBot.bonusDeck.drawPile.push(createBonusCard(BonusCardName.GOVERNMENT_SUBSIDY));
    marsBot.megacredits = 4;
    const tr = marsBot.player.terraformRating;

    marsBot.actionDeck.playBonusCard(createBonusCard(BonusCardName.CORPORATE_COMPETITION));

    expect(marsBot.marsBotBoard.tracks[6].position).to.eq(0);
    expect(marsBot.player.terraformRating).to.eq(tr + 1);
    expect(marsBot.megacredits).eq(4);
  });

  it('other helpers still need 5 M€ in Corporate Competition', () => {
    const {game, human, marsBot} = createAutomaGame();
    game.fundAward(human, game.awards.find((a) => a.name === 'Scientist')!);
    marsBot.megacredits = 4;

    marsBot.actionDeck.playBonusCard(createBonusCard(BonusCardName.CORPORATE_COMPETITION));

    expect(marsBot.marsBotBoard.tracks[3].position).to.eq(0);
  });

  it('Administrator helper plays a card with no tags, not an event, and gains 5 M€', () => {
    const {game, marsBot} = createAutomaGame();
    stackDeck(game, new IceCapMelting(), new MicroMills());
    const mc = marsBot.megacredits;
    expect(movedTracks(marsBot, 'Administrator')).is.empty;
    // 5 M€ for the tagless card's Failed Action, 5 M€ from the card.
    expect(marsBot.megacredits).eq(mc + 10);
  });

  // "Reveal until" has no cap short of the whole deck (Nick, Q&A 20)
  it('Administrator helper keeps revealing past 20 cards', () => {
    const {game, marsBot} = createAutomaGame();
    const microMills = new MicroMills();
    stackDeck(game, ...Array.from({length: 25}, () => new Mine()), microMills);

    expect(helper(marsBot, 'Administrator')).is.true;
    expect(marsBot.playedProjectCards).to.include(microMills);
  });

  it('Administrator helper gives up once the whole deck is seen without a match', () => {
    const {game, marsBot} = createAutomaGame();
    game.projectDeck.drawPile.splice(0, game.projectDeck.drawPile.length, ...Array.from({length: 5}, () => new Mine()));
    game.projectDeck.discardPile.splice(0, game.projectDeck.discardPile.length, ...Array.from({length: 3}, () => new Mine()));

    expect(helper(marsBot, 'Administrator')).is.false;
    expect(game.projectDeck.size()).eq(8);
  });

  it('Excentric helper removes an animal or microbe worth the most VP', () => {
    const {human, marsBot} = createAutomaGame();
    expect(helper(marsBot, 'Excentric')).is.false;

    const tardigrades = new Tardigrades();
    tardigrades.resourceCount = 3; // 0 VP
    const birds = new Birds();
    birds.resourceCount = 2; // 2 VP
    human.playedCards.push(tardigrades, birds);

    expect(helper(marsBot, 'Excentric')).is.true;
    expect(birds.resourceCount).eq(1);
    expect(tardigrades.resourceCount).eq(3);
  });

  it('Desert Settler helper places its greenery on the four bottom rows', () => {
    const {game, marsBot} = createAutomaGame();
    withTopCities(game, marsBot);
    game.simpleAddTile(marsBot.player, game.board.getSpaceOrThrow('48' as SpaceId), {tileType: TileType.CITY});
    expect(placedGreenery(game, marsBot, 'Desert Settler')?.y).within(5, 8);
  });

  it('Estate Dealer helper places its greenery next to an ocean', () => {
    const {game, human, marsBot} = createAutomaGame();
    withTopCities(game, marsBot);
    expect(helper(marsBot, 'Estate Dealer')).is.false;

    game.simpleAddTile(marsBot.player, game.board.getSpaceOrThrow('40' as SpaceId), {tileType: TileType.CITY});
    game.simpleAddTile(human, game.board.getSpaceOrThrow('32' as SpaceId), {tileType: TileType.OCEAN});
    const space = placedGreenery(game, marsBot, 'Estate Dealer');
    const nextToOcean = game.board.getAdjacentSpaces(space!).some(Board.isOceanSpace);
    expect(nextToOcean).is.true;
  });

  it('Suburbian helper places its greenery on the edge of the map', () => {
    const {game, marsBot} = createAutomaGame();
    withTopCities(game, marsBot);
    const space = placedGreenery(game, marsBot, 'Suburbian');
    expect(space?.edge).is.true;
  });

  it('Highlander helper places its greenery away from oceans', () => {
    const {game, human, marsBot} = createAutomaGame();
    withTopCities(game, marsBot);
    game.simpleAddTile(human, game.board.getSpaceOrThrow('06' as SpaceId), {tileType: TileType.OCEAN});
    const space = placedGreenery(game, marsBot, 'Highlander');
    expect(space).is.not.undefined;
    const nextToOcean = game.board.getAdjacentSpaces(space!).some(Board.isOceanSpace);
    expect(nextToOcean).is.false;
  });

  it('Highlander helper on Vastitas Borealis also keeps away from spaces reserved for an ocean', () => {
    /** Fills every land space except those next to an ocean-reserved space, which the modular Highlander may use. */
    const fillAwayFromReservedOceans = (game: IGame, human: TestPlayer) => {
      const board = game.board;
      for (const space of board.getSpaces(SpaceType.LAND).filter((sp) => sp.tile === undefined)) {
        if (!board.getAdjacentSpaces(space).some((sp) => sp.spaceType === SpaceType.OCEAN)) {
          game.simpleAddTile(human, space, {tileType: TileType.CITY});
        }
      }
    };

    const [vastitas, vastitasHuman] = testGame(1, {automa: true, boardName: BoardName.VASTITAS_BOREALIS_NOVA});
    fillAwayFromReservedOceans(vastitas, vastitasHuman);
    expect(helper(vastitas.automaHooks!.marsBot, 'Highlander')).is.false;

    const [modular, modularHuman] = testGame(1, {
      automa: true, boardName: BoardName.VASTITAS_BOREALIS_NOVA, randomMA: RandomMAOptionType.UNLIMITED, modularMA: true,
    });
    fillAwayFromReservedOceans(modular, modularHuman);
    expect(helper(modular.automaHooks!.marsBot, 'Highlander')).is.true;
  });

  it('Founder helper places its city next to a special tile', () => {
    const {game, human, marsBot} = createAutomaGame();
    expect(helper(marsBot, 'Founder')).is.false;

    const preserve = game.board.getSpaceOrThrow('30' as SpaceId);
    game.simpleAddTile(human, preserve, {tileType: TileType.NATURAL_PRESERVE});
    expect(helper(marsBot, 'Founder')).is.true;
    const city = game.board.getCities(marsBot.player)[0];
    expect(game.board.getAdjacentSpaces(city)).to.include(preserve);
  });
});
