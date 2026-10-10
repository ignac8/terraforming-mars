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

// Minimal serialized Create Game payload used by settings restore tests.
function createNewGameConfig(overrides: JSONObject = {}):  NewGameConfig {
  // Not ideal but is fine for the tests.
  const config: Partial<NewGameConfig> = {
    players: [
      {name: 'Alice', color: 'red', beginner: false, handicap: 0, first: false},
      {name: 'Bob', color: 'blue', beginner: false, handicap: 0, first: true},
    ],
    expansions: DEFAULT_EXPANSIONS,
    board: BoardName.HELLAS,
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

  function expectTournamentLocks(vm: any) {
    expect(vm.undoOption).eq(false);
    expect(vm.fastModeOption).eq(false);
    expect(vm.showOtherPlayersVP).eq(false);
    expect(vm.playerPasswords).eq(true);
    for (const player of vm.players) {
      expect(player.handicap).eq(0);
    }
    for (const flag of ['showCorporationList', 'showPreludesList', 'showColoniesList',
      'showCeosList', 'showBannedCards', 'showIncludedCards']) {
      expect(vm[flag], flag).eq(false);
    }
    for (const list of ['customCorporations', 'customPreludes', 'customColonies',
      'customCeos', 'bannedCards', 'includedCards']) {
      expect(vm[list], list).is.empty;
    }
    expect(vm.expansions.prelude).eq(false);
  }

  function seedLockedFields(vm: any) {
    vm.undoOption = true;
    vm.fastModeOption = true;
    vm.showOtherPlayersVP = true;
    vm.playerPasswords = false;
    vm.players[0].handicap = 4;
    vm.showCorporationList = true;
    vm.showBannedCards = true;
    vm.showIncludedCards = true;
    vm.customCorporations = ['Teractor'];
    vm.customPreludes = ['Donation'];
    vm.customColonies = ['Europa'];
    vm.customCeos = ['Floyd'];
    vm.bannedCards = ['Mine'];
    vm.includedCards = ['Mine'];
  }

  it('applies tournament locks on first load', async () => {
    const wrapper = shallowMount(CreateGameForm, {...globalConfig});
    await wrapper.vm.$nextTick();

    expectTournamentLocks(wrapper.vm as any);
    for (const id of ['#undo-checkbox', '#customCorps-checkbox', '#bannedCards-checkbox',
      '#includedCards-checkbox', '#realTimeVP-checkbox', '#fastMode-checkbox',
      '#playerPasswords-checkbox']) {
      expect(wrapper.find(id).attributes('disabled'), id).is.not.undefined;
    }
  });

  it('applies tournament locks when tournament is switched back on', async () => {
    const wrapper = shallowMount(CreateGameForm, {...globalConfig});
    await wrapper.vm.$nextTick();
    const vm = wrapper.vm as any;

    vm.expansions.tournament = false;
    await wrapper.vm.$nextTick();
    vm.expansions.prelude = true;
    seedLockedFields(vm);
    await wrapper.vm.$nextTick();

    vm.expansions.tournament = true;
    await wrapper.vm.$nextTick();

    expectTournamentLocks(vm);
  });

  it('re-enables the undo control when tournament is switched off', async () => {
    const wrapper = shallowMount(CreateGameForm, {...globalConfig});
    await wrapper.vm.$nextTick();
    expect(wrapper.find('#undo-checkbox').attributes('disabled')).is.not.undefined;

    (wrapper.vm as any).expansions.tournament = false;
    await wrapper.vm.$nextTick();

    expect(wrapper.find('#undo-checkbox').attributes('disabled')).is.undefined;
  });

  it('does not keep tournament player passwords when tournament is switched off', async () => {
    const wrapper = shallowMount(CreateGameForm, {...globalConfig});
    await wrapper.vm.$nextTick();
    const vm = wrapper.vm as any;
    expect(vm.playerPasswords).eq(true);

    vm.expansions.tournament = false;
    await wrapper.vm.$nextTick();

    expect(vm.playerPasswords).eq(false);
  });

  it('restores player passwords from a saved non-tournament config', async () => {
    createGameSettingsStorage.save(createNewGameConfig({
      expansions: {...DEFAULT_EXPANSIONS, tournament: false},
      playerPasswords: true,
    }));

    const wrapper = shallowMount(CreateGameForm, {...globalConfig});
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    const vm = wrapper.vm as any;
    expect(vm.expansions.tournament).eq(false);
    expect(vm.playerPasswords).eq(true);
  });

  it('defaults player passwords off when restoring a saved non-tournament config without the key', async () => {
    createGameSettingsStorage.save(createNewGameConfig({
      expansions: {...DEFAULT_EXPANSIONS, tournament: false},
    }));

    const wrapper = shallowMount(CreateGameForm, {...globalConfig});
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    const vm = wrapper.vm as any;
    expect(vm.expansions.tournament).eq(false);
    expect(vm.playerPasswords).eq(false);
  });

  it('applies tournament locks when restoring saved tournament settings', async () => {
    createGameSettingsStorage.save(createNewGameConfig({
      players: [
        {name: 'Alice', color: 'red', beginner: false, handicap: 3, first: false},
        {name: 'Bob', color: 'blue', beginner: false, handicap: 0, first: true},
      ],
      expansions: {...DEFAULT_EXPANSIONS, tournament: true, prelude: true},
      undoOption: true,
      fastModeOption: true,
      showOtherPlayersVP: true,
      playerPasswords: false,
      customCorporationsList: ['Teractor'],
      customPreludes: ['Donation'],
      bannedCards: ['Mine'],
      includedCards: ['Mine'],
    }));

    const wrapper = shallowMount(CreateGameForm, {...globalConfig});
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    expectTournamentLocks(wrapper.vm as any);
  });

  it('applies tournament locks when restoring the legacy flat tournament key', async () => {
    createGameSettingsStorage.save({
      players: [
        {name: 'Alice', color: 'red', beginner: false, handicap: 3, first: true},
        {name: 'Bob', color: 'blue', beginner: false, handicap: 0, first: false},
      ],
      tournamentExpansion: true,
      solarPhaseOption: false,
      undoOption: true,
      customCorporationsList: ['Teractor'],
    } as unknown as NewGameConfig);

    const wrapper = shallowMount(CreateGameForm, {...globalConfig});
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    const vm = wrapper.vm as any;
    // The defaults have empty names, so this proves the saved settings were applied.
    expect(vm.players[0].name).eq('Alice');
    expect(vm.expansions.tournament).eq(true);
    expectTournamentLocks(vm);
  });

  it('applies tournament locks after Reset', async () => {
    const wrapper = shallowMount(CreateGameForm, {...globalConfig});
    await wrapper.vm.$nextTick();
    const vm = wrapper.vm as any;
    seedLockedFields(vm);

    vm.resetSettings();
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    expectTournamentLocks(vm);
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
    expect((wrapper.vm as any).board).eq(BoardName.HELLAS);
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

    expect((wrapper.vm as any).board).eq(BoardName.HELLAS);

    (wrapper.vm as any).resetSettings();
    await wrapper.vm.$nextTick();

    expect((wrapper.vm as any).board).eq(BoardName.THARSIS);
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
    // The failed restore must not leave the tournament password lock cleared.
    expect((wrapper.vm as any).playerPasswords).eq(true);
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
      (wrapper.vm as any).board = BoardName.ELYSIUM;

      await (wrapper.vm as any).createGame();

      const savedSettings = createGameSettingsStorage.load();
      expect(savedSettings?.board).eq(BoardName.ELYSIUM);
      expect((savedSettings?.players as Array<{name: string}>).map((player) => player.name)).deep.eq(['Alice', 'Bob']);
    } finally {
      global.fetch = originalFetch;
      global.alert = originalAlert;
    }
  });

  it('validates the form settings', () => {
    // Tournament rules are on by default, and they deal 5 corporations to each player.
    expect(validateTwoPlayerGame((model) => model.customCorporations = cardNames(9)).notEnoughCorporations).eq(10);
    expect(validateTwoPlayerGame((model) => model.customCorporations = cardNames(10)).notEnoughCorporations).eq(0);
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
