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
import {CardName} from '@/common/cards/CardName';
import {setTranslationsForTest} from '@/client/directives/i18n';
import {PreferencesManager} from '@/client/utils/PreferencesManager';

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

  it('jumps to the start and to the end once the player confirms', async () => {
    const wrapper = mountPanel({index: 1});
    await wrapper.find('.replay-start').trigger('click');
    await wrapper.find('.replay-confirm-yes').trigger('click');
    await wrapper.find('.replay-end').trigger('click');
    await wrapper.find('.replay-confirm-yes').trigger('click');
    expect(wrapper.emitted('select')).to.deep.equal([[0], [2]]);
  });

  describe('jumping to an end', () => {
    it('asks first, and says what each end shows', async () => {
      const wrapper = mountPanel({index: 1});
      expect(wrapper.find('.replay-confirm').exists()).is.false;
      await wrapper.find('.replay-start').trigger('click');
      expect(wrapper.find('.replay-confirm-text').text()).equals('Jump to the start?');
      await wrapper.find('.replay-end').trigger('click');
      expect(wrapper.find('.replay-confirm-text').text()).equals('Jump to the end? This shows how the game ends.');
      expect(wrapper.emitted('select')).is.undefined;
    });

    it('goes nowhere when the player cancels', async () => {
      const wrapper = mountPanel({index: 1});
      await wrapper.find('.replay-end').trigger('click');
      await wrapper.find('.replay-confirm-cancel').trigger('click');
      expect(wrapper.find('.replay-confirm').exists()).is.false;
      expect(wrapper.emitted('select')).is.undefined;
    });

    it('stops asking once another move is selected', async () => {
      const wrapper = mountPanel({index: 1});
      await wrapper.find('.replay-end').trigger('click');
      await wrapper.setProps({index: 0});
      expect(wrapper.find('.replay-confirm').exists()).is.false;
    });

    it('does not ask on the live page, where the end is not a spoiler', async () => {
      const wrapper = mountPanel({live: true, index: 1});
      await wrapper.find('.replay-collapse').trigger('click');
      await wrapper.find('.replay-start').trigger('click');
      expect(wrapper.find('.replay-confirm').exists()).is.false;
      expect(wrapper.emitted('select')).to.deep.equal([[0]]);
    });
  });

  describe('transport icons', () => {
    it('draws each button as an icon, with no glyph in the text', () => {
      const wrapper = mountPanel({index: 1});
      for (const selector of ['.replay-start', '.replay-back', '.replay-forward', '.replay-end']) {
        const button = wrapper.find(selector);
        expect(button.find('svg path').exists(), selector).is.true;
        expect(button.text(), selector).equals('');
      }
    });

    it('labels play and pause in words, and draws the two differently', async () => {
      const wrapper = mountPanel();
      expect(wrapper.find('.replay-play').text()).equals('Play replay');
      const playIcon = wrapper.find('.replay-play svg path').attributes('d');
      await wrapper.setProps({playing: true});
      expect(wrapper.find('.replay-play').text()).equals('Pause');
      expect(wrapper.find('.replay-play svg path').attributes('d')).not.equals(playIcon);
      expect(wrapper.find('.replay-play').attributes('aria-label')).equals('Pause');
    });

    it('draws every transport button differently', () => {
      const wrapper = mountPanel({index: 1});
      const paths = ['.replay-start', '.replay-back', '.replay-forward', '.replay-end'].map((selector) => wrapper.find(selector + ' svg path').attributes('d'));
      expect(new Set(paths).size).equals(4);
    });
  });

  describe('hotkeys', () => {
    function press(key: string, init: ConstructorParameters<typeof KeyboardEvent>[1] = {}, target: EventTarget = window): KeyboardEvent {
      const event = new KeyboardEvent('keydown', {key, bubbles: true, cancelable: true, ...init});
      target.dispatchEvent(event);
      return event;
    }

    it('steps with the arrow keys and plays and pauses with the space bar', () => {
      const stopped = mountPanel({index: 1});
      press('ArrowRight');
      press('ArrowLeft');
      press(' ');
      expect(stopped.emitted('select')).to.deep.equal([[2], [0]]);
      expect(stopped.emitted('play')).has.length(1);
      expect(stopped.emitted('pause')).is.undefined;
      stopped.unmount();

      const playing = mountPanel({index: 1, playing: true});
      press(' ');
      expect(playing.emitted('pause')).has.length(1);
    });

    it('keeps the page from scrolling, and a focused button from being pressed too', () => {
      mountPanel({index: 1});
      expect(press('ArrowRight').defaultPrevented).is.true;
      expect(press(' ').defaultPrevented).is.true;
      const up = new KeyboardEvent('keyup', {key: ' ', cancelable: true});
      window.dispatchEvent(up);
      expect(up.defaultPrevented).is.true;
      const another = new KeyboardEvent('keyup', {key: ' ', cancelable: true});
      window.dispatchEvent(another);
      expect(another.defaultPrevented).is.false;
    });

    it('ignores other keys and keys pressed with a modifier', () => {
      const wrapper = mountPanel({index: 1});
      expect(press('a').defaultPrevented).is.false;
      press('ArrowRight', {ctrlKey: true});
      press('ArrowRight', {metaKey: true});
      press('ArrowRight', {altKey: true});
      press(' ', {shiftKey: true});
      expect(wrapper.emitted('select')).is.undefined;
      expect(wrapper.emitted('play')).is.undefined;
    });

    it('leaves the keys to a field that takes them', () => {
      const wrapper = mountPanel({index: 1});
      const editable = document.createElement('div');
      editable.setAttribute('contenteditable', 'true');
      const fields = [document.createElement('input'), document.createElement('select'), document.createElement('textarea'), editable];
      for (const field of fields) {
        document.body.appendChild(field);
        press('ArrowRight', {}, field);
        press(' ', {}, field);
        field.remove();
      }
      expect(wrapper.emitted('select')).is.undefined;
      expect(wrapper.emitted('play')).is.undefined;
    });

    it('takes the keys from a button, which is where the focus is after a click on the panel', () => {
      const wrapper = mountPanel({index: 1});
      const button = document.createElement('button');
      document.body.appendChild(button);
      press('ArrowRight', {}, button);
      button.remove();
      expect(wrapper.emitted('select')).to.deep.equal([[2]]);
    });

    it('stops listening when the panel goes away', () => {
      const wrapper = mountPanel({index: 1});
      wrapper.unmount();
      expect(press('ArrowRight').defaultPrevented).is.false;
      expect(wrapper.emitted('select')).is.undefined;
    });

    it('is off on the live game page, where the keys belong to the page', () => {
      const wrapper = mountPanel({live: true, index: 1});
      expect(press('ArrowRight').defaultPrevented).is.false;
      press(' ');
      expect(wrapper.emitted('select')).is.undefined;
    });
  });

  describe('autoplay settings', () => {
    it('offers slow speeds down to a tenth, and fast ones up to four times', () => {
      const speeds = mountPanel().findAll('.replay-speed option').map((option) => option.attributes('value'));
      expect(speeds).deep.eq(['0.1', '0.25', '0.5', '1', '2', '4']);
    });

    it('chooses between a fixed wait and real time', async () => {
      const fixed = mountPanel();
      expect(fixed.find('.replay-pace-fixed').attributes('aria-pressed')).equals('true');
      expect(fixed.find('.replay-pace-real').attributes('aria-pressed')).equals('false');
      await fixed.find('.replay-pace-real').trigger('click');
      expect(fixed.emitted('update:realTime')).to.deep.equal([[true]]);

      const real = mountPanel({realTime: true});
      expect(real.find('.replay-pace-fixed').attributes('aria-pressed')).equals('false');
      expect(real.find('.replay-pace-real').attributes('aria-pressed')).equals('true');
      await real.find('.replay-pace-fixed').trigger('click');
      expect(real.emitted('update:realTime')).to.deep.equal([[false]]);
    });

    it('has no autoplay settings on the live game page', () => {
      expect(mountPanel({live: true}).find('.replay-pace').exists()).is.false;
    });
  });

  describe('the log switch', () => {
    it('sits in the header and passes the choice on', async () => {
      for (const showLog of [false, true]) {
        const wrapper = mountPanel({showLog});
        const input = wrapper.find('.replay-header .replay-show-log input');
        expect((input.element as HTMLInputElement).checked).equals(showLog);
        await input.setValue(!showLog);
        expect(wrapper.emitted('update:showLog'), String(showLog)).to.deep.equal([[!showLog]]);
      }
    });

    it('is not there while the live game shows, which has its own log', () => {
      expect(mountPanel({live: true, index: undefined}).find('.replay-show-log').exists()).is.false;
      expect(mountPanel({live: true, index: 1}).find('.replay-show-log').exists()).is.true;
    });
  });

  describe('picks', () => {
    afterEach(() => {
      setTranslationsForTest(undefined);
      PreferencesManager.INSTANCE.set('lang', 'en');
    });

    const picked: Array<ReplayMove> = [
      {saveId: 1, messages: [message('alpha', 1)], picks: [{color: 'red', cards: [CardName.BIRDS, CardName.FISH]}]},
      {saveId: 2, messages: [], silent: true, movers: ['blue'], picks: [
        {color: 'blue', cards: [CardName.ANTS]},
        {color: 'red', cards: [CardName.KELP_FARMING], auto: true},
      ]},
      {saveId: 3, messages: []},
    ];

    it('lists the cards under the row, with the colour of who chose them', () => {
      const rows = mountPanel({moves: picked}).findAll('.replay-move');
      const picks = (row: number) => rows[row].findAll('.replay-move-pick').map((pick) => [pick.find('.replay-move-mover').classes().pop(), pick.text()]);
      expect(picks(0)).deep.eq([['player_bg_color_red', 'kept: Birds, Fish']]);
      expect(picks(1)).deep.eq([
        ['player_bg_color_blue', 'drafted: Ants'],
        ['player_bg_color_red', 'last card passed: Kelp Farming'],
      ]);
      expect(picks(2)).deep.eq([]);
    });

    it('names the cards and what was done with them in the language of the player', () => {
      PreferencesManager.INSTANCE.set('lang', 'pl');
      setTranslationsForTest({'Birds': 'Ptaki', 'Fish': 'Ryby', 'kept': 'zatrzymane'});
      const text = mountPanel({moves: picked}).findAll('.replay-move')[0].find('.replay-move-pick').text();
      expect(text).equals('zatrzymane: Ptaki, Ryby');
    });
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

  it('labels a silent move a draft pick, with the picker\'s colour', () => {
    const rows = mountPanel({moves: [...moves, {saveId: 4, messages: [], silent: true, movers: ['red']}]}).findAll('.replay-move');
    expect(rows[3].find('.replay-move-silent').text()).to.equal('Draft pick');
    expect(rows[3].find('.replay-move-mover').classes()).to.contain('player_bg_color_red');
    expect(rows[2].find('.replay-move-silent').exists()).is.false;
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

  describe('undone moves', () => {
    const withUndone: Array<ReplayMove> = [
      {saveId: 1, messages: [message('alpha', 1)], movers: ['blue']},
      {saveId: 2, messages: [message('beta', 2)], undone: true, movers: ['blue']},
      {saveId: 3, messages: [message('gamma', 3)], movers: ['blue']},
    ];

    it('offers the judge a switch, and passes the choice on', async () => {
      for (const showUndone of [false, true]) {
        const wrapper = mountPanel({canShowUndone: true, showUndone});
        const input = wrapper.find('.replay-header .replay-show-undone input');
        expect((input.element as HTMLInputElement).checked).equals(showUndone);
        await input.setValue(!showUndone);
        expect(wrapper.emitted('update:showUndone'), String(showUndone)).to.deep.equal([[!showUndone]]);
      }
    });

    it('offers it to no one else', () => {
      expect(mountPanel().find('.replay-show-undone').exists()).is.false;
    });

    it('dims an undone move and badges it, and no other', () => {
      const wrapper = mountPanel({moves: withUndone});
      const entries = wrapper.findAll('.replay-move');
      expect(entries.map((entry) => entry.classes('replay-move-undone'))).deep.equal([false, true, false]);
      expect(entries.map((entry) => entry.find('.replay-undone-badge').exists())).deep.equal([false, true, false]);
    });

    it('offers the judge a rewind to an undone move, and no one else a rewind or a vote for one', () => {
      for (const [props, offered] of [
        [{canRewind: true, canShowUndone: true}, true],
        [{canRewind: true}, false],
        [{canVoteRewind: true, viewerColor: 'blue'}, false],
        [{canVoteRewind: true, viewerColor: 'blue', canShowUndone: true}, false],
      ] as const) {
        const controls = mountPanel({...props, moves: withUndone, index: 1}).findComponent(RewindControls);
        expect(controls.exists(), JSON.stringify(props)).equals(offered);
        if (offered) {
          expect(controls.props('undone')).is.true;
        }
        expect(mountPanel({...props, moves: withUndone, index: 2}).findComponent(RewindControls).props('undone'), JSON.stringify(props)).is.false;
      }
    });
  });

  it('offers a vote only on a move the viewer made, alone or with others, and the judge a rewind to any', () => {
    const made: Array<ReplayMove> = [{...moves[0], movers: ['blue']}, {...moves[1], movers: ['red', 'blue']}, moves[2]];
    // The viewer is told by colour: a running game's players have no ids.
    const players = [fakePublicPlayerModel({color: 'blue', id: undefined}), fakePublicPlayerModel({color: 'red', id: undefined})];
    for (const [index, viewerColor, offered] of [[0, 'blue', true], [1, 'blue', true], [2, 'blue', false], [1, 'red', true], [0, undefined, false]] as const) {
      const controls = mountPanel({canVoteRewind: true, moves: made, players, index, viewerColor}).findComponent(RewindControls);
      expect(controls.exists(), `${index} ${viewerColor}`).equals(offered);
      if (offered) {
        expect(controls.props('mode')).equals('vote');
      }
    }
    expect(mountPanel({canRewind: true, moves: made, index: 1}).findComponent(RewindControls).props('mode')).equals('rewind');
  });

  it('lets the judge choose a view on the live game page, where a player has none', () => {
    expect(mountPanel({live: true}).find('.replay-view-as').exists()).is.false;
    expect(mountPanel({live: true, viewAsInLive: true}).find('.replay-view-as').exists()).is.true;
  });
});
