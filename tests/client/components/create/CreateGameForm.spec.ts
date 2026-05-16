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
    expect(vm.randomFirstPlayer).to.be.false;
    expect(vm.showColoniesList).to.be.false;
    expect(vm.customColonies).to.deep.equal([]);
    expect(vm.solarPhaseOption).to.be.false;
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
    vm.randomFirstPlayer = true;
    vm.showColoniesList = true;
    vm.customColonies = ['Ceres'];
    vm.solarPhaseOption = true;

    vm.automaOption = true;
    await vm.$nextTick();

    // Incompatible options and fan-made expansions are forced off.
    expect(vm.altVenusBoard).to.be.false;
    expect(vm.requiresVenusTrackCompletion).to.be.false;
    expect(vm.fastModeOption).to.be.false;
    expect(vm.escapeVelocityMode).to.be.false;
    expect(vm.randomFirstPlayer).to.be.false;
    expect(vm.showColoniesList).to.be.false;
    expect(vm.customColonies).to.deep.equal([]);
    expect(vm.solarPhaseOption).to.be.false;
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

  // Generic guard for the whole bug class: any control that is greyed/disabled
  // under automa AND force-set by the automaOption watcher must have a matching
  // default in defaultCreateGameModel. Since the form defaults to automa-on and
  // watchers do not fire on mount, the default state must already equal the
  // state the watcher enforces. Toggling automa off->on re-runs the watcher; if
  // any default disagrees the snapshots differ and the diff names the field.
  it('default automa-on state already matches what the automa watcher enforces', async () => {
    const wrapper = shallowMount(CreateGameForm, {...globalConfig});
    const vm = wrapper.vm as any;
    expect(vm.automaOption).to.be.true;

    const snapshot = () => JSON.parse(JSON.stringify(vm.$data));
    const defaultState = snapshot();

    vm.automaOption = false;
    await vm.$nextTick();
    vm.automaOption = true;
    await vm.$nextTick();

    expect(snapshot()).to.deep.equal(defaultState);
  });
});
