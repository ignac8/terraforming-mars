import {mount, shallowMount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import CreateGameForm from '@/client/components/create/CreateGameForm.vue';
import {createGameSettingsStorage} from '@/client/components/create/createGameSettingsStorage';
import {FakeLocalStorage} from '../FakeLocalStorage';
import {BoardName} from '@/common/boards/BoardName';
import {DEFAULT_EXPANSIONS} from '@/common/cards/GameModule';
import {JSONObject} from '@/common/Types';
import {defineComponent} from 'vue';
import {NewGameConfig} from '@/common/game/NewGameConfig';
import {CardName} from '@/common/cards/CardName';
import {CreateGameModel} from '@/client/components/create/CreateGameModel';
import {ValidationErrors} from '@/common/game/validateNewGameConfig';
import {ColonyName} from '@/common/colonies/ColonyName';
import {RandomMAOptionType} from '@/common/ma/RandomMAOptionType';

// Minimal serialized Create Game payload used by settings restore tests.
function createNewGameConfig(overrides: JSONObject = {}):  NewGameConfig {
  // Not ideal but is fine for the tests.
  const config: Partial<NewGameConfig> = {
    players: [
      {name: 'Alice', color: 'red', beginner: false, handicap: 0, first: false},
      {name: 'Bob', color: 'blue', beginner: false, handicap: 0, first: true},
    ],
    expansions: DEFAULT_EXPANSIONS,
    boards: [BoardName.HELLAS],
    draftVariant: false,
    solarPhaseOption: true,
    ...overrides,
  };
  return config as NewGameConfig;
}

/*
 * Returns `count` distinct card names of any type.
 *
 * Suitable only for checks that count a list's cards.
 */
function cardNames(count: number): Array<CardName> {
  return Object.values(CardName).slice(0, count);
}

/*
 * Returns the validation errors for a two-player game after `setup` adjusts the form.
 */
function validateTwoPlayerGame(setup: (model: CreateGameModel) => void): ValidationErrors {
  const wrapper = shallowMount(CreateGameForm, {
    ...globalConfig,
  });
  const model = wrapper.vm as unknown as CreateGameModel;
  model.playersCount = 2;
  setup(model);
  return (wrapper.vm as any).validationErrors;
}

describe('CreateGameForm', () => {
  let localStorage: FakeLocalStorage;

  beforeEach(() => {
    localStorage = new FakeLocalStorage();
    FakeLocalStorage.register(localStorage);
  });

  afterEach(() => {
    FakeLocalStorage.deregister(localStorage);
  });

  it('mounts without errors', () => {
    const wrapper = shallowMount(CreateGameForm, {
      ...globalConfig,
    });
    expect(wrapper.exists()).to.be.true;
  });

  it('default (automa-on) state has all official expansions, MarsBot corp, and draft on', () => {
    const wrapper = shallowMount(CreateGameForm, {...globalConfig});
    const vm = wrapper.vm as any;

    expect(vm.automa).to.be.true;
    expect(vm.automaCorpOption).to.be.true;
    expect(vm.automaNoGenerationLimit).to.be.false;
    expect(wrapper.find('#automa-no-generation-limit-checkbox').exists()).to.be.true;
    expect(vm.automaDifficulty).to.eq('normal');
    expect(vm.draftVariant).to.be.true;
    expect(vm.allOfficialExpansions).to.be.true;

    for (const e of ['corpera', 'prelude', 'prelude2', 'promo', 'venus', 'colonies', 'turmoil']) {
      expect(vm.expansions[e], e).to.be.true;
    }
    // CEO is a fan-made expansion and stays off by default.
    expect(vm.expansions.ceo).to.be.false;
  });

  it('turns Player undo on by default', () => {
    const wrapper = shallowMount(CreateGameForm, {...globalConfig});
    const vm = wrapper.vm as any;

    expect((wrapper.find('#undo-checkbox').element as HTMLInputElement).checked).to.be.true;
    expect(vm.newGameConfig.undoOption).to.be.true;
    vm.undoOption = false;
    expect(vm.newGameConfig.undoOption).to.be.false;
  });

  it('offers skipping MarsBot\'s corporation at final greeneries, off by default', () => {
    const wrapper = shallowMount(CreateGameForm, {...globalConfig});
    const vm = wrapper.vm as any;

    expect(wrapper.find('#automa-final-greenery-no-corp-checkbox').exists()).to.be.true;
    expect(vm.newGameConfig.automaFinalGreeneryNoCorpEffects).to.be.false;
    vm.automaFinalGreeneryNoCorpEffects = true;
    expect(vm.newGameConfig.automaFinalGreeneryNoCorpEffects).to.be.true;
  });

  it('offers keeping the original cards only with Promos, off by default', async () => {
    const wrapper = shallowMount(CreateGameForm, {...globalConfig});
    const vm = wrapper.vm as any;

    expect(wrapper.find('#keepReplacedCards-checkbox').exists()).to.be.true;
    expect(vm.newGameConfig.keepReplacedCards).to.be.false;
    vm.keepReplacedCards = true;
    expect(vm.newGameConfig.keepReplacedCards).to.be.true;

    vm.expansions.promo = false;
    await vm.$nextTick();
    expect(wrapper.find('#keepReplacedCards-checkbox').exists()).to.be.false;
  });

  it('offers MarsBot colony VP only with Colonies, off by default', async () => {
    const wrapper = shallowMount(CreateGameForm, {...globalConfig});
    const vm = wrapper.vm as any;

    expect(vm.automaColonyVP).to.be.false;
    expect(wrapper.find('#automa-colony-vp-checkbox').exists()).to.be.true;

    vm.expansions.colonies = false;
    await vm.$nextTick();
    expect(wrapper.find('#automa-colony-vp-checkbox').exists()).to.be.false;
  });

  it('sends MarsBot colony VP only when it is on and Colonies are in the game', async () => {
    const wrapper = shallowMount(CreateGameForm, {...globalConfig});
    const vm = wrapper.vm as any;

    expect(vm.newGameConfig.automaColonyVP).to.be.false;
    vm.automaColonyVP = true;
    expect(vm.newGameConfig.automaColonyVP).to.be.true;
    vm.expansions.colonies = false;
    expect(vm.newGameConfig.automaColonyVP).to.be.false;
  });

  it('groups the MarsBot options under Multiplayer Options, solo only', async () => {
    const wrapper = shallowMount(CreateGameForm, {...globalConfig});
    const vm = wrapper.vm as any;
    const stackHeadings = () => wrapper.findAll('.create-game-page-column-stack > .create-game-page-column > h4').map((h) => h.text());

    expect(stackHeadings()).to.deep.eq(['Multiplayer Options', 'MarsBot Options']);
    const column = wrapper.findAll('.create-game-page-column').find((c) => c.find('h4').text() === 'MarsBot Options');
    for (const id of ['automa-checkbox', 'automa-difficulty', 'automa-corp-checkbox', 'automa-no-generation-limit-checkbox',
      'automa-final-greenery-no-corp-checkbox', 'automa-colony-vp-checkbox', 'automa-turmoil-tr', 'automa-turmoil-delegates']) {
      expect(column?.find('#' + id).exists(), id).to.be.true;
    }

    // Solo without MarsBot hides Multiplayer Options, but the MarsBot switch stays.
    vm.automa = false;
    await vm.$nextTick();
    expect(stackHeadings()).to.deep.eq(['MarsBot Options']);

    vm.playersCount = 2;
    await vm.$nextTick();
    expect(stackHeadings()).to.deep.eq(['Multiplayer Options']);
  });

  it('Easiest sets every MarsBot option to its easiest value', () => {
    const wrapper = shallowMount(CreateGameForm, {...globalConfig});
    const vm = wrapper.vm as any;

    expect(vm.automaDifficultyChoice).to.eq('normal');
    vm.automaDifficultyChoice = 'easiest';
    expect(vm.automaDifficulty).to.eq('easy');
    expect(vm.automaCorpOption).to.be.false;
    expect(vm.automaNoGenerationLimit).to.be.true;
    expect(vm.automaFinalGreeneryNoCorpEffects).to.be.true;
    expect(vm.automaColonyVP).to.be.false;
    expect(vm.automaTurmoilTRReduction).to.eq(10);
    expect(vm.automaTurmoilSetupDelegates).to.eq(0);
    expect(vm.automaDifficultyChoice).to.eq('easiest');

    // Changing any one option leaves the preset, and the dropdown shows the plain difficulty again.
    vm.automaCorpOption = true;
    expect(vm.automaDifficultyChoice).to.eq('easy');
  });

  it('Hardest sets every MarsBot option to its hardest value', () => {
    const wrapper = shallowMount(CreateGameForm, {...globalConfig});
    const vm = wrapper.vm as any;

    vm.automaDifficultyChoice = 'hardest';
    expect(vm.automaDifficulty).to.eq('brutal');
    expect(vm.automaCorpOption).to.be.true;
    expect(vm.automaNoGenerationLimit).to.be.false;
    expect(vm.automaFinalGreeneryNoCorpEffects).to.be.false;
    expect(vm.automaColonyVP).to.be.true;
    expect(vm.automaTurmoilTRReduction).to.eq(7);
    expect(vm.automaTurmoilSetupDelegates).to.eq(2);
    expect(vm.automaDifficultyChoice).to.eq('hardest');

    // A plain difficulty changes only the difficulty.
    vm.automaDifficultyChoice = 'hard';
    expect(vm.automaDifficulty).to.eq('hard');
    expect(vm.automaTurmoilSetupDelegates).to.eq(2);
    expect(vm.automaDifficultyChoice).to.eq('hard');
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

  it('lets the board selector offer only MarsBot boards while automa is on', async () => {
    const wrapper = shallowMount(CreateGameForm, {...globalConfig});
    const vm = wrapper.vm as any;
    const isBoardDisabled = wrapper.findComponent({name: 'BoardSelector'}).props('isBoardDisabled');

    expect(isBoardDisabled(BoardName.HELLAS)).is.false;
    expect(isBoardDisabled(BoardName.ARABIA_TERRA)).is.true;
    expect(isBoardDisabled(BoardName.AMAZONIS_PLANITIA)).is.true;

    vm.automa = false;
    await vm.$nextTick();
    expect(isBoardDisabled(BoardName.ARABIA_TERRA)).is.false;
  });

  for (const run of [
    {boards: [BoardName.AMAZONIS_PLANITIA, BoardName.HELLAS, BoardName.ARABIA_TERRA], expected: [BoardName.HELLAS]},
    {boards: [BoardName.AMAZONIS_PLANITIA, BoardName.ARABIA_TERRA], expected: [BoardName.THARSIS]},
  ] as const) {
    it(`enabling automa keeps only the selected MarsBot boards ${JSON.stringify(run)}`, async () => {
      const wrapper = shallowMount(CreateGameForm, {...globalConfig});
      const vm = wrapper.vm as any;
      vm.automa = false;
      await vm.$nextTick();
      vm.boards = [...run.boards];
      vm.automa = true;
      await vm.$nextTick();
      expect(vm.boards).deep.eq(run.expected);
    });
  }

  it('enabling automa disables fan-made expansions and force-offs incompatible options', async () => {
    const wrapper = shallowMount(CreateGameForm, {...globalConfig});
    const vm = wrapper.vm as any;

    vm.automa = false;
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

    vm.automa = true;
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
    vm.automa = false;
    await vm.$nextTick();
    vm.expansions.venus = false;
    vm.automa = true;
    await vm.$nextTick();
    expect(vm.expansions.venus).to.be.false;
  });

  // Generic guard for the whole bug class: any control that is greyed/disabled
  // under automa AND force-set by the automa watcher must have a matching
  // default in defaultCreateGameModel. Since the form defaults to automa-on and
  // watchers do not fire on mount, the default state must already equal the
  // state the watcher enforces. Toggling automa off->on re-runs the watcher; if
  // any default disagrees the snapshots differ and the diff names the field.
  it('default automa-on state already matches what the automa watcher enforces', async () => {
    const wrapper = shallowMount(CreateGameForm, {...globalConfig});
    const vm = wrapper.vm as any;
    expect(vm.automa).to.be.true;

    const snapshot = () => JSON.parse(JSON.stringify(vm.$data));
    const defaultState = snapshot();

    vm.automa = false;
    await vm.$nextTick();
    vm.automa = true;
    await vm.$nextTick();

    expect(snapshot()).to.deep.equal(defaultState);
  });

  it('restores the last saved game settings on load', async () => {
    createGameSettingsStorage.save(createNewGameConfig({
      expansions: {...DEFAULT_EXPANSIONS, venus: true},
    }));

    const wrapper = shallowMount(CreateGameForm, {
      ...globalConfig,
    });
    await wrapper.vm.$nextTick();

    expect((wrapper.vm as any).playersCount).eq(2);
    expect((wrapper.vm as any).players[0].name).eq('Alice');
    expect((wrapper.vm as any).players[1].name).eq('Bob');
    expect((wrapper.vm as any).boards).deep.eq([BoardName.HELLAS]);
    expect((wrapper.vm as any).draftVariant).eq(false);
    expect((wrapper.vm as any).expansions.venus).eq(true);
    expect((wrapper.vm as any).solarPhaseOption).eq(true);
  });

  it('shows warnings when restoring saved settings', async () => {
    const alerts: Array<{title: string, message: string}> = [];
    const Root = defineComponent({
      components: {
        CreateGameForm,
      },
      template: '<CreateGameForm ref="form" />',
    });
    const wrapper = mount(Root, {
      ...globalConfig,
    });
    const form = wrapper.findComponent(CreateGameForm);
    (form.vm.$root as any).showAlert = (title: string, message: string) => {
      alerts.push({title, message});
    };

    createGameSettingsStorage.save(createNewGameConfig({
      customPreludes: ['Bad Prelude Name'],
    }));

    (form.vm as any).restoreLastSettings();
    await form.vm.$nextTick();

    expect(alerts).deep.eq([{
      title: 'Restore settings',
      message: "Settings loaded with these warnings: \nUnknown card name 'Bad Prelude Name' in customPreludes",
    }]);
  });

  it('resets the form and clears saved settings', async () => {
    createGameSettingsStorage.save(createNewGameConfig());

    const wrapper = shallowMount(CreateGameForm, {
      ...globalConfig,
    });
    await wrapper.vm.$nextTick();

    expect((wrapper.vm as any).boards).deep.eq([BoardName.HELLAS]);

    (wrapper.vm as any).resetSettings();
    await wrapper.vm.$nextTick();

    expect((wrapper.vm as any).boards).deep.eq([BoardName.THARSIS]);
    expect((wrapper.vm as any).draftVariant).eq(true);
    expect(createGameSettingsStorage.load()).eq(undefined);
    expect(wrapper.findAllComponents({name: 'AppButton'}).map((button) => button.props('title'))).includes('Reset');
  });

  it('clears uploading when applying settings throws', () => {
    const wrapper = shallowMount(CreateGameForm, {
      ...globalConfig,
    });

    expect(() => (wrapper.vm as any).applySettings(createNewGameConfig({
      players: [
        {name: 'Alice', color: 'red', beginner: false, handicap: 0},
        {name: 'Bob', color: 'red', beginner: false, handicap: 0},
      ],
    }))).throws('Colors are duplicated');
    expect((wrapper.vm as any).uploading).eq(false);
  });

  it('saves current settings before creating a game', async () => {
    const originalFetch = global.fetch;
    const originalAlert = global.alert;
    global.fetch = (() => Promise.reject(new Error('stop after saving'))) as typeof fetch;
    global.alert = (() => {}) as typeof alert;

    try {
      const wrapper = shallowMount(CreateGameForm, {
        ...globalConfig,
      });
      (wrapper.vm as any).playersCount = 2;
      (wrapper.vm as any).randomFirstPlayer = false;
      (wrapper.vm as any).players[0].name = 'Alice';
      (wrapper.vm as any).players[1].name = 'Bob';
      (wrapper.vm as any).boards = [BoardName.ELYSIUM];

      await (wrapper.vm as any).createGame();

      const savedSettings = createGameSettingsStorage.load();
      expect(savedSettings?.boards).deep.eq([BoardName.ELYSIUM]);
      expect((savedSettings?.players as Array<{name: string}>).map((player) => player.name)).deep.eq(['Alice', 'Bob']);
    } finally {
      global.fetch = originalFetch;
      global.alert = originalAlert;
    }
  });
  it('toggling random milestones and awards leaves manual milestones and awards', () => {
    const wrapper = shallowMount(CreateGameForm, {
      ...globalConfig,
    });
    const model = wrapper.vm as unknown as CreateGameModel;
    model.randomMA = RandomMAOptionType.MANUAL;
    model.customMA = {milestones: ['Terraformer'], awards: ['Banker']};
    expect((wrapper.vm as any).isRandomMAEnabled).is.false;

    (wrapper.vm as any).randomMAToggle();
    expect(model.randomMA).eq(RandomMAOptionType.LIMITED);
    expect(model.customMA).is.undefined;
  });

  it('validates the form settings', () => {
    expect(validateTwoPlayerGame((model) => model.customCorporations = cardNames(3)).notEnoughCorporations).eq(4);
    expect(validateTwoPlayerGame((model) => model.customCorporations = cardNames(4)).notEnoughCorporations).eq(0);
  });

  it('ignores unknown colony names when validating', () => {
    const errors = validateTwoPlayerGame((model) => model.customColonies = ['Unknown Colony' as ColonyName]);
    expect(errors.coloniesMissingExpansions).deep.eq([]);
  });

  it('disables Create game when there is a blocking error', async () => {
    const wrapper = shallowMount(CreateGameForm, {
      ...globalConfig,
    });
    const createGameButton = () => wrapper.findAllComponents({name: 'AppButton'}).find((button) => button.props('title') === 'Create game');
    expect(createGameButton()?.props('disabled')).is.false;
    expect(wrapper.find('.create-game-custom-preludes-warning').exists()).is.false;

    (wrapper.vm as any).playersCount = 2;
    (wrapper.vm as any).customCorporations = cardNames(3);
    await wrapper.vm.$nextTick();

    expect(createGameButton()?.props('disabled')).is.true;
    expect(wrapper.find('.create-game-custom-preludes-warning').exists()).is.true;
  });

  it('replaces a cleared escape velocity field with its default', async () => {
    const wrapper = shallowMount(CreateGameForm, {
      ...globalConfig,
    });
    const model = wrapper.vm as unknown as CreateGameModel;
    model.playersCount = 2;
    model.escapeVelocityMode = true;
    model.escapeVelocityThreshold = 35;
    // A cleared number input binds as an empty string.
    model.escapeVelocityPeriod = '' as unknown as number;
    const config: NewGameConfig | undefined = await (wrapper.vm as any).serializeSettings();
    expect(config?.escapeVelocity).deep.eq({
      thresholdMinutes: 35,
      bonusSectionsPerAction: 2,
      penaltyPeriodMinutes: 2,
      penaltyVPPerPeriod: 1,
    });
  });
});
