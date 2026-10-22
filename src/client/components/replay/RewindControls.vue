<template>
  <div class="rewind-controls">
    <div class="rewind-cards">
      <label class="rewind-cards-option">
        <input type="radio" name="rewind-cards" value="same" v-model="cards">
        <span v-i18n>Same cards</span>
      </label>
      <label class="rewind-cards-option">
        <input type="radio" name="rewind-cards" value="shuffle" v-model="cards">
        <span v-i18n>Shuffle hidden piles</span>
      </label>
    </div>
    <button v-if="!confirming" class="rewind-start" type="button" :disabled="disabled" @click="confirming = true" v-i18n>Rewind to before this move</button>
    <div v-else class="rewind-confirm">
      <span class="rewind-confirm-text" v-i18n>Moves after this one will be undone.</span>
      <button class="rewind-confirm-button" type="button" :disabled="disabled" @click="confirm" v-i18n>Rewind</button>
      <button class="rewind-cancel" type="button" @click="confirming = false" v-i18n>Cancel</button>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {RewindCards} from '@/common/replay/ReplayModel';

// The choices for rewinding to the selected move. It only emits once the player has confirmed.
export default defineComponent({
  name: 'RewindControls',
  props: {
    /** True while a rewind is under way. */
    disabled: {
      type: Boolean,
      required: true,
    },
  },
  emits: {
    rewind: (_cards: RewindCards) => true,
  },
  data() {
    return {
      cards: 'same' as RewindCards,
      confirming: false,
    };
  },
  methods: {
    confirm(): void {
      this.confirming = false;
      this.$emit('rewind', this.cards);
    },
  },
});
</script>
