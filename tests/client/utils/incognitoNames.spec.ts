import {expect} from 'chai';
import {translateFakeNames} from '@/client/utils/incognitoNames';
import {setTranslationsForTest} from '@/client/directives/i18n';
import {PreferencesManager} from '@/client/utils/PreferencesManager';
import {Phase} from '@/common/Phase';
import {JudgeModel} from '@/common/models/JudgeModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {PlayerId} from '@/common/Types';
import {fakeGameModel, fakeGameOptionsModel, fakePlayerViewModel, fakePublicPlayerModel, fakeSpectatorModel} from '../components/testHelpers';

describe('incognitoNames', () => {
  function reset() {
    localStorage.removeItem('lang');
    PreferencesManager.resetForTest();
    setTranslationsForTest(undefined);
  }

  // Client tests share module state across files (isolate: false), so don't
  // assume earlier files left the language at its default.
  beforeEach(() => {
    reset();
    PreferencesManager.INSTANCE.set('lang', 'pl');
    setTranslationsForTest({Red: 'Czerwony', Blue: 'Niebieski'});
  });
  afterEach(reset);

  // The viewer sits in the green seat. The blue opponent shows under the fake name "Red".
  function incognitoView(options: {incognito?: boolean, phase?: Phase, viewerName?: string} = {}): PlayerViewModel {
    const viewer = fakePublicPlayerModel({color: 'green', name: options.viewerName ?? 'Alice'});
    const opponent = fakePublicPlayerModel({color: 'blue', name: 'Red'});
    return fakePlayerViewModel({
      color: 'green',
      thisPlayer: viewer,
      players: [viewer, opponent],
      game: fakeGameModel({
        gameOptions: fakeGameOptionsModel({incognito: options.incognito ?? true}),
        phase: options.phase ?? Phase.ACTION,
        milestones: [{name: 'Terraformer', playerName: 'Red', color: 'blue', scores: []}],
      }),
    });
  }

  it('translates the fake name of an opponent and of a milestone claimant', () => {
    const view = incognitoView();

    const result = translateFakeNames(view);

    expect(result.players.map((p) => p.name)).deep.eq(['Alice', 'Czerwony']);
    expect(result.game.milestones[0].playerName).eq('Czerwony');
    expect(view.players[1].name).eq('Red');
  });

  it('translates the fake name Clear as the color, not as the Clear button', () => {
    setTranslationsForTest({Transparent: 'Przezroczysty', Clear: 'Wyczyść'});
    const view = incognitoView();
    view.players[1].name = 'Clear';

    expect(translateFakeNames(view).players[1].name).eq('Przezroczysty');
  });

  it('leaves a card that shares the label alone', () => {
    const view = incognitoView();
    view.players[1].tableau = [{name: 'Red'} as any];

    const result = translateFakeNames(view);

    expect(result.players[1].tableau[0].name).eq('Red');
  });

  it('translates every seat of a spectator model', () => {
    const spectator = {
      ...fakeSpectatorModel(),
      thisPlayer: undefined,
      players: [fakePublicPlayerModel({color: 'blue', name: 'Red'}), fakePublicPlayerModel({color: 'red', name: 'Blue'})],
      game: fakeGameModel({gameOptions: fakeGameOptionsModel({incognito: true})}),
    };

    const result = translateFakeNames(spectator);

    expect(result.players.map((p) => p.name)).deep.eq(['Czerwony', 'Niebieski']);
  });

  it('translates every seat of a judge model, which has no seat of its own', () => {
    const judge = {
      ...fakeSpectatorModel(),
      id: 'j-judge-id',
      thisPlayer: undefined,
      signature: 'sig',
      password: undefined,
      privates: [{color: 'blue'}, {color: 'red'}],
      players: [fakePublicPlayerModel({color: 'blue', name: 'Red'}), fakePublicPlayerModel({color: 'red', name: 'Blue'})],
      game: fakeGameModel({
        gameOptions: fakeGameOptionsModel({incognito: true}),
        milestones: [{name: 'Terraformer', playerName: 'Red', color: 'blue', scores: []}],
      }),
    } as unknown as JudgeModel;

    const result = translateFakeNames(judge);

    expect(result.players.map((p) => p.name)).deep.eq(['Czerwony', 'Niebieski']);
    expect(result.game.milestones[0].playerName).eq('Czerwony');
    expect(result.privates).deep.eq(judge.privates);
    expect(judge.players[0].name).eq('Red');
  });

  it('translates the name of the seat that a judge views as, which no viewer owns', () => {
    const viewed = fakePublicPlayerModel({color: 'blue', name: 'Red'});
    const view = fakePlayerViewModel({
      id: 'j-judge-id' as unknown as PlayerId,
      color: 'blue',
      thisPlayer: viewed,
      players: [viewed, fakePublicPlayerModel({color: 'red', name: 'Blue'})],
      game: fakeGameModel({gameOptions: fakeGameOptionsModel({incognito: true})}),
    });

    const result = translateFakeNames(view);

    expect(result.thisPlayer.name).eq('Czerwony');
    expect(result.players.map((p) => p.name)).deep.eq(['Czerwony', 'Niebieski']);
  });

  it('keeps the names of a judge model after the game ended', () => {
    const judge = {
      ...fakeSpectatorModel(),
      id: 'j-judge-id',
      thisPlayer: undefined,
      players: [fakePublicPlayerModel({color: 'blue', name: 'Red'})],
      game: fakeGameModel({gameOptions: fakeGameOptionsModel({incognito: true}), phase: Phase.END}),
    } as unknown as JudgeModel;

    expect(translateFakeNames(judge).players[0].name).eq('Red');
  });

  it('keeps the name of a viewer who really is called like a color', () => {
    const view = incognitoView({viewerName: 'Red'});

    const result = translateFakeNames(view);

    expect(result.thisPlayer.name).eq('Red');
    expect(result.players[0].name).eq('Red');
  });

  it('keeps the names after the game ended', () => {
    const view = incognitoView({phase: Phase.END});

    expect(translateFakeNames(view).players[1].name).eq('Red');
  });

  it('keeps the names when the game is not incognito', () => {
    const view = incognitoView({incognito: false});

    const result = translateFakeNames(view);

    expect(result).eq(view);
    expect(result.players[1].name).eq('Red');
  });
});
