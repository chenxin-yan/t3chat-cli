# t3chat-cli

A command-line interface for [t3.chat](https://t3.chat) -- chat with multiple AI models (Claude, GPT, Gemini, DeepSeek, and more) directly from your terminal.

## Prerequisites

- A [t3.chat](https://t3.chat) account
- `curl`

## Installation

```sh
bun add -g @cyanlabs/t3chat
```

Once installed, the CLI is available as the `chat` command.

## Setup

### 1. Authenticate

```sh
chat auth login
```

This opens [t3.chat](https://t3.chat) in your browser and walks you through extracting session cookies:

1. Log in to t3.chat
2. Open DevTools (`Cmd+Option+I`)
3. Go to the **Network** tab
4. Send any chat message
5. Click the `/api/chat` request
6. Copy the `Cookie` header value
7. Paste it into the CLI prompt

Your credentials are saved to `~/.config/t3chat-cli/config.json`.

### 2. Select a model (optional)

```sh
chat models
```

Fetches the full model catalog from t3.chat and presents an interactive picker. Models are displayed with their provider and cost tier:

```
Claude 4 Sonnet (Anthropic) $$$
GPT-4.1 (OpenAI) $$
Gemini 2.5 Pro (Google) $$
DeepSeek R1 (DeepSeek) $
Kimi K2.5 (Moonshot) $
...
```

The default model is `kimi-k2.5` if none is selected.

## Usage

```sh
chat "What is the capital of France?"
```

```sh
chat explain the difference between TCP and UDP
```

The prompt is variadic -- quotes are optional for multi-word inputs. Responses stream directly to stdout.

## Commands

| Command           | Description                                     |
| ----------------- | ----------------------------------------------- |
| `chat <prompt>`   | Send a message to the selected AI model         |
| `chat auth login` | Authenticate with t3.chat via cookie extraction |
| `chat models`     | Interactively select the default model          |
| `chat --help`     | Show help                                       |
| `chat --version`  | Show version                                    |

## Configuration

All configuration is stored in `~/.config/t3chat-cli/config.json`:

```json
{
  "cookies": "convex-session-id=...; ...",
  "model": "claude-4-sonnet"
}
```

| Field     | Description                                              |
| --------- | -------------------------------------------------------- |
| `cookies` | Session cookies from t3.chat (set via `chat auth login`) |
| `model`   | Selected model ID (set via `chat models`)                |

## Development

```sh
# Run in dev mode (executes TypeScript directly)
bun run dev

# Type-check
bun run check:types

# Build standalone executable
bun run build

# Run the built binary
bun run start
```

### Project Structure

```
src/
  cli.ts                 # CLI entry point and main command
  commands/
    auth/
      index.ts           # Auth subcommand definition
      login.ts           # Cookie-based login flow
    models.ts            # Model selection command
  lib/
    config.ts            # Config file read/write (~/.config/t3chat-cli/)
    constants.ts         # URLs, model utilities, cost tier logic
    t3client.ts          # t3.chat API client (chat + model fetching)
```

### Built With

- [Bun](https://bun.sh) -- Runtime and package manager
- [Crust](https://crustjs.com) -- CLI framework (`@crustjs/core`, `@crustjs/plugins`, `@crustjs/prompts`)
- [TypeScript](https://www.typescriptlang.org/)
