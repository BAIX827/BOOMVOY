# BOOMVOY 工作交接文档

> 更新日期：2026-09-08
>
> 当前基线：`main` / `89d3c70`，本轮“统一后端 + API 最小调用”改动尚未提交。
> 产品口号：`Plan less. Decide better.`

## 1. 项目目标

BOOMVOY 是一个本地优先的旅行手账 Web App。目标是让用户在一趟旅行里完成：

> 灵感与收藏 → 方案比较 → 酒店 / 餐厅决策 → 日程与路线 → 机票 / 酒店 / 门票入口 → 天气 Plan B → 打卡 → 行李 → 预算与 AA → 伴手礼 → 分享

当前“预订”仍以聚合搜索和外链为主，回到 BOOMVOY 后手动登记订单；它还不是直接出票、支付或确认库存的一站式 OTA。

## 2. 仓库与发布状态

| 项目 | 当前值 |
| --- | --- |
| 工作区 | `C:\Users\64969\Desktop\BOOMVOY` |
| Git 远程 | `https://github.com/BAIX827/BOOMVOY.git` |
| 分支 | `main` |
| 本地 / 远端基线 | `89d3c70`，本轮开始时与 `origin/main` 一致 |
| 版本 | `0.1.0` |
| 静态部署 | GitHub Actions → GitHub Pages，生产 base 由 `GITHUB_PAGES_BASE` 注入 |
| 后端部署 | 代码已实现；当前只验证本地 Node 服务，尚未部署到公开主机 |
| 真实付费 API | 本轮测试全部使用伪响应，未验证真实 OpenAI / Google key 或产生付费调用 |

关键历史提交：

- `89d3c70`：精简示例、加强三套主题、按天数与天气生成行李数量。
- `b44d8a1`：酒店 / 餐厅智能决策与 Google Places 可选查询。
- `64b89ce`：行程推荐的节奏、时间、交通、去重、预览应用与撤销。
- `588d6f0`：创建、比较、预订、预算、AA、备份与移动导航等基础完善。

仓库 owner 是 `BAIX827`。本机历史上曾因另一 GitHub 账号凭据出现 `403`。若 push 报 `fetch first`，先使用 `git pull --rebase origin main` 整合远端，禁止直接 force push。

## 3. 本地运行

需要 Node.js 22.9+。

```powershell
npm ci
Copy-Item .env.example .env.server
# 编辑 .env.server，只填写实际需要的服务端 key / token
npm run server
```

另开一个终端：

```powershell
npm run dev
```

- 前端：`http://localhost:5173`
- 后端：`http://127.0.0.1:8787`
- 健康检查：`http://127.0.0.1:8787/api/health`
- 完整配置与生产边界：[BACKEND_SETUP.md](BACKEND_SETUP.md)
- Google Places 专项说明：[DECISION_SETUP.md](DECISION_SETUP.md)

验证：

```powershell
npm test
npm run build
git diff --check
```

## 4. 技术结构

- React 19、TypeScript、Vite 7、React Router 7。
- Tailwind CSS v4；手账 / polaroid / 登机牌视觉。
- Zustand `persist`，浏览器 key 为 `localStorage['boomvoy-v1']`，当前 persist 版本为 `3`。
- Leaflet / OpenStreetMap；`@dnd-kit` 行程拖拽；lucide-react 图标。
- 原生 Node HTTP 后端，无新增运行依赖。
- 后端单用户快照为本地 JSON 文件，不是多用户数据库。

### 4.1 主要路由

| 路径 | 页面 |
| --- | --- |
| `/`、`/explore`、`/new`、`/profile` | 旅行列表、发现模板、创建旅行、个人设置 / 后端 / 备份 |
| `/trip/:id` | 旅行总览 |
| `/trip/:id/plan`、`/map`、`/weather` | 日程、路线、天气与 Plan B |
| `/trip/:id/saved`、`/compare`、`/bookings` | 收藏、智能决策、预订入口与登记 |
| `/trip/:id/journal`、`/pack` | 打卡手账、智能行李 |
| `/trip/:id/budget`、`/expenses` | 预算、支出与 AA |
| `/trip/:id/group`、`/notes`、`/share/:id` | 同伴、设置、分享海报 |

