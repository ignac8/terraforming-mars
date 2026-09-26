import {mount, VueWrapper, DOMWrapper} from '@vue/test-utils';
import {globalConfig} from './getLocalVue';
import {expect} from 'chai';
import SelectPlayer from '@/client/components/SelectPlayer.vue';
import {SelectPlayerModel} from '@/common/models/PlayerInputModel';
import {PlayerViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {InputResponse} from '@/common/inputs/InputResponse';
import {Color} from '@/common/Color';

describe('SelectPlayer', () => {
  let wrapper: VueWrapper<any>;
  let response: InputResponse | undefined = undefined;

  const players: Array<Partial<PublicPlayerModel>> = [
    {name: 'alpha', color: 'blue'},
    {name: 'beta', color: 'red'},
    {name: 'gamma', color: 'yellow'},
    {name: 'delta', color: 'green'},
  ];

  beforeEach(() => {
    const playerInput: SelectPlayerModel = {
      type: 'player',
      title: '',
      buttonLabel: '',
      // This is a different order from the order in `players`
      // because this is the order that players will be shown.
      players: ['red', 'yellow', 'green', 'blue'],
    };

    wrapper = mount(SelectPlayer, {
      ...globalConfig,
      props: {
        playerView: {players: players} as PlayerViewModel,
        playerinput: playerInput,
        onsave: (r: InputResponse) => {
          response = r;
        },
        showsave: true,
        showtitle: true,
      },
    });
  });

  it('content loaded', async () => {
    await wrapper.vm.$nextTick();

    const inputs = wrapper.findAll('input');
    expect(inputs).has.length(4);
    expect(inputs[0].element.getAttribute('value')).eq('red');
    expect(inputs[1].element.getAttribute('value')).eq('yellow');
    expect(inputs[2].element.getAttribute('value')).eq('green');
    expect(inputs[3].element.getAttribute('value')).eq('blue');

    const spans = wrapper.findAll('span');
    expect(spans[0].element.textContent).eq('beta');
    expect(spans[1].element.textContent).eq('gamma');
    expect(spans[2].element.textContent).eq('delta');
    expect(spans[3].element.textContent).eq('alpha');
  });

  it('input selection', async () => {
    await wrapper.vm.$nextTick();

    const inputs = wrapper.findAll('input');
    clickInput(inputs[0]);
    expect(wrapper.vm.$data.selectedPlayer).eq('red');
    clickButton();
    expect(response).deep.eq({type: 'player', player: 'red'});

    clickInput(inputs[1]);
    expect(wrapper.vm.$data.selectedPlayer).eq('yellow');
    clickButton();
    expect(response).deep.eq({type: 'player', player: 'yellow'});

    clickInput(inputs[2]);
    expect(wrapper.vm.$data.selectedPlayer).eq('green');
    clickButton();
    expect(response).deep.eq({type: 'player', player: 'green'});

    clickInput(inputs[3]);
    expect(wrapper.vm.$data.selectedPlayer).eq('blue');
    clickButton();
    expect(response).deep.eq({type: 'player', player: 'blue'});
  });

  it('nothing is selected by default outside a MarsBot game', async () => {
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.$data.selectedPlayer).is.undefined;
  });

  describe('MarsBot game', () => {
    function mountWithMarsBot(colors: Array<Color>): VueWrapper<any> {
      return mount(SelectPlayer, {
        ...globalConfig,
        props: {
          playerView: {
            players: [{name: 'alpha', color: 'blue'}],
            game: {marsBot: {name: 'MarsBot', color: 'bronze'}},
          } as unknown as PlayerViewModel,
          playerinput: {type: 'player', title: '', buttonLabel: '', players: colors} as SelectPlayerModel,
          onsave: (r: InputResponse) => {
            response = r;
          },
          showsave: true,
          showtitle: true,
        },
      });
    }

    it('MarsBot is selected by default and shown by name', async () => {
      const marsBotWrapper = mountWithMarsBot(['blue', 'bronze']);
      await marsBotWrapper.vm.$nextTick();

      expect(marsBotWrapper.vm.$data.selectedPlayer).eq('bronze');
      expect(marsBotWrapper.findAll('label span').map((s) => s.text())).deep.eq(['alpha', 'MarsBot']);
      marsBotWrapper.find('button').trigger('click');
      expect(response).deep.eq({type: 'player', player: 'bronze'});
    });

    it('nothing is selected by default when MarsBot is not a choice', async () => {
      const marsBotWrapper = mountWithMarsBot(['blue']);
      await marsBotWrapper.vm.$nextTick();
      expect(marsBotWrapper.vm.$data.selectedPlayer).is.undefined;
    });
  });

  async function clickInput(input: DOMWrapper<Element>) {
    const radio = input.element as HTMLInputElement;
    radio.checked = true;
    input.trigger('change');
    await wrapper.vm.$nextTick();
  }

  async function clickButton() {
    wrapper.find('button').trigger('click');
    await wrapper.vm.$nextTick();
  }
});
