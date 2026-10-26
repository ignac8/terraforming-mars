<template>
  <div class="replay-hands">
    <div v-for="player in players" :key="player.color" class="replay-hands-player">
      <div class="hiding-card-button-row replay-hands-header">
        <DynamicTitle :title="player.name" :color="player.color"/>
        <AppButton class="replay-hands-toggle" size="small" :disableOnServerBusy="false" :title="isHidden(player.color) ? 'Show' : 'Hide'" @click="toggle(player.color)"/>
      </div>
      <template v-if="!isHidden(player.color)">
        <div v-for="section in sectionsOf(player)" :key="section.title" class="player_home_block player_home_block--hand">
          <h3 class="replay-hands-section" v-i18n>{{ section.title }}</h3>
          <div v-for="card in section.cards" :key="card.name" class="cardbox">
            <Card :card="card"/>
          </div>
        </div>
        <JudgePendingChoice :choice="choiceOf(player)" :shown="shownOf(player)" headingClass="replay-hands-section"/>
      </template>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import AppButton from '@/client/components/common/AppButton.vue';
import Card from '@/client/components/card/Card.vue';
import DynamicTitle from '@/client/components/common/DynamicTitle.vue';
import {Color} from '@/common/Color';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {ReplayPrivates} from '@/common/replay/ReplayModel';
import {ParticipantId} from '@/common/Types';
import {isPanelHidden, setPanelHidden} from '@/client/utils/panelHiddenStorage';
import {privateCardSections, PrivateCardSection} from '@/client/utils/privateCardSections';
import {shownCardNames} from '@/client/utils/unseenPendingCards';
import JudgePendingChoice from '@/client/components/judge/JudgePendingChoice.vue';
import {CardName} from '@/common/cards/CardName';
import {PendingChoiceModel} from '@/common/models/PendingChoiceModel';

// Everything each player holds that the table can't see, and the cards they were choosing among. Read-only.
// A player's block can be hidden down to the name row, and the screen remembers that per participant link.
export default defineComponent({
  name: 'ReplayHands',
  components: {AppButton, Card, DynamicTitle, JudgePendingChoice},
  props: {
    participantId: {
      type: String as () => ParticipantId,
      required: true,
    },
    privates: {
      type: Array as () => Array<ReplayPrivates>,
      required: true,
    },
    players: {
      type: Array as () => Array<PublicPlayerModel>,
      required: true,
    },
  },
  data() {
    return {
      // What was toggled on this screen. The rest comes from storage.
      toggled: {} as Partial<Record<Color, boolean>>,
    };
  },
  methods: {
    isHidden(color: Color): boolean {
      return this.toggled[color] ?? isPanelHidden(this.participantId, color);
    },
    toggle(color: Color): void {
      const hidden = !this.isHidden(color);
      this.toggled[color] = hidden;
      setPanelHidden(this.participantId, color, hidden);
    },
    sectionsOf(player: PublicPlayerModel): Array<PrivateCardSection> {
      // Privates are in generation order, not seating order, so they pair with players by color.
      const p = this.privatesByColor.get(player.color);
      if (p === undefined) {
        return [];
      }
      // The tableau is the player's at the moment shown, so the dealt cards go once something is in play.
      return privateCardSections(p, player.tableau.length);
    },
    choiceOf(player: PublicPlayerModel): PendingChoiceModel | undefined {
      return this.privatesByColor.get(player.color)?.pendingChoice;
    },
    shownOf(player: PublicPlayerModel): Array<CardName> {
      const p = this.privatesByColor.get(player.color);
      return p === undefined ? [] : shownCardNames(p, player.tableau);
    },
  },
  computed: {
    privatesByColor(): Map<Color, ReplayPrivates> {
      return new Map(this.privates.map((p) => [p.color, p]));
    },
  },
});
</script>
