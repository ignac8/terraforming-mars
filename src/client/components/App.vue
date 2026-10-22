<template>
  <div :class="'topmost-'+screen">
    <section>
      <dialog id="alert-dialog" class="alert-dialog">
        <form method="dialog">
          <p id="alert-dialog-title" class="title" v-i18n>Error with input</p>
          <p id="alert-dialog-message"></p>
          <menu class="dialog-menu centered-content">
            <button id="alert-dialog-button" class="btn btn-lg btn-primary">OK</button>
          </menu>
        </form>
      </dialog>
    </section>
    <FrozenBanner v-if="frozen"/>
    <div class="main-container">
      <StartScreen v-if="screen === 'start-screen'"/>
      <CreateGameForm
        v-else-if="screen === 'create-game-form'"
      />
      <LoadGameForm v-else-if="screen === 'load'"/>
      <GameHome
        v-else-if="screen === 'game-home' && game !== undefined"
        :game="game"
      />
      <ReplayScreen
        v-else-if="screen === 'player-home' && playerView !== undefined && hasHistory"
        :participantId="playerView.id"
        :liveView="playerView"
      />
      <PlayerHome
        v-else-if="screen === 'player-home' && playerView !== undefined"
        :player-view="playerView"
      />
      <SpectatorHome
        v-else-if="screen === 'spectator-home' && spectator !== undefined"
        :spectator="spectator"
      />
      <JudgeHome
        v-else-if="screen === 'judge-home' && judge !== undefined"
        :judge="judge"
      />
      <GameEnd
        v-else-if="screen === 'the-end' && participant !== undefined"
        :participant="participant"
      />
      <GamesOverview
        v-else-if="screen === 'games-overview'"
      />
      <CardList v-else-if="screen === 'cards'"/>
      <ReplayScreen
        v-else-if="screen === 'replay' && replayParticipantId !== undefined"
        :participantId="replayParticipantId"
      />
      <AdminHome v-else-if="screen === 'admin'"/>
      <LoginHome v-else-if="screen === 'login-home'"/>
      <Help v-else-if="screen === 'help'"/>
    </div>
    <div class="notice" v-i18n>
      Not affiliated with FryxGames, Asmodee Digital or Steam in any way.
    </div>
  </div>
</template>

<script lang="ts">
import {defineAsyncComponent, defineComponent} from 'vue';
import * as constants from '@/common/constants';

const AdminHome = defineAsyncComponent(() => import(/* webpackChunkName: "admin" */ '@/client/components/admin/AdminHome.vue'));
const CardList = defineAsyncComponent(() => import(/* webpackChunkName: "card-list" */ '@/client/components/cardlist/CardList.vue'));
const CreateGameForm = defineAsyncComponent(() => import(/* webpackChunkName: "create-game" */ '@/client/components/create/CreateGameForm.vue'));
const GameEnd = defineAsyncComponent(() => import(/* webpackChunkName: "game-end" */ '@/client/components/GameEnd.vue'));
const GameHome = defineAsyncComponent(() => import(/* webpackChunkName: "game-home" */ '@/client/components/GameHome.vue'));
const GamesOverview = defineAsyncComponent(() => import(/* webpackChunkName: "games-overview" */ '@/client/components/GamesOverview.vue'));
const Help = defineAsyncComponent(() => import(/* webpackChunkName: "help" */ '@/client/components/help/Help.vue'));
const JudgeHome = defineAsyncComponent(() => import(/* webpackChunkName: "judge-home" */ '@/client/components/judge/JudgeHome.vue'));
const LoginHome = defineAsyncComponent(() => import(/* webpackChunkName: "login" */ '@/client/components/auth/LoginHome.vue'));
const LoadGameForm = defineAsyncComponent(() => import(/* webpackChunkName: "load-game" */ '@/client/components/LoadGameForm.vue'));
const PlayerHome = defineAsyncComponent(() => import(/* webpackChunkName: "player-home" */ '@/client/components/PlayerHome.vue'));
const SpectatorHome = defineAsyncComponent(() => import(/* webpackChunkName: "spectator-home" */ '@/client/components/SpectatorHome.vue'));
const ReplayScreen = defineAsyncComponent(() => import(/* webpackChunkName: "replay" */ '@/client/components/replay/ReplayScreen.vue'));
const StartScreen = defineAsyncComponent(() => import(/* webpackChunkName: "start-screen" */ '@/client/components/StartScreen.vue'));
import {$t, setTranslationContext} from '@/client/directives/i18n';
import {paths} from '@/common/app/paths';
import {statusCode} from '@/common/http/statusCode';
import {passwordParam} from '@/client/utils/playerPassword';

