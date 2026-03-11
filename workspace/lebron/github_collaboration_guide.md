# GitHub 双人协作开发操作手册

## 1. 协作方式

推荐使用下面这套流程：

- 一个共同仓库
- 不直接改 `main`
- 每个人在自己的分支开发
- 开发完成后发 Pull Request（PR）
- 由同伴 review 后再合并

这是最稳妥、最常见的双人协作方式。

---

## 2. 创建仓库并邀请同伴

### 2.1 创建仓库

在 GitHub 上：

1. 点击 **New repository**
2. 填写仓库名
3. 选择 `public` 或 `private`
4. 创建仓库

建议顺便初始化：

- `README`
- `.gitignore`
- License（如果是开源项目）

### 2.2 邀请同伴

仓库创建者进入：

- `Settings`
- `Collaborators and teams`
- `Add people`
- 输入对方 GitHub 用户名
- 发送邀请

对方接受邀请后，就可以一起开发。

---

## 3. 第一次拉取仓库

双方都在本地执行：

```bash
git clone https://github.com/你的用户名/仓库名.git
cd 仓库名
```

确认远端配置：

```bash
git remote -v
```

示例输出：

```bash
origin  https://github.com/你的用户名/仓库名.git (fetch)
origin  https://github.com/你的用户名/仓库名.git (push)
```

---

## 4. 协作基本规则

建议先约定这 5 条规则：

1. `main` 只放稳定代码
2. 不直接往 `main` 推送
3. 每个新任务单独开一个分支
4. 开发完成后发 PR 合并
5. 开工前先同步最新 `main`

只要做到这几条，协作就会顺畅很多。

---

## 5. 每次开发的标准流程

下面以“开发登录页功能”为例。

### 5.1 先同步主分支

```bash
git checkout main
git pull origin main
```

### 5.2 创建自己的功能分支

```bash
git checkout -b feature/login-page
```

推荐分支命名规范：

- `feature/xxx`：新功能
- `fix/xxx`：修 bug
- `docs/xxx`：文档修改
- `refactor/xxx`：重构

示例：

```text
feature/user-profile
fix/navbar-error
docs/install-guide
```

### 5.3 编写代码

修改代码后，可先检查状态：

```bash
git status
```

### 5.4 提交代码

```bash
git add .
git commit -m "add login page UI"
```

提交信息不要写成 `update`、`test` 这种模糊内容，建议写清楚，例如：

- `add login page UI`
- `fix token refresh bug`
- `update README install steps`

### 5.5 推送到 GitHub

```bash
git push origin feature/login-page
```

### 5.6 发 Pull Request

在 GitHub 页面点击 **Compare & pull request**，提交 PR。

PR 描述建议写清楚：

```text
本次修改：
- 新增登录页
- 增加邮箱和密码输入框
- 增加登录按钮

测试情况：
- 页面可正常打开
- 按钮点击正常
```

### 5.7 同伴 review 后合并

另一位协作者在 GitHub 中：

- 查看代码改动
- 提出意见或直接通过
- 点击 `Merge pull request`

这样代码才进入 `main`。

---

## 6. 另一个同伴的流程

同伴也是一样的流程。比如开发注册页：

```bash
git checkout main
git pull origin main
git checkout -b feature/register-page
```

开发完成后：

```bash
git add .
git commit -m "add register page"
git push origin feature/register-page
```

然后发 PR，review 后合并。

---

## 7. 如何避免互相覆盖

### 7.1 基本原则

尽量不要两个人同时改同一个文件的同一段代码。

例如：

- 一个人负责后端 API
- 一个人负责前端页面

这样冲突最少。

### 7.2 每次开工前先同步

```bash
git checkout main
git pull origin main
```

### 7.3 开发过程中同步主分支更新

如果别人已经向 `main` 合并了新代码，而你还在自己的分支开发，可以把最新 `main` 合到自己的分支里。

#### 方式一：merge（更容易理解）

```bash
git checkout main
git pull origin main
git checkout feature/login-page
git merge main
```

#### 方式二：rebase（历史更整洁）

```bash
git fetch origin
git rebase origin/main
```

新手优先用 `merge` 即可。

---

## 8. 出现冲突怎么办

如果两个人修改了同一个位置，Git 可能提示冲突。

先查看状态：

```bash
git status
```

冲突文件中会出现类似内容：

```text
<<<<<<< HEAD
你的代码
=======
对方代码
>>>>>>> main
```

处理方法：

1. 手动打开文件
2. 删除冲突标记
3. 保留正确的最终内容
4. 保存文件

然后执行：

```bash
git add .
git commit -m "resolve merge conflict"
```

如果是 `rebase` 过程中冲突，通常执行：

```bash
git add .
git rebase --continue
```

---

## 9. 推荐分工方式

建议按模块分工，而不是随意按文件抢着改。

例如：

- 你负责 `backend/`
- 同伴负责 `frontend/`

或者：

- 你负责登录模块
- 同伴负责个人中心模块

这样更容易管理，也更少冲突。

---

## 10. GitHub 上推荐配套功能

### 10.1 Issues

可以用来记录任务，例如：

- 实现登录页
- 增加用户资料接口
- 修复导航栏错位
- 补充部署文档

### 10.2 Branch protection

为了防止误操作，可以保护 `main` 分支。

路径：

- `Settings`
- `Branches`
- 添加规则

推荐设置：

- 不允许直接 push 到 `main`
- 必须通过 PR 合并

---

## 11. 推荐的最小团队规范

### 11.1 分支命名

```text
main
feature/功能名
fix/问题名
docs/文档名
```

### 11.2 提交信息

```text
add login api
fix avatar upload bug
update install guide
refactor auth middleware
```

### 11.3 协作规则

```text
1. main 不直接提交
2. 每个任务单独开分支
3. 完成后发 PR
4. 合并前至少看一遍代码
5. 开工前先 pull 最新 main
```

---

## 12. 常用命令速查

### 克隆仓库

```bash
git clone 仓库地址
```

### 查看分支

```bash
git branch
git branch -a
```

### 切换分支

```bash
git checkout main
```

### 新建并切换分支

```bash
git checkout -b feature/test
```

### 查看状态

```bash
git status
```

### 添加文件

```bash
git add .
```

### 提交代码

```bash
git commit -m "your message"
```

### 推送分支

```bash
git push origin 分支名
```

### 拉取主分支最新代码

```bash
git checkout main
git pull origin main
```

### 合并主分支到当前分支

```bash
git merge main
```

---

## 13. 最常见错误

### 13.1 直接在 `main` 开发

不推荐，容易把不稳定代码直接带进主分支。

### 13.2 不同步就开始写

容易与别人的更新冲突。

### 13.3 提交信息乱写

以后很难追踪历史。

### 13.4 两个人同时修改同一段代码

冲突概率很高。

### 13.5 push 失败却没发现

一定要看终端输出，确认 push 确实成功。

---

## 14. 完整示例

假设你们在做一个博客项目。

### 你开发后端登录接口

```bash
git checkout main
git pull origin main
git checkout -b feature/login-api
# 写代码
git add .
git commit -m "add login api"
git push origin feature/login-api
```

### 同伴开发前端登录页面

```bash
git checkout main
git pull origin main
git checkout -b feature/login-ui
# 写代码
git add .
git commit -m "add login page ui"
git push origin feature/login-ui
```

然后双方分别发 PR，审核通过后合并到 `main`。

---

## 15. 一句话总结

GitHub 双人协作开发最稳的方式就是：

**先 pull，开新分支，写完 push，发 PR，再合并。**

