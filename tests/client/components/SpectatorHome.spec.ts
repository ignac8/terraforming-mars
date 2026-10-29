import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from './getLocalVue';
import SpectatorHome from '@/client/components/SpectatorHome.vue';
import PurgeWarning from '@/client/components/common/PurgeWarning.vue';
import WaitingFor from '@/client/components/WaitingFor.vue';
import TopBar from '@/client/components/TopBar.vue';
import {fakeGameModel, fakePublicPlayerModel} from './testHelpers';

describe('SpectatorHome', () => {
  it('mounts without errors', () => {
    const player = fakePublicPlayerModel();
    const wrapper = shallowMount(SpectatorHome, {
      ...globalConfig,
      parentComponent: {
        methods: {
          getVisibilityState: () => true,
          setVisibilityState: () => {},
          updateSpectator: () => {},
        },
      } as any,
      props: {
        spectator: {
          game: fakeGameModel(),
          players: [player],
          id: 's-spectator-id',
          thisPlayer: player,
          runId: 'run-id',
          color: 'neutral',
        },
      },
    });
    expect(wrapper.exists()).to.be.true;
  });

  it('pins the active player in the top bar', () => {
    const red = fakePublicPlayerModel({color: 'red'});
    const blue = fakePublicPlayerModel({color: 'blue', isActive: true});
    const spectator = {game: fakeGameModel(), players: [red, blue], id: 's-spectator-id', thisPlayer: undefined, runId: 'run-id', color: 'neutral'};
    const wrapper = shallowMount(SpectatorHome, {
      ...globalConfig,
      parentComponent: {methods: {getVisibilityState: () => true, setVisibilityState: () => {}}} as any,
      props: {spectator: spectator as any},
    });

    expect(wrapper.findComponent(TopBar).props('player')?.color).eq('blue');
  });

  it('renders no WaitingFor when replaying', () => {
    const player = fakePublicPlayerModel();
    const spectator = {game: fakeGameModel(), players: [player], id: 's-spectator-id', thisPlayer: player, runId: 'run-id', color: 'neutral'};
    const mountHome = (replay: boolean) => shallowMount(SpectatorHome, {
      ...globalConfig,
      parentComponent: {methods: {getVisibilityState: () => true, setVisibilityState: () => {}}} as any,
      props: {spectator: spectator as any, replay},
    });
    expect(mountHome(false).findComponent(WaitingFor).exists()).is.true;
    expect(mountHome(true).findComponent(WaitingFor).exists()).is.false;
  });

  it('renders no purge warning when replaying', () => {
    const player = fakePublicPlayerModel();
    const spectator = {game: fakeGameModel(), players: [player], id: 's-spectator-id', thisPlayer: player, runId: 'run-id', color: 'neutral'};
    const mountHome = (replay: boolean) => shallowMount(SpectatorHome, {
      ...globalConfig,
      parentComponent: {methods: {getVisibilityState: () => true, setVisibilityState: () => {}}} as any,
      props: {spectator: spectator as any, replay},
    });
    expect(mountHome(false).findComponent(PurgeWarning).exists()).is.true;
    expect(mountHome(true).findComponent(PurgeWarning).exists()).is.false;
  });
});
