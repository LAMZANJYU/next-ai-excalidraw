# Next AI Excalidraw 🎨 ✨

[English](./README.md) | 简体中文

一个基于 **Next.js 16** 和 **Excalidraw** 构建的 AI 驱动白板工具。通过自然语言描述，利用 AI 快速生成**手绘风格**的流程图、架构图和思维导图。

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-16.1-black)
![React](https://img.shields.io/badge/React-19-blue)
![Tailwind](https://img.shields.io/badge/Tailwind-4.0-38bdf8)

## ✨ 特性

- 🤖 **AI 驱动绘图**：通过文字描述自动生成**手绘风格**的 Excalidraw 元素（矩形、圆形、箭头、文本等）。
- 🔌 **多模型支持**：内置多种主流 AI 模型支持，并支持自定义配置：
  - OpenAI (GPT-4o, GPT-4o-mini)
  - Anthropic (Claude 3.5 Sonnet)
  - **DeepSeek** (深度求索)
  - Moonshot (Kimi / 月之暗面)
  - 智谱 AI (GLM-4)
  - **Ollama** (本地模型支持)
  - Azure OpenAI
- 🔒 **隐私优先**：API Key 和配置仅存储在本地浏览器 (localStorage)，不会上传到服务器。
- ⚡ **最新技术栈**：采用 Next.js 16 (App Router), React 19, Tailwind CSS v4 构建。
- 🌏 **中文优化**：针对中文字体显示进行了专门优化 (Excalifont)。

## 🚀 快速开始

### 前置要求

- Node.js 18+
- pnpm / npm / yarn / bun

### 安装与运行

1. **克隆仓库**

```bash
git clone https://github.com/your-username/next-ai-excalidraw.git
cd next-ai-excalidraw
```

2. **安装依赖**

```bash
npm install
# 或者
pnpm install
```

3. **启动开发服务器**

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000) 即可看到应用。

## 🛠️ 使用指南

1. 点击界面上的 **设置** 图标。
2. 选择你喜欢的 AI 提供商（例如 OpenAI 或 DeepSeek）。
3. 输入对应的 API Key（如果是 Ollama 本地模型则无需 Key）。
4. 在输入框中描述你想要绘制的内容，例如：“画一个用户登录系统的流程图”。
5. 点击生成，AI 将自动在白板上创建对应的图表。

## 🏗️ 技术栈

- **框架**: [Next.js 16](https://nextjs.org/) (App Router)
- **UI 库**: [Radix UI](https://www.radix-ui.com/), [Tailwind CSS v4](https://tailwindcss.com/)
- **白板核心**: [Excalidraw](https://excalidraw.com/)
- **AI 集成**: [Vercel AI SDK](https://sdk.vercel.ai/), OpenAI SDK
- **图标**: Lucide React

## 🤝 贡献指南

欢迎提交 Pull Request 或 Issue！在提交之前，请确保：

1. 代码通过了 lint 检查：`npm run lint`
2. 新功能包含必要的注释或测试（如有）。

## 📄 许可证

本项目基于 [MIT 许可证](LICENSE) 开源。
