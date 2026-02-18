# app/utils/helpers.py
import re
import json
from datetime import datetime
from app import db
from app.models.page import Page, DailyLog

def parse_content_meta(pages):
    """解析页面内容，提取节点、边和标签"""
    nodes = []
    edges = []
    page_map = {p.title: p.id for p in pages}
    page_tags = {}

    link_pattern = re.compile(r'\[\[@(.*?)\]\]')
    tag_pattern = re.compile(r'\[\[(?!@)(.*?)\]\]')

    for p in pages:
        tags = tag_pattern.findall(p.content)
        page_tags[p.id] = list(set(tags))

        nodes.append({
            'id': p.id,
            'label': f"{p.icon} {p.title}",
            'group': p.page_type,
            'tags': page_tags[p.id],
            'last_modified': p.created_at.strftime('%Y-%m-%d') if p.created_at else ''
        })

        links = link_pattern.findall(p.content)
        for link_title in links:
            target_id = page_map.get(link_title)
            if target_id:
                edges.append({'from': p.id, 'to': target_id})

    return nodes, edges, page_tags

def extract_calendar_events():
    """从所有页面中提取日历事件"""
    events = []
    pages = Page.query.all()
    
    pattern = re.compile(r'@(\d{4}[.\-]\d{2}[.\-]\d{2})(?:\s+(\d{1,2}:\d{2})(?:-(\d{1,2}:\d{2}))?)?\s*\[(.*?)(?:\|(.*?))?\]')
    
    for p in pages:
        matches = pattern.findall(p.content)
        for date_str, start_time, end_time, event_name, reminder_rule in matches:
            clean_date = date_str.replace('.', '-')
            events.append({
                'id': p.id,
                'title': event_name,
                'date': clean_date,
                'start': start_time if start_time else None,
                'end': end_time if end_time else None,
                'source_page': p.title,
                'reminder': reminder_rule.strip() if reminder_rule else None
            })
    return events

def extract_notices():
    """从所有页面中提取通知组件"""
    notices = []
    pages = Page.query.all()
    pattern = re.compile(r'\{\{notice\|(.*?)\|(.*?)\}\}')
    
    for p in pages:
        matches = pattern.findall(p.content)
        for condition, content in matches:
            notices.append({
                'page_id': p.id,
                'source_page': p.title,
                'condition': condition.strip(),
                'content': content.strip()
            })
    return notices

