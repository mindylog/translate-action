import * as yaml from 'js-yaml'

export interface FileParser {
  parse(content: string): Record<string, any>
  stringify(data: Record<string, any>): string
}

export class JsonParser implements FileParser {
  parse(content: string): Record<string, any> {
    return JSON.parse(content)
  }

  stringify(data: Record<string, any>): string {
    return JSON.stringify(data, null, 2)
  }
}

export class YamlParser implements FileParser {
  parse(content: string): Record<string, any> {
    return yaml.load(content) as Record<string, any>
  }

  stringify(data: Record<string, any>): string {
    return yaml.dump(data, {
      indent: 2,
      lineWidth: -1,
      noRefs: true
    })
  }
}

export function getFileParser(format: string): FileParser {
  switch (format.toLowerCase()) {
    case 'json':
      return new JsonParser()
    case 'yaml':
    case 'yml':
      return new YamlParser()
    default:
      throw new Error(`지원하지 않는 파일 형식입니다: ${format}`)
  }
}

export function getFileExtension(format: string): string {
  switch (format.toLowerCase()) {
    case 'json':
      return 'json'
    case 'yaml':
    case 'yml':
      return 'yml'
    default:
      throw new Error(`지원하지 않는 파일 형식입니다: ${format}`)
  }
}
