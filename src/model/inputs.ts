export class Inputs {
  translationsDir: string
  sourceLang: string
  targetLang: string
  systemMessage: string
  model: string

  constructor(inputs: Inputs) {
    this.translationsDir = inputs.translationsDir
    this.sourceLang = inputs.sourceLang
    this.targetLang = inputs.targetLang
    this.systemMessage = inputs.systemMessage
    this.model = inputs.model
  }
}
