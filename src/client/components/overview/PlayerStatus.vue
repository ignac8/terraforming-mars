<template>
  <div class="player-status">
    <div class="player-status-bottom">
      <div :class="getLabelAndTimerClasses()">
        <div :class="getActionStatusClasses()"><span v-i18n>{{ actionLabel }}</span></div>
        <div class="player-status-timer" :class="{'player-status-timer--remaining': allowanceMs !== undefined}" v-if="showTimer">
          <PlayerTimer :timer="timer" :live="liveTimer" />
          <div v-if="allowanceMs !== undefined" class="player-status-remaining" :title="$t('Time left before the Escape Velocity penalty')">
            <span class="player-status-remaining-icon">&#x23F3;</span>
            <PlayerTimer :timer="timer" :live="liveTimer" :allowanceMs="allowanceMs" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">

import {defineComponent} from 'vue';
import {ActionLabel} from '@/client/components/overview/ActionLabel';
import PlayerTimer from '@/client/components/overview/PlayerTimer.vue';
import {TimerModel} from '@/common/models/TimerModel';

export default defineComponent({
  name: 'PlayerStatus',
  props: {
    timer: {
      type: Object as () => TimerModel,
      required: true,
    },
    actionLabel: {
      type: String as () => ActionLabel,
      required: true,
    },
    showTimer: {
      type: Boolean,
    },
    liveTimer: {
      type: Boolean,
    },
    /** Milliseconds the player may use before the Escape Velocity penalty starts, undefined in a game without it. */
    allowanceMs: {
      type: Number,
      default: undefined,
    },
  },
  components: {
    PlayerTimer,
  },
  methods: {
    getLabelAndTimerClasses(): string {
      const classes = [];
      const baseClass = 'player-action-status-container';
      classes.push(baseClass);
      if (!this.showTimer) {
        classes.push('no-timer');
      }
      if (this.actionLabel === 'passed') {
        classes.push(`${baseClass}--passed`);
      } else if (this.actionLabel === 'active' || this.actionLabel === 'drafting' || this.actionLabel === 'researching') {
        classes.push(`${baseClass}--active`);
      }
      return classes.join(' ');
    },
    getActionStatusClasses(): string {
      const classes: Array<string> = ['player-action-status'];
      if (this.actionLabel === 'none') {
        classes.push('visibility-hidden');
      }
      return classes.join(' ');
    },
  },
});

</script>

