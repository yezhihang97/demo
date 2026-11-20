<script setup>
import { computed, ref, watch } from 'vue';
import { catalog } from '../catalog.mjs';
import { api } from '../client.mjs';
import CopyText from '../components/CopyText.vue';

const key = ref('');
const slug = ref(catalog[0].slug);
const orderRef = ref('');
const issued = ref(null);
const error = ref('');
const notice = ref('');
const busy = ref(false);
const delivery = computed(() => {
  if (!issued.value) return '';
  const pass = issued.value;
  const name = catalog.find(book => book.slug === pass.slug).name;
  return '万象测验馆 · ' + name + '\n测验链接 ' + new URL(pass.path, location.origin).href + '\n兑换码 ' + pass.code + '\n打开链接并输入兑换码，即可答题。请保留兑换码以便续答或重测。';
});
watch([slug, orderRef, key], () => { issued.value = null; error.value = ''; notice.value = ''; });
async function submit(revoke = false) {
  if (busy.value) return;
  if (revoke && !window.confirm('确定停用本主题下订单「' + orderRef.value + '」的兑换码？已打开的答卷也会失去访问权限。')) return;
  busy.value = true;
  issued.value = null;
  error.value = '';
  notice.value = '';
  try {
    const data = await api('/merchant/' + (revoke ? 'revoke' : 'orders'), {
      method: 'POST', token: key.value.trim(), body: { slug: slug.value, orderRef: orderRef.value.trim() }
    });
    if (revoke) notice.value = '该订单的兑换码已停用。';
    else issued.value = data;
  } catch (failure) { error.value = failure.message; }
  finally { busy.value = false; }
}
</script>

<template>
  <section class="merchant-sheet">
    <h1>兑换码管理</h1><p class="lead">核对已付款订单后签发。相同订单与主题可重复提取同一份发货信息。</p>
    <form class="manage-form" @submit.prevent="submit()">
      <fieldset :disabled="busy">
        <label for="merchant-token">管理密钥</label><input id="merchant-token" type="password" v-model="key" autocomplete="off" required>
        <label for="merchant-theme">测验主题</label><div class="select-wrap"><select id="merchant-theme" v-model="slug"><option v-for="book in catalog" :key="book.slug" :value="book.slug">{{ book.name }}</option></select></div>
        <label for="order-ref">订单编号</label><input id="order-ref" v-model="orderRef" maxlength="80" autocomplete="off" required>
        <div class="actions"><button class="button">{{ busy ? '正在处理…' : '生成发货信息' }}</button>
          <button type="button" class="text-link" :disabled="!key || !orderRef" @click="submit(true)">停用此订单的码</button></div>
      </fieldset>
    </form>
    <p v-if="error" role="alert" class="error">{{ error }}</p><p v-if="notice" role="status">{{ notice }}</p>
    <div v-if="issued" class="delivery"><h2>发给买家的消息</h2><pre>{{ delivery }}</pre><CopyText :text="delivery" label="复制发货信息" /></div>
  </section>
</template>
