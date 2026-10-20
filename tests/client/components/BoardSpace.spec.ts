import {mount} from '@vue/test-utils';
import {globalConfig} from './getLocalVue';
import {expect} from 'chai';
import BoardSpace from '@/client/components/BoardSpace.vue';
import {SpaceType} from '@/common/boards/SpaceType';
import {SpaceBonus} from '@/common/boards/SpaceBonus';
import {BoardName} from '@/common/boards/BoardName';
import {TileType} from '@/common/TileType';

describe('BoardSpace', () => {
  it('has visible tile', async () => {
    const wrapper = mount(BoardSpace, {
      ...globalConfig,
      props: {
        space: {
          id: 'm01',
          bonus: [],
          spaceType: SpaceType.LAND,
        },
        tileView: 'show',
      },
    });

    expect(wrapper.find('[data-test="tile"]').classes()).to.not.contain('board-hidden-tile');
  });

  it('has hidden tile if hidden props is passed', async () => {
    const wrapper = mount(BoardSpace, {
      ...globalConfig,
      props: {
        space: {
          id: 'm01',
          bonus: [],
          spaceType: SpaceType.LAND,
        },
        tileView: 'hide',
      },
    });

    expect(wrapper.find('[data-test="tile"]').classes()).to.contain('board-hidden-tile');
  });

  it('renders a neutral player cube instead of a space bonus', async () => {
    const wrapper = mount(BoardSpace, {
      ...globalConfig,
      props: {
        space: {
          id: 'm01',
          bonus: [SpaceBonus.STEEL],
          spaceType: SpaceType.LAND,
          cube: 'martian-nature-wonders',
        },
        tileView: 'show',
      },
    });

    expect(wrapper.find('[data-test="cube"]').exists()).is.true;
    expect(wrapper.find('.board-space-bonuses').exists()).is.false;
  });

  it('shows the board ocean maximum in the Wetlands tooltip', async () => {
    const wrapper = mount(BoardSpace, {
      ...globalConfig,
      props: {
        space: {
          id: '05',
          bonus: [],
          spaceType: SpaceType.LAND,
          tileType: TileType.WETLANDS,
        },
        tileView: 'show',
        boardName: BoardName.AMAZONIS_PLANITIA,
      },
    });

    expect(wrapper.find('[data-test="tile"]').attributes('title')).to.contain('Does not count toward 11 oceans.');
  });
});
