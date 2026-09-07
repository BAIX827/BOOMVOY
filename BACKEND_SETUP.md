# BOOMVOY 后端配置与部署

BOOMVOY 现在使用一个原生 Node.js 网关统一处理 AI、Google Places 和单用户旅行备份。浏览器只知道后端地址，不再保存或发送 OpenAI / Google API key。后端没有新增运行依赖。

> **当前付费路由没有终端用户登录鉴权。** 服务只适合绑定本机 loopback，或放在已有登录鉴权与消费配额的同源反向代理后面；不要把这个 Node 端口直接暴露到公网。CORS、Host 白名单和 IP 限流都不能替代身份认证。

## 1. 本地启动

需要 Node.js 22.9 或更高版本。

```powershell
Copy-Item .env.example .env.server
# 编辑 .env.server，只填写实际需要的服务端变量
npm run server
```

另开一个终端：

```powershell
npm run dev
```

前端默认通过 `/api` 访问后端，Vite 会把它代理到 `http://127.0.0.1:8787`。Vite 与 Node 后端都只监听本机 `127.0.0.1`，避免同一局域网中的其他设备借开发代理访问未登录的付费路由。若需要手机或局域网调试，先增加可信鉴权与用户级配额，不要直接把 Vite host 改为全网卡监听。健康检查：

```powershell
Invoke-RestMethod http://127.0.0.1:8787/api/health
```

返回 `{ "ok": true }` 只表示后端进程可访问，不代表所有可选供应商都已配置。

## 2. 环境变量

| 变量 | 默认值 | 用途 |
| --- | --- | --- |
| `VITE_BOOMVOY_API_URL` | `/api` | 前端后端基地址。生产环境可设为可信的完整 HTTPS 地址，例如 `https://api.example.com/api` |
| `GOOGLE_PLACES_API_KEY` | 空 | 酒店 / 餐厅实时查询；空值时该功能明确返回未配置，不调用上游 |
| `OPENAI_API_URL` | `https://api.openai.com/v1/chat/completions` | 服务端 OpenAI 兼容接口；只允许 HTTPS，本机调试可用 localhost HTTP |
| `OPENAI_API_KEY` | 空 | Boomi 未知问题和 AI 行程推荐；只放在服务端 |
| `OPENAI_MODEL` | `gpt-4o-mini` | 服务端固定模型，客户端不能覆盖 |
| `BOOMVOY_SYNC_TOKEN` | 空 | 可选单用户快照 Bearer token；启用时必须为 32–512 UTF-8 字节且不能含空白 |
| `BOOMVOY_DATA_FILE` | `server/data/snapshot.json` | 单用户快照文件；目录已被 Git 忽略 |
| `BOOMVOY_PORT` | `8787` | 本地监听端口 |
| `BOOMVOY_ALLOWED_ORIGINS` | 空 | 额外允许的完整浏览器 Origin，逗号分隔 |
| `BOOMVOY_ALLOWED_HOSTS` | 空 | 额外允许的 Host 主机名，不含协议和端口 |
| `BOOMVOY_CLIENT_RATE_LIMIT` | `30` | 每个直连 IP 每分钟最多请求数 |
| `BOOMVOY_SYNC_CONCURRENCY` | `4` | 同时处理的快照读取 / 写入上限；额外写入队列同样有界 |
| `BOOMVOY_UPSTREAM_CONCURRENCY` | `4` | 整个进程同时进行的供应商调用上限 |
| `BOOMVOY_UPSTREAM_CALLS_PER_MINUTE` | `60` | 整个进程每分钟供应商调用上限 |

`.env.server` 已被 `.gitignore` 排除。不要把真实 key 或同步令牌写进 `.env.example`、前端 `VITE_` 变量、Profile、提交记录或聊天内容。

## 3. 接口

| 接口 | 外部调用 | 说明 |
| --- | ---: | --- |
| `GET /api/health` | 0 | 健康检查，不透露供应商、模型或额度状态 |
| `POST /api/ai/chat` | 最多 1 次 OpenAI | 只处理 Boomi 本地知识未命中的问题 |
| `POST /api/recommendations/day` | 最多 1 次 OpenAI | 生成 2–3 条规范化日路线；不会接受客户端 key、模型或坐标 |
| `POST /api/decisions/search` | 最多 1 次 Google Places | 主动查询酒店 / 餐厅；字段按需求动态请求 |
| `GET /api/v1/me/snapshot` | 0 | 获取当前单用户版本化快照，支持 `ETag` / `If-None-Match` |
| `PUT /api/v1/me/snapshot` | 0 | 一次上传完整快照，使用 `If-Match`、幂等键和 revision 冲突保护 |

所有付费供应商请求都经过同一进程级保护：

