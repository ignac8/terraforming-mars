import {expect} from 'chai';
import {testGame} from '../TestingUtils';
import {sameState, stateHash} from '../../src/server/rewind/stateHash';
import {SerializedAutomaState, SerializedGame} from '../../src/server/SerializedGame';
import {Asteroid} from '../../src/server/cards/base/Asteroid';
import {MarsBotBonusCard} from '../../src/server/automa/bonusCards/MarsBotBonusCard';
import {MarsBotBonusDeckCard} from '../../src/server/automa/MarsBotBonusDeck';
import {LEGACY_BONUS_CARD_IDS} from '../../src/server/automa/legacyBonusCards';

describe('stateHash', () => {
  it('ignores clocks, save ids and log timestamps', () => {
    const [game] = testGame(1);
    const a = game.serialize();
    const b = structuredClone(a);
    b.players[0].timer.sumElapsed += 5000;
    b.lastSaveId += 3;
    b.undoCount += 1;
    b.gameAge += 1;
    b.inputs = [];
    b.gameLog[0].timestamp += 1;
    expect(stateHash(b)).eq(stateHash(a));
    expect(sameState(a, b)).is.true;
    b.players[0].megaCredits += 1;
    expect(stateHash(b)).not.eq(stateHash(a));
    expect(sameState(a, b)).is.false;
  });

  it('ignores the table state', () => {
    const [game, player] = testGame(2);
    const a = game.serialize();
    const b = structuredClone(a);
    b.frozen = true;
    b.rewindVote = {id: 1, requester: player.id, saveId: 1, moveNumber: 1, generation: 1, cards: 'same', yes: [player.id], status: 'open', expiresAt: 1};
    b.rewindRequestLimits = {generation: 1, players: [player.id]};
    expect(stateHash(b)).eq(stateHash(a));
    expect(sameState(a, b)).is.true;
  });

  it('matches a save from before automaOption was renamed to automa', () => {
    const [game] = testGame(1, {automa: true});
    const a = game.serialize();
    const b = structuredClone(a);
    const {automa, ...gameOptions} = b.gameOptions;
    b.gameOptions = {...gameOptions, automaOption: automa} as unknown as typeof b.gameOptions;
    expect(stateHash(b)).eq(stateHash(a));
    expect(sameState(a, b)).is.true;
  });

  it('matches a save from before the bonus deck was saved like the other decks', () => {
    const [game] = testGame(1, {automa: true});
    const bonusDeck = game.automaHooks!.marsBot.bonusDeck;
    bonusDeck.discard(bonusDeck.draw(game)!, new Asteroid());
    const a = game.serialize();
    const b = structuredClone(a);
    // Older saves hold the piles under their own keys, bonus cards by id
    delete (b.automaState as Partial<SerializedAutomaState>).bonusDeck;
    const legacyEntry = (c: MarsBotBonusDeckCard) => c instanceof MarsBotBonusCard ? LEGACY_BONUS_CARD_IDS[c.name] : c.name;
    b.automaState!.bonusDeckDrawPile = bonusDeck.drawPile.map(legacyEntry);
    b.automaState!.bonusDeckDiscardPile = bonusDeck.discardPile.map(legacyEntry);
    expect(stateHash(b)).eq(stateHash(a));
    expect(sameState(a, b)).is.true;
    a.automaState!.bonusDeck.drawPile.reverse();
    expect(stateHash(b)).not.eq(stateHash(a));
    expect(sameState(a, b)).is.false;
  });

  // Recorded replays hold the hash of their state before BonusCardName, with bonus cards by id.
  const BEFORE_BONUS_CARD_NAME = '7ace729a0d6c9dd48e88a89e7b5aeddad85293308b3141f32be26cc2ac54035c';
  for (const run of [
    {form: 'name', bonusDeck: {drawPile: ['Meteor Shower', 'Asteroid'], discardPile: ['Research and Development']}},
    {form: 'name with suffix', bonusDeck: {drawPile: ['Meteor Shower:automa', 'Asteroid'], discardPile: ['Research and Development:automa']}},
    {form: 'id under the older keys', bonusDeckDrawPile: ['B01', 'Asteroid'], bonusDeckDiscardPile: ['B03']},
  ]) {
    it('hashes bonus cards as before BonusCardName: ' + run.form, () => {
      const {form: _form, ...piles} = run;
      const actionDeckCardNames = run.form === 'name' ? ['Mine', 'Invasive Species'] : ['Mine', 'B02'];
      const d = {players: [], gameOptions: {automa: true}, gameLog: [], automaState: {actionDeckCardNames, ...piles}};

      expect(stateHash(d as unknown as SerializedGame)).eq(BEFORE_BONUS_CARD_NAME);
    });
  }

  it('does not depend on key order, and notices a missing log line', () => {
    const [game] = testGame(1);
    const a = game.serialize();
    const b = Object.fromEntries(Object.entries(structuredClone(a)).reverse()) as typeof a;
    expect(stateHash(b)).eq(stateHash(a));
    b.gameLog.pop();
    expect(stateHash(b)).not.eq(stateHash(a));
  });
});
