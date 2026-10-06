import {expect} from 'chai';
import {testGame} from './TestGame';
import {Game} from '../src/server/Game';
import {CardName} from '../src/common/cards/CardName';
import {CardResource} from '../src/common/CardResource';
import {Tag} from '../src/common/cards/Tag';
import {newCorporationCard} from '../src/server/createCard';
import {BoardName} from '../src/common/boards/BoardName';
import {ColonyName} from '../src/common/colonies/ColonyName';
import {DEFAULT_GAME_OPTIONS, GameOptions, applyTournamentPreset} from '../src/server/game/GameOptions';
import {DEFAULT_ESCAPE_VELOCITY_THRESHOLD} from '../src/common/constants';
import {newInitialDraft} from '../src/server/Draft';
import {Mine} from '../src/server/cards/base/Mine';
import {RoboticWorkforce} from '../src/server/cards/base/RoboticWorkforce';
import {CheungShingMARSTournament} from '../src/server/cards/tournament/CheungShingMARSTournament';
import {RecyclonTournament} from '../src/server/cards/tournament/RecyclonTournament';
import {RemoveResourcesFromCard} from '../src/server/deferredActions/RemoveResourcesFromCard';
import {SelectCard} from '../src/server/inputs/SelectCard';
import {SelectInitialCards} from '../src/server/inputs/SelectInitialCards';
import {IProjectCard} from '../src/server/cards/IProjectCard';
import {cast, toName} from '../src/common/utils/utils';
import {runAllActions} from './TestingUtils';
import {OrOptions} from '../src/server/inputs/OrOptions';
import {TestPlayer} from './TestPlayer';
import {Server} from '../src/server/models/ServerModel';

const claimTitle = 'Claim a milestone';

function milestoneOption(player: TestPlayer): OrOptions | undefined {
  const actions = cast(player.getActions(), OrOptions);
  const option = actions.options.find((o) => o.title === claimTitle);
  return option === undefined ? undefined : cast(option, OrOptions);
}

function claimThroughInput(player: TestPlayer, milestoneName: string) {
  player.popWaitingFor();
  const actions = cast(player.getActions(), OrOptions);
  player.setWaitingFor(actions);
  const index = actions.options.findIndex((o) => o.title === claimTitle);
  const milestones = cast(actions.options[index], OrOptions);
  const milestoneIndex = milestones.options.findIndex((o) => o.title === milestoneName);
  player.process({type: 'or', index, response: {type: 'or', index: milestoneIndex, response: {type: 'option'}}});
}

