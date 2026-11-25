# BOOMVOY 素材保存与分发

2026-11-25 更新。App 和 GitHub Pages 使用全部 342 个 WebP 文件。公开生成清单位于 `docs/illustration-generation.json`，保留提示词、别名与项目相对路径。原机器上的生成缓存路径、171 张 PNG 母版和完整归档包继续留存在本地。下文记录 10 月整理素材时的状态。

更新：2026-10-16。适用：项目内置城市／风景插画。用户旅行照片、订单和个人数据不属于此公共素材流程。

本轮用户选择：**先保留本地归档，稍后配置云端备份**。第十批新增 20 张后，当前共 171 张（77 张城市与地区、90 张著名景点、4 张通用风景），母版 336.20 MB、960px WebP 25.66 MB、480px WebP 6.96 MB。代码、运行图、清单、生成记录进入 Git 管理；PNG 母版和 ZIP 保存在本地素材库。尚未配置异地备份。

## 当前采用的整理方式

1. 高分辨率透明 PNG 母版保存在 `output/illustration-masters/`，以 `city-v1.png` 命名。已生成母版保留，改稿使用 v2，避免静默覆盖。
2. 网页使用 `src/assets/illustrations/{cities,landmarks,generic}/asset-v1.webp` 与 `asset-v1-480.webp`。由 `scripts/prepare-illustrations.py` 导出，保留透明通道，分别限制在 960×640、480×320；高竖形景点必要时补透明边距，保持形状和 srcset 声明宽度一致。`DestinationArt` 按实际布局与像素密度选择，构建只带运行图片。小尺寸图失败先重试同一素材大图，再回退通用图。
3. `generation.json` 是编辑源清单，保存名称、国家、地区、版本、生成提示词和来源。原始生成路径仅为来源记录；已复制的项目母版是导出依据，换电脑无需依赖原来的 Codex 缓存目录。
4. `docs/illustration-assets.json` 是可迁移清单，包含项目相对路径、尺寸、字节数、SHA-256、提示词和建议的云端对象键。它由脚本生成，不直接手改。
5. `output/illustration-library/index.html` 是可搜索、按地区和类别筛选的素材目录，可单独查看城市与地区、著名景点、通用风景。可双击本地 HTML，也可通过开发服务器访问；目录保留相对路径，因此搬迁时应保留项目目录结构。
6. `output/asset-archives/` 保存导出 ZIP 和整体 SHA-256。ZIP 内含全部母版、两档网页图、清单、提示词、目录与脚本，写完后校验 CRC 和每张图片哈希。`docs/illustration-archive.json` 记录最新归档相对路径、大小、整体 SHA-256 与素材清单哈希。按当前本地归档决定，母版 PNG 和重复 ZIP 不进入 Git；母版文件继续保留。Git 克隆可运行网站，恢复母版需同时取回归档包。

此时文件保存状态为本地；同一硬盘上的 ZIP 是迁移快照，**不等于已完成异地备份**。没有创建云存储、上传素材、修改域名或启用 Git LFS。

## 推荐：分开管理源文件、交付图片和清单

| 内容 | 目前 | 数量增长后的保存位置 |
| --- | --- | --- |
| 代码、版本清单、提示词、导出脚本 | Git 工作区；等待提交 | Git |
| PNG／未来 PSD、Procreate 等可编辑母版 | 项目母版目录；本地 ZIP 快照 | 私有对象存储或团队文件库；另留独立备份 |
| 页面 WebP | 项目内导入，随静态构建部署 | 公共素材对象存储 + CDN；保留通用回退图随站点发布 |
| 搜索／预览目录 | 本地静态 HTML | 素材多且协作复杂时，再增加 DAM 素材管理平台 |

