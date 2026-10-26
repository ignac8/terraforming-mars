import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import {asComplete} from '../utils/models';
import JudgePendingChoice from '@/client/components/judge/JudgePendingChoice.vue';
import {CardName} from '@/common/cards/CardName';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {PlayerInputModel, SelectCardModel} from '@/common/models/PlayerInputModel';

function cardInput(title: string, ...names: Array<CardName>): SelectCardModel {
  return asComplete<SelectCardModel>({
    type: 'card',
    title,
    cards: names.map((name) => ({name})),
  });
}

function mountInput(input: PlayerInputModel, shown: Array<CardName> = []) {
  return mount(JudgePendingChoice, {...globalConfig, props: {input, shown}});
}

describe('JudgePendingChoice', () => {
  it('shows the cards of a card input', () => {
    const wrapper = mountInput(cardInput('Select a card', CardName.ANTS, CardName.BIRDS));

    expect(wrapper.text()).to.include('Select a card');
    expect(wrapper.findAllComponents({name: 'Card'})).has.length(2);
    expect(wrapper.text()).to.include(CardName.ANTS);
    expect(wrapper.text()).to.include(CardName.BIRDS);
  });

  it('puts each card in a cardbox so the cards lay out side by side', () => {
    const wrapper = mountInput(cardInput('Select a card', CardName.ANTS, CardName.BIRDS));

    const boxes = wrapper.findAll('.cardbox');
    expect(boxes).has.length(2);
    for (const box of boxes) {
      expect(box.findAllComponents({name: 'Card'})).has.length(1);
    }
  });

  it('shows the title of the choice and the cards of every option, but not the options themselves', () => {
    const wrapper = mountInput(asComplete<PlayerInputModel>({
      type: 'or',
      title: 'Take your first action',
      options: [
        cardInput('Play project card', CardName.ANTS),
        {type: 'option', title: 'Pass for this generation'},
        asComplete<PlayerInputModel>({type: 'and', title: 'Choose both', options: [cardInput('First pick', CardName.BIRDS)]}),
      ],
    }));

    expect(wrapper.find('.judge-pending-choice-title').text()).eq('Take your first action');
    expect(wrapper.text()).to.not.include('Play project card');
    expect(wrapper.text()).to.not.include('Pass for this generation');
    expect(wrapper.text()).to.not.include('First pick');
    expect(wrapper.findAllComponents({name: 'Card'})).has.length(2);
  });

  it('leaves out the cards the judge already sees, and the standard projects', () => {
    const wrapper = mountInput(asComplete<PlayerInputModel>({
      type: 'or',
      title: 'Take your first action',
      options: [
        cardInput('Play project card', CardName.ANTS),
        cardInput('Standard projects', CardName.POWER_PLANT_STANDARD_PROJECT, CardName.ASTEROID_STANDARD_PROJECT),
        cardInput('Perform an action from a played card', CardName.BIRDS),
      ],
    }), [CardName.ANTS, CardName.BIRDS]);

    expect(wrapper.text()).to.include('Take your first action');
    expect(wrapper.findAllComponents({name: 'Card'})).has.length(0);
    expect(wrapper.find('.judge-pending-choice-cards').exists()).is.false;
  });

  it('shows a draft hand, which the judge sees nowhere else', () => {
    const wrapper = mountInput(cardInput('Select a card to keep and pass the rest', CardName.ANTS, CardName.BIRDS, CardName.COMET), [CardName.ECOLINE]);

    expect(wrapper.findAllComponents({name: 'Card'})).has.length(3);
  });

  it('shows a card once when several options offer it', () => {
    const wrapper = mountInput(asComplete<PlayerInputModel>({
      type: 'or',
      title: 'Take action',
      options: [cardInput('First', CardName.ANTS), cardInput('Second', CardName.ANTS)],
    }));

    expect(wrapper.findAllComponents({name: 'Card'})).has.length(1);
  });

  it('shows only the title when the input has no cards', () => {
    const wrapper = mountInput(asComplete<PlayerInputModel>({type: 'option', title: 'Pass'}));

    expect(wrapper.text()).eq('Pass');
    expect(wrapper.findAllComponents({name: 'Card'})).has.length(0);
  });

  it('renders a Message title as text', () => {
    const wrapper = mountInput(asComplete<PlayerInputModel>({
      type: 'option',
      title: {
        message: 'Select a place for ${0}',
        data: [{type: LogMessageDataType.RAW_STRING, value: 'Greenery'}],
      },
    }));

    expect(wrapper.text()).eq('Select a place for Greenery');
  });

  it('renders no buttons or inputs', () => {
    const wrapper = mountInput(asComplete<PlayerInputModel>({
      type: 'or',
      title: 'Take action',
      buttonLabel: 'Save',
      options: [
        cardInput('Play a project card', CardName.ANTS),
        {type: 'option', title: 'Pass', buttonLabel: 'Pass'},
      ],
    }));

    expect(wrapper.find('button').exists()).is.false;
    expect(wrapper.find('input').exists()).is.false;
  });
});
