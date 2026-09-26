import {mount, shallowMount, VueWrapper} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from './getLocalVue';
import SelectDelegate from '@/client/components/SelectDelegate.vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ColorWithNeutral} from '@/common/Color';
import {InputResponse} from '@/common/inputs/InputResponse';

describe('SelectDelegate', () => {
  it('mounts without errors', () => {
    const wrapper = shallowMount(SelectDelegate, {
      ...globalConfig,
      props: {
        playerView: {players: []} as unknown as PlayerViewModel,
        playerinput: {
          title: 'Select a delegate',
          buttonLabel: 'Save',
          type: 'delegate',
          players: ['NEUTRAL'],
        },
        onsave: () => {},
        showsave: true,
        showtitle: true,
      },
    });
    expect(wrapper.exists()).to.be.true;
  });

  describe('MarsBot game', () => {
    function mountWithMarsBot(colors: Array<ColorWithNeutral>, onsave: (r: InputResponse) => void = () => {}): VueWrapper<any> {
      return mount(SelectDelegate, {
        ...globalConfig,
        props: {
          playerView: {
            players: [{name: 'alpha', color: 'blue'}],
            game: {marsBot: {name: 'MarsBot', color: 'bronze'}},
          } as unknown as PlayerViewModel,
          playerinput: {
            title: 'Select player delegate to remove from Greens party',
            buttonLabel: 'Remove delegate',
            type: 'delegate',
            players: colors,
          },
          onsave,
          showsave: true,
          showtitle: true,
        },
      });
    }

    it('shows MarsBot by name', () => {
      const wrapper = mountWithMarsBot(['NEUTRAL', 'blue', 'bronze']);
      expect(wrapper.findAll('label span').map((s) => s.text())).deep.eq(['Neutral', 'alpha', 'MarsBot']);
    });

    it('MarsBot is selected by default', async () => {
      let response: InputResponse | undefined;
      const wrapper = mountWithMarsBot(['NEUTRAL', 'blue', 'bronze'], (r) => response = r);
      expect(wrapper.vm.$data.selectedPlayer).eq('bronze');
      await wrapper.find('button').trigger('click');
      expect(response).deep.eq({type: 'delegate', player: 'bronze'});
    });

    it('nothing is selected by default when MarsBot has no delegate to remove', () => {
      const wrapper = mountWithMarsBot(['NEUTRAL', 'blue']);
      expect(wrapper.vm.$data.selectedPlayer).is.undefined;
    });
  });
});
