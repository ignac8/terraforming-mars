<template>
  <div class="marsbot-panel">
    <h2 class="marsbot-title">MarsBot <span class="marsbot-difficulty">({{ model.difficulty }})</span></h2>
    <div v-if="model.corpName" class="marsbot-corp">
      <span v-i18n>Corp</span>: <b>{{ model.corpName }}</b>
      <div v-if="model.corpDescription" class="marsbot-corp-desc" v-i18n>{{ model.corpDescription }}</div>
    </div>
    <div v-if="model.instantWin" class="marsbot-instant-win"><span v-i18n>MarsBot wins!</span> (<span v-i18n>Generation limit reached</span>)</div>
    <div class="marsbot-stats">
      <span class="marsbot-stat" v-if="model.vpBreakdown"><span v-i18n>VP</span>: <b>{{ model.vpBreakdown.total }}</b></span>
      <span class="marsbot-stat"><span v-i18n>TR</span>: <b>{{ model.vpBreakdown?.terraformRating }}</b></span>
      <span class="marsbot-stat" v-if="model.vpBreakdown?.milestones"><span v-i18n>Milestones</span>: <b>{{ model.vpBreakdown.milestones }}</b></span>
      <span class="marsbot-stat" v-if="model.vpBreakdown?.awards"><span v-i18n>Awards</span>: <b>{{ model.vpBreakdown.awards }}</b></span>
      <span class="marsbot-stat" v-if="model.vpBreakdown?.greenery"><span v-i18n>Greenery</span>: <b>{{ model.vpBreakdown.greenery }}</b></span>
      <span class="marsbot-stat" v-if="model.vpBreakdown?.cityAdjacentGreenery"><span v-i18n>Cities</span>: <b>{{ model.vpBreakdown.cityAdjacentGreenery }}</b></span>
      <span class="marsbot-stat" v-if="model.vpBreakdown?.neuralInstance"><span v-i18n>NI</span>: <b>{{ model.vpBreakdown.neuralInstance }}</b></span>
      <span class="marsbot-stat" v-if="model.vpBreakdown?.mcToVP"><span v-i18n>MC to VP</span>: <b>{{ model.vpBreakdown.mcToVP }}</b></span>
      <span class="marsbot-stat" v-if="model.vpBreakdown?.cardVP"><span v-i18n>Cards</span>: <b>{{ model.vpBreakdown.cardVP }}</b></span>
      <span class="marsbot-stat" v-if="model.vpBreakdown?.vermin"><span v-i18n>Vermin</span>: <b>{{ model.vpBreakdown.vermin }}</b></span>
      <span class="marsbot-stat" v-if="model.vpBreakdown?.turmoilVP"><span v-i18n>Turmoil</span>: <b>{{ model.vpBreakdown.turmoilVP }}</b></span>
      <span class="marsbot-stat"><span v-i18n>MC</span>: <b>{{ model.mcSupply }}</b></span>
      <span class="marsbot-stat" v-if="model.mcPerVP"><span v-i18n>MC/VP</span>: <b>{{ model.mcPerVP }}</b></span>
      <span class="marsbot-stat"><span v-i18n>Action Deck</span>: <b>{{ model.actionDeckSize }}</b></span>
      <span class="marsbot-stat"><span v-i18n>Bonus Deck</span>: <b>{{ model.bonusDeckSize }}</b></span>
    </div>
    <div class="marsbot-tracks">
      <div v-for="(track, trackIndex) in model.tracks" :key="trackIndex" class="marsbot-track">
        <div class="marsbot-track-label">
          <span class="marsbot-track-num">{{ [...track.tags, ...track.productions].join(', ') }}</span>
        </div>
        <span class="marsbot-track-pos">{{ track.position }}</span>
        <div class="marsbot-track-squares">
          <div
            v-for="i in trackLength(track)"
            :key="i"
            class="marsbot-square"
            :class="{
              filled: i <= track.position,
              'cube-white': hasCube(trackIndex, i, 'white'),
              'cube-black': hasCube(trackIndex, i, 'black'),
              'cube-credit': hasCube(trackIndex, i, 'credit'),
              'has-action': getAction(track, i) !== undefined,
            }"
            :title="getActionTooltip(track, i)"
          >
            <span v-if="getAction(track, i)" class="marsbot-action-icon">{{ getActionIcon(track, i) }}</span>
          </div>
        </div>
      </div>
    </div>
    <div v-if="model.shippingBoard" class="marsbot-shipping-board">
      <div class="marsbot-shipping-board-title" v-i18n>Shipping Board</div>
      <div class="marsbot-shipping-areas">
        <span
          v-for="(amount, colony) in model.shippingBoard"
          :key="colony"
          class="marsbot-shipping-area"
        >{{ colony }}: {{ amount }}</span>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {TrackAction} from '@/common/automa/AutomaTypes';
