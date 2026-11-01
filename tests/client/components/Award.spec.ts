import {mount} from '@vue/test-utils';
import {globalConfig} from '@tests/client/components/getLocalVue';
import {expect} from 'chai';
import Award from '@/client/components/Award.vue';
import {FundedAwardModel} from '@/common/models/FundedAwardModel';
import {getAward} from '@/client/MilestoneAwardManifest';
import {BoardName} from '@/common/boards/BoardName';

function createAward(
  {funded, scores = []}:
  {funded: boolean, scores?: FundedAwardModel['scores']},
): FundedAwardModel {
  return {
    name: `Cosmic Settler`,
    playerName: funded ? 'Bob' : undefined,
    color: funded ? 'red': undefined,
    scores,
  };
}

describe('Award', () => {
  it('shows passed award', () => {
    const award = createAward({funded: false});
    const wrapper = mount(Award, {
      ...globalConfig,
      props: {award},
    });

    expect(wrapper.text()).to.include(award.name);
  });

  it('does not show award description', () => {
    const award = createAward({funded: false});
    const wrapper = mount(Award, {
      ...globalConfig,
      props: {award},
    });

    const expected = getAward('Cosmic Settler').description;
    expect(wrapper.text()).to.not.include(expected);
  });

  const showScoresRuns = [
    {value: undefined, expected: true},
    {value: true, expected: true},
    {value: false, expected: false},
  ] as const;
  for (const run of showScoresRuns) {
    it('Show scores ' + run.value, () => {
      const award = createAward({funded: true, scores: [{color: 'red', score: 2}]});
      const wrapper = mount(Award, {...globalConfig, props: {award, showScores: run.value}});

      expect(wrapper.find('[data-test=player-score]').exists()).to.eq(run.expected);
    });
  }

  it('colors player score', () => {
    const award = createAward({
      funded: true,
      scores: [
        {color: 'red', score: 2},
      ],
    });

    const wrapper = mount(Award, {
      ...globalConfig,
      props: {award, showScores: true},
    });

    const scoreWrapper = wrapper.find('[data-test=player-score]');
    expect(scoreWrapper.classes()).to.includes(`player_bg_color_${award.scores[0].color}`);
  });

  it('shows sorted players scores', () => {
    const award = createAward({
      funded: false,
      scores: [
        {color: 'red', score: 2},
        {color: 'blue', score: 4},
        {color: 'yellow', score: 0},
        {color: 'green', score: 4},
      ],
    });

    const wrapper = mount(Award, {
      ...globalConfig,
      props: {award, showScores: true},
    });

    const scores = wrapper.findAll('[data-test=player-score]')
      .map((scoreWrapper) => parseInt(scoreWrapper.text()));

    expect(scores).to.be.deep.eq([4, 4, 2, 0]);
  });

  it('shows player cube if award is funded', () => {
    const award = createAward({funded: true});
    const wrapper = mount(Award, {
      ...globalConfig,
      props: {award},
    });

    expect(wrapper.find(`.board-cube--${award.color}`).exists()).to.be.true;
  });

  describe('MarsBot hint', () => {
    const award: FundedAwardModel = {...createAward({funded: false}), name: 'Traveller'};
    const traveller = getAward('Traveller');

    function hint(automaMapSet?: BoardName): string {
      const wrapper = mount(Award, {...globalConfig, props: {award, showDescription: true, isAutoma: true, automaMapSet}});
      return wrapper.find('.ma-automa-hint').text();
    }

    it('uses the map wording when the game plays the map\'s set', () => {
      expect(hint(BoardName.VASTITAS_BOREALIS_NOVA)).to.include(traveller.automaMapDescriptions![BoardName.VASTITAS_BOREALIS_NOVA]!);
    });

    it('uses the generic wording for any other game', () => {
      expect(hint(BoardName.ELYSIUM)).to.include(traveller.automaDescription!);
      expect(hint(undefined)).to.include(traveller.automaDescription!);
    });
  });

  it('creates correct css class from award name', () => {
    const award = createAward({funded: true});
    const wrapper = mount(Award, {
      ...globalConfig,
      props: {award},
    });

    expect(wrapper.find('.ma-name--cosmic-settler').exists()).to.be.true;
  });
});
