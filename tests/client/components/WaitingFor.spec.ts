import {flushPromises, shallowMount} from '@vue/test-utils';
import {globalConfig} from './getLocalVue';
import {expect} from 'chai';
import WaitingFor from '@/client/components/WaitingFor.vue';
import {RecursivePartial} from '@/common/utils/utils';
import {PlayerViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {Phase} from '@/common/Phase';
import {STALE_VIEW} from '@/common/app/AppErrorId';

describe('WaitingFor', () => {
  const thisPlayer: Partial<PublicPlayerModel> = {
    color: 'red',
  } as any;

  const playerView: RecursivePartial<PlayerViewModel> = {
    id: 'p-player-id',
    thisPlayer: thisPlayer as PublicPlayerModel,
    players: [thisPlayer as PublicPlayerModel],
    game: {
      phase: Phase.ACTION,
      gameAge: 1,
      undoCount: 0,
    },
  };

  it('renders player-input-factory when waitingfor is provided', () => {
    const wrapper = shallowMount(WaitingFor, {
      ...globalConfig,
      global: {
        ...globalConfig.global,
        stubs: {
          'PlayerInputFactory': {template: '<div class="stub-pif"></div>'},
        },
      },
      props: {
        playerView: playerView as PlayerViewModel,
        players: [thisPlayer as PublicPlayerModel],
        waitingfor: {
          type: 'option',
          title: 'test',
          buttonLabel: 'save',
        },
      },
    });
    expect(wrapper.find('.stub-pif').exists()).to.be.true;
    expect(wrapper.text()).to.not.include('Not your turn');
  });

  it('shows "not your turn" when waitingfor is undefined', () => {
    const wrapper = shallowMount(WaitingFor, {
      ...globalConfig,
      global: {
        ...globalConfig.global,
        stubs: {
          'PlayerInputFactory': true,
        },
      },
      props: {
        playerView: playerView as PlayerViewModel,
        players: [thisPlayer as PublicPlayerModel],
        waitingfor: undefined,
      },
    });
    expect(wrapper.text()).to.include('Not your turn');
  });

  type Alert = {title: string, message: string};

  // Mounts WaitingFor with the root hooks `fetchPlayerInput` reaches for, and a
  // fetch stub. Alerts are dismissed immediately, as if the player clicked OK.
  function mountForSubmit(fetchResult: () => Promise<unknown>) {
    const wrapper = shallowMount(WaitingFor, {
      ...globalConfig,
      global: {
        ...globalConfig.global,
        stubs: {
          'PlayerInputFactory': true,
        },
      },
      props: {
        playerView: playerView as PlayerViewModel,
        players: [thisPlayer as PublicPlayerModel],
        waitingfor: {
          type: 'option',
          title: 'test',
          buttonLabel: 'save',
        },
      },
    });
    const alerts: Array<Alert> = [];
    let refreshes = 0;
    const root = wrapper.vm.$root as any;
    root.isServerSideRequestInProgress = false;
    root.showAlert = (title: string, message: string, cb: () => void = () => {}) => {
      alerts.push({title, message});
      cb();
    };
    root.updatePlayer = () => refreshes++;
    const originalFetch = global.fetch;
    global.fetch = fetchResult as unknown as typeof global.fetch;
    const submit = async () => {
      try {
        (wrapper.vm as any).onsave({type: 'option'});
        await flushPromises();
      } finally {
        global.fetch = originalFetch;
      }
      return {alerts, refreshes};
    };
    return submit;
  }

  it('refreshes the player view when the server reports a stale view', async () => {
    const submit = mountForSubmit(() => Promise.resolve({
      ok: false,
      status: 400,
      json: () => Promise.resolve({id: STALE_VIEW, message: 'stale'}),
    }));
    const {alerts, refreshes} = await submit();
    expect(alerts).deep.eq([{title: 'Error with input', message: 'stale'}]);
    expect(refreshes).eq(1);
  });

  it('refreshes the player view when the submission never gets an answer', async () => {
    const submit = mountForSubmit(() => Promise.reject(new Error('connection reset')));
    const {alerts, refreshes} = await submit();
    expect(alerts).has.length(1);
    expect(refreshes).eq(1);
  });

  it('keeps the current view on an ordinary input error', async () => {
    const submit = mountForSubmit(() => Promise.resolve({
      ok: false,
      status: 400,
      json: () => Promise.resolve({id: undefined, message: 'Not enough cards selected'}),
    }));
    const {alerts, refreshes} = await submit();
    expect(alerts).deep.eq([{title: 'Error with input', message: 'Not enough cards selected'}]);
    expect(refreshes).eq(0);
  });
});
