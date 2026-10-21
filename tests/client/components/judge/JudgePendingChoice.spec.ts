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

function mountInput(input: PlayerInputModel) {
  return mount(JudgePendingChoice, {...globalConfig, props: {input}});
}

describe('JudgePendingChoice', () => {
  it('shows the cards of a card input', () => {
    const wrapper = mountInput(cardInput('Select a card', CardName.ANTS, CardName.BIRDS));

    expect(wrapper.text()).to.include('Select a card');
    expect(wrapper.findAllComponents({name: 'Card'})).has.length(2);
    expect(wrapper.text()).to.include(CardName.ANTS);
    expect(wrapper.text()).to.include(CardName.BIRDS);
  });

  it('shows the cards inside a nested setup choice', () => {
    const wrapper = mountInput(asComplete<PlayerInputModel>({
      type: 'initialCards',
      title: 'Select initial cards',
      options: [
        cardInput('Select corporation', CardName.ECOLINE),
        cardInput('Select project cards', CardName.ANTS),
      ],
    }));

    expect(wrapper.text()).to.include('Select initial cards');
    expect(wrapper.text()).to.include('Select corporation');
    expect(wrapper.text()).to.include('Select project cards');
    expect(wrapper.text()).to.include(CardName.ANTS);
    expect(wrapper.find('.card-ecoline').exists()).is.true;
    expect(wrapper.find('button').exists()).is.false;
  });

  it('lists the title of every option of an or input and the cards of those that have them', () => {
    const wrapper = mountInput(asComplete<PlayerInputModel>({
      type: 'or',
      title: 'Take action',
      options: [
        cardInput('Play a project card', CardName.ANTS),
        {type: 'option', title: 'Pass for this generation'},
        {type: 'option', title: 'Do nothing'},
      ],
    }));

    expect(wrapper.text()).to.include('Take action');
    expect(wrapper.text()).to.include('Play a project card');
    expect(wrapper.text()).to.include('Pass for this generation');
    expect(wrapper.text()).to.include('Do nothing');
    expect(wrapper.findAllComponents({name: 'Card'})).has.length(1);
  });

  it('shows every part of an and input', () => {
    const wrapper = mountInput(asComplete<PlayerInputModel>({
      type: 'and',
      title: 'Choose both',
      options: [
        cardInput('First pick', CardName.ANTS),
        cardInput('Second pick', CardName.BIRDS),
      ],
    }));

    expect(wrapper.text()).to.include('Choose both');
    expect(wrapper.text()).to.include('First pick');
    expect(wrapper.text()).to.include('Second pick');
    expect(wrapper.findAllComponents({name: 'Card'})).has.length(2);
  });

  it('shows the cards of a projectCard input', () => {
    const wrapper = mountInput(asComplete<PlayerInputModel>({
      type: 'projectCard',
      title: 'Play project card',
      cards: [{name: CardName.ANTS}],
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
