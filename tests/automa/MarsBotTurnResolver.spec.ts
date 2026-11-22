import {expect} from 'chai';
import {TrackAction, TrackDefinition} from '@/common/automa/AutomaTypes';
import {CardResource} from '@/common/CardResource';
import {CardType} from '@/common/cards/CardType';
import {Tag} from '@/common/cards/Tag';
import {Phase} from '@/common/Phase';
import {IMarsBot} from '@/server/automa/IMarsBot';
import {MarsBotBoard} from '@/server/automa/MarsBotBoard';
import {MarsBotTilePlacer} from '@/server/automa/MarsBotTilePlacer';
import {MarsBotTurnResolver} from '@/server/automa/MarsBotTurnResolver';
import {THARSIS_MARSBOT_BOARD} from '@/server/automa/boards/TharsisMarsBot';
import {Splice} from '@/server/cards/promo/Splice';
import {testGame} from '../TestGame';
import {fakeCard, maxOutOceans, runAllActions, setTemperature} from '../TestingUtils';
import {recordingMarsBot} from './corps/RecordingMarsBot';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {MarsBot} from '../../src/server/automa/MarsBot';
import {MarsBotTags} from '../../src/server/automa/MarsBotTags';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {Algae} from '../../src/server/cards/base/Algae';
import {Asteroid} from '../../src/server/cards/base/Asteroid';
import {EarthOffice} from '../../src/server/cards/base/EarthOffice';
import {SpaceStation} from '../../src/server/cards/base/SpaceStation';
import {SearchForLife} from '../../src/server/cards/base/SearchForLife';
import {maxTracks} from './bonusCards/BonusCardGame';
import {createAutomaGame, standaloneMarsBot} from './corps/CorpGame';
import {marsBotCanClaimMilestone} from '../../src/server/automa/MarsBotMilestoneAwardEval';

/** The Tharsis tracks without their icons, with `action` on space 1 of the Building track. */
function tracksWith(action?: TrackAction): ReadonlyArray<TrackDefinition> {
  return THARSIS_MARSBOT_BOARD.map((definition, index) => {
    const layout: Array<TrackAction | undefined> = new Array(19).fill(undefined);
    if (index === 0) {
      layout[1] = action;
    }
    return {...definition, layout};
  });
}

/** A resolver on a bot that records the calls it gets, and the notices for its corp in `notices`. */
function setup(action?: TrackAction, fields: Partial<IMarsBot> = {}) {
  const [game, human, botPlayer] = testGame(2);
  const notices: Array<string> = [];
  const {marsBot, calls} = recordingMarsBot({
    game,
    player: botPlayer,
    humanPlayer: human,
    marsBotBoard: new MarsBotBoard(tracksWith(action)),
    megacredits: 0,
    failedActionMc: 5,
    interceptsParameterRaise: () => false,
    triggerTrackCube: () => false,
    notifyTagResolved: (tag) => notices.push(`notifyTagResolved(${tag})`),
    notifyProjectCardResolved: (card) => notices.push(`notifyProjectCardResolved(${card.name})`),
    notifyTrackSpaceResolved: (trackIndex, position) => notices.push(`notifyTrackSpaceResolved(${trackIndex}, ${position})`),
    notifyFailedAction: () => notices.push('notifyFailedAction()'),
    ...fields,
  });
  const resolver = new MarsBotTurnResolver(marsBot, new MarsBotTilePlacer(marsBot));
  const positions = () => marsBot.marsBotBoard.tracks.map((track) => track.position);
  return {game, human, botPlayer, marsBot, calls, notices, resolver, positions};
}

/** Builds the Tharsis tracks with `action` on space `pos` of the Building track and no other icons on it. */
function makeBoardWithTrack1Action(pos: number, action: string): ReadonlyArray<TrackDefinition> {
  const layout = new Array(19).fill(undefined);
  layout[pos] = action;
  return THARSIS_MARSBOT_BOARD.map((def, i) => {
    if (i === 0) {
      return {...def, layout} as TrackDefinition;
    }
    return def;
  });
}

/** Builds the Tharsis tracks with no icons on any space. */
function makeEmptyBoard(): ReadonlyArray<TrackDefinition> {
  const emptyLayout = new Array(19).fill(undefined);
  return THARSIS_MARSBOT_BOARD.map((def) => ({...def, layout: emptyLayout} as TrackDefinition));
}

