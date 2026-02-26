# t3chat-cli

A command-line interface for [t3.chat](https://t3.chat)

## Prerequisites

- A [t3.chat](https://t3.chat) account
- `curl`

## Installation

```sh
bun add -g @cyanlabs/t3chat
```

Once installed, the CLI is available as the `t3chat` command.

## Setup

### 1. Authenticate

```sh
t3chat auth login
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
t3chat models
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
t3chat "What is the capital of France?"
```

```sh
t3chat explain the difference between TCP and UDP
```

The prompt is variadic -- quotes are optional for multi-word inputs. Responses stream directly to stdout.

After the response, an interactive prompt appears so you can send follow-up messages with full conversation context. Press `Enter` on an empty line or `Ctrl+C` to exit.

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
| `cookies` | Session cookies from t3.chat (set via `t3chat auth login`) |
| `model`   | Selected model ID (set via `t3chat models`)                |

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

### Built With

- [Bun](https://bun.sh) -- Runtime and package manager
- [Crust](https://crustjs.com) -- CLI framework (`@crustjs/core`, `@crustjs/plugins`, `@crustjs/prompts`)
- [TypeScript](https://www.typescriptlang.org/)
