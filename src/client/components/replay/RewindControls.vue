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
    <button v-if="!confirming" class="rewind-start" type="button" :disabled="disabled || blocked" @click="confirming = true" v-i18n>{{ mode === 'vote' ? 'Ask the others to rewind to before this move' : 'Rewind to before this move' }}</button>
    <div v-else class="rewind-confirm">
      <span class="rewind-confirm-text" v-i18n>{{ mode === 'vote' ? 'Every other player must agree. Any move ends the vote.' : 'Moves after this one will be undone.' }}</span>
      <button class="rewind-confirm-button" type="button" :disabled="disabled" @click="confirm" v-i18n>{{ mode === 'vote' ? 'Ask' : 'Rewind' }}</button>
      <button class="rewind-cancel" type="button" @click="confirming = false" v-i18n>Cancel</button>
    </div>
    <div v-if="blocked" class="rewind-blocked" v-i18n>You can ask again next generation.</div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {RewindCards} from '@/common/replay/ReplayModel';

// The choices for rewinding to the selected move. It only emits once the player has confirmed. In vote mode the
// player asks the others to rewind rather than rewinding, so it emits `request`.
export default defineComponent({
  name: 'RewindControls',
  props: {
    /** True while a rewind is under way. */
    disabled: {
      type: Boolean,
      required: true,
    },
    mode: {
      type: String as () => 'rewind' | 'vote',
      default: 'rewind',
    },
    /** The player may not ask for a rewind again yet. */
    blocked: {
      type: Boolean,
      default: false,
    },
  },
  emits: {
    rewind: (_cards: RewindCards) => true,
    request: (_cards: RewindCards) => true,
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
      if (this.mode === 'vote') {
        this.$emit('request', this.cards);
      } else {
        this.$emit('rewind', this.cards);
      }
    },
  },
});
</script>
