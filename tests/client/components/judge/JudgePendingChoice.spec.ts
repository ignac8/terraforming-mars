import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import {asComplete} from '../utils/models';
import JudgePendingChoice from '@/client/components/judge/JudgePendingChoice.vue';
import {CardName} from '@/common/cards/CardName';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {pendingChoiceOf} from '@/common/models/PendingChoiceModel';
import {PlayerInputModel, SelectCardModel} from '@/common/models/PlayerInputModel';

function cardInput(title: string, ...names: Array<CardName>): SelectCardModel {
  return asComplete<SelectCardModel>({
    type: 'card',
    title,
    cards: names.map((name) => ({name})),
  });
}

function mountInput(input: PlayerInputModel | undefined, shown: Array<CardName> = []) {
  return mount(JudgePendingChoice, {...globalConfig, props: {choice: input && pendingChoiceOf(input), shown}});
}

describe('JudgePendingChoice', () => {
  it('shows the cards of a card input under a heading', () => {
    const wrapper = mountInput(cardInput('Select a card', CardName.ANTS, CardName.BIRDS));

    expect(wrapper.find('h3').text()).eq('Pending choice');
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

  it('shows nothing when every card is one the viewer already sees, or a standard project', () => {
    const wrapper = mountInput(asComplete<PlayerInputModel>({
      type: 'or',
      title: 'Take your first action',
      options: [
        cardInput('Play project card', CardName.ANTS),
        cardInput('Standard projects', CardName.POWER_PLANT_STANDARD_PROJECT, CardName.ASTEROID_STANDARD_PROJECT),
        cardInput('Perform an action from a played card', CardName.BIRDS),
      ],
    }), [CardName.ANTS, CardName.BIRDS]);

    expect(wrapper.html()).eq('<!--v-if-->');
  });

  it('shows nothing for an input with no cards, or no input at all', () => {
    expect(mountInput(asComplete<PlayerInputModel>({type: 'option', title: 'Pass'})).html()).eq('<!--v-if-->');
    expect(mountInput(undefined).html()).eq('<!--v-if-->');
  });

  it('shows a draft hand, which the viewer sees nowhere else', () => {
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

  it('renders a Message title as text', () => {
    const wrapper = mountInput(asComplete<SelectCardModel>({
      type: 'card',
      title: {
        message: 'Select a card for ${0}',
        data: [{type: LogMessageDataType.RAW_STRING, value: 'Greenery'}],
      },
      cards: [{name: CardName.ANTS}],
    }));

    expect(wrapper.find('.judge-pending-choice-title').text()).eq('Select a card for Greenery');
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
