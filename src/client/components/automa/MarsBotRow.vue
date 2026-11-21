<!-- MarsBot as a row in the player overview. Uses PlayerInfo's classes so it matches the player rows. -->
<template>
  <div class="player-info marsbot-row" :class="colorClass">
    <div class="player-status-and-res">
      <div class="player-status">
        <div class="player-info-details">
          <div class="player-info-name">{{ model.name }}</div>
          <span v-if="model.corpName" v-i18n>
            <div class="player-info-corp" :title="$t(model.corpName)">{{ model.corpName }}</div>
          </span>
        </div>
        <div class="player-status">
          <div class="player-status-bottom">
            <div class="player-action-status-container no-timer">
              <div class="player-action-status"><span v-i18n>{{ model.difficulty }}</span></div>
            </div>
          </div>
        </div>
      </div>
      <div class="resource-items-cont">
        <div class="resource-item resource-item--megacredits">
          <div class="resource-item-stock">
            <span class="resource-icon resource-icon--megacredits tooltip tooltip-bottom" :data-tooltip="$t('MegaCredits (M€)')"></span>
            <div class="resource-item-stock-count">{{ model.megacredits }}</div>
          </div>
          <div class="resource-item-prod">
            <span class="resource-item-prod-count tooltip tooltip-bottom" :data-tooltip="$t('M€ per VP')">{{ mcPerVPLabel }}</span>
          </div>
        </div>
        <div v-for="deck in decks" :key="deck.label" class="resource-item marsbot-deck">
          <div class="resource-item-stock">
            <span class="resource-icon tooltip tooltip-bottom" :data-tooltip="$t(deck.tooltip)"></span>
            <div class="resource-item-stock-count">{{ deck.size }}</div>
          </div>
          <div class="resource-item-prod">
            <span class="resource-item-prod-count" v-i18n>{{ deck.label }}</span>
          </div>
        </div>
      </div>
    </div>
    <div class="player-tags">
      <div class="player-tags-main">
        <div class="tag-display">
          <div class="tag-count tag-vp tag-size-big tag-type-main tooltip tooltip-bottom" :data-tooltip="$t('vp')"></div>
          <span class="tag-count-display">{{ model.vpBreakdown.total }}</span>
        </div>
        <div class="tag-display">
          <div class="tag-count tag-tr tag-size-big tag-type-main tooltip tooltip-bottom" :data-tooltip="$t('tr')"></div>
          <span class="tag-count-display">{{ model.vpBreakdown.terraformRating }}</span>
        </div>
      </div>
      <div class="player-tags-secondary">
        <div v-for="(track, index) in model.tracks" :key="index" class="tag-display marsbot-track-box tooltip tooltip-bottom" :data-tooltip="trackTooltip(track)">
          <div class="marsbot-track-box-tags">
            <div v-for="tag in track.tags" :key="tag" class="tag-count tag-size-big tag-type-secondary" :class="'tag-' + tag"></div>
          </div>
          <span class="tag-count-display">{{ track.position }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {MarsBotModel, MarsBotTrackModel} from '@/common/models/MarsBotModel';
import {playerColorClass} from '@/common/utils/utils';

export default defineComponent({
  name: 'MarsBotRow',
  props: {
    model: {
      type: Object as () => MarsBotModel,
      required: true,
    },
  },
  computed: {
    colorClass(): string {
      return playerColorClass(this.model.color, 'bg_transparent');
    },
    mcPerVPLabel(): string {
      return this.model.mcPerVP ? `${this.model.mcPerVP}/VP` : '';
    },
    decks(): Array<{label: string, tooltip: string, size: number}> {
      return [
        {label: 'Action', tooltip: 'Action Deck', size: this.model.actionDeckSize},
        {label: 'Bonus', tooltip: 'Bonus Deck', size: this.model.bonusDeckSize},
      ];
    },
  },
  methods: {
    trackTooltip(track: MarsBotTrackModel): string {
      return [...track.tags, ...track.productions].map((name) => this.$t(name)).join(', ');
    },
  },
});
</script>
