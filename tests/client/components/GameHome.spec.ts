import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from './getLocalVue';
import GameHome from '@/client/components/GameHome.vue';
import {fakeGameOptionsModel} from './testHelpers';
import {Phase} from '@/common/Phase';
import {SimpleGameModel} from '@/common/models/SimpleGameModel';
import {asComplete} from './utils/models';

function mountGameHome(overrides: Partial<SimpleGameModel> = {}) {
  return shallowMount(GameHome, {
    ...globalConfig,
    props: {
      game: asComplete<SimpleGameModel>({
        activePlayer: 'blue',
        id: 'game-id-123',
        phase: Phase.ACTION,
        players: [{color: 'blue', id: 'p-blue', name: 'Blue'}],
        spectatorId: 'spectator-id-123',
        gameOptions: fakeGameOptionsModel(),
        lastSoloGeneration: 14,
        expectedPurgeTimeMs: 0,
        ...overrides,
      }),
    },
  });
}

describe('GameHome', () => {
  it('mounts without errors', () => {
    const wrapper = mountGameHome();
    expect(wrapper.exists()).to.be.true;
  });

  it('links to the judge page when the game has a judge id', () => {
    const wrapper = mountGameHome({judgeId: 'j1'});
    expect(wrapper.find('a[href="judge?id=j1"]').exists()).is.true;
  });

  it('shows no judge link when the game has no judge id', () => {
    const wrapper = mountGameHome();
    expect(wrapper.find('a[href^="judge"]').exists()).is.false;
  });
});
