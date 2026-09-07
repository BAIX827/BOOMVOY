# BOOMVOY 工作交接文档（给下一个 AI / 开发者）

> 生成日期：2026-09-07  
> 目的：上一轮 Cursor Agent 额度用尽，本文档完整说明已完成工作、架构、怎么跑、已知坑、建议下一步，方便无缝续作。  
> 产品口号：`Plan less. Decide better.`

---

## 1. 项目一句话

**BOOMVOY** 是一个**纯前端旅行手账 Web App**：把「想去哪 → 收藏比价 → 决定 → 规划行程（晴/雨双方案）→ 外链订票 → 天气 Plan B → 打卡 → 行李 → AA 分账 → 分享海报」集中在一次旅行里管理。

- **不是**后端 SaaS；数据在浏览器 `localStorage`。
- **先做网页**，App 是后续阶段（见 PRD）。
- 视觉定位：旅行手账 / journal，不是普通 dashboard。

---

## 2. 仓库与部署状态

| 项 | 值 |
| --- | --- |
| 本地路径 | `/Users/baricy/Library/Mobile Documents/com~apple~CloudDocs/BOOMVOY`（iCloud Drive） |
| Git 远程 | `https://github.com/BAIX827/BOOMVOY.git` |
| 分支 | `main`，与 `origin/main` 同步 |
| 最新提交 | `78fc2cb` — *Add outbound and return packing lists with weather tips.*（2026-09-03） |
| 部署 | GitHub Actions → GitHub Pages（`.github/workflows/pages.yml`） |
| Pages base | 构建时 `GITHUB_PAGES_BASE=/${{ github.event.repository.name }}/` → 线上路径一般为 `https://baix827.github.io/BOOMVOY/` |
| 未跟踪文件 | `boomi.md`（全功能测试视频脚本）、本文件 `HANDOFF.md`（若刚创建） |

### Git 账号注意（历史坑）

- 仓库 owner 是 **BAIX827**。
- 本机曾用 **BaricyX** 登录导致 `403 Permission denied`。
- 用户要求双账号共存；续作 push 前先确认 `gh auth status` / credential 对应有写权限的账号。
- 用户偏好：改完代码后给 **git 命令**；需要时再帮 push（用户明确说过「帮我push到git上」）。

---

## 3. 怎么跑起来

```bash
cd "/Users/baricy/Library/Mobile Documents/com~apple~CloudDocs/BOOMVOY"
npm install
cp .env.example .env.local   # 若还没有
# 编辑 .env.local，填入 VITE_OPENAI_API_KEY（仅本地开发）
npm run dev                  # http://localhost:5173
npm run build                # tsc + vite build
```

### 环境变量（`.env.example`）

```
VITE_OPENAI_API_URL=https://api.openai.com/v1/chat/completions
VITE_OPENAI_API_KEY=
VITE_OPENAI_MODEL=gpt-4o-mini
```

要点：

- API Key **只在 DEV** 从 `import.meta.env.VITE_OPENAI_API_KEY` 读取（见 `src/llm.ts`），**不会打进生产包**。
- 生产环境可在「我 / Profile」里手动填 `llmKey`（会进 localStorage，注意安全）。
- `.env*` 已在 `.gitignore`；**绝不要 commit key**。
- 用户曾在聊天里粘贴过完整 OpenAI key → **建议轮换（rotate）该 key**，旧 key 可能已泄露。

### Vite 代理

`vite.config.ts` 把 `/openai` 代理到 `https://api.openai.com`，便于本地 CORS；LLM URL 也可直接写 OpenAI 完整地址。

---

## 4. 技术栈

- React 19 + TypeScript + Vite 7
- Tailwind CSS v4（`@tailwindcss/vite`）
- React Router 7
- Zustand + `persist` → `localStorage` key：`boomvoy-v1`
- Leaflet / react-leaflet（地图）
- `@dnd-kit/*`（行程拖拽排序）
- lucide-react（图标）
- 无后端、无数据库、无 auth

---

## 5. 产品需求来源

主 PRD：`Travel Planning App 产品需求蓝图.md`

核心流程：

