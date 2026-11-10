import {expect} from 'chai';
import {TileType} from '@/common/TileType';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {BoardName} from '@/common/boards/BoardName';
import {CardName} from '@/common/cards/CardName';
import {cast} from '@/common/utils/utils';
import {clearMarsBotCorpRegistry, getMarsBotCorp, registerMarsBotCorp} from '@/server/automa/corps/MarsBotCorpRegistry';
import {ARCADIAN_COMMUNITIES_MARSBOT_CORP} from '@/server/automa/corps/promo/ArcadianCommunitiesMarsBot';
import {EcoLine} from '@/server/cards/corporation/EcoLine';
import {Biofuels} from '@/server/cards/prelude/Biofuels';
import {IPreludeCard} from '@/server/cards/prelude/IPreludeCard';
import {HeadStart} from '@/server/cards/promo/HeadStart';
import {OrOptions} from '@/server/inputs/OrOptions';
import {SelectCard} from '@/server/inputs/SelectCard';
import {testGame} from '../../../TestGame';
import {runAllActions} from '../../../TestingUtils';
import {createAutomaGame, resetCorpRegistry} from '../CorpGame';
import {recordingMarsBot} from '../RecordingMarsBot';

describe('ArcadianCommunitiesMarsBot', () => {
  beforeEach(resetCorpRegistry);
  afterEach(resetCorpRegistry);

  it('resolves Settlers at setup, and it is its action deck bonus card', () => {
    const {marsBot, calls} = recordingMarsBot();

    ARCADIAN_COMMUNITIES_MARSBOT_CORP.setup!(marsBot);

    expect(calls).deep.eq(['resolveBonusCard(B22)']);
    expect(ARCADIAN_COMMUNITIES_MARSBOT_CORP.actionDeckBonusCard).eq(BonusCardId.B22_SETTLERS);
  });

  it('pays 3 M€ for the tile MarsBot puts on a space with its marker, and no one else', () => {
    const [game] = testGame(1);
    const [markedByPlayerTile, markedByBotTile, unmarked] = game.board.spaces;
    const markers = new Set([markedByPlayerTile, markedByBotTile]);
    const {marsBot, calls} = recordingMarsBot({game, removeMarker: (space) => markers.delete(space)});
    const onTilePlaced = ARCADIAN_COMMUNITIES_MARSBOT_CORP.effect!.onTilePlaced!;

    onTilePlaced(marsBot, false, TileType.CITY, markedByPlayerTile);
    onTilePlaced(marsBot, true, TileType.CITY, unmarked);
    onTilePlaced(marsBot, true, TileType.CITY, markedByBotTile);

    expect(calls).deep.eq(['gainMc(3)']);
  });

  it('resolves Settlers at setup and puts one Settlers in the first action deck', () => {
    const [game, human] = testGame(1, {automa: true, automaCorpOption: true, boardName: BoardName.THARSIS});
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
    const [game, human] = testGame(1, {automa: true, automaCorpOption: true, preludeExtension: true, boardName: BoardName.THARSIS});
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
    const [game, human] = testGame(1, {automa: true, automaCorpOption: true, preludeExtension: true, boardName: BoardName.THARSIS});
    const marsBot = game.automaHooks!.marsBot;
    const corp = getMarsBotCorp(CardName.ARCADIAN_COMMUNITIES)!;
    clearMarsBotCorpRegistry();
    registerMarsBotCorp(corp);
    human.pickedCorporationCard = new EcoLine();
    const headStart = new HeadStart();
    const biofuels = new Biofuels();
    human.preludeCardsInHand = [headStart, biofuels];
    // Head Start's actions are dropped when there is nothing to do with them
    human.heat = 8;
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
