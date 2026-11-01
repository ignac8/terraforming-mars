import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from './getLocalVue';
import SpectatorHome from '@/client/components/SpectatorHome.vue';
import PurgeWarning from '@/client/components/common/PurgeWarning.vue';
import WaitingFor from '@/client/components/WaitingFor.vue';
import TopBar from '@/client/components/TopBar.vue';
import {fakeGameModel, fakePublicPlayerModel} from './testHelpers';
import LogPanel from '@/client/components/logpanel/LogPanel.vue';
import {Phase} from '@/common/Phase';
import {LogMessage} from '@/common/logs/LogMessage';
import {LogMessageType} from '@/common/logs/LogMessageType';

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

  describe('game results link', () => {
    function resultsHref(id: string): string | undefined {
      const player = fakePublicPlayerModel();
      const spectator = {game: fakeGameModel({phase: Phase.END, spectatorId: 's-spectator-id'}), players: [player], id, thisPlayer: undefined, runId: 'run-id', color: 'neutral'};
      const wrapper = shallowMount(SpectatorHome, {
        ...globalConfig,
        parentComponent: {methods: {getVisibilityState: () => true, setVisibilityState: () => {}}} as any,
        props: {spectator: spectator as any},
      });
      return wrapper.findAll('a').find((a) => a.text() === 'Go to game results')?.attributes('href');
    }

    it('is the results page of the spectator', () => {
      expect(resultsHref('s-spectator-id')).eq('the-end?id=s-spectator-id');
    });

    it('is the results page of the spectator when the judge replays the whole table', () => {
      expect(resultsHref('j-judge-id')).eq('the-end?id=s-spectator-id');
    });
  });

  describe('replay', () => {
    const player = fakePublicPlayerModel();
    const spectator = {game: fakeGameModel(), players: [player], id: 's-spectator-id', thisPlayer: player, runId: 'run-id', color: 'neutral'};
    const mountHome = (props: Record<string, unknown>, slots?: Record<string, string>) => shallowMount(SpectatorHome, {
      ...globalConfig,
      slots,
      parentComponent: {methods: {getVisibilityState: () => true, setVisibilityState: () => {}}} as any,
      props: {spectator: spectator as any, ...props},
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
