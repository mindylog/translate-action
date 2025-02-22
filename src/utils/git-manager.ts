import {exec} from '@actions/exec'
import {warning} from '@actions/core'

export class GitManager {
  constructor(
    private readonly username: string = 'GitHub Action',
    private readonly email: string = 'action@github.com'
  ) {}

  async commitAndPush(targetFile: string, targetLang: string): Promise<void> {
    try {
      const sourceBranch = process.env.GITHUB_HEAD_REF
      if (!sourceBranch) {
        throw new Error('PR의 소스 브랜치를 찾을 수 없습니다')
      }

      await this.configureGit()
      await this.checkoutSourceBranch(sourceBranch)
      await this.commitChanges(targetFile, targetLang)
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
  ): Promise<void> {
    await exec('git', ['add', targetFile])
    await exec('git', ['commit', '-m', `[자동] ${targetLang} 번역 업데이트`])
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

  async getPreviousFileContent(filePath: string): Promise<string | null> {
    try {
      // HEAD^ 는 현재 커밋의 이전 커밋을 의미합니다
      const result = await this.execWithOutput('git', [
        'show',
        `HEAD~:${filePath}`
      ])
      return result.stdout
    } catch (error) {
      // 파일이 이전에 존재하지 않았거나 첫 커밋인 경우
      warning(`이전 파일 내용을 가져올 수 없습니다: ${error}`)
      return null
    }
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
