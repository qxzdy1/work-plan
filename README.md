# 工作计划日历

一个基于 **HTML / CSS / JavaScript** + **Supabase** 的响应式任务日历网站。

- 📅 **块 A**：月历，按当天任务数量显示热力图，点击日期新增/编辑任务。
- 📋 **块 B**：当天 06:00–24:00 日程表，任务块按精确时间比例定位，按重要程度上色。
- 💬 **块 C**：留言板。
- 📢 **块 D**：公告栏（只读，后端在 Supabase 后台维护）。

在线预览：待部署后填写

---

## 快速开始

### 1. 配置 Supabase

打开项目 `js/config.js`，确认以下内容（已经填好你的项目信息）：

```js
const SUPABASE_URL = 'https://xomsritnqbjlncsxwkml.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_sC0evOBDEo9Xw3g_Pnb8Vw_i8QGNw9r';
```

> ⚠️ **不要把 `service_role key` 写进这个文件或任何前端代码里。**

### 2. 在 Supabase 控制台执行 SQL

进入 Supabase 项目 → `SQL Editor` → `New query`，复制并运行以下脚本：

```sql
-- 给 tasks 表增加结束时间字段（原有 task_time 作为开始时间）
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ;

-- 留言表
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  author TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 公告表（仅管理员在后台写入，前端只读）
CREATE TABLE IF NOT EXISTS announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 启用行级安全（RLS）
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- 公开可写策略（目前不做登录，任何人可读写任务和留言）
CREATE POLICY "allow_all_tasks" ON tasks
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "allow_all_messages" ON messages
  FOR ALL USING (true) WITH CHECK (true);

-- 公告只允许读取
CREATE POLICY "allow_select_announcements" ON announcements
  FOR SELECT USING (true);
```

执行后可以在 Table Editor 里看到 `tasks` 表多了 `end_time` 字段，以及新建的 `messages` 和 `announcements` 表。

### 3. 本地预览

因为浏览器安全策略，直接双击 `index.html` 打开可能会导致 CDN 资源加载正常但部分功能受限。推荐以下方式：

#### 方式一：VS Code Live Server

安装 Live Server 插件，右键 `index.html` → **Open with Live Server**。

#### 方式二：Python 临时服务器

```bash
python -m http.server 8080
# 然后访问 http://localhost:8080
```

#### 方式三：Node.js

```bash
npx serve .
# 然后访问 http://localhost:3000
```

### 4. 发布到 GitHub Pages（可选）

仓库已经包含静态文件，直接在 GitHub 仓库设置里启用 **Pages** → Source 选择 `main` 分支的 `/ (root)` 即可。

---

## 项目结构

```
work-plan/
├── index.html          # 页面结构
├── css/
│   └── style.css       # 样式与响应式布局
├── js/
│   ├── config.js       # Supabase 配置常量（方便后续改成环境变量）
│   └── app.js          # 业务逻辑
└── README.md           # 本说明
```

---

## 使用说明

1. **新增任务**：点击左侧日历任意日期 → 填写弹窗 → 确定。
2. **编辑任务**：点击右侧日程表里的任务块。
3. **删除任务**：点击日程表右上角 🗑️ 进入删除模式，再点击任务块右上角的小叉。
4. **留言**：在左下角块 C 填写昵称和留言，点击提交。
5. **发布公告**：直接在 Supabase Table Editor 里向 `announcements` 表插入一行 `content`，前端会自动读取。

---

## 后续可扩展

- 在 `js/config.js` 里把 `SUPABASE_URL` / `SUPABASE_ANON_KEY` 改成通过 CI/CD 环境变量注入。
- 如需登录，可接入 Supabase Auth，并把 RLS 策略改成 `auth.uid() = user_id`。
- 如需在前端写公告，可新增一个带密码验证的管理页面，或接入 Supabase Auth 管理员角色。

---

## 技术栈

- HTML5 / CSS3 / Vanilla JavaScript
- [Supabase JS Client v2](https://supabase.com/docs/reference/javascript/introduction)
- 响应式布局，适配手机与电脑
