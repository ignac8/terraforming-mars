import {flushPromises, shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {afterEach, beforeEach, vi} from 'vitest';
import {globalConfig} from './getLocalVue';
import GameEnd from '@/client/components/GameEnd.vue';
import RewindVoteBanner from '@/client/components/replay/RewindVoteBanner.vue';
import {fakeGameModel, fakeGameOptionsModel, fakePlayerViewModel, fakePublicPlayerModel, fakeSpectatorModel} from './testHelpers';
import {BoardName} from '@/common/boards/BoardName';
import {getGlobalParameterMaximums} from '@/common/boards/GlobalParameterMaximums';
import {GlobalParameter} from '@/common/GlobalParameter';
import {ViewModel} from '@/common/models/PlayerModel';

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

  it('carries the seat password on the replay link', () => {
    const wrapper = shallowMount(GameEnd, {
      ...globalConfig,
      props: {
        participant: fakePlayerViewModel({id: 'p-blue-id' as any, password: '0123456789ab'}),
      },
    });
    expect(wrapper.find('a.game-end-replay-link').attributes('href')).to.equal('replay?id=p-blue-id&password=0123456789ab');
  });

  describe('the vote to rewind the game', () => {
    // A finished game's model carries the players' ids.
    const blue = fakePublicPlayerModel({color: 'blue', id: 'p-blue-id' as any});
    const red = fakePublicPlayerModel({color: 'red', id: 'p-red-id' as any});

    function mountEnd(options: Parameters<typeof fakeGameOptionsModel>[0], players = [blue, red]) {
      return shallowMount(GameEnd, {
        ...globalConfig,
        props: {
          participant: fakePlayerViewModel({
            id: 'p-blue-id' as any,
            password: '0123456789ab',
            thisPlayer: blue,
            players,
            game: fakeGameModel({undoCount: 4, gameOptions: fakeGameOptionsModel(options)}),
          }),
        },
      });
    }

    it('shows the vote to the players of a table with Player undo, and to no one else', () => {
      const spectator = {...fakeSpectatorModel(), players: [blue, red], game: fakeGameModel({gameOptions: fakeGameOptionsModel({undoOption: true})})};
      for (const [label, wrapper, shown] of [
        ['player', mountEnd({undoOption: true}), true],
        ['no Player undo', mountEnd({undoOption: false}), false],
        ['judge undo', mountEnd({undoOption: true, judgeUndo: true}), false],
        ['solo', mountEnd({undoOption: true}, [blue]), false],
        ['spectator', shallowMount(GameEnd, {...globalConfig, props: {participant: spectator}}), false],
      ] as const) {
        expect(wrapper.findComponent(RewindVoteBanner).exists(), label).equals(shown);
      }
    });

    it('polls slowly and links the replay, because every poll reloads a game that was evicted', () => {
      const banner = mountEnd({undoOption: true}).findComponent(RewindVoteBanner);

      expect(banner.props()).deep.include({
        participantId: 'p-blue-id',
        color: 'blue',
        password: '&password=0123456789ab',
        undoCount: 4,
        pollMs: 10_000,
        replayUrl: 'replay?id=p-blue-id&password=0123456789ab',
      });
    });
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
        password: '0123456789ab',
        thisPlayer: blue,
        players,
        game: fakeGameModel({undoCount: 4, gameAge: 9, gameOptions: fakeGameOptionsModel(options)}),
      });
    }

    function spectator(options: Parameters<typeof fakeGameOptionsModel>[0]) {
      return {...fakeSpectatorModel(), id: 's-id' as any, players: [blue, red], game: fakeGameModel({undoCount: 4, gameAge: 9, gameOptions: fakeGameOptionsModel(options)})};
    }

    async function ticks(ms: number) {
      await vi.advanceTimersByTimeAsync(ms);
      await flushPromises();
    }

    it('reloads the game page when the undo count changes, for every viewer of a game that nobody polls otherwise', async () => {
      for (const [label, participant, url, page] of [
        ['judge undo player', player({undoOption: true, judgeUndo: true}), 'api/waitingfor?id=p-blue-id&password=0123456789ab&gameAge=9&undoCount=4', 'player?id=p-blue-id&password=0123456789ab'],
        ['judge undo spectator', spectator({undoOption: true, judgeUndo: true}), 'api/waitingfor?id=s-id&gameAge=9&undoCount=4', 'spectator?id=s-id'],
        ['player undo spectator', spectator({undoOption: true}), 'api/waitingfor?id=s-id&gameAge=9&undoCount=4', 'spectator?id=s-id'],
        ['solo player undo', player({undoOption: true}, [blue]), 'api/waitingfor?id=p-blue-id&password=0123456789ab&gameAge=9&undoCount=4', 'player?id=p-blue-id&password=0123456789ab'],
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

    it('does not poll a game that cannot be rewound or one whose vote banner polls, and stops after unmount', async () => {
      const never = mountEnd(player({undoOption: false}));
      const voters = mountEnd(player({undoOption: true}));
      await ticks(30_000);
      expect(requests).has.length(0);
      never.unmount();
      voters.unmount();

      mountEnd(player({undoOption: true, judgeUndo: true})).unmount();
      await ticks(30_000);
      expect(requests).has.length(0);
    });
  });

  it('shows the dogs', () => {
    const wrapper = shallowMount(GameEnd, {
      ...globalConfig,
      props: {
        participant: fakePlayerViewModel(),
      },
    });
    expect(wrapper.find('.game-end-dogs img').attributes('src')).eq('assets/dogs.jpg');
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
