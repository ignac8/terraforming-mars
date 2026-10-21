import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import ReplayPanel from '@/client/components/replay/ReplayPanel.vue';
import {fakePublicPlayerModel, fakeViewModel} from '../testHelpers';
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
  {saveId: 1, generation: 1, messages: [message('alpha', 1)]},
  {saveId: 2, generation: 1, messages: [message('beta', 2)]},
  {saveId: 3, generation: 2, messages: []},
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

describe('ReplayPanel', () => {
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

  it('shows the generation and the move position', () => {
    const wrapper = mountPanel({index: 2});
    expect(wrapper.find('.replay-position').text()).to.equal('Gen 2 · move 3 / 3');
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
});
