<template>
  <div class="replay-hands">
    <div v-for="player in players" :key="player.color" class="replay-hands-player">
      <DynamicTitle :title="player.name" :color="player.color"/>
      <div v-for="section in sectionsOf(player)" :key="section.title" class="player_home_block player_home_block--hand">
        <h3 class="replay-hands-section" v-i18n>{{ section.title }}</h3>
        <div v-for="card in section.cards" :key="card.name" class="cardbox">
          <Card :card="card"/>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import Card from '@/client/components/card/Card.vue';
import DynamicTitle from '@/client/components/common/DynamicTitle.vue';
import {Color} from '@/common/Color';
import {CardModel} from '@/common/models/CardModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {ReplayPrivates} from '@/common/replay/ReplayModel';

type Section = {title: string, cards: ReadonlyArray<CardModel>};

// Everything each player holds that the table can't see. Read-only.
export default defineComponent({
  name: 'ReplayHands',
  components: {Card, DynamicTitle},
  props: {
    privates: {
      type: Array as () => Array<ReplayPrivates>,
      required: true,
    },
    players: {
      type: Array as () => Array<PublicPlayerModel>,
      required: true,
    },
  },
  methods: {
    sectionsOf(player: PublicPlayerModel): Array<Section> {
      // Privates are in generation order, not seating order, so they pair with players by color.
      const p = this.privatesByColor.get(player.color);
      if (p === undefined) {
        return [];
      }
      const sections: Array<Section> = [
        {title: 'Cards In Hand', cards: p.cardsInHand},
        {title: 'Drafted cards', cards: p.draftedCards},
        {title: 'Dealt corporations', cards: p.dealtCorporationCards},
        {title: 'Dealt preludes', cards: p.dealtPreludeCards},
        {title: 'Dealt CEOs', cards: p.dealtCeoCards},
        {title: 'Dealt project cards', cards: p.dealtProjectCards},
        {title: 'Picked corporation', cards: p.pickedCorporationCard},
        {title: 'Preludes in hand', cards: p.preludeCardsInHand},
        {title: 'CEOs in hand', cards: p.ceoCardsInHand},
      ];
      return sections.filter((section) => section.cards.length > 0);
    },
  },
  computed: {
    privatesByColor(): Map<Color, ReplayPrivates> {
      return new Map(this.privates.map((p) => [p.color, p]));
    },
  },
});
</script>
