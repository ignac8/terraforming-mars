import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from './getLocalVue';
import GameBoardView from '@/client/components/GameBoardView.vue';
import MarsBotPanel from '@/client/components/automa/MarsBotPanel.vue';
import Milestones from '@/client/components/Milestones.vue';
import Awards from '@/client/components/Awards.vue';
import {MarsBotModel} from '@/common/models/MarsBotModel';
import {fakeGameModel, fakePublicPlayerModel} from './testHelpers';

describe('GameBoardView', () => {
  it('mounts without errors', () => {
    const wrapper = shallowMount(GameBoardView, {
      ...globalConfig,
      props: {
        game: fakeGameModel(),
        tileView: 'show',
        players: [],
      },
    });
    expect(wrapper.exists()).to.be.true;
  });

  it('does not render MarsBotPanel when game.marsBot is undefined', () => {
    const wrapper = shallowMount(GameBoardView, {
      ...globalConfig,
      props: {
        game: fakeGameModel(),
        tileView: 'show',
        players: [fakePublicPlayerModel(), fakePublicPlayerModel()],
      },
    });
    expect(wrapper.findComponent(MarsBotPanel).exists()).to.be.false;
    expect(wrapper.findComponent(Milestones).props('isAutoma')).to.be.false;
    expect(wrapper.findComponent(Awards).props('isAutoma')).to.be.false;
  });

  it('renders MarsBotPanel and flags isAutoma when game.marsBot is set', () => {
    const wrapper = shallowMount(GameBoardView, {
      ...globalConfig,
      props: {
        game: fakeGameModel({marsBot: {} as MarsBotModel}),
        tileView: 'show',
        players: [],
      },
    });
    expect(wrapper.findComponent(MarsBotPanel).exists()).to.be.true;
    expect(wrapper.findComponent(Milestones).props('isAutoma')).to.be.true;
    expect(wrapper.findComponent(Awards).props('isAutoma')).to.be.true;
  });
});
