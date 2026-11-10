import {expect} from 'chai';
import {TileType} from '@/common/TileType';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {SpaceType} from '@/common/boards/SpaceType';
import {CardName} from '@/common/cards/CardName';
import {MAX_OXYGEN_LEVEL, MAX_TEMPERATURE} from '@/common/constants';
import {MarsBot} from '@/server/automa/MarsBot';
import {createBonusCard} from '@/server/automa/MarsBotBonusCard';
import {getMarsBotCorp} from '@/server/automa/corps/MarsBotCorpRegistry';
import {LAKEFRONT_RESORTS_MARSBOT_CORP} from '@/server/automa/corps/turmoil/LakefrontResortsMarsBot';
import {IMarsBot} from '@/server/automa/IMarsBot';
import {Space} from '@/server/boards/Space';
import {testGame} from '../../../TestGame';
import {setOxygenLevel, setTemperature} from '../../../TestingUtils';
import {createAutomaGame, resetCorpRegistry} from '../CorpGame';
import {RecordingMarsBot, recordingMarsBot} from '../RecordingMarsBot';

// Track index on the Tharsis board
const BUILDING = 0;

/** A recording bot whose player is MarsBot's player in an automa game. */
function lakefrontBot(fields: Partial<IMarsBot> = {}): RecordingMarsBot {
  const [game] = testGame(1, {automa: true});
  return recordingMarsBot({game, player: game.marsBotPlayer, megacredits: 0, ...fields});
}

// Government Intervention places an ocean, whose Lakefront cube advances the building track
function interventionWithBuildingAt(position: number) {
  const {game, marsBot} = createAutomaGame();
  marsBot.setCorpAndSetup(getMarsBotCorp(CardName.LAKEFRONT_RESORTS)!);
  setTemperature(game, MAX_TEMPERATURE);
  setOxygenLevel(game, MAX_OXYGEN_LEVEL);
  game.generation = 2;
  marsBot.marsBotBoard.tracks[0].position = position;
  return {game, marsBot, mcBefore: marsBot.megacredits, trBefore: marsBot.player.terraformRating};
}

function resolveIntervention(marsBot: MarsBot) {
  marsBot['bonusResolver'].resolve(createBonusCard(BonusCardId.B16_GOVERNMENT_INTERVENTION));
}

