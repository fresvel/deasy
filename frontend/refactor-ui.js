import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const srcDir = path.join(__dirname, 'src')

// Helper para obtener todos los archivos
function getAllFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList
  const files = fs.readdirSync(dir)
  for (const file of files) {
    const fullPath = path.join(dir, file)
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, fileList)
    } else {
      fileList.push(fullPath)
    }
  }
  return fileList
}

// 1. Mapeo específico de componentes UI a sus nuevas categorías
const componentRules = {
  'shared/components/ui/AppButton.vue': 'shared/components/buttons/AppButton.vue',
  'shared/components/ui/BtnDelete.vue': 'shared/components/buttons/BtnDelete.vue',
  'shared/components/ui/BtnEdit.vue': 'shared/components/buttons/BtnEdit.vue',
  'shared/components/ui/BtnSera.vue': 'shared/components/buttons/BtnSera.vue',

  'shared/components/ui/SInput.vue': 'shared/components/forms/SInput.vue',
  'shared/components/ui/SSelect.vue': 'shared/components/forms/SSelect.vue',
  'shared/components/ui/SDate.vue': 'shared/components/forms/SDate.vue',
  'shared/components/ui/PdfDropField.vue': 'shared/components/forms/PdfDropField.vue',
  'shared/components/ui/AppFormModalLayout.vue': 'shared/components/forms/AppFormModalLayout.vue',

  'shared/components/ui/AppDataTable.vue': 'shared/components/data/AppDataTable.vue',
  'shared/components/ui/AppTag.vue': 'shared/components/data/AppTag.vue',
  'shared/components/ui/RowActionMenu.vue': 'shared/components/data/RowActionMenu.vue',

  'shared/components/ui/AppModalShell.vue': 'shared/components/modals/AppModalShell.vue',
  'shared/components/ui/SessionExpiryModal.vue': 'shared/components/modals/SessionExpiryModal.vue',

  'shared/components/ui/AppPageIntro.vue': 'shared/components/layout/AppPageIntro.vue',
  'shared/components/ui/AppNavCard.vue': 'shared/components/layout/AppNavCard.vue',
  
  'shared/components/ui/Loading.vue': 'shared/components/feedback/Loading.vue',

  'shared/components/ui/WorkspaceChatLauncher.vue': 'shared/components/widgets/WorkspaceChatLauncher.vue',
  'shared/components/ui/ColabEditor.vue': 'shared/components/widgets/ColabEditor.vue',
  'shared/components/ui/UserProfile.vue': 'shared/components/widgets/UserProfile.vue',

  'shared/components/ui/ObtenerInformes.vue': 'modules/academia/components/ObtenerInformes.vue',
  'shared/components/ui/DossierDocumentUploadModal.vue': 'modules/dossier/components/DossierDocumentUploadModal.vue'
}

function getNewPath(oldPath) {
  const relPath = path.relative(srcDir, oldPath).replace(/\\/g, '/')
  if (componentRules[relPath]) {
      return path.join(srcDir, componentRules[relPath])
  }
  return oldPath
}

console.log('Construyendo mapa de archivos...')
const allFiles = getAllFiles(srcDir)
const fileMap = {}
for (const file of allFiles) {
  fileMap[file] = getNewPath(file)
}

function resolveOldImport(currentFilePath, importStr) {
  let absoluteImport = ''
  if (importStr.startsWith('@/')) {
    absoluteImport = path.join(srcDir, importStr.slice(2))
  } else if (importStr.startsWith('.')) {
    absoluteImport = path.join(path.dirname(currentFilePath), importStr)
  } else {
    return null
  }

  const exts = ['', '.js', '.vue', '/index.js', '/index.vue']
  for (const ext of exts) {
    if (fileMap[absoluteImport + ext]) {
      return absoluteImport + ext
    }
  }
  return null
}

console.log('Refactorizando imports...')
const importRegex = /(import\s+(?:.*?\s+from\s+)?['"])([^'"]+)(['"])|(import\(['"])([^'"]+)(['"]\))/g

Object.entries(fileMap).forEach(([oldPath, newPath]) => {
  if (!oldPath.endsWith('.js') && !oldPath.endsWith('.vue')) return
  
  let content = fs.readFileSync(oldPath, 'utf8')
  let changed = false;
  
  content = content.replace(importRegex, (match, prefix1, target1, suffix1, prefix2, target2, suffix2) => {
    const prefix = prefix1 || prefix2
    const suffix = suffix1 || suffix2
    const target = target1 || target2

    if (!target.startsWith('.') && !target.startsWith('@/')) {
        return match
    }

    const resolvedOld = resolveOldImport(oldPath, target)
    if (resolvedOld && fileMap[resolvedOld] !== resolvedOld) {
      // ONLY replace if the file is actually moving!
      const newDest = fileMap[resolvedOld]
      const relToSrc = path.relative(srcDir, newDest).replace(/\\/g, '/')
      let newTarget = `@/${relToSrc}`
      
      if (newTarget.endsWith('.js') && !target.endsWith('.js')) newTarget = newTarget.slice(0, -3)
      if (newTarget.endsWith('.vue') && !target.endsWith('.vue')) newTarget = newTarget.slice(0, -4)

      changed = true;
      return `${prefix}${newTarget}${suffix}`
    }
    return match
  })

  // Additionally, handle absolute imports that don't pass the check if any, but since we are replacing all matches
  // we just save if changed
  if(changed) {
     fs.writeFileSync(oldPath, content)
  }
})

console.log('Moviendo archivos a su nueva estructura...')
function ensureDir(filePath) {
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

let movedCount = 0;
Object.entries(fileMap).forEach(([oldPath, newPath]) => {
  if (oldPath === newPath) return
  ensureDir(newPath)
  fs.renameSync(oldPath, newPath)
  movedCount++;
})

// Clean up ui directory if empty
const uiDir = path.join(srcDir, 'shared/components/ui');
if(fs.existsSync(uiDir) && fs.readdirSync(uiDir).length === 0) {
    fs.rmdirSync(uiDir)
}

console.log(`Arquitectura UI reestructurada correctamente. ${movedCount} archivos movidos.`)
