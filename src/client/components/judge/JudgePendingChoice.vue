<template>
  <div class="judge-pending-choice">
    <div class="judge-pending-choice-title">{{ $t(input.title) }}</div>
    <div v-if="cards.length > 0" class="judge-pending-choice-cards">
      <div v-for="card in cards" :key="card.name" class="cardbox">
        <Card :card="card" />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import Card from '@/client/components/card/Card.vue';
import {unseenPendingCards} from '@/client/utils/unseenPendingCards';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';

// Read-only summary of a player's pending input: what they are deciding, and the cards they pick from that the
// judge sees nowhere else, like a draft hand. The options themselves are the same for everyone, so they are left out.
// It renders nothing interactive, because a judge can see a choice but never make it.
export default defineComponent({
  name: 'JudgePendingChoice',
  components: {Card},
  props: {
    input: {
      type: Object as () => PlayerInputModel,
      required: true,
    },
    /** The cards the judge already sees, in the player's sections or on the table. */
    shown: {
      type: Array as () => ReadonlyArray<CardName>,
      default: () => [],
    },
  },
  computed: {
    cards(): ReadonlyArray<CardModel> {
      return unseenPendingCards(this.input, this.shown);
    },
  },
});
</script>

<style scoped lang="less">
.judge-pending-choice-title {
  font-weight: bold;
}
</style>
