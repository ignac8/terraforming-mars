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
    <template v-if="clocks !== undefined">
      <div class="rewind-cards">
        <label class="rewind-cards-option">
          <input type="radio" name="rewind-clocks" value="back" v-model="clockChoice">
          <span v-i18n>Clocks go back</span>
        </label>
        <label class="rewind-cards-option">
          <input type="radio" name="rewind-clocks" value="keep" v-model="clockChoice">
          <span v-i18n>Time back for everyone but the player whose move is undone</span>
        </label>
      </div>
      <table class="rewind-clocks">
        <thead>
          <tr>
            <th></th>
            <th v-if="showNow" v-i18n>Now</th>
            <th v-i18n>At this move</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in clocks" :key="row.color" class="rewind-clock-row">
            <td><span class="rewind-clock-player" :class="'player_bg_color_' + row.color">{{ row.name }}</span></td>
            <td v-if="showNow">{{ row.now }}</td>
            <td>{{ row.then }}</td>
          </tr>
        </tbody>
      </table>
    </template>
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
import {RewindCards, RewindClockRow, RewindClocks} from '@/common/replay/ReplayModel';
import {RequestBlock} from '@/common/rewind/RewindVoteModel';

// The choices for rewinding to the selected move. It only emits once the player has confirmed. In vote mode the
// player asks the others to rewind rather than rewinding, so it emits `request`. With `clocks`, whoever rewinds may
// also choose whether the clocks go back; without them it asks to keep the clock of every player who answered the move that is undone.
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
    /** One row per player. Given only to a judge, who chooses what the clocks do. */
    clocks: {
      type: Array as () => Array<RewindClockRow>,
      default: undefined,
    },
    /** The move is one an earlier rewind undid, which only the judge rewinds to. */
    undone: {
      type: Boolean,
      default: false,
    },
  },
  emits: {
    rewind: (_cards: RewindCards, _clocks: RewindClocks) => true,
    request: (_cards: RewindCards) => true,
  },
  data() {
    return {
      cards: 'same' as RewindCards,
      clockChoice: 'back' as RewindClocks,
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
    showNow(): boolean {
      return this.clocks?.some((row) => row.now !== '') === true;
    },
  },
  methods: {
    confirm(): void {
      this.confirming = false;
      if (this.mode === 'vote') {
        this.$emit('request', this.cards);
      } else {
        this.$emit('rewind', this.cards, this.clocks === undefined ? 'keep' : this.clockChoice);
      }
    },
  },
});
</script>
