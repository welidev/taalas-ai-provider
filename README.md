# taalas-ai-provider

[Vercel AI SDK](https://sdk.vercel.ai/) provider for the [Taalas](https://taalas.com) API.

Supports chat and completion endpoints with streaming.

## Installation

```bash
npm install taalas-ai-provider
```

The package requires `zod` as a peer dependency (^3.0.0).

## Setup

Set your API key via environment variable:

```bash
export TAALAS_API_KEY=your-api-key
```

Or pass it directly when creating the provider:

```ts
import { createTaalas } from "taalas-ai-provider"

const taalas = createTaalas({ apiKey: "your-api-key" })
```

## Usage

### Chat

```ts
import { generateText } from "ai"
import { taalas } from "taalas-ai-provider"

const { text } = await generateText({
  model: taalas("llama3.1-8B"),
  prompt: "What is the meaning of life?",
})
```

### Streaming

```ts
import { streamText } from "ai"
import { taalas } from "taalas-ai-provider"

const result = streamText({
  model: taalas("llama3.1-8B"),
  prompt: "Write a short poem.",
})

for await (const chunk of result.textStream) {
  process.stdout.write(chunk)
}
```

### Completion

```ts
import { createTaalas } from "taalas-ai-provider"

const taalas = createTaalas()
const model = taalas.completion("llama3.1-8B")
```

### Configuration

```ts
const taalas = createTaalas({
  baseURL: "https://custom-endpoint.example.com", // default: https://api.taalas.com
  apiKey: "your-api-key",                          // default: TAALAS_API_KEY env var
  headers: { "X-Custom": "value" },                // extra headers per request
})
```

## Limitations

- **No tool/function calling** -- throws `UnsupportedFunctionalityError`
- **No structured output** (object-json / object-tool modes)
- **No image inputs** -- text only
- **No embedding models**
- `topK`, `frequencyPenalty`, `presencePenalty` are accepted but produce warnings (not sent to API)

## License

MIT
