import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import {fakeGameModel, fakePublicPlayerModel} from '../testHelpers';
import JudgeHome from '@/client/components/judge/JudgeHome.vue';
import {CardName} from '@/common/cards/CardName';
import {Color} from '@/common/Color';
import {JudgeModel, JudgePlayerModel} from '@/common/models/JudgeModel';

function privates(color: Color, hand: CardName): JudgePlayerModel {
  return {
    color,
    cardsInHand: [{name: hand}],
    ceoCardsInHand: [],
    dealtCorporationCards: [],
    dealtPreludeCards: [],
    dealtCeoCards: [],
    dealtProjectCards: [],
    draftedCards: [],
    pickedCorporationCard: [],
    preludeCardsInHand: [],
    waitingFor: undefined,
  } as JudgePlayerModel;
}

function judgeModel(privatesList: Array<JudgePlayerModel>): JudgeModel {
  const red = fakePublicPlayerModel({color: 'red', name: 'Alice'});
  const blue = fakePublicPlayerModel({color: 'blue', name: 'Bob'});
  return {
    game: fakeGameModel(),
    players: [red, blue],
    id: 'j-judge-id',
    color: 'neutral',
    thisPlayer: undefined,
    runId: 'run-id',
    password: undefined,
    signature: 'sig',
    privates: privatesList,
  } as JudgeModel;
}

function mountJudge(judge: JudgeModel) {
  return mount(JudgeHome, {
    props: {judge},
    global: {
      ...globalConfig.global,
      stubs: {
        Sidebar: true,
        GameBoardView: true,
        LogPanel: true,
        PlayersOverview: true,
        WaitingFor: true,
      },
    },
    parentComponent: {
      methods: {
        getVisibilityState: () => true,
        setVisibilityState: () => {},
      },
    } as any,
  });
}

describe('JudgeHome', () => {
  it('shows one hidden-info block per player', () => {
    const wrapper = mountJudge(judgeModel([privates('red', CardName.ANTS), privates('blue', CardName.BIRDS)]));

    expect(wrapper.findAllComponents({name: 'JudgePlayerPanel'})).has.length(2);
    expect(wrapper.text()).to.include(CardName.ANTS);
    expect(wrapper.text()).to.include(CardName.BIRDS);
  });

  it('matches each block to its player by color, whatever the order', () => {
    const wrapper = mountJudge(judgeModel([privates('blue', CardName.BIRDS), privates('red', CardName.ANTS)]));

    const panels = wrapper.findAllComponents({name: 'JudgePlayerPanel'});
    expect(panels[0].text()).to.include('Bob');
    expect(panels[0].text()).to.include(CardName.BIRDS);
    expect(panels[1].text()).to.include('Alice');
    expect(panels[1].text()).to.include(CardName.ANTS);
  });

  it('has no spectator or judge link', () => {
    const wrapper = mountJudge(judgeModel([privates('red', CardName.ANTS), privates('blue', CardName.BIRDS)]));

    expect(wrapper.find('a[href*="spectator"]').exists()).is.false;
    expect(wrapper.find('a[href*="judge"]').exists()).is.false;
  });

  it('includes the hidden waiting-for with the judge model', () => {
    const judge = judgeModel([privates('red', CardName.ANTS), privates('blue', CardName.BIRDS)]);
    const wrapper = mountJudge(judge);

    const waitingFor = wrapper.findComponent({name: 'WaitingFor'});
    expect(waitingFor.exists()).is.true;
    expect(waitingFor.attributes('style')).to.include('display: none');
    expect(waitingFor.props('playerView').id).to.equal(judge.id);
  });
});
