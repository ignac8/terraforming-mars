import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from './getLocalVue';
import SpectatorHome from '@/client/components/SpectatorHome.vue';
import PurgeWarning from '@/client/components/common/PurgeWarning.vue';
import WaitingFor from '@/client/components/WaitingFor.vue';
import TopBar from '@/client/components/TopBar.vue';
import {fakeGameModel, fakePublicPlayerModel} from './testHelpers';
import LogPanel from '@/client/components/logpanel/LogPanel.vue';
import {LogMessage} from '@/common/logs/LogMessage';
import {LogMessageType} from '@/common/logs/LogMessageType';
import {SpectatorModel} from '@/common/models/SpectatorModel';

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
      },
      props: {
        spectator: {
          game: fakeGameModel(),
          players: [player],
          id: 's-spectator-id',
          thisPlayer: player,
          color: 'neutral',
        },
      },
    });
    expect(wrapper.exists()).to.be.true;
  });

  it('pins the active player in the top bar', () => {
    const red = fakePublicPlayerModel({color: 'red'});
    const blue = fakePublicPlayerModel({color: 'blue', isActive: true});
    const spectator: SpectatorModel = {game: fakeGameModel(), players: [red, blue], id: 's-spectator-id', thisPlayer: undefined, color: 'neutral'};
    const wrapper = shallowMount(SpectatorHome, {
      ...globalConfig,
      parentComponent: {methods: {getVisibilityState: () => true, setVisibilityState: () => {}}},
      props: {spectator},
    });

    expect(wrapper.findComponent(TopBar).props('player')?.color).eq('blue');
  });

  it('renders no WaitingFor when replaying', () => {
    const player = fakePublicPlayerModel();
    const spectator: SpectatorModel = {game: fakeGameModel(), players: [player], id: 's-spectator-id', thisPlayer: player, color: 'neutral'};
    const mountHome = (replay: boolean) => shallowMount(SpectatorHome, {
      ...globalConfig,
      parentComponent: {methods: {getVisibilityState: () => true, setVisibilityState: () => {}}},
      props: {spectator, replay},
    });
    expect(mountHome(false).findComponent(WaitingFor).exists()).is.true;
    expect(mountHome(true).findComponent(WaitingFor).exists()).is.false;
  });

  describe('replay', () => {
    const player = fakePublicPlayerModel();
    const spectator: SpectatorModel = {game: fakeGameModel(), players: [player], id: 's-spectator-id', thisPlayer: player, color: 'neutral'};
    const mountHome = (props: Record<string, unknown>, slots?: Record<string, string>) => shallowMount(SpectatorHome, {
      ...globalConfig,
      slots,
      parentComponent: {methods: {getVisibilityState: () => true, setVisibilityState: () => {}}},
      props: {spectator, ...props},
    });

    it('shows the log of the replay it is given, and no other', () => {
      const replayLog = [new LogMessage(LogMessageType.DEFAULT, 'Played', [])];
      expect(mountHome({replay: true}).findComponent(LogPanel).exists()).is.false;
      expect(mountHome({replay: true, replayLog}).findComponent(LogPanel).props('replayLog')).to.deep.equal(replayLog);
      expect(mountHome({}).findComponent(LogPanel).props('replayLog')).is.undefined;
    });

    it('holds what the page adds in its own element, so that the top bar stays with it', () => {
      const wrapper = mountHome({replay: true}, {default: '<div class="added">more</div>'});
      expect(wrapper.find('#spectator-home > .added').exists()).is.true;
      expect(mountHome({replay: true}).find('#spectator-home > .added').exists()).is.false;
    });
  });

  it('renders no purge warning when replaying', () => {
    const player = fakePublicPlayerModel();
    const spectator: SpectatorModel = {game: fakeGameModel(), players: [player], id: 's-spectator-id', thisPlayer: player, color: 'neutral'};
    const mountHome = (replay: boolean) => shallowMount(SpectatorHome, {
      ...globalConfig,
      parentComponent: {methods: {getVisibilityState: () => true, setVisibilityState: () => {}}},
      props: {spectator, replay},
    });
    expect(mountHome(false).findComponent(PurgeWarning).exists()).is.true;
    expect(mountHome(true).findComponent(PurgeWarning).exists()).is.false;
  });
});
