<template>
  <div v-if="cards.length > 0" class="player_home_block nofloat judge-pending-choice">
    <h3 :class="headingClass" v-i18n>Pending choice</h3>
    <div class="judge-pending-choice-title">{{ $t(choice?.title ?? '') }}</div>
    <div class="judge-pending-choice-cards">
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
import {PendingChoiceModel} from '@/common/models/PendingChoiceModel';

// Read-only summary of a player's pending input: what they are deciding, and the cards they pick from that the
// viewer sees nowhere else, like a draft hand. The options themselves are the same for everyone, so they are left
// out, and with no such cards there is nothing to show. It renders nothing interactive: the choice is never made here.
export default defineComponent({
  name: 'JudgePendingChoice',
  components: {Card},
  props: {
    /** Undefined when the player is choosing nothing, and then nothing shows. */
    choice: {
      type: Object as () => PendingChoiceModel,
      default: undefined,
    },
    /** The cards the viewer already sees, in the player's sections or on the table. */
    shown: {
      type: Array as () => ReadonlyArray<CardName>,
      default: () => [],
    },
    headingClass: {
      type: String,
      default: 'judge-player-panel-section',
    },
  },
  computed: {
    cards(): ReadonlyArray<CardModel> {
      return this.choice === undefined ? [] : unseenPendingCards(this.choice.cards, this.shown);
    },
  },
});
</script>

<style scoped lang="less">
.judge-pending-choice-title {
  font-weight: bold;
}
</style>
