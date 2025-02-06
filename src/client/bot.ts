import OpenAI from 'openai'
import {OpenAIOptions, Options} from '../model/options'
import dedent from 'dedent'
import pRetry from 'p-retry'

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
    return text.split('\n').reduce(
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
      key => !flattenedResult[key]
    )

    if (missingKeys.length > 0) {
      throw new Error(
        `번역 결과에 다음 키가 누락되었습니다: ${missingKeys.join(', ')}`
      )
    }
  }

  async translate(sourceJson: string, targetJson: string): Promise<string> {
    return pRetry(
      async () => {
        const parsedSourceJson = JSON.parse(sourceJson)
        const parsedTargetJson = JSON.parse(targetJson)

        const flattenedSource = this.flattenJson(parsedSourceJson)
        const flattenedTarget = this.flattenJson(parsedTargetJson)

        // 번역이 필요한 항목만 필터링
        const needTranslation = Object.entries(flattenedSource)
          .filter(([key, _]) => !flattenedTarget[key])
          .map(([key, value]) => `${key}: ${value}`)
          .join('\n')

        // 번역이 필요한 항목이 없으면 원본 반환
        if (!needTranslation) {
          return targetJson
        }

        const response = await this.openAI.chat.completions.create({
          temperature: this.openAIOptions.temperature,
          max_tokens: this.openAIOptions.maxTokens,
          messages: [
            {
              role: 'system',
              content: dedent`
              ${this.options.systemMessage}

              The provided text is in flattened JSON format. Each line follows the 'key: value' pattern,
              where nested keys are represented as 'parent.child: value'.
              Please translate only the values while keeping the keys exactly as they are.
              Do not modify any part of the keys under any circumstances.

              The source language is ${this.options.sourceLang}.
              The target language is ${this.options.targetLang}.

              The input JSON is:
              ${needTranslation}

              The output JSON should be in the same format as the input JSON, with only the values translated.

              Please note that the text may contain special formatting that should be preserved:
              - Escape sequences like \n, \t, \r, etc.
              - Text styling with markdown or HTML tags
              - Variable references like {name}, {}
              - Translation references like @:common.title
              - Any other special syntax used by the translation system

              Please translate only the actual text content while keeping all special formatting intact.
              `
            }
          ],
          model: this.openAIOptions.model
        })
        // 번역 결과 처리
        const translatedText =
          response.choices[0].message?.content?.trim() ?? ''
        const translatedPairs = this.parseTranslatedText(translatedText)

        // 기존 타겟 JSON과 번역된 값 병합
        const mergedFlattened = {
          ...flattenedTarget,
          ...translatedPairs
        }

        // 최종 결과를 중첩된 JSON 구조로 변환
        const result = this.unflattenJson(mergedFlattened)

        // 번역 결과 검증
        this.validateTranslation(flattenedSource, result)

        return JSON.stringify(result, null, 2)
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
