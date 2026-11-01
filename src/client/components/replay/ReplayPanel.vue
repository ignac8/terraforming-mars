<template>
  <div class="replay-panel" :class="{'replay-panel--collapsed': collapsed}">
    <div class="replay-header">
      <span class="replay-title" v-i18n>{{ live ? 'History' : 'Replay' }}</span>
      <span class="replay-position">
        <span v-i18n>Gen</span> {{ generation }} ·
        <template v-if="index === undefined"><span v-i18n>live</span></template>
        <template v-else><span v-i18n>move</span> {{ index + 1 }} / {{ moves.length }}</template>
      </span>
      <label v-if="canShowUndone" class="replay-show-undone">
        <input type="checkbox" :checked="showUndone" @change="onShowUndone">
        <span v-i18n>Show undone moves</span>
      </label>
      <label v-if="index !== undefined" class="replay-show-log">
        <input type="checkbox" :checked="showLog" @change="onShowLog">
        <span v-i18n>Log</span>
      </label>
      <button v-if="frozen !== undefined" class="replay-freeze" type="button" :disabled="rewinding" @click="$emit('freeze')" v-i18n>{{ frozen ? 'Unfreeze' : 'Freeze' }}</button>
      <button class="replay-collapse" type="button" @click="toggle" v-i18n>{{ collapsed ? 'Show' : 'Hide' }}</button>
    </div>

    <div v-if="live && index !== undefined" class="replay-live-row">
      <button class="replay-back-to-live" type="button" @click="$emit('back')" v-i18n>Back to live game</button>
    </div>

    <div v-if="!(live && collapsed)" class="replay-controls">
      <button class="replay-start replay-icon" type="button" :title="$t('Go to start')" :aria-label="$t('Go to start')" :disabled="atStart" @click="jump('start')">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 5h2v14H3zM13 6v12L6 12zM21 6v12l-7-6z" /></svg>
      </button>
      <button class="replay-back replay-icon" type="button" :title="$t('Step back')" :aria-label="$t('Step back')" :disabled="atStart" @click="stepBack">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 5h2v14H5zM19 6v12l-10-6z" /></svg>
      </button>
      <button v-if="!live" class="replay-play" type="button" :title="playLabel" :aria-label="playLabel" @click="togglePlay">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path v-if="playing" d="M6 5h4v14H6zM14 5h4v14h-4z" />
          <path v-else d="M8 5v14l11-7z" />
        </svg>
        <span class="replay-play-label" v-i18n>{{ playing ? 'Pause' : 'Play replay' }}</span>
      </button>
      <button class="replay-forward replay-icon" type="button" :title="$t('Step forward')" :aria-label="$t('Step forward')" :disabled="atEnd" @click="stepForward">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 6v12l10-6zM17 5h2v14h-2z" /></svg>
      </button>
      <button class="replay-end replay-icon" type="button" :title="$t('Go to end')" :aria-label="$t('Go to end')" :disabled="atEnd" @click="jump('end')">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 6v12l7-6zM11 6v12l7-6zM19 5h2v14h-2z" /></svg>
      </button>
    </div>

    <!-- Jumping to either end can show how the game goes, so it asks first. -->
    <div v-if="confirming !== undefined" class="replay-confirm">
      <span class="replay-confirm-text" v-i18n>{{ confirming === 'end' ? 'Jump to the end? This shows how the game ends.' : 'Jump to the start?' }}</span>
      <button class="replay-confirm-yes" type="button" @click="confirmJump" v-i18n>Yes</button>
      <button class="replay-confirm-cancel" type="button" @click="confirming = undefined" v-i18n>Cancel</button>
    </div>

    <div v-if="!live" class="replay-autoplay">
      <select class="replay-speed" :title="$t('Speed')" :aria-label="$t('Speed')" :value="speed" @change="onSpeed">
        <option v-for="option in speeds" :key="option" :value="option">{{ option }}&times;</option>
      </select>
      <span class="replay-pace" role="group" :aria-label="$t('Autoplay timing')">
        <button class="replay-pace-fixed" type="button" :class="{'replay-pace-active': !realTime}" :aria-pressed="!realTime" :title="$t('Every move waits the same time')" @click="$emit('update:realTime', false)" v-i18n>Fixed</button>
        <button class="replay-pace-real" type="button" :class="{'replay-pace-active': realTime}" :aria-pressed="realTime" :title="$t('Every move waits as long as the player took')" @click="$emit('update:realTime', true)" v-i18n>Real time</button>
      </span>
    </div>

    <div v-if="(!live || viewAsInLive) && !ownViewOnly" class="replay-view-as">
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
        :class="{'replay-move-current': i === index, 'replay-move-undone': move.undone}"
        @click="select(i)">
        <span class="replay-move-number">{{ i + 1 }}</span>
        <span v-if="move.undone" class="replay-undone-badge" v-i18n>undone</span>
        <ul class="replay-move-messages">
          <LogMessageComponent v-for="(message, j) in move.messages" :key="j" :message="message" :viewModel="viewModel" />
          <li v-if="move.silent" class="replay-move-silent">
            <span v-for="color in move.movers ?? []" :key="color" :class="['replay-move-mover', 'player_bg_color_' + color]"></span>
            <span v-i18n>Draft pick</span>
          </li>
          <li v-for="(pick, k) in shownPicks(move)" :key="'pick' + k" class="replay-move-pick">
            <span :class="['replay-move-mover', 'player_bg_color_' + pick.color]"></span>
            <span><span v-i18n>{{ pickLabel(move, pick) }}</span>: {{ cardNames(pick) }}</span>
          </li>
        </ul>
      </li>
      <li v-if="moves.length === 0" class="replay-moves-empty" v-i18n>{{ loading ? 'Loading replay...' : 'No moves yet' }}</li>
    </ul>

    <!-- The key forgets a half-made choice when another move is picked. -->
    <RewindControls
      v-if="(canRewind || votesOnSelected) && index !== undefined && (!selectedUndone || rewindsUndone) && !(live && collapsed)"
      :key="index"
      :mode="canRewind ? 'rewind' : 'vote'"
      :disabled="rewinding"
      :blocked="requestBlock"
      :clocks="clocks"
      :undone="selectedUndone"
      @rewind="(cards, rewindClocks) => $emit('rewind', cards, rewindClocks)"
      @request="(cards) => $emit('request', cards)" />

    <!-- Errors, rendered inside the panel: a refused rewind under the rewind controls, and others in a box
         that on a narrow screen sits just above the panel instead of under it. -->
    <slot name="error"></slot>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import LogMessageComponent from '@/client/components/logpanel/LogMessageComponent.vue';
