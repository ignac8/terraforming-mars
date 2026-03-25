<template>
  <div class="marsbot-panel">
    <h2 class="marsbot-title">MarsBot <span class="marsbot-difficulty">({{ model.difficulty }})</span></h2>
    <div v-if="model.corpName" class="marsbot-corp">Corp: <b>{{ model.corpName }}</b></div>
    <div class="marsbot-stats">
      <span class="marsbot-stat">MC: <b>{{ model.mcSupply }}</b></span>
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
            }"
          ></div>
        </div>
        <span class="marsbot-track-pos">{{ track.position }}</span>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';

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
  font-size: 16px;
  color: #e94560;
}
.marsbot-difficulty {
  font-size: 12px;
  color: #aaa;
  font-weight: normal;
}
.marsbot-stats {
  display: flex;
  gap: 16px;
  margin-bottom: 10px;
  font-size: 13px;
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
  width: 130px;
  min-width: 130px;
  display: flex;
  gap: 4px;
  align-items: center;
}
.marsbot-track-num {
  font-weight: bold;
  font-size: 13px;
  color: #e94560;
  min-width: 24px;
}
.marsbot-track-tags {
  font-size: 11px;
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
  width: 14px;
  height: 14px;
  border: 1px solid #444;
  border-radius: 2px;
  background: #0d0d1a;
  flex-shrink: 0;
}
.marsbot-square.filled {
  background: #e94560;
  border-color: #e94560;
}
.marsbot-track-pos {
  font-size: 11px;
  color: #aaa;
  min-width: 16px;
  text-align: right;
}
.marsbot-corp {
  font-size: 13px;
  margin-bottom: 6px;
  color: #ccc;
}
.marsbot-corp b {
  color: #ffd700;
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
