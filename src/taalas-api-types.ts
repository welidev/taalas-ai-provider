export type TaalasChatPrompt = Array<
  TaalasSystemMessage | TaalasUserMessage | TaalasAssistantMessage
>

export interface TaalasSystemMessage {
  role: "system"
  content: string
}

export interface TaalasUserMessage {
  role: "user"
  content: string
}

export interface TaalasAssistantMessage {
  role: "assistant"
  content: string
}
