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
import {getCard} from '@/client/cards/ClientCardManifest';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {CardModel} from '@/common/models/CardModel';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';

/** Every card anywhere in the input, its options included, in order and each once. */
function collectCards(input: PlayerInputModel, into: Map<CardName, CardModel>): void {
  if ('cards' in input) {
    for (const card of input.cards) {
      if (!into.has(card.name)) {
        into.set(card.name, card);
      }
    }
  }
  if ('options' in input) {
    for (const option of input.options) {
      collectCards(option, into);
    }
  }
}

function isStandardProject(name: CardName): boolean {
  const type = getCard(name)?.type;
  return type === CardType.STANDARD_PROJECT || type === CardType.STANDARD_ACTION;
}

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
      const all = new Map<CardName, CardModel>();
      collectCards(this.input, all);
      return Array.from(all.values()).filter((card) => !this.shown.includes(card.name) && !isStandardProject(card.name));
    },
  },
});
</script>

<style scoped lang="less">
.judge-pending-choice-title {
  font-weight: bold;
}
</style>
