<script setup>
import { computed, onMounted, ref } from 'vue';
import { cover, testPath } from '../catalog.mjs';
import { api, startQuiz, testApi } from '../client.mjs';
import CopyText from '../components/CopyText.vue';

const props = defineProps({ book: { type: Object, required: true } });
const slug = props.book.slug;
const id = new URLSearchParams(location.search).get('id');
const result = ref(null);
const busy = ref(false);
const error = ref('');
const summary = computed(() => result.value ? '万象测验馆 · ' + props.book.name + '\n我的画像是「' + result.value.name + '」。' + result.value.tagline + '\n' + result.value.tags.join(' · ') : '');
async function load() {
  error.value = '';
  if (!id) { error.value = '请从已完成的答卷或「我的测验」打开结果。'; return; }
  try { result.value = (await api(testApi(slug) + '/attempts/' + encodeURIComponent(id) + '/result')).result; }
  catch (failure) { error.value = failure.message; }
}
async function again() {
  busy.value = true;
  error.value = '';
  try { await startQuiz(slug); } catch (failure) { error.value = failure.message; }
  finally { busy.value = false; }
}
onMounted(load);
</script>

<template>
  <div class="reading-width">
    <p class="crumb"><a :href="testPath(slug)">{{ book.name }}</a><span>/</span>测验结果</p>
    <article v-if="result" class="result-sheet">
      <div class="result-head">
        <div><p class="eyebrow"><i></i>你的{{ book.name }}画像</p><h1>{{ result.name }}</h1><p class="lead">{{ result.tagline }}</p></div>
        <img :src="cover(slug)" :alt="book.alt" width="160" height="170">
      </div>
      <div class="result-body">
        <ul class="tags" aria-label="画像关键词"><li v-for="tag in result.tags" :key="tag">{{ tag }}</li></ul>
        <p class="result-description">{{ result.description }}</p>
        <h2>你擅长的事</h2><p>{{ result.strength }}</p>
        <h2>给你的小建议</h2><p>{{ result.tip }}</p>
        <details class="breakdown"><summary>查看选择分布</summary><p class="field-note">每道题对应一种画像。票数相同时，取在前面题目中先被选中的画像。</p>
          <div v-for="row in result.distribution" :key="row.name" class="score-row"><span>{{ row.name }}</span><progress :value="row.count" :max="result.count"></progress><span>{{ row.count }} 票</span></div>
        </details>
        <p class="field-note">本画像根据这次选择生成，仅供娱乐与自我观察。</p>
        <div class="actions"><button class="button" :disabled="busy" @click="again">{{ busy ? '正在准备…' : '再测一次' }}</button><CopyText :text="summary" label="复制结果摘要" /></div>
        <p v-if="error" class="error" role="alert">{{ error }}</p>
      </div>
    </article>
    <section v-else class="empty-panel"><h1>{{ error ? '打开测验结果' : '正在读取结果…' }}</h1><p v-if="error" role="alert">{{ error }}</p><div v-if="error" class="actions">
      <button v-if="id" class="button outline" @click="load">重新加载</button><a class="button" :href="testPath(slug)">前往主题页</a></div></section>
  </div>
</template>
