import type { LanguageModelV3Prompt } from "@ai-sdk/provider"
import {
  InvalidPromptError,
  UnsupportedFunctionalityError,
} from "@ai-sdk/provider"

export function convertToTaalasCompletionPrompt({
  prompt,
  user = "user",
  assistant = "assistant",
}: {
  prompt: LanguageModelV3Prompt
  user?: string
  assistant?: string
}): {
  prompt: string
  stopSequences?: string[]
} {
  if (
    prompt.length === 1 &&
    prompt[0].role === "user" &&
    prompt[0].content.length === 1 &&
    prompt[0].content[0].type === "text"
  ) {
    return { prompt: prompt[0].content[0].text }
  }

  let text = ""

  if (prompt[0].role === "system") {
    text += `${prompt[0].content}\n\n`
    prompt = prompt.slice(1)
  }

  for (const { role, content } of prompt) {
    switch (role) {
      case "system":
        throw new InvalidPromptError({
          message: `Unexpected system message in prompt: ${content}`,
          prompt,
        })

      case "user": {
        const userMessage = content
          .map((part) => {
            switch (part.type) {
              case "text":
                return part.text
              case "file":
                throw new UnsupportedFunctionalityError({
                  functionality: "files",
                })
              default:
                throw new Error(`Unsupported content part type: ${(part as { type: string }).type}`)
            }
          })
          .join("")
        text += `${user}:\n${userMessage}\n\n`
        break
      }

      case "assistant": {
        const assistantMessage = content
          .map((part) => {
            switch (part.type) {
              case "text":
                return part.text
              case "tool-call":
                throw new UnsupportedFunctionalityError({
                  functionality: "tool-call messages",
                })
              default:
                throw new UnsupportedFunctionalityError({
                  functionality: `${(part as { type: string }).type} content parts`,
                })
            }
          })
          .join("")
        text += `${assistant}:\n${assistantMessage}\n\n`
        break
      }

      case "tool":
        throw new UnsupportedFunctionalityError({
          functionality: "tool messages",
        })

      default: {
        const _exhaustiveCheck: never = role
        throw new Error(`Unsupported role: ${_exhaustiveCheck}`)
      }
    }
  }

  text += `${assistant}:\n`
  return {
    prompt: text,
    stopSequences: [`\n${user}:`],
  }
}
