# 酒店与餐厅实时决策数据

本文件只说明 Google Places 决策数据。统一后端的完整启动、AI、同步、限流和部署说明见 [BACKEND_SETUP.md](BACKEND_SETUP.md)。

决策页面支持本地精选来源；实时评分、评论数量、停车信息通过可选 Google Places API (New) 服务查询。Google key 由 Node 服务端读取；本机用户可以在「我」页粘贴后保存到后端，也可以通过环境变量配置。业务请求只接收规范化的候选数据，默认接口为 `/api/decisions/search`。

## 本地启用

1. 在 Google Cloud 项目启用 **Places API (New)** 和相应账单账户，创建服务器 API key，并限制其 API 范围及适用的服务器来源。当前字段包含评分、价格区间及停车设施，会触发付费 SKU；先设置预算提醒、配额限制并核对 [Text Search 字段与计费档位](https://developers.google.com/maps/documentation/places/web-service/text-search#fieldmask)。
2. 使用支持 [`--env-file-if-exists`](https://nodejs.org/api/cli.html#--env-file-if-existsfile) 的 Node.js（22.9+），在项目目录运行 `npm run server`，另一个终端运行 `npm run dev`。默认后端监听 `http://127.0.0.1:8787`，Vite 会代理 `/api`。`npm run decision:server` 保留为兼容别名。
3. 在本机前端「我」→「连接你的 API」的 Google Places API Key 输入框粘贴并保存，立即用于后续查询。密钥保存在 Git 忽略的 `server/data/provider-keys.json`，不回显，不写入浏览器持久状态。也可在 `.env.server` 配置 `GOOGLE_PLACES_API_KEY`，或通过部署 secret 注入；页面保存值优先，移除后回退环境变量。请勿添加 `VITE_` 前缀或提交密钥到 Git。
4. 打开决策页面，输入城市、预算、住宿/餐饮要求后主动查询。成功时卡片显示 Google Maps、评分、评论数量、来源和本次查询时间。服务未启动、未配置 key、达到配额或超时时，界面会提示并保留本地来源入口。

可选环境变量：

- `BOOMVOY_PORT`：本地服务端口，默认 `8787`；变更后同时调整代理目标。旧的 `DECISION_PORT` 仍兼容。
- `BOOMVOY_ALLOWED_ORIGINS`：额外允许的完整 Origin，以逗号分隔，例如 `https://travel.example.com`。默认只接受 `localhost`、`127.0.0.1`、`[::1]` 的开发端口 `5173/5174/5175/4173/8787`。
- `BOOMVOY_ALLOWED_HOSTS`：额外允许的请求 Host 主机名，以逗号分隔，不含协议或端口。仅当受控反向代理保留公开域名 Host 时需要。

若前端使用独立服务，在「我」里填写可信的后端基地址，例如 `https://api.example.com/api`；不要填写 `/decisions/search` 这一条具体路由。本地开发默认使用 `/api`。

## 数据如何解释

- 评分为 Google 用户平均评分，同时显示评论数量和查询时间；它只用于候选排序。Google 的评论审核说明见 [Google Maps 内容政策](https://support.google.com/contributionpolicy/answer/7400114)。
- 酒店的具体房型海景、入住日期价格、库存与餐厅订位名额需要在商家或预订平台确认。查询结果中的酒店房价和海景房型保留“待确认”。官网链接指向商家入口；预订搜索链接打开对应平台，是否可订以平台页面为准。
- 停车只采用 API 返回的停车场或车库字段；单独出现路边停车或代客泊车时，停车场状态保留“待确认”。免费停车、收费停车分别处理。
- 菜系根据 Google 返回的 place types 判断；搜索文本中的菜系不会直接变成已验证标签。餐厅价格采用完整币种的返回区间；缺少上限或币种冲突时保留“待确认”，不自动换汇。区间仅供人均预算比较，实际菜单和账单以商家为准。
- 城市与地区通过地址组件核验，支持常用双语别名及行政层级，例如 Tokyo/东京、Canggu/Bali。明确输入的国家也必须吻合；输入多个地点层级请以逗号或 `/` 分隔。缺少归属证据的候选会被剔除，可用更准确的本地地名重试。
- 只展示营业状态为 `OPERATIONAL` 的候选；这表示商家仍经营，具体到店时段需核对营业时间。详情依据 [Places REST 字段参考](https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places)。

## 部署前必须补齐

该服务默认绑定 loopback，适合本机或同机反向代理使用。Vite 开发代理只在开发服务器工作；生产部署需把 `/api` 反向代理到 Node 服务，或部署等效服务器函数。纯静态托管需另行部署后端并配置允许来源。

**CORS 是浏览器来源控制，公开接口仍需要认证和计费保护。当前 AI / Google 付费路由没有终端用户登录鉴权，不得直接暴露到公网。** 发布前应把服务放到完成登录认证和用户级消费配额的同源反向代理 / BFF 后面，并补齐服务端总消费上限、TLS、secret 管理与运行监控。当前每个直连 IP 每分钟最多 30 次请求；默认整个进程最多 4 个并发、每分钟 60 次供应商调用，且等价并发查询会合并为一次。代理模式下通常共享代理 IP，这些限制仍只是基础保护。服务有 16 KB 决策请求上限、固定上游地址、10 秒 Google 超时，并仅返回通用错误码，不返回上游详细错误或 key。

展示 Google 内容时保留可见的 Google Maps 标识、第三方 attribution 和来源链接。Google 内容在当前会话中查询和展示，服务响应设为 `Cache-Control: no-store`，不将评分、评论数量、地址或官网等内容写入持久缓存；可长期保存 place ID。应用应将 Google 内容与自有内容区分，地图展示时遵守 Google Maps 要求。公开发布前还需完善使用条款与隐私说明，并核对 [Places API 使用政策](https://developers.google.com/maps/documentation/places/web-service/policies) 及适用区域协议。

## 验证

运行 `node --test tests/decision-provider.test.mjs`。测试使用内存响应与本地临时 HTTP 服务，覆盖动态字段、请求合并、调用预算、字段映射、输入校验、安全链接、关闭商家过滤、CORS、请求体限制、限流、超时、私钥隔离和前端响应校验。测试不加载 `.env`，不向 Google 发出真实请求，因此不产生 Google 查询费用。真实 key、生产认证、实际地区覆盖和商家预订链接仍需部署方联调。
