import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from './getLocalVue';
import TopBar from '@/client/components/TopBar.vue';
import {fakePlayerViewModel, fakePublicPlayerModel} from './testHelpers';
import PlayerInfo from '@/client/components/overview/PlayerInfo.vue';
import TerraformedBanner from '@/client/components/TerraformedBanner.vue';
import {FakeLocalStorage} from './FakeLocalStorage';
import {PreferencesManager} from '@/client/utils/PreferencesManager';

describe('TopBar', () => {
  let localStorage: FakeLocalStorage;

  beforeEach(() => {
    localStorage = new FakeLocalStorage();
    FakeLocalStorage.register(localStorage);
  });

  afterEach(() => {
    FakeLocalStorage.deregister(localStorage);
  });

  it('mounts without errors', () => {
    const wrapper = shallowMount(TopBar, {
      ...globalConfig,
      parentComponent: {
        methods: {
          getVisibilityState: () => true,
          setVisibilityState: () => {},
        },
      } as any,
      props: {
        playerView: fakePlayerViewModel(),
      },
    });
    expect(wrapper.exists()).to.be.true;
  });

  it('shows the given player, and the terraformed banner only on the viewer\'s own bar', () => {
    const red = fakePublicPlayerModel({color: 'red'});
    const blue = fakePublicPlayerModel({color: 'blue'});
    const spectatorView = {...fakePlayerViewModel({game: {isTerraformed: true}}), players: [red, blue], thisPlayer: undefined};
    const wrapper = shallowMount(TopBar, {
      ...globalConfig,
      props: {playerView: spectatorView, player: blue},
    });

    const info = wrapper.findComponent(PlayerInfo);
    expect(info.props('player').color).eq('blue');
    expect(wrapper.find('.top-bar-player-name').classes()).to.include('player_bg_color_blue');
    // Clicking the name opens the cards of the player at this index in PlayersOverview.
    expect(info.props('playerIndex')).eq(1);
    expect(wrapper.findComponent(TerraformedBanner).exists()).is.false;

    const own = shallowMount(TopBar, {
      ...globalConfig,
      props: {playerView: fakePlayerViewModel({game: {isTerraformed: true}})},
    });
    expect(own.findComponent(TerraformedBanner).exists()).is.true;
    expect(own.find('.top-bar-player-name').exists()).is.false;
  });

  it('collapses and expands when toggled', async () => {
    PreferencesManager.INSTANCE.set('hide_top_bar', false);
    const wrapper = shallowMount(TopBar, {
      ...globalConfig,
      props: {
        playerView: fakePlayerViewModel(),
      },
    });
    expect(wrapper.find('.top-bar').classes()).to.not.include('top-bar-collapsed');

    await wrapper.find('.top-bar-collapser').trigger('click');
    expect(wrapper.find('.top-bar').classes()).to.include('top-bar-collapsed');

    await wrapper.find('.top-bar-collapser').trigger('click');
    expect(wrapper.find('.top-bar').classes()).to.not.include('top-bar-collapsed');
  });
});
