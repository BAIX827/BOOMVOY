# BOOMVOY 后端配置与部署

BOOMVOY 使用一个原生 Node.js 网关统一处理 AI、Google Places 和单用户旅行备份。「我」页面提供 OpenAI 与 Google Places API Key 输入框：密钥仅在点击保存时发给本机后端，随后由后端保存和使用。普通业务请求不携带供应商密钥，浏览器不把密钥写入 Profile、localStorage、旅行导出或云端快照。后端没有新增运行依赖。

> **当前付费路由没有终端用户登录鉴权。** 服务只适合绑定本机 loopback，或放在已有登录鉴权与消费配额的同源反向代理后面；不要把这个 Node 端口直接暴露到公网。CORS、Host 白名单和 IP 限流都不能替代身份认证。

## 1. 本地启动

需要 Node.js 22.9 或更高版本。

```powershell
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

### 在个人资料页粘贴密钥

1. 打开本机前端的「我」→「连接你的 API」。
2. 分别粘贴 OpenAI API Key 与 Google Places API Key，点击对应的保存按钮。可以只配置其中一个。
3. 保存成功后输入框清空，页面只显示配置状态，不回显密钥。配置立即用于下一次请求，重启后端后仍然保留。
4. OpenAI 用于 Boomi 未知问题与行程推荐；Google 用于酒店 / 餐厅实时地点查询。保存和读取状态都不请求供应商；「已配置」不代表已验证账户额度、API 权限或联网状态。

Google key 所属项目需启用 **Places API (New)** 与结算，并允许服务器调用该 API；这里的 Google 接口不是 Gemini。参考 [Google Places 设置](https://developers.google.com/maps/documentation/places/web-service/get-api-key)。OpenAI key 按 [官方密钥认证规范](https://developers.openai.com/api/reference/overview) 交由后端使用。

密钥保存在已被 Git 忽略的 `server/data/provider-keys.json`，采用临时文件与原子替换；该文件没有应用层加密，按本机私密配置管理，勿复制进前端资源或旅行备份。读取接口只返回配置来源和布尔状态。页面保存值优先于环境变量；移除已保存的密钥后，如果环境变量仍有值，会继续使用环境配置。

配置接口为 `GET /api/settings/providers` 与 `PUT /api/settings/providers`。它只服务本机页面与 loopback 连接，写入还需状态接口给出的临时令牌，不会因为扩展普通业务的 CORS / Host 白名单而开放给公网。浏览器也会拒绝把密钥发送到远程后端地址；公开部署仍应使用服务端 secret 配置。环境变量设置了非官方 `OPENAI_API_URL` 时，页面拒绝保存 OpenAI key，避免将官方 key 发往兼容服务。

仍可用环境变量配置密钥、模型和同步令牌：自行创建 `.env.server`，或在文件不存在时从 `.env.example` 复制。页面不会修改这个文件。

## 2. 环境变量

| 变量 | 默认值 | 用途 |
| --- | --- | --- |
| `VITE_BOOMVOY_API_URL` | `/api` | 前端后端基地址。生产环境可设为可信的完整 HTTPS 地址，例如 `https://api.example.com/api` |
| `GOOGLE_PLACES_API_KEY` | 空 | 酒店 / 餐厅实时查询；空值时该功能明确返回未配置，不调用上游 |
| `OPENAI_API_URL` | `https://api.openai.com/v1/chat/completions` | 服务端 OpenAI 兼容接口；只允许 HTTPS，本机调试可用 localhost HTTP |
| `OPENAI_API_KEY` | 空 | Boomi 未知问题和 AI 行程推荐；只放在服务端 |
| `OPENAI_MODEL` | `gpt-4o-mini` | 服务端固定模型，客户端不能覆盖 |
| `OPENAI_RESPONSE_FORMAT` | `auto` | 官方 OpenAI 的已支持 GPT-4o / GPT-4.1 模型使用严格 JSON Schema；其他模型和兼容网关使用 JSON mode。可显式设置 `json_schema` / `json_object`，不通过额外调用探测兼容性 |
| `BOOMVOY_AI_CACHE_TTL_MS` | `600000` | 通过校验的 AI 结果在进程内复用 10 分钟，共最多 80 条；`0` 关闭，最大 `3600000`。不落盘、不缓存失败或 Google 数据 |
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
| `POST /api/recommendations/day` | 最多 1 次 OpenAI | 默认请求 2 条不同路线，每条最多按节奏生成 3 / 5 / 7 个地点；条件不足可更少。不会接受客户端 key、模型或坐标 |
| `POST /api/decisions/search` | 最多 1 次 Google Places | 主动查询酒店 / 餐厅；字段按需求动态请求 |
| `GET /api/v1/me/snapshot` | 0 | 获取当前单用户版本化快照，支持 `ETag` / `If-None-Match` |
| `PUT /api/v1/me/snapshot` | 0 | 一次上传完整快照，使用 `If-Match`、幂等键和 revision 冲突保护 |

