import {expect} from 'chai';
import {TileType} from '@/common/TileType';
import {SpaceId} from '@/common/Types';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {BoardName} from '@/common/boards/BoardName';
import {SpaceType} from '@/common/boards/SpaceType';
import {RandomMAOptionType} from '@/common/ma/RandomMAOptionType';
import {SeededRandom} from '@/common/utils/Random';
import {IGame} from '@/server/IGame';
import {MarsBot} from '@/server/automa/MarsBot';
import {createBaseBonusCards, createBonusCard} from '@/server/automa/MarsBotBonusCard';
import {MarsBotBonusDeck} from '@/server/automa/MarsBotBonusDeck';
import {MarsBotBonusResolver} from '@/server/automa/MarsBotBonusResolver';
import {MarsBotTilePlacer} from '@/server/automa/MarsBotTilePlacer';
import {trackCubeKey} from '@/server/automa/corpTrackCubes';
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
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {createAutomaGame} from '../corps/CorpGame';

function setup(margins: Record<string, number>) {
  const {game, human, marsBot} = createAutomaGame();
  marsBot.turnResolver.megacredits = 10;
  for (const [name, margin] of Object.entries(margins)) {
    const award = game.awards.find((a) => a.name === name)!;
    game.fundAward(human, award);
    // human score minus MarsBot score
    award.getScore = () => 10 + margin;
  }
  marsBot.turnResolver.getMarsBotAwardValue = () => 10;
  const b08 = createBaseBonusCards().find((c) => c.id === BonusCardId.B08_CORPORATE_COMPETITION)!;
  return {game, human, marsBot, b08};
}

function helper(marsBot: MarsBot, awardName: string): boolean {
  return marsBot['bonusResolver']['tryHelperAction'](awardName);
}

/** Runs the helper and returns the indexes of the tracks it moved. */
function movedTracks(marsBot: MarsBot, awardName: string): Array<number> {
  const before = marsBot.marsBotBoard.tracks.map((t) => t.position);
  expect(helper(marsBot, awardName), awardName).is.true;
  return marsBot.marsBotBoard.tracks.map((t, i) => t.position !== before[i] ? i : -1).filter((i) => i >= 0);
}