// C35
describe('LakefrontResortsMarsBot', () => {
  beforeEach(resetCorpRegistry);

  const effect = LAKEFRONT_RESORTS_MARSBOT_CORP.effect!;

  it('setup puts a white cube on the card and pays 3 M€ per adjacent ocean', () => {
    const {marsBot, corpState} = lakefrontBot();

    LAKEFRONT_RESORTS_MARSBOT_CORP.setup!(marsBot);

    expect(corpState.get('whiteCubeOnCard')).eq(1);
    expect(marsBot.player.oceanBonus).eq(3);
  });

  it('oceans alternate between taking the cube off to advance the building track and putting it back', () => {
    const {marsBot, calls, corpState} = lakefrontBot();
    const space = marsBot.game.board.spaces[0];
    corpState.set('whiteCubeOnCard', 1);

    effect.onTilePlaced!(marsBot, false, TileType.OCEAN, space);
    expect(corpState.get('whiteCubeOnCard')).eq(0);
    expect(calls).deep.eq([`advanceTrack(${BUILDING})`]);

    effect.onTilePlaced!(marsBot, false, TileType.GREENERY, space);
    expect(corpState.get('whiteCubeOnCard')).eq(0);

    effect.onTilePlaced!(marsBot, true, TileType.OCEAN, space);
    expect(corpState.get('whiteCubeOnCard')).eq(1);
    expect(calls).deep.eq([`advanceTrack(${BUILDING})`]);
  });

  // FAQ (rulebook B p.4): Lakefront overrides Government Intervention's "no M€"
  it('keeps the M€ its building track advance earns during Government Intervention', () => {
    const {marsBot, corpState} = lakefrontBot({
      advanceTrack: () => {
        marsBot.megacredits += 4;
      },
    });
    corpState.set('whiteCubeOnCard', 1);
    marsBot.mcKeptThroughIntervention = 0;

    effect.onTilePlaced!(marsBot, false, TileType.OCEAN, marsBot.game.board.spaces[0]);

    expect(marsBot.mcKeptThroughIntervention).eq(4);
  });

  it('ocean placed with white cube → remove cube, advance building track', () => {
    const {marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.LAKEFRONT_RESORTS)!;
    marsBot.setCorpAndSetup(corp);
    expect(marsBot.corpSpecificState.get('whiteCubeOnCard')).to.eq(1);
    const buildingBefore = marsBot.marsBotBoard.tracks[0].position;
    corp.effect!.onTilePlaced!(marsBot, false, TileType.OCEAN, marsBot.game.board.spaces[0]);
    expect(marsBot.corpSpecificState.get('whiteCubeOnCard')).to.eq(0);
    expect(marsBot.marsBotBoard.tracks[0].position).to.be.gte(buildingBefore + 1);
  });

  it('pays 3 M€ per adjacent ocean when MarsBot places a tile', () => {
    const {game, marsBot} = createAutomaGame();
    const ocean = game.board.getAvailableSpacesForOcean(marsBot.player)[0];
    const land = game.board.getAdjacentSpaces(ocean).find((s) => s.spaceType === SpaceType.LAND)!;
    game.simpleAddTile(marsBot.player, ocean, {tileType: TileType.OCEAN});
    const tilePlacer = marsBot['bonusResolver']['tilePlacer'];
    expect(tilePlacer.getOceanAdjacencyMC(land)).to.eq(2);
    marsBot.setCorpAndSetup(getMarsBotCorp(CardName.LAKEFRONT_RESORTS)!);
    expect(tilePlacer.getOceanAdjacencyMC(land)).to.eq(3);
  });

  // FAQ (rulebook B, p.4): Lakefront overrides Government Intervention's "no M€", but not its "no TR"
  it('keeps the M€ from its building-track advance during Government Intervention', () => {
    // Tharsis building #8 is a greenery; oxygen is maxed, so it pays M€ and no TR
    const {game, marsBot, mcBefore} = interventionWithBuildingAt(7);
    const placer = marsBot.turnResolver.tilePlacer;
    let greenery: Space | undefined;
    const find = placer.findGreenerySpace.bind(placer);
    placer.findGreenerySpace = (filter) => greenery = find(filter);

    resolveIntervention(marsBot);

    expect(game.board.getOceanSpaces()).has.length(1);
    expect(marsBot.corpSpecificState.get('whiteCubeOnCard')).to.eq(0);
    expect(marsBot.marsBotBoard.tracks[0].position).to.eq(8);
    const greeneryMc = placer.getTotalPlacementMC(greenery!);
    expect(greeneryMc).to.be.greaterThan(0);
    expect(marsBot.megacredits).to.eq(mcBefore + greeneryMc);
  });

  it('still loses the TR from its building-track advance during Government Intervention', () => {
    // Tharsis building #5 is 2 TR
    const {game, marsBot, trBefore} = interventionWithBuildingAt(4);

    resolveIntervention(marsBot);

    expect(game.board.getOceanSpaces()).has.length(1);
    expect(marsBot.marsBotBoard.tracks[0].position).to.eq(5);
    expect(marsBot.player.terraformRating).to.eq(trBefore);
  });

  it('ocean placed without white cube → place white cube', () => {
    const {marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.LAKEFRONT_RESORTS)!;
    marsBot.setCorpAndSetup(corp);
    marsBot.corpSpecificState.set('whiteCubeOnCard', 0);
    corp.effect!.onTilePlaced!(marsBot, false, TileType.OCEAN, marsBot.game.board.spaces[0]);
    expect(marsBot.corpSpecificState.get('whiteCubeOnCard')).to.eq(1);
  });
});
