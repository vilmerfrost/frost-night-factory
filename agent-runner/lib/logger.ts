// =============================================================================
// PROFESSIONAL TERMINAL LOGGER - Beautiful CLI output
// =============================================================================

import chalk from 'chalk'

export const logger = {
  /**
   * Print a section header
   */
  section: (title: string) => {
    const line = '━'.repeat(60)
    console.log(`\n${chalk.cyan(line)}`)
    console.log(chalk.cyan(` 🔷 ${title}`))
    console.log(chalk.cyan(line))
  },

  /**
   * Success message
   */
  success: (msg: string) => {
    console.log(chalk.green(`✅ ${msg}`))
  },

  /**
   * Error message
   */
  error: (msg: string) => {
    console.log(chalk.red(`❌ ${msg}`))
  },

  /**
   * Warning message
   */
  warn: (msg: string) => {
    console.log(chalk.yellow(`⚠️  ${msg}`))
  },

  /**
   * Info message
   */
  info: (msg: string) => {
    console.log(chalk.blue(`ℹ️  ${msg}`))
  },

  /**
   * Loading/processing message
   */
  loading: (msg: string) => {
    console.log(chalk.cyan(`⏳ ${msg}`))
  },

  /**
   * Cost display
   */
  cost: (amount: number) => {
    console.log(chalk.magenta(`💰 $${amount.toFixed(4)}`))
  },

  /**
   * Timer display
   */
  timer: (label: string, ms: number) => {
    const seconds = (ms / 1000).toFixed(2)
    console.log(chalk.cyan(`⏱️  ${label}: ${seconds}s`))
  },

  /**
   * Step indicator
   */
  step: (step: number, total: number, label: string) => {
    console.log(
      chalk.gray(`[${step}/${total}]`) + ' ' + chalk.white(label)
    )
  },

  /**
   * Progress bar (simple version)
   */
  progress: (current: number, total: number, label?: string) => {
    const percentage = Math.round((current / total) * 100)
    const barLength = 30
    const filled = Math.round((current / total) * barLength)
    const bar =
      '█'.repeat(filled) + '░'.repeat(barLength - filled)
    
    if (label) {
      console.log(
        `${chalk.cyan(label)} ${chalk.gray(`[${bar}]`)} ${chalk.white(`${percentage}%`)}`
      )
    } else {
      console.log(
        `${chalk.gray(`[${bar}]`)} ${chalk.white(`${percentage}%`)}`
      )
    }
  },

  /**
   * Debug message (only in debug mode)
   */
  debug: (msg: string) => {
    if (process.env.DEBUG === 'true') {
      console.log(chalk.gray(`🐛 ${msg}`))
    }
  },

  /**
   * Divider line
   */
  divider: () => {
    console.log(chalk.gray('─'.repeat(60)))
  },

  /**
   * Table row
   */
  tableRow: (columns: string[]) => {
    const row = columns.join(' | ')
    console.log(chalk.gray(`│ ${row}`))
  },

  /**
   * Table header
   */
  tableHeader: (columns: string[]) => {
    const header = columns.join(' | ')
    const separator = '─'.repeat(header.length + 4)
    console.log(chalk.cyan(`┌${separator}┐`))
    console.log(chalk.cyan(`│ ${header} │`))
    console.log(chalk.cyan(`├${separator}┤`))
  },

  /**
   * Table footer
   */
  tableFooter: () => {
    console.log(chalk.cyan('└' + '─'.repeat(60) + '┘'))
  },
}

