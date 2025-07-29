import fs from "fs"
import path from "path"
import { exec } from "child_process"
import { promisify } from "util"
import { type PluginConfig } from "ftc-panels"
import chokidar from "chokidar"

const execAsync = promisify(exec)

const modules: PluginConfig[] = []
const debounceMap = new Map<string, NodeJS.Timeout>()

async function buildModule(
  name: string,
  webDir: string
): Promise<PluginConfig | null> {
  const packageJsonPath = path.join(webDir, "package.json")
  if (fs.existsSync(packageJsonPath)) {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"))
    if (pkg.scripts?.build) {
      console.log(`🛠️  Building "${name}"...`)
      try {
        await execAsync("bun run build", { cwd: webDir })
      } catch (e) {
        console.error(`❌ Build failed for ${name}:`, e)
        return null
      }
    }
  }

  const distConfigJson = path.join(webDir, "dist", "config.json")
  if (!fs.existsSync(distConfigJson)) return null

  try {
    const rawConfig = fs.readFileSync(distConfigJson, "utf-8")
    return JSON.parse(rawConfig) as PluginConfig
  } catch (e) {
    console.error(`❌ Failed to parse config for ${name}:`, e)
    return null
  }
}

function watchWebDir(name: string, webDir: string) {
  if (!fs.existsSync(webDir)) return

  console.log(`👀 Watching "${name}" for changes...`)
  const watcher = chokidar.watch(webDir, {
    ignored: [path.join(webDir, "dist"), path.join(webDir, "node_modules")],
    ignoreInitial: true,
    persistent: true,
  })

  watcher.on("all", (_, filePath) => {
    if (debounceMap.has(name)) clearTimeout(debounceMap.get(name)!)
    debounceMap.set(
      name,
      setTimeout(async () => {
        console.log(`🔄 Rebuilding "${name}" due to changes...`)
        const config = await buildModule(name, webDir)
        if (config) {
          const index = modules.findIndex((m) => m.name === config.name)
          if (index >= 0) modules[index] = config
          else modules.push(config)
          console.log(`✅ Rebuilt and reloaded "${name}".`)
        }
      }, 300)
    )
  })
}

export async function globalDev(currentDir: string = process.cwd()) {
  const libraryPath = currentDir
  const modulesRaw = fs
    .readdirSync(libraryPath, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)

  const buildPromises = modulesRaw.map(async (name) => {
    const webDir = path.join(libraryPath, name, "web")
    const config = await buildModule(name, webDir)
    if (config) modules.push(config)
    return { name, webDir }
  })

  const results = await Promise.all(buildPromises)

  console.log(`✅ Built ${modules.length} module(s). Starting watchers...`)

  for (const { name, webDir } of results) {
    watchWebDir(name, webDir)
  }
}
