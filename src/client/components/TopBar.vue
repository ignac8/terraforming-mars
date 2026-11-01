<template>
  <div class="top-bar-container">
    <div class="top-bar" :class="{'top-bar-collapsed': !isExpanded}">
      <!-- The bar hides the player's name, so say whose resources these are when they aren't the viewer's. -->
      <div v-show="isExpanded" v-if="player !== undefined" class="top-bar-player-name" :class="'player_bg_color_' + player.color">{{ player.name }}</div>
      <PlayerInfo v-show="isExpanded" v-if="shownPlayer !== undefined" :player="shownPlayer" :playerView="playerView" :actionLabel="''" :playerIndex="shownPlayerIndex" :hideZeroTags="true" :isTopBar="true" />
      <div class="top-bar-collapser" @click="toggleBar()">
        <img src="assets/arrows_left.png">
      </div>
    </div>
    <TerraformedBanner v-if="ownView !== undefined && ownView.game.isTerraformed" :playerId="ownView.id" />
  </div>
</template>

<script lang="ts">

import {defineComponent} from 'vue';
import {PlayerViewModel, PublicPlayerModel, ViewModel} from '@/common/models/PlayerModel';
import PlayerInfo from '@/client/components/overview/PlayerInfo.vue';
import TerraformedBanner from '@/client/components/TerraformedBanner.vue';
import {getPreferences, PreferencesManager} from '@/client/utils/PreferencesManager';

export default defineComponent({
  name: 'TopBar',
  props: {
    playerView: {
      type: Object as () => ViewModel,
      required: true,
    },
    /** The player to show, when it isn't the viewer: the active player on the spectator and judge pages. */
    player: {
      type: Object as () => PublicPlayerModel,
      required: false,
    },
  },
  components: {
    PlayerInfo,
    TerraformedBanner,
  },
  methods: {
    toggleBar() {
      PreferencesManager.INSTANCE.set('hide_top_bar', this.isExpanded);
    },
  },
  computed: {
    shownPlayer(): PublicPlayerModel | undefined {
      return this.player ?? this.playerView.thisPlayer;
    },
    /** Where PlayersOverview lists the shown player, so clicking its name opens that player's cards. */
    shownPlayerIndex(): number {
      const player = this.player;
      return player === undefined ? 0 : this.playerView.players.findIndex((p) => p.color === player.color);
    },
    /** Only PlayerHome leaves `player` out, and it passes the player's own view. */
    ownView(): PlayerViewModel | undefined {
      return this.player === undefined ? this.playerView as PlayerViewModel : undefined;
    },
    isExpanded(): boolean {
      return !getPreferences().hide_top_bar;
    },
  },
});
</script>

