import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from './getLocalVue';
import GameEnd from '@/client/components/GameEnd.vue';
import {fakeGameModel, fakePlayerViewModel} from './testHelpers';
import {MarsBotModel} from '@/common/models/MarsBotModel';

function fakeMarsBot(total: number): MarsBotModel {
  return {
    name: 'MarsBot',
    color: 'neutral',
    difficulty: 'normal',
    megacredits: 0,
    instantWin: false,
    vpBreakdown: {
      terraformRating: total,
      milestones: 0,
      awards: 0,
      greenery: 0,
      cityAdjacentGreenery: 0,
      neuralInstance: 0,
      mcToVP: 0,
      cardVP: 0,
      vermin: 0,
      turmoilVP: 0,
      total,
      detailsMilestones: [],
      detailsAwards: [],
    },
    vpByGeneration: [],
  } as Partial<MarsBotModel> as MarsBotModel;
}

describe('GameEnd', () => {
  it('mounts without errors', () => {
    const wrapper = shallowMount(GameEnd, {
      ...globalConfig,
      props: {
        participant: fakePlayerViewModel(),
      },
    });
    expect(wrapper.exists()).to.be.true;
  });

  it('shows the human beating MarsBot with both scores', () => {
    const wrapper = shallowMount(GameEnd, {
      ...globalConfig,
      props: {
        participant: fakePlayerViewModel({game: fakeGameModel({marsBot: fakeMarsBot(15)})}),
      },
    });
    const text = wrapper.find('.game_end_success').text();
    expect(text).to.include('You beat MarsBot!');
    expect(text).to.include('(20 vs 15)');
  });

  it('gives a tie to MarsBot', () => {
    const wrapper = shallowMount(GameEnd, {
      ...globalConfig,
      props: {
        participant: fakePlayerViewModel({game: fakeGameModel({marsBot: fakeMarsBot(20)})}),
      },
    });
    const text = wrapper.find('.game_end_fail').text();
    expect(text).to.include('MarsBot wins!');
    expect(text).to.include('(20 vs 20)');
    expect(text).to.include('Tie goes to MarsBot!');
  });
});
