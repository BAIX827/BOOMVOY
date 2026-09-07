# BOOMVOY 工作交接文档（给下一个 AI / 开发者）

> 更新日期：2026-09-07（智能决策已在远端，界面、主题与智能行李优化待推送）
>
> 目的：记录当前代码、历轮修改、运行方式、验证结果与待办，供后续开发接手。版本状态以本次本地核对为准，线上发布状态需另查。
> 产品口号：`Plan less. Decide better.`

---

## 1. 项目一句话

**BOOMVOY** 是一个**本地优先的旅行手账 Web App**：把「想去哪 → 收藏比价 → 酒店/餐厅智能决策 → 规划行程（晴/雨双方案）→ 外链订票 → 天气 Plan B → 打卡 → 行李 → AA 分账 → 分享海报」集中在一次旅行里管理。

- 旅行数据保存在浏览器 `localStorage`；已增加可选 Node 查询服务，用于 Google Places 实时商家信息。
- **先做网页**，App 是后续阶段（见 PRD）。
- 视觉定位：旅行手账 / journal。

---

## 2. 仓库与部署状态

| 项 | 值 |
| --- | --- |
| 当前工作区 | `C:\Users\64969\Desktop\BOOMVOY` |
| Git 远程 | `https://github.com/BAIX827/BOOMVOY.git` |
| 分支 | `main`；远端基线 `origin/main` 为 `b44d8a1`，本地另有 1 个优化提交待推送 |
| 包版本 | `package.json` 仍为 `0.1.0`，尚未递增版本号 |
| 远端最新提交 | `b44d8a1` — `update`（2026-09-07）：酒店/餐厅智能决策与可选查询服务 |
| 前一轮提交 | `64b89ce` — `update`（2026-09-07）：行程推荐优化 |
| 部署 | 已配置 GitHub Actions → GitHub Pages（`.github/workflows/pages.yml`）；本轮未检查线上构建，也未部署本地优化 |
| Pages base | 构建时 `GITHUB_PAGES_BASE=/${{ github.event.repository.name }}/` → 线上路径一般为 `https://baix827.github.io/BOOMVOY/` |
| 当前工作区 | 智能决策已在远端；界面与示例精简、主题装饰和按天数智能行李优化已完成，待推送 |
| 文档入库 | `boomi.md` 与 `HANDOFF.md` 已入库并随功能同步维护 |

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
npm test                     # 核心、行程推荐、决策与接口回归测试
npm run build                # tsc --noEmit + vite build
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

`vite.config.ts` 把 `/openai` 代理到 `https://api.openai.com`；新增 `/api/decisions` → `http://127.0.0.1:8787`。代理只在 Vite 开发服务器运行时有效。

### 可选实时决策服务

完整步骤与安全说明见 [DECISION_SETUP.md](DECISION_SETUP.md)。本地精选候选可直接使用；真实评分查询需要配置服务端 Google key。

1. 在 Google Cloud 启用 Places API (New)、账单和配额限制。
2. 自行创建 `.env.server`，填写 `GOOGLE_PLACES_API_KEY`（服务端专用，勿加 `VITE_` 前缀，勿提交或贴到聊天）。
3. 使用 Node.js 22.9+，另开终端运行 `npm run decision:server`，默认监听 `127.0.0.1:8787`；前端运行 `npm run dev`。
4. 「决策」页主动查询。独立部署时，在 Profile 设置可信的完整 HTTPS 接口地址，路径为 `/api/decisions/search`。

当前未配置或验证真实付费调用。Google Places 服务只负责商家查询；预订、付款由用户在外部平台完成。GitHub Pages 仅托管静态前端，生产查询服务需要另行部署。

---

## 4. 技术栈

