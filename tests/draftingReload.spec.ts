import {expect} from 'chai';
import {Game} from '../src/server/Game';
import {IGame} from '../src/server/IGame';
import {IPlayer} from '../src/server/IPlayer';
import {SelectCard} from '../src/server/inputs/SelectCard';
import {SerializedGame} from '../src/server/SerializedGame';
import {sameState} from '../src/server/rewind/stateHash';
import {cast} from '../src/common/utils/utils';
import {testGame} from './TestGame';
import {finishGeneration} from './TestingUtils';
import {restoreTestDatabase, setTestDatabase} from './testing/setup';
import {SnapshotDatabase} from './testing/SnapshotDatabase';

describe('drafting after the game is loaded again', () => {
  let db: SnapshotDatabase;
  let game: IGame;
  let first: IPlayer;
  let second: IPlayer;

  // Picks the first card on offer.
  function pick(who: IPlayer) {
    who.process({type: 'card', cards: [cast(who.getWaitingFor(), SelectCard).cards[0].name]});
  }

  function rows(): Array<SerializedGame> {
    return db.games.get(game.id) as Array<SerializedGame>;
  }

  beforeEach(() => {
    db = new SnapshotDatabase();
    setTestDatabase(db);
    [game, first, second] = testGame(2, {draftVariant: true});
    game.generation = 1;
    // This moves into the draft phase, which saves the game once the cards are dealt.
    finishGeneration(game);
  });

  afterEach(() => {
    restoreTestDatabase();
  });

  it('saves the next pick in a row of its own', () => {
    pick(first);
    const picked = rows().length - 1;
    const before = structuredClone(rows()[picked]);
    expect(before.inputs).has.length(1);

    // A restart loads the game from its newest save.
    const reloaded = Game.deserialize(structuredClone(rows()[picked]));
    pick(reloaded.getPlayerById(second.id));

    expect(rows()).has.length(picked + 2);
    expect(rows()[picked].inputs).deep.eq(before.inputs);
    expect(sameState(rows()[picked], before)).is.true;
    expect(rows()[picked + 1].inputs).has.length(1);
    expect(rows()[picked + 1].inputs![0].playerId).eq(second.id);
  });

  it('keeps the pick of the player who answered before the restart on a row of its own', () => {
    pick(first);
    const picked = rows().length - 1;

    const reloaded = Game.deserialize(structuredClone(rows()[picked]));
    // The player who picked can change the pick: that is the answer the next row records.
    const again = reloaded.getPlayerById(first.id);
    expect(cast(again.getWaitingFor(), SelectCard).optional).is.true;
    pick(again);

    expect(rows()).has.length(picked + 2);
    expect(rows()[picked].inputs![0].playerId).eq(first.id);
    expect(rows()[picked + 1].inputs![0].playerId).eq(first.id);
  });

  it('saves a draft that nothing was dealt for yet, with the cards dealt', () => {
    // The newest row, as it was stored before the cards were dealt.
    const undealt = rows()[rows().length - 1];
    for (const player of undealt.players) {
      player.needsToDraft = undefined;
      player.draftHand = [];
    }

    Game.deserialize(structuredClone(undealt));

    const dealt = rows()[undealt.lastSaveId];
    expect(dealt.players.map((p) => p.needsToDraft)).deep.eq([true, true]);
    expect(dealt.players.map((p) => p.draftHand.length)).deep.eq([4, 4]);
  });

  it('does not save a second time when loading ends the round', () => {
    const done = structuredClone(rows()[rows().length - 1]);
    for (const player of done.players) {
      player.needsToDraft = false;
      player.draftHand = [];
    }
    let saves = 0;
    const saveGame = db.saveGame.bind(db);
    db.saveGame = (g) => {
      saves++;
      return saveGame(g);
    };

    Game.deserialize(structuredClone(done));

    expect(saves).eq(1);
  });

  it('does not save when a sandbox loads the draft', () => {
    pick(first);
    const count = rows().length;
    const newest = structuredClone(rows()[count - 1]);
    const saved: Array<SerializedGame> = [];

    const sandbox = Game.deserialize(structuredClone(newest), {sandbox: true, onSave: (_game, state) => saved.push(state)});

    expect(saved).is.empty;
    expect(rows()).has.length(count);
    expect(sandbox.lastSaveId).eq(newest.lastSaveId);
  });
});
