<template>
  <div>
  <template v-if="waitingfor === undefined || waitingfor.optional">
    <template v-if="waitingfor === undefined">
      <template v-if="!playerView.game.frozen">{{ $t('Not your turn to take any actions') }}</template>
    </template>
    <template v-else>
      {{ $t('Waiting for other players') }}
    </template>
    <template v-if="playersWaitingFor.length > 0">
      (⌛ <span v-for="color in playersWaitingFor" class="log-player" :class="playerColorClass(color, 'bg')" :key="color">{{ getPlayerName(color) }}</span>)
    </template>
  </template>
  <div v-if="waitingfor !== undefined" class="wf-root">
    <PlayerInputFactory :players="playerView.players"
                          :playerView="playerView"
                          :playerinput="waitingfor"
                          :onsave="onsave"
                          :showsave="true"
                          :showtitle="true"
                          :key="inputKey" />
    </div>
  </div>
</template>

<script lang="ts">
/* global RequestInit */

import {defineComponent} from 'vue';
import * as constants from '@/common/constants';
import raw_settings from '@/genfiles/settings.json';
import {vueRoot} from '@/client/components/vueRoot';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {playerColorClass} from '@/common/utils/utils';
import {PlayerViewModel, ViewModel} from '@/common/models/PlayerModel';
import {JudgeModel} from '@/common/models/JudgeModel';
import {getPreferences} from '@/client/utils/PreferencesManager';
import {SoundManager} from '@/client/utils/SoundManager';
import {WaitingForModel} from '@/common/models/WaitingForModel';
import {Phase} from '@/common/Phase';
import {paths} from '@/common/app/paths';
import {passwordParam} from '@/client/utils/playerPassword';
import {statusCode} from '@/common/http/statusCode';
import {isJudgeId, isPlayerId} from '@/common/Types';
import {InputResponse} from '@/common/inputs/InputResponse';
import {INVALID_REQUEST_ID, INVALID_RUN_ID, AppErrorResponse} from '@/common/app/AppErrorId';
import {Color} from '@/common/Color';
import {gameDocumentTitle} from '../utils/documentTitle';
import {setFaviconStatus, setFaviconTurnFrame} from '@/client/utils/favicon';
import {watchesForRefresh} from '@/client/utils/watchesForRefresh';

let ui_update_timeout_id: number | undefined;
let otherPlayersTimer: number | undefined;
let documentTitleTimer: number | undefined;
let animationFrame = 0;
let failedPolls = 0;

// Failed polls in a row before the player is told. Enough to ride out a server restart.
const ALERT_AFTER_FAILED_POLLS = 30;

// How often to refresh other players' status during simultaneous phases.
const OTHER_PLAYERS_INTERVAL = 3000;
// Phases where every player makes a choice at the same time.
const SIMULTANEOUS_PHASES: ReadonlyArray<Phase> = [Phase.INITIALDRAFTING, Phase.DRAFTING, Phase.RESEARCH];

// The spinning ◑◒◐◓ symbol used to indicate it's your turn.
const TURN_SEQUENCE = '◑◒◐◓';

