<template>
  <div class="replay-screen">
    <!-- Outside the live and past views, so a player previewing a move still sees the vote. -->
    <RewindVoteBanner
      v-if="liveView !== undefined && votesOnRewind"
      :participantId="liveView.id"
      :color="liveView.color"
      :password="passwordFragment"
      :undoCount="liveView.game.undoCount"
      :players="liveView.players"
      ref="voteBanner"
      @show="showMove"
      @mayRequest="(mayRequest) => requestBlocked = !mayRequest"/>
    <template v-if="isLive">
      <div v-if="index !== undefined && replayView === undefined" class="replay-message" v-i18n>Loading replay...</div>
      <template v-else-if="index !== undefined && replayView !== undefined">
        <SpectatorHome v-if="spectatorView !== undefined" key="past-all" :spectator="spectatorView" :replay="true"/>
        <PlayerHome v-else-if="playerView !== undefined" key="past" :playerView="playerView" :replay="true"/>
        <ReplayHands v-if="spectatorView !== undefined" :privates="replayView.privates" :players="spectatorView.players"/>
      </template>
      <JudgeHome v-else-if="liveJudge !== undefined" key="live-judge" :judge="liveJudge"/>
      <PlayerHome v-else-if="liveView !== undefined" key="live" :playerView="liveView"/>
    </template>
    <div v-else-if="status === 'loading'" class="replay-message" v-i18n>Loading replay...</div>
    <div v-else-if="status === 'not-finished'" class="replay-message">
      <p v-i18n>Replay is not ready yet. Try again in a moment.</p>
      <button class="btn btn-primary replay-retry" type="button" @click="loadMoves" v-i18n>Retry</button>
    </div>
    <div v-else-if="status === 'expired'" class="replay-message">
      <p v-i18n>This replay is no longer available.</p>
    </div>
    <div v-else-if="status === 'not-found'" class="replay-message">
      <p v-i18n>This game was not found.</p>
    </div>
    <div v-else-if="status === 'error'" class="replay-message">
      <p class="replay-error">{{ error }}</p>
      <button class="btn btn-primary replay-retry" type="button" @click="loadMoves" v-i18n>Retry</button>
    </div>
    <div v-else-if="replayView === undefined" class="replay-message">
      <template v-if="error !== undefined">
        <p class="replay-error">{{ error }}</p>
        <button class="btn btn-primary replay-retry" type="button" @click="loadView" v-i18n>Retry</button>
      </template>
      <span v-else v-i18n>Loading replay...</span>
    </div>
    <template v-else>
      <SpectatorHome v-if="spectatorView !== undefined" :spectator="spectatorView" :replay="true"/>
      <PlayerHome v-else-if="playerView !== undefined" :playerView="playerView" :replay="true"/>
      <ReplayHands v-if="spectatorView !== undefined" :privates="replayView.privates" :players="spectatorView.players"/>
    </template>
    <!-- The panel, which shows the refusal otherwise, is gone while the moves load again, and stays gone if that fails. -->
    <div v-if="refusal !== undefined && panelView === undefined" class="replay-message">
      <p class="replay-error rewind-refusal">{{ refusal }}</p>
    </div>
    <ReplayPanel
      v-if="panelView !== undefined"
      :moves="moves"
      :index="index"
      :viewAs="viewAs"
      :players="panelView.players"
      :viewModel="panelView"
      :playing="playing"
      :speed="speed"
      :live="isLive"
      :canRewind="canRewind"
      :canVoteRewind="canVoteRewind"
      :requestBlocked="requestBlocked"
      :rewinding="rewinding || freezing"
      :frozen="judgeFrozen"
      :viewAsInLive="liveJudge !== undefined"
      :clocks="clockRows"
      :loading="status !== 'available'"
      @select="select"
      @update:viewAs="changeViewAs"
      @play="play"
      @pause="pause"
      @update:speed="changeSpeed"
      @update:collapsed="changeCollapsed"
      @back="backToLive"
      @rewind="rewind"
      @freeze="freeze"
      @request="requestRewind">
      <template #error>
        <div v-if="refusal !== undefined" class="replay-error rewind-refusal">{{ refusal }}</div>
        <div v-if="error !== undefined" class="replay-error replay-error--floating">{{ error }}</div>
      </template>
    </ReplayPanel>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import PlayerHome from '@/client/components/PlayerHome.vue';
