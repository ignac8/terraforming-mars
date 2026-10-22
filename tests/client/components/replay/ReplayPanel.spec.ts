import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {afterEach} from 'vitest';
import {nextTick} from 'vue';
import {globalConfig} from '../getLocalVue';
import ReplayPanel from '@/client/components/replay/ReplayPanel.vue';
import RewindControls from '@/client/components/replay/RewindControls.vue';
import {fakeGameModel, fakePublicPlayerModel, fakeViewModel} from '../testHelpers';
import {ReplayMove} from '@/common/replay/ReplayModel';
import {LogMessage} from '@/common/logs/LogMessage';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {LogMessageType} from '@/common/logs/LogMessageType';

function message(text: string, timestamp: number): LogMessage {
  return {
    type: LogMessageType.DEFAULT,
    message: 'Played ${0}',
    data: [{type: LogMessageDataType.RAW_STRING, value: text}],
    timestamp,
  };
}

const moves: Array<ReplayMove> = [
  {saveId: 1, messages: [message('alpha', 1)]},
  {saveId: 2, messages: [message('beta', 2)]},
  {saveId: 3, messages: []},
];

const blue = fakePublicPlayerModel({color: 'blue', name: 'Blue player'});
const red = fakePublicPlayerModel({color: 'red', name: 'Red player'});

function mountPanel(props: Record<string, unknown> = {}) {
  return mount(ReplayPanel, {
    ...globalConfig,
    props: {
      moves,
      index: 0,
      viewAs: 'all',
      players: [blue, red],
      viewModel: fakeViewModel({players: [blue, red]}),
      playing: false,
      speed: 1,
      ...props,
    },
  });
}

const green = fakePublicPlayerModel({color: 'green', name: 'Green player'});

// jsdom lays nothing out: rows 30px apart in a 100px list, which keeps whatever is scrolled.
function fakeLayout(): () => void {
  const offsetTop = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetTop');
  const clientHeight = Object.getOwnPropertyDescriptor(Element.prototype, 'clientHeight');
  const scrollTop = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop');
  const scrolled = new WeakMap<Element, number>();
  Object.defineProperty(HTMLElement.prototype, 'offsetTop', {configurable: true, get(this: HTMLElement) {
    return this.parentElement === null ? 0 : Array.from(this.parentElement.children).indexOf(this) * 30;
  }});
  Object.defineProperty(Element.prototype, 'clientHeight', {configurable: true, get: () => 100});
  Object.defineProperty(Element.prototype, 'scrollTop', {configurable: true,
    get(this: Element) {
      return scrolled.get(this) ?? 0;
    },
    set(this: Element, value: number) {
      scrolled.set(this, value);
    },
  });
  return () => {
    Object.defineProperty(HTMLElement.prototype, 'offsetTop', offsetTop!);
    Object.defineProperty(Element.prototype, 'clientHeight', clientHeight!);
    Object.defineProperty(Element.prototype, 'scrollTop', scrollTop!);
  };
}