## 5. 统一后端（本轮）

入口为 `server/decision-server.mjs`，运行命令为 `npm run server`；`npm run decision:server` 仅作为兼容别名保留。Vite 把全部 `/api` 代理到该进程。

| 接口 | 作用 | 单次用户动作的外部调用上限 |
| --- | --- | ---: |
| `GET /api/health` | 后端存活检查 | 0 |
| `POST /api/ai/chat` | Boomi 未知问题短答 | 最多 1 次 OpenAI |
| `POST /api/recommendations/day` | 生成 2–3 条日路线 | 最多 1 次 OpenAI |
| `POST /api/decisions/search` | 酒店 / 餐厅实时候选 | 最多 1 次 Google Places |
| `GET /api/v1/me/snapshot` | 读取单用户版本化快照 | 0 |
| `PUT /api/v1/me/snapshot` | 写入单用户版本化快照 | 0 |

### 5.1 服务端保护

- OpenAI URL、key、模型和系统提示固定在服务端；客户端不能传入或覆盖。
- OpenAI / Google key 不再进入浏览器、Profile、localStorage、导出文件或同步快照。
- 内容完全相同的并发供应商请求通过 SHA-256 请求指纹共享一次上游调用。
- 默认整个进程最多 4 个并发、每分钟 60 次供应商调用；每个直连 IP 每分钟最多 30 个请求。
- 客户端 IP 限流同样覆盖同步与失败鉴权；同步读取 / 写入默认最多 4 个并发，快照写入等待队列也有界。
- 达到并发或分钟额度时，在访问供应商前返回 `429`；没有自动重试付费请求。
- Google FieldMask 动态生成：停车和餐厅价格字段只在确实需要时请求。
- 后端只返回规范化数据和通用错误码，不转发供应商错误正文或 secret。
- Google 已完成响应不缓存；AI 通过校验的成功结果在进程内短暂复用 10 分钟 / 80 条，不落盘；并发 single-flight 在 settle 后删除。
- 普通 JSON 请求体上限 16 KiB，推荐上下文单独放宽到 256 KiB；供应商响应最多读取 512 KiB，快照最多 4 MiB。
- AI 推荐返回的票务 URL 一律丢弃；只有 `ticketNeeded` 会保留，浏览器再按地点名生成固定 Klook 搜索链接。

当前 AI / Google 付费路由没有终端用户登录鉴权。Node 服务与 Vite 开发代理均默认仅绑定 `127.0.0.1`，避免局域网设备借开发代理访问；线上必须放在带登录认证与用户级消费配额的同源反向代理 / BFF 后面，不能把 Node 端口直接暴露到公网。CORS、Host 白名单和 IP 限流不是身份认证；手机 / LAN 调试也不能直接改为全网卡监听。

环境变量清单见 `.env.example`。前端只使用 `VITE_BOOMVOY_API_URL`；所有 secret 均禁止使用 `VITE_` 前缀。

## 6. 前端 API 最小调用（本轮）

2026-09-08 补充：三主题新增独立 SVG 场景与材质（奶油拼贴、海盐航海、森林等高线），首页加入搜索/状态筛选与真实旅行统计；个人设置、新建旅行和旅行设置共用主题预览。新增响应式布局、键盘焦点和减少运动支持，手机导游猫移至右下角并缩小。参考 Atlassian 官方 spacing、color、accessibility 基础规范。

`src/requestCache.ts` 提供 success-only、exact-key、有限容量的 single-flight / TTL 缓存。单个调用方取消等待不会中断其他共享调用；失败不会缓存。

