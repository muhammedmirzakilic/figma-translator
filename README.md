# Figma Translator 🌍

A Figma plugin that batch translates your designs to multiple languages using OpenAI for context-aware localization.

![Figma Translator](https://img.shields.io/badge/Figma-Plugin-purple)
![License](https://img.shields.io/badge/License-MIT-blue)

## Features

- **Batch Translation** - Select any frame and translate all text elements at once
- **Context-Aware Localization** - Uses OpenAI to adapt content culturally, not just translate literally
- **18 Languages Supported** - Spanish, French, German, Italian, Portuguese, Dutch, Polish, Russian, Japanese, Korean, Chinese, Arabic, Turkish, Hindi, Swedish, Norwegian, Danish, Finnish
- **Progressive Generation** - See translated frames appear as each language completes
- **Preserves Original** - Creates copies of your frame for each language, keeping the original intact
- **Short & Concise** - Optimized prompts ensure translations fit UI space constraints

## Installation

### Development Setup

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/figma-translator.git
   cd figma-translator
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the plugin:
   ```bash
   npm run build
   ```

4. In Figma Desktop:
   - Go to `Plugins` → `Development` → `Import plugin from manifest...`
   - Select the `manifest.json` file from this folder

### Watch Mode (Development)

```bash
npm run watch
```

## Usage

1. **Select a frame** in Figma containing text you want to translate
2. **Run the plugin**: `Plugins` → `Development` → `Figma Translator`
3. **Enter your OpenAI API key** (saved locally)
4. **Add context** (e.g., "App store listing for a fashion rating app")
5. **Select target languages** by clicking the language chips
6. **Check "Create separate frames"** to generate copies (recommended)
7. **Click Translate** and watch your translated frames appear!

## Configuration

### OpenAI API Key

You'll need an OpenAI API key to use this plugin. Get one at [platform.openai.com](https://platform.openai.com/api-keys).

The plugin uses `gpt-4o-mini` for cost-effective, high-quality translations.

### Translation Context

Provide context to get better localizations:
- ✅ "App store listing for a fitness tracking app"
- ✅ "E-commerce product descriptions, casual tone"
- ✅ "Gaming app UI, energetic and fun"
- ❌ "Translate this" (too vague)

## Project Structure

```
figmaext/
├── manifest.json       # Figma plugin manifest
├── package.json        # Dependencies
├── tsconfig.json       # TypeScript config
├── esbuild.config.js   # Build configuration
├── src/
│   ├── code.ts         # Plugin logic (Figma API)
│   ├── ui.ts           # UI logic (OpenAI integration)
│   ├── ui.html         # UI template
│   └── styles.css      # UI styles
└── dist/               # Built files (generated)
```

## Development

### Build Commands

| Command | Description |
|---------|-------------|
| `npm run build` | Build for production |
| `npm run watch` | Watch mode for development |

### Tech Stack

- **TypeScript** - Type-safe code
- **esbuild** - Fast bundling
- **OpenAI API** - Translation/localization
- **Figma Plugin API** - Design manipulation

## License

MIT

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

Made with ❤️ for everyone building global products
