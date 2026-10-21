import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import {fakePublicPlayerModel} from '../testHelpers';
import {asComplete} from '../utils/models';
import JudgePlayerPanel from '@/client/components/judge/JudgePlayerPanel.vue';
import {CardName} from '@/common/cards/CardName';
import {JudgePlayerModel} from '@/common/models/JudgeModel';
import {SelectCardModel} from '@/common/models/PlayerInputModel';

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

  for (const [field, title, card] of sections) {
    it(`shows ${field} when filled`, () => {
      const wrapper = mountPanel({[field]: [{name: card}]});

      expect(wrapper.text()).to.include(title);
      expect(wrapper.text().toLowerCase()).to.include(card.toLowerCase());
    });

    it(`hides ${field} when empty`, () => {
      const wrapper = mountPanel();

      expect(wrapper.text()).to.not.include(title);
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