这是本项目的架构建议。对象存储适合持久保存二进制，CDN 负责网页交付；两者可以分工使用。AWS 官方支持 S3 作为 CloudFront 源站：[S3 与其他源站](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/DownloadDistS3AndCustomOrigins.html)。Cloudflare R2 通过自定义域名可接入 Cloudflare Cache；`r2.dev` 有速率限制，只适合开发：[R2 公共存储桶与缓存](https://developers.cloudflare.com/r2/buckets/public-buckets/)。

项目现在已有 GitHub Pages 静态部署，WebP 总量仍小，因此继续随站点部署最省事。目录扩展到数百张、图片更新明显比代码更频繁时，可以将运行图片迁移到独立对象存储/CDN；具体切换点应看构建体积、访问量和更新频率，没有统一的行业张数门槛。

若没有现有云平台，可优先评估 R2 + 自定义素材域名；已有 AWS 则用 S3 + CloudFront，已有阿里云／腾讯云则评估 OSS／COS + CDN，减少额外管理。没有在这里比较价格或承诺某服务在所有访问地区更快，最终根据主要用户地区实测。

## Git LFS 用在哪里

Git LFS 在 Git 中保存指针，把实际大文件存到独立存储，适合团队需要随代码检出和版本管理二进制母版的情况：[GitHub Git LFS 文档](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-git-large-file-storage)。它不承担这里的网页图片 CDN 职责。当前 Pages 构建需要的 WebP 保持普通文件，不改成 LFS 指针。

GitHub 对普通仓库内大于 50 MiB 的单个文件警告，大于 100 MiB 的单个文件阻止推送；这些是单文件限制，不能当成素材库总量目标。反复提交 PNG 大版本仍会累计 Git 历史：[GitHub 大文件限制](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github)。

若决定使用 LFS，应在首次提交母版前配置追踪规则和团队／CI 检出方式，再核对存储与下载配额。当前已按用户要求将母版独立保存在本地，并生成经过校验的完整 ZIP，PNG 忽略规则只影响 Git 收录。以后启用对象存储时，先上传并对照 SHA-256 验证可恢复，再考虑清理本地副本；当前保留全部母版，不进行 Git 历史重写。

## 后续云端目录约定

清单已生成建议对象键，例如：

```text
私有母版桶：boomvoy/illustrations/v1/cities/beijing/master.png
公开分发桶：boomvoy/illustrations/v1/cities/beijing/web.webp
```

母版和分发图使用独立存储桶／访问权限。改稿写入 v2 的新对象键，并保留 v1；网页确认切换以后再按保留策略处理旧版本。不可变版本路径可设置长期缓存，清单采用短缓存或跟随代码部署。上传流程必须校验文件、更新清单，并检查实际 URL、Content-Type、缓存规则和必要的 CORS。当前清单里的对象键是建议路径，不代表文件已存在于云端。

## 日常使用

在项目根目录执行（需要 Python + Pillow）：

```text
python scripts/prepare-illustrations.py
python scripts/catalog-illustrations.py
python scripts/catalog-illustrations.py --archive
```

归档校验可在没有 Pillow 的电脑上执行，只依赖 Python 标准库：

```powershell
$assetArchive = Get-Content docs/illustration-archive.json -Raw | ConvertFrom-Json
python scripts/verify-illustration-archive.py $assetArchive.archivePath
```

恢复时将完整 ZIP 解压到一个目录，保留原有层级。`output/illustration-masters/` 为母版，`src/assets/illustrations/` 为两档运行图，本地目录 HTML 的相对链接继续有效。归档名依据文件内容生成；更新素材或清单会产生新快照，不覆盖旧版归档。

新增一张图的步骤：生成并保存版本化母版 → 在 generation.json 登记信息和提示词 → 导出 WebP → 更新城市别名映射 → 重新生成目录与清单 → 检查手机/电脑实际缩小效果 → 备份。每次都能从清单核对母版和网页图。

大量素材的最终备份建议保留一份工作副本、一份独立设备或文件库副本，以及一份异地副本。至少做一次从归档恢复和 SHA-256 对照；不要把“本机有文件”写成“云端已备份”。
