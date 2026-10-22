import {mount, VueWrapper} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import {fakePublicPlayerModel} from '../testHelpers';
import {asComplete} from '../utils/models';
import {FakeLocalStorage} from '../FakeLocalStorage';
import JudgePlayerPanel from '@/client/components/judge/JudgePlayerPanel.vue';
import {CardName} from '@/common/cards/CardName';
import {Color} from '@/common/Color';
import {JudgePlayerModel} from '@/common/models/JudgeModel';
import {SelectCardModel} from '@/common/models/PlayerInputModel';
import {JudgeId} from '@/common/Types';
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

function mountPanel(overrides: Partial<JudgePlayerModel> = {}, judgeId: JudgeId = 'j-judge', color: Color = 'red') {
  return mount(JudgePlayerPanel, {
    ...globalConfig,
    props: {
      judgeId,
      privates: privates({color, ...overrides}),
      player: fakePublicPlayerModel({color, name: 'Alice'}),
    },
  });
}

function toggleButton(wrapper: VueWrapper) {
  const button = wrapper.findAll('button').find((b) => b.text() === 'Hide' || b.text() === 'Show');
  if (button === undefined) {
    throw new Error('no Hide/Show button');
  }
  return button;
}

const hand = {cardsInHand: [{name: CardName.ANTS}]};

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

  it('drops the setup cards once the player has a corporation in play', () => {
    const wrapper = mount(JudgePlayerPanel, {
      ...globalConfig,
      props: {
        judgeId: 'j-judge',
        privates: privates({
          cardsInHand: [{name: CardName.ANTS}],
          dealtCorporationCards: [{name: CardName.ECOLINE}],
          dealtPreludeCards: [{name: CardName.DONATION}],
          dealtCeoCards: [{name: CardName.ASIMOV}],
          dealtProjectCards: [{name: CardName.COMET}],
          pickedCorporationCard: [{name: CardName.HELION}],
        }),
        player: fakePublicPlayerModel({color: 'red', name: 'Alice', tableau: [{name: CardName.HELION}]}),
      },
    });

    expect(wrapper.text()).to.include('Cards In Hand');
    for (const title of ['Dealt corporations', 'Dealt preludes', 'Dealt CEOs', 'Dealt project cards', 'Picked corporation']) {
      expect(wrapper.text()).to.not.include(title);
    }
  });

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

  describe('hiding', () => {
    let localStorage: FakeLocalStorage;

    beforeEach(() => {
      localStorage = new FakeLocalStorage();
      FakeLocalStorage.register(localStorage);
    });

    afterEach(() => {
      FakeLocalStorage.deregister(localStorage);
    });

    const waitingFor = asComplete<SelectCardModel>({type: 'card', title: 'Select a card to keep', cards: [{name: CardName.BIRDS}]});

    it('folds away the cards and the pending choice but keeps the name', async () => {
      const wrapper = mountPanel({...hand, waitingFor});

      await toggleButton(wrapper).trigger('click');

      expect(wrapper.text()).to.include('Alice');
      expect(wrapper.text()).to.not.include('Cards In Hand');
      expect(wrapper.findComponent({name: 'Card'}).exists()).is.false;
      expect(wrapper.findComponent({name: 'JudgePendingChoice'}).exists()).is.false;
      expect(toggleButton(wrapper).text()).eq('Show');
    });

    it('shows everything again on a second click', async () => {
      const wrapper = mountPanel({...hand, waitingFor});

      await toggleButton(wrapper).trigger('click');
      await toggleButton(wrapper).trigger('click');

      expect(wrapper.text()).to.include('Cards In Hand');
      expect(wrapper.findComponent({name: 'JudgePendingChoice'}).exists()).is.true;
      expect(toggleButton(wrapper).text()).eq('Hide');
    });

    it('stays hidden when the page is opened again', async () => {
      await toggleButton(mountPanel(hand)).trigger('click');

      const reopened = mountPanel(hand);

      expect(reopened.text()).to.not.include('Cards In Hand');
      expect(toggleButton(reopened).text()).eq('Show');
    });

    it('keeps other players and other judge links open', async () => {
      await toggleButton(mountPanel(hand, 'j-judge', 'red')).trigger('click');

      expect(mountPanel(hand, 'j-judge', 'blue').text()).to.include('Cards In Hand');
      expect(mountPanel(hand, 'j-other', 'red').text()).to.include('Cards In Hand');
    });
  });
});
