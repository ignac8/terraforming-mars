import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import ReplayHands from '@/client/components/replay/ReplayHands.vue';
import Card from '@/client/components/card/Card.vue';
import {fakePublicPlayerModel} from '../testHelpers';
import {ReplayPrivates} from '@/common/replay/ReplayModel';
import {CardName} from '@/common/cards/CardName';

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
      props: {players: [blue], privates: []},
    });
    expect(wrapper.findAll('.replay-hands-section')).has.length(0);
  });
});
