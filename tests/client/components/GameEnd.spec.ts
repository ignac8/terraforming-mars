import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from './getLocalVue';
import GameEnd from '@/client/components/GameEnd.vue';
import {fakeGameModel, fakePlayerViewModel} from './testHelpers';
import {MarsBotModel} from '@/common/models/MarsBotModel';

function fakeMarsBot(total: number): MarsBotModel {
  return {
    name: 'MarsBot',
    color: 'neutral',
    difficulty: 'normal',
    megacredits: 0,
    instantWin: false,
    vpBreakdown: {
      terraformRating: total,
      milestones: 0,
      awards: 0,
      greenery: 0,
      cityAdjacentGreenery: 0,
      neuralInstance: 0,
      mcToVP: 0,
      cardVP: 0,
      vermin: 0,
      colonyVP: 0,
      turmoilVP: 0,
      corpVP: 0,
      total,
      detailsMilestones: [],
      detailsAwards: [],
    },
    vpByGeneration: [],
  } as Partial<MarsBotModel> as MarsBotModel;
}

describe('GameEnd', () => {
  it('mounts without errors', () => {
    const wrapper = shallowMount(GameEnd, {
      ...globalConfig,
      props: {
        participant: fakePlayerViewModel(),
      },
    });
    expect(wrapper.exists()).to.be.true;
  });

  it('shows the human beating MarsBot with both scores', () => {
    const wrapper = shallowMount(GameEnd, {
      ...globalConfig,
      props: {
        participant: fakePlayerViewModel({game: fakeGameModel({marsBot: fakeMarsBot(15)})}),
      },
    });
    const text = wrapper.find('.game_end_success').text();
    expect(text).to.include('You beat MarsBot!');
    expect(text).to.include('(20 vs 15)');
  });

  it('gives a tie to MarsBot', () => {
    const wrapper = shallowMount(GameEnd, {
      ...globalConfig,
      props: {
        participant: fakePlayerViewModel({game: fakeGameModel({marsBot: fakeMarsBot(20)})}),
      },
    });
    const text = wrapper.find('.game_end_fail').text();
    expect(text).to.include('MarsBot wins!');
    expect(text).to.include('(20 vs 20)');
    expect(text).to.include('Tie goes to MarsBot!');
  });

  it('starts the MarsBot detail column with its own VP sources, not a spacer', () => {
    const marsBot = fakeMarsBot(8);
    marsBot.vpBreakdown!.neuralInstance = 5;
    marsBot.vpBreakdown!.mcToVP = 3;
    marsBot.mcPerVP = 8;
    const wrapper = shallowMount(GameEnd, {
      ...globalConfig,
      props: {
        participant: fakePlayerViewModel({game: fakeGameModel({marsBot})}),
      },
    });
    const column = wrapper.findAll('.game-end-column').find((c) => c.find('.game-end-player').exists() && c.find('.game-end-player').text() === 'MarsBot');
    const rows = column!.findAll('.game-end-column-row');
    expect(rows.map((row) => row.text())).to.deep.eq(['5Neural Instance', '3MC to VP (8 MC/VP)', '']);
  });

  it('adds the VP without a column of their own to the MarsBot row, so it sums to the total', () => {
    const marsBot = fakeMarsBot(0);
    const vp = marsBot.vpBreakdown!;
    Object.assign(vp, {
      terraformRating: 20, milestones: 5, awards: 5, greenery: 4, cityAdjacentGreenery: 3,
      neuralInstance: 2, mcToVP: 3, cardVP: 4, vermin: -1, colonyVP: 2, turmoilVP: 3, corpVP: 6,
    });
    vp.total = 20 + 5 + 5 + 4 + 3 + 2 + 3 + 4 - 1 + 2 + 3 + 6;
    const wrapper = shallowMount(GameEnd, {
      ...globalConfig,
      props: {
        participant: fakePlayerViewModel({game: fakeGameModel({marsBot})}),
      },
    });
    const row = wrapper.findAll('tbody tr').find((r) => r.text().includes('MarsBot (normal)'))!;
    const cells = row.findAll('td').map((td) => td.text());
    // Name, TR, milestones, awards, greenery, cities, other, total, M€, actions
    const [tr, milestones, awards, greenery, cities, other, total] = cells.slice(1, 8).map(Number);
    expect(other).to.eq(2 + 3 + 4 - 1 + 2 + 3 + 6);
    expect(tr + milestones + awards + greenery + cities + other).to.eq(total);
  });

  it('lists the colony, Turmoil and corporation VP in the MarsBot detail column', () => {
    const marsBot = fakeMarsBot(0);
    marsBot.corpName = 'Viron' as MarsBotModel['corpName'];
    Object.assign(marsBot.vpBreakdown!, {colonyVP: 2, turmoilVP: 3, corpVP: 6});
    const wrapper = shallowMount(GameEnd, {
      ...globalConfig,
      props: {
        participant: fakePlayerViewModel({game: fakeGameModel({marsBot})}),
      },
    });
    const column = wrapper.findAll('.game-end-column').find((c) => c.find('.game-end-player').exists() && c.find('.game-end-player').text() === 'MarsBot');
    const rows = column!.findAll('.game-end-column-row').map((row) => row.text());
    expect(rows[0]).to.eq('3Turmoil Points');
    expect(rows).to.include.members(['2Colonies', '6Corporation (Viron)']);
  });
});
