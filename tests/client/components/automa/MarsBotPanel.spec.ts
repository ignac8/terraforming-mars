import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import MarsBotPanel from '@/client/components/automa/MarsBotPanel.vue';
import {MarsBotModel, MarsBotVPModel} from '@/common/models/MarsBotModel';

function fakeMarsBot(corpVP: number): MarsBotModel {
  return {
    name: 'MarsBot',
    color: 'neutral',
    difficulty: 'normal',
    tracks: [],
    megacredits: 0,
    actionDeckSize: 0,
    bonusDeckSize: 0,
    instantWin: false,
    vpBreakdown: {
      terraformRating: 20,
      corpVP,
      total: 20 + corpVP,
    } as Partial<MarsBotVPModel> as MarsBotVPModel,
    vpByGeneration: [],
  } as Partial<MarsBotModel> as MarsBotModel;
}

describe('MarsBotPanel', () => {
  it('shows the VP its corporation adds', () => {
    const wrapper = shallowMount(MarsBotPanel, {
      ...globalConfig,
      props: {model: fakeMarsBot(6)},
    });
    const stats = wrapper.findAll('.marsbot-stat').map((stat) => stat.text());
    expect(stats).to.include('Corporation: 6');
  });

  it('shows no corporation VP when it adds none', () => {
    const wrapper = shallowMount(MarsBotPanel, {
      ...globalConfig,
      props: {model: fakeMarsBot(0)},
    });
    const stats = wrapper.findAll('.marsbot-stat').map((stat) => stat.text());
    expect(stats.some((stat) => stat.startsWith('Corporation'))).to.be.false;
  });

  it('labels the Science and Space track icons differently', () => {
    const model = {
      ...fakeMarsBot(0),
      tracks: [{tags: [], productions: [], position: 0, layout: [undefined, 'tag_science', 'tag_space']}],
    } as Partial<MarsBotModel> as MarsBotModel;
    const wrapper = shallowMount(MarsBotPanel, {
      ...globalConfig,
      props: {model},
    });
    const icons = wrapper.findAll('.marsbot-action-icon').map((icon) => icon.text());
    expect(icons).deep.eq(['+Sc', '+S']);
  });
});
