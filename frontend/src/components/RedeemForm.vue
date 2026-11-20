<script setup>
import { ref } from 'vue';
import { api, attemptPath, startQuiz, testApi } from '../client.mjs';

const props = defineProps({ slug: String });
const code = ref('');
const busy = ref(false);
const error = ref('');
async function submit() {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    const redeemed = await api('/redeem', { method: 'POST', body: { code: code.value, slug: props.slug } });
    const state = await api(testApi(redeemed.slug) + '/state');
    if (state.open) location.assign(attemptPath(redeemed.slug, 'quiz', state.open.id));
    else if (state.last) location.assign(attemptPath(redeemed.slug, 'result', state.last.id));
    else await startQuiz(redeemed.slug);
  } catch (failure) {
    error.value = failure.message;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <form class="redeem-form" @submit.prevent="submit">
    <label for="pass-code">订单兑换码</label>
    <input id="pass-code" v-model.trim="code" class="code-input" type="text" placeholder="XXXX-XXXX-XXXX-XXXX" maxlength="40" autocomplete="off" autocapitalize="characters" :spellcheck="false" required aria-describedby="code-help code-error">
    <p id="code-help" class="field-note">粘贴发货消息中的兑换码即可。</p>
    <p id="code-error" role="alert" class="error" v-if="error">{{ error }}</p>
    <button class="button" :disabled="busy">{{ busy ? '正在验证…' : '兑换并进入测验' }}</button>
  </form>
</template>
