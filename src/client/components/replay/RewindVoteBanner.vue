<template>
  <Teleport :to="stack" :disabled="stack === null">
    <div v-if="vote !== undefined || error !== undefined" class="rewind-vote-banner">
      <template v-if="vote !== undefined && vote.status === 'open'">
        <div class="rewind-vote-open">
          <div class="rewind-vote-title">{{ title }}</div>
          <div class="rewind-vote-cards" v-i18n>{{ vote.cards === 'shuffle' ? 'Shuffle hidden piles' : 'Same cards' }}</div>
          <ul class="rewind-vote-choices">
            <li v-for="choice in vote.votes" :key="choice.color" class="rewind-vote-choice" :class="'rewind-vote-choice--' + choice.choice">
              <span class="rewind-vote-name" :class="'player_bg_color_' + choice.color">{{ nameOf(choice.color) }}</span>
              <span v-i18n>{{ choice.choice === 'yes' ? 'Yes' : choice.choice === 'no' ? 'No' : 'Waiting' }}</span>
            </li>
          </ul>
          <div class="rewind-vote-countdown">{{ countdown }}</div>
          <div class="rewind-vote-note" v-i18n>Any move ends the vote.</div>
        </div>
        <div class="rewind-vote-actions">
          <template v-if="canAnswer">
            <button class="rewind-vote-yes" type="button" :disabled="acting" @click="act('yes')" v-i18n>Yes</button>
            <button class="rewind-vote-no" type="button" :disabled="acting" @click="act('no')" v-i18n>No</button>
          </template>
          <button v-if="isRequester" class="rewind-vote-cancel" type="button" :disabled="acting" @click="act('cancel')" v-i18n>Cancel</button>
          <a v-if="replayUrl !== undefined" class="rewind-vote-replay" :href="replayUrl" v-i18n>Open the replay</a>
          <button v-else class="rewind-vote-show" type="button" @click="$emit('show', vote.saveId)" v-i18n>Show this move</button>
        </div>
      </template>
      <div v-else-if="vote !== undefined" class="rewind-vote-ended">{{ endedLine }}</div>
      <div v-if="error !== undefined" class="rewind-vote-error">{{ error }}</div>
    </div>
  </Teleport>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {translateRefusal, fetchVote, postVote, seatPasswordParam, VoteBody} from '@/client/utils/fetchReplay';
import {translateTextWithParams} from '@/client/directives/i18n';
import {paths} from '@/common/app/paths';
import {Color} from '@/common/Color';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {RewindVoteModel, RewindVotePoll} from '@/common/rewind/RewindVoteModel';
import {PlayerId} from '@/common/Types';

const VOTE_POLL_MS = 3000;

type DataModel = {
  vote: RewindVoteModel | undefined;
  /** When `vote` was read, to count `expiresInMs` down from. */
  receivedAt: number;
  now: number;
  /** Why the last answer or cancel was refused. It stays until the next poll. */
  error: string | undefined;
  /** An answer to the vote is on its way. */
  acting: boolean;
  /** What the table's undo count was when this banner first heard of it, for a page that was not given one. */
  baseline: number | undefined;
  /** Numbers requests so that a slow answer never replaces a newer one. */
  latestRequest: number;
  pollTimer: ReturnType<typeof setTimeout> | undefined;
  clockTimer: ReturnType<typeof setInterval> | undefined;
  stopped: boolean;
  /** The app's fixed banner stack, which the banner shows in. A page without one (a test) shows it in place. */
  stack: HTMLElement | null;
}