- React 19 + TypeScript + Vite 7
- Tailwind CSS v4（`@tailwindcss/vite`）
- React Router 7
- Zustand + `persist` → `localStorage` key：`boomvoy-v1`
- Leaflet / react-leaflet（地图）
- `@dnd-kit/*`（行程拖拽排序）
- lucide-react（图标）
- 可选 Node 原生 HTTP 查询后端：`server/decision-server.mjs`，无新增运行依赖
- 尚无旅行数据数据库、登录认证或多人实时同步

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
  data.ts          # 完整示例 Japan + 自驾模板 Ocean Road（很大）
  i18n.ts          # 中英文文案（很大，改文案必改这里）
  index.css        # 主题变量、手账视觉、主题装饰
  pages/*          # 各页面
  GuideCat.tsx     # Boomi 浮动助手：引导 + 对话
  ThemeDecor.tsx   # 三套主题的图标氛围层与主题预览图标
  DaySuggest.tsx   # 「推荐行程」按钮与预览应用
  BookingSearch.tsx# 登机牌式机票/酒店搜索外链
  TripMap.tsx      # Leaflet 地图组件
  suggestions.ts   # 本地推荐包 + OpenAI 生成
  recommendation.ts # 时间预算、交通估算、节奏与地点别名去重
  recommendationApplication.ts # 追加/替换、行程版本检查、记录保护与撤销
  DecisionAssistant.tsx # 酒店/餐厅自然语言筛选与每日用餐安排
  decision.ts      # 需求解析、匹配排序、链接、菜系轮换
  decisionTypes.ts # 偏好、候选、评分与用餐选择类型
  decisionCatalog.ts # 10 个官网核对候选，无虚构实时评分/报价
  decisionClient.ts # 查询服务客户端：字段验证、超时、取消
  decisionSelection.ts # 收藏/比较/用餐/预订的一次性状态更新
  decisionI18n.ts  # 智能决策中英文文案，合并进 i18n.ts
  geo.ts           # 地理编码 / 路线 / Google Maps / 票务链接
  weather.ts       # Open-Meteo 天气拉取与写入 trip.days
  bookingLinks.ts  # Skyscanner / Booking 等 deep link
  packing.ts       # 行李种子、天气衣物建议、航班托运提示
  boomiChat.ts     # 无 API 时的关键词路由问答
  llm.ts           # resolveLlm + askBoomi
  domain.ts / lib.ts / catalog.ts / ui.tsx
public/            # favicon, apple-touch-icon
src/assets/        # boomi.png, boomi_icon.png（透明底）
server/decision-server.mjs # 可选 Google Places 查询服务
tests/             # 核心、行程推荐及智能决策回归测试
scripts/run-tests.mjs # npm test 入口
DECISION_SETUP.md   # 本地接入、生产部署边界与 Google 数据政策
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
14. **基础功能完善（`588d6f0`）** — 创建旅行的日期/城市天数分配与输入校验；行程地点编辑；自建比较板与预订衔接；预订编辑和支出关联；预算按预订/实际支出汇总；AA 自定义分摊、手动汇率与编辑；JSON 备份恢复；移动端更多导航、路由懒加载、天气状态及核心回归测试。
15. **行程推荐优化（`64b89ce`）** — 节奏、起止时间、交通和室内偏好；区域化本地路线；跨语言去重；时间/交通预算；请求取消与错误回退；逐项选择、追加/替换、旅行记录保护、版本冲突检查及撤销。详见 9.3。
16. **酒店/餐厅智能决策（`b44d8a1`）** — 自然语言预算/海景/停车/菜系需求、评分门槛、来源与预订链接、每日菜系轮换、选定后跨模块联动；可选 Google Places 服务与相关测试。详见第 18 节。
17. **界面与示例精简** — 移除 Bali 半成品模板和单候选对比板；创建入口统一为「创建旅行」；删除多页重复说明文案。
18. **主题与行李增强** — Cream / Ocean / Forest 加入独立旅行图标氛围层；衣物按逐日温度和旅行天数配量，长途按一周换洗上限。

示例数据：Profile「恢复示例数据」→ Japan 2026（Melbourne → Tokyo → Fuji → Kyoto → Osaka）+ Great Ocean Road 自驾模板。

---

## 9. 关键实现细节（下一个 AI 必读）

### 9.1 状态

- `useApp`（`store.ts`）persist 到 `localStorage['boomvoy-v1']`。
- persist 版本为 2；迁移会从既有浏览器数据移除内置 Bali 模板与 Japan 示例中的单候选对比板，不碰用户自己创建的旅行。
- 新手引导已看过：`localStorage['boomvoy-met-boom'] = '1'`。  
  要重看引导：Profile 有入口，或手动清该 key。
- 默认 locale：`zh`。

### 9.2 Plan A / Plan B

- 每天 `planA` / `planB` + `activePlan`。
- 天气页可建议切到雨天方案；这是差异化卖点。

### 9.3 「推荐行程」

- UI：`DaySuggest.tsx`，**必须点按钮才生成**（用户明确要求）。
- 逻辑：`suggestions.ts` → `suggestDays()`，返回候选、`local/api` 来源与错误状态。无 key、超时、失败或空结果时回退本地路线；未覆盖城市显示缺少候选。
- 可调节奏（轻松/均衡/充实）、开始/结束时间、交通、仅室内。`scheduleSuggestion()` 计入游览时长、交通和缓冲，剔除超出时间窗口的点；交通为估算，仍需核对实时路线和营业时间。
- 本地 `PACKS` 按城市与区域组织；Bali 可聚合 Canggu/Ubud。雨天判断只采用真实预报来源，室内筛选严格过滤。
- LLM 生成 2–3 条地理集中的路线，要求真实具体地点；禁止虚构坐标、社媒热度、实时评分、营业状态及库存。模型输出有结构/链接检查、25 秒请求超时和取消；地理补充请求有超时边界。
- `recommendation.ts` 用明确中英文别名与坐标距离判定重复，避免只做小写字符串比较。预览显示跨日期已安排地点，支持逐项选择。
- 可追加到当前方案或替换；追加从末站衔接。`recommendationApplication.ts` 与 store 一次性应用，指纹校验阻止旧预览覆盖新修改；已预订/打卡/照片/感受记录受保护。撤销也需当前状态与应用结果一致。
- `geo.ts` 继续承担通用地图与路线功能，推荐流程的具体超时/筛选逻辑应查看 `suggestions.ts`。

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

- 通用可见字符串在 `i18n.ts`，智能决策文案在 `decisionI18n.ts` 并合并导出。
- **改 UI 文案必须中英同步**（用户反复强调）。  
- 用户反感说明性废话，例如「切换后立刻生效…」「主按钮直接打开比价…」——已删一批，**不要再加回来**。

### 9.8 主题

- `cream` / `ocean` / `forest`：不只换色；`ThemeDecor.tsx` 提供各自的旅行图标氛围层，CSS 继续负责纹理、边缘与纸张装饰。
- Profile `themePref`；`auto` 实际落到 cream。

### 9.9 行李 Pack

- `packing.ts` + `pages/Pack.tsx`  
- 去程 / 回程两套勾选状态（`packedOut` / `packedBack`）  
- 分类：docs/money/keys/tech/clothes/…  
- 箱包：suitcase / carryon / personal  
- 智能衣物种子：`clothingSeeds(trip)` 按旅行天数、逐日冷暖与降雨配量；3 天暖天最多 3 件短袖，8 天以上按一周换洗量封顶
- 手动刷新：`applyPackingSuggestions(trip, packing)`；用户手调数量仍保留
- 坐飞机时显示可展开托运提示：`FLIGHT_TIPS`

### 9.10 预订模型

- 第一版策略：**外链跳转官网比价下单 → 回来手动登记状态**（need → booked → paid）。  
- 酒店新增 `checkout`，预订页展示并编辑入住/退房日期；智能决策保存时固定日期，后续调整搜索偏好不会改掉旧预订。
- 预订支持成本/手动汇率、编辑、关联支出；`sourceSavedId` 用于收藏来源关联及防重复。预算的已订金额来自预订记录，实付来自支出记录。

---

## 10. 用户明确提过、但实现上仍是「近似 / 有边界」的点

| 用户期望 | 现状 | 续作注意 |
| --- | --- | --- |
| 推荐结合小红书/IG 真实热度 | 历史 `socialBuzz` 字段仍可能存在；当前行程生成明确禁止虚构热度，尚未接入社媒数据源 | 真数据需另接数据源或人工策展 |
| API 生成自带坐标 | LLM 禁止编造坐标；本地候选坐标与受控地理查询补充，仍可能缺失或误匹配 | 可加强地理核验及手动修正 |
| 实时高分酒店/餐厅 | 已实现可选 Google Places 查询，默认评分门槛 4.3/5、评价数 100；当前仅模拟接口联调 | 需要真实服务端 key、账单、配额和生产保护 |
| 预算内海景房且可订 | 可解析条件并提供官网/平台链接；具体房型、日期房价、库存保留待确认 | 需要有授权的房型与库存数据源才能自动核实 |
| 每天吃不同菜系 | 按行程日期/城市轮换，保留已选；当前每天保存一条用餐选择 | 三餐分别安排、复杂饮食禁忌尚待扩展 |
| 永久免费网址 | GitHub Pages 已配；自定义域名曾报错（`boomvoy` 格式非法，需完整域名） | 自定义域名要用 `boomvoy.com` 这类 |
| 原生 App | 未做；仍是 Web | 可考虑 PWA / Capacitor 等后续 |

### 10.1 外部 API 现状与建议顺序

- 当前已接：OpenAI 兼容接口（可选行程建议）、Open-Meteo（天气）、Photon + Nominatim（地理编码）、OSRM（路线）；机票/酒店/活动以 deep link 外跳。
- 下一阶段第一优先：地点/餐厅/商店详情与搜索 + 统一的后端代理。若保留 Leaflet/OSM，优先评估 Foursquare Places 或其他允许搭配第三方地图的授权；若要 Google Places 的评分/照片，应一起评估切到 Google 地图并遵守展示、归因和缓存限制。
- 第二优先：机票与酒店库存（Duffel / Amadeus / Booking.com Demand 选一套主供应商，不要同时接很多套）。
- 第三优先：活动门票（Viator / GetYourGuide 等合作方）和汇率。
- 小红书 / Instagram 不应依赖爬虫；优先做用户粘贴分享链接、浏览器分享进入 BOOMVOY、人工策展来源和可追溯引用。
- 真实库存、预订、用户同步和第三方密钥都要求后端；不可继续只靠 GitHub Pages + `localStorage`。

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
6. 行李页看去程/回程 + 天数/逐日天气智能配量
7. 问 Boomi：「怎么打卡」「推荐行程」「三天带几件短袖」
8. 行程推荐修改节奏/时间/交通 → 预览勾选 → 追加或替换 → 检查记录保护与撤销。
9. 决策输入「每晚 AUD 300 以内、海景房、免费停车」或「想吃墨西哥菜、人均 AUD 50、每天不同菜系」→ 识别需求 → 核对字段 → 查找推荐。
10. 检查待确认标签、评分来源和官网/预订链接；选定后核对收藏、比较板、用餐安排和预订日期。
11. Profile 导出 JSON 备份。恢复示例或导入文件会改变现有旅行数据，演示应使用独立浏览器数据环境。

完整口播脚本见 `boomi.md`。

---

## 13. 建议的下一步（优先级供参考）

按产品完整度，尚未做或可加强的方向：

1. **实时决策上线准备**：配置真实 Places 服务并小范围联调；公开接口补认证、用户级配额、消费保护、TLS、监控和隐私/条款，详见 `DECISION_SETUP.md`。
2. **PWA / 移动端体验**：底栏与更多入口已完善；离线、安装到主屏及原生封装仍待做。
3. **分享链接真实可协作**：现在 Share 偏海报预览；多人真实同步需要数据后端与权限。
4. **地理编码稳定性**：手动钉坐标、城市归属核验、常用点维护。
5. **决策与发现页覆盖**：扩充有来源的真实内容和策展城市、区分早午晚餐、接入有授权的房型/价格/库存来源。
6. **预订捕获与行李**：外链回来快捷登记；更细的箱包级规则、清单导出/打印。
7. **安全与数据恢复**：轮换历史泄露的 OpenAI key；Profile key 仍在 localStorage；JSON 导入当前仅有浅层校验，需补完整 schema、迁移与覆盖确认。
8. **测试**：已有核心、推荐、行李、智能决策与接口回归测试；继续补真实数据联调和浏览器端到端 smoke（创建旅行、切 Plan B、Pack）。

---

## 14. 固定协作规则

1. 每次实际改动后同步更新本 `HANDOFF.md`。
2. 保持代码干净整洁，删除失效示例、无用文案和未使用代码。
3. 每次更新完成后，给用户一组可直接复制执行的 Git 提交与推送命令；未经明确要求不要代为 commit / push。
4. 每次更新后同步检查 Boomi：`GuideCat.tsx`、`boomiChat.ts`、`i18n.ts` 和 `boomi.md`，只修改受影响内容。

---

## 15. 给下一个 AI 的开工指令模板

可直接复制：

```
你在维护 BOOMVOY：React+Vite+TS 旅行手账 SPA，仓库 BAIX827/BOOMVOY，当前工作区 C:\Users\64969\Desktop\BOOMVOY。
先读 HANDOFF.md、产品需求蓝图.md、src/App.tsx、src/store.ts、src/types.ts。
数据在 localStorage boomvoy-v1；可选 Node 查询服务在 server/decision-server.mjs，接入见 DECISION_SETUP.md。
改文案必须中英同步；通用文案在 i18n.ts，决策文案在 decisionI18n.ts。
「推荐行程」必须手动点击（DaySuggest），不要改回自动生成。
地图/地理用 OSM+Photon+Nominatim+OSRM，不要假设付费 Maps key。
OpenAI key 只在 .env.local（dev）或 Profile；勿 commit。
Google Places key 只在服务端 GOOGLE_PLACES_API_KEY；实时数据保持来源归属，未知价格/房型/评分明确标注。
先检查 git status，保留未提交工作；智能决策已在 b44d8a1 合入 main。
改后运行 npm test 与 npm run build；不要把模拟接口通过写成真实付费 API 已验证。
用户常用中文沟通；每次改动同步更新 HANDOFF.md 与受影响的 Boomi 内容，并给可直接复制的 git 提交/推送命令；未经要求不要擅自 commit/push。
当前任务：<在此填写>
```

---

## 16. 相关历史对话（Cursor）

- [Webpage development request](4a0b0a43-2050-481a-9c8e-9e7cfff72851) — 主开发长线（从蓝图到行李清单）  
- [Testing video script](897e3b80-e337-4283-ba85-35ece1f60e4b) — 产出 `boomi.md` 测试脚本  

---

## 17. 一句话现状结论

**当前为 `0.1.0` 本地优先 Web MVP：酒店/餐厅智能决策与可选 Google Places 查询服务已在 `b44d8a1` 合入远端；界面与示例精简、三套主题装饰和按天数智能行李优化已在本地完成，待推送。实时 Google 数据仍需配置和联调；旅行数据保存在本机浏览器，多人同步、登录、原生 App 待做。**

---

## 18. 智能决策实现与文件清单（`b44d8a1`）

### 18.1 用户流程与边界

- 入口为 `/trip/:id/compare`，智能助手位于原有比较板上方。中英文自然语言规则解析将预算、币种、酒店/餐厅、海景房、停车/免费停车、菜系和每日换菜等转为可编辑字段；用户核对后主动查找。
- 筛选包含城市/地区、入住/退房、人数、每房每晚或每人每餐预算、包含/排除菜系、最低评分和评价数。当前解析采用规则引擎，复杂自由表达仍需手动核对字段。
- `rankDecisions()` 排除已知硬冲突；未知条件保留待确认且不计为已满足。匹配度与有来源的 5 分制口碑分开展示；未知条件存在时匹配度最高 69%。评分结合评价数量，酒店星级不参与口碑评分。
- 参考价必须有可比较币种，当前不自动换汇。Google 酒店结果的具体夜价/海景房型保留未知；营业状态只说明持续经营，到店时段仍需核实。
- 卡片提供来源、Google Maps、官网和预订入口；Booking.com 搜索携带日期/人数/币种。官网/预订链接只引导查询，选定只创建待预订记录。
- `planMeals()` 根据旅行日期/城市轮换菜系，保留已选日期，优先避免重复餐厅/菜系；点击某日将条件带入查询。每日期最多保存一个用餐选择，更换前先移除旧选择。
- `saveDecision()` 一次性更新收藏、按城市划分的比较板、用餐选择与预订提醒；防重复点击，保留手写备注、投票、已订状态。删除收藏同步清理用餐选择和比较板引用。
- 候选去重优先采用同城同名的实时记录；有明确不同地址的商家保持独立。城市/地区别名支持层级判断，具体城镇筛选保持严格。
- Google 候选仅会话展示供应商内容，保存时要求用户填写自定义标签；长期保存 place ID、用户标签/偏好和引用链接，评分、价格、地址及官网等供应商内容不写入持久缓存。
- 页面支持取消、超时、错误回退和过期结果隔离；切换旅行/语言/接口时重置查询上下文。

### 18.2 本地来源

`decisionCatalog.ts` 收录 10 个官网核对候选，核对日期 2026-09-07：Tokyo 的 Hacienda del cielo、el caliente、NABUCCO、Sushi Gonpachi、Hilton Tokyo Odaiba；Melbourne 的 Mamasita、DOC Osteria；Canggu 的 Motel Mexicola、Holiday Inn Resort Bali Canggu、COMO Uma Canggu。

策展记录附官网证据和预订入口，不填虚构评分或即时价格。Holiday Inn 有海景房型及免费停车来源；COMO 的海景房型有来源、停车待确认；Hilton 为东京湾景房与收费停车。实际可用房型、日期与价格仍以预订页面为准。候选覆盖有限，其他城市可使用搜索入口或启用实时服务。

### 18.3 服务端与安全

- `POST /api/decisions/search` → 固定 Google Places API (New) Text Search 上游，key 只在服务端环境变量读取。
- 16 KB 请求上限、10 秒上游超时、Origin/Host 限制、直连 IP 每分钟 30 次基础限流、通用错误响应、`Cache-Control: no-store`。客户端 12 秒超时、最多 20 个候选，并再次检查字段及链接。
- 仅接受营业中商家；城市/地区与明确输入国家按地址组件核验，缺少归属证据的记录被过滤。停车只从停车场/车库字段判断，菜系只从返回 place types 推导。
- 当前绑定 loopback，适合本地或同机反向代理。公开部署仍需认证、用户级配额和消费保护；CORS 仅是浏览器来源控制。
- 保留 Google Maps 标识、第三方 attribution、来源与查询时间；公开上线前核对 Google 使用政策及应用隐私/条款。

### 18.4 文件变更

新增：

```text
DECISION_SETUP.md
server/decision-server.mjs
src/DecisionAssistant.tsx
src/decision.ts
src/decisionTypes.ts
src/decisionCatalog.ts
src/decisionClient.ts
src/decisionSelection.ts
src/decisionI18n.ts
tests/decision.test.ts
tests/decision-selection.test.ts
tests/decision-provider.test.mjs
```

修改：

```text
.env.example                 # 服务端变量说明
package.json                 # decision:server 脚本；版本仍为 0.1.0
scripts/run-tests.mjs         # 纳入决策及接口测试
src/i18n.ts                  # 合并决策文案
src/pages/Compare.tsx        # 助手、来源链接、房型/菜系与旧评分标注
src/pages/Bookings.tsx       # 酒店退房日期展示、编辑与校验
src/pages/Profile.tsx        # 自定义决策查询接口
src/store.ts                # 原子保存决策、删除关联清理
src/types.ts                # 新增可选决策偏好/用餐/来源/城市/退房字段
vite.config.ts              # 本地查询代理
HANDOFF.md                  # 本次交接同步
```

关键字段：`SavedItem.decision?`、`Trip.decisionPreferences?`、`Trip.mealSelections?`、`Profile.decisionApiUrl?`、`Booking.checkout?`、`CompareBoard.city?`。沿用 `boomvoy-v1`，新增字段为可选；旧收藏的评分会标为来源/量表待确认。旧数据及导入数据进入决策候选时有字段清理，但整个备份导入的深层 schema 校验仍待补。

## 19. 验证记录与发布状态

2026-09-07 功能交付验证：

- `npm test`：核心逻辑、推荐引擎、推荐应用、决策引擎、决策选择、接口测试全部通过。接口测试包含 13 个 Node test cases，使用内存响应与临时本地 HTTP 服务。
- TypeScript `--noEmit`、Vite 生产构建、`git diff --check` 通过。
- 浏览器独立测试环境验证：中英文需求解析、服务缺失回退、源链接、确认选择、收藏/比较/每日用餐/待预订联动、语言切换、390×844 手机布局、酒店入住与退房展示。
- 模拟实时候选验证：4.8/5、640 条评价与匹配度分别显示；Google 保存要求自定义标签。测试候选清楚标记为 QA 模拟，未用于真实推荐。
- 测试中发现并修复英文 `ocean-view room under AUD 300 per night with free parking` 的类型/预算解析和每日已选重复判定，已加入回归覆盖。
- 未发起真实 Google 付费查询、外部订位或付款；真实 key、地区覆盖与生产部署仍待联调。
- 临时测试页面和开发/模拟服务已关闭。智能决策已提交至远端；界面、主题和智能行李优化待推送，本轮尚未重新部署。
