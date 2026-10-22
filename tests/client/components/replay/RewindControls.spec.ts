import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import RewindControls from '@/client/components/replay/RewindControls.vue';
import {RewindClockRow} from '@/common/replay/ReplayModel';

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
      expect(wrapper.emitted('rewind')).to.deep.equal([[cards, 'keep']]);
    }
  });

  it('rewinds with the same cards unless told otherwise', async () => {
    const wrapper = mountControls();
    await wrapper.find('.rewind-start').trigger('click');
    await wrapper.find('.rewind-confirm-button').trigger('click');
    expect(wrapper.emitted('rewind')).to.deep.equal([['same', 'keep']]);
  });

  describe('with the clocks of the players', () => {
    const clocks: Array<RewindClockRow> = [
      {color: 'blue', name: 'Blue player', now: '1:20:00', then: '1:05:30'},
      {color: 'red', name: 'Red player', now: '0:45:10', then: '0:40:00'},
    ];

    function mountWithClocks(rows = clocks) {
      return mount(RewindControls, {...globalConfig, props: {disabled: false, clocks: rows}});
    }

    it('lets the clocks go back unless told otherwise', () => {
      const wrapper = mountWithClocks();
      expect((wrapper.find('input[value=back]').element as HTMLInputElement).checked).is.true;
      expect((wrapper.find('input[value=keep]').element as HTMLInputElement).checked).is.false;
    });

    it('rewinds with the clocks that were chosen, the second being time back for everyone but the mover', async () => {
      expect(mountWithClocks().find('input[value=keep]').element.parentElement!.textContent).to.contain('Time back for everyone but the player whose move is undone');
      for (const choice of ['back', 'keep']) {
        const wrapper = mountWithClocks();
        await wrapper.find(`input[value=${choice}]`).setValue(true);
        await wrapper.find('.rewind-start').trigger('click');
        await wrapper.find('.rewind-confirm-button').trigger('click');
        expect(wrapper.emitted('rewind'), choice).to.deep.equal([['same', choice]]);
      }
    });

    it('shows what each clock reads now and at the move, or only the latter when there is no live game to read', () => {
      const cells = (wrapper: ReturnType<typeof mountWithClocks>) => wrapper.findAll('.rewind-clock-row').map((row) => row.findAll('td').map((cell) => cell.text()));
      expect(cells(mountWithClocks())).to.deep.equal([['Blue player', '1:20:00', '1:05:30'], ['Red player', '0:45:10', '0:40:00']]);
      expect(cells(mountWithClocks(clocks.map((row) => ({...row, now: ''}))))).to.deep.equal([['Blue player', '1:05:30'], ['Red player', '0:40:00']]);
    });
  });

  describe('in vote mode', () => {
    it('asks the others, with the cards that were chosen, instead of rewinding', async () => {
      const wrapper = mount(RewindControls, {...globalConfig, props: {disabled: false, mode: 'vote'}});
      await wrapper.find('input[value=shuffle]').setValue(true);
      await wrapper.find('.rewind-start').trigger('click');
      await wrapper.find('.rewind-confirm-button').trigger('click');
      expect(wrapper.emitted('request')).to.deep.equal([['shuffle']]);
      expect(wrapper.emitted('rewind')).is.undefined;
    });

    it('cannot be started while blocked', async () => {
      const wrapper = mount(RewindControls, {...globalConfig, props: {disabled: false, mode: 'vote', blocked: true}});
      expect(wrapper.find('.rewind-start').attributes('disabled')).not.is.undefined;
    });
  });

  it('says that a rewind to an undone move brings it back', async () => {
    for (const undone of [false, true]) {
      const wrapper = mount(RewindControls, {...globalConfig, props: {disabled: false, undone}});
      await wrapper.find('.rewind-start').trigger('click');
      expect(wrapper.find('.rewind-confirm-undone').exists(), String(undone)).equals(undone);
      await wrapper.find('.rewind-confirm-button').trigger('click');
      expect(wrapper.emitted('rewind'), String(undone)).to.deep.equal([['same', 'keep']]);
    }
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