def init_db_data():
    """初始化数据库测试数据"""
    from app.models.page import Page
    
    intro_content = """
# 📖 Notiobsidian 使用指南

> **欢迎使用 Notiobsidian 个人知识库系统**  
> 本页面展示了所有支持的格式和组件，可用于自检渲染是否正常工作。

[[@每日追踪]] [[@知识图谱]] [[@日历视图]]

---

## 一、📝 基础 Markdown 语法

### 1.1 标题样式
# H1 一级标题
## H2 二级标题
### H3 三级标题
#### H4 四级标题
##### H5 五级标题
###### H6 六级标题

### 1.2 文本样式
**粗体文字** | *斜体文字* | ***粗斜体*** | ~~删除线~~ | `行内代码`

### 1.3 列表
- 无序列表项 1
- 无序列表项 2
  - 嵌套列表项 A
  - 嵌套列表项 B

1. 有序列表项 1
2. 有序列表项 2
   1. 嵌套有序列表 a
   2. 嵌套有序列表 b

### 1.4 引用与分隔线
> 这是一段引用文字
> 可以有多行内容
> 展示引用块效果

---

### 1.5 表格
| 功能 | 语法 | 示例 |
|------|------|------|
| 页面链接 | `[[@页面名]]` | [[@每日追踪]] |
| 标签 | `[[标签]]` | [[工作]] |
| 时间链接 | `@日期 时间` | @2024.01.15 14:00 |

---

## 二、🔗 LifeDrive 扩展语法

### 2.1 页面链接 `[[@页面名]]`
- ✅ 存在的页面：[[@每日追踪]] [[@知识图谱]]
- ❌ 不存在的页面：[[@不存在的页面]] [[@测试页面]]

### 2.2 标签 `[[标签名]]`
[[工作]] [[学习]] [[生活]] [[重要]] [[待办]] [[归档]]
[[Python]] [[JavaScript]] [[Flask]] [[React]] [[Vue]]

### 2.3 时间链接 `@YYYY.MM.DD HH:MM`
- 全天事件：@2024.01.15
- 具体时间：@2024.01.15 14:00
- 时间段：@2024.01.15 14:00-15:30
- 连字符格式：@2024-01-15 09:00

---

## 三、✅ 待办清单组件

### 3.1 基础待办
{{TODO}}
- [ ] 阅读使用指南
- [×] 创建第一个页面
- [ ] 体验图谱功能
- [×] 设置日历事件
- [ ] 尝试提醒组件
{{/TODO}}

### 3.2 带时间和链接的待办
{{TODO}}
- [ ] 写周报 @2024.01.20 [[@工作]]
- [✓] 开会讨论 @2024.01.15 10:00 [[@会议]]
- [ ] 代码审查 @2024.01.16 [[@Python]]
{{/TODO}}

---

## 四、🖼️ 多媒体组件

### 4.1 图片上传占位符
{{image}}
*点击上方占位符可上传图片*

### 4.2 视频上传占位符
{{video}}
*点击上方占位符可上传视频*

### 4.3 带路径的示例（有图后显示）
{{image|https://picsum.photos/400/200?random=1}}
{{image|https://picsum.photos/400/200?random=2}}

---

## 五、⏰ 提醒组件大全

### 5.1 空提醒（显示构建器）
{{notice}}

### 5.2 绝对时间提醒
{{notice|time 2024.12.31 23:59|跨年倒计时}}
{{notice|2025.01.01 00:00|新年快乐}}

### 5.3 每日重复提醒
{{notice|daily 09:00|☕ 每日站会}}
{{notice|daily 18:00|🏠 下班打卡}}
{{notice|daily 22:00|😴 准备睡觉}}

### 5.4 每周重复提醒
{{notice|weekly Mon 10:00|📊 周一例会}}
{{notice|weekly Fri 16:00|🎉 周五周报}}
{{notice|weekly Wed 14:30|📝 项目评审}}

### 5.5 间隔重复提醒
{{notice|every 15m|💧 喝水提醒}}
{{notice|every 1h|🍚 每小时}}
{{notice|every 2h|👀 休息一下}}

### 5.6 复杂间隔提醒
{{notice|every 45m|📚 番茄时钟}}
{{notice|every 90m|🧠 深度工作周期}}
{{notice|every 2h30m|⚡ 长间隔}}

### 5.7 范围间隔提醒
{{notice|every 5-10s|🎲 随机间隔测试}}
{{notice|every 15-30m|🔄 灵活休息}}
{{notice|every 1-2h|📈 弹性提醒}}

### 5.8 快捷方式提醒
{{notice|@hourly|🕐 每小时整点}}
{{notice|@daily|📅 每天午夜}}
{{notice|@weekly|📆 每周一凌晨}}
{{notice|@monthly|🗓️ 每月1号}}

### 5.9 模糊间隔提醒
{{notice|every few seconds|⚡ 约每7秒}}
{{notice|every few minutes|⏰ 约每3分钟}}
{{notice|every few hours|⌛ 约每2小时}}

### 5.10 工作日/周末提醒
{{notice|weekdays 08:00|🌅 工作日早安}}
{{notice|weekends 10:00|😎 周末睡个懒觉}}

---

## 六、📅 日历事件示例

@2024.12.24 [圣诞节🎄]

---

## 七、🎨 HTML 内联样式示例

### 7.1 文字颜色
<span style="color: #ff0000;">红色文字</span>
<span style="color: #00ff00;">绿色文字</span>
<span style="color: rgb(99, 102, 241);">紫色文字</span>
<span style="color: #f59e0b;">橙色文字</span>

### 7.2 文字大小
<span style="font-size: 20px;">大号文字 (20px)</span>
<span style="font-size: 12px;">小号文字 (12px)</span>
<span style="font-size: 150%;">相对大小 (150%)</span>

### 7.3 文字样式组合
<span style="font-weight: bold; color: #6366f1;">粗体紫色</span>
<span style="font-style: italic; text-decoration: underline;">斜体下划线</span>
<span style="background: #fff3cd; padding: 2px 4px;">高亮背景</span>

### 7.4 段落样式
<p style="text-align: center;">这是居中对齐的段落文本，展示文本对齐效果。</p>
<p style="text-align: right;">这是右对齐的段落文本，展示文本对齐效果。</p>
<p style="line-height: 2.0;">这是宽行间距的段落，行高为2.0，让文本阅读更舒适。</p>

### 7.5 边框与卡片
<div style="border-left: 4px solid #6366f1; padding-left: 16px; margin: 16px 0;">
  <strong>左侧边框引用</strong><br>
  这是一个带左侧边框的引用块样式，适合突出显示重要内容。
</div>

<div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
  <strong>📦 圆角卡片</strong><br>
  这是一个带圆角、边框和轻微阴影的卡片样式。
</div>

### 7.6 Tailwind 类名支持
<span class="text-red-500">红色文字 (Tailwind)</span>
<span class="bg-blue-100 px-2 py-1 rounded">蓝色标签</span>
<span class="bg-green-100 text-green-800 px-2 py-1 rounded-full">绿色圆角标签</span>
<div class="shadow-md p-4 bg-white rounded-lg mt-2">阴影卡片 (Tailwind)</div>

---

## 八、🔧 组合示例

### 8.1 完整会议笔记
# 📝 项目启动会议 [[@项目计划]]

**时间**：@2024.01.20 14:00-16:30
**地点**：线上会议室
**参与人**：[[@张三]] [[@李四]] [[@王五]]
**标签**：[[工作]] [[会议]] [[重要]]

> **会议目标**：确定项目技术栈和分工

## 议程
1. 技术选型讨论
   - 前端：React + TypeScript
   - 后端：Flask + SQLAlchemy
   - 数据库：PostgreSQL

2. 时间规划
   - 原型设计：1周
   - 开发阶段：4周
   - 测试部署：1周

## 待办事项
{{TODO}}
- [ ] 搭建项目脚手架 @张三
- [ ] 设计数据库模型 @李四
- [ ] 编写API文档 @王五
{{/TODO}}

## 提醒设置
{{notice|daily 09:30|每日站会}}
{{notice|weekly Mon 14:00|项目周会}}

### 8.2 学习笔记卡片
# 📚 [[Python]] 装饰器进阶

## 定义
> 装饰器是一种高阶函数，用于修改其他函数的行为

## 示例代码
```python
def timer(func):
    def wrapper(*args, **kwargs):
        import time
        start = time.time()
        result = func(*args, **kwargs)
        print(f"执行时间: {time.time()-start:.2f}s")
        return result
    return wrapper

@timer
def slow_function():
    import time
    time.sleep(1)
```

## 标签
[[编程]] [[进阶]] [[Python]] [[函数式编程]]

---

## 九、📊 页面类型预览

### 当前页面类型：**文档页 (doc)**
- ✅ 完整 Markdown 支持
- ✅ 所有组件可用
- ✅ HTML 样式生效

### 其他页面类型：
- [[@每日追踪]] → **时间追踪器** (tracker)
- [[@知识图谱]] → **关系图谱** (graph)
- [[@日历视图]] → **全局日历** (calendar)

---

## 十、🔍 自检清单

| 组件 | 状态 | 说明 |
|------|------|------|
| 基础 Markdown | ✅ 正常 | 标题/列表/引用/表格 |
| 页面链接 | ✅ 正常 | [[@页面名]] 格式 |
| 标签 | ✅ 正常 | [[标签]] 显示为 #标签 |
| 时间链接 | ✅ 正常 | @日期 转换为日历链接 |
| 待办清单 | ✅ 正常 | 复选框可交互 |
| 图片组件 | ✅ 正常 | 点击占位符可上传 |
| 视频组件 | ✅ 正常 | 点击占位符可上传 |
| 提醒组件 | ✅ 正常 | 所有提醒格式 |
| HTML样式 | ✅ 正常 | 内联样式/Tailwind |
| 日历事件 | ✅ 正常 | 日历视图可见 |

---

> **💡 提示**：如果以上任何组件显示异常，请检查：
> - 浏览器控制台是否有报错
> - WebSocket 连接是否正常
> - 相关 JS 文件是否加载成功

---

这个修改后的初始化函数创建了一个全面的使用指南页面，包含：

## 主要特性展示

1. **基础 Markdown 语法** - 标题、列表、表格、引用
2. **扩展语法** - 页面链接、标签、时间链接
3. **待办清单** - 基础待办和带时间/链接的待办
4. **多媒体组件** - 图片/视频上传占位符
5. **提醒组件大全** - 所有支持的提醒格式：
   - 绝对时间、每日、每周
   - 间隔重复（秒/分/时）
   - 复杂间隔、范围间隔
   - 快捷方式、模糊间隔
   - 工作日/周末提醒
6. **日历事件** - 全天/具体时间/带提醒的事件
7. **HTML 样式** - 颜色、大小、边框、卡片、Tailwind类
8. **组合示例** - 完整会议笔记、学习卡片
9. **自检清单** - 方便用户验证所有功能

页面标题使用图标 `📖`，方便在侧边栏识别，同时作为系统初始首页的理想选择。

---

*最后更新：2025.02.18*
*版本：Notiobsidian v1.0*
<span style="color: #9ca3af; font-size: 10px;">✨ 所有组件均可正常工作 ✨</span>
"""  
    

    intro_content_en = """
# 📖 Notiobsidian User Guide

> **Welcome to the Notiobsidian Personal Knowledge Base System**  
> This page demonstrates all supported formats and components for self-checking rendering functionality.

[[@DailyTracker]] [[@KnowledgeGraph]] [[@CalendarView]]

---

## 1. 📝 Basic Markdown Syntax

### 1.1 Heading Styles
# H1 Heading Level 1
## H2 Heading Level 2
### H3 Heading Level 3
#### H4 Heading Level 4
##### H5 Heading Level 5
###### H6 Heading Level 6

### 1.2 Text Styles
**Bold text** | *Italic text* | ***Bold italic*** | ~~Strikethrough~~ | `Inline code`

### 1.3 Lists
- Unordered list item 1
- Unordered list item 2
  - Nested list item A
  - Nested list item B

1. Ordered list item 1
2. Ordered list item 2
   1. Nested ordered list a
   2. Nested ordered list b

### 1.4 Blockquotes & Horizontal Rules
> This is a blockquote
> It can span multiple lines
> Demonstrating blockquote styling

---

### 1.5 Tables
| Feature | Syntax | Example |
|---------|--------|---------|
| Page Link | `[[@PageName]]` | [[@DailyTracker]] |
| Tag | `[[Tag]]` | [[Work]] |
| Time Link | `@Date Time` | @2024.01.15 14:00 |

---

## 2. 🔗 Notiobsidian Extended Syntax

### 2.1 Page Links `[[@PageName]]`
- ✅ Existing pages: [[@DailyTracker]] [[@KnowledgeGraph]]
- ❌ Non-existent pages: [[@NonExistentPage]] [[@TestPage]]

### 2.2 Tags `[[TagName]]`
[[Work]] [[Study]] [[Life]] [[Important]] [[Todo]] [[Archive]]
[[Python]] [[JavaScript]] [[Flask]] [[React]] [[Vue]]

### 2.3 Time Links `@YYYY.MM.DD HH:MM`
- All-day event: @2024.01.15
- Specific time: @2024.01.15 14:00
- Time range: @2024.01.15 14:00-15:30
- Hyphen format: @2024-01-15 09:00

---

## 3. ✅ Todo List Component

### 3.1 Basic Todos
{{TODO}}
- [ ] Read user guide
- [x] Create first page
- [ ] Experience graph features
- [x] Set up calendar events
- [ ] Try reminder components
{{/TODO}}

### 3.2 Todos with Time and Links
{{TODO}}
- [ ] Write weekly report @2024.01.20 [[@Work]]
- [✓] Team meeting @2024.01.15 10:00 [[@Meeting]]
- [ ] Code review @2024.01.16 [[@Python]]
{{/TODO}}

---

## 4. 🖼️ Media Components

### 4.1 Image Upload Placeholder
{{image}}
*Click the placeholder above to upload an image*

### 4.2 Video Upload Placeholder
{{video}}
*Click the placeholder above to upload a video*

### 4.3 Examples with Paths (display after upload)
{{image|https://picsum.photos/400/200?random=1}}
{{image|https://picsum.photos/400/200?random=2}}

---

## 5. ⏰ Reminder Components Complete Guide

### 5.1 Empty Reminder (shows builder)
{{notice}}

### 5.2 Absolute Time Reminders
{{notice|time 2024.12.31 23:59|New Year's Eve Countdown}}
{{notice|2025.01.01 00:00|Happy New Year}}

### 5.3 Daily Recurring Reminders
{{notice|daily 09:00|☕ Daily Standup}}
{{notice|daily 18:00|🏠 Clock Out}}
{{notice|daily 22:00|😴 Bedtime}}

### 5.4 Weekly Recurring Reminders
{{notice|weekly Mon 10:00|📊 Monday Meeting}}
{{notice|weekly Fri 16:00|🎉 Friday Report}}
{{notice|weekly Wed 14:30|📝 Project Review}}

### 5.5 Interval Recurring Reminders
{{notice|every 15m|💧 Hydration Reminder}}
{{notice|every 1h|🍚 Hourly Check}}
{{notice|every 2h|👀 Take a Break}}

### 5.6 Complex Interval Reminders
{{notice|every 45m|📚 Pomodoro Timer}}
{{notice|every 90m|🧠 Deep Work Session}}
{{notice|every 2h30m|⚡ Long Interval}}

### 5.7 Range Interval Reminders
{{notice|every 5-10s|🎲 Random Interval Test}}
{{notice|every 15-30m|🔄 Flexible Break}}
{{notice|every 1-2h|📈 Elastic Reminder}}

### 5.8 Shortcut Reminders
{{notice|@hourly|🕐 Every Hour on the Hour}}
{{notice|@daily|📅 Every Day at Midnight}}
{{notice|@weekly|📆 Every Monday at Midnight}}
{{notice|@monthly|🗓️ First Day of Each Month}}

### 5.9 Fuzzy Interval Reminders
{{notice|every few seconds|⚡ Approximately every 7 seconds}}
{{notice|every few minutes|⏰ Approximately every 3 minutes}}
{{notice|every few hours|⌛ Approximately every 2 hours}}

### 5.10 Weekday/Weekend Reminders
{{notice|weekdays 08:00|🌅 Good Morning (Weekdays)}}
{{notice|weekends 10:00|😎 Sleep In (Weekends)}}

---

## 6. 📅 Calendar Event Examples

@2024.12.24 [Christmas Eve🎄]
@2024.12.31 23:30 [New Year's Party🥳]
@2025.01.01 00:00 [Happy New Year🎉]
@2024.02.14 19:00 [Valentine's Dinner🍷]
@2024.05.01 10:00 [Labor Day Trip🚗|1d]

### Calendar Events with Reminders
@2024.03.08 09:00 [Women's Day Meeting|15m]
@2024.04.01 14:00 [April Fools' Event|30m]
@2024.06.01 10:00 [Children's Day|1h]

---

## 7. 🎨 HTML Inline Style Examples

### 7.1 Text Colors
<span style="color: #ff0000;">Red text</span>
<span style="color: #00ff00;">Green text</span>
<span style="color: rgb(99, 102, 241);">Purple text</span>
<span style="color: #f59e0b;">Orange text</span>

### 7.2 Font Sizes
<span style="font-size: 20px;">Large text (20px)</span>
<span style="font-size: 12px;">Small text (12px)</span>
<span style="font-size: 150%;">Relative size (150%)</span>

### 7.3 Text Style Combinations
<span style="font-weight: bold; color: #6366f1;">Bold purple text</span>
<span style="font-style: italic; text-decoration: underline;">Italic underlined text</span>
<span style="background: #fff3cd; padding: 2px 4px;">Highlighted background</span>

### 7.4 Paragraph Styles
<p style="text-align: center;">This is centered paragraph text, demonstrating text alignment.</p>
<p style="text-align: right;">This is right-aligned paragraph text, demonstrating text alignment.</p>
<p style="line-height: 2.0;">This is wide line spacing text with line-height of 2.0, making reading more comfortable.</p>

### 7.5 Borders & Cards
<div style="border-left: 4px solid #6366f1; padding-left: 16px; margin: 16px 0;">
  <strong>Left Border Quote</strong><br>
  This is a quote block with left border styling, suitable for highlighting important content.
</div>

<div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
  <strong>📦 Rounded Card</strong><br>
  This is a card with rounded corners, border, and subtle shadow styling.
</div>

### 7.6 Tailwind Class Support
<span class="text-red-500">Red text (Tailwind)</span>
<span class="bg-blue-100 px-2 py-1 rounded">Blue tag</span>
<span class="bg-green-100 text-green-800 px-2 py-1 rounded-full">Green rounded tag</span>
<div class="shadow-md p-4 bg-white rounded-lg mt-2">Shadow card (Tailwind)</div>

---

## 8. 🔧 Combined Examples

### 8.1 Complete Meeting Note
# 📝 Project Kickoff Meeting [[@ProjectPlan]]

**Time**: @2024.01.20 14:00-16:30
**Location**: Online Meeting Room
**Participants**: [[@ZhangSan]] [[@LiSi]] [[@WangWu]]
**Tags**: [[Work]] [[Meeting]] [[Important]]

> **Meeting Goal**: Finalize tech stack and task allocation

## Agenda
1. Tech Stack Discussion
   - Frontend: React + TypeScript
   - Backend: Flask + SQLAlchemy
   - Database: PostgreSQL

2. Timeline Planning
   - Prototype Design: 1 week
   - Development Phase: 4 weeks
   - Testing & Deployment: 1 week

## Action Items
{{TODO}}
- [ ] Set up project scaffolding @ZhangSan
- [ ] Design database models @LiSi
- [ ] Write API documentation @WangWu
{{/TODO}}

## Reminder Settings
{{notice|daily 09:30|Daily Standup}}
{{notice|weekly Mon 14:00|Project Weekly Meeting}}

### 8.2 Learning Note Card
# 📚 [[Python]] Decorators Advanced

## Definition
> Decorators are higher-order functions that modify the behavior of other functions

## Code Example
```python
def timer(func):
    def wrapper(*args, **kwargs):
        import time
        start = time.time()
        result = func(*args, **kwargs)
        print(f"Execution time: {time.time()-start:.2f}s")
        return result
    return wrapper

@timer
def slow_function():
    import time
    time.sleep(1)
```

## Tags
[[Programming]] [[Advanced]] [[Python]] [[Functional Programming]]

---

## 9. 📊 Page Type Preview

### Current Page Type: **Document Page (doc)**
- ✅ Full Markdown support
- ✅ All components available
- ✅ HTML styling works

### Other Page Types:
- [[@DailyTracker]] → **Time Tracker** (tracker)
- [[@KnowledgeGraph]] → **Relationship Graph** (graph)
- [[@CalendarView]] → **Global Calendar** (calendar)

---

## 10. 🔍 Self-Check Checklist

| Component | Status | Description |
|-----------|--------|-------------|
| Basic Markdown | ✅ OK | Headings/Lists/Quotes/Tables |
| Page Links | ✅ OK | [[@PageName]] format |
| Tags | ✅ OK | [[Tag]] displays as #tag |
| Time Links | ✅ OK | @Date converts to calendar links |
| Todo Lists | ✅ OK | Interactive checkboxes |
| Image Component | ✅ OK | Click placeholder to upload |
| Video Component | ✅ OK | Click placeholder to upload |
| Reminder Component | ✅ OK | All reminder formats |
| HTML Styling | ✅ OK | Inline styles/Tailwind |
| Calendar Events | ✅ OK | Visible in calendar view |

---

> **💡 Tip**: If any component above displays incorrectly, please check:
> - Browser console for error messages
> - WebSocket connection status
> - Whether related JS files loaded successfully

---

This modified initialization function creates a comprehensive user guide page containing:

## Key Feature Demonstrations

1. **Basic Markdown Syntax** - Headings, lists, tables, blockquotes
2. **Extended Syntax** - Page links, tags, time links
3. **Todo Lists** - Basic todos and todos with time/links
4. **Media Components** - Image/video upload placeholders
5. **Complete Reminder Guide** - All supported reminder formats:
   - Absolute time, daily, weekly
   - Interval repeats (seconds/minutes/hours)
   - Complex intervals, range intervals
   - Shortcuts, fuzzy intervals
   - Weekday/weekend reminders
6. **Calendar Events** - All-day/specific time/reminder-enabled events
7. **HTML Styling** - Colors, sizes, borders, cards, Tailwind classes
8. **Combined Examples** - Complete meeting notes, learning cards
9. **Self-Check Checklist** - Easy verification of all features

The page title uses icon `📖`, making it easily identifiable in the sidebar and ideal as the system's initial homepage.

---

*Last Updated: 2025.02.18*
*Version: Notiobsidian v1.0*
<span style="color: #9ca3af; font-size: 10px;">✨ All components working properly ✨</span>
"""


    
    p1 = Page(title="使用指南", icon="👋", page_type="doc", content=intro_content)
    p2 = Page(title="Hello!", icon="👋", page_type="doc", content=intro_content_en)
    p3 = Page(title="每日追踪", icon="⏱️", page_type="tracker", 
              cover="bg-gradient-to-r from-green-200 to-blue-200")
    p4 = Page(title="知识图谱", icon="🔗", page_type="graph")
    p5 = Page(title="全局日历", icon="📅", page_type="calendar")
    
    db.session.add_all([p1, p2, p3, p4 ,p5])
    db.session.commit()