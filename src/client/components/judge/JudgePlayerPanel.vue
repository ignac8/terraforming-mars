<template>
  <div class="judge-player-panel">
    <div class="hiding-card-button-row judge-player-panel-header">
      <DynamicTitle :title="player.name" :color="player.color"/>
      <AppButton class="judge-player-panel-toggle" size="small" :disableOnServerBusy="false" :title="hidden ? 'Show' : 'Hide'" @click="toggle"/>
    </div>

    <template v-if="!hidden">
      <div v-for="section in visibleSections" :key="section.title" class="player_home_block player_home_block--hand">
        <h3 class="judge-player-panel-section" v-i18n>{{ section.title }}</h3>
        <div v-for="card in section.cards" :key="card.name" class="cardbox">
          <Card :card="card"/>
        </div>
      </div>

      <!-- Only when it holds cards the judge sees nowhere else, like a draft hand. -->
      <div v-if="privates.waitingFor !== undefined && hasUnseenPendingCards" class="player_home_block nofloat">
        <h3 class="judge-player-panel-section" v-i18n>Pending choice</h3>
        <JudgePendingChoice :input="privates.waitingFor" :shown="shownCards"/>
      </div>
    </template>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import AppButton from '@/client/components/common/AppButton.vue';
import Card from '@/client/components/card/Card.vue';
import DynamicTitle from '@/client/components/common/DynamicTitle.vue';
import JudgePendingChoice from '@/client/components/judge/JudgePendingChoice.vue';
import {isPanelHidden, setPanelHidden} from '@/client/utils/judgePanelStorage';
import {unseenPendingCards} from '@/client/utils/unseenPendingCards';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {JudgePlayerModel} from '@/common/models/JudgeModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {JudgeId} from '@/common/Types';

// A setup section only matters while the player picks a corporation and starting cards.
type Section = {title: string, cards: ReadonlyArray<CardModel>, setup?: boolean};

// Everything one player holds that the table can't see, for a judge. Read-only.
// The judge can hide a player's block down to the name row, and the page remembers that per judge link.
export default defineComponent({
  name: 'JudgePlayerPanel',
  components: {AppButton, Card, DynamicTitle, JudgePendingChoice},
  props: {
    judgeId: {
      type: String as () => JudgeId,
      required: true,
    },
    privates: {
      type: Object as () => JudgePlayerModel,
      required: true,
    },
    player: {
      type: Object as () => PublicPlayerModel,
      required: true,
    },
  },
  data() {
    return {
      hidden: isPanelHidden(this.judgeId, this.player.color),
    };
  },
  methods: {
    toggle(): void {
      this.hidden = !this.hidden;
      setPanelHidden(this.judgeId, this.player.color, this.hidden);
    },
  },
  computed: {
    visibleSections(): Array<Section> {
      const p = this.privates;
      const sections: Array<Section> = [
        {title: 'Cards In Hand', cards: p.cardsInHand},
        {title: 'Drafted cards', cards: p.draftedCards},
        {title: 'Dealt corporations', cards: p.dealtCorporationCards, setup: true},
        {title: 'Dealt preludes', cards: p.dealtPreludeCards, setup: true},
        {title: 'Dealt CEOs', cards: p.dealtCeoCards, setup: true},
        {title: 'Dealt project cards', cards: p.dealtProjectCards, setup: true},
        {title: 'Picked corporation', cards: p.pickedCorporationCard, setup: true},
        {title: 'Preludes in hand', cards: p.preludeCardsInHand},
        {title: 'CEOs in hand', cards: p.ceoCardsInHand},
      ];
      // The server keeps the dealt cards all game. Like the player page, show them only until something is in play.
      const inSetup = this.player.tableau.length === 0;
      return sections.filter((section) => section.cards.length > 0 && (inSetup || section.setup !== true));
    },
    /** The cards above and on the table, which the pending choice leaves out. */
    shownCards(): Array<CardName> {
      return [...this.visibleSections.flatMap((section) => section.cards), ...this.player.tableau].map((card) => card.name);
    },
    hasUnseenPendingCards(): boolean {
      const waitingFor = this.privates.waitingFor;
      return waitingFor !== undefined && unseenPendingCards(waitingFor, this.shownCards).length > 0;
    },
  },
});
</script>

<style scoped lang="less">
.judge-player-panel-header {
  align-items: baseline;
  gap: 12px;
}
</style>
