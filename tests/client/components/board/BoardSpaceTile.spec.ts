import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import BoardSpaceTile from '@/client/components/board/BoardSpaceTile.vue';
import {SpaceType} from '@/common/boards/SpaceType';
import {BoardName} from '@/common/boards/BoardName';
import {TileType} from '@/common/TileType';

describe('BoardSpaceTile', () => {
  it('mounts without errors', () => {
    const wrapper = shallowMount(BoardSpaceTile, {
      ...globalConfig,
      props: {
        space: {
          id: '01',
          bonus: [],
          color: undefined,
          tileType: undefined,
          spaceType: SpaceType.LAND,
          highlight: undefined,
        },
        aresExtension: false,
      },
    });
    expect(wrapper.exists()).to.be.true;
  });

  function wetlandsTooltip(boardName?: BoardName): string {
    const wrapper = shallowMount(BoardSpaceTile, {
      ...globalConfig,
      props: {
        space: {
          id: '01',
          bonus: [],
          color: undefined,
          tileType: TileType.WETLANDS,
          spaceType: SpaceType.LAND,
          highlight: undefined,
        },
        aresExtension: false,
        ...(boardName === undefined ? {} : {boardName}),
      },
    });
    return wrapper.find('[data-test="tile"]').attributes('title') ?? '';
  }

  it('Wetlands tooltip names 9 oceans by default', () => {
    expect(wetlandsTooltip()).to.contain('Does not count toward 9 oceans.');
  });

  it('Wetlands tooltip names 9 oceans on Tharsis', () => {
    expect(wetlandsTooltip(BoardName.THARSIS)).to.contain('Does not count toward 9 oceans.');
  });

  it('Wetlands tooltip names 11 oceans on Amazonis Planitia', () => {
    expect(wetlandsTooltip(BoardName.AMAZONIS_PLANITIA)).to.contain('Does not count toward 11 oceans.');
  });
});