/** A player seat already claimed by someone else. */
class UnauthorizedError extends Error {}
import {PlayerViewModel, ViewModel} from '@/common/models/PlayerModel';
import {SimpleGameModel} from '@/common/models/SimpleGameModel';
import {SpectatorModel} from '@/common/models/SpectatorModel';
import {JudgeModel} from '@/common/models/JudgeModel';
import {isJudgeId, isPlayerId, isSpectatorId, ParticipantId} from '@/common/Types';
import {hasShowModal, showModal, windowHasHTMLDialogElement} from './HTMLDialogElementCompatibility';

import dialogPolyfill from 'dialog-polyfill';
import {setDocumentTitle} from '../utils/documentTitle';
import {reloadForChunkError} from '@/client/utils/chunkReload';
import FrozenBanner from '@/client/components/replay/FrozenBanner.vue';

type Screen = 'admin' |
            'create-game-form' |
            'cards' |
            'empty' |
            'game-home' |
            'games-overview' |
            'help' |
            'judge-home' |
            'load' |
            'login-home' |
            'player-home' |
            'replay' |
            'spectator-home' |
            'start-screen' |
            'the-end';
export type MainAppData = {
    screen: Screen;
    /**
     * player, spectator or judge are set once the app component has loaded.
     * Vue only watches properties that exist initially. When we
     * use this property we can't trigger vue state without
     * a refactor.
     */
    spectator?: SpectatorModel;
    judge?: JudgeModel;
    playerView?: PlayerViewModel;
    isServerSideRequestInProgress: boolean;
    componentsVisibility: {[x: string]: boolean};
    game: SimpleGameModel | undefined;
    login: string | undefined;
    replayParticipantId: ParticipantId | undefined;
}