describe('MarsBotTurnResolver', () => {
  for (const run of [
    {tags: [Tag.BUILDING, Tag.SPACE], type: CardType.AUTOMATED, expected: [1, 1, 0, 0, 0, 0, 0]},
    {tags: [Tag.SPACE], type: CardType.EVENT, expected: [0, 1, 1, 0, 0, 0, 0]},
    {tags: [Tag.WILD], type: CardType.AUTOMATED, expected: [1, 0, 0, 0, 0, 0, 0]},
    {tags: [Tag.VENUS], type: CardType.AUTOMATED, expected: [0, 0, 0, 0, 0, 0, 0]},
  ] as const) {
    it('advances the track of each tag on the card: ' + JSON.stringify(run), () => {
      const {resolver, positions} = setup();

      resolver.resolveProjectCard(fakeCard({tags: [...run.tags], type: run.type}));

      expect(positions()).deep.eq(run.expected);
    });
  }

  it('advances only the first tag with firstTagOnly', () => {
    const {resolver, positions} = setup();

    resolver.resolveProjectCard(fakeCard({tags: [Tag.BUILDING, Tag.SPACE]}), true);

    expect(positions()).deep.eq([1, 0, 0, 0, 0, 0, 0]);
  });

  it('takes a Failed Action for a card with no tags', () => {
    const {resolver, calls, notices} = setup();
    const card = fakeCard({tags: []});

    resolver.resolveProjectCard(card);

    expect(calls).deep.eq(['gainMc(5)']);
    const expectedNotices = ['notifyFailedAction()', `notifyProjectCardResolved(${card.name})`];
    expect(notices).deep.eq(expectedNotices);
  });

  it("tells MarsBot's corp about the tag, the space it reached and the card", () => {
    const {resolver, notices} = setup();
    const card = fakeCard({tags: [Tag.BUILDING]});

    resolver.resolveProjectCard(card);

    const expectedNotices = [
      'notifyTagResolved(building)',
      'notifyTrackSpaceResolved(0, 1)',
      `notifyProjectCardResolved(${card.name})`,
    ];
    expect(notices).deep.eq(expectedNotices);
  });

  it("runs the player's card effects for MarsBot's card, which holds no resources for MarsBot", () => {
    const {game, human, botPlayer, resolver} = setup();
    human.playedCards.push(new Splice());

    resolver.resolveProjectCard(fakeCard({tags: [Tag.MICROBE], resourceType: CardResource.MICROBE}));
    runAllActions(game);

    expect(human.megaCredits).eq(2);
    expect(botPlayer.popWaitingFor()).is.undefined;
  });

  for (const run of [
    {action: 'milestone', expected: ['maybeClaimMilestone()']},
    {action: 'award', expected: ['maybeFundAward()']},
    {action: 'temperature', expected: ['raiseTemperature(1)']},
    {action: 'temperature2', expected: ['raiseTemperature(2)']},
  ] as const) {
    it('resolves the icon of the space the track reaches through MarsBot: ' + JSON.stringify(run), () => {
      const {resolver, calls} = setup(run.action);

      resolver.advanceTrack(0);

      expect(calls).deep.eq(run.expected);
    });
  }

  for (const run of [
    {action: 'tr2', expected: {terraformRating: 22, positions: [1, 0, 0, 0, 0, 0, 0]}},
    {action: 'advance', expected: {terraformRating: 20, positions: [2, 0, 0, 0, 0, 0, 0]}},
    {action: 'tag_6', expected: {terraformRating: 20, positions: [1, 0, 0, 0, 0, 0, 1]}},
    {action: 'tag_earth', expected: {terraformRating: 20, positions: [1, 0, 0, 0, 0, 1, 0]}},
  ] as const) {
    it('raises the TR or moves a track for the icon of the space reached: ' + JSON.stringify(run), () => {
      const {botPlayer, resolver, positions} = setup(run.action);

      resolver.advanceTrack(0);

      const actual = {terraformRating: botPlayer.terraformRating, positions: positions()};
      expect(actual).deep.eq(run.expected);
    });
  }

  for (const run of [
    {action: 'greenery', expected: {greeneries: 1, cities: 0, oceans: 0, oxygen: 1}},
    {action: 'city', expected: {greeneries: 0, cities: 1, oceans: 0, oxygen: 0}},
    {action: 'ocean', expected: {greeneries: 0, cities: 0, oceans: 1, oxygen: 0}},
  ] as const) {
    it('places a tile for MarsBot for the icon of the space reached: ' + JSON.stringify(run), () => {
      const {game, botPlayer, resolver} = setup(run.action);

      resolver.advanceTrack(0);

      const actual = {
        greeneries: game.board.getGreeneries(botPlayer).length,
        cities: game.board.getCities(botPlayer).length,
        oceans: game.board.getOceanSpaces().length,
        oxygen: game.getOxygenLevel(),
      };
      expect(actual).deep.eq(run.expected);
    });
  }

  for (const run of [
    {name: 'a maxed track', action: undefined, fields: {}},
    {name: 'no milestone to claim', action: 'milestone', fields: {maybeClaimMilestone: () => false}},
    {name: 'no award to fund', action: 'award', fields: {maybeFundAward: () => false}},
    {name: 'a maxed temperature', action: 'temperature', fields: {}},
    {name: 'no ocean left', action: 'ocean', fields: {}},
  ] as const) {
    it('takes a Failed Action when the space reached cannot resolve: ' + JSON.stringify(run), () => {
      const {game, human, marsBot, resolver, calls, notices} = setup(run.action, run.fields);
      if (run.name === 'a maxed track') {
        marsBot.marsBotBoard.tracks[0].position = 18;
      }
      if (run.name === 'a maxed temperature') {
        setTemperature(game, 8);
      }
      if (run.name === 'no ocean left') {
        maxOutOceans(human);
      }

      resolver.advanceTrack(0);

      expect(calls).deep.eq(['gainMc(5)']);
      expect(notices).includes('notifyFailedAction()');
    });
  }

  it('leaves the icon unresolved when a corp cube replaces it', () => {
    const {botPlayer, resolver} = setup('tr2', {triggerTrackCube: () => true});

    resolver.advanceTrack(0);

    expect(botPlayer.terraformRating).eq(20);
  });

  it('places no ocean, and takes no Failed Action, when the corp cancels the raise', () => {
    const {game, resolver, calls} = setup('ocean', {interceptsParameterRaise: () => true});

    resolver.advanceTrack(0);

    expect(game.board.getOceanSpaces()).is.empty;
    expect(calls).is.empty;
  });

  it("doesn't tell the corp about a space the track regressed from", () => {
    const {marsBot, resolver, notices} = setup();
    marsBot.marsBotBoard.tracks[0].regressedPositions.add(1);

    resolver.advanceTrack(0);

    expect(notices).is.empty;
  });

  it('moves no track once the game has ended', () => {
    const {game, resolver, calls, positions} = setup();
    game.phase = Phase.END;

    resolver.resolveProjectCard(fakeCard({tags: [Tag.BUILDING]}));

    expect(positions()).deep.eq([0, 0, 0, 0, 0, 0, 0]);
    expect(calls).is.empty;
  });

  let game: IGame;
  let human: TestPlayer;
  let botPlayer: TestPlayer;
  let marsBot: MarsBot;
  let marsBotBoard: MarsBotBoard;
  let resolver: MarsBotTurnResolver;

  beforeEach(() => {
    [game, human] = testGame(1);
    botPlayer = TestPlayer.RED.newPlayer({name: 'marsbot'});
    botPlayer.game = game;
    marsBot = standaloneMarsBot(game, botPlayer, human, THARSIS_MARSBOT_BOARD);
    marsBotBoard = marsBot.marsBotBoard;
    botPlayer.tags = new MarsBotTags(botPlayer, marsBotBoard);
    resolver = marsBot.turnResolver;
  });

  describe('Project card tag resolution', () => {
    it('resolves project card with Plant tag → Track 7', () => {
      const card = new Algae();
      resolver.resolveProjectCard(card as IProjectCard);
      expect(marsBotBoard.tracks[6].position).to.be.gte(1);
    });

    it('resolves project card with Earth tag → Track 6', () => {
      const card = new EarthOffice();
      resolver.resolveProjectCard(card as IProjectCard);
      expect(marsBotBoard.tracks[5].position).to.be.gte(1);
    });

    it('resolves project card with Space tag (chains advance at pos 1)', () => {
      const card = new SpaceStation();
      resolver.resolveProjectCard(card as IProjectCard);
      // Track 2 pos 1 = advance, chains to pos 2
      expect(marsBotBoard.tracks[1].position).to.eq(2);
    });

    it('resolves project card with Science tag (chains advance at pos 1)', () => {
      const card = new SearchForLife();
      resolver.resolveProjectCard(card as IProjectCard);
      // Track 4 pos 1 = advance, chains to pos 2
      expect(marsBotBoard.tracks[3].position).to.eq(2);
    });

    it('resolves event card with Space tag — advances both Space and Event tracks', () => {
      const card = new Asteroid();
      resolver.resolveProjectCard(card as IProjectCard);
      // Space → Track 2 (pos 1=advance → pos 2), Event → Track 3 (pos 1=advance → pos 2)
      expect(marsBotBoard.tracks[1].position).to.eq(2);
      expect(marsBotBoard.tracks[2].position).to.eq(2);
    });

    it('resolves card with multiple tags advancing different tracks', () => {
      const emptyBoardData = makeEmptyBoard();
      const marsBot = standaloneMarsBot(game, botPlayer, human, emptyBoardData);
      const emptyBoard = marsBot.marsBotBoard;
      const r = marsBot.turnResolver;

      const mockCard = fakeCard({cost: 10, tags: [Tag.BUILDING, Tag.SPACE], type: CardType.AUTOMATED});
      r.resolveProjectCard(mockCard);
      expect(emptyBoard.tracks[0].position).to.eq(1);
      expect(emptyBoard.tracks[1].position).to.eq(1);
    });

    it('Wild tags advance least-advanced track', () => {
      const emptyBoardData = makeEmptyBoard();
      const marsBot = standaloneMarsBot(game, botPlayer, human, emptyBoardData);
      const emptyBoard = marsBot.marsBotBoard;
      const r = marsBot.turnResolver;
      const mockCard = fakeCard({cost: 5, tags: [Tag.WILD], type: CardType.AUTOMATED});
      r.resolveProjectCard(mockCard);
      // Wild tag advances the least-advanced track (all at 0, so track 0 = topmost)
      expect(emptyBoard.tracks[0].position).to.eq(1);
      for (let t = 1; t < 7; t++) {
        expect(emptyBoard.tracks[t].position).to.eq(0);
      }
    });

    it('unmapped tags are ignored without error', () => {
      const emptyBoardData = makeEmptyBoard();
      const marsBot = standaloneMarsBot(game, botPlayer, human, emptyBoardData);
      const emptyBoard = marsBot.marsBotBoard;
      const r = marsBot.turnResolver;
      const mockCard = fakeCard({cost: 5, tags: [Tag.VENUS], type: CardType.AUTOMATED});
      r.resolveProjectCard(mockCard);
      for (let t = 0; t < 7; t++) {
        expect(emptyBoard.tracks[t].position).to.eq(0);
      }
    });

    it('card with no tags at all is a failed action', () => {
      const emptyBoardData = makeEmptyBoard();
      const marsBot = standaloneMarsBot(game, botPlayer, human, emptyBoardData);
      const r = marsBot.turnResolver;
      const mockCard = fakeCard({cost: 5, tags: [], type: CardType.AUTOMATED});
      r.resolveProjectCard(mockCard);
      expect(marsBot.megacredits).to.eq(5);
    });

    it('event card with no other tags still advances Event track', () => {
      const emptyBoardData = makeEmptyBoard();
      const marsBot = standaloneMarsBot(game, botPlayer, human, emptyBoardData);
      const emptyBoard = marsBot.marsBotBoard;
      const r = marsBot.turnResolver;
      // Event card with no explicit tags — only the injected EVENT tag
      const mockCard = fakeCard({cost: 5, tags: [], type: CardType.EVENT});
      r.resolveProjectCard(mockCard);
      expect(emptyBoard.tracks[2].position).to.eq(1); // Event track
      expect(marsBot.megacredits).to.eq(0);
    });
  });

  describe('Failed actions', () => {
    it('gives 5 MC when track is at max', () => {
      const track = marsBotBoard.tracks[6];
      for (let i = 0; i < 18; i++) {
        track.advance();
      }
      expect(track.position).to.eq(18);

      resolver.resolveProjectCard(new Algae() as IProjectCard);
      expect(marsBot.megacredits).to.eq(5);
    });

    it('gives 3 MC in easy mode', () => {
      const easyMarsBot = standaloneMarsBot(game, botPlayer, human, THARSIS_MARSBOT_BOARD, 'easy');
      const easyResolver = easyMarsBot.turnResolver;
      const track = easyMarsBot.marsBotBoard.tracks[6];
      for (let i = 0; i < 18; i++) {
        track.advance();
      }

      easyResolver.resolveProjectCard(new Algae() as IProjectCard);
      expect(easyMarsBot.megacredits).to.eq(3);
    });

    it('accumulates MC across multiple failed actions', () => {
      const emptyBoardData = makeEmptyBoard();
      const marsBot = standaloneMarsBot(game, botPlayer, human, emptyBoardData);
      const emptyBoard = marsBot.marsBotBoard;
      const r = marsBot.turnResolver;
      for (let i = 0; i < 18; i++) {
        emptyBoard.tracks[6].advance();
      }

      r.resolveProjectCard(new Algae() as IProjectCard);
      r.resolveProjectCard(new Algae() as IProjectCard);
      expect(marsBot.megacredits).to.eq(10);
    });

    // A bonus card that can't resolve takes no Failed Action (rulebook A p.5 B.a; BGG 3599965 and
    // 3623553, njshaw2). Project cards still do.
    it('a project card tag still takes the Failed Action when advancing a maxed track', () => {
      const {marsBot} = createAutomaGame();
      maxTracks(marsBot);
      marsBot.turnResolver.advanceTrack(0);
      expect(marsBot.megacredits).to.eq(5);
    });
  });

  describe('Track actions', () => {
    it('advance action moves same track forward', () => {
      const boardData = makeBoardWithTrack1Action(1, 'advance');
      const marsBot = standaloneMarsBot(game, botPlayer, human, boardData);
      const b = marsBot.marsBotBoard;
      const r = marsBot.turnResolver;

      const mockCard = fakeCard({cost: 5, tags: [Tag.BUILDING], type: CardType.AUTOMATED});
      r.resolveProjectCard(mockCard);
      expect(b.tracks[0].position).to.eq(2); // 1 (advance) → 2
    });

    it('advance action ignored in easy mode', () => {
      const boardData = makeBoardWithTrack1Action(1, 'advance');
      const marsBot = standaloneMarsBot(game, botPlayer, human, boardData, 'easy');
      const b = marsBot.marsBotBoard;
      const r = marsBot.turnResolver;

      const mockCard = fakeCard({cost: 5, tags: [Tag.BUILDING], type: CardType.AUTOMATED});
      r.resolveProjectCard(mockCard);
      expect(b.tracks[0].position).to.eq(1);
    });

    it('tag_N action advances another track', () => {
      const boardData = makeBoardWithTrack1Action(1, 'tag_6');
      const marsBot = standaloneMarsBot(game, botPlayer, human, boardData);
      const b = marsBot.marsBotBoard;
      const r = marsBot.turnResolver;

      const mockCard = fakeCard({cost: 5, tags: [Tag.BUILDING], type: CardType.AUTOMATED});
      r.resolveProjectCard(mockCard);
      expect(b.tracks[0].position).to.eq(1);
      expect(b.tracks[6].position).to.be.gte(1);
    });

    it('TR action increases terraform rating', () => {
      const boardData = makeBoardWithTrack1Action(1, 'tr3');
      const marsBot = standaloneMarsBot(game, botPlayer, human, boardData);
      const r = marsBot.turnResolver;

      const startTR = botPlayer.terraformRating;
      const mockCard = fakeCard({cost: 5, tags: [Tag.BUILDING], type: CardType.AUTOMATED});
      r.resolveProjectCard(mockCard);
      expect(botPlayer.terraformRating).to.eq(startTR + 3);
    });

    it('TR1 through TR8 all work', () => {
      for (let n = 1; n <= 8; n++) {
        const boardData = makeBoardWithTrack1Action(1, `tr${n}`);
        const freshBotPlayer = TestPlayer.RED.newPlayer({name: `bot${n}`});
        freshBotPlayer.game = game;
        const r = standaloneMarsBot(game, freshBotPlayer, human, boardData).turnResolver;

        const startTR = freshBotPlayer.terraformRating;
        const mockCard = fakeCard({cost: 5, tags: [Tag.BUILDING], type: CardType.AUTOMATED});
        r.resolveProjectCard(mockCard);
        expect(freshBotPlayer.terraformRating).to.eq(startTR + n, `TR${n} failed`);
      }
    });

    it('milestone action at end of track gives failed action if all claimed', () => {
      const boardData = makeBoardWithTrack1Action(1, 'milestone');
      const marsBot = standaloneMarsBot(game, botPlayer, human, boardData);
      const r = marsBot.turnResolver;

      for (let i = 0; i < 3 && i < game.milestones.length; i++) {
        game.claimedMilestones.push({player: human, milestone: game.milestones[i]});
      }

      const mockCard = fakeCard({cost: 5, tags: [Tag.BUILDING], type: CardType.AUTOMATED});
      r.resolveProjectCard(mockCard);
      expect(marsBot.megacredits).to.eq(5);
    });

    it('award action gives failed action when all funded', () => {
      const boardData = makeBoardWithTrack1Action(1, 'award');
      const marsBot = standaloneMarsBot(game, botPlayer, human, boardData);
      const r = marsBot.turnResolver;

      for (let i = 0; i < 3 && i < game.awards.length; i++) {
        game.fundedAwards.push({player: human, award: game.awards[i]});
      }

      const mockCard = fakeCard({cost: 5, tags: [Tag.BUILDING], type: CardType.AUTOMATED});
      r.resolveProjectCard(mockCard);
      expect(marsBot.megacredits).to.eq(5);
    });

    it('temperature action fails when already maxed', () => {
      const boardData = makeBoardWithTrack1Action(1, 'temperature');
      const marsBot = standaloneMarsBot(game, botPlayer, human, boardData);
      const r = marsBot.turnResolver;

      setTemperature(game, 8); // MAX
      const mockCard = fakeCard({cost: 5, tags: [Tag.BUILDING], type: CardType.AUTOMATED});
      r.resolveProjectCard(mockCard);
      expect(marsBot.megacredits).to.eq(5);
    });

    it('ocean action fails when 9 oceans placed', () => {
      const boardData = makeBoardWithTrack1Action(1, 'ocean');
      const marsBot = standaloneMarsBot(game, botPlayer, human, boardData);
      const r = marsBot.turnResolver;

      const oceanSpaces = game.board.getAvailableSpacesForOcean(botPlayer);
      for (const s of oceanSpaces) {
        game.simpleAddTile(botPlayer, s, {tileType: 1}); // TileType.OCEAN
      }
      const mockCard = fakeCard({cost: 5, tags: [Tag.BUILDING], type: CardType.AUTOMATED});
      r.resolveProjectCard(mockCard);
      expect(marsBot.megacredits).to.eq(5);
    });

    it('chained advance that hits max gives failed action', () => {
      const layout = new Array(19).fill(undefined);
      layout[18] = 'advance';
      const boardData = THARSIS_MARSBOT_BOARD.map((def, i) => i === 0 ? {...def, layout} as TrackDefinition : def);
      const marsBot = standaloneMarsBot(game, botPlayer, human, boardData);
      const b = marsBot.marsBotBoard;
      const r = marsBot.turnResolver;

      for (let i = 0; i < 17; i++) {
        b.tracks[0].advance();
      }

      const mockCard = fakeCard({cost: 5, tags: [Tag.BUILDING], type: CardType.AUTOMATED});
      r.resolveProjectCard(mockCard);
      expect(b.tracks[0].position).to.eq(18);
      expect(marsBot.megacredits).to.eq(5);
    });
  });

  describe('Award evaluation (track-based)', () => {
    it('Landlord counts MarsBot tiles', () => {
      const spaces = game.board.getAvailableSpacesOnLand(botPlayer);
      game.simpleAddTile(botPlayer, spaces[5], {tileType: 0}); // GREENERY
      game.simpleAddTile(botPlayer, spaces[10], {tileType: 2}); // CITY
      const award = game.awards.find((a) => a.name === 'Landlord');
      if (award) {
        expect(marsBot.awardValue(award)).to.eq(2);
      }
    });

    it('Banker is track 1 + track 3', () => {
      for (let i = 0; i < 2; i++) {
        marsBotBoard.tracks[0].advance();
      }
      for (let i = 0; i < 3; i++) {
        marsBotBoard.tracks[2].advance();
      }
      const award = game.awards.find((a) => a.name === 'Banker');
      if (award) {
        expect(marsBot.awardValue(award)).to.eq(2 + 3);
      }
    });

    it('Scientist is track 4 position', () => {
      for (let i = 0; i < 5; i++) {
        marsBotBoard.tracks[3].advance();
      }
      const award = game.awards.find((a) => a.name === 'Scientist');
      if (award) {
        expect(marsBot.awardValue(award)).to.eq(5);
      }
    });

    it('Thermalist is track 5 + 5', () => {
      for (let i = 0; i < 3; i++) {
        marsBotBoard.tracks[4].advance();
      }
      const award = game.awards.find((a) => a.name === 'Thermalist');
      if (award) {
        expect(marsBot.awardValue(award)).to.eq(3 + 5);
      }
    });

    it('Miner is track 2 + 5', () => {
      for (let i = 0; i < 4; i++) {
        marsBotBoard.tracks[1].advance();
      }
      const award = game.awards.find((a) => a.name === 'Miner');
      if (award) {
        expect(marsBot.awardValue(award)).to.eq(4 + 5);
      }
    });

    it('easy mode reduces award values by 5', () => {
      const easyMarsBot = standaloneMarsBot(game, botPlayer, human, THARSIS_MARSBOT_BOARD, 'easy');
      botPlayer.tags = new MarsBotTags(botPlayer, easyMarsBot.marsBotBoard);
      for (let i = 0; i < 3; i++) {
        easyMarsBot.marsBotBoard.tracks[3].advance();
      }
      const award = game.awards.find((a) => a.name === 'Scientist');
      if (award) {
        expect(easyMarsBot.awardValue(award)).to.eq(3 - 5);
      }
    });
  });

  describe('Milestone criteria (track-based)', () => {
    it('Terraformer: needs 35 TR', () => {
      botPlayer.setTerraformRating(34);
      const m = game.milestones.find((ms) => ms.name === 'Terraformer');
      if (m) {
        expect(marsBotCanClaimMilestone(m, marsBot)).to.be.false;
        botPlayer.setTerraformRating(35);
        expect(marsBotCanClaimMilestone(m, marsBot)).to.be.true;
      }
    });

    it('Builder: needs track 1 at position 8', () => {
      const m = game.milestones.find((ms) => ms.name === 'Builder');
      if (m) {
        for (let i = 0; i < 7; i++) {
          marsBotBoard.tracks[0].advance();
        }
        expect(marsBotCanClaimMilestone(m, marsBot)).to.be.false;
        marsBotBoard.tracks[0].advance();
        expect(marsBotCanClaimMilestone(m, marsBot)).to.be.true;
      }
    });

    it('Planner: needs all tracks at position 4', () => {
      const m = game.milestones.find((ms) => ms.name === 'Planner');
      if (m) {
        for (let t = 0; t < 7; t++) {
          for (let i = 0; i < 3; i++) {
            marsBotBoard.tracks[t].advance();
          }
        }
        expect(marsBotCanClaimMilestone(m, marsBot)).to.be.false;
        for (let t = 0; t < 7; t++) {
          marsBotBoard.tracks[t].advance();
        }
        expect(marsBotCanClaimMilestone(m, marsBot)).to.be.true;
      }
    });
  });

  describe('Regressed positions', () => {
    it('regressed position action is skipped on re-advance', () => {
      const boardData = makeBoardWithTrack1Action(2, 'tr5');
      const marsBot = standaloneMarsBot(game, botPlayer, human, boardData);
      const b = marsBot.marsBotBoard;
      const r = marsBot.turnResolver;

      const startTR = botPlayer.terraformRating;
      const mockCard = fakeCard({cost: 5, tags: [Tag.BUILDING], type: CardType.AUTOMATED});
      r.resolveProjectCard(mockCard); // pos 1 (null)
      r.resolveProjectCard(mockCard); // pos 2 (tr5)
      expect(botPlayer.terraformRating).to.eq(startTR + 5);

      b.tracks[0].regress();
      expect(b.tracks[0].position).to.eq(1);

      const trBefore = botPlayer.terraformRating;
      r.resolveProjectCard(mockCard);
      expect(b.tracks[0].position).to.eq(2);
      expect(botPlayer.terraformRating).to.eq(trBefore);
    });
  });
});
