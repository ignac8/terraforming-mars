<template>
  <div class="marsbot-panel">
    <h2 class="marsbot-title">MarsBot <span class="marsbot-difficulty">({{ model.difficulty }})</span></h2>
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
            :class="{ filled: i <= track.position }"
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
</style>
