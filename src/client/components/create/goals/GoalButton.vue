<!-- Button showing how the milestones and awards are chosen, which opens a popup for changing it. -->
<template>
  <div>
    <input type="checkbox" v-model="showPopup" id="maSelector-checkbox">
    <label for="maSelector-checkbox">
      <span v-i18n>Milestones and Awards</span>&nbsp;({{ summary }})
    </label>
    <GoalPopup v-if="showPopup" v-model="goals" :limit="limit" :isGoalDisabled="isGoalDisabled" @close="showPopup = false" />
  </div>
</template>

<script setup lang="ts">
import {computed, ref} from 'vue';
import GoalPopup from './GoalPopup.vue';
import {translateText} from '@/client/directives/i18n';
import {Expansion} from '@/common/cards/GameModule';
import {MilestoneName} from '@/common/ma/MilestoneName';
import {AwardName} from '@/common/ma/AwardName';
import {GoalSettings} from './types';
import {POOL_LABELS, RANDOM_GOAL_TYPE_LABELS, RANDOMNESS_LABELS} from './labels';

const props = defineProps<{
  expansions: Readonly<Record<Expansion, boolean>>;
  /** True for a milestone or award that can't be picked in this game. */
  isGoalDisabled?: (name: MilestoneName | AwardName) => boolean;
}>();

const goals = defineModel<GoalSettings>({required: true});
const limit = computed(() => props.expansions.venus ? 6 : 5);

/** The settings in brief, such as "Random, Maps, Limited synergy". */
const summary = computed(() => {
  const {type, random} = goals.value;
  const parts = type === 'random' ?
    [RANDOM_GOAL_TYPE_LABELS.random, POOL_LABELS[random.pool], RANDOMNESS_LABELS[random.randomness]] :
    [RANDOM_GOAL_TYPE_LABELS[type]];
  return parts.map(translateText).join(', ');
});

const showPopup = ref(false);
</script>
