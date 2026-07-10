import {expect} from 'chai';
import {testGame} from './TestGame';
import {Game} from '../src/server/Game';
import {CardName} from '../src/common/cards/CardName';
import {CardResource} from '../src/common/CardResource';
import {BoardName} from '../src/common/boards/BoardName';
import {DEFAULT_GAME_OPTIONS, GameOptions, applyTournamentPreset} from '../src/server/game/GameOptions';
import {newInitialDraft} from '../src/server/Draft';
import {RecyclonTournament} from '../src/server/cards/tournament/RecyclonTournament';
import {RemoveResourcesFromCard} from '../src/server/deferredActions/RemoveResourcesFromCard';
import {SelectCard} from '../src/server/inputs/SelectCard';
import {SelectInitialCards} from '../src/server/inputs/SelectInitialCards';
import {IProjectCard} from '../src/server/cards/IProjectCard';
import {cast, toName} from '../src/common/utils/utils';
import {runAllActions} from './TestingUtils';

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

  it('customCorporationsList becomes the pool, filtered to tournament corporations', () => {
    const [/* game */, p1, p2, p3] = testGame(3, {
      tournamentExpansion: true,
      customCorporationsList: [CardName.TERACTOR_TOURNAMENT, CardName.ECOLINE_TOURNAMENT, CardName.PHOBOLOG],
    });

    for (const player of [p1, p2, p3]) {
      expect(player.dealtCorporationCards.map(toName).sort()).deep.eq(
        [CardName.ECOLINE_TOURNAMENT, CardName.TERACTOR_TOURNAMENT]);
    }
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
  });
});
