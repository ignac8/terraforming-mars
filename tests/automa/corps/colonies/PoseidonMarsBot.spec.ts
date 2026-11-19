import {expect} from 'chai';
import {BoardName} from '@/common/boards/BoardName';
import {CardName} from '@/common/cards/CardName';
import {ColonyName} from '@/common/colonies/ColonyName';
import {AUTOMA_COLONIES_MANIFEST} from '@/server/automa/corps/AutomaColoniesManifest';
import {PoseidonMarsBot} from '@/server/automa/corps/colonies/PoseidonMarsBot';
import {Ceres} from '@/server/colonies/Ceres';
import {Luna} from '@/server/colonies/Luna';
import {testGame} from '../../../TestGame';
import {setAllTracks} from '../../FakeMarsBot';
import {getMarsBot} from '../CorpGame';
import {TRACK, recordingMarsBot} from '../RecordingMarsBot';

describe('PoseidonMarsBot', () => {
  it('places a colony at setup', () => {
    const {marsBot, calls} = recordingMarsBot();

    new PoseidonMarsBot().setup(marsBot);

    expect(calls).deep.eq(['maybePlaceRandomColony()']);
  });

  it('advances the least-advanced track for each colony either player builds', () => {
    const {marsBot, calls} = recordingMarsBot();
    setAllTracks(marsBot, 4);
    marsBot.marsBotBoard.tracks[TRACK.power].position = 2;

    new PoseidonMarsBot().onColonyPlaced(marsBot);

    expect(calls).deep.eq([`advanceTrack(${TRACK.power})`]);
  });

  it('maybePlaceRandomColony places on one of the available tiles', () => {
    const [game] = testGame(1, {automa: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBot(game);
    const luna = new Luna();
    const ceres = new Ceres();
    game.colonies = [luna, ceres];

    marsBot.maybePlaceRandomColony();

    // One of the two should have MarsBot's colony
    const hasLuna = luna.colonies.includes(marsBot.player.id);
    const hasCeres = ceres.colonies.includes(marsBot.player.id);
    expect(hasLuna || hasCeres).to.be.true;
  });

  it('gains 2 resources to shipping board (C-33)', () => {
    const [game] = testGame(1, {automa: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBot(game);
    const luna = new Luna();
    game.colonies = [luna];

    const before = marsBot.shippingBoard.get(ColonyName.LUNA);
    marsBot.maybePlaceRandomColony();
    expect(marsBot.shippingBoard.get(ColonyName.LUNA)).to.eq(before + 2);
  });

  it('corp name is Poseidon', () => {
    expect(CardName.POSEIDON).to.not.be.undefined;
  });

  it('colony placement advances least-advanced track (C-33 ongoing effect)', () => {
    const [game] = testGame(1, {automa: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBot(game);
    const luna = new Luna();
    game.colonies = [luna];

    // Assign Poseidon corp so the effect fires
    marsBot.corp = AUTOMA_COLONIES_MANIFEST.corps[CardName.POSEIDON];

    // Record the least-advanced track position before placement
    const leastIdx = marsBot.marsBotBoard.tracks.reduce((minIdx, t, i, arr) => t.position < arr[minIdx].position ? i : minIdx, 0);
    const beforePos = marsBot.marsBotBoard.tracks[leastIdx].position;

    marsBot.maybePlaceRandomColony();

    // The least-advanced track should have advanced by 1
    const newLeastAdvancedPos = marsBot.marsBotBoard.tracks[leastIdx].position;
    expect(newLeastAdvancedPos).to.eq(beforePos + 1);
  });

  it('the player building a colony advances the least-advanced track of MarsBot too', () => {
    const [game, human] = testGame(1, {automa: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBot(game);
    const luna = new Luna();
    game.colonies = [luna];
    marsBot.corp = AUTOMA_COLONIES_MANIFEST.corps[CardName.POSEIDON];
    const leastIdx = marsBot.marsBotBoard.getLeastAdvancedTrackIndex();
    const beforePos = marsBot.marsBotBoard.tracks[leastIdx].position;

    luna.addColony(human);

    expect(marsBot.marsBotBoard.tracks[leastIdx].position).to.eq(beforePos + 1);
  });

  it('fires once when MarsBot builds a colony', () => {
    const [game] = testGame(1, {automa: true, coloniesExtension: true, boardName: BoardName.THARSIS});
    const marsBot = getMarsBot(game);
    game.colonies = [new Luna()];
    let fired = 0;
    marsBot.corp = {name: CardName.POSEIDON, description: '', tags: [], onColonyPlaced: () => fired++};

    marsBot.maybePlaceRandomColony();

    expect(fired).to.eq(1);
  });
});
