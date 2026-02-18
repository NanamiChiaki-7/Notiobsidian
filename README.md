<div align="center">

# 🌐 Notiobsidian

![](https://count.getloli.com/get/@NanamiChiaki-7?name=NanamiChiaki-7&theme=rule34&padding=7&offset=0&align=top&scale=1&pixelated=1&darkmode=auto)

<p align="center">
  <a href="https://github.com/NanamiChiaki-7/Notiobsidian/stargazers">
    <img src="https://img.shields.io/github/stars/NanamiChiaki-7/Notiobsidian?style=for-the-badge&color=6b7280&logo=github&logoColor=white" alt="Stars"/>
  </a>
  <a href="https://github.com/NanamiChiaki-7/Notiobsidian/forks">
    <img src="https://img.shields.io/github/forks/NanamiChiaki-7/Notiobsidian?style=for-the-badge&color=10b981&logo=github&logoColor=white" alt="Forks"/>
  </a>
  <a href="https://github.com/NanamiChiaki-7/Notiobsidian/issues">
    <img src="https://img.shields.io/github/issues/NanamiChiaki-7/Notiobsidian?style=for-the-badge&color=f59e0b" alt="Issues"/>
  </a>
  <a href="https://github.com/NanamiChiaki-7/Notiobsidian/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/NanamiChiaki-7/Notiobsidian?style=for-the-badge&color=8b5cf6" alt="MIT License"/>
  </a>
  <img src="https://img.shields.io/badge/Python-3.8+-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python"/>
  <img src="https://img.shields.io/badge/Flask-2.x-000000?style=for-the-badge&logo=flask&logoColor=white" alt="Flask"/>
  <img src="https://img.shields.io/badge/Obsidian_DNA-Local%20First-7c3aed?style=for-the-badge" alt="Local First"/>
  <img src="https://img.shields.io/badge/Notion_UI-Inspired-ff79c6?style=for-the-badge" alt="Notion Style"/>
</p>


[⬇️ 跳转到中文区](#-中文版) · [⬇️ Jump to English](#-english-version)

---

</div>

<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>

---

## 🇨🇳 中文版

<p align="center">
  <br/>
  <sub>本地优先 · 可编程 · Agent-ready 的下一代个人工作空间</sub>
</p>

<h1 align="center">Notiobsidian</h1>

<p align="center">
  <strong>把 Notion 的交互美学 + Obsidian 的本地自由 + AI Agent 原生接口 揉在一起</strong><br/>
  一个完全自托管、可编程、跑在你电脑上的个人第二大脑（目前已是我本人的主力生产力工具）
</p>

<p align="center">
  <a href="#-快速开始">🚀 快速开始</a> •
  <a href="#-核心特性">✨ 核心特性</a> •
  <a href="#-截图预览">📸 截图预览</a> •
  <a href="#-路线图">🛤️ 路线图</a> •
  <a href="#-贡献">🤝 贡献</a> •
  <a href="#-致谢--灵感来源">❤️ 致谢 & 灵感</a> •
  <a href="#-english-version">🇺🇸 English</a>
</p>

<br/>

## ✨ 核心特性（已实现 & 日常在用）

- **本地优先 + Markdown 文件存储** —— 所有数据就是你硬盘上的文件，永不锁仓
- **Notion 风格块式编辑器** —— 支持拖拽、/命令、富媒体、数据库视图雏形
- **自定义语法糖** —— {{TODO}}、{{image}}、{{video}}、{{calc}}、{{notice}} 等扩展块
- **变量系统 & 数据面板** —— 记录习惯/开销/体重等数值，自动生成折线图/饼图/分布图
- **每日追踪器** —— 时间统计 + 情绪日记 + 模板一键插入（我每天写日记都在这里）
- **全局日历视图** —— 从笔记里自动提取 @2026-02-18 [会议] 事件，支持 ICS 导入导出
- **知识图谱** —— vis-network 驱动，拖拽节点、按标签分组、cabinet 文件柜
- **实时提醒 & 桌面通知** —— WebSocket + 浏览器通知（定时/间隔/周几都支持）
- **极简自托管** —— 一条命令 python Notiobsidian.py 就能跑
- **暗黑模式友好** + Tailwind 美化（手机也能凑合看）

## 📸 截图预览
<p align="center">
  <img src="./screenshot/test (1).png" alt="Sidebar & Dashboard" width="45%"/>
  <img src="./screenshot/test (2).png" alt="Daily Tracker with Charts" width="45%"/>
</p>
<p align="center">
  <img src="./screenshot/test (3).png" alt="Knowledge Graph View" width="45%"/>
  <img src="./screenshot/test (4).png" alt="Calendar Events" width="45%"/>
</p>

## 🚀 快速开始（3 分钟跑起来）

1. **克隆仓库**
   ```bash
   git clone https://github.com/NanamiChiaki-7/Notiobsidian.git
   cd Notiobsidian
   ```

2. **安装依赖**（Python 3.8+）
   ```bash
   pip install -r requirements.txt
   ```

3. **启动**
   ```bash
   python Notiobsidian.py
   ```
   → 默认监听 http://0.0.0.0:5004

4. **登录**（首次使用）
   - 用户名：admin
   - 密码：PASSWORD（启动后立刻去改！见下方安全提示）

5. **开始使用**：浏览器打开 http://localhost:5004 即可看到欢迎页和示例内容

**生产建议**：
- 用环境变量设置 SECRET_KEY 和密码
- 加 `--host 0.0.0.0 --port 你的端口` 或用 gunicorn / uvicorn 部署
- 数据文件：`nation_pro_v3.db`（SQLite），记得定期备份！

## 🛤️ 路线图（2026 计划）

- [x] 基本笔记 + TODO + 日历 + 图谱 + 追踪器
- [ ] 完善图片/视频上传 & 拖拽排序
- [ ] 提醒真正定时推送（apscheduler / 系统托盘 /手机APP FCM）
- [ ] Agent 接口（Python 函数暴露给 LLM 调用）
- [ ] 移动端响应式优化
- [ ] 主题切换（光暗 + 自定义配色）
- [ ] 数据导入（Notion / Obsidian / Markdown 文件夹）
- [ ] Docker 一键部署

欢迎 PR 加速这些功能！

## 🤝 贡献

欢迎 issue、PR、想法！

1. Fork → branch
2. 改动后加测试（如果有）→ 提交清晰 commit
3. 发 PR，描述清楚做了什么

喜欢就点个 ⭐ 支持一下～

<div align="right">
  <a href="#-中文版">⬆️ 返回顶部</a> · <a href="#-english-version">🇺🇸 English Version</a>
</div>

<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>

---

## 🇺🇸 English Version

<p align="center">
  <br/>
  <sub>Local-first · Programmable · Agent-ready Next-Gen Personal Workspace</sub>
</p>

<p align="center">
  <strong>Combining Notion's interactive aesthetics + Obsidian's local freedom + Native AI Agent interface</strong><br/>
  A fully self-hosted, programmable second brain running on your computer (Currently my daily driver)
</p>

<p align="center">
  <a href="#-quick-start">🚀 Quick Start</a> •
  <a href="#-core-features">✨ Core Features</a> •
  <a href="#-screenshots">📸 Screenshots</a> •
  <a href="#-roadmap">🛤️ Roadmap</a> •
  <a href="#-contributing">🤝 Contributing</a> •
  <a href="#-credits--inspiration">❤️ Credits & Inspiration</a> •
  <a href="#-中文版">🇨🇳 中文版</a>
</p>

<br/>

## ✨ Core Features (Implemented & Daily Usage)

- **Local-first + Markdown File Storage** —— All data is files on your hard drive, never locked in
- **Notion-style Block Editor** —— Drag & drop, /commands, rich media, database view prototype
- **Custom Syntax Sugar** —— {{TODO}}, {{image}}, {{video}}, {{calc}}, {{notice}} extension blocks
- **Variable System & Data Dashboard** —— Track habits/expenses/weight, auto-generate line charts/pie charts/distributions
- **Daily Tracker** —— Time statistics + Mood journal + One-click template insertion (I write my daily journal here)
- **Global Calendar View** —— Auto-extract @2026-02-18 [Meeting] events from notes, ICS import/export support
- **Knowledge Graph** —— vis-network powered, drag nodes, group by tags, cabinet file organizer
- **Real-time Reminders & Desktop Notifications** —— WebSocket + Browser notifications (supports scheduled/intervals/weekdays)
- **Minimal Self-hosting** —— One command: python Notiobsidian.py
- **Dark Mode Friendly** + Tailwind styling (mobile-friendly enough)

## 📸 Screenshots 

<p align="center">
  <img src="./screenshot/test (1).png" alt="Sidebar & Dashboard" width="45%"/>
  <img src="./screenshot/test (2).png" alt="Daily Tracker with Charts" width="45%"/>
</p>
<p align="center">
  <img src="./screenshot/test (3).png" alt="Knowledge Graph View" width="45%"/>
  <img src="./screenshot/test (4).png" alt="Calendar Events" width="45%"/>
</p>

## 🚀 Quick Start (Up in 3 minutes)

1. **Clone Repository**
   ```bash
   git clone https://github.com/NanamiChiaki-7/Notiobsidian.git
   cd Notiobsidian
   ```

2. **Install Dependencies** (Python 3.8+)
   ```bash
   pip install -r requirements.txt
   ```

3. **Launch**
   ```bash
   python Notiobsidian.py
   ```
   → Default listening on http://0.0.0.0:5004

4. **Login** (First time)
   - Username: admin
   - Password: PASSWORD (Change immediately after start! See security note below)

5. **Start Using**: Open browser at http://localhost:5004 to see welcome page and sample content

**Production Tips**:
- Set SECRET_KEY and password via environment variables
- Add `--host 0.0.0.0 --port your_port` or deploy with gunicorn/uvicorn
- Data file: `nation_pro_v3.db` (SQLite), remember to backup regularly!

## 🛤️ Roadmap (2026 Plans)

- [x] Basic notes + TODO + Calendar + Graph + Tracker
- [ ] Improve image/video upload & drag-drop sorting
- [ ] Real scheduled push notifications (apscheduler / system tray / mobile app FCM)
- [ ] Agent interface (Expose Python functions to LLM calls)
- [ ] Mobile responsive optimization
- [ ] Theme switching (light/dark + custom colors)
- [ ] Data import (Notion / Obsidian / Markdown folders)
- [ ] One-click Docker deployment

PRs welcome to accelerate these features!

## 🤝 Contributing

Welcome issues, PRs, and ideas!

1. Fork → branch
2. Add tests after changes (if applicable) → commit with clear messages
3. Submit PR with clear description of what you did

If you like it, give it a ⭐ for support～

## ❤️ Credits & Inspiration

- Obsidian: Ultimate freedom of local Markdown + graphs
- Notion: Block editing + beautiful interactions
- Logseq / Anytype: Various inspirations from the local-first community
- Flask + vis-network + marked.js + Chart.js and other open source heroes

<div align="right">
  <a href="#-english-version">⬆️ Back to Top</a> · <a href="#-中文版">🇨🇳 中文版</a>
</div>

<br>
<br>

---

<div align="center">
  <sub>Last updated: February 2026 · 最后更新：2026年2月</sub>
</div>
```