describe('TournamentMode', () => {
  it('Deals one shared pool of 5 tournament corporations to every player', () => {
    const [/* game */, p1, p2, p3, p4] = testGame(4, {tournamentExpansion: true});

    const names = (cards: ReadonlyArray<{name: CardName}>) => cards.map(toName).sort();
    expect(p1.dealtCorporationCards).has.length(5);
    expect(names(p2.dealtCorporationCards)).deep.eq(names(p1.dealtCorporationCards));
    expect(names(p3.dealtCorporationCards)).deep.eq(names(p1.dealtCorporationCards));
    expect(names(p4.dealtCorporationCards)).deep.eq(names(p1.dealtCorporationCards));
    for (const name of names(p1.dealtCorporationCards)) {
      expect(name).to.match(/:tournament$/);
    }
  });

  it('Players get their own instances of the pool', () => {
    const [/* game */, p1, p2] = testGame(2, {tournamentExpansion: true});

    for (const card of p1.dealtCorporationCards) {
      const other = p2.dealtCorporationCards.find((c) => c.name === card.name);
      expect(other).is.not.undefined;
      expect(other).to.not.equal(card);
    }
  });

  it('customCorporationsList is ignored under tournament rules', () => {
    const [/* game */, p1, p2, p3] = testGame(3, {
      tournamentExpansion: true,
      customCorporationsList: [CardName.TERACTOR_TOURNAMENT, CardName.ECOLINE_TOURNAMENT, CardName.PHOBOLOG],
    });

    for (const player of [p1, p2, p3]) {
      expect(player.dealtCorporationCards).has.length(5);
      for (const name of player.dealtCorporationCards.map(toName)) {
        expect(name).to.match(/:tournament$/);
      }
    }
  });

  it('A serialized tournament game keeps the undoOption it was created with', () => {
    // There is no load-time migration: running games keep their options.
    const [game] = testGame(2, {tournamentExpansion: true, undoOption: true});

    expect(Game.deserialize(game.serialize()).gameOptions.undoOption).is.true;
  });

  it('Two players may play the same corporation', () => {
    const [game, p1, p2] = testGame(2, {tournamentExpansion: true});
    const first = new RecyclonTournament();
    const second = new RecyclonTournament();

    p1.playCorporationCard(first);
    p2.playCorporationCard(second);
    runAllActions(game);

    expect(p1.tableau.has(CardName.RECYCLON_TOURNAMENT)).is.true;
    expect(p2.tableau.has(CardName.RECYCLON_TOURNAMENT)).is.true;
    expect(game.getCardPlayerByCard(first)).to.eq(p1);
    expect(game.getCardPlayerByCard(second)).to.eq(p2);
  });

  it('Duplicate corporations survive serialization', () => {
    const [game, p1, p2] = testGame(2, {tournamentExpansion: true});
    const first = new RecyclonTournament();
    const second = new RecyclonTournament();
    p1.playCorporationCard(first);
    p2.playCorporationCard(second);
    runAllActions(game);
    p1.addResourceTo(first, 2); // 3 with the self-trigger microbe.

    const restored = Game.deserialize(game.serialize());
    const [r1, r2] = restored.players;
    const restoredFirst = r1.tableau.get(CardName.RECYCLON_TOURNAMENT);
    const restoredSecond = r2.tableau.get(CardName.RECYCLON_TOURNAMENT);
    expect(restoredFirst).is.not.undefined;
    expect(restoredSecond).is.not.undefined;
    expect(restoredFirst?.resourceCount).to.eq(3);
    expect(restoredSecond?.resourceCount).to.eq(1);
  });

  it('Removes resources from the right duplicate corporation', () => {
    const [game, remover, a, b] = testGame(3, {tournamentExpansion: true});
    const cardA = new RecyclonTournament();
    const cardB = new RecyclonTournament();
    a.playCorporationCard(cardA);
    b.playCorporationCard(cardB);
    runAllActions(game);
    a.addResourceTo(cardA, 2); // 3
    b.addResourceTo(cardB, 4); // 5

    game.defer(new RemoveResourcesFromCard(remover, CardResource.MICROBE, 2, {autoselect: false}));
    runAllActions(game);

    const selectCard = cast(remover.popWaitingFor(), SelectCard);
    const target = selectCard.cards.find((card) => card === cardB);
    expect(target).is.not.undefined;
    selectCard.cb([target!]);
    runAllActions(game);

    expect(cardA.resourceCount).to.eq(3);
    expect(cardB.resourceCount).to.eq(3);
  });

  it('Corporation tags match the printed tournament cards', () => {
    const printedTags: ReadonlyArray<[CardName, ReadonlyArray<Tag>]> = [
      [CardName.INVENTRIX_TOURNAMENT, [Tag.BUILDING, Tag.SCIENCE]],
      [CardName.SAGITTA_FRONTIER_SERVICES_TOURNAMENT, [Tag.PLANT, Tag.BUILDING]],
      [CardName.PHOBOLOG_TOURNAMENT, [Tag.SPACE]],
      [CardName.CREDICOR_TOURNAMENT, [Tag.BUILDING]],
      [CardName.TERACTOR_TOURNAMENT, [Tag.SCIENCE, Tag.EARTH]],
      [CardName.FACTORUM_TOURNAMENT, [Tag.EARTH, Tag.POWER, Tag.BUILDING]],
      [CardName.ECOLINE_TOURNAMENT, [Tag.PLANT]],
      [CardName.NIRGAL_ENTERPRISES_TOURNAMENT, [Tag.PLANT, Tag.POWER, Tag.BUILDING, Tag.BUILDING]],
      [CardName.RECYCLON_TOURNAMENT, [Tag.MICROBE, Tag.BUILDING]],
      [CardName.INTERPLANETARY_CINEMATICS_TOURNAMENT, [Tag.MICROBE, Tag.BUILDING, Tag.BUILDING]],
      [CardName.MANUTECH_TOURNAMENT, [Tag.CITY, Tag.BUILDING, Tag.BUILDING]],
      [CardName.CHEUNG_SHING_MARS_TOURNAMENT, [Tag.BUILDING]],
      [CardName.PALLADIN_SHIPPING_TOURNAMENT, [Tag.WILD, Tag.SPACE]],
      [CardName.ECOTEC_TOURNAMENT, [Tag.BUILDING, Tag.MICROBE, Tag.PLANT]],
      [CardName.UNITED_NATIONS_MARS_INITIATIVE_TOURNAMENT, [Tag.CITY, Tag.PLANT, Tag.EARTH]],
      [CardName.UTOPIA_INVEST_TOURNAMENT, [Tag.POWER, Tag.BUILDING]],
    ];

    for (const [name, tags] of printedTags) {
      expect(newCorporationCard(name)?.tags, name).deep.eq(tags);
    }
  });

  it('Robotic Workforce cannot copy corporations in tournament games', () => {
    const [game, player] = testGame(2, {tournamentExpansion: true});
    const roboticWorkforce = new RoboticWorkforce();
    const corporation = new CheungShingMARSTournament();
    player.playedCards.push(corporation);

    expect(roboticWorkforce.canPlay(player)).is.false;

    const mine = new Mine();
    player.playedCards.push(mine);
    expect(roboticWorkforce.canPlay(player)).is.true;

    cast(roboticWorkforce.play(player), undefined);
    runAllActions(game);
    const selectCard = cast(player.popWaitingFor(), SelectCard);
    expect(selectCard.cards).has.length(1);
    expect(selectCard.cards[0]).to.eq(mine);
  });

  it('Initial draft is a single pack of 10 cards', () => {
    const [game, ...players] = testGame(3, {tournamentExpansion: true, initialDraftVariant: true, skipInitialCardSelection: false});

    for (const player of players) {
      expect(cast(player.getWaitingFor(), SelectCard).cards).has.length(10);
    }

    // 9 pick rounds; the last card of each hand passes automatically.
    for (let round = 0; round < 9; round++) {
      for (const player of players) {
        const input = cast(player.popWaitingFor(), SelectCard);
        input.cb([input.cards[0] as IProjectCard]);
      }
    }

    expect(game.initialDraftIteration).to.eq(3);
    for (const player of players) {
      expect(player.dealtProjectCards).has.length(10);
      cast(player.getWaitingFor(), SelectInitialCards);
    }
  });

  it('Initial draft passes one direction under tournament rules', () => {
    const [tournamentGame] = testGame(3, {tournamentExpansion: true, initialDraftVariant: true, skipInitialCardSelection: false});
    const draft = newInitialDraft(tournamentGame);
    expect(draft.passDirection()).to.eq('before');
    tournamentGame.initialDraftIteration = 2;
    expect(draft.passDirection()).to.eq('before');

    const [standardGame] = testGame(3, {initialDraftVariant: true, skipInitialCardSelection: false}, '2');
    const standardDraft = newInitialDraft(standardGame);
    expect(standardDraft.passDirection()).to.eq('after');
    standardGame.initialDraftIteration = 2;
    expect(standardDraft.passDirection()).to.eq('before');
  });

  it('applyTournamentPreset forces the regulation options', () => {
    const options: GameOptions = {
      ...DEFAULT_GAME_OPTIONS,
      tournamentExpansion: true,
      venusNextExtension: true,
      preludeExtension: true,
      corporateEra: false,
      draftVariant: false,
      initialDraftVariant: false,
      solarPhaseOption: true,
      boardName: BoardName.AMAZONIS,
      undoOption: true,
      fastModeOption: true,
      showOtherPlayersVP: true,
      playerPasswords: false,
      customCorporationsList: [CardName.TERACTOR_TOURNAMENT],
      bannedCards: [CardName.MINE],
      includedCards: [CardName.MINE],
      customColoniesList: [ColonyName.EUROPA],
      customPreludes: [CardName.DONATION],
      customCeos: [CardName.FLOYD],
      expansions: {...DEFAULT_GAME_OPTIONS.expansions, venus: true, prelude: true, tournament: true},
    };

    applyTournamentPreset(options);

    expect(options.corporateEra).is.true;
    expect(options.venusNextExtension).is.false;
    expect(options.preludeExtension).is.false;
    expect(options.expansions.venus).is.false;
    expect(options.expansions.prelude).is.false;
    expect(options.expansions.corpera).is.true;
    expect(options.expansions.tournament).is.true;
    expect(options.draftVariant).is.true;
    expect(options.initialDraftVariant).is.true;
    expect(options.solarPhaseOption).is.false;
    expect(options.boardName).to.eq(BoardName.THARSIS);
    expect(options.undoOption).is.false;
    expect(options.fastModeOption).is.false;
    expect(options.showOtherPlayersVP).is.false;
    expect(options.playerPasswords).is.true;
    expect(options.customCorporationsList).is.empty;
    expect(options.bannedCards).is.empty;
    expect(options.includedCards).is.empty;
    expect(options.customColoniesList).is.empty;
    expect(options.customPreludes).is.empty;
    expect(options.customCeos).is.empty;
  });

  it('applyTournamentPreset keeps escape velocity', () => {
    const escapeVelocity = {
      thresholdMinutes: DEFAULT_ESCAPE_VELOCITY_THRESHOLD,
      bonusSectionsPerAction: 2,
      penaltyPeriodMinutes: 2,
      penaltyVPPerPeriod: 1,
    };
    const options: GameOptions = {
      ...DEFAULT_GAME_OPTIONS,
      tournamentExpansion: true,
      escapeVelocity,
      expansions: {...DEFAULT_GAME_OPTIONS.expansions, tournament: true},
    };

    applyTournamentPreset(options);

    expect(options.escapeVelocity).to.deep.eq(escapeVelocity);
  });

  it('applyTournamentPreset classifies every game option', () => {
    // Every GameOptions key is either forced by the tournament preset or
    // deliberately left to the game creator. A new key in neither list
    // fails here, so an upstream option cannot slip past the preset.
    const forced = [
      'altVenusBoard', 'aresExtension', 'aresExtremeVariant', 'bannedCards',
      'ceoExtension', 'ceosDraftVariant', 'coloniesExtension', 'communityCardsOption',
      'corporateEra', 'customCeos', 'customColoniesList', 'customCorporationsList',
      'customPreludes', 'deltaProjectExpansion', 'draftVariant', 'expansions',
      'fastModeOption', 'includeFanMA', 'includedCards', 'initialDraftVariant',
      'modularMA', 'moonExpansion', 'moonStandardProjectVariant',
      'moonStandardProjectVariant1', 'pathfindersExpansion', 'playerPasswords',
      'politicalAgendasExtension', 'prelude2Expansion', 'preludeDraftVariant',
      'preludeExtension', 'promoCardsOption', 'randomMA', 'requiresMoonTrackCompletion',
      'requiresVenusTrackCompletion', 'showOtherPlayersVP', 'shuffleMapOption',
      'solarPhaseOption', 'starWarsExpansion', 'turmoilExtension', 'twoCorpsVariant',
      'underworldExpansion', 'undoOption', 'venusNextExtension',
    ];
    const passthrough = [
      'aresHazards', // inert: Ares is forced off
      'boardName', // clamped to Tharsis/Hellas/Elysium, otherwise free
      'clonedGamedId', // cloning is out of scope (user decision)
      'escapeVelocity', // tournament games may use the clock
      'removeNegativeGlobalEventsOption', // inert: Turmoil is forced off
      'showTimers',
      'soloTR',
      'startingCeos', // inert: CEOs are forced off
      'startingCorporations', // inert: tournament dealing always uses the pool size
      'startingPreludes', // inert: Prelude is forced off
      'tournamentExpansion',
    ];
    expect([...forced, ...passthrough].sort()).deep.eq(Object.keys(DEFAULT_GAME_OPTIONS).sort());
  });

  it('Offers every unclaimed milestone to a player who cannot claim any', () => {
    const [game, player] = testGame(2, {tournamentExpansion: true});
    player.megaCredits = 0;

    const option = milestoneOption(player);

    expect(option?.options.map((o) => o.title)).deep.eq(game.milestones.map((m) => m.name));
  });

  it('Lists the milestone action just above passing', () => {
    const [/* game */, player] = testGame(2, {tournamentExpansion: true});

    const titles = cast(player.getActions(), OrOptions).options.map((o) => o.title);

    expect(titles.indexOf(claimTitle)).eq(titles.indexOf('Pass for this generation') - 1);
  });

  it('Never preselects the milestone action', () => {
    const [/* game */, player] = testGame(2, {tournamentExpansion: true});
    player.setTerraformRating(35);
    player.megaCredits = 8;

    expect(milestoneOption(player)?.eligibleForDefault).is.false;
  });

  it('Rejects a milestone the player does not qualify for', () => {
    const [game, player] = testGame(2, {tournamentExpansion: true});
    player.setTerraformRating(34);
    player.megaCredits = 20;

    expect(() => claimThroughInput(player, 'Terraformer')).to.throw(/You do not meet the requirement for this milestone/);
    runAllActions(game);

    expect(game.claimedMilestones).is.empty;
    expect(player.megaCredits).eq(20);
    expect(player.getWaitingFor()).is.not.undefined;
  });

  it('Rejects a milestone the player cannot afford', () => {
    const [game, player] = testGame(2, {tournamentExpansion: true});
    player.setTerraformRating(35);
    player.megaCredits = 7;

    expect(() => claimThroughInput(player, 'Terraformer')).to.throw(/You do not have enough M€ to claim this milestone/);
    runAllActions(game);

    expect(game.claimedMilestones).is.empty;
    expect(player.megaCredits).eq(7);
    expect(player.getWaitingFor()).is.not.undefined;
  });

  it('Claims a milestone the player qualifies for and can afford', () => {
    const [game, player] = testGame(2, {tournamentExpansion: true});
    player.setTerraformRating(35);
    player.megaCredits = 8;

    claimThroughInput(player, 'Terraformer');
    runAllActions(game);

    expect(game.claimedMilestones.map((c) => c.milestone.name)).deep.eq(['Terraformer']);
    expect(player.megaCredits).eq(0);
    expect(milestoneOption(player)?.options.map((o) => o.title)).does.not.include('Terraformer');
  });

  it('Stops offering milestones once three are claimed', () => {
    const [game, player, player2] = testGame(2, {tournamentExpansion: true});
    for (const milestone of game.milestones.slice(0, 3)) {
      game.claimedMilestones.push({player: player2, milestone});
    }

    expect(milestoneOption(player)).is.undefined;
  });

  it('Hides which milestones a player could claim on the board', () => {
    const [tournamentGame, player] = testGame(2, {tournamentExpansion: true});
    player.setTerraformRating(35);
    const terraformer = Server.getMilestones(tournamentGame).find((m) => m.name === 'Terraformer');
    expect(terraformer?.scores.find((s) => s.color === player.color)?.claimable).is.false;

    const [standardGame, standardPlayer] = testGame(2, {}, '2');
    standardPlayer.setTerraformRating(35);
    const standardTerraformer = Server.getMilestones(standardGame).find((m) => m.name === 'Terraformer');
    expect(standardTerraformer?.scores.find((s) => s.color === standardPlayer.color)?.claimable).is.true;
  });

  it('Standard games still only offer claimable milestones', () => {
    const [/* game */, player] = testGame(2);
    player.megaCredits = 0;

    expect(milestoneOption(player)).is.undefined;
  });
});
