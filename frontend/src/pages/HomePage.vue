<script setup>
import { computed, ref } from 'vue';
import { catalog, cover, testPath } from '../catalog.mjs';

const featured = catalog[0];
const group = ref('全部主题');
const groups = ['全部主题', ...new Set(catalog.map(item => item.group))];
const shown = computed(() => catalog.filter(item => group.value === '全部主题' || item.group === group.value));
</script>

<template>
  <section class="feature">
    <img class="feature-art" :src="cover(featured.slug)" :alt="featured.alt" fetchpriority="high" width="1200" height="900">
    <div class="feature-copy">
      <p class="eyebrow"><i></i>本期精选<span class="kicker-divider"></span>人文性格</p>
      <h1>你最像哪位<br><em>历史人物？</em></h1>
      <p class="feature-intro">在相聚、独处和抉择之间，看看你与哪位古人最合拍。</p>
      <div class="feature-actions"><a class="button dark" :href="testPath('history')">探索这项测验</a><span class="meta"><i class="clock-icon"></i>{{ featured.count }} 道题 · 约 {{ featured.minutes }} 分钟</span></div>
    </div>
  </section>
  <section id="catalog" class="collection">
    <div class="section-heading"><h2>测验目录</h2><label class="select-wrap"><span class="sr-only">筛选主题</span><select v-model="group"><option v-for="item in groups" :key="item">{{ item }}</option></select></label></div>
    <div class="catalog-grid">
      <a v-for="item in shown" :key="item.slug" class="catalog-card" :href="testPath(item.slug)" :data-theme="item.slug">
        <div class="cover-window"><img :src="cover(item.slug)" :alt="item.alt" width="768" height="576"></div>
        <div class="card-heading"><h3>{{ item.name }}</h3><span>{{ item.count }} 道题</span></div>
        <p>{{ item.intro }}</p>
      </a>
    </div>
  </section>
</template>
