import {getInput, warning} from '@actions/core'
import {OpenAIOptions, Options} from './model/options'
import {Bot} from './client/bot'

async function run() {
  const options = new Options({
    systemMessage: getInput('system-message'),
    sourceLang: getInput('source-lang'),
    targetLang: getInput('target-lang')
  })

  const openAIOptions = new OpenAIOptions({
    model: getInput('model'),
    temperature: Number(getInput('temperature')),
    maxTokens: Number(getInput('max-tokens'))
  })

  const bot = new Bot(options, openAIOptions)
}

process
  .on('unhandledRejection', (reason, p) => {
    warning(`Unhandled Rejection at Promise: ${reason}, promise is ${p}`)
  })
  .on('uncaughtException', (e: any) => {
    warning(`Uncaught Exception thrown: ${e}, backtrace: ${e.stack}`)
  })

await run()
