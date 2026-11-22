import {expect} from 'chai';
import {testGame} from '../TestGame';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {SerializedAutomaState, SerializedGame} from '../../src/server/SerializedGame';
import {MarsBot} from '../../src/server/automa/MarsBot';
import {BoardName} from '../../src/common/boards/BoardName';
import {GlobalParameter} from '../../src/common/GlobalParameter';
import {Phase} from '../../src/common/Phase';
import {createBonusCard} from '../../src/server/automa/bonusCards/MarsBotBonusCards';
import {BonusCardName} from '../../src/common/automa/BonusCardName';
import {CardName} from '../../src/common/cards/CardName';
import {Asteroid} from '../../src/server/cards/base/Asteroid';
import {Research} from '../../src/server/cards/base/Research';
import {Greenhouses} from '../../src/server/cards/base/Greenhouses';
import {Tag} from '../../src/common/cards/Tag';
import {loadSandboxGame} from '../../src/server/replay/sandbox';
import {Thermalist} from '../../src/server/awards/Thermalist';
import {getMarsBotCorp} from '../../src/server/automa/corps/MarsBotCorpRegistry';
import {Mine} from '../../src/server/cards/base/Mine';
import {Tardigrades} from '../../src/server/cards/base/Tardigrades';
import {InvasiveSpecies} from '../../src/server/automa/bonusCards/InvasiveSpecies';
import {InterfaceHyperlink} from '../../src/server/automa/bonusCards/InterfaceHyperlink';
import {MeteorShower} from '../../src/server/automa/bonusCards/MeteorShower';
import {ResearchAndDevelopment} from '../../src/server/automa/bonusCards/ResearchAndDevelopment';
import {ExpeditedConstruction} from '../../src/server/automa/bonusCards/ExpeditedConstruction';

function createAutomaGame(): {game: IGame, marsBot: MarsBot} {
  const [game] = testGame(1, {
    automa: true,
    automaDifficulty: 'easy',
    boardName: BoardName.THARSIS,
  });
  return {game, marsBot: game.automaHooks!.marsBot};
}

