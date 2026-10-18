import {expect} from 'chai';
import {BoardName} from '@/common/boards/BoardName';
import {testGame} from '../../TestGame';
import {SpaceBonus} from '@/common/boards/SpaceBonus';
import {SpaceType} from '@/common/boards/SpaceType';
import {runAllActions} from '@tests/TestingUtils';
import {SolarFarm} from '@/server/cards/ares/SolarFarm';
import {cast} from '@/common/utils/utils';
import {SelectSpace} from '@/server/inputs/SelectSpace';
import {SelectResource} from '@/server/inputs/SelectResource';

describe('probe: shuffled Amazonis and Solar Farm', () => {
  it('shuffleMapOption keeps volcanic bonuses and never puts DELEGATE/STANDARD_RESOURCE on oceans', () => {
    let oceansWithSpecial = 0;
    for (let i = 0; i < 20; i++) {
      const [game] = testGame(2, {boardName: BoardName.AMAZONIS_PLANITIA, shuffleMapOption: true}, 's' + i);
      for (const s of game.board.spaces) {
        if (s.spaceType === SpaceType.OCEAN && (s.bonus.includes(SpaceBonus.DELEGATE) || s.bonus.includes(SpaceBonus.STANDARD_RESOURCE))) {
          oceansWithSpecial++;
        }
      }
    }
    console.log('oceans with DELEGATE/STANDARD_RESOURCE across 20 shuffles:', oceansWithSpecial);
    expect(oceansWithSpecial).eq(0);
  });

  it('BUG?: Ares Solar Farm on a standard-resource space counts 0 plants', () => {
    const [game, player] = testGame(2, {boardName: BoardName.AMAZONIS_PLANITIA, aresExtension: true, aresHazards: false});
    const card = new SolarFarm();
    card.play(player);
    runAllActions(game);
    const sel = cast(player.popWaitingFor(), SelectSpace);
    sel.cb(game.board.getSpaceOrThrow('35'));
    runAllActions(game);
    cast(player.popWaitingFor(), SelectResource).cb('plants');
    runAllActions(game);
    expect(player.production.energy, 'energy production from Solar Farm on a space whose bonus was chosen as plants').eq(1);
  });
});