> 想去哪里 → 收藏 → 比较纠结 → 做决定 → 规划路线 → 预订 → 旅行执行 → AA结算 → 分享

导航结构已基本对齐 PRD：Overview / Plan / Map / Saved / Compare / Bookings / Budget / Expenses / Weather / Group / Notes，并额外做了 Journal（打卡）、Pack（行李）、Share、Explore、Boomi 导游猫。

演示脚本（拍视频用）：根目录 `boomi.md`（内容是「全功能测试视频脚本」，文件名是 Boomi）。

---

## 6. 目录地图（改代码从这里进）

```
src/
  App.tsx          # 路由总表 + 全局 Locale/Theme + GuideCat
  Shell.tsx        # 站外：首页/发现/新建/我
  TripShell.tsx    # 站内：某趟旅行侧栏/底栏
  store.ts         # Zustand 全部状态与 CRUD
  types.ts         # 领域类型
  data.ts          # 示例行程 Japan / Ocean Road / Bali（很大）
  i18n.ts          # 中英文文案（很大，改文案必改这里）
  index.css        # 主题变量、手账视觉、主题装饰
  pages/*          # 各页面
  GuideCat.tsx     # Boomi 浮动助手：引导 + 对话
  DaySuggest.tsx   # 「推荐行程」按钮与预览应用
  BookingSearch.tsx# 登机牌式机票/酒店搜索外链
  TripMap.tsx      # Leaflet 地图组件
  suggestions.ts   # 本地推荐包 + OpenAI 生成
  geo.ts           # 地理编码 / 路线 / Google Maps / 票务链接
  weather.ts       # Open-Meteo 天气拉取与写入 trip.days
  bookingLinks.ts  # Skyscanner / Booking 等 deep link
  packing.ts       # 行李种子、天气衣物建议、航班托运提示
  boomiChat.ts     # 无 API 时的关键词路由问答
  llm.ts           # resolveLlm + askBoomi
  domain.ts / lib.ts / catalog.ts / ui.tsx
public/            # favicon, apple-touch-icon
src/assets/        # boomi.png, boomi_icon.png（透明底）
```

---

## 7. 路由表

| 路径 | 页面 |
| --- | --- |
| `/` | Home 旅行列表 |
| `/explore` | 发现/模板 |
| `/new` | 四步创建旅行 |
| `/profile` | 语言/货币/主题/LLM/恢复示例 |
| `/trip/:id` | Overview |
| `/trip/:id/plan` | 行程（核心） |
| `/trip/:id/map` | 路线图 |
| `/trip/:id/journal` | 打卡回顾 |
| `/trip/:id/pack` | 行李清单 |
| `/trip/:id/saved` | 收藏 |
| `/trip/:id/compare` | 决策对比 |
| `/trip/:id/bookings` | 预订中心 |
| `/trip/:id/budget` | 预算 |
| `/trip/:id/expenses` | AA 支出 |
| `/trip/:id/weather` | 天气 + Plan B |
| `/trip/:id/group` | 同伴 |
| `/trip/:id/notes` | 笔记/设置 |
| `/share/:id` | 分享海报（可无壳） |

全局：`GuideCat` 挂在 `App` 外层，所有页可见。

---

## 8. 已完成功能清单（按时间线 / commit）

按 `git log` 从早到晚：

1. **发布站点骨架** — Vite React SPA + Pages workflow  
2. **重命名产品为 BOOMVOY**  
3. **导游猫 Boom/Boomi 新手引导** — 首次访问气泡 + 分步高亮 `data-guide`  
4. **预订外链** — Skyscanner / Google Flights / Booking / Klook 等 deep link（`bookingLinks.ts` + `BookingSearch.tsx`）  
5. **OpenAI 日行程建议** — 本地 env 接 key，失败回退本地包  
6. **旅行手账视觉 + 登机牌式预订 + 一键日建议**  
7. **天气按旅行日期拉取** + 生成计划带地图/路线/票务链接  
8. **中英文 UI** + Boomi 素材 + 主题装饰（cream / ocean / forest 边框元素）  
9. **Boomi PNG** — 先用白底，后换成透明底 `boomi.png` / `boomi_icon.png`  
10. **智能行程增强** — geocode、站间路线、打卡、已订票、社媒 buzz 字段、已在某日的去重标注  
11. **推荐改为手动按钮「推荐行程」** — 打开某天不再自动打 API  
12. **Boomi 可对话** — 关键词匹配 + 有 key 时 OpenAI 短答；删掉一批说明性废话文案（中英同步）  
13. **行李清单 Pack** — 去程/回程、分类/箱包、默认必备、按天气/天数衣物建议、航班托运小提示卡片  

