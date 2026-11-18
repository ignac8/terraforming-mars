import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../../getLocalVue';
import GoalButton from '@/client/components/create/goals/GoalButton.vue';

describe('GoalButton', () => {
  it('mounts without errors', () => {
    const wrapper = mount(GoalButton, {
      ...globalConfig,
      props: {modelValue: {type: 'board', random: {pool: 'maps', randomness: 'limited'}, selected: {milestones: [], awards: []}}},
    });
    expect(wrapper.exists()).is.true;
  });

  it('disables in the popup the milestones and awards that cannot be picked', async () => {
    const wrapper = mount(GoalButton, {
      ...globalConfig,
      props: {
        modelValue: {type: 'manual', random: {pool: 'maps', randomness: 'limited'}, selected: {milestones: [], awards: []}},
        isGoalDisabled: (name) => name === 'Mayor' || name === 'Banker',
      },
    });

    await wrapper.find('#maSelector-checkbox').setValue(true);

    const disabled = wrapper.findAll('input[type="checkbox"][disabled]').map((input) => input.attributes('value'));
    expect(disabled).deep.eq(['Mayor', 'Banker']);
  });
});
