import {mount, shallowMount, VueWrapper} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import ReplayHands from '@/client/components/replay/ReplayHands.vue';
import Card from '@/client/components/card/Card.vue';
import {fakePublicPlayerModel} from '../testHelpers';
import {FakeLocalStorage} from '../FakeLocalStorage';
import {ReplayPrivates} from '@/common/replay/ReplayModel';
import {CardName} from '@/common/cards/CardName';
import {ParticipantId} from '@/common/Types';

function privatesOf(color: ReplayPrivates['color'], cardsInHand: Array<CardName>): ReplayPrivates {
  return {
    color,
    cardsInHand: cardsInHand.map((name) => ({name})),
    ceoCardsInHand: [],
    dealtCorporationCards: [],
    dealtPreludeCards: [],
    dealtCeoCards: [],
    dealtProjectCards: [],
    draftedCards: [],
    pickedCorporationCard: [],
    preludeCardsInHand: [],
    waitingFor: undefined,
  } as ReplayPrivates;
}

describe('ReplayHands', () => {
  const blue = fakePublicPlayerModel({color: 'blue', name: 'Blue player'});
  const red = fakePublicPlayerModel({color: 'red', name: 'Red player'});

  it('pairs privates with players by color, not by position', () => {
    // Privates come in generation order, which here is the reverse of the seating order.
    const wrapper = shallowMount(ReplayHands, {
      ...globalConfig,
      props: {
        participantId: 'p-viewer',
        players: [blue, red],
        privates: [privatesOf('red', [CardName.ANTS]), privatesOf('blue', [CardName.ALGAE, CardName.BIRDS])],
      },
    });
    const players = wrapper.findAll('.replay-hands-player');
    expect(players).has.length(2);
    const cardNames = (player: typeof players[number]): Array<string> =>
      player.findAllComponents(Card).map((card: {props(): any}) => card.props().card.name);
    expect(cardNames(players[0])).to.deep.equal([CardName.ALGAE, CardName.BIRDS]);
    expect(cardNames(players[1])).to.deep.equal([CardName.ANTS]);
  });

  it('shows no sections for a player without privates', () => {
    const wrapper = shallowMount(ReplayHands, {
      ...globalConfig,
      props: {participantId: 'p-viewer', players: [blue], privates: []},
    });
    expect(wrapper.findAll('.replay-hands-section')).has.length(0);
  });

  describe('dealt cards', () => {
    const dealt = {
      dealtCorporationCards: [{name: CardName.ECOLINE}],
      dealtPreludeCards: [{name: CardName.DONATION}],
      dealtCeoCards: [{name: CardName.ASIMOV}],
      dealtProjectCards: [{name: CardName.COMET}],
      pickedCorporationCard: [{name: CardName.HELION}],
    };
    const titles = ['Dealt corporations', 'Dealt preludes', 'Dealt CEOs', 'Dealt project cards', 'Picked corporation'];

    function mountWith(tableau: Array<{name: CardName}>) {
      return mount(ReplayHands, {
        ...globalConfig,
        props: {
          participantId: 'p-viewer',
          players: [fakePublicPlayerModel({color: 'blue', name: 'Blue player', tableau})],
          privates: [{...privatesOf('blue', [CardName.ANTS]), ...dealt}],
        },
      });
    }

    it('shows them while nothing is in play', () => {
      const wrapper = mountWith([]);

      for (const title of titles) {
        expect(wrapper.text()).to.include(title);
      }
    });

    it('drops them once something is in play, and keeps the hand', () => {
      const wrapper = mountWith([{name: CardName.HELION}]);

      expect(wrapper.text()).to.include('Cards In Hand');
      for (const title of titles) {
        expect(wrapper.text()).to.not.include(title);
      }
    });
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

    function mountHands(participantId: ParticipantId = 'p-viewer') {
      return mount(ReplayHands, {
        ...globalConfig,
        props: {
          participantId,
          players: [blue, red],
          privates: [privatesOf('blue', [CardName.ALGAE]), privatesOf('red', [CardName.ANTS])],
        },
      });
    }

    function toggleButtons(wrapper: VueWrapper) {
      return wrapper.findAll('.replay-hands-toggle');
    }

    function cardNames(wrapper: VueWrapper): Array<string> {
      return wrapper.findAllComponents(Card).map((card: {props(): any}) => card.props().card.name);
    }

    it('folds away one player but keeps the name', async () => {
      const wrapper = mountHands();

      await toggleButtons(wrapper)[0].trigger('click');

      expect(wrapper.text()).to.include('Blue player');
      expect(cardNames(wrapper)).to.deep.equal([CardName.ANTS]);
      expect(toggleButtons(wrapper)[0].text()).eq('Show');
      expect(toggleButtons(wrapper)[1].text()).eq('Hide');
    });

    it('shows the cards again on a second click', async () => {
      const wrapper = mountHands();

      await toggleButtons(wrapper)[0].trigger('click');
      await toggleButtons(wrapper)[0].trigger('click');

      expect(cardNames(wrapper)).to.deep.equal([CardName.ALGAE, CardName.ANTS]);
      expect(toggleButtons(wrapper)[0].text()).eq('Hide');
    });

    it('stays hidden when the screen is opened again', async () => {
      await toggleButtons(mountHands())[0].trigger('click');

      const reopened = mountHands();

      expect(cardNames(reopened)).to.deep.equal([CardName.ANTS]);
      expect(toggleButtons(reopened)[0].text()).eq('Show');
    });

    it('keeps other participant links open', async () => {
      await toggleButtons(mountHands('p-viewer'))[0].trigger('click');

      expect(cardNames(mountHands('p-other'))).to.deep.equal([CardName.ALGAE, CardName.ANTS]);
    });
  });
});
