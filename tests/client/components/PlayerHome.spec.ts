import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from './getLocalVue';
import PlayerHome from '@/client/components/PlayerHome.vue';
import CardSortButtons from '@/client/components/CardSortButtons.vue';
import SortableCards from '@/client/components/SortableCards.vue';
import WaitingFor from '@/client/components/WaitingFor.vue';
import PlayerSetupView from '@/client/components/PlayerSetupView.vue';
import {fakePlayerViewModel, fakePublicPlayerModel} from './testHelpers';
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
    function mountHome(playerView: ReturnType<typeof fakePlayerViewModel>, replay?: boolean) {
      return shallowMount(PlayerHome, {
        ...globalConfig,
        parentComponent: {
          methods: {
            getVisibilityState: () => true,
            setVisibilityState: () => {},
          },
        } as any,
        props: {playerView, replay, settings: raw_settings},
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

    it('tells the setup view not to render WaitingFor when replaying', () => {
      const wrapper = mountHome(fakePlayerViewModel(), true);
      expect(wrapper.findComponent(PlayerSetupView).props('replay')).is.true;
    });
  });
});
