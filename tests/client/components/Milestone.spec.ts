import {mount} from '@vue/test-utils';
import {globalConfig} from './getLocalVue';
import {expect} from 'chai';
import Milestone from '@/client/components/Milestone.vue';
import {ClaimedMilestoneModel} from '@/common/models/ClaimedMilestoneModel';
import {getMilestone} from '@/client/MilestoneAwardManifest';
import {BoardName} from '@/common/boards/BoardName';

function createMilestone(
  {claimed, scores = []}:
  {claimed: boolean, scores?: ClaimedMilestoneModel['scores']},
): ClaimedMilestoneModel {
  return {
    name: 'Builder',
    playerName: claimed ? 'Bob' : undefined,
    color: claimed ? 'red': undefined,
    scores,
  };
}

describe('Milestone', () => {
  it('shows passed milestone', () => {
    const milestone = createMilestone({claimed: false});
    const wrapper = mount(Milestone, {
      ...globalConfig,
      props: {milestone},
    });

    expect(wrapper.text()).to.include(milestone.name);
  });

  it('does not show milestone description', () => {
    const milestone = createMilestone({claimed: false});
    const wrapper = mount(Milestone, {
      ...globalConfig,
      props: {milestone},
    });

    const expected = getMilestone('Builder').description;
    expect(wrapper.text()).to.not.include(expected);
  });

  const showScoresRuns = [
    {value: undefined, expected: true},
    {value: true, expected: true},
    {value: false, expected: false},
  ] as const;
  for (const run of showScoresRuns) {
    it('Show scores ' + run.value, () => {
      const milestone = createMilestone({claimed: true, scores: [{color: 'red', score: 2, claimable: false}]});
      const wrapper = mount(Milestone, {...globalConfig, props: {milestone, showScores: run.value}});

      expect(wrapper.find('[data-test=player-score]').exists()).to.eq(run.expected);
    });
  }

  it('colors player score', () => {
    const milestone = createMilestone({
      claimed: true,
      scores: [
        {color: 'red', score: 2, claimable: false},
      ],
    });

    const wrapper = mount(Milestone, {...globalConfig, props: {milestone, showScores: true}});

    const scoreWrapper = wrapper.find('[data-test=player-score]');
    expect(scoreWrapper.classes()).to.includes(`player_bg_color_${milestone.scores[0].color}`);
  });

  it('shows sorted players scores', () => {
    const milestone = createMilestone({
      claimed: false,
      scores: [
        {color: 'red', score: 2, claimable: false},
        {color: 'blue', score: 4, claimable: false},
        {color: 'yellow', score: 0, claimable: false},
        {color: 'green', score: 4, claimable: false},
      ],
    });

    const wrapper = mount(Milestone, {...globalConfig, props: {milestone, showScoresRuns: true}});

    const scores = wrapper.findAll('[data-test=player-score]')
      .map((scoreWrapper) => parseInt(scoreWrapper.text()));

    expect(scores).to.be.deep.eq([4, 4, 2, 0]);
  });

  it('shows player cube if milestone is claimed', () => {
    const milestone = createMilestone({claimed: true});
    const wrapper = mount(Milestone, {...globalConfig, props: {milestone}});

    expect(wrapper.find(`.board-cube--${milestone.color}`).exists()).to.be.true;
  });

  describe('MarsBot hint', () => {
    const milestone: ClaimedMilestoneModel = {...createMilestone({claimed: false}), name: 'Rim Settler'};
    const rimSettler = getMilestone('Rim Settler');

    function hint(automaMapSet?: BoardName): string {
      const wrapper = mount(Milestone, {...globalConfig, props: {milestone, showDescription: true, isAutoma: true, automaMapSet}});
      return wrapper.find('.ma-automa-hint').text();
    }

    it('uses the map wording when the game plays the map\'s set', () => {
      expect(hint(BoardName.HELLAS)).to.include(rimSettler.automaMapDescriptions![BoardName.HELLAS]!);
    });

    it('uses the generic wording for any other game', () => {
      expect(hint(BoardName.ELYSIUM)).to.include(rimSettler.automaDescription!);
      expect(hint(undefined)).to.include(rimSettler.automaDescription!);
    });
  });

  it('creates correct css class from milestone name', () => {
    const milestone = createMilestone({claimed: true});
    const wrapper = mount(Milestone, {...globalConfig, props: {milestone}});

    expect(wrapper.find('.ma-name--builder').exists()).to.be.true;
  });
});
