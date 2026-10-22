import {expect} from 'chai';
import {Reset} from '../../src/server/routes/Reset';
import {withTableLock} from '../../src/server/rewind/tableLock';
import {statusCode} from '../../src/common/http/statusCode';
import {testGame} from '../TestGame';
import {MockResponse} from './HttpMocks';
import {RouteTestScaffolding} from './RouteTestScaffolding';

describe('Reset', () => {
  it('refuses while the game is frozen or its table is locked', async () => {
    for (const hold of [undefined, 'frozen', 'locked'] as const) {
      const scaffolding = new RouteTestScaffolding();
      const res = new MockResponse();
      // Reset serves solo games only.
      const [game, player] = testGame(1);
      await scaffolding.ctx.gameLoader.add(game);
      let release = () => {};
      let locked: Promise<void> | undefined;
      if (hold === 'frozen') {
        game.frozen = true;
      } else if (hold === 'locked') {
        locked = withTableLock(game.id, () => new Promise((resolve) => release = resolve));
      }
      try {
        scaffolding.url = `/reset?id=${player.id}`;
        await scaffolding.get(Reset.INSTANCE, res);
      } finally {
        release();
        await locked;
      }

      expect(res.statusCode, hold).eq(hold === undefined ? statusCode.ok : statusCode.badRequest);
      if (hold === 'frozen') {
        expect(res.content).eq('Bad request: The game is frozen.');
      } else if (hold === 'locked') {
        expect(res.content).eq('Bad request: The table is being rewound or frozen. Click OK to refresh this page.');
      }
    }
  });
});
