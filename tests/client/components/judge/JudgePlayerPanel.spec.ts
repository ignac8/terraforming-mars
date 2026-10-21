import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import {fakePublicPlayerModel} from '../testHelpers';
import {asComplete} from '../utils/models';
import JudgePlayerPanel from '@/client/components/judge/JudgePlayerPanel.vue';
import {CardName} from '@/common/cards/CardName';
import {JudgePlayerModel} from '@/common/models/JudgeModel';
import {SelectCardModel} from '@/common/models/PlayerInputModel';
import {playerColorClass} from '@/common/utils/utils';

function privates(overrides: Partial<JudgePlayerModel> = {}): JudgePlayerModel {
  return {
    color: 'red',
    cardsInHand: [],
    ceoCardsInHand: [],
    dealtCorporationCards: [],
    dealtPreludeCards: [],
    dealtCeoCards: [],
    dealtProjectCards: [],
    draftedCards: [],
    pickedCorporationCard: [],
    preludeCardsInHand: [],
    waitingFor: undefined,
    ...overrides,
  };
}

function mountPanel(overrides: Partial<JudgePlayerModel> = {}) {
  return mount(JudgePlayerPanel, {
    ...globalConfig,
    props: {
      privates: privates(overrides),
      player: fakePublicPlayerModel({color: 'red', name: 'Alice'}),
    },
  });
}

const sections: Array<[keyof JudgePlayerModel, string, CardName]> = [
  ['cardsInHand', 'Cards In Hand', CardName.ANTS],
  ['draftedCards', 'Drafted cards', CardName.BIRDS],
  ['dealtCorporationCards', 'Dealt corporations', CardName.ECOLINE],
  ['dealtPreludeCards', 'Dealt preludes', CardName.DONATION],
  ['dealtCeoCards', 'Dealt CEOs', CardName.ASIMOV],
  ['dealtProjectCards', 'Dealt project cards', CardName.COMET],
  ['pickedCorporationCard', 'Picked corporation', CardName.HELION],
  ['preludeCardsInHand', 'Preludes in hand', CardName.LOAN],
  ['ceoCardsInHand', 'CEOs in hand', CardName.KAREN],
];

describe('JudgePlayerPanel', () => {
  it('shows the player name', () => {
    const wrapper = mountPanel();

    expect(wrapper.text()).to.include('Alice');
  });

  it('shows the player name in the player color', () => {
    const wrapper = mountPanel();

    expect(wrapper.find('.dynamic-title').classes()).to.include(playerColorClass('red', 'shadow'));
  });

  it('shows no section when every list is empty', () => {
    const wrapper = mountPanel();

    for (const [, title] of sections) {
      expect(wrapper.text()).to.not.include(title);
    }
  });

  for (const [field, title, card] of sections) {
    it(`shows only the ${field} section when only it is filled`, () => {
      const wrapper = mountPanel({[field]: [{name: card}]});

      expect(wrapper.text()).to.include(title);
      expect(wrapper.text().toLowerCase()).to.include(card.toLowerCase());
      for (const [otherField, otherTitle] of sections) {
        if (otherField !== field) {
          expect(wrapper.text()).to.not.include(otherTitle);
        }
      }
    });
  }

  it('shows the pending choice when one is waiting', () => {
    const waitingFor = asComplete<SelectCardModel>({
      type: 'card',
      title: 'Select a card to keep',
      cards: [{name: CardName.ANTS}],
    });
    const wrapper = mountPanel({waitingFor});

    expect(wrapper.findComponent({name: 'JudgePendingChoice'}).exists()).is.true;
    expect(wrapper.text()).to.include('Select a card to keep');
  });

  it('shows no pending choice when nothing is waiting', () => {
    const wrapper = mountPanel();

    expect(wrapper.findComponent({name: 'JudgePendingChoice'}).exists()).is.false;
  });
});
