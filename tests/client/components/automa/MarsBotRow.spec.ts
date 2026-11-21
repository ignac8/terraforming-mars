import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import MarsBotRow from '@/client/components/automa/MarsBotRow.vue';
import {MarsBotModel, MarsBotVPModel} from '@/common/models/MarsBotModel';
import {CardName} from '@/common/cards/CardName';

function fakeMarsBot(overrides: Partial<MarsBotModel> = {}): MarsBotModel {
  return {
    name: 'MarsBot',
    color: 'bronze',
    difficulty: 'normal',
    tracks: [
      {tags: ['power', 'jovian'], productions: ['energy'], position: 7},
      {tags: ['venus'], productions: [], position: 8},
    ],
    megacredits: 31,
    mcPerVP: 8,
    actionDeckSize: 9,
    bonusDeckSize: 7,
    instantWin: false,
    corpName: CardName.SAGITTA_FRONTIER_SERVICES,
    vpBreakdown: {terraformRating: 29, total: 32} as Partial<MarsBotVPModel> as MarsBotVPModel,
    vpByGeneration: [],
    ...overrides,
  } as Partial<MarsBotModel> as MarsBotModel;
}

function mount(model: MarsBotModel) {
  return shallowMount(MarsBotRow, {...globalConfig, props: {model}});
}

describe('MarsBotRow', () => {
  it('uses MarsBot\'s player colour', () => {
    const classes = mount(fakeMarsBot()).classes();
    expect(classes).to.include('player-info');
    expect(classes).to.include('player-translucent-bg-color-bronze');
  });

  it('shows every tag of a track over one position', () => {
    const boxes = mount(fakeMarsBot()).findAll('.marsbot-track-box');
    expect(boxes).to.have.length(2);
    expect(boxes[0].findAll('.tag-count')).to.have.length(2);
    expect(boxes[0].find('.tag-power').exists()).to.be.true;
    expect(boxes[0].find('.tag-jovian').exists()).to.be.true;
    expect(boxes[0].find('.tag-count-display').text()).eq('7');
    expect(boxes[1].findAll('.tag-count')).to.have.length(1);
    expect(boxes[1].find('.tag-venus').exists()).to.be.true;
    expect(boxes[1].find('.tag-count-display').text()).eq('8');
  });

  it('shows M€, M€ per VP, decks, VP and TR', () => {
    const wrapper = mount(fakeMarsBot());
    const mc = wrapper.find('.resource-item--megacredits');
    expect(mc.find('.resource-item-stock-count').text()).eq('31');
    expect(mc.find('.resource-item-prod-count').text()).eq('8/VP');
    expect(wrapper.findAll('.marsbot-deck .resource-item-stock-count').map((d) => d.text())).deep.eq(['9', '7']);
    expect(wrapper.find('.tag-vp + .tag-count-display').text()).eq('32');
    expect(wrapper.find('.tag-tr + .tag-count-display').text()).eq('29');
  });

  it('has no corporation line before MarsBot picks one', () => {
    const wrapper = mount(fakeMarsBot({corpName: undefined}));
    expect(wrapper.find('.player-info-name').text()).eq('MarsBot');
    expect(wrapper.find('.player-info-corp').exists()).to.be.false;
  });

  it('leaves the production slot empty without M€ per VP', () => {
    const wrapper = mount(fakeMarsBot({mcPerVP: undefined}));
    expect(wrapper.find('.resource-item--megacredits .resource-item-prod-count').text()).eq('');
  });
});
