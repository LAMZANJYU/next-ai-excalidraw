# Next AI Excalidraw 🎨 ✨

English | [简体中文](./README_zh-CN.md)

An AI-powered whiteboard tool built with **Next.js 16** and **Excalidraw**. Generate **hand-drawn style** flowcharts, architecture diagrams, and mind maps instantly through natural language descriptions.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-16.1-black)
![React](https://img.shields.io/badge/React-19-blue)
![Tailwind](https://img.shields.io/badge/Tailwind-4.0-38bdf8)

## ✨ Features

- 🤖 **AI-Powered Drawing**: Automatically generate **hand-drawn** Excalidraw elements (rectangles, circles, arrows, text, etc.) from text descriptions.
- 🔌 **Multi-Model Support**: Built-in support for popular AI models with custom configuration options:
  - OpenAI (GPT-4o, GPT-4o-mini)
  - Anthropic (Claude 3.5 Sonnet)
  - **DeepSeek**
  - Moonshot (Kimi)
  - Zhipu AI (GLM-4)
  - **Ollama** (Local model support)
  - Azure OpenAI
- 🔒 **Privacy First**: API Keys and configurations are stored only in your local browser (localStorage) and are never sent to our servers.
- ⚡ **Modern Tech Stack**: Built with Next.js 16 (App Router), React 19, and Tailwind CSS v4.
- 🌏 **i18n Optimized**: Special optimizations for Chinese font rendering (Excalifont).

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- pnpm / npm / yarn / bun

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/your-username/next-ai-excalidraw.git
cd next-ai-excalidraw
```

2. **Install dependencies**

```bash
npm install
# or
pnpm install
```

3. **Run the development server**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 🛠️ Usage

1. Click the **Settings** icon on the interface.
2. Select your preferred AI provider (e.g., OpenAI or DeepSeek).
3. Enter the corresponding API Key (no key needed for Ollama local models).
4. Describe what you want to draw in the input box, for example: "Draw a flowchart for a user login system".
5. Click Generate, and the AI will automatically create the corresponding diagram on the canvas.

## 🏗️ Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **UI Library**: [Radix UI](https://www.radix-ui.com/), [Tailwind CSS v4](https://tailwindcss.com/)
- **Whiteboard Core**: [Excalidraw](https://excalidraw.com/)
- **AI Integration**: [Vercel AI SDK](https://sdk.vercel.ai/), OpenAI SDK
- **Icons**: Lucide React

## 🤝 Contribution

Contributions are welcome! Before submitting a Pull Request, please ensure:

1. Code passes lint checks: `npm run lint`
2. New features include necessary comments or tests (if applicable).

## 📄 License

This project is open-sourced under the [MIT License](LICENSE).