所有付费供应商请求都经过同一进程级保护：

- 同一时刻内容完全相同的请求共享一个上游 Promise，只计一次调用。
- 没有自动重试付费请求；失败后由用户决定是否重试。
- 达到并发或分钟预算时，在调用供应商前返回 `429` 和通用错误码。
- AI 仅在完整解析及条件校验后进入有界进程内缓存（10 分钟 / 80 条，重启即清空）；Google 已完成响应不进入该缓存。失败、拒绝、截断或全部不合格的推荐不缓存。
- 浏览器还会复用相同条件的成功推荐（10 分钟 / 40 条），并合并在途请求；取消一个等待者不会取消其他等待者。语言、日期、偏好、相关排除项、起点或后端地址改变会隔离旧结果。
- Google 只请求当前筛选真正需要的字段；预算、日期、人数、最低评分等本地重排不会重新发现商家。
- AI 推荐只生成文字方案；用户选中一条方案后，才为那条路线定位地点。
- Boomi 常见问题完全在本地回答；相同的未知问题成功返回后，会在当前页面内短暂复用 10 分钟，最多保留 40 条。
- AI 不能提供可直接使用的票务链接。后端丢弃模型 URL，前端只会按已选地点生成固定 Klook 搜索入口。
- OSRM 缓存按真实上游 profile 和坐标建立；公交、出租车、自驾等共用同一 driving 查询时只调用一次，再在本地换算展示时间。
- 天气手动刷新会绕过已完成的天气缓存，但继续复用城市坐标，并与同一时刻的相同刷新共享请求。

请求体和响应体均有边界：普通 JSON 请求最多 16 KiB，推荐上下文最多 256 KiB，供应商响应最多读取 512 KiB，旅行快照最多 4 MiB。OpenAI 上游默认 25 秒超时，浏览器等待 35 秒，避免浏览器先于后端放弃；Google 上游默认 10 秒超时。

### 推荐质量与 token 控制

前后端保留城市、日期、语言、时间窗、节奏、交通、室内要求、最后一站及相关天气；仅同城或城市未知的已规划地点进入排除名单。排除项按中英文地点别名去重，发给模型时使用名字数组，不重复每个地点的日期和城市。天气只保留结构化字段，不重复发送自由文本 summary。

默认请求两条不同路线；模型只生成必要地点信息，交通偏好和默认优先级由代码补齐。输出上限随可用时间和节奏调整，最高 1800 tokens。支持时使用严格 JSON Schema 约束输出；兼容接口继续使用 JSON mode，两种模式都必须通过运行时校验。不会为了凑齐路线而额外调用模型。

服务端过滤已安排地点、路线内重复、非室内项、无效时间/时长以及超出时间窗的地点，加入估算交通和缓冲后排程，并去掉重复路线。浏览器进一步结合本地目录检查已知地点所属城市、室内属性、免费已有坐标及实际可排入的地点。完全不合格返回 `provider_quality_failed`；无法容纳最短访问时间的请求在访问上游前返回 `no_time_available`。

外部服务失败或无合格结果时，界面会说明原因并尝试符合当前条件的本地路线；本地无合适内容时展示空状态。结构校验与本地目录无法证明所有模型地点真实存在，也不能验证实时营业时间、票务或未知地点的室内属性。应用路线时仍需定位与用户核对，不能把“格式正确”视为事实保证。

实现参考：[OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)、[OpenAI latency optimization](https://developers.openai.com/api/docs/guides/latency-optimization)。实际 token 节省比例取决于原始上下文、模型和缓存命中率，当前回归测试验证的是调用次数与请求/响应内容，不是付费账单降幅。

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

Profile 的高级设置中填写后端基地址，不是某个具体接口。开发环境使用 `/api`；独立后端示例为 `https://api.example.com/api`。远程后端的供应商密钥由部署环境管理，不使用本机页面的密钥保存接口。

## 6. 验证

```powershell
npm test
npm run build
```

自动测试使用本地伪供应商响应与临时文件，不会产生真实 OpenAI 或 Google 调用费用。真实 key、真实供应商数据、生产反向代理和线上认证仍需单独联调。
