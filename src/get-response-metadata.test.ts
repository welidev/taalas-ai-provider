import { describe, expect, it } from "vitest"
import { getResponseMetadata } from "./get-response-metadata.js"

describe("getResponseMetadata", () => {
  it("extracts all fields when present", () => {
    const result = getResponseMetadata({
      id: "resp-123",
      model: "llama3.1-8B",
      created: 1700000000,
    })

    expect(result.id).toBe("resp-123")
    expect(result.modelId).toBe("llama3.1-8B")
    expect(result.timestamp).toEqual(new Date(1700000000 * 1000))
  })

  it("returns undefined for null fields", () => {
    const result = getResponseMetadata({
      id: null,
      model: null,
      created: null,
    })

    expect(result.id).toBeUndefined()
    expect(result.modelId).toBeUndefined()
    expect(result.timestamp).toBeUndefined()
  })

  it("returns undefined for missing fields", () => {
    const result = getResponseMetadata({})

    expect(result.id).toBeUndefined()
    expect(result.modelId).toBeUndefined()
    expect(result.timestamp).toBeUndefined()
  })
})