- 同一时刻内容完全相同的请求共享一个上游 Promise，只计一次调用。
- 没有自动重试付费请求；失败后由用户决定是否重试。
- 达到并发或分钟预算时，在调用供应商前返回 `429` 和通用错误码。
- Google / AI 的已完成响应不在服务端持久缓存。前端只对适合缓存的天气、坐标、路线和当前页面候选做有界复用。
- Google 只请求当前筛选真正需要的字段；预算、日期、人数、最低评分等本地重排不会重新发现商家。
- AI 推荐只生成文字方案；用户选中一条方案后，才为那条路线定位地点。
- Boomi 常见问题完全在本地回答；相同的未知问题成功返回后，会在当前页面内短暂复用 10 分钟，最多保留 40 条。
- AI 不能提供可直接使用的票务链接。后端丢弃模型 URL，前端只会按已选地点生成固定 Klook 搜索入口。
- OSRM 缓存按真实上游 profile 和坐标建立；公交、出租车、自驾等共用同一 driving 查询时只调用一次，再在本地换算展示时间。
- 天气手动刷新会绕过已完成的天气缓存，但继续复用城市坐标，并与同一时刻的相同刷新共享请求。

请求体和响应体均有边界：普通 JSON 请求最多 16 KiB，推荐上下文最多 256 KiB，供应商响应最多读取 512 KiB，旅行快照最多 4 MiB。OpenAI 上游默认 25 秒超时，浏览器等待 35 秒，避免浏览器先于后端放弃；Google 上游默认 10 秒超时。

分钟调用上限只是应用保护，不等于供应商账单上限。仍应在 Google / OpenAI 控制台设置预算、配额和告警。

## 4. 单用户旅行备份

在 `.env.server` 配置 `BOOMVOY_SYNC_TOKEN` 后，到 BOOMVOY 的「我」页面输入同一个令牌，可手动上传或下载。

- 令牌需为 32–512 UTF-8 字节且不能含空白，只保留在当前 React 页面状态，不写入 Profile、localStorage、导出文件或同步快照；明显无效的令牌会在浏览器发请求前拒绝。
- 每个后端地址分别记录 `ETag`；更换后端不会沿用另一台服务器的 revision。
- 上传是一次完整快照调用。版本不一致时返回冲突，不会静默覆盖远端数据。
- 服务端限制 4 MiB，并限制同时同步数与等待写入数；通过完整校验后写入临时文件，再原子替换正式快照。
- 上传按完整 `schemaVersion = 1` 旅行结构校验必需字段、嵌套类型、枚举、日期、URL、数值范围、集合数量和唯一 ID；浏览器在发请求前及应用下载前镜像验证，并流式限制响应读取大小。
- 服务端从 Profile、Trip 到全部嵌套对象按 schema v1 逐层投影允许字段；未知旧字段和原始供应商载荷不会默认透传。模板旅行、打卡照片、后端地址和 Google 会话型供应商详情也不会进入云端快照。
- 下载只保留 ID 能匹配上的本机照片；照片仍应通过本地 JSON 导出或其他相册方案单独备份。
- 本地 JSON 导入允许恢复模板、照片和本地供应商资料，但仍完整验证旅行结构；缺失的旧版 Profile 字段可兼容，显式损坏字段会拒绝；如果浏览器持久化失败，会回滚内存状态，不会留下半应用数据。
- 数据文件本身没有应用层加密，请依靠受保护的磁盘、文件权限和服务器备份。

这是个人 / 单用户后端，不是生产级多人账号系统。一个静态 token 不能替代登录、用户隔离、撤销机制、审计或数据库。

## 5. 生产部署边界

开发前端和服务端默认都只绑定 `127.0.0.1`。GitHub Pages 只能托管静态前端，不能运行这个 Node 进程。线上使用时需要把后端部署到独立 Node 主机或等效服务器环境，并完成：

1. HTTPS 与可信的**同源**反向代理；在代理层完成登录鉴权和用户级消费配额，再明确设置 `BOOMVOY_ALLOWED_ORIGINS` 和 `BOOMVOY_ALLOWED_HOSTS`。完成前不得公开暴露付费路由。
2. Secret manager、供应商账单上限、监控、备份和告警。
3. 用真实登录 / OIDC（建议 same-site BFF）和用户级数据隔离替换静态同步 token；跨域前端不能依赖当前的 `credentials: same-origin` 携带登录 cookie。
4. 若多实例部署，把进程内 single-flight、限流和文件快照迁移到共享基础设施。
5. 遵守 Google Maps Platform 的展示、归因、缓存和使用政策。

Profile 中填写的是后端基地址，不是某个具体接口。开发环境使用 `/api`；独立后端示例为 `https://api.example.com/api`。

## 6. 验证

```powershell
npm test
npm run build
```

自动测试使用本地伪供应商响应与临时文件，不会产生真实 OpenAI 或 Google 调用费用。真实 key、真实供应商数据、生产反向代理和线上认证仍需单独联调。
