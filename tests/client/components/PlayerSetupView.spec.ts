import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from './getLocalVue';
import PlayerSetupView from '@/client/components/PlayerSetupView.vue';
import Milestones from '@/client/components/Milestones.vue';
import Awards from '@/client/components/Awards.vue';
import {MarsBotModel} from '@/common/models/MarsBotModel';
import {fakeGameModel, fakePlayerViewModel} from './testHelpers';

describe('PlayerSetupView', () => {
  it('mounts without errors', () => {
    const wrapper = shallowMount(PlayerSetupView, {
      ...globalConfig,
      props: {
        playerView: fakePlayerViewModel(),
        tileView: 'show',
      },
    });
    expect(wrapper.exists()).to.be.true;
  });

  it('shows milestones and awards in a MarsBot game', () => {
    const wrapper = shallowMount(PlayerSetupView, {
      ...globalConfig,
      props: {
        playerView: fakePlayerViewModel({game: fakeGameModel({marsBot: {} as MarsBotModel})}),
        tileView: 'show',
      },
    });
    expect(wrapper.findComponent(Milestones).props('isAutoma')).to.be.true;
    expect(wrapper.findComponent(Awards).props('isAutoma')).to.be.true;
  });
});
