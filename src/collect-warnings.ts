import type { SharedV3Warning } from "@ai-sdk/provider"

export function collectUnsupportedWarnings({
  topK,
  frequencyPenalty,
  presencePenalty,
  responseFormat,
}: {
  topK?: number
  frequencyPenalty?: number
  presencePenalty?: number
  responseFormat?: { type: string }
}): SharedV3Warning[] {
  const warnings: SharedV3Warning[] = []

  if (topK != null) {
    warnings.push({ type: "unsupported", feature: "topK" })
  }

  if (frequencyPenalty != null) {
    warnings.push({ type: "unsupported", feature: "frequencyPenalty" })
  }

  if (presencePenalty != null) {
    warnings.push({ type: "unsupported", feature: "presencePenalty" })
  }

  if (responseFormat != null && responseFormat.type !== "text") {
    warnings.push({
      type: "unsupported",
      feature: "responseFormat",
      details: "JSON response format is not supported by Taalas.",
    })
  }

  return warnings
}
