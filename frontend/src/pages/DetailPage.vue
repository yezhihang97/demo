<script setup>
import { onMounted, ref } from 'vue';
import { cover } from '../catalog.mjs';
import { api, attemptPath, startQuiz, testApi } from '../client.mjs';
import RedeemForm from '../components/RedeemForm.vue';

const props = defineProps({ book: { type: Object, required: true } });
const state = ref(null);
const busy = ref(false);
const error = ref('');
async function load() {
  error.value = '';
  try { state.value = await api(testApi(props.book.slug) + '/state'); }
  catch (failure) { error.value = failure.message; }
}
async function begin() {
  busy.value = true;
  error.value = '';
  try { await startQuiz(props.book.slug); }
  catch (failure) { error.value = failure.message; }
  finally { busy.value = false; }
}
onMounted(load);
</script>

<template>
  <p class="crumb"><a href="/#catalog">测验目录</a><span>/</span>{{ book.name }}</p>
  <article class="detail-layout">
    <div class="detail-print"><img :src="cover(book.slug)" :alt="book.alt" width="768" height="576"><div class="print-caption">{{ book.name }}<span>{{ book.group }}</span></div></div>
    <div class="detail-copy">
      <p class="eyebrow"><i></i>{{ book.group }}</p><h1>{{ book.title }}</h1><p class="lead">{{ book.detail }}</p>
      <dl class="specs"><div><dt>题量</dt><dd>{{ book.count }} 道</dd></div><div><dt>预计用时</dt><dd>{{ book.minutes }} 分钟</dd></div><div><dt>结果画像</dt><dd>4 种</dd></div></dl>
      <div v-if="state?.unlocked">
        <p class="field-note">已解锁本主题，可随时续答或重测。</p>
        <div class="actions">
          <a v-if="state.open" class="button" :href="attemptPath(book.slug, 'quiz', state.open.id)">继续答题 · 已答 {{ state.open.answered }} 题</a>
          <button v-else class="button" :disabled="busy" @click="begin">{{ state.last ? '再测一次' : '开始答题' }}</button>
          <a v-if="state.last" class="text-link" :href="attemptPath(book.slug, 'result', state.last.id)">查看上次结果</a>
        </div>
      </div>
      <RedeemForm v-else-if="state" :slug="book.slug" />
      <p v-else-if="!error" class="field-note" role="status">正在读取兑换状态…</p>
      <p v-if="error" role="alert" class="error">{{ error }} <button v-if="!state" class="text-link" @click="load">重新加载</button></p>
    </div>
  </article>
</template>
