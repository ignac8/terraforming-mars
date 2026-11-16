import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import PlayerStatus from '@/client/components/overview/PlayerStatus.vue';
import PlayerTimer from '@/client/components/overview/PlayerTimer.vue';
import {fakeTimerModel} from '../testHelpers';

describe('PlayerStatus', () => {
  it('mounts without errors', () => {
    const wrapper = shallowMount(PlayerStatus, {
      ...globalConfig,
      props: {
        timer: fakeTimerModel(),
        actionLabel: 'none',
        showTimer: false,
        liveTimer: false,
      },
    });
    expect(wrapper.exists()).to.be.true;
  });

  it('shows the time left before the Escape Velocity penalty next to the clock', () => {
    const wrapper = shallowMount(PlayerStatus, {
      ...globalConfig,
      props: {
        timer: fakeTimerModel(),
        actionLabel: 'none',
        showTimer: true,
        liveTimer: false,
        allowanceMs: 10_000,
      },
    });
    expect(wrapper.findAllComponents(PlayerTimer).map((timer) => timer.props('allowanceMs'))).deep.eq([undefined, 10_000]);
  });
});