describe('ReplayPanel', () => {
  let restoreLayout: (() => void) | undefined;

  afterEach(() => {
    restoreLayout?.();
    restoreLayout = undefined;
  });

  it('lists the view-as players in the same order whatever order the view lists them in', () => {
    const colors = (players: Array<typeof blue>) => mountPanel({players}).findAll('.replay-view-player').map((b) => b.text());
    const expected = ['Red player', 'Green player', 'Blue player'];
    expect(colors([blue, red, green])).deep.eq(expected);
    expect(colors([green, blue, red])).deep.eq(expected);
    expect(colors([red, green, blue])).deep.eq(expected);
  });

  it('step forward at the first move selects the second', async () => {
    const wrapper = mountPanel();
    await wrapper.find('.replay-forward').trigger('click');
    expect(wrapper.emitted('select')).to.deep.equal([[1]]);
  });

  it('step back at the first move emits nothing', async () => {
    const wrapper = mountPanel();
    await wrapper.find('.replay-back').trigger('click');
    expect(wrapper.emitted('select')).is.undefined;
  });

  it('step forward at the last move emits nothing', async () => {
    const wrapper = mountPanel({index: 2});
    await wrapper.find('.replay-forward').trigger('click');
    expect(wrapper.emitted('select')).is.undefined;
  });

  it('jumps to the start and to the end', async () => {
    const wrapper = mountPanel({index: 1});
    await wrapper.find('.replay-start').trigger('click');
    await wrapper.find('.replay-end').trigger('click');
    expect(wrapper.emitted('select')).to.deep.equal([[0], [2]]);
  });

  it('play button plays, and pauses while playing', async () => {
    const stopped = mountPanel();
    await stopped.find('.replay-play').trigger('click');
    expect(stopped.emitted('play')).has.length(1);

    const playing = mountPanel({playing: true});
    await playing.find('.replay-play').trigger('click');
    expect(playing.emitted('pause')).has.length(1);
    expect(playing.emitted('play')).is.undefined;
  });

  // A save from the end of a generation shows the next one: loading it runs production.
  it('shows the generation of the view on screen and the move position', () => {
    const wrapper = mountPanel({index: 2, viewModel: fakeViewModel({players: [blue, red], game: fakeGameModel({generation: 5})})});
    expect(wrapper.find('.replay-position').text()).to.equal('Gen 5 · move 3 / 3');
  });

  it('renders the messages of every move', () => {
    const text = mountPanel().find('.replay-moves').text();
    expect(text).to.contain('Played alpha');
    expect(text).to.contain('Played beta');
  });

  it('clicking a move selects it', async () => {
    const wrapper = mountPanel();
    await wrapper.findAll('.replay-move')[1].trigger('click');
    expect(wrapper.emitted('select')).to.deep.equal([[1]]);
  });

  it('the collapse toggle hides the move list', async () => {
    const wrapper = mountPanel();
    expect(wrapper.find('.replay-moves').exists()).is.true;
    await wrapper.find('.replay-collapse').trigger('click');
    expect(wrapper.find('.replay-moves').exists()).is.false;
    await wrapper.find('.replay-collapse').trigger('click');
    expect(wrapper.find('.replay-moves').exists()).is.true;
  });

  it('names its icon buttons for screen readers', () => {
    const wrapper = mountPanel();
    const labels = ['.replay-start', '.replay-back', '.replay-play', '.replay-forward', '.replay-end']
      .map((selector) => wrapper.find(selector).attributes('aria-label'));
    expect(labels).deep.eq(['Go to start', 'Step back', 'Play replay', 'Step forward', 'Go to end']);
  });

  it('scrolls the current move back into view when the list is shown again', async () => {
    restoreLayout = fakeLayout();
    const wrapper = mountPanel({index: 2});
    expect(wrapper.find('.replay-moves').element.scrollTop).eq(10);
    await wrapper.find('.replay-collapse').trigger('click');
    await wrapper.find('.replay-collapse').trigger('click');
    expect(wrapper.find('.replay-moves').element.scrollTop).eq(10);
  });

  it('scrolls the current move into view when the view changes', async () => {
    restoreLayout = fakeLayout();
    const wrapper = mountPanel({index: 2});
    wrapper.find('.replay-moves').element.scrollTop = 0;
    await wrapper.setProps({viewAs: 'red'});
    await nextTick();
    expect(wrapper.find('.replay-moves').element.scrollTop).eq(10);
  });

  it('choosing a player emits update:viewAs with that color', async () => {
    const wrapper = mountPanel();
    await wrapper.find('.replay-view-red').trigger('click');
    expect(wrapper.emitted('update:viewAs')).to.deep.equal([['red']]);
  });

  it('choosing all hands emits update:viewAs with all', async () => {
    const wrapper = mountPanel({viewAs: 'red'});
    await wrapper.find('.replay-view-all').trigger('click');
    expect(wrapper.emitted('update:viewAs')).to.deep.equal([['all']]);
  });

  it('choosing a speed emits update:speed with a number', async () => {
    const wrapper = mountPanel();
    await wrapper.find('.replay-speed').setValue('4');
    expect(wrapper.emitted('update:speed')).to.deep.equal([[4]]);
  });

  describe('on the live game page', () => {
    function mountLive(props: Record<string, unknown> = {}) {
      return mountPanel({live: true, index: undefined, ...props});
    }

    it('has no play, speed or view-as controls', async () => {
      const wrapper = mountLive({index: 1});
      await wrapper.find('.replay-collapse').trigger('click');
      expect(wrapper.find('.replay-forward').exists()).is.true;
      for (const selector of ['.replay-play', '.replay-speed', '.replay-view-as']) {
        expect(wrapper.find(selector).exists(), selector).is.false;
      }
    });

    it('starts collapsed, and says when the move list is shown', async () => {
      const wrapper = mountLive();
      expect(wrapper.find('.replay-moves').exists()).is.false;
      await wrapper.find('.replay-collapse').trigger('click');
      expect(wrapper.find('.replay-moves').exists()).is.true;
      expect(wrapper.emitted('update:collapsed')).to.deep.equal([[false]]);
    });

    it('offers the way back to the live game only while a move is selected', async () => {
      expect(mountLive().find('.replay-back-to-live').exists()).is.false;
      const wrapper = mountLive({index: 1});
      await wrapper.find('.replay-back-to-live').trigger('click');
      expect(wrapper.emitted('back')).to.have.length(1);
    });

    it('steps back from the live game to the last move', async () => {
      const wrapper = mountLive();
      await wrapper.find('.replay-collapse').trigger('click');
      await wrapper.find('.replay-back').trigger('click');
      expect(wrapper.emitted('select')).to.deep.equal([[2]]);
    });
  });

  describe('rewinding', () => {
    it('offers it for the selected move and passes the choice on', () => {
      const wrapper = mountPanel({canRewind: true, index: 1});
      wrapper.findComponent(RewindControls).vm.$emit('rewind', 'shuffle', 'back');
      expect(wrapper.emitted('rewind')).to.deep.equal([['shuffle', 'back']]);
    });

    it('offers it for no move when none is selected, or when rewinding is not allowed', () => {
      expect(mountPanel({canRewind: true, live: true, index: undefined}).findComponent(RewindControls).exists()).is.false;
      expect(mountPanel({canRewind: false, index: 1}).findComponent(RewindControls).exists()).is.false;
    });
  });

  describe('freezing', () => {
    it('offers the judge freeze or unfreeze in the header, also while the panel is collapsed', async () => {
      for (const [frozen, label] of [[false, 'Freeze'], [true, 'Unfreeze']] as const) {
        const wrapper = mountPanel({live: true, frozen});
        expect(wrapper.find('.replay-controls').exists(), label).is.false;
        const button = wrapper.find('.replay-header .replay-freeze');
        expect(button.text(), label).equals(label);
        await button.trigger('click');
        expect(wrapper.emitted('freeze'), label).to.have.length(1);
      }
    });

    it('offers it to no one who has no frozen state to show, and not while a rewind runs', () => {
      expect(mountPanel({live: true}).find('.replay-freeze').exists()).is.false;
      expect(mountPanel({live: true, frozen: false, rewinding: true}).find('.replay-freeze').attributes('disabled')).not.is.undefined;
    });
  });

  it('lets the judge choose a view on the live game page, where a player has none', () => {
    expect(mountPanel({live: true}).find('.replay-view-as').exists()).is.false;
    expect(mountPanel({live: true, viewAsInLive: true}).find('.replay-view-as').exists()).is.true;
  });
});
