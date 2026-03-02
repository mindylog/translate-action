import {exec} from '@actions/exec'
import {warning} from '@actions/core'
import * as path from 'path'

export class GitManager {
  constructor(
    private readonly username: string = 'GitHub Action',
    private readonly email: string = 'action@github.com'
  ) {}

  async initWithCheckout(): Promise<void> {
    const sourceBranch = process.env.GITHUB_HEAD_REF
    if (!sourceBranch) {
      throw new Error('PR의 소스 브랜치를 찾을 수 없습니다')
    }
    await this.configureGit()
    await this.checkoutSourceBranch(sourceBranch)
  }

  async commitAndPush(targetFile: string, targetLang: string): Promise<void> {
    try {
      const sourceBranch = process.env.GITHUB_HEAD_REF
      if (!sourceBranch) {
        throw new Error('PR의 소스 브랜치를 찾을 수 없습니다')
      }

      const committed = await this.commitChanges(targetFile, targetLang)
      if (!committed) {
        return
      }
      await this.pushToSourceBranch(sourceBranch)
    } catch (error) {
      warning(`Git 커밋 중 오류 발생: ${error}`)
    }
  }

  private async configureGit(): Promise<void> {
    await exec('git', ['config', '--global', 'user.name', this.username])
    await exec('git', ['config', '--global', 'user.email', this.email])
  }

  private async checkoutSourceBranch(sourceBranch: string): Promise<void> {
    await exec('git', ['fetch', 'origin'])
    await exec('git', ['checkout', sourceBranch])
  }

  private async commitChanges(
    targetFile: string,
    targetLang: string
  ): Promise<boolean> {
    await exec('git', ['add', targetFile])
    const hasStagedChanges = await this.hasStagedChanges()
    if (!hasStagedChanges) {
      return false
    }
    await exec('git', ['commit', '-m', `[자동] ${targetLang} 번역 업데이트`])
    return true
  }

  private async pushToSourceBranch(sourceBranch: string): Promise<void> {
    try {
      await exec('git', ['fetch', 'origin'])
      await exec('git', ['rebase', `origin/${sourceBranch}`])
      await exec('git', ['push', 'origin', `HEAD:${sourceBranch}`])
    } catch (error) {
      throw new Error(`브랜치 푸시 중 오류 발생: ${error}`)
    }
  }

  async getPreviousFileContent(
    filePath: string,
    sourceBranch?: string
  ): Promise<string | null> {
    try {
      const normalizedPath = await this.toRepositoryRelativePath(filePath)
      const diffBaseRef = await this.getDiffBaseRef(sourceBranch)
      const result = await this.execWithOutput('git', [
        'show',
        `${diffBaseRef}:${normalizedPath}`
      ])
      return result.stdout
    } catch (error) {
      warning(`이전 파일 내용을 가져올 수 없습니다: ${error}`)
      return null
    }
  }

  private async getDiffBaseRef(sourceBranch?: string): Promise<string> {
    const baseBranch = process.env.GITHUB_BASE_REF
    const resolvedSourceBranch = sourceBranch ?? process.env.GITHUB_HEAD_REF

    if (!baseBranch) {
      return this.getLocalFallbackRef()
    }

    const baseRef = `origin/${baseBranch}`

    try {
      await exec('git', ['fetch', 'origin', baseBranch])

      let sourceRef = 'HEAD'
      if (resolvedSourceBranch) {
        try {
          await exec('git', ['fetch', 'origin', resolvedSourceBranch])
        } catch {
          // 이미 checkout 되어 있거나 fetch 제한이 있을 수 있으므로 조용히 진행
        }

        try {
          await exec('git', [
            'rev-parse',
            '--verify',
            `origin/${resolvedSourceBranch}`
          ])
          sourceRef = `origin/${resolvedSourceBranch}`
        } catch {
          sourceRef = 'HEAD'
        }
      }

      const mergeBaseResult = await this.execWithOutput('git', [
        'merge-base',
        sourceRef,
        baseRef
      ])
      const mergeBaseSha = mergeBaseResult.stdout.trim()

      if (mergeBaseSha) {
        return mergeBaseSha
      }

      return baseRef
    } catch (error) {
      warning(
        `PR diff 기준점을 계산할 수 없어 base 브랜치 기준으로 폴백합니다: ${error}`
      )

      if (await this.canResolveRef(baseRef)) {
        return baseRef
      }

      return this.getLocalFallbackRef()
    }
  }

  private async getLocalFallbackRef(): Promise<string> {
    if (await this.canResolveRef('HEAD~')) {
      return 'HEAD~'
    }
    if (await this.canResolveRef('HEAD^')) {
      return 'HEAD^'
    }
    return 'HEAD'
  }

  private async canResolveRef(ref: string): Promise<boolean> {
    const exitCode = await exec('git', ['rev-parse', '--verify', ref], {
      ignoreReturnCode: true
    })
    return exitCode === 0
  }

  private async hasStagedChanges(): Promise<boolean> {
    const exitCode = await exec('git', ['diff', '--cached', '--quiet'], {
      ignoreReturnCode: true
    })
    return exitCode === 1
  }

  private async toRepositoryRelativePath(filePath: string): Promise<string> {
    const repoRootResult = await this.execWithOutput('git', [
      'rev-parse',
      '--show-toplevel'
    ])
    const repoRoot = repoRootResult.stdout.trim()
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(process.cwd(), filePath)
    const relativePath = path.relative(repoRoot, absolutePath)
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      throw new Error(`저장소 외부 경로는 지원하지 않습니다: ${filePath}`)
    }

    return relativePath.split(path.sep).join('/')
  }

  private async execWithOutput(
    command: string,
    args: string[]
  ): Promise<{stdout: string; stderr: string}> {
    let stdout = ''
    let stderr = ''

    const options = {
      listeners: {
        stdout: (data: Buffer) => {
          stdout += data.toString()
        },
        stderr: (data: Buffer) => {
          stderr += data.toString()
        }
      }
    }

    await exec(command, args, options)
    return {stdout, stderr}
  }
}
