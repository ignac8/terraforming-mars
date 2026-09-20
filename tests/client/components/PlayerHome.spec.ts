import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from './getLocalVue';
import PlayerHome from '@/client/components/PlayerHome.vue';
import {fakePlayerViewModel} from './testHelpers';
import {FakeLocalStorage} from './FakeLocalStorage';
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

  function mount() {
    return shallowMount(PlayerHome, {
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
  }

  it('mounts without errors', () => {
    const wrapper = mount();
    expect(wrapper.exists()).to.be.true;
  });

  it('uses the device width viewport while mounted', () => {
    const viewport = document.createElement('meta');
    viewport.setAttribute('name', 'viewport');
    viewport.setAttribute('content', 'width=1260, user-scalable=1');
    document.head.appendChild(viewport);
    try {
      const wrapper = mount();
      expect(viewport.getAttribute('content')).to.eq('width=device-width, initial-scale=1, viewport-fit=cover');
      wrapper.unmount();
      expect(viewport.getAttribute('content')).to.eq('width=1260, user-scalable=1');
    } finally {
      viewport.remove();
    }
  });
});
