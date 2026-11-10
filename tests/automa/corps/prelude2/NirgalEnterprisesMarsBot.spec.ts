import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {getMarsBotCorp} from '@/server/automa/corps/MarsBotCorpRegistry';
import {NIRGAL_ENTERPRISES_MARSBOT_CORP} from '@/server/automa/corps/prelude2/NirgalEnterprisesMarsBot';
import {createAutomaGame, resetCorpRegistry} from '../CorpGame';
import {recordingMarsBot} from '../RecordingMarsBot';

describe('NirgalEnterprisesMarsBot', () => {
  beforeEach(resetCorpRegistry);

  it('removes Overachievement at setup', () => {
    const {marsBot, calls} = recordingMarsBot();

    NIRGAL_ENTERPRISES_MARSBOT_CORP.setup!(marsBot);

    expect(calls).deep.eq(['removeBonusCard(B04)']);
  });

  it('adds 2 to every award', () => {
    expect(NIRGAL_ENTERPRISES_MARSBOT_CORP.effect!.awardScoreBonus!(recordingMarsBot().marsBot)).eq(2);
  });

  const milestone = 'maybeClaimMilestone()';
  const award = 'maybeFundAward()';
  for (const [generation, expected] of [[1, []], [2, [milestone]], [5, [milestone]], [6, [award]], [9, [award]], [10, [milestone]]] as const) {
    it(`claims a milestone in generations 2 to 5 and from 10, and funds an award in 6 to 9, generation ${generation}`, () => {
      const {marsBot, calls} = recordingMarsBot();
      marsBot.game.generation = generation;

      NIRGAL_ENTERPRISES_MARSBOT_CORP.beforeActionPhase!(marsBot);

      expect(calls).deep.eq(expected);
    });
  }

  it('scores 2 more in every award', () => {
    const {game, marsBot} = createAutomaGame();
    const scores = () => game.awards.map((award) => marsBot.turnResolver.getMarsBotAwardValue(award));
    const before = scores();

    marsBot.corp = getMarsBotCorp(CardName.NIRGAL_ENTERPRISES)!;

    expect(scores()).to.deep.eq(before.map((score) => score + 2));
  });

  it('wins a funded award at final scoring with its +2', () => {
    const {game, human, marsBot} = createAutomaGame();
    marsBot.corp = getMarsBotCorp(CardName.NIRGAL_ENTERPRISES)!;
    game.fundAward(human, game.awards.find((a) => a.name === 'Scientist')!);
    human.tagsForTest = {science: 2};

    expect(marsBot.getVictoryPoints().awards).to.eq(5);
  });

  for (const generation of [2, 5, 10, 14]) {
    it('claims a milestone before the action phase in generations 2-5 and 10+: ' + JSON.stringify({generation}), () => {
      const {game, marsBot} = createAutomaGame();
      marsBot.corp = getMarsBotCorp(CardName.NIRGAL_ENTERPRISES)!;
      marsBot.marsBotBoard.tracks[0].position = 8; // 8 building tags: Builder
      (game as any).generation = generation;

      marsBot.corp.beforeActionPhase!(marsBot);

      expect(game.claimedMilestones.map((m) => [m.player, m.milestone.name]), `generation ${generation}`)
        .to.deep.eq([[marsBot.player, 'Builder']]);
      expect(game.fundedAwards, `generation ${generation}`).is.empty;
    });
  }

  for (const generation of [6, 9]) {
    it('funds an award before the action phase in generations 6-9: ' + JSON.stringify({generation}), () => {
      const {game, marsBot} = createAutomaGame();
      marsBot.corp = getMarsBotCorp(CardName.NIRGAL_ENTERPRISES)!;
      marsBot.marsBotBoard.tracks[0].position = 8;
      (game as any).generation = generation;

      marsBot.corp.beforeActionPhase!(marsBot);

      expect(game.fundedAwards.map((a) => a.player), `generation ${generation}`).to.deep.eq([marsBot.player]);
      expect(game.claimedMilestones, `generation ${generation}`).is.empty;
    });
  }

  it('takes no Failed Action when it cannot claim or fund', () => {
    const {game, human, marsBot} = createAutomaGame();
    marsBot.corp = getMarsBotCorp(CardName.NIRGAL_ENTERPRISES)!;
    for (const award of game.awards.slice(0, 3)) {
      game.fundAward(human, award);
    }
    const mc = marsBot.turnResolver.megacredits;

    (game as any).generation = 3; // No milestone is met.
    marsBot.corp.beforeActionPhase!(marsBot);
    (game as any).generation = 7; // Every award slot is taken.
    marsBot.corp.beforeActionPhase!(marsBot);

    expect(game.claimedMilestones).is.empty;
    expect(game.fundedAwards).has.length(3);
    expect(marsBot.turnResolver.megacredits).to.eq(mc);
  });
});
