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

  it('default (automa-on) state has all official expansions, MarsBot corp, and draft on', () => {
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
    // CEO is a fan-made expansion and stays off by default.
    expect(vm.expansions.ceo).to.be.false;
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

  it('enabling automa disables fan-made expansions and force-offs incompatible options', async () => {
    const wrapper = shallowMount(CreateGameForm, {...globalConfig});
    const vm = wrapper.vm as any;

    vm.automaOption = false;
    await vm.$nextTick();
    // User turns on fan-made expansions and incompatible options while automa is off.
    vm.altVenusBoard = true;
    vm.requiresVenusTrackCompletion = true;
    vm.fastModeOption = true;
    vm.escapeVelocityMode = true;
    vm.expansions.deltaProject = true;
    vm.expansions.moon = true;
    vm.expansions.ceo = true;

    vm.automaOption = true;
    await vm.$nextTick();

    // Incompatible options and fan-made expansions are forced off.
    expect(vm.altVenusBoard).to.be.false;
    expect(vm.requiresVenusTrackCompletion).to.be.false;
    expect(vm.fastModeOption).to.be.false;
    expect(vm.escapeVelocityMode).to.be.false;
    expect(vm.expansions.deltaProject).to.be.false;
    expect(vm.expansions.moon).to.be.false;
    expect(vm.expansions.ceo).to.be.false;
    // Automa does not force-enable official expansions; user's prior off-state is kept.
    vm.automaOption = false;
    await vm.$nextTick();
    vm.expansions.venus = false;
    vm.automaOption = true;
    await vm.$nextTick();
    expect(vm.expansions.venus).to.be.false;
  });
});
