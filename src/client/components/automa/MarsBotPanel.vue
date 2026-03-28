<template>
  <div class="marsbot-panel">
    <h2 class="marsbot-title">MarsBot <span class="marsbot-difficulty">({{ model.difficulty }})</span></h2>
    <div v-if="model.corpName" class="marsbot-corp">
      Corp: <b>{{ model.corpName }}</b>
      <div v-if="model.corpDescription" class="marsbot-corp-desc">{{ model.corpDescription }}</div>
    </div>
    <div v-if="model.instantWin" class="marsbot-instant-win">MarsBot wins! (Generation limit reached)</div>
    <div class="marsbot-stats">
      <span class="marsbot-stat" v-if="model.vpBreakdown">VP: <b>{{ model.vpBreakdown.total }}</b></span>
      <span class="marsbot-stat">TR: <b>{{ model.vpBreakdown?.terraformRating }}</b></span>
      <span class="marsbot-stat" v-if="model.vpBreakdown?.milestones">Milestones: <b>{{ model.vpBreakdown.milestones }}</b></span>
      <span class="marsbot-stat" v-if="model.vpBreakdown?.awards">Awards: <b>{{ model.vpBreakdown.awards }}</b></span>
      <span class="marsbot-stat" v-if="model.vpBreakdown?.greenery">Greenery: <b>{{ model.vpBreakdown.greenery }}</b></span>
      <span class="marsbot-stat" v-if="model.vpBreakdown?.cityAdjacentGreenery">Cities: <b>{{ model.vpBreakdown.cityAdjacentGreenery }}</b></span>
      <span class="marsbot-stat" v-if="model.vpBreakdown?.neuralInstance">NI: <b>{{ model.vpBreakdown.neuralInstance }}</b></span>
      <span class="marsbot-stat" v-if="model.vpBreakdown?.mcToVP">MC to VP: <b>{{ model.vpBreakdown.mcToVP }}</b></span>
      <span class="marsbot-stat" v-if="model.vpBreakdown?.cardVP">Cards: <b>{{ model.vpBreakdown.cardVP }}</b></span>
      <span class="marsbot-stat">MC: <b>{{ model.mcSupply }}</b></span>
      <span class="marsbot-stat" v-if="model.mcPerVP">MC/VP: <b>{{ model.mcPerVP }}</b></span>
      <span class="marsbot-stat">Action Deck: <b>{{ model.actionDeckSize }}</b></span>
      <span class="marsbot-stat">Bonus Deck: <b>{{ model.bonusDeckSize }}</b></span>
    </div>
    <div class="marsbot-tracks">
      <div v-for="track in model.tracks" :key="track.num" class="marsbot-track">
        <div class="marsbot-track-label">
          <span class="marsbot-track-num">T{{ track.num }}</span>
          <span class="marsbot-track-tags">{{ track.tagNames.join(', ') }}</span>
        </div>
        <div class="marsbot-track-squares">
          <div
            v-for="i in track.maxPosition"
            :key="i"
            class="marsbot-square"
            :class="{
              filled: i <= track.position,
              'cube-white': hasCube(track.num, i, 'white'),
              'cube-black': hasCube(track.num, i, 'black'),
              'cube-credit': hasCube(track.num, i, 'credit'),
              'has-action': getAction(track, i) !== null,
            }"
            :title="getActionTooltip(track, i)"
          >
            <span v-if="getAction(track, i)" class="marsbot-action-icon">{{ getActionIcon(track, i) }}</span>
          </div>
        </div>
        <span class="marsbot-track-pos">{{ track.position }}</span>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {TrackAction} from '@/common/automa/AutomaTypes';

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
  'tr1': 'Raise TR +1', 'tr2': 'Raise TR +2', 'tr3': 'Raise TR +3', 'tr4': 'Raise TR +4',
  'tr5': 'Raise TR +5', 'tr6': 'Raise TR +6', 'tr7': 'Raise TR +7', 'tr8': 'Raise TR +8',
};

