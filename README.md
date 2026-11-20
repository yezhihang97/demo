# 万象测验馆

同一个域名下的四个独立中文趣味测验。每项有 30 道原创情境题、四种结果画像，以及各自的兑换页、答题页和结果页。首页是测验目录，发货时可以直接发送对应的主题网址。

| 主题 | 可直接发给买家的页面 | 题数 |
| --- | --- | ---: |
| 历史人物 | `/lishirenwu.html` | 30 |
| 社交动物 | `/shejiaodongwu.html` | 30 |
| 旅行风格 | `/lvxingfengge.html` | 30 |
| 创作灵感 | `/chuangzuolinggan.html` | 30 |

例如，历史人物的答题页为 `/lishirenwu-dati.html?id=…`，结果页为 `/lishirenwu-jieguo.html?id=…`。只有持有对应兑换凭证的浏览器能读取答卷和结果。

## 本地运行

需要 Node.js 22.13 或更高版本，开发和验收使用 Node.js 24。在仓库根目录执行以下命令。

```sh
npm ci
npm run setup
```

首次从 GitHub 克隆时，将项目所有者保存的 `QUIZ_BANK_KEY` 填入根目录的 `.env`。`npm run setup` 会生成随机管理密钥 `MERCHANT_KEY`。这两个密钥分别控制题库解密和兑换码签发。交付时的本地工作区已配置两项。

运行 `npm start`，打开 [本机网站](http://127.0.0.1:4173/)。前端监听 4173，后端监听 8787。第一次启动会构建 Vue 页面，并在 `backend/data/quiz.sqlite` 建立数据库。

## 签发和体验

1. 打开 [本机兑换码管理页](http://127.0.0.1:4173/manage/)，输入 `.env` 中的 `MERCHANT_KEY`。
2. 选定主题，填写已核实付款的订单编号，点击「生成发货信息」。本地验收可以使用自己的测试订单编号。
3. 复制生成的消息。买家打开主题链接，输入消息中的码，然后开始答题。也可从首页的「兑换测验」直接输入。
4. 每选一项，服务器都会保存进度。买家可以回到「我的测验」续答或重看结果。换设备时重新输入原码，访问权会转到新浏览器。

同一订单编号与主题组合始终返回相同的码，重复发货不会产生额外权益。完成后可以重测，已完成的结果保留在原答卷地址。退款后可在管理页停用该订单的码。商品上架、真实收款和平台客服消息由店铺流程处理。

也可在运行 Node 后端的机器上签发。命令会输出该数据库中有效的主题链接和兑换码。

```sh
npm run issue -- history ORDER-001
```

## 前后端开发

| 位置 | 职责 |
| --- | --- |
| `frontend/` | Vue 3 单文件组件、Vite 构建、路由对应的独立 HTML、主题版画及同源 API 代理 |
| `backend/` | Node.js HTTP API、SQLite 持久化、兑换授权、进度和评分 |
| `backend/content/` | 四份 AES-256-GCM 加密的题库，每份包含该主题的题目、选项、评分映射和画像 |
| `shared/links.mjs` | 管理端和前端共用的公开页面地址 |
| `drizzle/` | SQLite 与托管 D1 共用的版本化 SQL 迁移 |

需要热更新时，在两个终端分别运行 `npm run start:backend` 和 `npm run dev -w frontend`，打开 Vite 输出的网址。使用编译后的独立前端服务时，先运行 `npm run build:frontend`，再运行 `npm run start:frontend`。对应产物在 `frontend/dist/`，修改前端后重新构建并重启该前端服务。

### 部署与数据

自托管时，使用 `frontend/dist/` 提供静态文件，将同一域名的 `/api/` 转发到 Node 后端。也可让上游 HTTPS 反向代理直接转发至本项目的前端服务，由前端服务完成 API 转发。把 `PUBLIC_ORIGIN` 设为对外的 HTTPS 源，例如 `https://quiz.example.com`，用于发货链接、同源校验和 Secure Cookie。

`DATABASE_PATH` 可指向持久化数据卷，`BACKEND_PORT` 和 `FRONTEND_PORT` 可调整端口。默认只在本机回环地址监听。容器中可按网络拓扑设置 `BACKEND_HOST`、`FRONTEND_HOST` 与前端的 `API_HOST`。若前端仅供可信反向代理访问，代理覆盖 `X-Real-IP` 后可设 `TRUST_PROXY=1`，使兑换频率限制按买家 IP 计数。

数据库保存订单、兑换码派生密钥、会话摘要、答题记录及结果快照。备份使用 SQLite 在线备份，或在进程关闭后复制数据库。另行保管 `.env` 中的题库密钥，新部署需要用原密钥读取已提交的密文。前端构建只包含页面、图片和公开介绍，已兑换的买家从 API 获取本主题的题干和选项。

项目还包含 Sites 私有预览适配器。`npm run build` 会同时生成 Vue 静态文件与托管 Worker。Worker 产物包含加密题库，运行时从托管 Secret 读取 `QUIZ_BANK_KEY` 与 `MERCHANT_KEY`，使用 D1 保存数据。托管预览和本地服务各自维护订单、兑换码和进度。

### 维护题库

在持有正式密钥的机器上运行 `npm run bank:export`，将题库解密到 Git 忽略的 `backend/content-work/`。编辑对应主题后运行 `npm run bank:pack`。工具校验题号、选项、画像映射，再为变化的主题生成新的随机 IV 并保存密文。保持已发布题号与选项 ID 稳定，可让未完成的答卷接续。每次更新后运行测试和构建，重启对应服务。

### 验证

```sh
npm test
npm run build
```

正式题库测试需要服务端的 `QUIZ_BANK_KEY`。测试覆盖密文校验、独立页面、题库数量和画像可达性、并发签发、主题和订单授权、修改答案、刷新续答、计分、重测、停用，以及重启后的数据恢复。评分按各画像获得的选票数计算。最高票并列时，按原题序取最早被选中的并列画像。

### 后续接入发货工具

已核实付款的可信服务可以向 `POST /api/merchant/orders` 发送带有 `Authorization: Bearer <MERCHANT_KEY>` 的 JSON 请求。请求字段为 `slug`（`history`、`social`、`travel`、`creative`）及 `orderRef`。响应给出 `slug`、`orderRef`、`path` 和 `code`，可将官网域名与 `path` 拼成发货链接。停用使用同样鉴权和字段请求 `POST /api/merchant/revoke`。商家密钥只交给可信服务或管理人员。
