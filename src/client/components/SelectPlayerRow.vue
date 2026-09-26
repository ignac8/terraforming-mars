<template>
  <span>{{playerName}}</span>
</template>

<script lang="ts">

import {defineComponent} from 'vue';
import {PublicPlayerModel} from '@/common/models/PlayerModel';

export default defineComponent({
  name: 'SelectPlayerRow',
  props: {
    // Undefined for MarsBot, which is not in the player list; fallbackName names it instead.
    player: {
      type: Object as () => PublicPlayerModel | undefined,
      required: false,
      default: undefined,
    },
    fallbackName: {
      type: String,
      default: '',
    },
  },
  computed: {
    playerName(): string {
      return this.player?.name ?? this.fallbackName;
    },
  },
});

</script>