// NOTE: this simplistic truncation to the last segment might cause issues if
// this page starts supporting paths more than one level deep.
function getLastPathSegment() {
  // Leave only the last part of /path
  return window.location.pathname.replace(/.*\//g, '');
}

export default defineComponent({
  name: 'App',
  data(): MainAppData {
    return {
      screen: 'empty',
      isServerSideRequestInProgress: false,
      componentsVisibility: {
        'milestones': true,
        'awards_list': true,
        'tags_concise': false,
        'pinned_player_0': false,
        'pinned_player_1': false,
        'pinned_player_2': false,
        'pinned_player_3': false,
        'pinned_player_4': false,
        'turmoil_parties': false,
      } as {[x: string]: boolean},
      game: undefined as SimpleGameModel | undefined,
      playerView: undefined,
      spectator: undefined,
      judge: undefined,
      login: undefined,
      replayParticipantId: undefined,
    };
  },
  components: {
    FrozenBanner,
    StartScreen,
    CreateGameForm,
    LoadGameForm,
    GameHome,
    PlayerHome,
    SpectatorHome,
    JudgeHome,
    GameEnd,
    GamesOverview,
    CardList,
    Help,
    AdminHome,
    LoginHome,
    ReplayScreen,
  },
  computed: {
    participant(): ViewModel | undefined {
      return this.playerView ?? this.spectator;
    },
    /** The judge has frozen the game that this page shows live. A replay shows a past moment, which is never frozen. */
    frozen(): boolean {
      switch (this.screen) {
      case 'player-home':
        return this.playerView?.game.frozen === true;
      case 'spectator-home':
        return this.spectator?.game.frozen === true;
      case 'judge-home':
        return this.judge?.game.frozen === true;
      default:
        return false;
      }
    },
    /** A solo or MarsBot game with Player undo keeps its history on the game page, where the player can rewind it. */
    hasHistory(): boolean {
      return this.playerView !== undefined && this.playerView.players.length === 1 && this.playerView.game.gameOptions.undoOption;
    },
  },
  methods: {
    showAlert(title: string, message: string, cb: () => void = () => {}): void {
      const dialogElement: HTMLElement | null = document.getElementById('alert-dialog');
      const buttonElement: HTMLElement | null = document.getElementById('alert-dialog-button');
      const messageElement: HTMLElement | null = document.getElementById('alert-dialog-message');
      const titleElement: HTMLElement | null = document.getElementById('alert-dialog-title');
      if (buttonElement !== null && titleElement !== null && messageElement !== null && dialogElement !== null && hasShowModal(dialogElement)) {
        messageElement.innerHTML = $t(message);
        titleElement.textContent = $t(title);
        const handler = () => {
          buttonElement.removeEventListener('click', handler);
          cb();
        };
        buttonElement.addEventListener('click', handler);
        showModal(dialogElement);
      } else {
        alert(message);
        cb();
      }
    },
    setVisibilityState(targetVar: string, isVisible: boolean) {
      if (isVisible === this.getVisibilityState(targetVar)) {
        return;
      }
      (this as unknown as MainAppData).componentsVisibility[targetVar] = isVisible;
    },
    getVisibilityState(targetVar: string): boolean {
      return (this as unknown as MainAppData).componentsVisibility[targetVar] ? true : false;
    },
    /** Resolves to whether the view was replaced. */
    update(path: typeof paths.PLAYER | typeof paths.SPECTATOR | typeof paths.JUDGE): Promise<boolean> {
      const currentPathname = getLastPathSegment();
      const app = this as unknown as MainAppData;

      const url = 'api/' + path + window.location.search.replace('&noredirect', '');

      return fetch(url)
        .then((resp) => {
          if (resp.status === statusCode.unauthorized) {
            throw new UnauthorizedError();
          }
          if (!resp.ok) {
            throw new Error(`Error getting game data: ${resp.statusText}`);
          }
          return resp.json();
        })
        .then((model: ViewModel) => {
          if (path === paths.PLAYER) {
            app.playerView = model as PlayerViewModel;
            setTranslationContext(app.playerView);
          } else if (path === paths.SPECTATOR) {
            app.spectator = model as SpectatorModel;
          } else {
            app.judge = model as JudgeModel;
            setTranslationContext(app.judge);
          }
          // The password has to survive into the address bar: it is how this
          // seat or judge page stays claimed, and every later poll reads it back out of the URL.
          const password = passwordParam(model);
          // A finished judge game stays on the judge page, which has no results screen.
          if (
            path !== paths.JUDGE &&
              model.game.phase === 'end' &&
              window.location.search.includes('&noredirect') === false
          ) {
            app.screen = 'the-end';
            if (currentPathname !== paths.THE_END) {
              window.history.replaceState(
                model,
                `${constants.APP_NAME} - Player`,
                `${paths.THE_END}?id=${model.id}${password}`,
              );
            }
          } else {
            if (path === paths.PLAYER) {
              app.screen = 'player-home';
            } else if (path === paths.SPECTATOR) {
              app.screen = 'spectator-home';
            } else {
              app.screen = 'judge-home';
            }
            // The server may hand a player or judge a different password than the address bar holds
            // (a re-claimed seat), and polls would then be refused. A spectator model has no password.
            const stalePassword = password !== '' &&
              new URLSearchParams(window.location.search).get('password') !== (model as PlayerViewModel | JudgeModel).password;
            if (currentPathname !== path || stalePassword) {
              window.history.replaceState(
                model,
                `${constants.APP_NAME} - Game`,
                `${path}?id=${model.id}${password}`,
              );
            }
          }
          return true;
        })
        .catch((err) => {
          if (err instanceof UnauthorizedError) {
            if (path === paths.JUDGE) {
              alert($t('Incorrect judge password. Reopen the judge page from your browser history, or ask the organizer for the judge link with its password.'));
              return false;
            }
            alert('Incorrect password.\n(If you accidentally closed your player page, check your browser\'s History > Recently Closed tabs.)');
            return false;
          }
          alert('Error getting game data');
          console.error(err);
          return false;
        });
    },
    updatePlayer() {
      return this.update(paths.PLAYER);
    },
    updateSpectator() {
      return this.update(paths.SPECTATOR);
    },
    updateJudge() {
      return this.update(paths.JUDGE);
    },
  },
  mounted() {
    setDocumentTitle();
    if (!windowHasHTMLDialogElement()) {
      dialogPolyfill.registerDialog(document.getElementById('alert-dialog') as HTMLDialogElement);
    }
    const currentPathname = getLastPathSegment();
    const app = this as unknown as MainAppData & {updatePlayer(): void; updateSpectator(): void; updateJudge(): void};
    if (currentPathname === paths.PLAYER) {
      app.updatePlayer();
    } else if (currentPathname === paths.THE_END) {
      const urlParams = new URLSearchParams(window.location.search);
      const id = urlParams.get('id') || '';
      if (isPlayerId(id)) {
        app.updatePlayer();
      } else if (isSpectatorId(id)) {
        app.updateSpectator();
      } else {
        alert('Bad id URL parameter.');
      }
    } else if (currentPathname === paths.REPLAY) {
      const id = new URLSearchParams(window.location.search).get('id') || '';
      if (isPlayerId(id) || isSpectatorId(id) || isJudgeId(id)) {
        app.replayParticipantId = id;
        app.screen = 'replay';
      } else {
        alert('Bad id URL parameter.');
      }
    } else if (currentPathname === paths.GAME) {
      const url = paths.API_GAME + window.location.search;
      fetch(url)
        .then((resp) => {
          if (!resp.ok) {
            throw new Error(`Error getting game data: ${resp.statusText}`);
          }
          return resp.json();
        })
        .then((appGame: SimpleGameModel) => {
          app.screen = 'game-home';
          app.game = appGame;
          window.history.replaceState(
            appGame,
            `${constants.APP_NAME} - Game`,
            `${paths.GAME}?id=${appGame.id}`,
          );
        })
        .catch((err) => {
          alert('Error getting game data');
          console.error(err);
        });
    } else if (currentPathname === paths.GAMES_OVERVIEW) {
      app.screen = 'games-overview';
    } else if (currentPathname === paths.NEW_GAME) {
      app.screen = 'create-game-form';
    } else if (currentPathname === paths.LOAD) {
      app.screen = 'load';
    } else if (currentPathname === paths.CARDS) {
      app.screen = 'cards';
    } else if (currentPathname === paths.HELP) {
      app.screen = 'help';
    } else if (currentPathname === paths.SPECTATOR) {
      app.updateSpectator();
    } else if (currentPathname === paths.JUDGE) {
      app.updateJudge();
    } else if (currentPathname === paths.ADMIN) {
      app.screen = 'admin';
    } else if (currentPathname === paths.LOGIN) {
      app.screen = 'login-home';
    } else {
      app.screen = 'start-screen';
    }
  },
  // A lazy-loaded screen that fails to load lands here. In production builds Vue only logs the
  // error, so it never shows up as an unhandled rejection.
  errorCaptured(err: unknown) {
    reloadForChunkError(err);
  },
});
</script>
