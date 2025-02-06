import {exec} from '@actions/exec'
import {warning} from '@actions/core'

export class GitManager {
  constructor(
    private readonly targetFile: string,
    private readonly username: string = 'GitHub Action',
    private readonly email: string = 'action@github.com'
  ) {}

  async commitAndPush(targetLang: string): Promise<void> {
    try {
      const sourceBranch = process.env.GITHUB_HEAD_REF
      if (!sourceBranch) {
        throw new Error('PR의 소스 브랜치를 찾을 수 없습니다')
      }

      await this.configureGit()
      await this.commitChanges(targetLang)
      await this.pushToSourceBranch(sourceBranch)
    } catch (error) {
      warning(`Git 커밋 중 오류 발생: ${error}`)
    }
  }

  private async configureGit(): Promise<void> {
    await exec('git', ['config', '--global', 'user.name', this.username])
    await exec('git', ['config', '--global', 'user.email', this.email])
  }

  private async commitChanges(targetLang: string): Promise<void> {
    await exec('git', ['add', this.targetFile])
    await exec('git', ['commit', '-m', `[자동] ${targetLang} 번역 업데이트`])
  }

  private async pushToSourceBranch(sourceBranch: string): Promise<void> {
    try {
      // 원격 저장소의 최신 정보를 가져옵니다
      await exec('git', ['fetch', 'origin'])
      // 원격의 변경사항을 현재 브랜치에 적용합니다
      await exec('git', ['pull', 'origin', sourceBranch])
      // 변경사항을 푸시합니다
      await exec('git', ['push', 'origin', `HEAD:${sourceBranch}`])
    } catch (error) {
      throw new Error(`브랜치 푸시 중 오류 발생: ${error}`)
    }
  }
}
