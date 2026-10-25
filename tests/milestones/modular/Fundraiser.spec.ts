import {expect} from 'chai';
import {testGame} from '../../TestGame';
import {Fundraiser} from '../../../src/server/milestones/modular/Fundraiser';
import {TestPlayer} from '../../TestPlayer';
import {Resource} from '../../../src/common/Resource';
import {BoardName} from '@/common/boards/BoardName';
import {Tag} from '@/common/cards/Tag';
import {marsBotCanClaimMilestone} from '@/server/automa/MarsBotMilestoneAwardEval';
import {fakeMarsBot, setTrack} from '../../automa/FakeMarsBot';

describe('Fundraiser', () => {
  let milestone: Fundraiser;
  let player: TestPlayer;

  beforeEach(() => {
    milestone = new Fundraiser();
    [/* game */, player] = testGame(2);
  });

  it('Cannot claim with zero production', () => {
    expect(milestone.canClaim(player)).is.false;
  });

  it('Cannot claim with less than 12 production', () => {
    player.production.add(Resource.MEGACREDITS, 8);

    expect(milestone.canClaim(player)).is.false;
  });

  it('Can claim with exactly 12 production', () => {
    player.production.add(Resource.MEGACREDITS, 12);

    expect(milestone.canClaim(player)).is.true;
  });

  it('Can claim with more than 12 production', () => {
    player.production.add(Resource.MEGACREDITS, 15);

    expect(milestone.canClaim(player)).is.true;
  });

  it('MarsBot needs space 10 on Terra Cimmeria and space 8 elsewhere', () => {
    const terraCimmeria = {boardName: BoardName.TERRA_CIMMERIA_NOVA};
    const expansion = {boardName: BoardName.TERRA_CIMMERIA_NOVA, modularMA: true};

    for (const run of [
      {gameOptions: terraCimmeria, position: 9, expected: false},
      {gameOptions: terraCimmeria, position: 10, expected: true},
      {gameOptions: expansion, position: 8, expected: true},
    ]) {
      const bot = fakeMarsBot({gameOptions: run.gameOptions});
      setTrack(bot, Tag.EVENT, run.position);
      expect(marsBotCanClaimMilestone(milestone, bot), JSON.stringify(run)).eq(run.expected);
    }
  });
});
