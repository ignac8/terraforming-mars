import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from './getLocalVue';
import PurgeWarning from '@/client/components/common/PurgeWarning.vue';
import PlayerHome from '@/client/components/PlayerHome.vue';
import CardSortButtons from '@/client/components/CardSortButtons.vue';
import SortableCards from '@/client/components/SortableCards.vue';
import WaitingFor from '@/client/components/WaitingFor.vue';
import PlayerSetupView from '@/client/components/PlayerSetupView.vue';
import LogPanel from '@/client/components/logpanel/LogPanel.vue';
import {fakePlayerViewModel, fakePublicPlayerModel, fakeViewModel} from './testHelpers';
import {FakeLocalStorage} from './FakeLocalStorage';
import {CardName} from '@/common/cards/CardName';
import raw_settings from '@/genfiles/settings.json';

describe('PlayerHome', () => {
  let localStorage: FakeLocalStorage;

  beforeEach(() => {
    localStorage = new FakeLocalStorage();
    FakeLocalStorage.register(localStorage);
  });

  afterEach(() => {
    FakeLocalStorage.deregister(localStorage);
  });

  it('mounts without errors', () => {
    const wrapper = shallowMount(PlayerHome, {
      ...globalConfig,
      parentComponent: {
        methods: {
          getVisibilityState: () => true,
          setVisibilityState: () => {},
        },
      } as any,
      props: {
        playerView: fakePlayerViewModel(),
        settings: raw_settings,
      },
    });
    expect(wrapper.exists()).to.be.true;
  });

  it('sort buttons sort the hand', async () => {
    // The hand only renders once the player has a tableau.
    const thisPlayer = fakePublicPlayerModel({tableau: [{name: CardName.ECOLINE}]});
    const playerView = fakePlayerViewModel({thisPlayer, players: [thisPlayer], cardsInHand: [{name: CardName.ANTS}]});
    const wrapper = shallowMount(PlayerHome, {
      ...globalConfig,
      parentComponent: {
        methods: {
          getVisibilityState: () => true,
          setVisibilityState: () => {},
        },
      } as any,
      props: {
        playerView,
        settings: raw_settings,
      },
    });

    wrapper.findComponent(CardSortButtons).vm.$emit('update:sortOrder', {key: 'vp', reversed: false});
    await wrapper.vm.$nextTick();

    expect(wrapper.findComponent(SortableCards).props('sortOrder')).to.deep.eq({key: 'vp', reversed: false});
  });

  describe('replay', () => {
    function mountHome(playerView: ReturnType<typeof fakePlayerViewModel>, replay?: boolean, extra: Record<string, unknown> = {}) {
      return shallowMount(PlayerHome, {
        ...globalConfig,
        parentComponent: {
          methods: {
            getVisibilityState: () => true,
            setVisibilityState: () => {},
          },
        } as any,
        props: {playerView, replay, settings: raw_settings, ...extra},
      });
    }

    function playedView() {
      const thisPlayer = fakePublicPlayerModel({tableau: [{name: CardName.ECOLINE}]});
      return fakePlayerViewModel({thisPlayer, players: [thisPlayer]});
    }

    it('renders WaitingFor by default', () => {
      expect(mountHome(playedView()).findComponent(WaitingFor).exists()).is.true;
    });

    it('renders no WaitingFor when replaying', () => {
      expect(mountHome(playedView(), true).findComponent(WaitingFor).exists()).is.false;
    });

    it('shows the purge warning only outside a replay', () => {
      expect(mountHome(playedView()).findComponent(PurgeWarning).exists()).is.true;
      expect(mountHome(playedView(), true).findComponent(PurgeWarning).exists()).is.false;
    });

    it('shows no log when replaying, unless it is given the live log to show', () => {
      expect(mountHome(playedView(), true).findComponent(LogPanel).exists()).is.false;

      const log = fakeViewModel({id: 'j-judge-id' as any});
      const panel = mountHome(playedView(), true, {log, showUndone: true}).findComponent(LogPanel);
      expect(panel.props('viewModel')).to.deep.equal(log);
      expect(panel.props('showUndone')).is.true;
    });

    it('logs as its own player outside a replay', () => {
      const playerView = playedView();
      expect(mountHome(playerView).findComponent(LogPanel).props('viewModel')).to.deep.equal(playerView);
    });

    it('tells the setup view not to render WaitingFor when replaying', () => {
      const wrapper = mountHome(fakePlayerViewModel(), true);
      expect(wrapper.findComponent(PlayerSetupView).props('replay')).is.true;
    });
  });
});
