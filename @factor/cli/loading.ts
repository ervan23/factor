import cliProgress, { SingleBar } from "cli-progress"
import chalk from "chalk"
import { waitFor } from "@factor/api/utils"
import { emitEvent } from "@factor/api/events"

/**
 * Create a way to alter CLI output when progress bars are building
 */
let __building = false
export const isBuilding = (): boolean => {
  return __building
}

export const setBuilding = (state: boolean): void => {
  __building = state
}

/**
 * Loading bar for the CLI
 */
export default class LoadingBar {
  bar: SingleBar
  percent = 0
  msg = ""
  build = "environment"

  constructor({ color = "", build = "" } = {}) {
    const colorize = color ? chalk.keyword(color) : (_: string): string => _
    this.bar = new cliProgress.SingleBar(
      {
        hideCursor: true,
        clearOnComplete: true,
        format: `${colorize(`{bar}`)} {percentage}% {msg}`,
        noTTYOutput: true
      },
      cliProgress.Presets.shades_classic
    )

    if (build) this.build = build

    this.start()
  }

  start({ start = 0, finish = 100 }: { start?: number; finish?: number } = {}): void {
    this.bar.start(finish, start, { msg: this.msg })
    setBuilding(true)
    emitEvent("buildProgress", this.build, {
      progress: 0,
      message: "setting environment"
    })
  }

  async update({ percent, msg = "" }: { percent: number; msg: string }): Promise<void> {
    this.msg = msg
    percent = Math.round(percent)
    const diff = percent - this.percent

    for (let i = 0; i < diff || percent < this.percent; i++) {
      this.percent = this.percent + 1
      this.bar.update(this.percent, { msg: this.msg })
      emitEvent("buildProgress", this.build, {
        progress: this.percent,
        message: this.msg
      })
      await waitFor(20)
    }

    return
  }

  stop(): void {
    setBuilding(false)
    this.bar.stop()
    emitEvent("buildProgress", this.build, {
      progress: 100,
      message: "environment set"
    })
  }
}
