<script setup>
import RedeemForm from '../components/RedeemForm.vue';
import { catalog, cover } from '../catalog.mjs';
</script>

<template>
  <section class="redeem-sheet">
    <div class="art-strip" aria-hidden="true"><img v-for="item in catalog" :key="item.slug" :src="cover(item.slug)" alt="" width="160" height="90"></div>
    <div class="sheet-body">
      <h1>兑换你的测验</h1><p class="lead">每个兑换码对应一项主题测验。</p>
      <RedeemForm />
      <div id="help" class="help">
        <details><summary>在哪里找到兑换码？</summary><p>打开购买后收到的发货消息，复制其中的兑换码。若消息中只有测验链接，请向发货方索取对应的兑换码。</p></details>
        <details><summary>换了设备，还能继续吗？</summary><p>在新浏览器重新输入原码，便可接续已保存的答卷，也可查看上次结果。重新兑换后，答题权限会转到当前浏览器。</p></details>
      </div>
    </div>
  </section>
</template>
