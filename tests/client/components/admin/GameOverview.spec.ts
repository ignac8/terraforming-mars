import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import GameOverview from '@/client/components/admin/GameOverview.vue';
import {SimpleGameModel} from '@/common/models/SimpleGameModel';
import {asComplete} from '../utils/models';

describe('GameOverview', () => {
  it('mounts without errors', () => {
    const wrapper = shallowMount(GameOverview, {
      ...globalConfig,
      props: {
        status: 'loading',
        game: asComplete<SimpleGameModel>({}),
        id: 'game-123',
      },
    });
    expect(wrapper.exists()).to.be.true;
  });

  it('shows a player without a link when the game leaves out their id', () => {
    const wrapper = shallowMount(GameOverview, {
      ...globalConfig,
      props: {
        status: 'done',
        game: asComplete<SimpleGameModel>({players: [{color: 'blue', name: 'Blue'}], spectatorId: 'spectator-id-123'}),
        id: 'game-123',
      },
    });

    const name = wrapper.find('.player-name');
    expect(name.text()).eq('Blue');
    expect(name.find('a').exists()).is.false;
  });
});
