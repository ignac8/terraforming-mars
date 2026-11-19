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

  for (const [boardName, oceans] of [[undefined, 9], [BoardName.AMAZONIS_PLANITIA, 11]] as const) {
    it(`Wetlands tooltip names ${oceans} oceans on ${boardName ?? 'the default board'}`, () => {
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
          boardName,
        },
      });
      expect(wrapper.find('[data-test="tile"]').attributes('title')).to.contain(`Does not count toward ${oceans} oceans.`);
    });
  }
});
