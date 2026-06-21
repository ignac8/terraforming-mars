import {shallowMount} from '@vue/test-utils';
import {globalConfig} from './getLocalVue';
import {expect} from 'chai';
import Board from '@/client/components/Board.vue';
import BoardSpace from '@/client/components/BoardSpace.vue';
import {SpaceModel} from '@/common/models/SpaceModel';
import {SpaceType} from '@/common/boards/SpaceType';
import {DEFAULT_EXPANSIONS} from '@/common/cards/GameModule';
import {BoardName} from '@/common/boards/BoardName';

const spaces: SpaceModel[] = [
  {
    id: '01',
    x: 1,
    y: 1,
    bonus: [],
    spaceType: SpaceType.COLONY,
    color: undefined,
    highlight: undefined,
    tileType: undefined,
  },
  {
    id: '02',
    x: 2,
    y: 1,
    bonus: [],
    spaceType: SpaceType.COLONY,
    color: undefined,
    highlight: undefined,
    tileType: undefined,
  },
  {
    id: '69',
    x: 3,
    y: 1,
    bonus: [],
    spaceType: SpaceType.COLONY,
    color: undefined,
    highlight: undefined,
    tileType: undefined,
  },
  {
    id: '04',
    x: 3,
    y: 1,
    bonus: [],
    spaceType: SpaceType.OCEAN,
    color: undefined,
    highlight: undefined,
    tileType: undefined,
  },
];


describe('Board', () => {
  it('has visible tiles on the board', () => {
    const wrapper = shallowMount(Board, {
      ...globalConfig,
      props: {spaces, expansions: DEFAULT_EXPANSIONS, tileView: 'hide', venusScaleLevel: 0, boardName: BoardName.THARSIS},
    });

    const boardSpacesWrappers = wrapper.findAllComponents(BoardSpace).filter((wrapper) => {
      return wrapper.attributes('data-test') === 'board-space';
    });

    expect(
      boardSpacesWrappers.every((wrapper) => wrapper.props('tileView') === 'hide'),
    ).to.be.true;
  });

  it('has hidden tiles on the board', () => {
    const wrapper = shallowMount(Board, {
      ...globalConfig,
      props: {spaces, expansions: DEFAULT_EXPANSIONS, tileView: 'show', venusScaleLevel: 0, boardName: BoardName.THARSIS},
    });

    const boardSpacesWrappers = wrapper.findAllComponents(BoardSpace).filter((wrapper) => {
      return wrapper.attributes('data-test') === 'board-space';
    });

    expect(
      boardSpacesWrappers.every((wrapper) => wrapper.props('tileView') === 'show'),
    ).to.be.true;
  });

  it('emits toggleTileView on toggle button click', async () => {
    const wrapper = shallowMount(Board, {
      ...globalConfig,
      props: {spaces, expansions: DEFAULT_EXPANSIONS, venusScaleLevel: 0, boardName: BoardName.THARSIS},
    });

    await wrapper.find('[data-test=hide-tiles-button]').trigger('click');
    expect(wrapper.emitted('toggleTileView')?.length).to.be.eq(1);
  });

  it('renders "show tiles" in toggle button if tiles are hidden', () => {
    const wrapper = shallowMount(Board, {
      ...globalConfig,
      props: {spaces, expansions: DEFAULT_EXPANSIONS, tileView: 'show', venusScaleLevel: 0, boardName: BoardName.THARSIS},
    });

    expect(wrapper.find('[data-test=hide-tiles-button]').text()).to.be.eq('show tiles');
  });

  it('renders "hide tiles" in toggle button if tiles are visible', () => {
    const wrapper = shallowMount(Board, {
      ...globalConfig,
      props: {spaces, expansions: DEFAULT_EXPANSIONS, tileView: 'hide', venusScaleLevel: 0, boardName: BoardName.THARSIS},
    });

    expect(wrapper.find('[data-test=hide-tiles-button]').text()).to.be.eq('hide tiles');
  });

  it('renders all 91 mars spaces and the big-board size class for AMAZONIS_BIG', () => {
    const bigSpaces: SpaceModel[] = [];
    for (let i = 0; i < 91; i++) {
      bigSpaces.push({
        id: `a${(i + 10).toString()}`,
        x: i % 11,
        y: Math.floor(i / 11),
        bonus: [],
        spaceType: SpaceType.LAND,
        color: undefined,
        highlight: undefined,
        tileType: undefined,
      });
    }
    const wrapper = shallowMount(Board, {
      ...globalConfig,
      props: {spaces: bigSpaces, expansions: DEFAULT_EXPANSIONS, tileView: 'show', venusScaleLevel: 0, boardName: BoardName.AMAZONIS_BIG},
    });

    const boardSpacesWrappers = wrapper.findAllComponents(BoardSpace).filter((w) => {
      return w.attributes('data-test') === 'board-space';
    });
    expect(boardSpacesWrappers.length).to.eq(91);
    expect(wrapper.classes()).to.include('board-size-big');
  });

  it('includes the big-board Venus values 31/32/33 in the venus ladder', () => {
    const venusFieldValues = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 31, 32, 33];
    const wrapper = shallowMount(Board, {
      ...globalConfig,
      props: {spaces, expansions: {...DEFAULT_EXPANSIONS, venus: true}, tileView: 'show', venusScaleLevel: 0, boardName: BoardName.AMAZONIS_BIG, venusFieldValues},
    });

    const ladder = (wrapper.vm as any).getValuesForParameter('venus').map((l: {value: number}) => l.value);
    expect(ladder).to.include(31);
    expect(ladder).to.include(32);
    expect(ladder).to.include(33);
    // highest to lowest
    expect(ladder[0]).to.eq(33);
    expect(ladder[ladder.length - 1]).to.eq(0);
  });
});