import JudgeHome from '@/client/components/judge/JudgeHome.vue';
import SpectatorHome from '@/client/components/SpectatorHome.vue';
import ReplayHands from '@/client/components/replay/ReplayHands.vue';
import ReplayPanel from '@/client/components/replay/ReplayPanel.vue';
import RewindVoteBanner from '@/client/components/replay/RewindVoteBanner.vue';
import {vueRoot} from '@/client/components/vueRoot';
import {setTranslationContext} from '@/client/directives/i18n';
import {fetchReplayMoves, fetchReplayView, postJudgeFreeze, postJudgeRewind, postRewind, postVote, ReplayResponseError, seatPasswordParam, translateRefusal} from '@/client/utils/fetchReplay';
import {passwordParam} from '@/client/utils/playerPassword';
import {paths} from '@/common/app/paths';
import {JudgeModel} from '@/common/models/JudgeModel';
import {PlayerViewModel, ViewModel} from '@/common/models/PlayerModel';
import {SpectatorModel} from '@/common/models/SpectatorModel';
import {ReplayMove, ReplayMovesModel, ReplayViewAs, ReplayViewModel, RewindCards, RewindClockRow, RewindClocks} from '@/common/replay/ReplayModel';
import {Phase} from '@/common/Phase';
import {Timer} from '@/common/Timer';
import {isJudgeId, isPlayerId, ParticipantId} from '@/common/Types';

type Status = 'loading' | 'available' | 'not-finished' | 'expired' | 'not-found' | 'error';

// The moves of a running game end with its newest save. Until a move follows that save, it is the live
// game itself, which is no move to list. A finished game keeps it: it is the final position.
function listedMoves(answer: Extract<ReplayMovesModel, {status: 'available'}>): Array<ReplayMove> {
  const last = answer.moves[answer.moves.length - 1];
  return !answer.finished && last?.messages.length === 0 ? answer.moves.slice(0, -1) : answer.moves;
}

type DataModel = {
  status: Status;
  moves: Array<ReplayMove>;
  /** The selected move. Only the live game page has none, and then the live game shows. */
  index: number | undefined;
  viewAs: ReplayViewAs;
  /** Whether the moves answer allows rewinding to a move. */
  canRewind: boolean;
  /** Whether the moves answer allows asking the other players to rewind to a move. */
  canVoteRewind: boolean;
  /** The player is barred from asking for a rewind until the next generation. */
  requestBlocked: boolean;
  /** The game age the moves were read at, so the live page knows when they are out of date. */
  movesGameAge: number | undefined;
  /** The panel is open, so the live page keeps its moves current. */
  expanded: boolean;
  /** A rewind request is on its way. */
  rewinding: boolean;
  /** A freeze or unfreeze is on its way. */
  freezing: boolean;
  /** Numbers moves requests so that a slow answer never replaces a newer one. */
  latestMovesRequest: number;
  /** The view of `index` as `viewAs`. It lags behind them for as long as the next view is loading. */
  replayView: ReplayViewModel | undefined;
  /** The move `replayView` shows, so a failed load can put `index` back. */
  shownIndex: number;
  /** Why the last request failed. */
  error: string | undefined;
  /** Why the server refused the last rewind. */
  refusal: string | undefined;
  /** The page has read the game again after the refusal, so the next game update makes it stale. */
  refusalSettled: boolean;
  playing: boolean;
  speed: number;
  /** Numbers view requests so that a slow answer never replaces a newer one. */
  latestRequest: number;
  timer: ReturnType<typeof setTimeout> | undefined;
  /** An autoplay step is waiting for its view, so no timer is pending and none may be started. */
  advancing: boolean;
}

