<p align="center">
  <img src="assets/nanoclaw-lite.png" alt="NanoClaw" width="400">
</p>

<p align="center">
  NanoClaw Lite —— 轻量级 AI 助手，直接在进程中运行 Claude。无需容器，无需重新构建，无 10GB 磁盘浪费。只需复制粘贴技能即可使用。
</p>

<p align="center">
  <a href="https://nanoclaw.dev">nanoclaw.dev</a>&nbsp; • &nbsp;
  <a href="README.md">English</a>&nbsp; • &nbsp;
  <a href="https://discord.gg/VDdww8qS42"><img src="https://img.shields.io/discord/1470188214710046894?label=Discord&logo=discord&v=2" alt="Discord" valign="middle"></a>&nbsp; • &nbsp;
  <a href="repo-tokens"><img src="repo-tokens/badge.svg" alt="34.9k tokens, 17% of context window" valign="middle"></a>
</p>
通过 Claude Code，NanoClaw 可以动态重写自身代码，根据您的需求定制功能。

**新功能：** 首个支持 [Agent Swarms（智能体集群）](https://code.claude.com/docs/en/agent-teams) 的 AI 助手。可轻松组建智能体团队，在您的聊天中高效协作。

## 我为什么创建 NanoClaw Lite？

[OpenClaw](https://github.com/openclaw/openclaw) 和 NanoClaw 都令人印象深刻，但我需要更轻量的方案：

- **容器作为代码部署** - 在 VPS 上以代码形式部署，而非作为容器镜像（ECS 等）
- **更便宜** - 成本更低
- **减少复杂性** - 大多数 AI 助手并不需要那么复杂
- **使用 `claude-sdk-phython` 作为智能体层**
- **Andrej Karpathy 也喜欢它的简洁性**（致谢：nanoclaw）
- **直接在进程中运行** - 无容器，无需在每次技能/MCP 变更时重新构建
  - **说实话：** 这才是重点——gmail-mcp 会让低层级模型花 10 分钟去理解它，这不可接受
- **不浪费磁盘空间** - 收回 nanoclaw 占用的 10GB 磁盘镜像
- **将个人工作区数据与 claw 智能体分离** [#权衡]
  - claw 确实在使用 Obsidian 方面很便利，但你也可以添加 Notion API 来将笔记发送到云端
  - 如果在本地运行，别忘了使用 Tailscale、VPN

技能只需复制粘贴到插件文件夹。通过 MCP 即时测试。可部署到任何地方——您的 VPS、笔记本电脑、小型云实例。

**注意：** 你仍然需要保护好你的密钥和网络。
不过，与在笔记本电脑上运行不同（不像 openclaw），你的个人数据与云端攻击隔离。

## 快速开始

```bash
git clone https://github.com/codedojokapa/nanoclaw-lite.git
cd nanoclaw
npm install
npm run dev
```

然后在 Claude Code 中运行 `/setup` 来配置渠道和集成。

> **注意：** 以 `/` 开头的命令（如 `/setup`、`/add-whatsapp`）是 [Claude Code 技能](https://code.claude.com/docs/en/skills)。请在 `claude` CLI 提示符中输入，而非在普通终端中。

## 设计哲学

**小巧易懂：** 单一进程，少量源文件。无微服务、无消息队列、无复杂抽象层。让 Claude Code 引导您轻松上手。

**轻量级设计:** 无容器，无重新构建，无 10GB 磁盘浪费。直接在进程中运行。可部署到任何地方——VPS、笔记本电脑、小型云实例。零运行时开销。

**为单一用户打造:** 这不是一个框架，是一个完全符合您个人需求的、可工作的软件。您可以 Fork 本项目，然后让 Claude Code 根据您的精确需求进行修改和适配。

**定制即代码修改:** 没有繁杂的配置文件。想要不同的行为？直接修改代码。代码库足够小，这样做是安全的。

**AI 原生:** 无安装向导（由 Claude Code 指导安装）。无需监控仪表盘，直接询问 Claude 即可了解系统状况。无调试工具（描述问题，Claude 会修复它）。

**技能即插件:** 将渠道或功能添加到 `.claude/skills/`。通过 MCP 即时测试。无需重新构建，无需重启。

**最好的工具套件，最好的模型:** 本项目运行在 Claude Agent SDK 之上，这意味着您直接运行的就是 Claude Code。Claude Code 高度强大，其编码和问题解决能力使其能够修改和扩展 NanoClaw，为每个用户量身定制。

## 功能支持

- **多渠道消息** - 通过 WhatsApp、Telegram、Discord、Slack 或 Gmail 与您的助手对话。使用 `/add-whatsapp` 或 `/add-telegram` 等技能添加渠道，可同时运行一个或多个。
- **隔离的群组上下文** - 每个群组都拥有独立的 `CLAUDE.md` 记忆和隔离的文件系统。
- **主频道** - 您的私有频道（self-chat），用于管理控制；其他所有群组都完全隔离
- **计划任务** - 运行 Claude 的周期性作业，并可以给您回发消息
- **网络访问** - 搜索和抓取网页内容
- **智能体集群（Agent Swarms）** - 启动多个专业智能体团队，协作完成复杂任务（首个支持此功能的个人 AI 助手）
- **可选集成** - 通过技能添加 Gmail (`/add-gmail`) 等更多功能
- **MCP 测试** - 通过 MCP 即时测试技能，无需重新构建

## 使用方法

使用触发词（默认为 `@Andy`）与您的助手对话：

```
@Andy 每周一到周五早上9点，给我发一份销售渠道的概览（需要访问我的 Obsidian vault 文件夹）
@Andy 每周五回顾过去一周的 git 历史，如果与 README 有出入，就更新它
@Andy 每周一早上8点，从 Hacker News 和 TechCrunch 收集关于 AI 发展的资讯，然后发给我一份简报
```

在主频道（您的self-chat）中，可以管理群组和任务：
```
@Andy 列出所有群组的计划任务
@Andy 暂停周一简报任务
@Andy 加入"家庭聊天"群组
```

## 定制

没有需要学习的配置文件。直接告诉 Claude Code 您想要什么：

- "把触发词改成 @Bob"
- "记住以后回答要更简短直接"
- "当我说早上好的时候，加一个自定义的问候"
- "每周存储一次对话摘要"

或者运行 `/customize` 进行引导式修改。

代码库足够小，Claude 可以安全地修改它。

## 贡献

**不要添加功能，而是添加技能。**

如果您想添加 Telegram 支持，不要创建一个 PR 同时添加 Telegram 和 WhatsApp。而是贡献一个技能文件 (`.claude/skills/add-telegram/SKILL.md`)，教 Claude Code 如何改造一个 NanoClaw 安装以使用 Telegram。

然后用户在自己的 fork 上运行 `/add-telegram`，就能得到只做他们需要事情的整洁代码，而不是一个试图支持所有用例的臃肿系统。

### RFS (技能征集)

我们希望看到的技能：

**通信渠道**
- `/add-signal` - 添加 Signal 作为渠道

**会话管理**
- `/clear` - 添加一个 `/clear` 命令，用于压缩会话（在同一会话中总结上下文，同时保留关键信息）。这需要研究如何通过 Claude Agent SDK 以编程方式触发压缩。

## 系统要求

- macOS、Linux 或 Windows
- Node.js 20+
- [Claude Code](https://claude.ai/download)

## 架构

```
渠道 --> SQLite --> 轮询循环 --> Claude Agent SDK (进程内) --> 响应
```

单一 Node.js 进程。渠道通过技能添加，启动时自注册 — 编排器连接具有凭据的渠道。Claude Agent SDK 直接在进程中运行，具有群组隔离。每个群组的消息队列带有并发控制。通过文件系统进行 IPC。

完整架构详情请见 [docs/SPEC.md](docs/SPEC.md)。

关键文件：
- `src/index.ts` - 编排器：状态管理、消息循环、智能体调用
- `src/channels/registry.ts` - 渠道注册表（启动时自注册）
- `src/ipc.ts` - IPC 监听与任务处理
- `src/router.ts` - 消息格式化与出站路由
- `src/group-queue.ts` - 带全局并发限制的群组队列
- `src/agent-runner.ts` - 直接在进程中运行 Claude Agent SDK
- `src/task-scheduler.ts` - 运行计划任务
- `src/db.ts` - SQLite 操作（消息、群组、会话、状态）
- `groups/*/CLAUDE.md` - 各群组的记忆

## FAQ

**我可以在 Linux 上运行吗？Windows 上呢？macOS 上呢？**

可以。NanoClaw 在这三个平台上都可以运行。它是一个纯 Node.js 应用程序，没有容器依赖。

**这个项目安全吗？**

智能体在应用级别运行，具有文件系统隔离。每个群组都有自己的独立文件系统上下文。您仍然应该审查您运行的代码，但这个代码库小到您真的可以做到。完整的安全模型请见 [docs/SECURITY.md](docs/SECURITY.md)。

**为什么没有配置文件？**

我们不希望配置泛滥。每个用户都应该定制它，让代码完全符合他们的需求，而不是去配置一个通用的系统。如果您喜欢用配置文件，告诉 Claude 让它加上。

**我可以使用第三方或开源模型吗？**

可以。

NanoClaw Lite 支持任何与 Claude API 兼容的模型端点。在 `.env` 文件中设置以下环境变量：

**提示：** 修改 `.env.example` 文件。

```bash
ANTHROPIC_BASE_URL=https://your-api-endpoint.com
ANTHROPIC_AUTH_TOKEN=your-token-here
```

这使您能够使用：
- 通过 [Ollama](https://ollama.ai) 配合 API 代理运行的本地模型
- 托管在 [Together AI](https://together.ai)、[Fireworks](https://fireworks.ai) 等平台上的开源模型
- 兼容 Anthropic API 格式的自定义模型部署

注意：为获得最佳兼容性，模型需支持 Anthropic API 格式。

**我该如何调试问题？**

问 Claude Code。"为什么计划任务没有运行？" "最近的日志里有什么？" "为什么这条消息没有得到回应？" 这就是 AI 原生的方法。

**为什么我的安装不成功？**

如果遇到问题，安装过程中 Claude 会尝试动态修复。如果问题仍然存在，运行 `claude`，然后运行 `/debug`。如果 Claude 发现一个可能影响其他用户的问题，请开一个 PR 来修改 setup SKILL.md。

**什么样的代码更改会被接受？**

安全修复、bug 修复，以及对基础配置的明确改进。仅此而已。

其他一切（新功能、操作系统兼容性、硬件支持、增强功能）都应该作为技能来贡献。

这使得基础系统保持最小化，并让每个用户可以定制他们的安装，而无需继承他们不想要的功能。

## 社区

有任何疑问或建议？欢迎[加入 Discord 社区](https://discord.gg/VDdww8qS42)与我们交流。

## 更新日志

破坏性变更和迁移说明请见 [CHANGELOG.md](CHANGELOG.md)。

## 许可证

MIT