- Boomi：常见功能问题先由 `boomiChat.ts` 本地匹配，0 次 API；只有未知问题才调用后端一次。完全相同的成功问答在当前页面内有 10 分钟、最多 40 条的短缓存。
- 行程推荐：打开页面不请求；点击一次最多生成一次。预览阶段不再定位所有候选路线，用户应用某一条后才定位所选地点。
- 推荐新增浏览器 10 分钟 / 40 条成功缓存和在途复用；前后端共同精简同城上下文、校验时间窗/室内要求/地点排除，复用共享的中英文地点别名。官方兼容模型默认使用 JSON Schema，输出数量和 token 预算随节奏调整；失败不缓存，不额外调用模型修补。
- 酒店 / 餐厅决策：相同发现条件成功后重复点击不重查。日期、人数、币种、最低评分、评论数和已启用预算的数值变化只本地重排。
- 餐厅预算从“未启用”切换为“启用”时会重新查一次，因为这会新增 Google `priceRange` 字段；之后只改预算金额不重查。
- 地理编码：Photon + Nominatim 共享 7 天有界缓存；批量定位默认最多 4 个并发。
- 手动地点搜索：15 分钟有界缓存，防重复点击并隔离旧请求。
- OSRM 路线：成功结果缓存 30 分钟；按真实 OSRM profile + 坐标去重，映射到同一 driving 请求的公交 / 出租 / 自驾模式共享一次上游结果；失败估算不缓存。
- 天气：城市坐标、预报和历史天气分别缓存并合并并发请求；失败不缓存。手动刷新绕过已完成天气缓存，但继续复用坐标和相同在途刷新。

所有缓存均有容量和 TTL，避免无限增长；供应商失败仍允许下一次用户动作重试。

## 7. 单用户快照同步（本轮）

Profile 提供手动“上传本机数据 / 下载云端数据”。当前实现是个人备份，不是多人实时同步。

- `BOOMVOY_SYNC_TOKEN` 启用 Bearer 鉴权；必须为 32–512 UTF-8 字节且不能含空白，令牌只存在当前页面 React state。浏览器会在请求前拒绝明显无效令牌。
- 服务端快照固定 `schemaVersion = 1`，最大 4 MiB。
- `If-Match` + revision 防止旧版本静默覆盖；冲突返回当前快照。
- `Idempotency-Key` 防止同一写请求被重复执行；保留最近 128 个写入指纹。
- 写入使用有界队列、临时文件、fsync 和原子 rename；损坏文件不会被静默重置。
- 同步元数据保存在当前标签页的 `sessionStorage`，并按后端地址隔离。
- 手动下载总会读取远端；只有用户确认并成功应用后才推进本地 revision。
- 上传冲突响应自带远端快照，随后点击下载可直接使用，不额外请求一次。
- 云端快照按 schema v1 从 Profile、Trip 到全部嵌套对象逐层投影允许字段；未知旧字段、模板旅行、打卡照片、后端配置，以及 Google 会话型评分 / 价格 / 地址等供应商事实均不会落盘。
- 下载会保留 trip / day / plan / place ID 能匹配上的本机照片；完整照片备份仍应使用本地 JSON 导出。
- 服务端按完整 v1 旅行结构、日期 / URL / 数值与集合边界、嵌套枚举和唯一 ID 做运行时校验；浏览器在上传前与应用下载前做镜像校验，并流式限制响应大小。
- 本地导入最多读取 64 MiB，允许恢复模板、照片和本地供应商资料，但先校验整棵旅行数据；缺失的旧版 Profile 字段可使用当前值，显式存在但类型、枚举或长度错误的字段会拒绝；浏览器持久化失败时会回滚，不留下内存已替换、磁盘未保存的半完成状态。

## 8. 状态与兼容迁移

- `src/store.ts` persist 版本从 2 升到 3。
- 迁移会清除旧 `llmKey`、`llmUrl`、`llmModel`、`decisionApiUrl`，避免历史浏览器数据继续保存前端 secret / 旧接口。
- Profile 只保留统一的 `backendUrl`。导入 / 导出只接受便携 Profile 字段，不允许备份文件注入后端地址。
- UI 写入点限制日期、人数、金额、时长和 HTTP(S) 链接，避免创建出浏览器能显示、却注定无法同步的数据。收藏历史评分保留 10 分制，实时供应商评分维持 5 分制。
- `resetDemo()` 恢复 Japan 2026 和 Great Ocean Road 模板。
- `localStorage['boomvoy-met-boom']` 记录是否看过 Boomi 首次引导。