import RewindControls from '@/client/components/replay/RewindControls.vue';
import {PublicPlayerModel, ViewModel} from '@/common/models/PlayerModel';
import {Color, PLAYER_COLORS} from '@/common/Color';
import {ReplayMove, ReplayPick, ReplayViewAs, RewindCards, RewindClockRow, RewindClocks} from '@/common/replay/ReplayModel';
import {RequestBlock} from '@/common/rewind/RewindVoteModel';

const SPEEDS = [0.1, 0.25, 0.5, 1, 2, 4];

/** Keys typed into a field are the field's. */
function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement &&
    (target.isContentEditable || target.closest('input, select, textarea, [contenteditable]:not([contenteditable="false"])') !== null);
}

// A small panel floating over the replayed game: transport controls, the list of moves and who to view as.
// On the live game page it previews past moves instead: no autoplay, no choice of view (except for the judge), and it starts
// collapsed. It owns nothing but whether the move list is collapsed; the screen decides what every control does.
export default defineComponent({
  name: 'ReplayPanel',
  components: {LogMessageComponent, RewindControls},
  props: {
    moves: {
      type: Array as () => Array<ReplayMove>,
      required: true,
    },
    /** The selected move. Only the live game page has none, and then the live game shows. */
    index: {
      type: Number,
      default: undefined,
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
    /** True on the live game page. */
    live: {
      type: Boolean,
      default: false,
    },
    /** Whether the selected move can be rewound to. */
    canRewind: {
      type: Boolean,
      default: false,
    },
    /** Whether the viewer can ask for a rewind by vote, which they may do only about their own moves. */
    canVoteRewind: {
      type: Boolean,
      default: false,
    },
    /** The colour of the viewer, who is a player, to tell their own moves. */
    viewerColor: {
      type: String as () => Color,
      default: undefined,
    },
    /** The viewer may only see their own view, which the page already shows, so there is nothing to pick. */
    ownViewOnly: {
      type: Boolean,
      default: false,
    },
    /** Why the player may not ask for a rewind right now. */
    requestBlock: {
      type: String as () => RequestBlock,
      default: undefined,
    },
    /** True until the moves have been read, so an empty list is not yet known to be empty. */
    loading: {
      type: Boolean,
      default: true,
    },
    /** True while a rewind is under way. */
    rewinding: {
      type: Boolean,
      default: false,
    },
    /** Whether the game is frozen, for the judge, who gets a button for it. Undefined for everyone else. */
    frozen: {
      type: Boolean,
      default: undefined,
    },
    /** The choice of view stays on the live game page, where the judge picks a move to see all hands at. */
    viewAsInLive: {
      type: Boolean,
      default: false,
    },
    /** What each clock reads, for the rewind controls of the judge. */
    clocks: {
      type: Array as () => Array<RewindClockRow>,
      default: undefined,
    },
    /** The judge gets a switch for the moves that rewinds undid. */
    canShowUndone: {
      type: Boolean,
      default: false,
    },
    /** The list shows the moves that rewinds undid. */
    showUndone: {
      type: Boolean,
      default: false,
    },
    /** Autoplay waits as long as the players took, instead of the same time for every move. */
    realTime: {
      type: Boolean,
      default: false,
    },
    /** The page shows the log up to the selected move. */
    showLog: {
      type: Boolean,
      default: false,
    },
  },
  emits: {
    'select': (_index: number) => true,
    'update:viewAs': (_viewAs: ReplayViewAs) => true,
    'play': () => true,
    'pause': () => true,
    'update:speed': (_speed: number) => true,
    'update:collapsed': (_collapsed: boolean) => true,
    'back': () => true,
    'rewind': (_cards: RewindCards, _clocks: RewindClocks) => true,
    'request': (_cards: RewindCards) => true,
    'freeze': () => true,
    'update:showUndone': (_showUndone: boolean) => true,
    'update:realTime': (_realTime: boolean) => true,
    'update:showLog': (_showLog: boolean) => true,
  },
  data() {
    return {
      collapsed: this.live,
      /** The end the player asked to jump to, who has yet to say they want to see where it leads. */
      confirming: undefined as 'start' | 'end' | undefined,
      /** The space bar went down on a key press that was handled, so its release must not press a focused button too. */
      spaceHandled: false,
    };
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
    /** The selected move is one that a rewind undid. */
    selectedUndone(): boolean {
      return this.index !== undefined && this.moves[this.index]?.undone === true;
    },
    /** The viewer can ask for a rewind to the selected move: they are among those who made it. */
    votesOnSelected(): boolean {
      const movers = this.index === undefined ? undefined : this.moves[this.index]?.movers;
      return this.canVoteRewind && this.viewerColor !== undefined && movers?.includes(this.viewerColor) === true;
    },
    /** Only the judge and the solo player, who may see the undone moves, may rewind to one. Nobody may vote for one. */
    rewindsUndone(): boolean {
      return this.canShowUndone && this.canRewind;
    },
    speeds(): ReadonlyArray<number> {
      return SPEEDS;
    },
    atStart(): boolean {
      return this.index === 0 || this.moves.length === 0;
    },
    /** The live game counts as the end of the list. */
    atEnd(): boolean {
      return this.index === undefined || this.index >= this.last;
    },
    playLabel(): string {
      return this.playing ? this.$t('Pause') : this.$t('Play replay');
    },
  },
  methods: {
    toggle(): void {
      this.collapsed = !this.collapsed;
      this.$emit('update:collapsed', this.collapsed);
    },
    stepBack(): void {
      this.select(this.index === undefined ? this.last : this.index - 1);
    },
    stepForward(): void {
      if (this.index !== undefined) {
        this.select(this.index + 1);
      }
    },
    select(index: number): void {
      if (index < 0 || index > this.last || index === this.index) {
        return;
      }
      this.$emit('select', index);
    },
    /** A replay asks before it jumps to an end, because either shows how the game goes. The live page has nothing to spoil. */
    jump(to: 'start' | 'end'): void {
      if (this.live) {
        this.select(to === 'start' ? 0 : this.last);
      } else {
        this.confirming = to;
      }
    },
    confirmJump(): void {
      const to = this.confirming;
      this.confirming = undefined;
      this.select(to === 'start' ? 0 : this.last);
    },
    /** An answer that chose no cards, such as buying none in research, has nothing to list. */
    shownPicks(move: ReplayMove): Array<ReplayPick> {
      return (move.picks ?? []).filter((pick) => pick.cards.length > 0);
    },
    pickLabel(move: ReplayMove, pick: ReplayPick): string {
      if (pick.auto) {
        return 'last card passed';
      }
      return move.silent ? 'drafted' : 'kept';
    },
    cardNames(pick: ReplayPick): string {
      return pick.cards.map((name) => this.$t(name.split(':')[0])).join(', ');
    },
    togglePlay(): void {
      if (this.playing) {
        this.$emit('pause');
      } else {
        this.$emit('play');
      }
    },
    onShowLog(event: Event): void {
      this.$emit('update:showLog', (event.target as HTMLInputElement).checked);
    },
    /** Arrow keys step through the moves and the space bar plays and pauses, as long as the player is not typing. */
    onKeydown(event: KeyboardEvent): void {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || isTyping(event.target)) {
        return;
      }
      if (event.key === 'ArrowLeft') {
        this.stepBack();
      } else if (event.key === 'ArrowRight') {
        this.stepForward();
      } else if (event.key === ' ') {
        if (!event.repeat) {
          this.togglePlay();
        }
        this.spaceHandled = true;
      } else {
        return;
      }
      // The page behind would scroll, and a focused button would be pressed.
      event.preventDefault();
    },
    onKeyup(event: KeyboardEvent): void {
      if (event.key === ' ' && this.spaceHandled) {
        this.spaceHandled = false;
        event.preventDefault();
      }
    },
    onShowUndone(event: Event): void {
      this.$emit('update:showUndone', (event.target as HTMLInputElement).checked);
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
      this.confirming = undefined;
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
    if (!this.live) {
      window.addEventListener('keydown', this.onKeydown);
      window.addEventListener('keyup', this.onKeyup);
    }
  },
  unmounted() {
    window.removeEventListener('keydown', this.onKeydown);
    window.removeEventListener('keyup', this.onKeyup);
  },
});
</script>
