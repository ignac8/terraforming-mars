import {expect} from 'chai';
import {BoardName} from '@/common/boards/BoardName';
import {Tag} from '@/common/cards/Tag';
import {THARSIS_MARSBOT_BOARD} from '@/server/automa/boards/TharsisMarsBot';
import {VENUS_MARSBOT_TRACK} from '@/server/automa/boards/VenusMarsBot';
import {Innovator} from '@/server/awards/Innovator';
import {Manufacturer} from '@/server/awards/modular/Manufacturer';
import {Physicist} from '@/server/awards/Physicist';
import {Merchant3} from '@/server/milestones/Merchant3';
import {testGame} from '../TestGame';
import {fakeCard} from '../TestingUtils';
import {fakeMarsBot, setAllTracks, setTrack} from './FakeMarsBot';

describe('MarsBot rules for the Amazonis Planitia milestones and awards', () => {
  it('Merchant3 needs space 3 on every track except Venus', () => {
    const marsBot = fakeMarsBot({tracks: [...THARSIS_MARSBOT_BOARD, VENUS_MARSBOT_TRACK]});
    setAllTracks(marsBot, 3);
    setTrack(marsBot, Tag.VENUS, 0);
    expect(new Merchant3().marsBotCanClaim(marsBot)).is.true;

    setTrack(marsBot, Tag.EARTH, 2);
    expect(new Merchant3().marsBotCanClaim(marsBot)).is.false;
  });

  it('Innovator scores the cards in its played pile minus the generation', () => {
    const [game] = testGame(1, {boardName: BoardName.AMAZONIS_PLANITIA});
    game.generation = 10;
    const marsBot = fakeMarsBot({game, playedProjectCards: Array.from({length: 30}, () => fakeCard())});

    expect(new Innovator().marsBotScore(marsBot)).eq(20);
  });

  it('Physicist scores its Science and Space tracks minus 5', () => {
    const marsBot = fakeMarsBot();
    setTrack(marsBot, Tag.SCIENCE, 9);
    setTrack(marsBot, Tag.SPACE, 7);

    expect(new Physicist().marsBotScore(marsBot)).eq(11);
  });

  for (const run of [
    {boardName: BoardName.AMAZONIS_PLANITIA, modularMA: false, expected: 18},
    {boardName: BoardName.THARSIS, modularMA: false, expected: 21},
    {boardName: BoardName.AMAZONIS_PLANITIA, modularMA: true, expected: 21},
  ] as const) {
    it('Manufacturer scores its Building and Energy tracks minus 3 on Amazonis Planitia only: ' + JSON.stringify(run), () => {
      const [game] = testGame(1, {boardName: run.boardName, modularMA: run.modularMA});
      const marsBot = fakeMarsBot({game});
      setTrack(marsBot, Tag.BUILDING, 12);
      setTrack(marsBot, Tag.POWER, 9);

      expect(new Manufacturer().marsBotScore(marsBot)).eq(run.expected);
    });
  }
});
