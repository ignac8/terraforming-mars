<template>
  <div class="replay-screen">
    <div v-if="status === 'loading'" class="replay-message" v-i18n>Loading replay...</div>
    <div v-else-if="status === 'not-finished'" class="replay-message">
      <p v-i18n>Replay is not ready yet. Try again in a moment.</p>
      <button class="btn btn-primary replay-retry" type="button" @click="loadMoves" v-i18n>Retry</button>
    </div>
    <div v-else-if="status === 'expired'" class="replay-message">
      <p v-i18n>This replay is no longer available.</p>
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
      <div v-if="error !== undefined" class="replay-error replay-error--floating">{{ error }}</div>
      <ReplayPanel
        :moves="moves"
        :index="index"
        :viewAs="viewAs"
        :players="replayView.view.players"
        :viewModel="replayView.view"
        :playing="playing"
        :speed="speed"
        @select="select"
        @update:viewAs="changeViewAs"
        @play="play"
        @pause="pause"
        @update:speed="changeSpeed"/>
    </template>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import PlayerHome from '@/client/components/PlayerHome.vue';
import SpectatorHome from '@/client/components/SpectatorHome.vue';
import ReplayHands from '@/client/components/replay/ReplayHands.vue';
import ReplayPanel from '@/client/components/replay/ReplayPanel.vue';
import {setTranslationContext} from '@/client/directives/i18n';
import {fetchReplayMoves, fetchReplayView} from '@/client/utils/fetchReplay';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {SpectatorModel} from '@/common/models/SpectatorModel';
import {ReplayMove, ReplayViewAs, ReplayViewModel} from '@/common/replay/ReplayModel';
import {ParticipantId} from '@/common/Types';

type Status = 'loading' | 'available' | 'not-finished' | 'expired' | 'error';

type DataModel = {
  status: Status;
  moves: Array<ReplayMove>;
  index: number;
  viewAs: ReplayViewAs;
  /** The view of `index` as `viewAs`. It lags behind them for as long as the next view is loading. */
  replayView: ReplayViewModel | undefined;
  /** Why the last request failed. */
  error: string | undefined;
  playing: boolean;
  speed: number;
  /** Numbers view requests so that a slow answer never replaces a newer one. */
  latestRequest: number;
  timer: ReturnType<typeof setTimeout> | undefined;
}

// Replays a finished game: the home screen of the chosen player, or the spectator's with every hand
// shown, rebuilt from the game's saves. Nothing here ever talks to the live game.
export default defineComponent({
  name: 'ReplayScreen',
  components: {PlayerHome, ReplayHands, ReplayPanel, SpectatorHome},
  props: {
    participantId: {
      type: String as () => ParticipantId,
      required: true,
    },
  },
  data(): DataModel {
    return {
      status: 'loading',
      moves: [],
      index: 0,
      viewAs: 'all',
      replayView: undefined,
      error: undefined,
      playing: false,
      speed: 1,
      latestRequest: 0,
      timer: undefined,
    };
  },
  computed: {
    spectatorView(): SpectatorModel | undefined {
      return this.replayView?.viewAs === 'all' ? this.replayView.view as SpectatorModel : undefined;
    },
    playerView(): PlayerViewModel | undefined {
      return this.replayView !== undefined && this.replayView.viewAs !== 'all' ? this.replayView.view as PlayerViewModel : undefined;
    },
  },
  methods: {
    async loadMoves(): Promise<void> {
      this.status = 'loading';
      this.error = undefined;
      try {
        const answer = await fetchReplayMoves(this.participantId);
        if (answer.status !== 'available') {
          this.status = answer.status;
        } else if (answer.moves.length === 0) {
          // Nothing to step through yet, which is the same as the saves not having landed.
          this.status = 'not-finished';
        } else {
          this.moves = answer.moves;
          this.status = 'available';
          await this.loadView();
        }
      } catch (err) {
        console.error(err);
        this.status = 'error';
        this.error = err instanceof Error ? err.message : String(err);
      }
    },
    async loadView(): Promise<void> {
      const request = ++this.latestRequest;
      try {
        const answer = await fetchReplayView(this.participantId, this.moves[this.index].saveId, this.viewAs);
        if (request !== this.latestRequest) {
          return;
        }
        if (answer.viewAs !== 'all') {
          setTranslationContext(answer.view as PlayerViewModel);
        }
        this.replayView = answer;
        this.error = undefined;
      } catch (err) {
        if (request !== this.latestRequest || (err instanceof Error && err.name === 'AbortError')) {
          return;
        }
        console.error(err);
        this.pause();
        this.error = err instanceof Error ? err.message : String(err);
      }
    },
    select(index: number): void {
      this.index = index;
      this.loadView();
    },
    changeViewAs(viewAs: ReplayViewAs): void {
      this.viewAs = viewAs;
      this.loadView();
    },
    play(): void {
      if (this.index >= this.moves.length - 1) {
        this.select(0);
      }
      this.playing = true;
      this.scheduleTick();
    },
    pause(): void {
      this.playing = false;
      this.cancelTick();
    },
    changeSpeed(speed: number): void {
      this.speed = speed;
      if (this.playing) {
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
    tick(): void {
      this.timer = undefined;
      this.select(this.index + 1);
      if (this.index >= this.moves.length - 1) {
        this.pause();
      } else {
        this.scheduleTick();
      }
    },
  },
  mounted() {
    this.loadMoves();
  },
  unmounted() {
    this.cancelTick();
  },
});
</script>
