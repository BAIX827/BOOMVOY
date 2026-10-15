# BOOMVOY 页面设计方向

日期：2026-10-15

本次为视觉探索与示意图，正式页面代码尚未修改。图中日期、地点、价格、地图与预订状态均用于展示布局，地图位置与路线需要在实现时使用真实数据重新绘制。图片由内置 imagegen 生成。

## 建议

优先采用精简后的 C 作为 BOOMVOY 品牌视觉方向：保留插画路线、票根与 Boomi，删去生成图中的装饰口号并降低装饰密度。行程页采用 B 的时间线与地图联动；A 的目的地摄影用于发现页和旅行封面。统一字体、按钮、导航及 Boomi 形象，按页面任务调整信息布局。

## 示意图文件

- `a-editorial.png`：旅行杂志。
- `b-map-atlas.png`：地图探索。
- `c-field-journal.png`：旅行手账。

## 生成图中仍需调整的细节

- A：标题过大、手写标语多余、底部日期重复与密度偏高。
- B：地点说明偏长；示意地图、交通时间和星期需替换为真实数据。
- C：装饰标语过多、顶部插画占高、功能区混入过多展示字体；示例航班与票据内容需使用用户登记的数据。

## 当前结构中需要改善的部分

- 首页装饰插画、大标题、引导文案占据较多首屏空间，已有旅行应优先呈现当前旅行与继续入口。
- 旅行封面依赖主题插画，目的地与个人照片带来的辨识度不足。
- 总览存在多组相近的模块，需要突出当前阶段最需要完成的操作。
- 展示字体、手写字体、装饰标签与主题材质同时出现，需精简视觉层次。

## A — 旅行杂志 / Editorial

采用目的地照片、不对称但有秩序的排版、明确的标题与紧凑的状态行。适合首页、旅行总览、发现页。照片质量直接影响效果；需要为无照片状态准备目的地封面。

## B — 地图探索 / Atlas

让当天行程和地点共用选中状态：点击行程定位地图，点击地图显示对应行程；拖动顺序后更新路线。桌面双栏；手机采用全屏地图与可展开的底部行程面板。示意图中的地图为概念绘制。

## C — 旅行手账 / Field Journal

用少量插画路线、登机牌、用户手写备注表达旅行过程，保留整齐的功能控件。适合手账与回忆页。装饰密度和插画资源维护成本需要控制；Boomi 在用户主动操作或确有问题时出现。

## 参考来源

