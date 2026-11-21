import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import MarsBotPanel from '@/client/components/automa/MarsBotPanel.vue';
import {MarsBotModel, MarsBotTrackModel, MarsBotVPModel} from '@/common/models/MarsBotModel';
import {Tag} from '@/common/cards/Tag';

function fakeMarsBot(overrides: Partial<MarsBotModel> = {}): MarsBotModel {
  return {
    name: 'MarsBot',
    color: 'bronze',
    difficulty: 'normal',
    tracks: [],
    megacredits: 0,
    actionDeckSize: 0,
    bonusDeckSize: 0,
    instantWin: false,
    vpBreakdown: {
      terraformRating: 20,
      corpVP: 0,
      total: 20,
    } as Partial<MarsBotVPModel> as MarsBotVPModel,
    vpByGeneration: [],
    ...overrides,
  } as Partial<MarsBotModel> as MarsBotModel;
}

function withLayout(layout: MarsBotTrackModel['layout']): MarsBotModel {
  return fakeMarsBot({tracks: [{tags: [Tag.SCIENCE], productions: [], position: 0, layout}]});
}

function mount(model: MarsBotModel) {
  return shallowMount(MarsBotPanel, {...globalConfig, props: {model}});
}

function iconKinds(model: MarsBotModel): Array<string> {
  return mount(model).findAll('.marsbot-action-icon')
    .map((icon) => icon.classes().find((c) => c.startsWith('marsbot-action-icon--'))?.slice('marsbot-action-icon--'.length) ?? '');
}

describe('MarsBotPanel', () => {
  it('shows the VP its corporation adds', () => {
    const model = fakeMarsBot({vpBreakdown: {terraformRating: 20, corpVP: 6, total: 26} as Partial<MarsBotVPModel> as MarsBotVPModel});
    const sources = mount(model).findAll('.marsbot-vp-source').map((source) => source.text());
    expect(sources).to.include('Corporation 6');
  });

  it('shows no corporation VP when it adds none', () => {
    const sources = mount(fakeMarsBot()).findAll('.marsbot-vp-source').map((source) => source.text());
    expect(sources.some((source) => source.startsWith('Corporation'))).to.be.false;
  });

  it('tells the Science and Space advances apart', () => {
    expect(iconKinds(withLayout([undefined, 'tag_science', 'tag_space']))).deep.eq(['tag-science', 'tag-space']);
  });

  it('marks TR steps and two-step actions with a number', () => {
    const model = withLayout([undefined, 'tr3', 'temperature2']);
    expect(iconKinds(model)).deep.eq(['tr', 'temperature']);
    expect(mount(model).findAll('.marsbot-action-count').map((count) => count.text())).deep.eq(['3', '2']);
  });

  it('keeps the instant-win banner and shipping board', () => {
    const wrapper = mount(fakeMarsBot({instantWin: true, shippingBoard: {Luna: 2}}));
    expect(wrapper.find('.marsbot-instant-win').exists()).to.be.true;
    expect(wrapper.find('.marsbot-shipping-board').text()).to.include('Luna: 2');
  });

  it('falls back to 18 squares without a layout', () => {
    expect(mount(withLayout(undefined)).findAll('.marsbot-square')).to.have.length(18);
  });
});
