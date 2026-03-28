<template>
  <div class="ma-block">
    <div class="ma-player" v-if="award.playerName">
      <i :title="award.playerName" class="board-cube" :class="`board-cube--${award.color}`" />
    </div>

    <div class="ma-name ma-name--awards award-block" :class="nameCss">
      <span v-i18n>{{ award.name }}</span>
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
            class="ma-score"
            :class="`player_bg_color_${score.color}`"
            v-text="score.score"
            data-test="player-score"
          />
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
import {FundedAwardModel, AwardScore} from '@/common/models/FundedAwardModel';
import {getAward} from '@/client/MilestoneAwardManifest';
import {playerSymbol} from '@/client/utils/playerSymbol';
import {Color} from '@/common/Color';

const AUTOMA_AWARD_RULES: Record<string, string> = {
  // Tharsis
  'Landlord': 'Total tiles on board',
  'Banker': 'Building + Event track',
  'Scientist': 'Science track',
  'Thermalist': 'Energy track + 5',
  'Miner': 'Space track + 5',
  // Hellas
  'Cultivator': 'Greenery owned (unchanged)',
  'Magnate': 'Green cards in played pile',
  'Space Baron': 'Space track',
  'Excentric': 'Every 5 MC = 1 resource',
  'Contractor': 'Building track',
  // Elysium
  'Celebrity': 'Cards costing 20+ MC (including events)',
  'Industrialist': 'Energy track + 5',
  'Benefactor': 'TR minus 15',
  // Terra Cimmeria
  'Electrician': 'Energy track',
  'Mogul': 'Highest track \u00d7 2',
  'Zoologist': 'Bio track + 5',
  'Forecaster': 'Every 7 MC = 1 card with requirement',
  // Utopia Planitia
  'Investor': 'Building + Science track',
  'Botanist': 'Bio track minus 2',
  'Incorporator': 'Cards costing 10 MC or less (including events)',
  // Vastitas Borealis Nova
  'Traveller': 'Building + Science track + 5',
  'Manufacturer': 'Building + Energy track',
  'Blacksmith': 'Building OR Space track (higher)',
  'Promoter': 'Energy track',
  // Modular
  'Administrator': 'Cards without tags in played pile + 2',
  'Collector': 'Tracks at space 3+',
  'Politician': 'Always 5',
  'Visionary': 'Lowest track \u00d7 2',
  'Supplier': 'Energy track + 5',
  'Biologist': 'Bio track + 5',
};

export default defineComponent({
  name: 'Award',
  props: {
    award: {
      type: Object as () => FundedAwardModel,
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
    playerSymbol(color: Color) {
      return playerSymbol(color);
    },
  },
  computed: {
    nameCss(): string {
      return 'ma-name--' + this.award.name.replaceAll(' ', '-').replaceAll('.', '').toLowerCase();
    },
    sortedScores(): Array<AwardScore> {
      return [...this.award.scores].sort((s1, s2) => s2.score - s1.score);
    },
    description(): string {
      return getAward(this.award.name).description;
    },
    automaRule(): string | undefined {
      return AUTOMA_AWARD_RULES[this.award.name];
    },
  },
});
</script>
