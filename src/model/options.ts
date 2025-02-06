export class Options {
  systemMessage: string
  sourceLang: string
  targetLang: string

  constructor(options: Options) {
    this.systemMessage = options.systemMessage
    this.sourceLang = options.sourceLang
    this.targetLang = options.targetLang
  }
}

export class OpenAIOptions {
  model: string
  temperature: number
  maxTokens: number

  constructor(options: OpenAIOptions) {
    this.model = options.model
    this.temperature = options.temperature
    this.maxTokens = options.maxTokens
  }
}