示例数据：Profile「恢复示例数据」→ Japan 2026（Melbourne → Tokyo → Fuji → Kyoto → Osaka）等。

---

## 9. 关键实现细节（下一个 AI 必读）

### 9.1 状态

- `useApp`（`store.ts`）persist 到 `localStorage['boomvoy-v1']`。
- 新手引导已看过：`localStorage['boomvoy-met-boom'] = '1'`。  
  要重看引导：Profile 有入口，或手动清该 key。
- 默认 locale：`zh`。

### 9.2 Plan A / Plan B

- 每天 `planA` / `planB` + `activePlan`。
- 天气页可建议切到雨天方案；这是差异化卖点。

### 9.3 「推荐行程」

- UI：`DaySuggest.tsx`，**必须点按钮才生成**（用户明确要求）。
- 逻辑：`suggestions.ts` → `suggestDays()`  
  - 有 LLM key → OpenAI JSON 建议（prompt 要求偏向小红书/IG/Google 常推，**不编造坐标**）  
  - 然后 `enrichStops()`（`geo.ts`）用 Photon → Nominatim 补坐标/地址，并猜站间交通  
  - 无 key / 失败 → 本地 `PACKS`（tokyo/kyoto/osaka/fuji/bali/ocean…）  
- 已在行程中的地点：按名称小写匹配，标「已在 xx 日期」，加入时可过滤。

### 9.4 地理与地图

- 瓦片：OpenStreetMap  
- 地理编码：Photon（komoot）+ Nominatim 兜底  
- 驾驶/步行/骑行路线：公共 OSRM（见 `geo.ts` 后半）  
- 公交：跳 Google Maps transit 链接（无付费 Directions key）  
- **不要假设有 Mapbox/Google Maps API key**

### 9.5 天气

- `weather.ts`：按 trip 日期拉预报（Open-Meteo 一类免费源），写入 `day.weather`。  
- 需网络；演示脚本提醒天气页要联网。

### 9.6 Boomi

- `GuideCat.tsx`：浮动宠物、引导遮罩（`data-guide` 选择器）、聊天面板。  
- `boomiChat.ts`：无 key 时关键词 → 路由/文案。  
- `askBoomi()`：有 key 时短答，system prompt 限定只讲真实功能。

### 9.7 i18n

- 几乎所有可见字符串在 `i18n.ts`。  
- **改 UI 文案必须中英同步**（用户反复强调）。  
- 用户反感说明性废话，例如「切换后立刻生效…」「主按钮直接打开比价…」——已删一批，**不要再加回来**。

### 9.8 主题

- `cream` / `ocean` / `forest`：不只要换色，还要有装饰元素（海浪贝壳、森林等），在 CSS / 布局里。  
- Profile `themePref`；`auto` 实际落到 cream。

### 9.9 行李 Pack

- `packing.ts` + `pages/Pack.tsx`  
- 去程 / 回程两套勾选状态（`packedOut` / `packedBack`）  
- 分类：docs/money/keys/tech/clothes/…  
- 箱包：suitcase / carryon / personal  
- 天气衣物种子：`clothingSeeds(trip)`  
- 坐飞机时显示可展开托运提示：`FLIGHT_TIPS`

### 9.10 预订模型

- 第一版策略：**外链跳转官网比价下单 → 回来手动登记状态**（need → booked → paid）。  
- 不是嵌入式预订引擎。

---

## 10. 用户明确提过、但实现上仍是「近似 / 有边界」的点

