export class Inputs {
  translationsDir: string
  sourceLang: string
  targetLang: string
  fileFormat: string
  filePrefix: string
  systemMessage: string
  model: string
  gitUserName: string
  gitUserEmail: string

  constructor(inputs: Inputs) {
    this.translationsDir = inputs.translationsDir
    this.sourceLang = inputs.sourceLang
    this.targetLang = inputs.targetLang
    this.fileFormat = inputs.fileFormat
    this.filePrefix = inputs.filePrefix
    this.systemMessage = inputs.systemMessage
    this.model = inputs.model
    this.gitUserName = inputs.gitUserName
    this.gitUserEmail = inputs.gitUserEmail
  }
}
