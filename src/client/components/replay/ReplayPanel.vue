<template>
  <div class="replay-panel" :class="{'replay-panel--collapsed': collapsed}">
    <div class="replay-header">
      <span class="replay-title" v-i18n>Replay</span>
      <span class="replay-position"><span v-i18n>Gen</span> {{ generation }} · <span v-i18n>move</span> {{ index + 1 }} / {{ moves.length }}</span>
      <button class="replay-collapse" type="button" @click="collapsed = !collapsed" v-i18n>{{ collapsed ? 'Show' : 'Hide' }}</button>
    </div>

    <div class="replay-controls">
      <button class="replay-start" type="button" :title="$t('Go to start')" :aria-label="$t('Go to start')" :disabled="index === 0" @click="select(0)">&#x23EE;</button>
      <button class="replay-back" type="button" :title="$t('Step back')" :aria-label="$t('Step back')" :disabled="index === 0" @click="select(index - 1)">&#x25C0;</button>
      <button class="replay-play" type="button" :title="playLabel" :aria-label="playLabel" @click="playing ? $emit('pause') : $emit('play')">{{ playing ? '\u23F8' : '\u25B6' }}</button>
      <button class="replay-forward" type="button" :title="$t('Step forward')" :aria-label="$t('Step forward')" :disabled="index >= last" @click="select(index + 1)">&#x25B6;&#x25B6;</button>
      <button class="replay-end" type="button" :title="$t('Go to end')" :aria-label="$t('Go to end')" :disabled="index >= last" @click="select(last)">&#x23ED;</button>
      <select class="replay-speed" :title="$t('Speed')" :aria-label="$t('Speed')" :value="speed" @change="onSpeed">
        <option v-for="option in speeds" :key="option" :value="option">{{ option }}&times;</option>
      </select>
    </div>

    <div class="replay-view-as">
      <span v-i18n>View as</span>
      <button class="replay-view-all" type="button" :class="{'replay-view-active': viewAs === 'all'}" @click="$emit('update:viewAs', 'all')" v-i18n>All hands</button>
      <button
        v-for="player in sortedPlayers"
        :key="player.color"
        type="button"
        class="replay-view-player"
        :class="['replay-view-' + player.color, 'player_bg_color_' + player.color, {'replay-view-active': viewAs === player.color}]"
        @click="$emit('update:viewAs', player.color)">{{ player.name }}</button>
    </div>

    <ul v-if="!collapsed" class="replay-moves" ref="moveList">
      <li
        v-for="(move, i) in moves"
        :key="move.saveId"
        class="replay-move"
        :class="{'replay-move-current': i === index}"
        @click="select(i)">
        <span class="replay-move-number">{{ i + 1 }}</span>
        <ul class="replay-move-messages">
          <LogMessageComponent v-for="(message, j) in move.messages" :key="j" :message="message" :viewModel="viewModel"/>
        </ul>
      </li>
    </ul>

    <!-- Rendered inside the panel, so that on a narrow screen it can sit just above it instead of under it. -->
    <slot name="error"></slot>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import LogMessageComponent from '@/client/components/logpanel/LogMessageComponent.vue';
import {PublicPlayerModel, ViewModel} from '@/common/models/PlayerModel';
import {PLAYER_COLORS} from '@/common/Color';
import {ReplayMove, ReplayViewAs} from '@/common/replay/ReplayModel';

const SPEEDS = [0.5, 1, 2, 4];

// A small panel floating over the replayed game: transport controls, the list of moves and who to view as.
// It owns nothing but whether the move list is collapsed; the screen decides what every control does.
export default defineComponent({
  name: 'ReplayPanel',
  components: {LogMessageComponent},
  props: {
    moves: {
      type: Array as () => Array<ReplayMove>,
      required: true,
    },
    index: {
      type: Number,
      required: true,
    },
    viewAs: {
      type: String as () => ReplayViewAs,
      required: true,
    },
    players: {
      type: Array as () => Array<PublicPlayerModel>,
      required: true,
    },
    /** The replayed model the log messages are written against, for player names and space names. */
    viewModel: {
      type: Object as () => ViewModel,
      required: true,
    },
    playing: {
      type: Boolean,
      required: true,
    },
    speed: {
      type: Number,
      required: true,
    },
  },
  emits: ['select', 'update:viewAs', 'play', 'pause', 'update:speed'],
  data() {
    return {collapsed: false};
  },
  computed: {
    last(): number {
      return this.moves.length - 1;
    },
    /** The generation the board shows, which differs from the save's at the end of a generation, where loading the save runs production. */
    generation(): number {
      return this.viewModel.game.generation;
    },
    /** Players come in generation order, which turns every generation. Buttons keep one place by color. */
    sortedPlayers(): Array<PublicPlayerModel> {
      const rank = (player: PublicPlayerModel) => {
        const index = PLAYER_COLORS.indexOf(player.color as typeof PLAYER_COLORS[number]);
        return index < 0 ? PLAYER_COLORS.length : index;
      };
      return [...this.players].sort((a, b) => rank(a) - rank(b));
    },
    speeds(): ReadonlyArray<number> {
      return SPEEDS;
    },
    playLabel(): string {
      return this.playing ? this.$t('Pause') : this.$t('Play replay');
    },
  },
  methods: {
    select(index: number): void {
      if (index < 0 || index > this.last || index === this.index) {
        return;
      }
      this.$emit('select', index);
    },
    onSpeed(event: Event): void {
      this.$emit('update:speed', Number((event.target as HTMLSelectElement).value));
    },
    scrollToCurrent(): void {
      const list = this.$refs.moveList as HTMLElement | undefined;
      const current = list?.querySelector<HTMLElement>('.replay-move-current');
      if (list === undefined || current === null || current === undefined) {
        return;
      }
      // Scroll only the list, never the page behind the panel.
      list.scrollTop = current.offsetTop - list.clientHeight / 2;
    },
  },
  watch: {
    index() {
      this.$nextTick(() => this.scrollToCurrent());
    },
    viewAs() {
      this.$nextTick(() => this.scrollToCurrent());
    },
    collapsed() {
      this.$nextTick(() => this.scrollToCurrent());
    },
  },
  mounted() {
    this.scrollToCurrent();
  },
});
</script>
