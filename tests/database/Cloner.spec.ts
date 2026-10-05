import {expect} from 'chai';
import {Cloner} from '../../src/server/database/Cloner';
import {Game} from '../../src/server/Game';
import {Player} from '../../src/server/Player';
import {GameId, PlayerId} from '../../src/common/Types';
import {DELEGATES_PER_PLAYER} from '../../src/common/constants';
import {PartyName} from '../../src/common/turmoil/PartyName';

describe('Cloner', () => {
  it('solo game preserved', () => {
    const player = new Player('old-player1', 'yellow', true, 9, 'p-old-player1-id');
    const game = Game.newInstance(
      'g-old-game-id', [player], player, 'spectatorid', {
        turmoilExtension: true,
      }, -5179823149812374);

    const newPlayer = new Player('new-player1', 'red', false, 3, 'p-new-player1-id');
    const newGame = Cloner.clone('g-new-id', [newPlayer], 0, game.serialize());

    expect(newGame.id).eq('g-new-id');
    expect(game.getPlayerById('p-old-player1-id')).is.not.undefined;
    expect(() => game.getPlayerById('p-new-player1-id')).to.throw();
    expect(() => newGame.getPlayerById('p-old-player1-id')).to.throw();
    expect(newGame.getPlayerById('p-new-player1-id')).is.not.undefined;

    const newPlayerZero = newGame.playersInGenerationOrder[0];
    expect(newPlayerZero.color).eq('red');
    expect(newPlayerZero.beginner).is.true;

    expect(player.terraformRating).eq(23);
    expect(player.handicap).eq(9);

    expect(newPlayerZero.terraformRating).eq(17);
    expect(newPlayerZero.handicap).eq(3);

    expect(player.dealtCorporationCards, 'dealtCorporationCards').deep.eq(newPlayerZero.dealtCorporationCards);
    expect(player.dealtProjectCards, 'dealtProjectCards').deep.eq(newPlayerZero.dealtProjectCards);
    expect(player.dealtPreludeCards, 'dealtPreludeCards').deep.eq(newPlayerZero.dealtPreludeCards);
    expect(player.cardsInHand, 'cardsInHand').deep.eq(newPlayerZero.cardsInHand);
    expect(player.preludeCardsInHand, 'preludeCardsInHand').deep.eq(newPlayerZero.preludeCardsInHand);
    expect(player.playedCards, 'playedCards').deep.eq(newPlayerZero.playedCards);
    expect(player.draftedCards, 'draftedCards').deep.eq(newPlayerZero.draftedCards);

    expect(game.rng.seed).eq(newGame.rng.seed);
    expect(game.gameAge).eq(newGame.gameAge);
    expect(game.undoCount).eq(newGame.undoCount);
    expect(game.projectDeck.discardPile, 'discardPile').to.deep.eq(newGame.projectDeck.discardPile);
    expect(game.projectDeck, 'projectDeck').to.deep.eq(newGame.projectDeck);
    expect(game.corporationDeck, 'corporationDeck').to.deep.eq(newGame.corporationDeck);
    expect(game.preludeDeck, 'preludeDeck').to.deep.eq(newGame.preludeDeck);
    expect(game.milestones, 'milestones').to.deep.eq(newGame.milestones);
    expect(game.awards, 'awards').to.deep.eq(newGame.awards);


    // validating two boards across two games as equal is a little tricky because player IDs have changed, so
    // doing a test in this manner instead.
    for (let idx = 0; idx < game.board.spaces.length; idx++) {
      const oldSpace = game.board.spaces[idx];
      const newSpace = newGame.board.spaces[idx];
      if (oldSpace.player !== undefined) {
        expect(oldSpace.player.color, `for idx ${idx}`).eq('neutral');
        expect(newSpace.player!.color, `for idx ${idx}`).eq('neutral');
        // By destroying these spaces (at the end of the test) the spaces can be tested for equality
        // ignoring `space.player`
        oldSpace.player = undefined;
        newSpace.player = undefined;
      } else {
        expect(newSpace.player, `for idx ${idx}`).is.undefined;
      }
    }
    // This test will pass now that space players have been separately verified.
    expect(game.board).to.deep.eq(newGame.board);
  });
});

