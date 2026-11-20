<script setup>
import { computed, nextTick, onMounted, ref } from 'vue';
import { testPath } from '../catalog.mjs';
import { api, attemptPath, testApi } from '../client.mjs';

const props = defineProps({ book: { type: Object, required: true } });
const slug = props.book.slug;
const id = new URLSearchParams(location.search).get('id');
const endpoint = testApi(slug) + '/attempts/' + encodeURIComponent(id || '');
const attempt = ref(null);
const index = ref(0);
const saving = ref(false);
const finishing = ref(false);
const error = ref('');
const hint = ref('');
const heading = ref(null);
const question = computed(() => attempt.value?.questions[index.value]);
const answered = computed(() => Object.keys(attempt.value?.answers || {}).length);
const choice = computed(() => attempt.value?.answers[question.value?.id]);

async function load() {
  error.value = '';
  if (!id) { error.value = '请从主题页打开你的答卷。'; return; }
  try {
    const data = await api(endpoint);
    if (data.finished) { location.replace(attemptPath(slug, 'result', id)); return; }
    attempt.value = data;
    const next = data.questions.findIndex(q => !Object.hasOwn(data.answers, q.id));
    index.value = next < 0 ? data.questions.length - 1 : next;
  } catch (failure) { error.value = failure.message; }
}

async function handleFailure(failure) {
  if (failure.status === 409) {
    await load();
    hint.value = '已同步最近保存的进度。';
  } else {
    error.value = failure.message;
    if (failure.status === 403 || failure.status === 404) attempt.value = null;
  }
}

async function select(optionId) {
  if (saving.value || finishing.value || optionId === choice.value) return;
  saving.value = true;
  error.value = '';
  hint.value = '';
  const questionId = question.value.id;
  try {
    const saved = await api(endpoint + '/answers', {
      method: 'PUT', body: { questionId, optionId, revision: attempt.value.revision }
    });
    attempt.value.answers = saved.answers;
    attempt.value.revision = saved.revision;
  } catch (failure) { await handleFailure(failure); }
  finally { saving.value = false; }
}

async function move(step) {
  index.value += step;
  error.value = '';
  hint.value = '';
  await nextTick();
  heading.value?.focus({ preventScroll: true });
}

async function next() {
  if (!choice.value || saving.value || finishing.value) return;
  if (index.value < attempt.value.questions.length - 1) { await move(1); return; }
  finishing.value = true;
  error.value = '';
  try {
    await api(endpoint + '/finish', { method: 'POST', body: { revision: attempt.value.revision } });
    location.assign(attemptPath(slug, 'result', id));
  } catch (failure) { await handleFailure(failure); }
  finally { finishing.value = false; }
}
onMounted(load);
</script>

<template>
  <div class="reading-width">
    <p class="crumb"><a :href="testPath(slug)">{{ book.name }}</a><span>/</span>答题中</p>
    <section v-if="question" class="quiz-sheet">
      <div class="quiz-meta"><span>{{ book.name }}</span><span>第 <b>{{ index + 1 }}</b> 题 / 共 {{ attempt.questions.length }} 题</span></div>
      <div class="progress-track" aria-label="已保存题数" role="progressbar" :aria-valuenow="answered" :aria-valuemax="attempt.questions.length" aria-valuemin="0">
        <i v-for="(q, i) in attempt.questions" :key="q.id" :class="{ filled: attempt.answers[q.id], current: i === index }"></i>
      </div>
      <h1 id="question" ref="heading" class="question" tabindex="-1">{{ question.prompt }}</h1>
      <fieldset class="options" aria-labelledby="question" :disabled="saving || finishing">
        <label v-for="option in question.options" :key="question.id + option.id" class="option" :class="{ chosen: choice === option.id }">
          <input type="radio" name="answer" :value="option.id" :checked="choice === option.id" @click.prevent="select(option.id)" @change="select(option.id)">
          <span class="option-key" aria-hidden="true">{{ option.id.toUpperCase() }}</span><span>{{ option.text }}</span>
        </label>
      </fieldset>
      <p class="save-status" role="status">{{ saving ? '正在保存选择…' : hint || ('已保存 ' + answered + ' / ' + attempt.questions.length + ' 题') }}</p>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <div class="quiz-actions">
        <button class="button outline" :disabled="index === 0 || saving || finishing" @click="move(-1)">上一题</button>
        <button class="button" :disabled="!choice || saving || finishing" @click="next">{{ finishing ? '正在生成结果…' : index === attempt.questions.length - 1 ? '查看结果' : '下一题' }}</button>
      </div>
    </section>
    <section v-else class="empty-panel"><h1>{{ error ? '打开答卷' : '正在读取答卷…' }}</h1><p v-if="error" role="alert">{{ error }}</p>
      <div v-if="error" class="actions"><button v-if="id" class="button outline" @click="load">重新加载</button><a class="button" :href="testPath(slug)">前往主题页</a></div>
    </section>
  </div>
</template>
