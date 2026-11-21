<!-- MarsBot's tracks, shown under its row in the player overview. -->
<template>
  <div class="marsbot-panel">
    <h2 class="marsbot-title" v-i18n>MarsBot tracks</h2>
    <div v-if="model.instantWin" class="marsbot-instant-win"><span v-i18n>MarsBot wins!</span> (<span v-i18n>Generation limit reached</span>)</div>
    <div v-if="model.corpDescription" class="marsbot-corp-desc" v-i18n>{{ model.corpDescription }}</div>
    <div class="marsbot-vp-sources">
      <span v-for="source in vpSources" :key="source.label" class="marsbot-vp-source"><span v-i18n>{{ source.label }}</span> <b>{{ source.vp }}</b></span>
    </div>
    <div class="marsbot-tracks">
      <div v-for="(track, trackIndex) in model.tracks" :key="trackIndex" class="marsbot-track">
        <div class="marsbot-track-label">
          <div v-for="tag in track.tags" :key="tag" class="marsbot-tag tooltip tooltip-bottom" :class="'tag-' + tag" :data-tooltip="$t(tag)"></div>
          <div v-for="production in track.productions" :key="production" class="marsbot-prod tooltip tooltip-bottom" :class="'marsbot-prod--' + production" :data-tooltip="$t(production)"></div>
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
            <template v-for="icon in actionIcon(track, i)" :key="icon.kind">
              <span class="marsbot-action-icon" :class="'marsbot-action-icon--' + icon.kind">{{ icon.text }}</span>
              <span v-if="icon.count" class="marsbot-action-count">{{ icon.count }}</span>
            </template>
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
        >{{ colony }}: <b>{{ amount }}</b></span>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {TrackAction} from '@/common/automa/AutomaTypes';
import {MarsBotModel, MarsBotTrackModel, MarsBotVPModel} from '@/common/models/MarsBotModel';

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
  'colony': 'Place colony',
  'tr1': 'Raise TR +1', 'tr2': 'Raise TR +2', 'tr3': 'Raise TR +3', 'tr4': 'Raise TR +4',
  'tr5': 'Raise TR +5', 'tr6': 'Raise TR +6', 'tr7': 'Raise TR +7', 'tr8': 'Raise TR +8',
};

/** Actions drawn with their one-step icon and a "2". */
const TWO_STEP_ACTIONS: ReadonlyArray<TrackAction> = ['temperature2', 'venus2', 'floater2'];

/** Text shown in place of an icon, by icon kind. */
const ACTION_TEXT: Readonly<Record<string, string>> = {
  'milestone': 'M',
  'award': 'A',
  'advance': '»',
};

/** A field of `MarsBotVPModel` that holds a number of VP. */
type VPKey = {[K in keyof MarsBotVPModel]: MarsBotVPModel[K] extends number ? K : never}[keyof MarsBotVPModel];

/** An action square's icon. */
type ActionIcon = {kind: string, text: string, count: string};

const VP_SOURCES: ReadonlyArray<[VPKey, string]> = [
  ['terraformRating', 'TR'],
  ['milestones', 'Milestones'],
  ['awards', 'Awards'],
  ['greenery', 'Greenery'],
  ['cityAdjacentGreenery', 'Cities'],
  ['neuralInstance', 'NI'],
  ['mcToVP', 'MC to VP'],
  ['cardVP', 'Cards'],
  ['vermin', 'Vermin'],
  ['leftoverResourcesVP', 'Leftover resources'],
  ['turmoilVP', 'Turmoil'],
  ['corpVP', 'Corporation'],
];

export default defineComponent({
  name: 'MarsBotPanel',
  props: {
    model: {
      type: Object as () => MarsBotModel,
      required: true,
    },
  },
  computed: {
    vpSources(): Array<{label: string, vp: number}> {
      const breakdown = this.model.vpBreakdown;
      return VP_SOURCES
        .map(([key, label]) => ({label, vp: breakdown[key]}))
        .filter((source) => source.vp);
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
    trackLength(track: MarsBotTrackModel): number {
      return track.layout ? track.layout.length - 1 : 18;
    },
    getAction(track: MarsBotTrackModel, position: number): TrackAction | undefined {
      if (!track.layout) {
        return undefined;
      }
      // JSON sends the empty squares as null.
      return track.layout[position] ?? undefined;
    },
    /*
     * Lists the icon of the action at `position`: one icon, or none on a square without an action.
     *
     * A list so the template can bind it with v-for instead of calling getAction again.
     */
    actionIcon(track: MarsBotTrackModel, position: number): Array<ActionIcon> {
      const action = this.getAction(track, position);
      if (action === undefined) {
        return [];
      }
      const kind = this.actionKind(action);
      return [{kind, text: ACTION_TEXT[kind] ?? '', count: this.actionCount(action)}];
    },
    /*
     * Names the CSS modifier that picks the action's icon.
     *
     * 'tr' for TR steps, 'tag-<tag>' for track advances, and 'advance' for an advance of a track MarsBot does not have.
     */
    actionKind(action: TrackAction): string {
      if (action.startsWith('tag_')) {
        const target = action.slice(4);
        const index = Number(target);
        const tag = Number.isInteger(index) ? this.model.tracks[index]?.tags[0] : target;
        return tag === undefined ? 'advance' : 'tag-' + tag;
      }
      if (/^tr\d$/.test(action)) {
        return 'tr';
      }
      if (TWO_STEP_ACTIONS.includes(action)) {
        return action.slice(0, -1);
      }
      return action;
    },
    /* Numbers the corner of the action's square: its TR steps, 2 for a two-step action, or nothing. */
    actionCount(action: TrackAction): string {
      if (/^tr\d$/.test(action)) {
        return action.slice(2);
      }
      if (TWO_STEP_ACTIONS.includes(action)) {
        return '2';
      }
      return '';
    },
    getActionTooltip(track: MarsBotTrackModel, position: number): string {
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
