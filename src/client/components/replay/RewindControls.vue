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
    <button v-if="!confirming" class="rewind-start" type="button" :disabled="disabled || blocked !== undefined" @click="confirming = true" v-i18n>{{ mode === 'vote' ? 'Ask the others to rewind to before this move' : 'Rewind to before this move' }}</button>
    <div v-else class="rewind-confirm">
      <span class="rewind-confirm-text" v-i18n>{{ mode === 'vote' ? 'Every other player must agree. Any move ends the vote.' : 'Moves after this one will be undone.' }}</span>
      <span v-if="undone" class="rewind-confirm-text rewind-confirm-undone" v-i18n>This brings back moves that an earlier rewind undid, and undoes the moves played since.</span>
      <button class="rewind-confirm-button" type="button" :disabled="disabled" @click="confirm" v-i18n>{{ mode === 'vote' ? 'Ask' : 'Rewind' }}</button>
      <button class="rewind-cancel" type="button" @click="confirming = false" v-i18n>Cancel</button>
    </div>
    <div v-if="blocked !== undefined" class="rewind-blocked" v-i18n>{{ blockedText }}</div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {RewindCards} from '@/common/replay/ReplayModel';
import {RequestBlock} from '@/common/rewind/RewindVoteModel';

// The choices for rewinding to the selected move. It only emits once the player has confirmed. In vote mode the
// player asks the others to rewind rather than rewinding, so it emits `request`. A rewind keeps the clock of every player
// who answered the move that is undone.
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
    /** Why the player may not ask for a rewind right now. */
    blocked: {
      type: String as () => RequestBlock,
      default: undefined,
    },
    /** The move is one an earlier rewind undid, which only the solo player rewinds to. */
    undone: {
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
  computed: {
    blockedText(): string {
      switch (this.blocked) {
      case 'frozen':
        return 'The game is frozen, so no rewind can be asked for or answered.';
      case 'vote-open':
        return 'A rewind vote is already open.';
      default:
        return 'You can ask again next generation.';
      }
    },
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
