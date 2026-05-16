import {shallowMount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import CreateGameForm from '@/client/components/create/CreateGameForm.vue';

describe('CreateGameForm', () => {
  it('mounts without errors', () => {
    const wrapper = shallowMount(CreateGameForm, {
      ...globalConfig,
    });
    expect(wrapper.exists()).to.be.true;
  });

  it('default (automa-on) state has all official expansions and automa play defaults', () => {
    const wrapper = shallowMount(CreateGameForm, {...globalConfig});
    const vm = wrapper.vm as any;

    expect(vm.automaOption).to.be.true;
    expect(vm.automaCorpOption).to.be.true;
    expect(vm.automaDifficulty).to.eq('normal');
    expect(vm.draftVariant).to.be.true;
    expect(vm.allOfficialExpansions).to.be.true;

    for (const e of ['corpera', 'prelude', 'prelude2', 'promo', 'venus', 'colonies', 'turmoil']) {
      expect(vm.expansions[e], e).to.be.true;
    }
  });

  it('default (automa-on) state disables options incompatible with automa', () => {
    const wrapper = shallowMount(CreateGameForm, {...globalConfig});
    const vm = wrapper.vm as any;

    expect(vm.altVenusBoard).to.be.false;
    expect(vm.requiresVenusTrackCompletion).to.be.false;
    expect(vm.fastModeOption).to.be.false;
    expect(vm.escapeVelocityMode).to.be.false;
    expect(vm.expansions.deltaProject).to.be.false;
  });

  it('re-enabling automa re-applies official expansions and force-offs incompatible options', async () => {
    const wrapper = shallowMount(CreateGameForm, {...globalConfig});
    const vm = wrapper.vm as any;

    vm.automaOption = false;
    await vm.$nextTick();
    // User turns on incompatible options while automa is off.
    vm.altVenusBoard = true;
    vm.requiresVenusTrackCompletion = true;
    vm.fastModeOption = true;
    vm.escapeVelocityMode = true;
    vm.expansions.deltaProject = true;
    vm.expansions.moon = true;
    vm.automaCorpOption = false;
    vm.draftVariant = false;

    vm.automaOption = true;
    await vm.$nextTick();

    expect(vm.altVenusBoard).to.be.false;
    expect(vm.requiresVenusTrackCompletion).to.be.false;
    expect(vm.fastModeOption).to.be.false;
    expect(vm.escapeVelocityMode).to.be.false;
    expect(vm.expansions.deltaProject).to.be.false;
    expect(vm.expansions.moon).to.be.false;
    expect(vm.automaCorpOption).to.be.true;
    expect(vm.draftVariant).to.be.true;
    expect(vm.expansions.venus).to.be.true;
  });
});
