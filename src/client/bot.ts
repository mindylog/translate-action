import OpenAI from 'openai'
import {OpenAIOptions, Options} from '../model/options'
import dedent from 'dedent'
import pRetry from 'p-retry'
import {info} from '@actions/core'
import {FileParser} from '../utils/file-parser'

export class Bot {
  private readonly openAI: OpenAI
  private readonly options: Options
  private readonly openAIOptions: OpenAIOptions
  constructor(options: Options, openAIOptions: OpenAIOptions) {
    this.options = options
    this.openAI = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })
    this.openAIOptions = openAIOptions
  }

  private flattenJson(json: Record<string, any>): Record<string, string> {
    const flattened: Record<string, string> = {}

    const flatten = (obj: Record<string, any>, path: string[] = []) => {
      for (const key in obj) {
        const value = obj[key]
        const newPath = [...path, key]

        if (typeof value === 'object' && value !== null) {
          flatten(value, newPath)
        } else {
          flattened[newPath.join('.')] = String(value)
        }
      }
    }

    flatten(json)
    return flattened
  }

  private parseTranslatedText(text: string): Record<string, string> {
    return text.split('%%').reduce(
      (acc, line) => {
        const [key, ...values] = line.split(':')
        acc[key.trim()] = values.join(':').trim()
        return acc
      },
      {} as Record<string, string>
    )
  }

  private unflattenJson(
    flattened: Record<string, string>
  ): Record<string, any> {
    const result: Record<string, any> = {}

    for (const [key, value] of Object.entries(flattened)) {
      const keys = key.split('.')
      let current = result

      keys.forEach((k, i) => {
        if (i === keys.length - 1) {
          current[k] = value
        } else {
          current[k] = current[k] || {}
          current = current[k]
        }
      })
    }

    return result
  }

  private validateTranslation(
    flattenedSource: Record<string, string>,
    result: Record<string, any>
  ): void {
    const flattenedResult = this.flattenJson(result)
    const missingKeys = Object.keys(flattenedSource).filter(
      key => flattenedResult[key] !== '' && !flattenedResult[key]
    )

    if (missingKeys.length > 0) {
      throw new Error(
        `번역 결과에 다음 키가 누락되었습니다: ${missingKeys.join(', ')}`
      )
    }
  }

  async translate(
    sourceContent: string,
    targetContent: string,
    previousSourceContent: string | null,
    fileParser: FileParser
  ): Promise<Record<string, any>> {
    const parsedSourceJson = fileParser.parse(sourceContent)
    let parsedTargetJson = fileParser.parse(targetContent)

    return pRetry(
      async () => {
        const flattenedSource = this.flattenJson(parsedSourceJson)
        const flattenedTarget = this.flattenJson(parsedTargetJson)

        // sourceContent와 previousSourceContent 비교하여 변경된 키 찾기
        let changedKeys: Set<string> = new Set()
        if (previousSourceContent) {
          const parsedPreviousSource = fileParser.parse(previousSourceContent)
          const flattenedPreviousSource = this.flattenJson(parsedPreviousSource)

          changedKeys = new Set(
            Object.entries(flattenedSource)
              .filter(([key, value]) => flattenedPreviousSource[key] !== value)
              .map(([key]) => key)
          )
        }

        // 번역이 필요한 항목만 필터링 (변경된 키는 무조건 포함)
        const needTranslation = Object.entries(flattenedSource)
          .filter(([key, _]) => !flattenedTarget[key] || changedKeys.has(key))
          .map(([key, value]) => `${key}: ${value}`)
          .join('%%')

        // 번역이 필요한 항목이 없으면 원본 반환
        if (!needTranslation) {
          return parsedTargetJson
        }

        const completion = await this.openAI.chat.completions.create({
          temperature: this.openAIOptions.temperature,
          max_tokens: this.openAIOptions.maxTokens,
          messages: [
            {
              role: 'system',
              content: dedent`
              ${this.options.systemMessage}

              The provided text is extracted from a nested JSON key. Each line follows the 'key: value' pattern,
              where nested keys are represented as 'parent.child: value'.
              Please translate only the values while keeping the keys exactly as they are.
              Do not modify any part of the keys under any circumstances.

              The source language is ${this.options.sourceLang}.
              The target language is ${this.options.targetLang}.

              The output Text should be in the same format as the input Text, with only the values translated.

              Please note that the text may contain special formatting that should be preserved:
              - Escape sequences like \n, \t, \r, etc.
              - Text styling with markdown or HTML tags
              - Variable references like {name}, {}
              - Translation references like @:common.title
              - XML tags like <hl>text</hl>
              - Any other special syntax used by the translation system

              Please translate only the actual text content while keeping all special formatting intact.
              
              Important: Output should be in the same format as the input Text. Please do not add any additional text or formatting like markdown or HTML, JSON.
              Important: XML tags should be closed.
              `
            },
            {
              role: 'user',
              content: needTranslation
            }
          ],
          model: this.openAIOptions.model
        })
        // 번역 결과 처리
        const translatedText =
          completion.choices[0].message?.content?.trim() ?? ''
        info(`translatedText: ${translatedText}`)
        const translatedPairs = this.parseTranslatedText(translatedText)

        // 기존 타겟 JSON과 번역된 값 병합
        const mergedFlattened = {
          ...flattenedTarget,
          ...translatedPairs
        }

        // 소스에 존재하는 키만 필터링
        const filteredMergedFlattened = Object.entries(mergedFlattened)
          .filter(([key]) => key in flattenedSource)
          .reduce((acc, [key, value]) => ({...acc, [key]: value}), {})

        // 최종 결과를 중첩된 JSON 구조로 변환
        const result = this.unflattenJson(filteredMergedFlattened)
        parsedTargetJson = result

        // 번역 결과 검증
        this.validateTranslation(flattenedSource, result)

        return result
      },
      {
        retries: 3,
        onFailedAttempt: error => {
          console.error(
            `번역 시도 실패 (${error.attemptNumber}/4): ${error.message}`
          )
        }
      }
    )
  }
}