export default defineComponent({
  name: 'MarsBotPanel',
  props: {
    model: {
      type: Object,
      required: true,
    },
  },
  methods: {
    hasCube(trackNum: number, position: number, cubeType: string): boolean {
      if (!this.model.trackCubes) return false;
      return this.model.trackCubes.some(
        (c: {trackNum: number, position: number, cubeType: string}) =>
          c.trackNum === trackNum && c.position === position && c.cubeType === cubeType,
      );
    },
    getAction(track: {layout?: ReadonlyArray<TrackAction | null>}, position: number): TrackAction | null {
      if (!track.layout) return null;
      return track.layout[position] ?? null;
    },
    getActionIcon(track: {layout?: ReadonlyArray<TrackAction | null>}, position: number): string {
      const action = this.getAction(track, position);
      if (!action) return '';
      if (action.startsWith('tag_')) return 'T' + action.slice(4);
      return ACTION_ICONS[action] ?? '?';
    },
    getActionTooltip(track: {layout?: ReadonlyArray<TrackAction | null>}, position: number): string {
      const action = this.getAction(track, position);
      if (!action) return `Position ${position}`;
      if (action.startsWith('tag_')) return `Advance track ${action.slice(4)}`;
      return ACTION_LABELS[action] ?? action;
    },
  },
});
</script>

<style scoped>
.marsbot-panel {
  background: #1a1a2e;
  border: 2px solid #e94560;
  border-radius: 8px;
  padding: 12px;
  margin: 8px 0;
  color: #eee;
  display: inline-block;
}
.marsbot-title {
  margin: 0 0 8px 0;
  font-size: 20px;
  color: #e94560;
}
.marsbot-difficulty {
  font-size: 14px;
  color: #aaa;
  font-weight: normal;
}
.marsbot-stats {
  display: flex;
  gap: 16px;
  margin-bottom: 10px;
  font-size: 15px;
  flex-wrap: wrap;
}
.marsbot-stat b {
  color: #e94560;
}
.marsbot-tracks {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.marsbot-track {
  display: flex;
  align-items: center;
  gap: 6px;
}
.marsbot-track-label {
  width: 150px;
  min-width: 150px;
  display: flex;
  gap: 4px;
  align-items: center;
}
.marsbot-track-num {
  font-weight: bold;
  font-size: 15px;
  color: #e94560;
  min-width: 24px;
}
.marsbot-track-tags {
  font-size: 13px;
  color: #aaa;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.marsbot-track-squares {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}
.marsbot-square {
  width: 18px;
  height: 18px;
  border: 1px solid #444;
  border-radius: 2px;
  background: #0d0d1a;
  flex-shrink: 0;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}
.marsbot-square.filled {
  background: #e94560;
  border-color: #e94560;
}
.marsbot-square.has-action {
  border-color: #666;
}
.marsbot-action-icon {
  font-size: 10px;
  color: #888;
  line-height: 1;
  font-weight: bold;
}
.marsbot-square.filled .marsbot-action-icon {
  color: #fff;
}
.marsbot-track-pos {
  font-size: 13px;
  color: #aaa;
  min-width: 16px;
  text-align: right;
}
.marsbot-corp {
  font-size: 15px;
  margin-bottom: 6px;
  color: #ccc;
}
.marsbot-corp b {
  color: #ffd700;
}
.marsbot-instant-win {
  background: #e94560;
  color: #fff;
  font-weight: bold;
  font-size: 16px;
  text-align: center;
  padding: 6px;
  border-radius: 4px;
  margin-bottom: 8px;
}
.marsbot-corp-desc {
  font-size: 13px;
  color: #aaa;
  margin-top: 2px;
  font-style: italic;
}
.marsbot-square.cube-white {
  border-color: #fff;
  box-shadow: inset 0 0 0 2px #fff;
}
.marsbot-square.cube-black {
  border-color: #666;
  box-shadow: inset 0 0 0 2px #333;
}
.marsbot-square.cube-credit {
  border-color: #ffd700;
  box-shadow: inset 0 0 0 2px #ffd700;
}
.marsbot-square.filled.cube-white {
  background: #ff6b8a;
  border-color: #fff;
}
.marsbot-square.filled.cube-black {
  background: #c0392b;
  border-color: #666;
}
.marsbot-square.filled.cube-credit {
  background: #f39c12;
  border-color: #ffd700;
}
</style>
