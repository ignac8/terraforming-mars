<template>
  <div class="judge-pending-choice">
    <div class="judge-pending-choice-title">{{ $t(input.title) }}</div>
    <div v-if="cards.length > 0" class="judge-pending-choice-cards">
      <Card v-for="card in cards" :key="card.name" :card="card" />
    </div>
    <div v-if="options.length > 0" class="judge-pending-choice-options">
      <JudgePendingChoice v-for="(option, idx) in options" :key="idx" :input="option" />
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import Card from '@/client/components/card/Card.vue';
import {CardModel} from '@/common/models/CardModel';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';

// Read-only view of a player's pending input. It renders nothing interactive, because a judge
// can see a choice but never make it.
export default defineComponent({
  name: 'JudgePendingChoice',
  components: {Card},
  props: {
    input: {
      type: Object as () => PlayerInputModel,
      required: true,
    },
  },
  computed: {
    cards(): ReadonlyArray<CardModel> {
      return 'cards' in this.input ? this.input.cards : [];
    },
    options(): ReadonlyArray<PlayerInputModel> {
      return 'options' in this.input ? this.input.options : [];
    },
  },
});
</script>

<style scoped lang="less">
.judge-pending-choice-title {
  font-weight: bold;
}
.judge-pending-choice-options {
  margin-left: 16px;
}
</style>
