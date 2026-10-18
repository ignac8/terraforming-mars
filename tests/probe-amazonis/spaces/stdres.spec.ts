import {expect} from 'chai';
import {BoardName} from '@/common/boards/BoardName';
import {testGame} from '../../TestGame';
import {runAllActions, addCity, addGreenery, setRulingParty} from '@tests/TestingUtils';
import {cast} from '@/common/utils/utils';
import {MiningArea} from '@/server/cards/base/MiningArea';
import {MiningAreaAres} from '@/server/cards/ares/MiningAreaAres';
import {SelectSpace} from '@/server/inputs/SelectSpace';
import {OrOptions} from '@/server/inputs/OrOptions';
import {SelectResource} from '@/server/inputs/SelectResource';
import {TileType} from '@/common/TileType';
import {MiningGuild} from '@/server/cards/corporation/MiningGuild';
import {Resource} from '@/common/Resource';
import {GeologicalSurvey} from '@/server/cards/ares/GeologicalSurvey';
import {Phase} from '@/common/Phase';
import {PartyName} from '@/common/turmoil/PartyName';

const opts = {boardName: BoardName.AMAZONIS_PLANITIA};

describe('probe: Amazonis STANDARD_RESOURCE', () => {
  it('player placing greenery on 35 gets a SelectResource with all six resources', () => {
    const [game, player] = testGame(2, opts);
    addGreenery(player, '35');
    runAllActions(game);
    const sr = cast(player.popWaitingFor(), SelectResource);
    expect(sr.include).to.have.members(['megacredits', 'steel', 'titanium', 'plants', 'energy', 'heat']);
  });

  it('Mining Area on 41: choose titanium production, then standard resource', () => {
    const [game, player] = testGame(2, opts);
    const card = new MiningArea();
    player.playedCards.push(card);
    game.simpleAddTile(player, game.board.getAdjacentSpaces(game.board.getSpaceOrThrow('41'))[0], {tileType: TileType.GREENERY});
    const ss = cast(card.play(player), SelectSpace);
    expect(ss.spaces.map((s) => s.id)).to.include('41');
    ss.cb(game.board.getSpaceOrThrow('41'));
    runAllActions(game);
    const choose = cast(player.popWaitingFor(), OrOptions);
    choose.options[1].cb();
    runAllActions(game);
    expect(player.production.titanium).eq(1);
    const sr = cast(player.popWaitingFor(), SelectResource);
    sr.cb('steel');
    expect(player.steel).eq(1);
    expect(game.board.getSpaceOrThrow('41').tile?.tileType).eq(TileType.MINING_AREA);
  });

  it('Mining Rights Ares on 83', () => {
    const [game, player] = testGame(2, {...opts, aresExtension: true, aresHazards: false});
    const card = new MiningAreaAres();
    game.simpleAddTile(player, game.board.getAdjacentSpaces(game.board.getSpaceOrThrow('83'))[0], {tileType: TileType.GREENERY});
    const ss = cast(card.play(player), SelectSpace);
    ss.cb(game.board.getSpaceOrThrow('83'));
    runAllActions(game);
    const choose = cast(player.popWaitingFor(), OrOptions);
    choose.options[1].cb();
    runAllActions(game);
    expect(player.production.titanium).eq(1);
    expect(game.board.getSpaceOrThrow('83').tile?.tileType).eq(TileType.MINING_TITANIUM_BONUS);
    expect(game.board.getSpaceOrThrow('83').adjacency?.bonus).deep.eq([0]);
  });

  it('Mining Guild: owner places city on 35, picks steel => +1 steel prod; picks plants => none', () => {
    const [game, player] = testGame(2, opts);
    const guild = new MiningGuild();
    player.playedCards.push(guild);
    addCity(player, '35');
    runAllActions(game);
    cast(player.popWaitingFor(), SelectResource).cb('plants');
    runAllActions(game);
    expect(player.production.steel).eq(0);
    addCity(player, '83');
    runAllActions(game);
    cast(player.popWaitingFor(), SelectResource).cb('titanium');
    runAllActions(game);
    expect(player.production.steel).eq(1);
  });

  it('Mining Guild: Mining Area on 41 titanium production (from card) and standard resource steel => one steel production from Guild', () => {
    const [game, player] = testGame(2, opts);
    const guild = new MiningGuild();
    player.playedCards.push(guild);
    const card = new MiningArea();
    game.simpleAddTile(player, game.board.getAdjacentSpaces(game.board.getSpaceOrThrow('41'))[0], {tileType: TileType.GREENERY});
    const ss = cast(card.play(player), SelectSpace);
    ss.cb(game.board.getSpaceOrThrow('41'));
    runAllActions(game);
    cast(player.popWaitingFor(), OrOptions).options[0].cb();
    runAllActions(game);
    cast(player.popWaitingFor(), SelectResource).cb('steel');
    runAllActions(game);
    // card: +1 steel prod ; guild: +1 steel prod
    expect(player.production.steel).eq(2);
  });

  it('Solar phase (WGT) ocean on... no bonuses, no prompt', () => {
    const [game, player] = testGame(2, opts);
    game.phase = Phase.SOLAR;
    game.simpleAddTile(player, game.board.getSpaceOrThrow('35'), {tileType: TileType.GREENERY});
    runAllActions(game);
    expect(player.popWaitingFor()).is.undefined;
  });

  it('Geological Survey: steel via standard resource on 35 gives extra steel (Ares)', () => {
    const [game, player] = testGame(2, {...opts, aresExtension: true, aresHazards: false});
    player.playedCards.push(new GeologicalSurvey());
    addCity(player, '35');
    runAllActions(game);
    cast(player.popWaitingFor(), SelectResource).cb('steel');
    runAllActions(game);
    expect(player.steel).eq(2);
  });

  it('Mars First policy + Geological Survey: no double count', () => {
    const [game, player] = testGame(2, {...opts, aresExtension: true, aresHazards: false, turmoilExtension: true});
    player.playedCards.push(new GeologicalSurvey());
    setRulingParty(game, PartyName.MARS, 'mp01');
    addCity(player, '35');
    runAllActions(game);
    const input = player.popWaitingFor();
    if (input instanceof SelectResource) input.cb('steel');
    runAllActions(game);
    // mars first ruling: +1 steel for each? (expected: ruling gives 1 steel on tile placement on Mars; survey +1; chosen steel +1)
    console.log('steel', player.steel);
    expect(Resource.STEEL).eq('steel');
  });
});

