import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {afterEach, vi} from 'vitest';
import {globalConfig} from '../getLocalVue';
import PlayerTimer from '@/client/components/overview/PlayerTimer.vue';
import {fakeTimerModel} from '../testHelpers';

describe('PlayerTimer', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('mounts without errors', () => {
    const wrapper = shallowMount(PlayerTimer, {
      ...globalConfig,
      props: {
        timer: fakeTimerModel(),
        live: false,
      },
    });
    expect(wrapper.exists()).to.be.true;
  });

  it('counts while live', async () => {
    vi.useFakeTimers({now: 0});
    const wrapper = shallowMount(PlayerTimer, {
      ...globalConfig,
      props: {
        timer: {...fakeTimerModel(), running: true, startedAt: 0},
        live: true,
      },
    });
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.player-timer-seconds').text()).eq('00');

    await vi.advanceTimersByTimeAsync(3000);

    expect(wrapper.find('.player-timer-seconds').text()).eq('03');
  });

  it('starts counting when the timer starts running', async () => {
    vi.useFakeTimers({now: 0});
    const wrapper = shallowMount(PlayerTimer, {
      ...globalConfig,
      props: {
        timer: fakeTimerModel(),
        live: true,
      },
    });
    await vi.advanceTimersByTimeAsync(5000);
    expect(wrapper.find('.player-timer-seconds').text()).eq('00');

    await wrapper.setProps({timer: {...fakeTimerModel(), running: true, startedAt: 5000}});
    await vi.advanceTimersByTimeAsync(3000);

    expect(wrapper.find('.player-timer-seconds').text()).eq('03');
  });

  it('shows the new timer when it changes', async () => {
    const wrapper = shallowMount(PlayerTimer, {
      ...globalConfig,
      props: {
        timer: fakeTimerModel(),
        live: false,
      },
    });

    await wrapper.setProps({timer: {...fakeTimerModel(), sumElapsed: 65_000}});

    expect(wrapper.find('.player-timer-minutes').text()).eq('01');
    expect(wrapper.find('.player-timer-seconds').text()).eq('05');
  });

  it('shows the time left of an allowance, and the time over it with a minus sign', async () => {
    const wrapper = shallowMount(PlayerTimer, {
      ...globalConfig,
      props: {
        timer: {...fakeTimerModel(), sumElapsed: 65_000},
        live: false,
        allowanceMs: 120_000,
      },
    });
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.player-timer-minutes').text()).eq('00');
    expect(wrapper.find('.player-timer-seconds').text()).eq('55');
    expect(wrapper.classes()).does.not.include('player-timer--over');

    await wrapper.setProps({allowanceMs: 60_000});

    expect(wrapper.find('.player-timer-minutes').text()).eq('-00');
    expect(wrapper.find('.player-timer-seconds').text()).eq('05');
    expect(wrapper.classes()).includes('player-timer--over');
  });

  it('counts the time left down while live', async () => {
    vi.useFakeTimers({now: 0});
    const wrapper = shallowMount(PlayerTimer, {
      ...globalConfig,
      props: {
        timer: {...fakeTimerModel(), running: true, startedAt: 0},
        live: true,
        allowanceMs: 10_000,
      },
    });
    await vi.advanceTimersByTimeAsync(3000);

    expect(wrapper.find('.player-timer-seconds').text()).eq('07');
  });
});