describe('Cloner, automa games', () => {
  // MarsBot's id is derived from the game id, and it isn't part of `serialized.players`,
  // so it needs the same treatment as the solo neutral player.
  function soloAutomaGame(gameId: GameId, playerId: PlayerId) {
    const player = new Player('old-player1', 'yellow', false, 0, playerId);
    return Game.newInstance(gameId, [player], player, 'spectatorid', {
      automaOption: true,
      turmoilExtension: true,
      coloniesExtension: true,
      preludeExtension: true,
      venusNextExtension: true,
    }, 4654654);
  }

  // Reloading in place is the baseline the clone has to match: MarsBot holds delegates in
  // Turmoil's reserve, so the deserializer has to know about it.
  it('reloads a solo automa game in place', () => {
    const game = soloAutomaGame('g-old-game-id', 'p-old-player1-id');

    const reloaded = Game.deserialize(game.serialize());

    const marsBot = reloaded.getPlayerById('p-g-old-game-id-marsbot');
    expect(reloaded.turmoil!.delegateReserve.get(marsBot)).eq(DELEGATES_PER_PLAYER);
  });

  it('clones a solo automa game', () => {
    const game = soloAutomaGame('g-old-game-id', 'p-old-player1-id');

    const newPlayer = new Player('new-player1', 'red', false, 0, 'p-new-player1-id');
    const newGame = Cloner.clone('g-new-id', [newPlayer], 0, game.serialize());

    expect(newGame.automaHooks, 'automaHooks').is.not.undefined;
    expect(newGame.automaHooks!.marsBot.player.id).eq('p-g-new-id-marsbot');
    expect(newGame.getPlayerById('p-g-new-id-marsbot'), 'MarsBot is in the new game').is.not.undefined;
    expect(() => newGame.getPlayerById('p-g-old-game-id-marsbot')).to.throw();
  });

  it('clones an automa game in which MarsBot holds delegates and tiles', () => {
    const game = soloAutomaGame('g-old-game-id', 'p-old-player1-id');
    const marsBot = game.getPlayerById('p-g-old-game-id-marsbot');
    game.turmoil!.sendDelegateToParty(marsBot, PartyName.MARS, game);
    const space = game.board.getAvailableSpacesOnLand(marsBot)[0];
    game.addGreenery(marsBot, space);

    const newPlayer = new Player('new-player1', 'red', false, 0, 'p-new-player1-id');
    const newGame = Cloner.clone('g-new-id', [newPlayer], 0, game.serialize());

    const newMarsBot = newGame.getPlayerById('p-g-new-id-marsbot');
    expect(newGame.turmoil!.getPartyByName(PartyName.MARS).delegates.get(newMarsBot), 'delegate').eq(1);
    expect(newGame.board.getSpaceOrThrow(space.id).player?.id, 'tile owner').eq('p-g-new-id-marsbot');
  });

  it('clone of an automa game retains no ids from the source game', () => {
    const game = soloAutomaGame('g-old-game-id', 'p-old-player1-id');

    const newPlayer = new Player('new-player1', 'red', false, 0, 'p-new-player1-id');
    const newGame = Cloner.clone('g-new-id', [newPlayer], 0, game.serialize());

    // `clonedGamedId` deliberately records the source game, and the inherited log recounts
    // the source game's history ('The id of this game is ...'), so neither is live state.
    const {clonedGamedId, gameLog, ...state} = newGame.serialize();
    expect(clonedGamedId).eq('#g-old-game-id');
    expect(pathsHolding(state, ['g-old-game-id']), 'game state').deep.eq([]);

    // Player ids are live references the client resolves back to a player, so every one of
    // them has to be remapped, in the log as well.
    const oldPlayerIds = ['p-old-player1-id', 'p-g-old-game-id-marsbot'];
    expect(pathsHolding({...state, gameLog}, oldPlayerIds), 'player ids').deep.eq([]);
  });
});

/** Every path in `obj` whose string value mentions one of `needles`, for a legible failure. */
function pathsHolding(obj: any, needles: Array<string>, path: string = ''): Array<string> {
  if (typeof obj === 'string') {
    return needles.some((needle) => obj.includes(needle)) ? [`${path} = ${obj}`] : [];
  }
  if (obj === null || typeof obj !== 'object') {
    return [];
  }
  return Object.entries(obj).flatMap(([key, val]) => pathsHolding(val, needles, `${path}.${key}`));
}
