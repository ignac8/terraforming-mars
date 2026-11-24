import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from './getLocalVue';
import SelectCard from '@/client/components/SelectCard.vue';
import Card from '@/client/components/card/Card.vue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {fakePlayerViewModel, fakePublicPlayerModel} from './testHelpers';

describe('SelectCard', () => {
  it('mounts without errors', () => {
    const wrapper = shallowMount(SelectCard, {
      ...globalConfig,
      props: {
        playerView: fakePlayerViewModel(),
        playerinput: {
          title: 'Select a card',
          buttonLabel: 'Save',
          type: 'card',
          cards: [],
          max: 1,
          min: 1,
          showOnlyInLearnerMode: false,
          selectBlueCardAction: false,
          showOwner: false,
          showSelectAll: false,
        },
        onsave: () => {},
        showsave: true,
        showtitle: true,
      },
    });
    expect(wrapper.exists()).to.be.true;
  });

  describe('choosing from the cards of several players', () => {
    function mountWithOwners() {
      const ants: CardModel = {name: CardName.ANTS};
      const tardigrades: CardModel = {name: CardName.TARDIGRADES};
      const me = fakePublicPlayerModel({color: 'blue', name: 'Me', tableau: [ants]});
      const opponent = fakePublicPlayerModel({color: 'red', name: 'Opponent', tableau: [tardigrades]});
      return shallowMount(SelectCard, {
        ...globalConfig,
        props: {
          playerView: fakePlayerViewModel({thisPlayer: me, players: [me, opponent]}),
          playerinput: {
            title: 'Select a card',
            buttonLabel: 'Save',
            type: 'card',
            cards: [ants, tardigrades],
            max: 1,
            min: 1,
            showOnlyInLearnerMode: false,
            selectBlueCardAction: false,
            showOwner: true,
            showSelectAll: false,
          },
          onsave: () => {},
        },
      });
    }

    it('lists the opponents\' cards before your own', () => {
      const names = mountWithOwners().findAllComponents(Card).map((card) => card.props('card').name);
      expect(names).deep.eq([CardName.TARDIGRADES, CardName.ANTS]);
    });

    it('labels each card with its owner, below the card', () => {
      const labels = mountWithOwners().findAll('.cardbox > .card-owner-label');
      expect(labels.map((label) => label.text())).deep.eq(['Opponent', 'Your card']);
    });
  });
});
