<template>
  <div class="frozen-banner" v-i18n>The judge froze the game. Nobody can act until the judge unfreezes it.</div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';

// Shown above a game page for as long as the judge has the game frozen.
export default defineComponent({
  name: 'FrozenBanner',
});
</script>