## 9. 核心产品边界

### 9.1 行程与推荐

- 每天包含 `planA`、`planB` 与 `activePlan`；天气页可建议切换雨天方案。
- 推荐必须由用户点击，不得改回页面自动生成。
- 推荐支持节奏、时间窗、交通、仅室内、逐项勾选、追加 / 替换和撤销。
- 应用前做行程指纹检查；已打卡、照片、感受或已订票记录不会被无提示替换。
- AI 不得编造坐标、社媒热度、实时评分、营业状态或库存。

### 9.2 智能决策

- 自然语言规则解析预算、酒店 / 餐厅、海景、停车、菜系、日期和人数；所有字段可手动核对。
- 未知条件显示“待确认”，不视为已满足。
- Google 候选只在当前会话展示供应商事实；长期只保存 Place ID、用户自定义标签、偏好和可重新打开的引用。
- 具体酒店房型、日期价格、库存和餐厅订位仍需在授权供应商 / 商家页面确认。

### 9.3 行李、预订与数据

- 行李数量同时考虑旅行天数与逐日天气；长途衣物按一周换洗量封顶。
- 预订是 deep link + 手动登记，不代表 BOOMVOY 已完成购买或出票。
- JSON 导出包含照片，可能很大；服务端快照不包含照片。
- 当前分享页偏海报，尚无真实多人权限和协作链接。

## 10. 外部服务现状

| 能力 | 当前服务 | 备注 |
| --- | --- | --- |
| Boomi / 日路线生成 | OpenAI 兼容 Chat Completions，由统一后端代理 | 可选；无 key 时本地功能仍可用 |
| 酒店 / 餐厅候选 | Google Places API (New) Text Search | 可选；保持 Google 归因与会话型数据边界 |
| 天气 | Open-Meteo | 前端按日期请求并做有界缓存 |
| 地理编码 | Photon，失败时 Nominatim | 前端缓存、失败可重试 |
| 驾车 / 步行 / 骑行 | 公共 OSRM | 公交仍外开 Google Maps |
| 机票 / 酒店 / 活动 | Skyscanner、Google Flights、Booking、Klook 等 deep link | 不是库存 / 订单 API |

后续接 API 的建议顺序：

1. 先完成生产登录、用户隔离、数据库、secret 管理和消费监控，再扩展付费供应商。
2. 机票 / 酒店库存只选一套主供应商做 PoC（如 Duffel / Amadeus / Booking.com Demand，需按当时合作资格重新调研）。
3. 再接活动门票、餐厅订位、汇率和订单 webhook。
4. 小红书 / Instagram 不依赖爬虫；优先支持用户粘贴链接、浏览器分享进入、人工策展和可追溯来源。

## 11. 主要文件

```text
src/store.ts                    Zustand 状态、CRUD 与持久化迁移
src/types.ts                    旅行领域类型
src/DaySuggest.tsx              日路线推荐、预览与应用
src/suggestions.ts              本地候选、后端推荐与所选路线定位
src/DecisionAssistant.tsx       酒店 / 餐厅发现、筛选与选择
src/requestCache.ts             前端 single-flight / TTL 基础设施
src/geo.ts                      地理编码、地点搜索、路线与地图链接
src/weather.ts                  预报 / 历史天气请求与缓存
src/llm.ts                      统一后端地址与 Boomi 客户端
src/syncClient.ts               单用户快照客户端
src/syncSchema.ts               下载快照的浏览器端运行时契约
src/GuideCat.tsx                Boomi 引导与聊天
src/boomiChat.ts                Boomi 零 API 本地问答路由
server/decision-server.mjs      统一 Node HTTP 网关与路由
server/api-control.mjs          上游请求指纹、single-flight、并发和分钟预算
server/snapshot-store.mjs       快照校验、CAS、幂等和原子持久化
tests/*                         前端逻辑、网关、同步和快照回归测试
BACKEND_SETUP.md                统一后端运行与部署说明
DECISION_SETUP.md               Google Places 专项说明
boomi.md                        全功能演示 / 测试视频脚本
```

