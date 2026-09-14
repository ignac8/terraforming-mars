<template>
  <div class="wf-component wf-component--select-option">
    <div v-if="showtitle === true" class="wf-component-title">{{ $t(playerinput.title) }}</div>
    <WarningsComponent :warnings="playerinput.warnings"/>
    <ConfirmDialog
      v-if="confirmsPass"
      message="Pass for this generation? You will not take any more actions this generation."
      ref="confirmation"
      @accept="save" />
    <AppButton v-if="showsave === true" size="big" @click="saveData" :title="$t(playerinput.buttonLabel)" />
  </div>
</template>

<script lang="ts">

import {defineComponent} from 'vue';
import AppButton from '@/client/components/common/AppButton.vue';
import ConfirmDialog from '@/client/components/common/ConfirmDialog.vue';
import {SelectOptionModel} from '@/common/models/PlayerInputModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {SelectOptionResponse} from '@/common/inputs/InputResponse';
import {getPreferences} from '@/client/utils/PreferencesManager';
import WarningsComponent from './WarningsComponent.vue';

type Refs = {
  confirmation: InstanceType<typeof ConfirmDialog>,
};

export default defineComponent({
  name: 'SelectOption',
  props: {
    playerView: {
      type: Object as () => PlayerViewModel,
      required: true,
    },
    playerinput: {
      type: Object as () => SelectOptionModel,
      required: true,
    },
    onsave: {
      type: Function as unknown as () => (out: SelectOptionResponse) => void,
      required: true,
    },
    showsave: {
      type: Boolean,
    },
    showtitle: {
      type: Boolean,
    },
  },
  components: {
    AppButton,
    ConfirmDialog,
    WarningsComponent,
  },
  computed: {
    typedRefs(): Refs {
      return this.$refs as unknown as Refs;
    },
    // Passing ends the player's generation, so it is the one option that asks before saving.
    confirmsPass(): boolean {
      return this.playerinput.warnings?.includes('pass') === true;
    },
  },
  methods: {
    saveData() {
      if (this.confirmsPass && getPreferences().show_alerts) {
        this.typedRefs.confirmation.show();
      } else {
        this.save();
      }
    },
    save() {
      this.onsave({type: 'option'});
    },
  },
});

</script>