describe('MarsBotReload', () => {
  it('keeps the terraform rating across a reload', () => {
    const {game, marsBot} = createAutomaGame();
    marsBot.player.setTerraformRating(30);

    const restored = Game.deserialize(game.serialize());

    expect(restored.automaHooks!.marsBot.player.terraformRating).to.eq(30);
  });

  it('keeps the global parameter steps across a reload', () => {
    const {game, marsBot} = createAutomaGame();
    marsBot.player.globalParameterSteps[GlobalParameter.OXYGEN] = 3;
    marsBot.player.globalParameterSteps[GlobalParameter.VENUS] = 4;

    const restored = Game.deserialize(game.serialize());

    const steps = restored.automaHooks!.marsBot.player.globalParameterSteps;
    expect(steps[GlobalParameter.OXYGEN]).to.eq(3);
    expect(steps[GlobalParameter.VENUS]).to.eq(4);
    expect(steps[GlobalParameter.OCEANS]).to.eq(0);
  });

  // The bot player is rebuilt on load, and saves hold no ocean bonus.
  it("keeps Lakefront Resorts' 3 M€ per adjacent ocean across a reload", () => {
    const {game, marsBot} = createAutomaGame();
    marsBot.setCorpAndSetup(getMarsBotCorp(CardName.LAKEFRONT_RESORTS)!);
    expect(marsBot.player.oceanBonus).to.eq(3);

    const restored = Game.deserialize(game.serialize());

    expect(restored.automaHooks!.marsBot.player.oceanBonus).to.eq(3);
  });

  it('keeps the usual 2 M€ per adjacent ocean across a reload without Lakefront Resorts', () => {
    const {game, marsBot} = createAutomaGame();
    marsBot.setCorpAndSetup(getMarsBotCorp(CardName.PRISTAR)!);

    const restored = Game.deserialize(game.serialize());

    expect(restored.automaHooks!.marsBot.player.oceanBonus).to.eq(2);
  });

  it('keeps the Hard mode first-turn check generation across a reload', () => {
    const {game, marsBot} = createAutomaGame();
    game.generation = 4;
    marsBot.firstTurnCheckedGeneration = 3;

    const restored = Game.deserialize(game.serialize());

    expect(restored.automaHooks!.marsBot.firstTurnCheckedGeneration).to.eq(3);
  });

  it('keeps a before-action-phase box that still waits for the preludes across a reload', () => {
    const {game, marsBot} = createAutomaGame();
    marsBot.beforeActionPhasePending = true;

    const restored = Game.deserialize(game.serialize());

    expect(restored.automaHooks!.marsBot.beforeActionPhasePending).is.true;
  });

  it('has no before-action-phase box waiting in older saves', () => {
    const {game} = createAutomaGame();
    const serialized = game.serialize();
    delete serialized.automaState!.beforeActionPhasePending;

    const restored = Game.deserialize(serialized);

    expect(restored.automaHooks!.marsBot.beforeActionPhasePending).is.false;
  });

  it('treats the first-turn check as done for the current generation in older saves', () => {
    const {game} = createAutomaGame();
    game.generation = 4;
    const serialized = game.serialize();
    delete serialized.automaState!.firstTurnCheckedGeneration;

    const restored = Game.deserialize(serialized);

    expect(restored.automaHooks!.marsBot.firstTurnCheckedGeneration).to.eq(4);
  });

  it('reads older saves without those fields', () => {
    const {game, marsBot} = createAutomaGame();
    const serialized = game.serialize();
    delete serialized.automaState!.terraformRating;
    delete serialized.automaState!.globalParameterSteps;

    const restored = Game.deserialize(serialized);

    expect(restored.automaHooks!.marsBot.player.terraformRating).to.eq(marsBot.player.terraformRating);
  });

  it('plays against MarsBot in saves from before automaOption was renamed to automa', () => {
    const {game} = createAutomaGame();
    const serialized = game.serialize();
    const {automa, ...gameOptions} = serialized.gameOptions;
    serialized.gameOptions = {...gameOptions, automaOption: automa} as unknown as SerializedGame['gameOptions'];

    const restored = Game.deserialize(serialized);

    expect(restored.marsBotPlayer).is.not.undefined;
    expect(restored.automaHooks).is.not.undefined;
    expect(restored.isSoloMode()).is.false;
    expect(restored.gameOptions.automa).is.true;
    expect(restored.gameOptions).not.to.have.property('automaOption');
  });

  it('awards no second place in a two player save with the automa option on', () => {
    // Only a hand-edited settings file creates such a game: it gets a MarsBot player but no MarsBot.
    const [game, player, player2] = testGame(2, {automa: true});
    player.heat = 10;
    player2.heat = 5;
    game.fundedAwards.push({award: new Thermalist(), player});

    const loaded = Game.deserialize(game.serialize());

    expect(loaded.automaHooks).is.undefined;
    expect(loaded.getPlayerById(player.id).getVictoryPoints().awards).eq(5);
    expect(loaded.getPlayerById(player2.id).getVictoryPoints().awards).eq(0);
  });

  it('records the bot as a global-parameter contributor when it raises parameters', () => {
    const {game, marsBot} = createAutomaGame();
    game.phase = Phase.ACTION;

    game.increaseTemperature(marsBot.player, 2);
    game.increaseOxygenLevel(marsBot.player, 1);
    game.increaseVenusScaleLevel(marsBot.player, 1);

    const steps = marsBot.player.globalParameterSteps;
    expect(steps[GlobalParameter.TEMPERATURE]).is.greaterThan(0);
    expect(steps[GlobalParameter.OXYGEN]).is.greaterThan(0);
    expect(steps[GlobalParameter.VENUS]).is.greaterThan(0);

    // The end-of-game contribution table reads these off the reloaded model.
    const restored = Game.deserialize(game.serialize());
    const restoredSteps = restored.automaHooks!.marsBot.player.globalParameterSteps;
    expect(restoredSteps[GlobalParameter.TEMPERATURE]).eq(steps[GlobalParameter.TEMPERATURE]);
    expect(restoredSteps[GlobalParameter.OXYGEN]).eq(steps[GlobalParameter.OXYGEN]);
    expect(restoredSteps[GlobalParameter.VENUS]).eq(steps[GlobalParameter.VENUS]);
  });

  it("keeps MarsBot's player markers across a reload", () => {
    const {game, marsBot} = createAutomaGame();
    marsBot.actionDeck.playBonusCard(createBonusCard(BonusCardName.SETTLERS));
    const [id] = marsBot.markerSpaceIds;

    const restored = Game.deserialize(game.serialize());

    const restoredBot = restored.automaHooks!.marsBot;
    expect(restoredBot.markerSpaceIds).to.deep.eq([id]);
    expect(restored.board.getSpaceOrThrow(id).player).to.eq(restoredBot.player);
  });

  it("saves MarsBot's corporation before the player's first action", () => {
    const [game, human] = testGame(1, {
      automa: true,
      automaCorpOption: true,
      automaDifficulty: 'easy',
      boardName: BoardName.THARSIS,
      skipInitialCardSelection: false,
    });
    const saves: Array<SerializedGame> = [];
    game.save = () => {
      saves.push(game.serialize());
      return Promise.resolve();
    };

    human.process({type: 'initialCards', responses: [
      {type: 'card', cards: [human.dealtCorporationCards[0].name]},
      {type: 'card', cards: []},
    ]});

    const corp = game.automaHooks!.marsBot.corp;
    expect(corp).is.not.undefined;
    // A server restart before the player's next action reloads the latest save.
    const restored = Game.deserialize(saves[saves.length - 1]);
    expect(restored.automaHooks!.marsBot.corp).to.eq(corp);
  });

  it('keeps the cards MarsBot resolved out of the project discard pile across a reload', () => {
    const {game, marsBot} = createAutomaGame();
    const asteroid = new Asteroid();
    marsBot.resolveProjectCard(asteroid);

    const restored = Game.deserialize(game.serialize());

    const restoredBot = restored.automaHooks!.marsBot;
    const playedNames = restoredBot.playedProjectCards.map((card) => card.name);
    const discardNames = restored.projectDeck.discardPile.map((card) => card.name);
    expect(playedNames).deep.eq([CardName.ASTEROID]);
    expect(discardNames).does.not.include(CardName.ASTEROID);
  });

  it('removes cards MarsBot played from the project discard pile in older saves', () => {
    const {game, marsBot} = createAutomaGame();
    const asteroid = new Asteroid();
    marsBot.resolveProjectCard(asteroid);
    game.projectDeck.discardPile.push(asteroid);

    const restored = Game.deserialize(game.serialize());

    const playedNames = restored.automaHooks!.marsBot.playedProjectCards.map((card) => card.name);
    const discardNames = restored.projectDeck.discardPile.map((card) => card.name);
    expect(playedNames).deep.eq([CardName.ASTEROID]);
    expect(discardNames).does.not.include(CardName.ASTEROID);
  });

  it('removes every card MarsBot played from the project piles in older saves', () => {
    const {game, marsBot} = createAutomaGame();
    const cards = [new Asteroid(), new Research()];
    cards.forEach((card) => marsBot.resolveProjectCard(card));
    game.projectDeck.discardPile.push(new Asteroid(), new Research());

    const restored = Game.deserialize(game.serialize());

    const piles = [...restored.projectDeck.discardPile, ...restored.projectDeck.drawPile];
    const pileNames = piles.map((card) => card.name);
    expect(pileNames).does.not.include(CardName.ASTEROID);
    expect(pileNames).does.not.include(CardName.RESEARCH);
  });

  it('removes cards MarsBot played from the project draw pile in older saves', () => {
    const {game, marsBot} = createAutomaGame();
    const asteroid = new Asteroid();
    marsBot.resolveProjectCard(asteroid);
    game.projectDeck.drawPile.push(new Asteroid());

    const restored = Game.deserialize(game.serialize());

    const playedNames = restored.automaHooks!.marsBot.playedProjectCards.map((card) => card.name);
    const drawNames = restored.projectDeck.drawPile.map((card) => card.name);
    expect(playedNames).deep.eq([CardName.ASTEROID]);
    expect(drawNames).does.not.include(CardName.ASTEROID);
  });

  it('records the whole card when a corporation resolves only its first tag, and keeps it across a reload', () => {
    const {game, marsBot} = createAutomaGame();
    const card = new Greenhouses();
    const tags = [...card.tags];
    expect(tags).deep.eq([Tag.PLANT, Tag.BUILDING]);
    game.projectDeck.drawPile.push(card);
    const plant = marsBot.marsBotBoard.tagToTrack[Tag.PLANT]!;
    const building = marsBot.marsBotBoard.tagToTrack[Tag.BUILDING]!;

    marsBot.maybeDrawAndResolveProjectCardFirstTagOnly();

    // Thorgate (C11): "ignoring all except its first tag", so only the Plant tag moves a track
    expect(marsBot.marsBotBoard.tracks[plant].position).to.eq(1);
    expect(marsBot.marsBotBoard.tracks[building].position).to.eq(0);

    expect(marsBot.playedProjectCards).deep.eq([card]);
    expect(marsBot.playedProjectCards[0].tags).deep.eq(tags);
    const restored = Game.deserialize(game.serialize());
    expect(restored.automaHooks!.marsBot.playedProjectCards[0].tags).deep.eq(tags);
  });

  // A replay or a rewind loads the save and expects the same random draws from there on.
  for (const [label, expansions] of [
    ['base', {}],
    ['Venus', {venusNextExtension: true}],
    ['Colonies', {coloniesExtension: true}],
    ['Venus and Colonies', {venusNextExtension: true, coloniesExtension: true}],
  ] as const) {
    it(`leaves the random generator where the save left it (${label})`, () => {
      const [game] = testGame(1, {automa: true, automaDifficulty: 'easy', boardName: BoardName.THARSIS, ...expansions});
      // Nothing is re-entered on load.
      game.phase = Phase.END;

      const rng = game.rng.serialize();
      expect(loadSandboxGame(game.serialize()).rng.serialize()).deep.eq(rng);
      expect(Game.deserialize(game.serialize()).rng.serialize()).deep.eq(rng);
    });
  }

  // MarsBot's part of a generation 6 save of a Hard game.
  const savedState: SerializedAutomaState = JSON.parse('{"trackPositions":[4,4,4,4,3,4,4],"trackRegressedPositions":[[],[],[],[],[],[],[]],"megacredits":25,"goesFirst":true,"difficulty":"hard","actionDeckCardNames":["Black Polar Dust","Wave Power","Nuclear Zone","B02"],"bonusDeck":{"drawPile":["Meteor Shower:automa"],"discardPile":["Research and Development:automa","Expedited Construction:automa","Overachievement:automa","Corporate Competition:automa"]},"neuralInstanceSpaceId":"55","playedProjectCardNames":["Adaptation Technology","Martian Rails","Herbivores","Geothermal Power","Tundra Farming","Special Design","Earth Office","Release of Inert Gases","Vesta Shipyard","Cloud Seeding","Imported GHG","Birds","Business Network","Phobos Space Haven","Industrial Microbes","Mohole Area"],"firstTurnCheckedGeneration":5,"beforeActionPhasePending":false,"marsBotPlayerId":"p-game-id-marsbot","terraformRating":33,"globalParameterSteps":{"oceans":2,"oxygen":2,"temperature":3,"venus":0,"moon-habitat":0,"moon-mining":0,"moon-logistic":0},"vpByGeneration":[23,31,36,46,53],"temperatureRaises":1,"destroyedBonusCards":2}');
  for (const run of [
    {megacreditsKey: 'megacredits'},
    {megacreditsKey: 'mcSupply'},
  ] as const) {
    it('restores M€, the played pile, the temperature count and the action deck of an older save: ' + JSON.stringify(run), () => {
      const [game] = testGame(1, {automa: true, automaDifficulty: 'hard', boardName: BoardName.THARSIS});
      const marsBot = game.automaHooks!.marsBot;
      const {megacredits, ...rest} = savedState;

      marsBot.restoreState({...rest, [run.megacreditsKey]: megacredits} as SerializedAutomaState);

      expect(marsBot.megacredits).eq(25);
      const playedNames = marsBot.playedProjectCards.map((card) => card.name);
      const actionDeckNames = marsBot.actionDeck.cards.map((card) => card.name);
      expect(playedNames).deep.eq(savedState.playedProjectCardNames);
      expect(marsBot.temperatureRaises).eq(1);
      expect(actionDeckNames).deep.eq(['Black Polar Dust', 'Wave Power', 'Nuclear Zone', BonusCardName.INVASIVE_SPECIES]);
      expect(marsBot.destroyedBonusCards).eq(2);
      expect(marsBot.serialize()).deep.eq({
        ...savedState,
        actionDeckCardNames: ['Black Polar Dust', 'Wave Power', 'Nuclear Zone', BonusCardName.INVASIVE_SPECIES],
        bonusDeck: {
          drawPile: [BonusCardName.METEOR_SHOWER],
          discardPile: [
            BonusCardName.RESEARCH_AND_DEVELOPMENT,
            BonusCardName.EXPEDITED_CONSTRUCTION,
            BonusCardName.OVERACHIEVEMENT,
            BonusCardName.CORPORATE_COMPETITION,
          ],
        },
      });
    });
  }

  // Saves made before BonusCardName hold a bonus card by its id or by its name with an ':automa' suffix
  for (const run of [
    {
      piles: 'bonus deck',
      state: {bonusDeck: {drawPile: ['B30', 'Meteor Shower:automa', 'Asteroid'], discardPile: ['Research and Development:automa', 'B05', 'Tardigrades']}},
    },
    {
      piles: 'older keys',
      state: {bonusDeckDrawPile: ['B30', 'Meteor Shower:automa', 'Asteroid'], bonusDeckDiscardPile: ['Research and Development:automa', 'B05', 'Tardigrades']},
    },
  ]) {
    it('loads the bonus cards of a save made before BonusCardName: ' + run.piles, () => {
      const [game] = testGame(1, {automa: true, boardName: BoardName.THARSIS});
      const marsBot = game.automaHooks!.marsBot;
      const {bonusDeck: _bonusDeck, ...state} = marsBot.serialize();

      marsBot.restoreState({...state, actionDeckCardNames: ['Mine', 'B02'], ...run.state} as SerializedAutomaState);

      const cards = (pile: ReadonlyArray<object>) => pile.map((card) => card.constructor);
      expect(cards(marsBot.actionDeck.cards)).deep.eq([Mine, InvasiveSpecies]);
      expect(cards(marsBot.bonusDeck.drawPile)).deep.eq([InterfaceHyperlink, MeteorShower, Asteroid]);
      expect(cards(marsBot.bonusDeck.discardPile)).deep.eq([ResearchAndDevelopment, ExpeditedConstruction, Tardigrades]);
    });
  }
});
