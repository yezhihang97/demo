<script setup>
import { computed, onMounted, ref } from 'vue';
import { catalog, cover, testPath } from '../catalog.mjs';
import { api, attemptPath } from '../client.mjs';
const entries = ref(null);
const error = ref('');
const books = computed(() => catalog.filter(item => entries.value?.[item.slug]));
async function load() {
  error.value = '';
  try { entries.value = (await api('/library')).entries; }
  catch (failure) { error.value = failure.message; }
}
onMounted(load);
</script>

<template>
  <section class="library">
    <h1>我的测验</h1><p class="lead">继续上次的答题，或重看已完成的画像。</p>
    <p v-if="error" class="error" role="alert">{{ error }} <button class="text-link" @click="load">重新加载</button></p>
    <p v-else-if="!entries" class="field-note" role="status">正在读取…</p>
    <div v-else-if="!books.length" class="empty-panel"><i class="ticket-icon large-ticket" aria-hidden="true"></i><h2>还没有已兑换的测验</h2>
      <p>输入订单中的兑换码。换过浏览器，也可以用原码找回答卷。</p><a class="button" href="/redeem/">兑换测验</a></div>
    <div v-else class="library-list">
      <article v-for="item in books" :key="item.slug" class="library-item">
        <img :src="cover(item.slug)" :alt="item.alt" width="180" height="135">
        <div><h2>{{ item.name }}</h2>
          <p>{{ entries[item.slug].open ? '已答 ' + entries[item.slug].open.answered + ' / ' + item.count + ' 题' : entries[item.slug].last ? '上次画像 · ' + entries[item.slug].last.name : '已兑换，等待开始' }}</p>
          <div class="actions">
            <a v-if="entries[item.slug].open" class="text-link" :href="attemptPath(item.slug, 'quiz', entries[item.slug].open.id)">继续答题</a>
            <a v-if="entries[item.slug].last" class="text-link" :href="attemptPath(item.slug, 'result', entries[item.slug].last.id)">查看结果</a>
            <a class="text-link" :href="testPath(item.slug)">主题页</a>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>