// The open rewind vote of the table, polled from the server. It shows a vote while it is open and for a minute
// after it ended, lets a voter answer it, and sends the page to the game page once the table was rewound.
export default defineComponent({
  name: 'RewindVoteBanner',
  props: {
    participantId: {
      type: String as () => PlayerId,
      required: true,
    },
    /** The viewer's colour. A running game leaves the players' ids out of its model, so the viewer is known by colour. */
    color: {
      type: String as () => Color,
      required: true,
    },
    /** The seat's password as `passwordParam` makes it, or '' where the address bar has it. */
    password: {
      type: String,
      required: true,
    },
    /**
     * The undo count of the game the page shows. A page that shows an old save has no count of its own,
     * so it leaves this out, and the first answer is what it compares the later ones with.
     */
    undoCount: {
      type: Number,
      default: undefined,
    },
    players: {
      type: Array as () => Array<PublicPlayerModel>,
      required: true,
    },
    pollMs: {
      type: Number,
      default: VOTE_POLL_MS,
    },
    /** Where the replay of this game is. When given, it is linked instead of showing the move on this page. */
    replayUrl: {
      type: String,
      default: undefined,
    },
  },
  emits: {
    /** The player wants to see the move the vote is about. */
    'show': (_saveId: number) => true,
    /** Whether the player may ask for a rewind, from each answer. */
    'mayRequest': (_mayRequest: boolean) => true,
  },
  data(): DataModel {
    return {
      vote: undefined,
      receivedAt: 0,
      now: 0,
      error: undefined,
      acting: false,
      baseline: undefined,
      latestRequest: 0,
      pollTimer: undefined,
      clockTimer: undefined,
      stopped: false,
      stack: null,
    };
  },
  computed: {
    isRequester(): boolean {
      return this.vote?.requester === this.color;
    },
    canAnswer(): boolean {
      const mine = this.vote?.votes.find((choice) => choice.color === this.color);
      return mine?.choice === 'pending';
    },
    title(): string {
      const vote = this.vote;
      if (vote === undefined) {
        return '';
      }
      return translateTextWithParams('${0} asks to rewind to before move ${1} of generation ${2}.', [
        this.nameOf(vote.requester), String(vote.moveNumber), String(vote.generation)]);
    },
    countdown(): string {
      const left = Math.max(0, Math.ceil(((this.vote?.expiresInMs ?? 0) - (this.now - this.receivedAt)) / 1000));
      const seconds = String(left % 60).padStart(2, '0');
      return translateTextWithParams('Time left: ${0}', [`${Math.floor(left / 60)}:${seconds}`]);
    },
    /** Why the vote ended. */
    endedLine(): string {
      const vote = this.vote;
      switch (vote?.status) {
      case 'declined': {
        const no = vote.votes.find((choice) => choice.choice === 'no');
        return translateTextWithParams('${0} declined the rewind.', [no === undefined ? '' : this.nameOf(no.color)]);
      }
      case 'cancelled':
        return this.$t('The rewind request was cancelled.');
      case 'expired':
        return this.$t('The rewind request expired.');
      case 'moved-on':
        return this.$t('A move was made, so the rewind request ended.');
      case 'froze':
        return this.$t('The judge froze the game, so the rewind request ended.');
      case 'judge-rewound':
        return this.$t('The judge rewound the game, so the rewind request ended.');
      case 'failed':
        return vote.reason === undefined ? this.$t('The rewind did not happen.') : translateRefusal(vote.reason);
      default:
        return this.$t('Everyone agreed. The game is being rewound.');
      }
    },
  },
  methods: {
    nameOf(color: Color): string {
      return this.players.find((player) => player.color === color)?.name ?? color;
    },
    /** Applies the answer of `request`, unless a newer request was sent since. */
    async receive(request: () => Promise<RewindVotePoll>, keepError = false): Promise<void> {
      const sent = ++this.latestRequest;
      const answer = await request();
      if (this.stopped) {
        return;
      }
      this.baseline ??= this.undoCount ?? answer.undoCount;
      if (answer.undoCount !== (this.undoCount ?? this.baseline)) {
        // The table was rewound, so this page shows a game that no longer exists.
        this.stop();
        window.location.href = `${paths.PLAYER}?id=${this.participantId}${seatPasswordParam(this.participantId, this.password)}`;
        return;
      }
      if (sent !== this.latestRequest) {
        return;
      }
      this.vote = answer.vote;
      this.receivedAt = this.now = Date.now();
      if (!keepError) {
        this.error = undefined;
      }
      this.syncClock();
      this.$emit('mayRequest', answer.mayRequest);
    },
    /** The countdown has a clock only while there is a vote to count down. */
    syncClock(): void {
      const open = this.vote?.status === 'open';
      if (open && this.clockTimer === undefined) {
        this.clockTimer = setInterval(() => this.now = Date.now(), 1000);
      } else if (!open && this.clockTimer !== undefined) {
        clearInterval(this.clockTimer);
        this.clockTimer = undefined;
      }
    },
    async poll(): Promise<void> {
      try {
        await this.receive(() => fetchVote(this.participantId, this.password));
      } catch (err) {
        // A restart or a failing server. The last answer stays, and the next poll tries again.
        console.warn('Unable to read the rewind vote', err);
      }
      if (!this.stopped) {
        this.pollTimer = setTimeout(() => this.poll(), this.pollMs);
      }
    },
    /** Reads the vote now, e.g. after this page asked for one, instead of at the next poll. */
    async refresh(): Promise<void> {
      try {
        await this.receive(() => fetchVote(this.participantId, this.password));
      } catch (err) {
        console.warn('Unable to read the rewind vote', err);
      }
    },
    async act(action: 'yes' | 'no' | 'cancel'): Promise<void> {
      if (this.vote === undefined || this.acting) {
        return;
      }
      const body: VoteBody = {action, voteId: this.vote.voteId};
      this.acting = true;
      this.error = undefined;
      try {
        await this.receive(() => postVote(this.participantId, body, this.password));
      } catch (err) {
        console.warn('Unable to answer the rewind vote', err);
        this.error = err instanceof Error ? translateRefusal(err.message) : String(err);
        // The table has moved on without this page, e.g. the vote ended, so it is read again.
        try {
          await this.receive(() => fetchVote(this.participantId, this.password), true);
        } catch (readErr) {
          console.warn('Unable to read the rewind vote', readErr);
        }
      } finally {
        this.acting = false;
      }
    },
    stop(): void {
      this.stopped = true;
      clearTimeout(this.pollTimer);
      clearInterval(this.clockTimer);
      this.clockTimer = undefined;
    },
  },
  mounted() {
    // Looked up here, not in `data`, because App renders the stack and this page in the same pass.
    this.stack = document.getElementById('rewind-banners');
    this.poll();
  },
  unmounted() {
    this.stop();
  },
});
</script>
