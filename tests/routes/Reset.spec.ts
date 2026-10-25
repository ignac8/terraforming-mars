import {expect} from 'chai';
import {Reset} from '../../src/server/routes/Reset';
import {isTableLocked, withTableLock} from '../../src/server/rewind/tableLock';
import {RouteError} from '../../src/server/routes/RouteError';
import {statusCode} from '../../src/common/http/statusCode';
import {cast} from '../../src/common/utils/utils';
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
        expect(res.content).eq('Bad request: The table is being rewound. Click OK to refresh this page.');
      }
    }
  });

  it('holds the table while it reloads', async () => {
    const scaffolding = new RouteTestScaffolding();
    const res = new MockResponse();
    const [game, player] = testGame(1);
    const loader = scaffolding.ctx.gameLoader;
    await loader.add(game);
    const getGame = loader.getGame.bind(loader);
    let reached = () => {};
    const atReload = new Promise<void>((resolve) => reached = resolve);
    let release = () => {};
    loader.getGame = (id, forceLoad) => {
      if (!forceLoad) {
        return getGame(id);
      }
      reached();
      return new Promise((resolve) => release = () => resolve(game));
    };

    scaffolding.url = `/reset?id=${player.id}`;
    const resetting = scaffolding.get(Reset.INSTANCE, res);
    await atReload;
    try {
      expect(isTableLocked(game.id)).is.true;
      let refused: unknown;
      await withTableLock(game.id, async () => {}).catch((e) => refused = e);
      expect(cast(refused, RouteError).detail).eq('A rewind is already running.');
    } finally {
      release();
      await resetting;
    }

    expect(res.statusCode).eq(statusCode.ok);
    expect(isTableLocked(game.id)).is.false;
  });
});
