<template>
  <div id="rewind-banners" ref="stack" class="rewind-banners"><FrozenBanner v-if="frozen" /></div>
  <div class="rewind-banners-spacer" :style="{height: height + 'px'}"></div>
</template>

<script lang="ts">
import {defineComponent, markRaw} from 'vue';
import FrozenBanner from '@/client/components/replay/FrozenBanner.vue';

type DataModel = {
  /** How tall the banners are right now. */
  height: number;
  observer: ResizeObserver | undefined;
}

// The fixed stack that the frozen banner and the rewind vote banner (which teleports into it) sit in, and the spacer
// in the page's flow that keeps the page from sliding under them.
export default defineComponent({
  name: 'BannerStack',
  components: {FrozenBanner},
  props: {
    frozen: {
      type: Boolean,
      required: true,
    },
  },
  data(): DataModel {
    return {height: 0, observer: undefined};
  },
  methods: {
    resize(entries: ReadonlyArray<Pick<ResizeObserverEntry, 'contentRect'>>): void {
      this.height = Math.ceil(entries[entries.length - 1].contentRect.height);
    },
  },
  mounted() {
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    this.observer = markRaw(new ResizeObserver((entries) => this.resize(entries)));
    this.observer.observe(this.$refs.stack as Element);
  },
  unmounted() {
    this.observer?.disconnect();
  },
});
</script>
