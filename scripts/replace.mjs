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
  { from: /The Literary Newsroom/gi, to: 'Light Novel Platform' },
  { from: /Gazette Account/g, to: 'Account' },
  { from: /newsroom-style/g, to: 'dashboard-style' },
  { from: /newsroom/g, to: 'platform' },
  { from: /Editorial Director/g, to: 'Admin' },
  { from: /editorial precision/g, to: 'clean design' },
  { from: /Editorial Nickname/g, to: 'Display Name' },
  { from: /Editorial Newsprint/g, to: 'Minimalist' },
  { from: /editorial newsprint/g, to: 'minimalist' },
  { from: /Manuscripts Desk/g, to: 'Chapters Desk' },
  { from: /manuscripts/g, to: 'chapters' },
  { from: /Manuscripts/g, to: 'Chapters' },
  { from: /Enrollment Desk/g, to: 'Registration' },
  { from: /Authentication Desk/g, to: 'Login' }
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
      if (file.endsWith('.vue') || file.endsWith('.ts') || file.endsWith('.css') || file.endsWith('.js') || file.endsWith('package.json')) {
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
