import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import RewindControls from '@/client/components/replay/RewindControls.vue';

describe('RewindControls', () => {
  function mountControls() {
    return mount(RewindControls, {...globalConfig, props: {disabled: false}});
  }

  it('rewinds only after a confirmation, with the cards that were chosen', async () => {
    for (const cards of ['same', 'shuffle']) {
      const wrapper = mountControls();
      await wrapper.find(`input[value=${cards}]`).setValue(true);
      await wrapper.find('.rewind-start').trigger('click');
      expect(wrapper.emitted('rewind')).is.undefined;
      await wrapper.find('.rewind-confirm-button').trigger('click');
      expect(wrapper.emitted('rewind')).to.deep.equal([[cards]]);
    }
  });

  it('rewinds with the same cards unless told otherwise', async () => {
    const wrapper = mountControls();
    await wrapper.find('.rewind-start').trigger('click');
    await wrapper.find('.rewind-confirm-button').trigger('click');
    expect(wrapper.emitted('rewind')).to.deep.equal([['same']]);
  });

  it('cancelling emits nothing and asks again next time', async () => {
    const wrapper = mountControls();
    await wrapper.find('.rewind-start').trigger('click');
    await wrapper.find('.rewind-cancel').trigger('click');
    expect(wrapper.emitted('rewind')).is.undefined;
    expect(wrapper.find('.rewind-confirm-button').exists()).is.false;
    expect(wrapper.find('.rewind-start').exists()).is.true;
  });
});