| 用户期望 | 现状 | 续作注意 |
| --- | --- | --- |
| 推荐结合小红书/IG 真实热度 | Prompt 要求模型「偏好常被提到的点」+ `socialBuzz` 字段；**没有**真爬小红书/IG API | 真数据需另接数据源或人工策展 |
| API 生成自带坐标 | LLM **禁止编造坐标**；由 `enrichStops` geocode；偶发漏点/错点 | 可加强缓存、或本地白名单坐标 |
| 永久免费网址 | GitHub Pages 已配；自定义域名曾报错（`boomvoy` 格式非法，需完整域名） | 自定义域名要用 `boomvoy.com` 这类 |
| 原生 App | 未做；仍是 Web | 可考虑 PWA / Capacitor 等后续 |

---

## 11. 设计与文案偏好（用户已定调）

- 品牌名 **BOOMVOY** 要强存在感；口号 `Plan less. Decide better.`
- 手账 / polaroid / 登机牌感，不要无聊后台风。
- 删掉「探索世界，快乐爆炸！」一类旧文案。
- Boomi 形象：透明底全身图 + 图标（`src/assets/`）。
- 中文默认；设置可切 English。
- 少废话、少解释性旁白。

前端设计若大改，另遵守用户 Cursor 规则里的 composition / brand / 反 AI 套版约束。

---

## 12. 本地演示 checklist

1. `npm run dev`  
2. 我 → 恢复示例数据（Japan 2026）  
3. 可选：清 `boomvoy-met-boom` 重看引导  
4. 行程页点「推荐行程」（不要假设自动生成）  
5. 天气页刷新需网络  
6. 行李页看去程/回程 + 天气建议  
7. 问 Boomi：「怎么打卡」「推荐行程」  

完整口播脚本见 `boomi.md`。

---

## 13. 建议的下一步（优先级供参考）

按产品完整度，尚未做或可加强的方向：

1. **PWA / 移动端体验**（底栏、离线、加到主屏）——用户最初说网页后做 App。  
2. **分享链接真实可协作**：现在 Share 偏海报预览；多人真实同步需要后端。  
3. **地理编码稳定性**：失败重试、手动钉坐标、批量预缓存日本示例点。  
4. **行李**：按「行李箱 A / 随身包」更强推荐逻辑、导出清单、打印。  
5. **预订捕获**：从外链回来更快记一笔（模板/剪贴板）。  
6. **把 `boomi.md` / `HANDOFF.md` 决定是否入库**（当前可能未 commit）。  
7. **安全**：rotate 已泄露的 OpenAI key；生产勿把 key 放 Profile persist（或加密/仅会话）。  
8. **测试**：目前无自动测试；至少补关键路径 smoke（创建旅行、推荐、切 Plan B、Pack）。

---

## 14. 给下一个 AI 的开工指令模板

可直接复制：

```
你在维护 BOOMVOY：React+Vite+TS 旅行手账 SPA，仓库 BAIX827/BOOMVOY，本地在 iCloud BOOMVOY 文件夹。
先读 HANDOFF.md、产品需求蓝图.md、src/App.tsx、src/store.ts、src/types.ts。
数据在 localStorage boomvoy-v1；无后端。
改文案必须中英同步改 i18n.ts；不要加说明性废话。
「推荐行程」必须手动点击（DaySuggest），不要改回自动生成。
地图/地理用 OSM+Photon+Nominatim+OSRM，不要假设付费 Maps key。
OpenAI key 只在 .env.local（dev）或 Profile；勿 commit。
用户常用中文沟通；改完可给 git 命令，未经要求不要擅自 commit/push。
当前任务：<在此填写>
```

---

## 15. 相关历史对话（Cursor）

- [Webpage development request](4a0b0a43-2050-481a-9c8e-9e7cfff72851) — 主开发长线（从蓝图到行李清单）  
- [Testing video script](897e3b80-e337-4283-ba85-35ece1f60e4b) — 产出 `boomi.md` 测试脚本  

---

## 16. 一句话现状结论

**功能面已覆盖 PRD 主路径的 Web 版 MVP+（含 Boomi、双语、主题装饰、智能推荐+地理、天气 Plan B、打卡、行李），已部署 GitHub Pages；未做真实后端协作与原生 App；本地仅有 `boomi.md`（及本交接文档）可能尚未进 git。续作请先对齐本文件再改代码。**
