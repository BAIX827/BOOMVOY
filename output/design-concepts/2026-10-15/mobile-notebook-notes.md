# BOOMVOY 手账风格：手机布局与新版旅行本

图片：c-mobile-notebook-v2.png

采用内置 imagegen，以 c-field-journal.png 为参考重新设计。为视觉概念稿，正式页面尚未改动。

## 布局

- 桌面端：路线与当天行程作为主栏，旅行本作为辅助栏。
- 手机端：单栏总览依次呈现旅行信息、紧凑插画路线、优先待办与当天行程。底部导航为总览、行程、旅行本、更多。
- 旅行本：在手机上单独成页，清单、票夹、随记分类切换。票据详情点击展开。
- 路线插画应针对窄屏重新构图；正式路线地图从“查看路线”进入。
- 手机正文从 16px 起，主要触控区域至少 44px，底部导航适配安全区域。
- Boomi 在顶部提供入口，避免遮挡行程或底部导航。

## 旅行本外观

细鼠尾草绿布面书脊，自然白纸面，轻微纸页边缘，小页签与书签。减少边框厚度、线圈、横线及装饰性标语。插画用于识别目的地，密度需在实际屏幕上调整。生成图中的短说明也可进一步删除。

## 生成提示词

```text
Use case: ui-mockup / reference-guided redesign. Use the attached BOOMVOY screenshot as a visual reference for the brand, its charming Japanese ink-and-watercolor destination illustrations, ivory background, butter-yellow accents, dark navy typography, green actions and tiny explorer cat Boomi. Create ONE landscape high-resolution design comparison board showing THREE very clear interface panels side by side with generous clean gutters. The first two are full mobile app screens at realistic 390x844 proportions, the third is a larger redesigned desktop right-hand travel notebook panel at about 460px wide. Total image around 1600x1100 or equivalent crisp landscape. Show actual readable UI, flat straight-on, no hands, no desk, no perspective, no black phone hardware, no fancy presentation effects. Small Chinese captions outside each panel: "手机 · 总览", "手机 · 旅行本", "桌面 · 旅行本". This is the same app adapted to mobile with a new elegant notebook design.
CRITICAL DESIGN CHANGE: replace the original ugly thick lavender frame and metal spiral binding with a refined lightweight sewn travel journal: narrow sage-green linen spine at the left, warm natural white paper, two delicate page-edge lines at right, tiny restrained bookmark detail, almost no shadow. The visual object should feel beautifully made and precise, like an elegant small travel stationery notebook. No ring binding, no giant colored border, no purple notebook shell, no ruled lines behind tickets, no oversized decorative headings, no slogans or decorative filler.
PANEL 1 mobile Overview: small top row back chevron, "BOOMVOY", tiny Boomi avatar; heading "日本 2026" around 28px not huge, line "9月25日–10月4日 · 10天 · 2人". A compact ORIGINAL recomposed watercolor/ink illustration route strip about 180–210px tall, Tokyo landmarks, Mount Fuji, Kyoto pagoda, Osaka tower, connected along a clear thin route, with readable Chinese city labels 东京 / 富士 / 京都 / 大阪; illustration is drawn for this narrow width, not a squeezed desktop screenshot; little '查看路线' action. Below a single compact action row warm pale yellow '京都住宿待确认' plus functional '查看' chevron. Then '9月26日 · 东京' and sunny 24° compact weather label. Below three clean time rows with tiny rectangular photos, 09:00 浅草寺, 12:00 浅草午餐, 16:00 涩谷 Sky, thin vertical yellow timeline, simple chevrons. '+ 添加地点' as a simple green text action. Fixed bottom safe-area navigation 4 labeled icons 总览(selected green) / 行程 / 旅行本 / 更多. No extra tabs across top, no huge mascot, no paragraphs. Comfortable 16px functional body type and touch targets.
PANEL 2 mobile Travel Notebook: same topbar and bottom nav with 旅行本 selected. Page title '旅行本'. Notebook form fills inner width, narrow sage linen spine, warm white page, small unobtrusive top tabs 清单 / 票夹(selected) / 随记. Content is tickets, functional readable. First beautifully designed compact boarding pass with generic airplane icon, label '航班 · 已登记', strong 'MEL → NRT', line '墨尔本 → 东京', '9月25日 · 10:20', '2人', fine perforated divider, small '查看详情' arrow. Do NOT invent real flight numbers, airline names or scannable barcodes. Second smaller hotel reservation ticket '京都住宿', '9月29日–10月2日', state '待确认', '查看详情' arrow. Then quiet '+ 添加票据' green action. Use tasteful editorial spacing but avoid a large empty void. A small clipped-in illustration of Kyoto at the lower margin can tie the travel world together without competing with content. Everything stays legible and aligned.
PANEL 3 desktop replacement notebook: match the exact notebook design language of panel 2, more horizontal space and a refined realistic paper edge. Header '旅行本' in restrained navy serif title, the same 清单 / 票夹(selected) / 随记 tabs. Two corresponding tickets with same demo labels and dates, structured in broader desktop layout. Below a narrow row '+ 添加票据'. A tiny cat Boomi icon and '问 Boomi' button can sit below the notebook outside its paper, never cover it. This panel must clearly demonstrate how the original right-hand notebook could be replaced.
Shared typography: Chinese UI text in highly legible clean CJK sans; subtle bookish serif only for large Latin destination/title if needed. Keep all user-facing labels succinct. All interface text Chinese except BOOMVOY, Boomi, MEL, NRT and Sky. No gratuitous English handwriting or marketing sentences. No giant lavender frame. Preserve original travel illustration personality and brand cat appearance from reference but improve clarity, spacing and craft. Do not copy the original landscape page wholesale. This image is a responsive product design proposal, not a marketing landing page.
```