## 12. 设计与文案约定

- 品牌名 `BOOMVOY` 要有存在感；中文默认，可切 English。
- 手账 / polaroid / 登机牌感，不做通用后台模板。
- Cream / Ocean / Forest 不只换色，均有自己的旅行装饰元素。
- 少废话、少重复说明；删除失效示例与过时文案。
- 可见文案必须同步维护中文和英文。
- Boomi 使用透明底 `src/assets/boomi.png` / `boomi_icon.png`。

## 13. 本轮验证记录

在 2026-09-08 的本地伪供应商环境中：

- `npm test`：37 个 Node 子测试全部通过，另含核心、行李、推荐、推荐应用、决策、决策选择和同步客户端脚本。
- 单用户快照专项：清洗、4 MiB 限制、前后端共享样例契约、完整语义校验、CAS、冲突、幂等、有界并发 / 队列、重启恢复、HTTP 鉴权与客户端回滚均覆盖。
- API 专项：动态 Google 字段、并发请求合并、进程调用预算、AI 固定服务端配置、严格输入和响应规范化均覆盖。
- `npm run build`：TypeScript 检查与 Vite 生产构建通过（1763 modules transformed）。
- `git diff --check`：通过。
- Boomi 同步检查：`GuideCat.tsx`、`boomiChat.ts`、中英 `i18n.ts` 与 `boomi.md` 已按“本地问题 0 调用、未知问题最多 1 调用、天气手动刷新、同步令牌要求”等新行为同步。
- 未发起真实 OpenAI / Google 付费请求，不能把测试通过描述成真实供应商已联调。

## 14. 下一步优先级

1. 先给付费路由增加同源 BFF / OIDC 登录与用户级消费配额，再将 Node 后端部署到 HTTPS 主机；GitHub Pages 继续只放静态前端。
2. 用用户级数据库与权限替换静态同步 token 和单文件快照。
3. 配置小额真实供应商额度，逐项联调 Google Places 与 OpenAI，并监控质量 / 延迟 / 单次成本。
4. 补浏览器 E2E：创建旅行、推荐并应用、改筛选不重查、同步冲突、切 Plan B、行李更新。
5. 选择一套机票 / 酒店库存供应商做最小闭环，再决定是否支持应用内下单。
6. 增加 PWA / 离线能力、真实分享权限和移动端安装体验。

## 15. 固定协作规则

1. 每次实际改动后同步更新本 `HANDOFF.md`。
2. 保持代码干净整洁，删除失效示例、无用文案和未使用代码。
3. 每次更新后给用户一组可直接复制的 Git 提交与推送命令；未经明确要求不要代为 commit / push。
4. 每次更新后同步检查 Boomi：`GuideCat.tsx`、`boomiChat.ts`、`i18n.ts` 和 `boomi.md`，只修改受影响内容。

## 16. 给下一个开发者的开工提示

```text
先读 HANDOFF.md、BACKEND_SETUP.md、src/store.ts、src/types.ts、server/decision-server.mjs。
先检查 git status，保留用户未提交改动。
推荐行程必须手动触发；常见 Boomi 问题必须优先本地回答。
前端不得读取或保存 OpenAI / Google key；统一使用 backendUrl + /api 子路由。
Google 会话型评分、价格、地址和官网不得进入持久存储。
所有新增网络调用都要说明触发条件、去重、缓存、失败重试与预算边界。
改文案中英同步；改功能同步 HANDOFF 和 Boomi；完成后运行 npm test、npm run build、git diff --check。
不要把伪响应测试写成真实 API 已验证。
```
