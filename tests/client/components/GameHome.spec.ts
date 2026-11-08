import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from './getLocalVue';
import GameHome from '@/client/components/GameHome.vue';
import {fakeGameOptionsModel} from './testHelpers';
import {Phase} from '@/common/Phase';
import {SimpleGameModel} from '@/common/models/SimpleGameModel';
import {asComplete} from './utils/models';

function mountGameHome(overrides: Partial<SimpleGameModel> = {}) {
  return shallowMount(GameHome, {
    ...globalConfig,
    props: {
      game: asComplete<SimpleGameModel>({
        activePlayer: 'blue',
        id: 'game-id-123',
        phase: Phase.ACTION,
        players: [{color: 'blue', id: 'p-blue', name: 'Blue'}],
        spectatorId: 'spectator-id-123',
        gameOptions: fakeGameOptionsModel(),
        lastSoloGeneration: 14,
        expectedPurgeTimeMs: 0,
        ...overrides,
      }),
    },
  });
}

describe('GameHome', () => {
  it('mounts without errors', () => {
    const wrapper = mountGameHome();
    expect(wrapper.exists()).to.be.true;
  });

  it('links to the judge page when the game has a judge id', () => {
    const wrapper = mountGameHome({judgeId: 'j1'});
    expect(wrapper.find('a[href="judge?id=j1"]').exists()).is.true;
  });

  it('shows no judge link when the game has no judge id', () => {
    const wrapper = mountGameHome();
    expect(wrapper.find('a[href^="judge"]').exists()).is.false;
  });

  const AMY_AND_KIM = [
    {color: 'red', id: 'p-amy', name: 'Amy'},
    {color: 'blue', id: 'p-kim', name: 'Kim'},
  ] as const;

  it('shows the turn order and colors of the players', () => {
    const wrapper = mountGameHome({players: [...AMY_AND_KIM]});

    expect(wrapper.findAll('.turn-order').slice(0, 2).map((e) => e.text())).deep.eq(['1st', '2nd']);
    expect(wrapper.find('.color-square.player_bg_color_red').exists()).is.true;
    expect(wrapper.find('.color-square.player_bg_color_blue').exists()).is.true;
  });

  it('hides the turn order and colors of the players in a running incognito game', () => {
    const wrapper = mountGameHome({
      players: [
        {color: 'neutral', id: 'p-amy', name: 'Amy'},
        {color: 'neutral', id: 'p-kim', name: 'Kim'},
      ],
      gameOptions: fakeGameOptionsModel({incognito: true}),
    });

    expect(wrapper.find('.turn-order').exists()).is.false;
    expect(wrapper.find('.color-square').exists()).is.false;
    expect(wrapper.html()).does.not.contain('player_bg_color');
    expect(wrapper.find('a[href="player?id=p-amy"]').text()).eq('Amy');
    expect(wrapper.find('a[href="player?id=p-kim"]').text()).eq('Kim');
  });

  it('shows the turn order and colors of the players when an incognito game has ended', () => {
    const wrapper = mountGameHome({
      players: [...AMY_AND_KIM],
      phase: Phase.END,
      gameOptions: fakeGameOptionsModel({incognito: true}),
    });

    expect(wrapper.findAll('.turn-order').slice(0, 2).map((e) => e.text())).deep.eq(['1st', '2nd']);
    expect(wrapper.find('.color-square.player_bg_color_red').exists()).is.true;
  });
});
