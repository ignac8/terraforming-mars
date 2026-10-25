import {flushPromises, shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {afterEach, beforeEach, vi} from 'vitest';
import {globalConfig} from './getLocalVue';
import GameEnd from '@/client/components/GameEnd.vue';
import RewindVoteBanner from '@/client/components/replay/RewindVoteBanner.vue';
import {fakeGameModel, fakeGameOptionsModel, fakePlayerViewModel, fakePublicPlayerModel, fakeSpectatorModel} from './testHelpers';
import {MarsBotModel} from '@/common/models/MarsBotModel';
import {BoardName} from '@/common/boards/BoardName';
import {getGlobalParameterMaximums} from '@/common/boards/GlobalParameterMaximums';
import {GlobalParameter} from '@/common/GlobalParameter';
import {ViewModel} from '@/common/models/PlayerModel';

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
      leftoverResourcesVP: 0,
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

  it('links to the replay of the game', () => {
    const wrapper = shallowMount(GameEnd, {
      ...globalConfig,
      props: {
        participant: fakePlayerViewModel({id: 'p-blue-id' as any}),
      },
    });
    expect(wrapper.find('a.game-end-replay-link').attributes('href')).to.equal('replay?id=p-blue-id');
  });

  it('does not offer a vote to rewind a finished multiplayer game', () => {
    const blue = fakePublicPlayerModel({color: 'blue', id: 'p-blue-id' as any});
    const red = fakePublicPlayerModel({color: 'red', id: 'p-red-id' as any});
    const wrapper = shallowMount(GameEnd, {
      ...globalConfig,
      props: {
        participant: fakePlayerViewModel({
          id: 'p-blue-id' as any,
          thisPlayer: blue,
          players: [blue, red],
          game: fakeGameModel({gameOptions: fakeGameOptionsModel({undoOption: true})}),
        }),
      },
    });
    expect(wrapper.findComponent(RewindVoteBanner).exists()).is.false;
  });

  describe('following a rewind of the finished game', () => {
    const blue = fakePublicPlayerModel({color: 'blue', id: 'p-blue-id' as any});
    const red = fakePublicPlayerModel({color: 'red', id: 'p-red-id' as any});
    let originalFetch: any;
    let requests: Array<string>;
    let result: string;

    beforeEach(() => {
      vi.useFakeTimers();
      vi.stubGlobal('location', {href: 'http://localhost/the-end', search: ''});
      originalFetch = (global as any).fetch;
      requests = [];
      result = 'WAIT';
      (global as any).fetch = (url: string) => {
        requests.push(url);
        return Promise.resolve({ok: true, status: 200, json: () => Promise.resolve({result, waitingFor: []})});
      };
    });

    afterEach(() => {
      (global as any).fetch = originalFetch;
      vi.unstubAllGlobals();
      vi.useRealTimers();
    });

    function mountEnd(participant: ViewModel) {
      return shallowMount(GameEnd, {...globalConfig, props: {participant}});
    }

    function player(options: Parameters<typeof fakeGameOptionsModel>[0], players = [blue, red]) {
      return fakePlayerViewModel({
        id: 'p-blue-id' as any,
        thisPlayer: blue,
        players,
        game: fakeGameModel({undoCount: 4, gameAge: 9, gameOptions: fakeGameOptionsModel(options)}),
      });
    }

    function spectator(options: Parameters<typeof fakeGameOptionsModel>[0], players = [blue, red]) {
      return {...fakeSpectatorModel(), id: 's-id' as any, players, game: fakeGameModel({undoCount: 4, gameAge: 9, gameOptions: fakeGameOptionsModel(options)})};
    }

    async function ticks(ms: number) {
      await vi.advanceTimersByTimeAsync(ms);
      await flushPromises();
    }

    it('reloads the game page when the undo count changes, for every viewer of a solo game with Player undo', async () => {
      for (const [label, participant, url, page] of [
        ['solo player undo player', player({undoOption: true}, [blue]), 'api/waitingfor?id=p-blue-id&gameAge=9&undoCount=4', 'player?id=p-blue-id'],
        ['solo player undo spectator', spectator({undoOption: true}, [blue]), 'api/waitingfor?id=s-id&gameAge=9&undoCount=4', 'spectator?id=s-id'],
      ] as const) {
        requests = [];
        result = 'WAIT';
        window.location.href = 'http://localhost/the-end';
        const wrapper = mountEnd(participant);
        await ticks(9_999);
        expect(requests, label).has.length(0);
        await ticks(1);
        expect(requests, label).deep.equals([url]);
        expect(window.location.href, label).equals('http://localhost/the-end');
        result = 'REFRESH';
        await ticks(10_000);
        expect(window.location.href, label).equals(page);
        wrapper.unmount();
      }
    });

    it('does not poll a game that cannot be rewound once it has ended, and stops after unmount', async () => {
      const never = mountEnd(player({undoOption: false}));
      const noUndoSolo = mountEnd(player({undoOption: false}, [blue]));
      // A finished multiplayer game is not rewound by vote, so nothing can reopen it.
      const multiplayer = mountEnd(player({undoOption: true}));
      const multiplayerSpectator = mountEnd(spectator({undoOption: true}));
      await ticks(30_000);
      expect(requests).has.length(0);
      never.unmount();
      noUndoSolo.unmount();
      multiplayer.unmount();
      multiplayerSpectator.unmount();

      const solo = mountEnd(player({undoOption: true}, [blue]));
      await ticks(10_000);
      expect(requests).has.length(1);
      solo.unmount();
      await ticks(30_000);
      expect(requests).has.length(1);
    });
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
      neuralInstance: 2, mcToVP: 3, cardVP: 4, vermin: -1, leftoverResourcesVP: 2, turmoilVP: 3, corpVP: 6,
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

  it('lists the leftover resources, Turmoil and corporation VP in the MarsBot detail column', () => {
    const marsBot = fakeMarsBot(0);
    marsBot.corpName = 'Viron' as MarsBotModel['corpName'];
    Object.assign(marsBot.vpBreakdown!, {leftoverResourcesVP: 2, turmoilVP: 3, corpVP: 6});
    const wrapper = shallowMount(GameEnd, {
      ...globalConfig,
      props: {
        participant: fakePlayerViewModel({game: fakeGameModel({marsBot})}),
      },
    });
    const column = wrapper.findAll('.game-end-column').find((c) => c.find('.game-end-player').exists() && c.find('.game-end-player').text() === 'MarsBot');
    const rows = column!.findAll('.game-end-column-row').map((row) => row.text());
    expect(rows[0]).to.eq('3Turmoil Points');
    expect(rows).to.include.members(['2Leftover resources', '6Corporation (Viron)']);
  });

  for (const boardName of [BoardName.THARSIS, BoardName.AMAZONIS_PLANITIA]) {
    it('globals chart peaks at exactly 100% when every parameter is maxed on ' + boardName, () => {
      const max = getGlobalParameterMaximums(boardName);
      const game = fakeGameModel({
        gameOptions: fakeGameOptionsModel({boardName, expansions: {venus: true}}),
        globalsPerGeneration: [
          {},
          {
            [GlobalParameter.TEMPERATURE]: max.temperature,
            [GlobalParameter.OXYGEN]: max.oxygen,
            [GlobalParameter.OCEANS]: max.oceans,
            [GlobalParameter.VENUS]: max.venus,
          },
        ],
      });
      const wrapper = shallowMount(GameEnd, {
        ...globalConfig,
        props: {
          participant: fakePlayerViewModel({game}),
        },
      });

      const datasets = (wrapper.vm as any).globalsDataset as ReadonlyArray<{label: string, data: ReadonlyArray<number>}>;

      expect(datasets.map((d) => d.label)).to.deep.eq(['Temperature', 'Oxygen', 'Oceans', 'Venus']);
      for (const dataset of datasets) {
        expect(dataset.data, dataset.label).to.deep.eq([0, 100]);
      }
    });
  }
});
