<script setup>
import { useRoute } from 'vue-router'
import MainLayout from './layouts/MainLayout.vue'

const route = useRoute()
</script>

<template>
  <MainLayout v-if="route.path !== '/login'" />
  <router-view v-else />
</template>

