import {expect} from 'chai';
import {Game} from '@/server/Game';
import {GameLoader} from '@/server/database/GameLoader';
import {SerializedGame} from '@/server/SerializedGame';
import {testGame} from '@tests/TestGame';

describe('verify #7: solo Colonies reload during initial research', () => {
  it('in-memory serialize after creation, then deserialize: MC production', () => {
    const [game, player] = testGame(1, {coloniesExtension: true, skipInitialCardSelection: false});
    expect(player.production.megacredits).eq(-2);
    const g2 = Game.deserialize(JSON.parse(JSON.stringify(game.serialize())));
    console.log('in-memory round trip MC prod:', g2.players[0].production.megacredits);
  });

  it('what the DB actually stores (snapshot taken inside save()), then deserialize: MC production', () => {
    const loader = GameLoader.getInstance() as any;
    const original = loader.saveGame;
    const saved: Array<SerializedGame> = [];
    loader.saveGame = (g: any) => {
      saved.push(JSON.parse(JSON.stringify(g.serialize())));
      return Promise.resolve();
    };
    try {
      const [, player] = testGame(1, {coloniesExtension: true, skipInitialCardSelection: false});
      expect(player.production.megacredits).eq(-2);
      console.log('saves during creation:', saved.length, 'stored MC prod:', (saved[saved.length - 1].players[0] as any).megaCreditProduction);
      const g2 = Game.deserialize(saved[saved.length - 1]);
      console.log('reload-from-DB MC prod:', g2.players[0].production.megacredits);
      expect(g2.players[0].production.megacredits).eq(-2);
      // reload twice in a row (e.g. two restarts) from the same stored row
      const g3 = Game.deserialize(saved[saved.length - 1]);
      expect(g3.players[0].production.megacredits).eq(-2);
    } finally {
      loader.saveGame = original;
    }
  });
});
