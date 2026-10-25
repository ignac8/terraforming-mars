import {expect} from 'chai';
import {Birds} from '../../../src/server/cards/base/Birds';
import {Ants} from '../../../src/server/cards/base/Ants';
import {Farmer} from '../../../src/server/milestones/modular/Farmer';
import {TestPlayer} from '../../TestPlayer';
import {BoardName} from '@/common/boards/BoardName';
import {Tag} from '@/common/cards/Tag';
import {TrackDefinition} from '@/common/automa/AutomaTypes';
import {marsBotCanClaimMilestone} from '@/server/automa/MarsBotMilestoneAwardEval';
import {fakeMarsBot, setTrack} from '../../automa/FakeMarsBot';

describe('Farmer', () => {
  let milestone: Farmer;
  let player: TestPlayer;

  beforeEach(() => {
    milestone = new Farmer();
    player = TestPlayer.BLUE.newPlayer();
  });

  it('Can claim with 5 animals or microbes', () => {
    const birds = new Birds();
    const ants = new Ants();
    player.playedCards.push(birds, ants);

    player.addResourceTo(ants);
    player.addResourceTo(ants);
    player.addResourceTo(birds);
    player.addResourceTo(birds);
    expect(milestone.canClaim(player)).is.false;

    player.addResourceTo(birds);
    expect(milestone.canClaim(player)).is.true;
  });

  it('MarsBot needs space 6 of the Microbe or Bio track on Vastitas Borealis, space 7 of the Bio track elsewhere', () => {
    // Vastitas Borealis puts the Microbe tag on a track of its own.
    const tracks: Array<TrackDefinition> = [Tag.MICROBE, Tag.PLANT].map(
      (tag) => ({tags: [tag], productions: [], layout: []}));
    const vastitas = {boardName: BoardName.VASTITAS_BOREALIS_NOVA};
    const expansion = {boardName: BoardName.VASTITAS_BOREALIS_NOVA, modularMA: true};

    for (const run of [
      {gameOptions: vastitas, microbe: 6, plant: 0, expected: true},
      {gameOptions: vastitas, microbe: 0, plant: 6, expected: true},
      {gameOptions: vastitas, microbe: 5, plant: 5, expected: false},
      {gameOptions: expansion, microbe: 0, plant: 6, expected: false},
      {gameOptions: expansion, microbe: 0, plant: 7, expected: true},
    ]) {
      const bot = fakeMarsBot({tracks, gameOptions: run.gameOptions});
      setTrack(bot, Tag.MICROBE, run.microbe);
      setTrack(bot, Tag.PLANT, run.plant);
      expect(marsBotCanClaimMilestone(milestone, bot), JSON.stringify(run)).eq(run.expected);
    }
  });
});
