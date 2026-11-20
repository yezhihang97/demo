<script setup>
import { nextTick, ref } from 'vue';
const props = defineProps({ text: { type: String, required: true }, label: { type: String, required: true } });
const status = ref('');
const fallback = ref(false);
const field = ref(null);
async function copy() {
  try {
    await navigator.clipboard.writeText(props.text);
    status.value = '已复制';
    fallback.value = false;
  } catch {
    fallback.value = true;
    status.value = '请选择并复制下面的文字。';
    await nextTick();
    field.value?.select();
  }
}
</script>

<template>
  <div class="copy-action"><button type="button" class="button outline" @click="copy">{{ label }}</button>
    <span v-if="status" role="status" class="field-note">{{ status }}</span>
    <textarea v-if="fallback" ref="field" :aria-label="label" readonly :value="text" rows="4"></textarea>
  </div>
</template>