- [Niarra Travel — Awwwards, SOTD 2021-06-22](https://www.awwwards.com/sites/niarra-travel)：参考目的地摄影与场景氛围。
- [When to Travel — Awwwards, SOTD 2018-05-10](https://www.awwwards.com/sites/when-to-travel)：参考时间选择与天气探索。
- [A Short Journey — Awwwards, SOTD 2016-02-07](https://www.awwwards.com/sites/a-short-journey)：参考插画与旅行体验的结合。

以下设计方向是针对 BOOMVOY 的推演，参考网站用于理解表现手法。

## 生成提示词

### a-editorial

```text
Use case: ui-mockup. Create one high fidelity, finished desktop web application screenshot for BOOMVOY, a personal travel planning and travel journal app. Landscape wide image, crisp legible typography, flat straight-on screen with no device frame, no desk, no presentation background. This is design direction A: editorial travel magazine. Depict a populated JAPAN 2026 trip overview, September 25 – October 4, 10 days, 2 travellers. Distinct art direction: bright white paper, deep graphite type, striking clear cobalt blue UI accent, a restrained sunflower yellow brand detail. Precise bold contemporary grotesk typography, expressive destination title, asymmetric editorial photo layout, Japanese travel book sensibility, intentional whitespace, richly authentic natural destination photography. NO generic SaaS hero, NO promotional subtitle, NO feature-card grid, NO gradients, NO glass. Top bar BOOMVOY with tiny cute black-white explorer cat wearing yellow hat, tabs My trips / Explore, avatar. Thin trip navigation under topbar: Overview (selected), Itinerary, Saved, Bookings, Budget, Journal. Main screen visually compose: left 58% has bold 'Japan 2026', compact dates and traveller line, then one large gorgeous Japan destination photographic composition showing Mount Fuji and a lakeside town with a tiny blue route marking detail, a smaller Kyoto street image inset along bottom edge aligned carefully. Right 35% a useful beautiful trip overview: a prominent action row 'Next up' and 'Choose your Kyoto stay' with blue 'View stays' button; elegant horizontal city route Tokyo — Fuji — Kyoto — Osaka; 'Your first day' with a compact 3-row timeline 09:00 Senso-ji, 12:00 Asakusa lunch, 16:00 Shibuya Sky; bottom neatly divided inline booking readiness 'Flights ✓   Stays 3/4   Tickets 4/8'. Under main region a full-width useful thin horizontal day selector with destination photo thumbnails. A small Boomi cat helper stays quietly at lower right with just 'Ask Boomi'. English text only for clarity. Production-plausible interface at 1440x960 scale; high quality UI screenshot, not concept painting. Make it feel specific, adventurous and human composed. All labels functional. No explanatory paragraphs, no awards badges, no decorative section numbers. Photography is original generated travel imagery.
```

### b-map-atlas

```text
Use case: ui-mockup. Create one finished high fidelity desktop web application screenshot for BOOMVOY travel planner. Wide landscape 1440x960 scale, flat edge-to-edge UI screenshot no device mockup. Direction B: an expressive interactive travel atlas, spatial composition inspired by richly designed contemporary cartography. Actual work screen showing Tokyo day itinerary. Art direction luminous pale glacier blue water #C8E6F4, ivory land, forest green parks, strong cobalt blue route, yellow active place marker, near-black typography. Clean minimal bold sans typography, vivid and optimistic. Narrow left permanent rail about 80px with tiny black-white cat explorer in yellow hat and BOOMVOY compact mark; icon navigation. A fixed left itinerary panel 340px, white, crisply separated from a broad right map occupying about 65% width. Left panel: 'Japan 2026', '25 Sep – 4 Oct · 2 travellers', tab Itinerary / Saved, big 'Tokyo' title with 'Day 2 · 26 Sep'; date strip 25 26(selected blue) 27 28 29 30; weather 23° sunny; compact 'Plan A' / 'Rain plan' segmented control; a clear vertical timeline of three place rows with authentic little photo thumbnails: 09:00 Senso-ji, 12:00 Asakusa lunch, 16:00 Shibuya Sky. Real times and travel connections 18 min train / 22 min walk. Bottom '+ Add stop' and 'Suggest route' simple controls. Right map beautifully rendered plausible Tokyo neighborhood geography, pale fine street grid, Sumida river in light blue, Ueno green park, labeled Asakusa, Ueno, Shibuya, central water and fine neighborhood labels, clear route line joins 1 / 2 / 3 markers. Main upper map search field 'Search places', compact layers and zoom controls. A selected Shibuya Sky location has a small anchored photographic place popover with name, 16:00 and 'View place'. Map is informative dense but serene and genuinely cartographic, NOT a cartoon island, NO invented game-like scenery, NO 3D structures. A bottom map strip small compact summary '3 stops · 6.2 km · 42 min transit'. Tiny friendly yellow-hat cat near bottom panel named Boomi. Avoid generic dashboard metric cards, gradients, marketing copy, floating glass. Useful, distinctive, refined. English labels with occasional real Japanese neighborhood map characters allowed. All layout content looks implementable as a real browser app.
```

### c-field-journal

```text
Use case: ui-mockup. Create one polished high fidelity desktop web app screenshot of BOOMVOY personal travel planner, direction C: playful Japanese travel field journal. Landscape 1440x960, straight-on full UI, no device, no background staging. The art direction must look original and carefully art directed, combining butter yellow, very pale lavender margin, sharp dark navy ink, one vivid grass green action color. A tidy travel notebook with abundant quiet space, fine understated notebook ruling only inside journal notes, playful small custom ink line illustrations. No beige-terracotta palette, no random sticker clutter, no handwriting in functional controls, no gradients or big shadows. App topbar brand BOOMVOY tiny black-white cat explorer in a yellow hat; navigation My trips / Explore; '+ New trip' green button. Show a trip workspace overview, heading 'Japan 2026' and real sample dates '25 Sep – 4 Oct · 10 days · 2 travellers'. Horizontal clean text navigation Overview (active underline) / Itinerary / Saved / Bookings / Budget / Journal. Below layout resembles an open travel notebook but fully readable flat interface: left two-thirds a large landscape Japan route illustrated in beautiful restrained ink-and-watercolor style, Tokyo landmarks, little Mount Fuji, Kyoto pagoda, Osaka tower, each connected with clear route dots and thin curved rail line, tiny destination labels and days Tokyo 1–3, Fuji 4, Kyoto 5–7, Osaka 8–10. The illustrated route is the main identity piece and occupies a broad 300px tall region, not a huge decorative hero. Under it left a clean '26 Sep · Tokyo' timeline with 09:00 Senso-ji / 12:00 Asakusa lunch / 16:00 Shibuya Sky, little square travel photo thumbnails and '+ Add stop'. Right a lavender-edged practical notebook page 'Before you go' 3 checkboxes Flights booked (checked), Choose Kyoto stay (unchecked), Reserve Shibuya Sky (unchecked); below a carefully designed single boarding-pass ticket 'MEL → NRT', '25 SEP', 'Flight saved', tiny ticket perforation; below 'Trip notes' with one readable handwritten user note 'Leave an afternoon for getting lost.' A small polished existing-style black-white cute explorer cat, yellow safari hat, yellow scarf, tiny camera stands at right lower margin, labelled 'Boomi', occupying at most 7% width. A quiet small link 'Ask Boomi'. Make character charming but content dominant. Exact concise English functional labels. Charming without feeling childish, practical without rigid equal cards, like a contemporary independent Japanese travel stationery brand made into a real app.
```
