import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import {fakeGameModel, fakePublicPlayerModel} from '../testHelpers';
import JudgeHome from '@/client/components/judge/JudgeHome.vue';
import TopBar from '@/client/components/TopBar.vue';
import {CardName} from '@/common/cards/CardName';
import {Color} from '@/common/Color';
import {JudgeModel, JudgePlayerModel} from '@/common/models/JudgeModel';
import {Phase} from '@/common/Phase';

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
        TopBar: true,
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
  it('pins the active player in the top bar', () => {
    const judge = judgeModel([privates('red', CardName.ANTS), privates('blue', CardName.BIRDS)]);
    judge.players[1].isActive = true;
    const wrapper = mountJudge(judge);

    expect(wrapper.findComponent(TopBar).props('player')?.color).eq('blue');
  });

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

  it('renders no panel for a private block whose color matches no player', () => {
    const wrapper = mountJudge(judgeModel([privates('red', CardName.ANTS), privates('green', CardName.BIRDS)]));

    expect(wrapper.findAllComponents({name: 'JudgePlayerPanel'})).has.length(1);
    expect(wrapper.text()).to.include(CardName.ANTS);
    expect(wrapper.text()).to.not.include(CardName.BIRDS);
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

describe('JudgeHome replay link', () => {
  function finished(password: string | undefined) {
    const judge = judgeModel([privates('red', CardName.ANTS)]);
    judge.game = fakeGameModel({phase: Phase.END});
    judge.password = password;
    return judge;
  }

  it('is shown for a finished game, carrying the judge password', () => {
    const wrapper = mountJudge(finished('se cret'));

    const link = wrapper.find('a.judge-replay-link');
    expect(link.exists()).is.true;
    expect(link.attributes('href')).eq('replay?id=j-judge-id&password=se%20cret');
  });

  it('has no password in the link when the judge has none', () => {
    const wrapper = mountJudge(finished(undefined));

    expect(wrapper.find('a.judge-replay-link').attributes('href')).eq('replay?id=j-judge-id');
  });

  it('is not shown while the game runs', () => {
    const wrapper = mountJudge(judgeModel([privates('red', CardName.ANTS)]));

    expect(wrapper.find('a.judge-replay-link').exists()).is.false;
  });
});
