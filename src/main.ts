import {getInput, warning} from '@actions/core'
import {OpenAIOptions, Options} from './model/options'
import {Bot} from './client/bot'
import {Inputs} from './model/inputs'
import * as fs from 'fs'
import * as path from 'path'
import {GitManager} from './utils/git-manager'

async function run() {
  const inputs = new Inputs({
    translationsDir: getInput('translations-dir'),
    systemMessage: getInput('system-message'),
    sourceLang: getInput('source-lang'),
    targetLang: getInput('target-lang'),
    model: getInput('model'),
    gitUserName: getInput('git-user-name'),
    gitUserEmail: getInput('git-user-email')
  })

  const options = new Options({
    systemMessage: inputs.systemMessage,
    sourceLang: inputs.sourceLang,
    targetLang: inputs.targetLang
  })

  const openAIOptions = new OpenAIOptions({
    model: inputs.model,
    temperature: Number(getInput('temperature')),
    maxTokens: Number(getInput('max-tokens'))
  })

  const bot = new Bot(options, openAIOptions)
  const gitManager = new GitManager(inputs.gitUserName, inputs.gitUserEmail)

  await gitManager.initWithCheckout()

  // 번역할 파일 읽기
  const sourceFile = path.join(
    inputs.translationsDir,
    `${inputs.sourceLang}.json`
  )
  const targetFile = path.join(
    inputs.translationsDir,
    `${inputs.targetLang}.json`
  )

  if (!fs.existsSync(sourceFile)) {
    throw new Error(`소스 파일을 찾을 수 없습니다: ${sourceFile}`)
  }
  const previousSourceContent =
    await gitManager.getPreviousFileContent(sourceFile)
  const sourceContent = fs.readFileSync(sourceFile, 'utf8')
  const targetContent = fs.existsSync(targetFile)
    ? fs.readFileSync(targetFile, 'utf8')
    : '{}'

  // 번역 실행
  const translatedContent = await bot.translate(
    sourceContent,
    targetContent,
    previousSourceContent
  )

  // 번역된 내용 저장
  fs.writeFileSync(
    targetFile,
    JSON.stringify(translatedContent, null, 2),
    'utf8'
  )

  await gitManager.commitAndPush(targetFile, inputs.targetLang)
}

process
  .on('unhandledRejection', (reason, p) => {
    warning(`Unhandled Rejection at Promise: ${reason}, promise is ${p}`)
  })
  .on('uncaughtException', (e: any) => {
    warning(`Uncaught Exception thrown: ${e}, backtrace: ${e.stack}`)
  })

await run()
