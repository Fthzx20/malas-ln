import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

const replacements = [
  { from: /Rano LN/g, to: 'Malaz Scans' },
  { from: /Rano LN's/g, to: 'Malaz Scans\'' },
  { from: /RanoLN/g, to: 'MalazLN' },
  { from: /RANO\s*LN/g, to: 'MALAZ SCANS' },
  { from: /RANO<span class="text-accent">LN<\/span>/g, to: 'MALAZ<span class="text-accent">LN</span>' },
  { from: /ranoln\.org/g, to: 'malazscans.com' },
  { from: /ranoln/g, to: 'malazscans' },
  { from: /rano-rich-text/g, to: 'malaz-rich-text' },
  { from: /rano-editor/g, to: 'malaz-editor' },
  { from: /rano-bubble-menu/g, to: 'malaz-bubble-menu' },
  { from: /rano-ln/g, to: 'malaz-scans' },
  { from: /The Literary Newsroom/gi, to: 'Light Novel Platform' },
  { from: /Gazette Account/gi, to: 'Account' },
  { from: /newsroom-style/gi, to: 'dashboard-style' },
  { from: /newsroom/gi, to: 'platform' },
  { from: /Editorial Director/gi, to: 'Admin' },
  { from: /editorial precision/gi, to: 'clean design' },
  { from: /Editorial Nickname/gi, to: 'Display Name' },
  { from: /Editorial Newsprint/gi, to: 'Minimalist' },
  { from: /editorial/gi, to: 'curated' },
  { from: /Manuscripts Desk/gi, to: 'Chapters Desk' },
  { from: /manuscripts/gi, to: 'chapters' },
  { from: /Manuscripts/gi, to: 'Chapters' },
  { from: /Enrollment Desk/gi, to: 'Registration' },
  { from: /Authentication Desk/gi, to: 'Login' },
  { from: /registry/gi, to: 'database' },
  { from: /ledger/gi, to: 'list' }
]

function walk(dir) {
  let results = []
  const list = fs.readdirSync(dir)
  list.forEach((file) => {
    file = path.join(dir, file)
    const stat = fs.statSync(file)
    if (stat && stat.isDirectory()) {
      if (!file.includes('node_modules') && !file.includes('.git') && !file.includes('.output') && !file.includes('.nuxt') && !file.includes('brain')) {
        results = results.concat(walk(file))
      }
    } else {
      if (file.endsWith('.vue') || file.endsWith('.ts') || file.endsWith('.css') || file.endsWith('.js') || file.endsWith('.json')) {
        results.push(file)
      }
    }
  })
  return results
}

const files = walk(rootDir)
let changedFiles = 0

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8')
  let original = content
  
  for (const rule of replacements) {
    content = content.replace(rule.from, rule.to)
  }
  
  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8')
    changedFiles++
    console.log('Updated:', file.replace(rootDir, ''))
  }
}

console.log(`\nReplaced strings in ${changedFiles} files.`)