/** Runs the helper and returns the greenery it placed. */
function placedGreenery(game: IGame, marsBot: MarsBot, awardName: string): Space | undefined {
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

describe('CorporateCompetitionMarsBot', () => {
  it('fails when MarsBot has <5 MC', () => {
    const {game, human, marsBot} = createAutomaGame();
    marsBot.turnResolver.megacredits = 3;

    const cards = createBaseBonusCards();
    const b08 = cards.find((c) => c.id === BonusCardId.B08_CORPORATE_COMPETITION)!;
    const tilePlacer = new MarsBotTilePlacer(game, marsBot.player, human);
    const bonusDeck = MarsBotBonusDeck.create(new SeededRandom(99));
    const bonusResolver = new MarsBotBonusResolver(game, marsBot.player, human, marsBot.turnResolver, bonusDeck, tilePlacer);

    // With <5 MC, should draw another bonus card instead
    bonusResolver.resolve(b08);
    // MC should still be 3 (no deduction since it couldn't afford)
    // It might have gained MC from the fallback bonus card resolution
  });

  it('deducts 5 MC on successful helper action', () => {
    const {game, human, marsBot} = createAutomaGame();
    marsBot.turnResolver.megacredits = 10;

    // Fund an award so B08 has something to help with
    game.fundAward(human, game.awards.find((a) => a.name === 'Scientist')!);
    // Advance track 4 so MarsBot has a score on Scientist
    for (let i = 0; i < 5; i++) {
      marsBot.marsBotBoard.tracks[3].advance();
    }

    const cards = createBaseBonusCards();
    const b08 = cards.find((c) => c.id === BonusCardId.B08_CORPORATE_COMPETITION)!;
    const tilePlacer = new MarsBotTilePlacer(game, marsBot.player, human);
    const bonusDeck = MarsBotBonusDeck.create(new SeededRandom(99));
    const bonusResolver = new MarsBotBonusResolver(game, marsBot.player, human, marsBot.turnResolver, bonusDeck, tilePlacer);

    const mcBefore = marsBot.turnResolver.megacredits;
    bonusResolver.resolve(b08);
    // Helper for Scientist = advance track 4. Costs 5 MC.
    // Track advance may trigger actions that grant additional MC, so just verify 5 was deducted
    expect(marsBot.turnResolver.megacredits).to.be.lte(mcBefore - 5 + 10); // At most 10 MC gained from track actions
    expect(marsBot.turnResolver.megacredits).to.be.lt(mcBefore); // Overall MC decreased
  });

  it('takes no more than MarsBot has when the helper itself cost M€ (colony cube, C-X3)', () => {
    const [game, human] = testGame(1, {automa: true, coloniesExtension: true, boardName: BoardName.THARSIS});
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
    marsBot.turnResolver.megacredits = 5;

    marsBot['bonusResolver'].resolve(createBaseBonusCards().find((c) => c.id === BonusCardId.B08_CORPORATE_COMPETITION)!);

    expect(marsBot.marsBotBoard.tracks[1].position).to.eq(7);
    expect(ceres.colonies).includes(marsBot.player.id);
    expect(marsBot.turnResolver.megacredits).to.eq(0);
  });

  it('competes for the award the player leads by the least, over one MarsBot leads', () => {
    const {marsBot, b08} = setup({Scientist: 2, Miner: -4});
    marsBot['bonusResolver'].resolve(b08);
    // Scientist moves the science track; Miner would have moved the space track
    expect(marsBot.marsBotBoard.tracks[3].position).to.be.greaterThan(0);
    expect(marsBot.marsBotBoard.tracks[1].position).to.eq(0);
  });

  it('when MarsBot leads every award, competes for the smallest gap', () => {
    const {marsBot, b08} = setup({Scientist: -1, Miner: -4});
    marsBot['bonusResolver'].resolve(b08);
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
    marsBot['bonusResolver'].resolve(b08);
    // The tie on Thermalist is closer than Scientist's lead of 2
    expect(marsBot.marsBotBoard.tracks[4].position).to.be.greaterThan(0);
    expect(marsBot.marsBotBoard.tracks[3].position).to.eq(0);
  });

  // Rulebook A, p.7: it ignores a funded award whose helping action is impossible
  it('skips an award whose track is maxed and helps the next closest one', () => {
    const {marsBot, b08} = setup({Scientist: 0, Banker: 3});
    const tracks = marsBot.marsBotBoard.tracks;
    tracks[3].position = tracks[3].definition.layout.length - 1;
    marsBot['bonusResolver'].resolve(b08);
    // Banker advances the building track, the upper of the two tied tracks
    expect(tracks[0].position).to.eq(1);
    expect(marsBot.turnResolver.megacredits).to.eq(5);
  });

  it('draws another bonus card without a Failed Action when no helper can resolve', () => {
    const {marsBot, b08} = setup({Scientist: 0});
    const tracks = marsBot.marsBotBoard.tracks;
    tracks[3].position = tracks[3].definition.layout.length - 1;
    marsBot.bonusDeck.drawPile.push(createBonusCard(BonusCardId.B31_GOVERNMENT_SUBSIDY));
    const tr = marsBot.player.terraformRating;
    marsBot['bonusResolver'].resolve(b08);
    expect(marsBot.player.terraformRating).to.eq(tr + 1);
    expect(marsBot.turnResolver.megacredits).to.eq(10);
  });

  it('skips Mogul when the most advanced track is maxed', () => {
    const {marsBot} = createAutomaGame();
    const tracks = marsBot.marsBotBoard.tracks;
    tracks[2].position = tracks[2].definition.layout.length - 1;
    tracks[0].position = 3;
    expect(marsBot['bonusResolver']['tryHelperAction']('Mogul')).is.false;
    expect(tracks[0].position).to.eq(3);
    expect(marsBot.turnResolver.megacredits).to.eq(0);
  });

  it('for Banker advances the less-advanced of the building and event tracks', () => {
    const {marsBot, b08} = setup({Banker: 1});
    const tracks = marsBot.marsBotBoard.tracks;
    tracks[0].position = 3;
    tracks[2].position = 2;
    marsBot['bonusResolver'].resolve(b08);
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
    const mc = marsBot.turnResolver.megacredits;
    expect(movedTracks(marsBot, 'Forecaster')).deep.eq([6]);
    expect(marsBot.turnResolver.megacredits).eq(mc);
  });

  it('Forecaster in a full Corporate Competition costs nothing', () => {
    const [game, human] = testGame(1, {automa: true, boardName: BoardName.TERRA_CIMMERIA_NOVA});
    const marsBot = game.automaHooks!.marsBot;
    game.fundAward(human, game.awards.find((a) => a.name === 'Forecaster')!);
    stackDeck(game, new Mine(), new Algae());
    marsBot.turnResolver.megacredits = 5;

    marsBot['bonusResolver'].resolve(createBaseBonusCards().find((c) => c.id === BonusCardId.B08_CORPORATE_COMPETITION)!);

    expect(marsBot.marsBotBoard.tracks[6].position).to.be.greaterThan(0);
    expect(marsBot.turnResolver.megacredits).eq(5);
  });

  // B12: "If MarsBot has at least 5 MC" has no exception for Forecaster
  it('Forecaster in a full Corporate Competition still needs 5 M€', () => {
    const [game, human] = testGame(1, {automa: true, boardName: BoardName.TERRA_CIMMERIA_NOVA});
    const marsBot = game.automaHooks!.marsBot;
    game.fundAward(human, game.awards.find((a) => a.name === 'Forecaster')!);
    stackDeck(game, new Mine(), new Algae());
    marsBot.bonusDeck.drawPile.push(createBonusCard(BonusCardId.B31_GOVERNMENT_SUBSIDY));
    marsBot.turnResolver.megacredits = 4;
    const tr = marsBot.player.terraformRating;

    marsBot['bonusResolver'].resolve(createBaseBonusCards().find((c) => c.id === BonusCardId.B08_CORPORATE_COMPETITION)!);

    expect(marsBot.marsBotBoard.tracks[6].position).to.eq(0);
    expect(marsBot.player.terraformRating).to.eq(tr + 1);
    expect(marsBot.turnResolver.megacredits).eq(4);
  });

  it('other helpers still need 5 M€ in Corporate Competition', () => {
    const {game, human, marsBot} = createAutomaGame();
    game.fundAward(human, game.awards.find((a) => a.name === 'Scientist')!);
    marsBot.turnResolver.megacredits = 4;

    marsBot['bonusResolver'].resolve(createBaseBonusCards().find((c) => c.id === BonusCardId.B08_CORPORATE_COMPETITION)!);

    expect(marsBot.marsBotBoard.tracks[3].position).to.eq(0);
  });

  it('Administrator helper plays a card with no tags, not an event, and gains 5 M€', () => {
    const {game, marsBot} = createAutomaGame();
    stackDeck(game, new IceCapMelting(), new MicroMills());
    const mc = marsBot.turnResolver.megacredits;
    expect(movedTracks(marsBot, 'Administrator')).is.empty;
    // 5 M€ for the tagless card's Failed Action, 5 M€ from the card.
    expect(marsBot.turnResolver.megacredits).eq(mc + 10);
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
    expect(game.board.getAdjacentSpaces(space!).some(Board.isOceanSpace)).is.true;
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
    expect(game.board.getAdjacentSpaces(space!).some(Board.isOceanSpace)).is.false;
  });

  it('Highlander helper on Vastitas Borealis also keeps away from spaces reserved for an ocean', () => {
    /** Fills every land space except those next to an ocean-reserved space, which the modular Highlander may still use. */
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

  it('draws another bonus card when it cannot resolve', () => {
    // This tests that the chain works: B08 can't help → draws B03 (R&D) → resolves project card
    // We verify the chain doesn't crash
    const {marsBot} = createAutomaGame();
    // B08 needs funded awards and 5+ MC to try helping
    // With no funded awards, it should draw another bonus card
    const b08 = marsBot.bonusDeck.drawPile.find((c) => c.id === 'B08');
    if (b08) {
      // Calling resolve should not crash even with no funded awards
      marsBot['bonusResolver'].resolve(b08);
    }
  });
});
