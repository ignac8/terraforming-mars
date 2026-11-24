<template>
  <div class="report-problems-banner">
    <span v-i18n>In case of any problems, report them here:</span> <a :href="ISSUES_URL" target="_blank" v-i18n>GitHub issues</a>
  </div>
</template>

<script setup lang="ts">
const ISSUES_URL = 'https://github.com/ignac8/terraforming-mars/issues';
</script>
