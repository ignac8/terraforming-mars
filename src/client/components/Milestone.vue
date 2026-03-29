<template>
  <div class="ma-block">
    <div class="ma-player" v-if="milestone.playerName">
      <i :title="milestone.playerName" class="board-cube" :class="`board-cube--${milestone.color}`" />
    </div>
    <div class="ma-name--milestones" :class="nameCss">
      <span v-i18n>{{name}}</span>
      <div v-if="showScores" class="ma-scores player_home_block--milestones-and-awards-scores">
        <template v-for="score in sortedScores" :key="score.color">
          <p
            v-if="playerSymbol(score.color).length > 0"
            class="ma-score"
            :class="`player_bg_color_${score.color}`"
            v-text="playerSymbol(score.color)"
            data-test="player-score"
          />
          <p
            :class="getClass(score)"
            data-test="player-score"
          >{{ score.score }}{{ score.claimable ? '✓' : '✗' }}</p>
      </template>
    </div>
    </div>

    <div v-if="showDescription" class="ma-description">
      <span v-i18n>{{ description }}</span>
      <div v-if="isAutoma && automaRule" class="ma-automa-hint">MarsBot: <span v-i18n>{{ automaRule }}</span></div>
    </div>
  </div>
</template>

<script lang="ts">

import {defineComponent} from 'vue';
import {ClaimedMilestoneModel, MilestoneScore} from '@/common/models/ClaimedMilestoneModel';
import {getMilestone} from '@/client/MilestoneAwardManifest';
import {playerSymbol} from '@/client/utils/playerSymbol';
import {Color} from '@/common/Color';

const AUTOMA_MILESTONE_RULES: Record<string, string> = {
  // Tharsis
  'Terraformer': 'TR \u2265 35',
  'Mayor': '3+ city tiles on board',
  'Gardener': '3+ greenery tiles on board',
  'Builder': 'Building track \u2265 8',
  'Planner': 'All tracks \u2265 4 (except Venus)',
  // Hellas
  'Diversifier': 'All tracks \u2265 3',
  'Tactician': '35+ MC',
  'Energizer': 'Energy track \u2265 6',
  'Rim Settler': 'Space + Science track \u2265 6',
  // Elysium
  'Generalist': 'All tracks \u2265 2 (except Venus)',
  'Specialist': 'Any track \u2265 10',
  'Ecologist': 'Bio track \u2265 4',
  'Tycoon': '15 green/blue cards in played pile',
  'Legend': '5 red cards in played pile',
  // Terra Cimmeria Nova
  'Architect': 'Science track \u2265 6',
  'Coastguard': '4+ tiles adjacent to ocean',
  'C. Forester': 'Bio track \u2265 10',
  // Vastitas Borealis Nova
  'Agronomist': 'Bio + Science track \u2265 4',
  'Engineer': 'Energy + Science track \u2265 10',
  'V. Spacefarer': 'Space track \u2265 5',
  'Farmer': 'Science + Event \u2265 6 OR Bio + Science \u2265 6',
  // Modular
  'Briber': '20+ MC (loses 12 MC on claim)',
  'Builder7': 'Building track \u2265 7',
  'Forester': 'Bio track \u2265 6',
  'Fundraiser': 'Energy track \u2265 8',
  'Hydrologist': '4 oceans placed',
  'Landshaper': '1+ city, 1+ greenery, Building track \u2265 5',
  'Legend4': '4 red cards in played pile',
  'Merchant': 'All tracks \u2265 2 (except Venus)',
  'Metallurgist': 'Building + Space tracks \u2265 9',
  'Philantropist': '5 cards with non-negative VP',
  'Producer': 'Any 3 tracks (except Venus) \u2265 16',
  'Researcher': 'Science track \u2265 4',
  'Spacefarer4': 'Space track \u2265 4',
  'Tactician4': '30+ MC',
  'Terran5': 'Earth track \u2265 5',
  'Thawer': 'Raised temperature 5+ times',
  'Tycoon10': '10 blue/green cards in played pile',
};

export default defineComponent({
  name: 'Milestone',
  props: {
    milestone: {
      type: Object as () => ClaimedMilestoneModel,
      required: true,
    },
    showScores: {
      type: Boolean,
      default: true,
    },
    showDescription: {
      type: Boolean,
    },
    isAutoma: {
      type: Boolean,
      default: false,
    },
  },
  methods: {
    playerSymbol(color: Color): string {
      return playerSymbol(color);
    },
    getClass(score: MilestoneScore): string {
      let classes = 'ma-score';
      classes += ` player_bg_color_${score.color}`;
      if (score.claimable) {
        classes += ' claimable';
      } else {
        classes += ' not-claimable';
      }
      return classes;
    },
  },
  computed: {
    name(): string {
      return this.milestone.name.replace(/[0-9]+$/, '');
    },
    nameCss(): string {
      return 'ma-name ma-name--' + this.milestone.name.replaceAll(' ', '-').replaceAll('.', '').toLowerCase();
    },
    sortedScores(): Array<MilestoneScore> {
      return [...this.milestone.scores].sort((s1, s2) => s2.score - s1.score);
    },
    description(): string {
      return getMilestone(this.milestone.name).description;
    },
    automaRule(): string | undefined {
      return AUTOMA_MILESTONE_RULES[this.milestone.name];
    },
  },
});
</script>