import {MarsBotModel} from '@/common/models/MarsBotModel';

const ACTION_ICONS: Partial<Record<TrackAction, string>> = {
  'greenery': 'G',
  'ocean': 'O',
  'city': 'C',
  'temperature': 'T',
  'temperature2': 'T2',
  'milestone': 'M',
  'award': 'A',
  'advance': '+',
  'venus': 'V',
  'venus2': 'V2',
  'floater': 'F',
  'floater2': 'F2',
  'tr1': '1', 'tr2': '2', 'tr3': '3', 'tr4': '4',
  'tr5': '5', 'tr6': '6', 'tr7': '7', 'tr8': '8',
};

const ACTION_LABELS: Partial<Record<TrackAction, string>> = {
  'greenery': 'Place greenery',
  'ocean': 'Place ocean',
  'city': 'Place city',
  'temperature': 'Raise temperature',
  'temperature2': 'Raise temperature 2 steps',
  'milestone': 'Claim milestone',
  'award': 'Fund award',
  'advance': 'Advance 1 more',
  'venus': 'Raise Venus',
  'venus2': 'Raise Venus 2 steps',
  'floater': 'Gain 1 floater',
  'floater2': 'Gain 2 floaters',
  'tr1': 'Raise TR +1', 'tr2': 'Raise TR +2', 'tr3': 'Raise TR +3', 'tr4': 'Raise TR +4',
  'tr5': 'Raise TR +5', 'tr6': 'Raise TR +6', 'tr7': 'Raise TR +7', 'tr8': 'Raise TR +8',
};

export default defineComponent({
  name: 'MarsBotPanel',
  props: {
    model: {
      type: Object as () => MarsBotModel,
      required: true,
    },
  },
  methods: {
    hasCube(trackIndex: number, position: number, cubeType: string): boolean {
      if (!this.model.trackCubes) {
        return false;
      }
      return this.model.trackCubes.some(
        (c: {trackIndex: number, position: number, cubeType: string}) =>
          c.trackIndex === trackIndex && c.position === position && c.cubeType === cubeType,
      );
    },
    trackLength(track: {layout?: ReadonlyArray<TrackAction | undefined>}): number {
      return track.layout ? track.layout.length - 1 : 18;
    },
    getAction(track: {layout?: ReadonlyArray<TrackAction | undefined>}, position: number): TrackAction | undefined {
      if (!track.layout) {
        return undefined;
      }
      return track.layout[position];
    },
    getActionIcon(track: {layout?: ReadonlyArray<TrackAction | undefined>}, position: number): string {
      const action = this.getAction(track, position);
      if (!action) {
        return '';
      }
      if (action.startsWith('tag_')) {
        const tag = action.slice(4);
        return '+' + tag.charAt(0).toUpperCase();
      }
      return ACTION_ICONS[action] ?? '?';
    },
    getActionTooltip(track: {layout?: ReadonlyArray<TrackAction | undefined>}, position: number): string {
      const action = this.getAction(track, position);
      if (!action) {
        return this.$t('Position') + ' ' + position;
      }
      if (action.startsWith('tag_')) {
        return this.$t('Advance track') + ' ' + action.slice(4);
      }
      const label = ACTION_LABELS[action];
      return label ? this.$t(label) : action;
    },
  },
});
</script>