// On a desktop browser the favicon is visible in the tab, so we spin it there
// rather than cluttering the document title. Mobile browsers don't show tab
// favicons, so they keep animating the title instead.
function isDesktopBrowser(): boolean {
  return !/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

type DataModel = {
  playersWaitingFor: Array<Color>,
  /** Changes with every new player view, so the input starts fresh. */
  inputKey: number,
}

const INCORRECT_JUDGE_PASSWORD = 'Incorrect judge password. Reopen the judge page from your browser history, or ask the organizer for the judge link with its password.';
const CANNOT_CONTACT_SERVER = 'Unable to reach the server. It may be restarting or down for maintenance.';

export default defineComponent({
  name: 'WaitingFor',
  props: {
    playerView: {
      type: Object as () => ViewModel,
      required: true,
    },
    waitingfor: {
      type: Object as () => PlayerInputModel | undefined,
      default: undefined,
    },
  },
  data(): DataModel {
    return {
      playersWaitingFor: [],
      inputKey: 0,
    };
  },
  watch: {
    playerView() {
      this.inputKey++;
      this.stop();
      this.start();
    },
  },
  methods: {
    start() {
      document.title = gameDocumentTitle(this.playerView.game);
      if (getPreferences().experimental_ui) {
        setFaviconStatus(this.waitingfor !== undefined ? 'turn' : 'idle');
      }
      window.clearInterval(documentTitleTimer);
      if (this.waitingfor === undefined || this.waitingfor.optional) {
        this.waitForUpdate();
      } else {
        // The prompt stays on screen. A page that watches for a freeze or a rewind polls without reloading it.
        if (isPlayerId(this.playerView.id) && watchesForRefresh(this.playerView as PlayerViewModel)) {
          this.waitForUpdate(true);
        }
        if (this.playerView.players.length > 1 && SIMULTANEOUS_PHASES.includes(this.playerView.game.phase)) {
          this.watchOtherPlayers();
        }
      }
      if (this.playerView.players.length > 1 && this.waitingfor !== undefined && !this.waitingfor.optional) {
        documentTitleTimer = window.setInterval(() => this.animateTitle(), 1000);
      }
    },
    stop() {
      window.clearTimeout(ui_update_timeout_id);
      ui_update_timeout_id = undefined;
      window.clearTimeout(otherPlayersTimer);
      otherPlayersTimer = undefined;
      window.clearInterval(documentTitleTimer);
      documentTitleTimer = undefined;
    },
    getPlayerName(color: Color): string {
      const player = this.playerView.players.find((p) => p.color === color);
      return player ? player.name : color;
    },
    animateTitle() {
      if (!getPreferences().animated_title) {
        return;
      }

      animationFrame = (animationFrame + 1) % TURN_SEQUENCE.length;
      const experimental = getPreferences().experimental_ui;
      // The favicon annotation is an experimental feature.
      if (experimental) {
        setFaviconTurnFrame(animationFrame);
      }
      // Existing behavior spins the symbol in the document title. With
      // experimental UI on a desktop browser we show it only in the tab favicon
      // instead; otherwise keep animating the title.
      if (!(experimental && isDesktopBrowser())) {
        document.title = TURN_SEQUENCE[animationFrame] + ' ' + gameDocumentTitle(this.playerView.game);
      }
    },
    onsave(out: InputResponse) {
      this.fetchPlayerInput(
        paths.PLAYER_INPUT + '?id=' + this.playerView.id + passwordParam(this.playerView),
        {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({runId: this.playerView.runId, requestId: this.waitingfor?.requestId, ...out}),
        });
    },
    reset() {
      this.fetchPlayerInput(
        paths.RESET + '?id=' + this.playerView.id + passwordParam(this.playerView),
        {method: 'GET'});
    },
    fetchPlayerInput(url: string, options: RequestInit) {
      const root = vueRoot(this);
      if (root.isServerSideRequestInProgress) {
        console.warn('Server request in progress');
        return;
      }

      root.isServerSideRequestInProgress = true;
      fetch(url, options)
        .then(async (response) => {
          if (response.ok) {
            this.updatePlayerView(await response.json());
            return;
          }

          const showAlert = vueRoot(this).showAlert;
          if (response.status === statusCode.badRequest) {
            const resp = await response.json() as AppErrorResponse;
            let cb = () => {};
            if (resp.id === INVALID_RUN_ID || resp.id === INVALID_REQUEST_ID) {
              cb = () => setTimeout(() => window.location.reload(), 100);
            }
            showAlert('Error with input', resp.message, cb);
          } else {
            showAlert('Error processing response', 'Unexpected response from server. Please try again.');
            console.error(response.statusText);
          }
        })
        .catch((e) => {
          root.showAlert('Error sending input,', CANNOT_CONTACT_SERVER);
          console.error(e);
        })
        .finally(() => {
          root.isServerSideRequestInProgress = false;
        });
    },
    updatePlayerView(playerView: PlayerViewModel | undefined) {
      const root = vueRoot(this);
      root.playerView = playerView;
      root.screen = 'player-home';
      if (this.playerView.game.phase === 'end' && window.location.pathname !== paths.THE_END) {
        window.location = window.location as any as (string & Location);
      }
    },
    /**
     * Polls until the game changes. In watch mode the page shows a prompt that must not be disturbed:
     * only a refresh replaces the view, and a GO answer neither reloads it nor plays the turn cue.
     */
    waitForUpdate(watch: boolean = false) {
      const vueApp = this;
      const root = vueRoot(this);
      clearTimeout(ui_update_timeout_id);
      // A new view restarts polling through the playerView watcher. Without one, nothing would.
      const pollAgainUnlessUpdated = (updated: boolean) => {
        if (!updated) {
          vueApp.waitForUpdate(watch);
        }
      };
      const pollFailed = (title: string, message: string) => {
        failedPolls++;
        if (failedPolls < ALERT_AFTER_FAILED_POLLS) {
          vueApp.waitForUpdate(watch);
          return;
        }
        failedPolls = 0;
        root.showAlert(title, message, () => vueApp.waitForUpdate(watch));
      };
      const askForUpdate = () => {
        const xhr = new XMLHttpRequest();
        // A judge page changes whenever its signature does. Players and spectators compare ages.
        const query = isJudgeId(this.playerView.id) ?
          '&signature=' + encodeURIComponent((this.playerView as JudgeModel).signature) :
          '&gameAge=' + this.playerView.game.gameAge + '&undoCount=' + this.playerView.game.undoCount;
        xhr.open('GET', paths.API_WAITING_FOR + window.location.search + query);
        xhr.onerror = function() {
          pollFailed('Error fetching state', CANNOT_CONTACT_SERVER);
        };
        xhr.onload = () => {
          if (xhr.status === statusCode.ok) {
            failedPolls = 0;
            const result = xhr.response as WaitingForModel;
            this.playersWaitingFor = result.waitingFor;
            if (result.result === 'GO' && !watch) {
              // Will only apply to player, not spectator.
              root.updatePlayer().then(pollAgainUnlessUpdated);
              this.notify();
              // We don't need to wait anymore - it's our turn
              return;
            } else if (result.result === 'REFRESH') {
              // Something changed, let's refresh UI
              if (isPlayerId(this.playerView.id)) {
                // A refresh that hands the turn back (an unfreeze, or a rewind) is not a GO answer, so it cues the turn here.
                const hadTurn = this.waitingfor !== undefined && !this.waitingfor.optional;
                root.updatePlayer().then((updated) => {
                  const prompt = root.playerView?.waitingFor;
                  if (updated && !hadTurn && prompt !== undefined && !prompt.optional) {
                    this.notify();
                  }
                  pollAgainUnlessUpdated(updated);
                });
              } else if (isJudgeId(this.playerView.id)) {
                root.updateJudge().then(pollAgainUnlessUpdated);
              } else {
                root.updateSpectator().then(pollAgainUnlessUpdated);
              }

              return;
            }
            vueApp.waitForUpdate(watch);
          } else {
            const message = xhr.status === statusCode.unauthorized && isJudgeId(this.playerView.id) ?
              INCORRECT_JUDGE_PASSWORD :
              `Received unexpected response from server (${xhr.status}). This is often due to the server restarting.`;
            pollFailed('Error with input', message);
          }
        };
        xhr.responseType = 'json';
        xhr.send();
      };
      ui_update_timeout_id = window.setTimeout(askForUpdate, raw_settings.waitingForTimeout);
    },
    /**
     * While this player makes a simultaneous choice (e.g. drafting), keep the other
     * players' status current without redrawing the choice in progress.
     */
    watchOtherPlayers() {
      const playerView = this.playerView;
      window.clearTimeout(otherPlayersTimer);
      // Schedule the next poll only after this one finishes, so responses can't arrive out of order.
      const timer = window.setTimeout(async () => {
        try {
          const response = await fetch(paths.API_PLAYER + window.location.search);
          if (response.ok) {
            const latest: PlayerViewModel = await response.json();
            playerView.players = latest.players;
          } else {
            console.warn('Unable to update other players', response.status, response.statusText);
            // Client errors (e.g. the game no longer exists) won't recover, so stop polling.
            if (response.status < 500) {
              return;
            }
          }
        } catch (e) {
          console.warn('Unable to update other players', e);
        }
        // Stop if the component unmounted or another poll started while this one was in flight.
        if (otherPlayersTimer === timer) {
          this.watchOtherPlayers();
        }
      }, OTHER_PLAYERS_INTERVAL);
      otherPlayersTimer = timer;
    },
    notify() {
      if (getPreferences().enable_sounds) {
        SoundManager.playActivePlayerSound();
      }

      if (Notification.permission !== 'granted') {
        Notification.requestPermission();
      } else if (Notification.permission === 'granted') {
        const notificationOptions = {
          icon: 'favicon.ico',
          body: 'It\'s your turn!',
        };
        const notificationTitle = constants.APP_NAME;
        try {
          new Notification(notificationTitle, notificationOptions);
        } catch (e) {
          // ok so the native Notification doesn't work which will happen
          // try to use the service worker
          if (!window.isSecureContext || !navigator.serviceWorker) {
            return;
          }
          navigator.serviceWorker.ready.then((registration) => {
            registration.showNotification(notificationTitle, notificationOptions);
          }).catch((err) => {
            // avoid promise going uncaught
            console.warn('Failed to display notification with serviceWorker', err);
          });
        }
      }
    },
    playerName(color: Color) {
      const player = this.playerView.players.find((p) => p.color === color);
      return player?.name ?? '';
    },
  },
  mounted() {
    this.start();
  },
  beforeUnmount() {
    this.stop();
  },
  computed: {
    Phase(): typeof Phase {
      return Phase;
    },
    playerColorClass(): typeof playerColorClass {
      return playerColorClass;
    },
  },
});

</script>

