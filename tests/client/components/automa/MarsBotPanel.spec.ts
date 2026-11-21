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

  it('leaves the empty squares of a layout sent as JSON blank', () => {
    // JSON turns the layout's empty squares into null.
    const layout = JSON.parse(JSON.stringify([undefined, undefined, 'ocean']));
    expect(iconKinds(withLayout(layout))).deep.eq(['ocean']);
    expect(mount(withLayout(layout)).findAll('.has-action')).to.have.length(1);
  });

  it('turns an advance of a track by index into that track\'s tag', () => {
    expect(iconKinds(withLayout([undefined, 'tag_0']))).deep.eq(['tag-science']);
  });

  it('shows a plain advance for a track index MarsBot does not have', () => {
    const model = withLayout([undefined, 'tag_5']);
    expect(iconKinds(model)).deep.eq(['advance']);
    expect(mount(model).find('.marsbot-action-icon').text()).eq('»');
  });

  it('writes the milestone, award and advance squares as text', () => {
    const icons = mount(withLayout([undefined, 'milestone', 'award', 'advance'])).findAll('.marsbot-action-icon');
    expect(icons.map((icon) => icon.text())).deep.eq(['M', 'A', '»']);
  });

  it('labels each track with its tags and productions', () => {
    const wrapper = mount(fakeMarsBot({tracks: [{tags: [Tag.POWER, Tag.JOVIAN], productions: ['energy'], position: 0}]}));
    expect(wrapper.findAll('.marsbot-tag').map((tag) => tag.classes())).deep.eq([
      ['marsbot-tag', 'tooltip', 'tooltip-bottom', 'tag-power'],
      ['marsbot-tag', 'tooltip', 'tooltip-bottom', 'tag-jovian'],
    ]);
    expect(wrapper.find('.marsbot-prod').classes()).to.include('marsbot-prod--energy');
  });

  it('marks the squares holding cubes and actions', () => {
    const model = withLayout([undefined, undefined, 'ocean', undefined]);
    const squares = mount({...model, trackCubes: [{trackIndex: 0, position: 1, cubeType: 'white'}, {trackIndex: 0, position: 3, cubeType: 'credit'}]}).findAll('.marsbot-square');
    expect(squares.map((square) => square.classes().filter((c) => c !== 'marsbot-square'))).deep.eq([
      ['cube-white'],
      ['has-action'],
      ['cube-credit'],
    ]);
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
