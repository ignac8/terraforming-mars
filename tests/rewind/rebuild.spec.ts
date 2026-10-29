import {expect} from 'chai';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {SerializedGame} from '../../src/server/SerializedGame';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {MAX_REPLAYED_INPUTS, readRebuildSaves, replayToSave} from '../../src/server/rewind/rebuild';
import {Phase} from '../../src/common/Phase';
import {Timer} from '../../src/common/Timer';
import {cast} from '../../src/common/utils/utils';
import {FakeClock} from '../common/FakeClock';
import {restoreTestDatabase, setTestDatabase} from '../testing/setup';
import {SnapshotDatabase} from '../testing/SnapshotDatabase';
import {TestPlayer} from '../TestPlayer';
import {testGame} from '../TestingUtils';

describe('rebuild', () => {
  let db: SnapshotDatabase;
  let game: IGame;
  let player: TestPlayer;
  // The save that starts generation 2, and the save five answers later.
  let research: number;
  let target: number;

  function choose(title: string) {
    const action = cast(player.getWaitingFor(), OrOptions);
    player.process({type: 'or', index: action.options.findIndex((option) => option.title === title), response: {type: 'option'}});
  }

  beforeEach(() => {
    db = new SnapshotDatabase();
    setTestDatabase(db);
    [game, player] = testGame(1);
    player.heat = 40;
    player.takeAction();
    choose('Pass for this generation');
    research = game.lastSaveId - 1;
    // Buys no cards, converts heat three times and passes. Each answer ends in a save.
    player.process({type: 'card', cards: []});
    for (let i = 0; i < 3; i++) {
      choose('Convert 8 heat into temperature');
    }
    choose('Pass for this generation');
    // Passing also saves the research phase of generation 3, inside the same answer.
    target = game.lastSaveId - 2;
  });

  afterEach(() => {
    restoreTestDatabase();
  });

  it('replays the recorded inputs from the generation start to the chosen save', async () => {
    const saves = await readRebuildSaves(game, target);
    expect(saves.map((save) => save.lastSaveId)).deep.eq([research, research + 1, research + 2, research + 3, research + 4, target]);
    expect(saves[0].phase).eq(Phase.RESEARCH);

    // saves.slice(1) starts from a save that carries the input that led to it.
    for (const from of [saves, saves.slice(1)]) {
      let atTarget: object | undefined;
      const r = replayToSave(from, (sandbox) => {
        atTarget = {waitingFor: sandbox.getPlayerById(player.id).getWaitingFor(), inputs: sandbox.inputsSinceSave};
      });
      expect(r.outcome).eq('replayed');
      // onTarget runs inside the target save, before the next prompt is set, with no inputs left over from the first save.
      expect(atTarget).deep.eq({waitingFor: undefined, inputs: []});
      expect(r.game!.getPlayerById(player.id).getWaitingFor()).is.not.undefined;
    }
    // What onTarget throws is not a mismatch.
    expect(() => replayToSave(saves, () => {
      throw new Error('onTarget failed');
    })).to.throw('onTarget failed');
  });

  it('reports a mismatch when the replay differs from the recording', async () => {
    const saves = await readRebuildSaves(game, target);
    const tampers: Array<(saves: Array<SerializedGame>) => void> = [
      (s) => s[2].players[0].megaCredits++,
      (s) => s[2].inputs![0].stateHash = 'x',
      (s) => s[2].inputs![0].prompt.type = 'card',
      // An answer the game rejects.
      (s) => s[2].inputs![0].response = {type: 'or', index: 999, response: {type: 'option'}},
      // The inputs run out before the last save.
      (s) => s[s.length - 1].inputs!.pop(),
    ];
    for (const tamper of tampers) {
      const tampered = structuredClone(saves);
      tamper(tampered);
      expect(replayToSave(tampered).outcome).eq('mismatch');
    }
  });

  it('does not replay across saves written before inputs were recorded, rewinds or missing saves, or past the input limit', async () => {
    // Each change to the stored saves, and the save the replay then starts from.
    const changes: Array<[(rows: Array<SerializedGame | undefined>) => void, number]> = [
      [(rows) => delete rows[target]!.inputs, target],
      [(rows) => delete rows[target - 1]!.inputs, target - 1],
      [() => game.rewinds.push({saveId: target - 1, restoredSaveId: research, logStart: 0, logEnd: 0}), target - 1],
      [(rows) => rows[target - 2] = undefined, target - 1],
      [(rows) => rows[target]!.inputs = Array(MAX_REPLAYED_INPUTS).fill(rows[target]!.inputs![0]), target - 1],
    ];
    const original = db.games.get(game.id)!;
    for (const [change, base] of changes) {
      const rows = structuredClone(original);
      db.games.set(game.id, rows);
      game.rewinds = [];
      change(rows);
      const saves = await readRebuildSaves(game, target);
      expect(saves[0].lastSaveId).eq(base);
      expect(saves[saves.length - 1].lastSaveId).eq(target);
    }
  });

  it('stops reporting saves once the sandbox becomes a live game', () => {
    let calls = 0;
    const sandbox = Game.deserialize(structuredClone(db.games.get(game.id)![research]!), {sandbox: true, onSave: () => calls++});
    expect(calls).eq(1);
    sandbox.isSandbox = false;
    sandbox.save();
    sandbox.isSandbox = true;
    sandbox.save();
    expect(calls).eq(1);
  });

  it('leaves the shared clock where it was', async () => {
    const saves = await readRebuildSaves(game, target);
    const lastStoppedAt = (Timer as any).lastStoppedAt;
    try {
      const clock = new FakeClock();
      clock.millis = 1000;
      const probe = Timer.newInstance(clock);
      probe.start();
      probe.stop();

      expect(replayToSave(saves).outcome).eq('replayed');

      const next = Timer.newInstance(clock);
      next.start();
      expect(next.serialize().startedAt).eq(1000);
    } finally {
      (Timer as any).lastStoppedAt = lastStoppedAt;
    }
  });
});
