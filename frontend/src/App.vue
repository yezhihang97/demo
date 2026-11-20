<script setup>
import { defineAsyncComponent } from 'vue';
import HomePage from './pages/HomePage.vue';
import { resolvePage } from './catalog.mjs';

const route = resolvePage(location.pathname);
const pages = {
  home: HomePage,
  detail: defineAsyncComponent(() => import('./pages/DetailPage.vue')),
  redeem: defineAsyncComponent(() => import('./pages/RedeemPage.vue')),
  quiz: defineAsyncComponent(() => import('./pages/QuizPage.vue')),
  result: defineAsyncComponent(() => import('./pages/ResultPage.vue')),
  library: defineAsyncComponent(() => import('./pages/LibraryPage.vue')),
  manage: defineAsyncComponent(() => import('./pages/ManagePage.vue'))
};
</script>

<template>
  <a class="skip" href="#main">跳到主要内容</a>
  <header class="masthead">
    <div class="frame masthead-inner">
      <a class="brand" href="/" aria-label="万象测验馆首页"><span class="seal" aria-hidden="true">万</span>万象测验馆</a>
      <nav aria-label="主导航">
        <a class="nav-link nav-catalog" href="/#catalog" :aria-current="route.page === 'home' ? 'page' : undefined">测验目录</a>
        <a class="nav-link" href="/library/" :aria-current="route.page === 'library' ? 'page' : undefined">我的测验</a>
        <a class="redeem-link" href="/redeem/" :aria-current="route.page === 'redeem' ? 'page' : undefined"><i class="ticket-icon" aria-hidden="true"></i>兑换测验</a>
      </nav>
    </div>
  </header>
  <main id="main" class="frame" :data-theme="route.book?.slug">
    <component v-if="pages[route.page]" :is="pages[route.page]" v-bind="route.book ? { book: route.book } : {}" />
    <section v-else class="empty-panel"><h1>找不到这个页面</h1><a class="button" href="/">回到测验目录</a></section>
  </main>
  <footer class="frame footer"><span>万象测验馆</span><a href="/redeem/#help">兑换说明</a></footer>
</template>