// Replays a game: the home screen of the chosen player, or the spectator's with every hand
// shown, rebuilt from the game's saves. Nothing here ever talks to the live game, except to rewind it.
//
// With `liveView` it sits on the live game page instead. The live home screen shows until a move is
// selected, then that moment shows, read-only, until the player goes back to the live game. With `liveJudge`
// it is the judge's page, which also freezes the game and may look at every hand.
export default defineComponent({
  name: 'ReplayScreen',
  components: {JudgeHome, PlayerHome, ReplayHands, ReplayPanel, RewindVoteBanner, SpectatorHome},
  props: {
    participantId: {
      type: String as () => ParticipantId,
      required: true,
    },
    /** The live game, when the screen is on the game page. */
    liveView: {
      type: Object as () => PlayerViewModel,
      default: undefined,
    },
    /** The live game as the judge sees it, when the screen is on the judge page. */
    liveJudge: {
      type: Object as () => JudgeModel,
      default: undefined,
    },
  },
  data(): DataModel {
    return {
      status: 'loading',
      moves: [],
      index: this.liveView === undefined && this.liveJudge === undefined ? 0 : undefined,
      viewAs: 'all',
      canRewind: false,
      canVoteRewind: false,
      requestBlocked: false,
      movesGameAge: undefined,
      expanded: false,
      rewinding: false,
      freezing: false,
      latestMovesRequest: 0,
      replayView: undefined,
      shownIndex: 0,
      error: undefined,
      refusal: undefined,
      refusalSettled: false,
      playing: false,
      speed: 1,
      latestRequest: 0,
      timer: undefined,
      advancing: false,
    };
  },
  computed: {
    /** The page of a player at a table where a rewind is put to a vote. The judge of a Judge undo game rewinds without one. */
    votesOnRewind(): boolean {
      const view = this.liveView;
      return view !== undefined && view.players.length > 1 && view.game.gameOptions.undoOption && !view.game.gameOptions.judgeUndo;
    },
    /** The live game of whoever is looking at it: the player, or the judge. */
    liveModel(): PlayerViewModel | JudgeModel | undefined {
      return this.liveView ?? this.liveJudge;
    },
    isLive(): boolean {
      return this.liveModel !== undefined;
    },
    passwordFragment(): string {
      return this.liveModel === undefined ? '' : passwordParam(this.liveModel);
    },
    /** Whether the game is frozen, for the judge only, who can freeze a game that is still running. */
    judgeFrozen(): boolean | undefined {
      const game = this.liveJudge?.game;
      return game === undefined || game.phase === Phase.END ? undefined : game.frozen === true;
    },
    /** What each clock reads in the live game and at the move shown, which a judge who rewinds chooses between. */
    clockRows(): Array<RewindClockRow> | undefined {
      if (!isJudgeId(this.participantId) || this.replayView === undefined) {
        return undefined;
      }
      const live = this.liveJudge?.players;
      return this.replayView.view.players.map((player) => {
        const current = live?.find((p) => p.color === player.color);
        return {
          color: player.color,
          name: player.name,
          now: current === undefined ? '' : Timer.toString(current.timer),
          then: Timer.toString(player.timer),
        };
      });
    },
    spectatorView(): SpectatorModel | undefined {
      return this.replayView?.viewAs === 'all' ? this.replayView.view as SpectatorModel : undefined;
    },
    playerView(): PlayerViewModel | undefined {
      return this.replayView !== undefined && this.replayView.viewAs !== 'all' ? this.replayView.view as PlayerViewModel : undefined;
    },
    /** What the panel names players and generations from. It is hidden until there is something to show. */
    panelView(): ViewModel | undefined {
      if (this.liveModel !== undefined) {
        return this.replayView?.view ?? this.liveModel;
      }
      return this.status === 'available' ? this.replayView?.view : undefined;
    },
  },
  methods: {
    async loadMoves(): Promise<void> {
      const request = ++this.latestMovesRequest;
      const gameAge = this.liveModel?.game.gameAge;
      if (!this.isLive) {
        this.status = 'loading';
      }
      this.error = undefined;
      try {
        const answer = await fetchReplayMoves(this.participantId, this.liveModel && passwordParam(this.liveModel));
        if (request !== this.latestMovesRequest) {
          return;
        }
        const moves = answer.status === 'available' ? listedMoves(answer) : [];
        if (moves.length === 0) {
          // The list the page showed is gone, and must not stay to be picked or rewound to.
          this.moves = [];
          this.canRewind = false;
          this.canVoteRewind = false;
          if (this.index !== undefined && this.isLive) {
            this.backToLive();
          }
        }
        if (answer.status === 'available' && moves.length === 0 && this.isLive) {
          // A game with no move made yet, for the panel to say so.
          this.movesGameAge = gameAge;
          this.status = 'available';
        } else if (answer.status !== 'available' || moves.length === 0) {
          // No moves yet is the same as the saves not having landed.
          this.status = answer.status !== 'available' ? answer.status : 'not-finished';
          if (this.isLive) {
            this.error = this.$t('Replay is not ready yet. Try again in a moment.');
          }
        } else {
          if (this.moves.length === 0) {
            this.viewAs = answer.defaultViewAs;
          }
          this.moves = moves;
          this.canRewind = answer.canRewind;
          this.canVoteRewind = answer.canVoteRewind;
          this.movesGameAge = gameAge;
          this.status = 'available';
          if (!this.isLive) {
            // Read again, the list can be shorter than the one the move was picked from.
            this.index = Math.min(this.index ?? 0, this.moves.length - 1);
            await this.loadView();
          }
        }
      } catch (err) {
        if (request !== this.latestMovesRequest) {
          return;
        }
        console.error(err);
        // The moves endpoint answers 400 and 404 only for an id that names no game, which no retry fixes.
        // On the live page the game is there, so whatever went wrong is shown in the panel.
        if (!this.isLive && err instanceof ReplayResponseError && (err.status === 400 || err.status === 404)) {
          this.status = 'not-found';
          return;
        }
        this.status = 'error';
        this.error = err instanceof Error ? err.message : String(err);
      }
    },
    async loadView(): Promise<void> {
      const request = ++this.latestRequest;
      const {index, viewAs} = this;
      if (index === undefined) {
        return;
      }
      try {
        const answer = await fetchReplayView(this.participantId, this.moves[index].saveId, viewAs, this.liveModel && passwordParam(this.liveModel));
        if (request !== this.latestRequest) {
          return;
        }
        // Only the players' names and MarsBot's are read from it, and the spectator's model has them too.
        setTranslationContext(answer.view as PlayerViewModel);
        this.replayView = answer;
        this.shownIndex = index;
        this.error = undefined;
      } catch (err) {
        if (request !== this.latestRequest || (err instanceof Error && err.name === 'AbortError')) {
          return;
        }
        console.error(err);
        this.pause();
        this.error = err instanceof Error ? err.message : String(err);
        // Keep the panel in step with the board, which still shows the previous view.
        if (this.replayView !== undefined) {
          this.index = this.shownIndex;
          this.viewAs = this.replayView.viewAs;
        } else if (this.isLive) {
          this.index = undefined;
        }
      }
    },
    /** Leaves the past moment for the live game, which has been waiting for input the whole time. */
    backToLive(): void {
      this.latestRequest++;
      this.index = undefined;
      this.replayView = undefined;
      this.error = undefined;
      if (this.liveModel !== undefined) {
        setTranslationContext(this.liveModel);
      }
    },
    /** The panel opens and closes. On the live page the moves are only read while it is open. */
    changeCollapsed(collapsed: boolean): void {
      this.expanded = !collapsed;
      if (this.liveModel !== undefined && this.expanded && this.movesGameAge !== this.liveModel.game.gameAge) {
        this.loadMoves();
      }
    },
    /**
     * Rewinds the game to before the selected move, then goes to the game page of the player. The judge's rewind keeps
     * the game frozen, and goes back to the judge page, which is the page itself when it is the live one.
     */
    async rewind(cards: RewindCards, clocks: RewindClocks): Promise<void> {
      const id = this.participantId;
      if (this.index === undefined || this.rewinding || this.freezing || !(isPlayerId(id) || isJudgeId(id))) {
        return;
      }
      this.pause();
      this.rewinding = true;
      this.error = undefined;
      this.clearRefusal();
      try {
        const saveId = this.moves[this.index].saveId;
        if (isJudgeId(id)) {
          await postJudgeRewind(id, saveId, cards, clocks, this.liveJudge && passwordParam(this.liveJudge));
          // The page is on its way out, so it stays disabled.
          if (this.liveJudge !== undefined) {
            window.location.reload();
          } else {
            window.location.href = `${paths.JUDGE}?id=${id}${seatPasswordParam(id, undefined)}`;
          }
        } else {
          await postRewind(id, saveId, cards, this.liveView);
          window.location.href = `${paths.PLAYER}?id=${id}`;
        }
      } catch (err) {
        console.error(err);
        const refusal = err instanceof Error ? translateRefusal(err.message) : String(err);
        this.rewinding = false;
        // The game can have changed without this page, e.g. by a rewind from another page, so it is read again.
        const reads: Array<Promise<unknown>> = [];
        if (this.isLive) {
          this.backToLive();
          reads.push(this.liveJudge === undefined ? vueRoot(this).updatePlayer() : vueRoot(this).updateJudge());
        }
        reads.push(this.loadMoves());
        this.refusal = refusal;
        // The game update that reading brings is the one the refusal answers, so it stays for it.
        await Promise.allSettled(reads);
        await this.$nextTick();
        this.refusalSettled = this.refusal === refusal;
      }
    },
    /** Asks the other players to rewind the game to before the selected move. The vote banner picks the vote up. */
    async requestRewind(cards: RewindCards): Promise<void> {
      if (this.index === undefined || this.rewinding || !isPlayerId(this.participantId)) {
        return;
      }
      this.rewinding = true;
      this.error = undefined;
      this.clearRefusal();
      try {
        await postVote(this.participantId, {action: 'request', saveId: this.moves[this.index].saveId, cards}, this.passwordFragment);
        (this.$refs.voteBanner as InstanceType<typeof RewindVoteBanner> | undefined)?.refresh?.();
      } catch (err) {
        console.error(err);
        this.error = err instanceof Error ? translateRefusal(err.message) : String(err);
      } finally {
        this.rewinding = false;
      }
    },
    /** Freezes the game, or unfreezes it, and reads the game again to show which it is now. */
    async freeze(): Promise<void> {
      if (this.liveJudge === undefined || this.rewinding || this.freezing || this.judgeFrozen === undefined) {
        return;
      }
      this.freezing = true;
      this.error = undefined;
      this.clearRefusal();
      try {
        await postJudgeFreeze(this.liveJudge.id, !this.judgeFrozen, passwordParam(this.liveJudge));
      } catch (err) {
        console.error(err);
        this.refusal = err instanceof Error ? translateRefusal(err.message) : String(err);
      }
      try {
        await vueRoot(this).updateJudge();
      } finally {
        this.freezing = false;
      }
    },
    /** Shows the move a vote is about, reading the moves first when the page does not have it yet. */
    async showMove(saveId: number): Promise<void> {
      let at = this.moves.findIndex((move) => move.saveId === saveId);
      if (at < 0) {
        await this.loadMoves();
        at = this.moves.findIndex((move) => move.saveId === saveId);
      }
      if (at >= 0) {
        await this.select(at);
      }
    },
    clearRefusal(): void {
      this.refusal = undefined;
      this.refusalSettled = false;
    },
    /** A move picked by hand. It takes over from autoplay, which would otherwise carry on from a stale position. */
    select(index: number): Promise<void> {
      this.pause();
      this.clearRefusal();
      return this.goTo(index);
    },
    goTo(index: number): Promise<void> {
      this.index = Math.min(Math.max(index, 0), this.moves.length - 1);
      return this.loadView();
    },
    /** A view picked by hand. Like `select`, it stops autoplay, whose next step would cancel a slow load of the view. */
    changeViewAs(viewAs: ReplayViewAs): void {
      this.pause();
      this.viewAs = viewAs;
      this.loadView();
    },
    play(): void {
      if (this.moves.length < 2) {
        return;
      }
      if ((this.index ?? 0) >= this.moves.length - 1) {
        this.goTo(0);
      }
      this.playing = true;
      if (!this.advancing) {
        this.scheduleTick();
      }
    },
    pause(): void {
      this.playing = false;
      this.cancelTick();
    },
    changeSpeed(speed: number): void {
      this.speed = speed;
      if (this.playing && this.timer !== undefined) {
        this.scheduleTick();
      }
    },
    scheduleTick(): void {
      this.cancelTick();
      this.timer = setTimeout(() => this.tick(), 1000 / this.speed);
    },
    cancelTick(): void {
      clearTimeout(this.timer);
      this.timer = undefined;
    },
    /** Moves on by one move, and only starts the next wait once that move's view is on screen. */
    async tick(): Promise<void> {
      this.timer = undefined;
      this.advancing = true;
      try {
        await this.goTo((this.index ?? 0) + 1);
      } finally {
        this.advancing = false;
      }
      if (!this.playing) {
        return;
      }
      if ((this.index ?? 0) >= this.moves.length - 1) {
        this.pause();
      } else {
        this.scheduleTick();
      }
    },
  },
  watch: {
    // The table was rewound, so a past move that is shown and the moves listed belong to a game that is gone.
    'liveModel.game.undoCount'() {
      this.pause();
      this.backToLive();
      this.latestMovesRequest++;
      this.moves = [];
      this.canRewind = false;
      this.canVoteRewind = false;
      this.movesGameAge = undefined;
      if (this.expanded) {
        this.loadMoves();
      }
    },
    // The game moved on, so the moves the open panel lists are missing the newest ones.
    'liveModel.game.gameAge'() {
      if (this.refusalSettled) {
        this.clearRefusal();
      }
      if (this.expanded) {
        this.loadMoves();
      }
    },
  },
  mounted() {
    if (!this.isLive) {
      this.loadMoves();
    }
  },
  unmounted() {
    this.pause();
  },
});
</script>
