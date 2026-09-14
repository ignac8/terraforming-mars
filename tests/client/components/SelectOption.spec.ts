import {mount, shallowMount, VueWrapper} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from './getLocalVue';
import SelectOption from '@/client/components/SelectOption.vue';
import ConfirmDialog from '@/client/components/common/ConfirmDialog.vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {SelectOptionModel} from '@/common/models/PlayerInputModel';
import {InputResponse} from '@/common/inputs/InputResponse';
import {PreferencesManager} from '@/client/utils/PreferencesManager';

let savedData: InputResponse | undefined;

describe('SelectOption', () => {
  beforeEach(() => {
    savedData = undefined;
    PreferencesManager.INSTANCE.set('show_alerts', true);
  });

  afterEach(() => {
    PreferencesManager.INSTANCE.set('show_alerts', true);
  });

  it('mounts without errors', () => {
    const wrapper = shallowMount(SelectOption, {
      ...globalConfig,
      props: {
        playerView: {} as PlayerViewModel,
        playerinput: {
          title: 'Do something',
          buttonLabel: 'OK',
          type: 'option',
        },
        onsave: () => {},
        showsave: true,
        showtitle: true,
      },
    });
    expect(wrapper.exists()).to.be.true;
  });

  it('saves an ordinary option without asking for confirmation', async () => {
    const component = createComponent({title: 'Do something', buttonLabel: 'OK'});

    await getButton(component).trigger('click');

    expect(savedData).to.deep.eq({type: 'option'});
    expect(component.findComponent(ConfirmDialog).exists()).is.false;
  });

  it('asks for confirmation before passing', async () => {
    const component = createComponent(passOption());

    await getButton(component).trigger('click');

    expect(savedData).is.undefined;
    expect(getConfirmDialog(component).$data.shown).is.true;
  });

  it('passes once the confirmation is accepted', async () => {
    const component = createComponent(passOption());
    await getButton(component).trigger('click');

    getConfirmDialog(component).$emit('accept');
    await component.vm.$nextTick();

    expect(savedData).to.deep.eq({type: 'option'});
  });

  it('does not pass when the confirmation is dismissed', async () => {
    const component = createComponent(passOption());
    await getButton(component).trigger('click');

    getConfirmDialog(component).$emit('dismiss');
    await component.vm.$nextTick();

    expect(savedData).is.undefined;
  });

  it('passes without confirmation when alerts are disabled', async () => {
    PreferencesManager.INSTANCE.set('show_alerts', false);
    const component = createComponent(passOption());

    await getButton(component).trigger('click');

    expect(savedData).to.deep.eq({type: 'option'});
  });
});

function passOption(): Omit<SelectOptionModel, 'type'> {
  return {
    title: 'Pass for this generation',
    buttonLabel: 'Pass',
    warnings: ['pass'],
  };
}

function createComponent(playerinput: Omit<SelectOptionModel, 'type'>) {
  return mount(SelectOption, {
    ...globalConfig,
    props: {
      playerView: {} as PlayerViewModel,
      playerinput: {...playerinput, type: 'option'},
      onsave: (data: InputResponse) => {
        savedData = data;
      },
      showsave: true,
      showtitle: true,
    },
  });
}

function getButton(component: VueWrapper<InstanceType<typeof SelectOption>>) {
  return component.findComponent({name: 'AppButton'});
}

function getConfirmDialog(component: VueWrapper<InstanceType<typeof SelectOption>>): InstanceType<typeof ConfirmDialog> {
  return component.findComponent(ConfirmDialog).vm as InstanceType<typeof ConfirmDialog>;
}
