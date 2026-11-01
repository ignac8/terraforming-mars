import {mount, shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import LogPanel from '@/client/components/logpanel/LogPanel.vue';
import LogMessageComponent from '@/client/components/logpanel/LogMessageComponent.vue';
import {fakeViewModel} from '../testHelpers';
import {LogMessage} from '@/common/logs/LogMessage';
import {LogMessageType} from '@/common/logs/LogMessageType';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {Color} from '@/common/Color';
import {SpaceId} from '@/common/Types';
import {playerColorClass} from '@/common/utils/utils';

describe('LogPanel', () => {
  let originalFetch: any;
  let originalGetElementById: typeof document.getElementById;
  let fetchCalls: Array<string>;

  function installScrollablePanel() {
    let scrollTop = 0;
    let scrollHeight = 520;
    const panel = {
      get scrollTop() {
        return scrollTop;
      },
      set scrollTop(value: number) {
        scrollTop = value;
      },
      get scrollHeight() {
        return scrollHeight;
      },
      clientHeight: 200,
    } as HTMLElement;
    document.getElementById = ((id: string) => id === 'logpanel-scrollable' ? panel : null) as typeof document.getElementById;
    return {
      getScrollTop: () => scrollTop,
      setScrollTop: (value: number) => {
        scrollTop = value;
      },
      setScrollHeight: (value: number) => {
        scrollHeight = value;
      },
    };
  }

  async function flushLogs(wrapper: ReturnType<typeof shallowMount>) {
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await wrapper.vm.$nextTick();
  }

  beforeEach(() => {
    originalFetch = (global as any).fetch;
    originalGetElementById = document.getElementById.bind(document);
    fetchCalls = [];
    (global as any).fetch = (url: string) => {
      fetchCalls.push(url);
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      });
    };
  });

  afterEach(() => {
    (global as any).fetch = originalFetch;
    document.getElementById = originalGetElementById;
  });

  it('mounts without errors', () => {
    const wrapper = shallowMount(LogPanel, {
      ...globalConfig,
      props: {
        viewModel: fakeViewModel(),
      },
    });
    expect(wrapper.exists()).to.be.true;
  });

  it('emits spaceClicked when a log message emits spaceClicked', async () => {
    const wrapper = shallowMount(LogPanel, {
      ...globalConfig,
      props: {viewModel: fakeViewModel()},
    });
    await flushLogs(wrapper);

    const message = new LogMessage(LogMessageType.DEFAULT, '${0}', [
      {type: LogMessageDataType.SPACE, value: '05' as SpaceId},
    ]);
    (wrapper.vm as any).messages.push(message);
    await wrapper.vm.$nextTick();

    await wrapper.findComponent(LogMessageComponent).vm.$emit('spaceClicked', '05');

    expect(wrapper.emitted('spaceClicked')).to.deep.eq([['05']]);
  });

  it('marks only the owned lines, each in its owner color', async () => {
    const wrapper = mount(LogPanel, {
      ...globalConfig,
      props: {viewModel: fakeViewModel()},
    });
    await flushLogs(wrapper);

    const line = (text: string, owner?: Color) => {
      const message = new LogMessage(LogMessageType.DEFAULT, text, []);
      message.owner = owner;
      return message;
    };
    (wrapper.vm as any).messages.push(line('first', 'red'), line('second'), line('third', 'blue'));
    await wrapper.vm.$nextTick();

    const lines = wrapper.findAll('li');
    expect(lines).has.length(3);
    expect(lines[0].find('.' + playerColorClass('red', 'bg')).exists()).is.true;
    expect(lines[1].find('.log-owner').exists()).is.false;
    expect(lines[2].find('.' + playerColorClass('blue', 'bg')).exists()).is.true;
    expect(lines[2].find('.' + playerColorClass('red', 'bg')).exists()).is.false;
  });

  describe('given the log of a replay', () => {
    const line = (text: string, undone?: boolean) => {
      const message = new LogMessage(LogMessageType.DEFAULT, text, []);
      message.undone = undone;
      return message;
    };
    const generation = (n: number) => new LogMessage(LogMessageType.NEW_GENERATION, 'Generation ${0}', [{type: LogMessageDataType.RAW_STRING, value: String(n)}]);
    const log = [generation(1), line('one'), generation(2), line('two'), line('twice'), generation(3), line('three')];
    const viewIn = (generationNumber: number) => {
      const base = fakeViewModel();
      return {...base, game: {...base.game, generation: generationNumber}};
    };
    // Lines that are not part of the generation announcement carry a clock mark in front.
    const texts = (wrapper: ReturnType<typeof mount>) => wrapper.findAll('li').map((li) => li.text().replace('\u{1F551}', ''));

    function mountReplay(replayLog: Array<LogMessage>, generationNumber: number) {
      return mount(LogPanel, {...globalConfig, props: {viewModel: viewIn(generationNumber), replayLog}});
    }

    it('shows the newest generation of the board from those lines, and asks the server for none', async () => {
      const wrapper = mountReplay(log, 2);
      await flushLogs(wrapper);

      expect(fetchCalls).is.empty;
      expect(texts(wrapper)).deep.eq(['Generation 2', 'two', 'twice']);
    });

    it('shows another generation on request', async () => {
      const wrapper = mountReplay(log, 3);
      await flushLogs(wrapper);

      (wrapper.vm as any).selectGeneration(1);
      await flushLogs(wrapper);

      expect(fetchCalls).is.empty;
      expect(texts(wrapper)).deep.eq(['Generation 1', 'one']);
    });

    it('keeps the lines of the generation chosen as the replay goes on, and follows the board when it is on the newest', async () => {
      const wrapper = mountReplay(log.slice(0, 5), 2);
      await flushLogs(wrapper);

      await wrapper.setProps({viewModel: viewIn(3), replayLog: log});
      await flushLogs(wrapper);
      expect(texts(wrapper)).deep.eq(['Generation 3', 'three']);

      (wrapper.vm as any).selectGeneration(2);
      await wrapper.setProps({viewModel: viewIn(3), replayLog: [...log, line('four')]});
      await flushLogs(wrapper);
      expect(texts(wrapper)).deep.eq(['Generation 2', 'two', 'twice']);
    });

    it('goes to the newest generation when the replay goes back past the one chosen', async () => {
      const wrapper = mountReplay(log, 3);
      await flushLogs(wrapper);
      (wrapper.vm as any).selectGeneration(2);
      await flushLogs(wrapper);

      await wrapper.setProps({viewModel: viewIn(1), replayLog: log.slice(0, 2)});
      await flushLogs(wrapper);

      expect((wrapper.vm as any).selectedGeneration).eq(1);
      expect(texts(wrapper)).deep.eq(['Generation 1', 'one']);
    });

    // The save at the end of a generation shows the next one, because loading it runs production, but the log
    // announces that generation only after production.
    it('stops at the generation the lines have got to when the board is ahead of them', async () => {
      const wrapper = mountReplay(log.slice(0, 5), 3);
      await flushLogs(wrapper);

      expect(wrapper.findAll('.log-gen-indicator').map((n) => n.text())).deep.eq(['1', '2']);
      expect(texts(wrapper)).deep.eq(['Generation 2', 'two', 'twice']);
    });

    it('shows no lines before the first is logged', async () => {
      const wrapper = mountReplay([], 1);
      await flushLogs(wrapper);

      expect(texts(wrapper)).deep.eq([]);
      expect(wrapper.findAll('.log-gen-indicator').map((n) => n.text())).deep.eq(['1']);
    });

    it('dims the lines that rewinds hid and keeps the owners of private lines', async () => {
      const owned = line('private');
      owned.owner = 'red';
      const wrapper = mountReplay([generation(1), line('kept'), line('hidden', true), owned], 1);
      await flushLogs(wrapper);

      expect(wrapper.findAll('li').map((l) => l.classes('log-undone'))).deep.eq([false, false, true, false]);
      expect(wrapper.findAll('li')[3].find('.' + playerColorClass('red', 'bg')).exists()).is.true;
    });
  });

  it('shows the scroll button only when away from the bottom', async () => {
    const panel = installScrollablePanel();
    const wrapper = shallowMount(LogPanel, {
      ...globalConfig,
      props: {viewModel: fakeViewModel()},
    });
    await flushLogs(wrapper);

    expect((wrapper.vm as any).showScrollToBottomButton).is.false;

    panel.setScrollTop(100);
    await wrapper.find('#logpanel-scrollable').trigger('scroll');
    expect((wrapper.vm as any).showScrollToBottomButton).is.true;

    panel.setScrollTop(320);
    await wrapper.find('#logpanel-scrollable').trigger('scroll');
    expect((wrapper.vm as any).showScrollToBottomButton).is.false;
  });

  it('returns to the current generation and the end of the log', async () => {
    const panel = installScrollablePanel();
    const baseViewModel = fakeViewModel({id: 'p-latest-reader' as any});
    const viewModel = {...baseViewModel, game: {...baseViewModel.game, generation: 3}};
    const wrapper = shallowMount(LogPanel, {
      ...globalConfig,
      props: {viewModel},
    });
    await flushLogs(wrapper);

    (wrapper.vm as any).selectedGeneration = 1;
    panel.setScrollTop(80);
    await wrapper.find('[data-test="log-latest"]').trigger('click');
    await flushLogs(wrapper);

    expect((wrapper.vm as any).selectedGeneration).eq(3);
    expect(fetchCalls[fetchCalls.length - 1]).includes('generation=3');
    expect(panel.getScrollTop()).eq(520);
  });

  it('follows the newest generation when the view model updates while following', async () => {
    const panel = installScrollablePanel();
    const baseViewModel = fakeViewModel({id: 'p-in-place-follower' as any});
    const viewModel = {...baseViewModel, game: {...baseViewModel.game, generation: 2}};
    const wrapper = shallowMount(LogPanel, {
      ...globalConfig,
      props: {viewModel},
    });
    await flushLogs(wrapper);
    (wrapper.vm as any).showLatestLogs();
    await flushLogs(wrapper);
    fetchCalls.length = 0;
    panel.setScrollHeight(640);

    await wrapper.setProps({viewModel: {...viewModel, game: {...viewModel.game, generation: 3}}});
    await flushLogs(wrapper);

    expect((wrapper.vm as any).selectedGeneration).eq(3);
    expect(fetchCalls).has.length(1);
    expect(fetchCalls[0]).includes('generation=3');
    expect(panel.getScrollTop()).eq(640);
  });

  it('refetches the current generation when the view model updates within a generation', async () => {
    const baseViewModel = fakeViewModel({id: 'p-in-place-same-gen' as any});
    const viewModel = {...baseViewModel, game: {...baseViewModel.game, generation: 2}};
    const wrapper = shallowMount(LogPanel, {
      ...globalConfig,
      props: {viewModel},
    });
    await flushLogs(wrapper);
    (wrapper.vm as any).showLatestLogs();
    await flushLogs(wrapper);
    fetchCalls.length = 0;

    await wrapper.setProps({viewModel: {...viewModel}});
    await flushLogs(wrapper);

    expect(fetchCalls).has.length(1);
    expect(fetchCalls[0]).includes('generation=2');
  });

  it('stays on an earlier generation when the view model updates after the player navigates away', async () => {
    const baseViewModel = fakeViewModel({id: 'p-in-place-history' as any});
    const viewModel = {...baseViewModel, game: {...baseViewModel.game, generation: 3}};
    const wrapper = shallowMount(LogPanel, {
      ...globalConfig,
      props: {viewModel},
    });
    await flushLogs(wrapper);
    (wrapper.vm as any).selectGeneration(1);
    await flushLogs(wrapper);
    fetchCalls.length = 0;

    await wrapper.setProps({viewModel: {...viewModel, game: {...viewModel.game, generation: 4}}});
    await flushLogs(wrapper);

    expect((wrapper.vm as any).selectedGeneration).eq(1);
    expect(fetchCalls).is.empty;
  });
});
