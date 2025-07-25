import { build } from "vite"
import { svelte } from "@sveltejs/vite-plugin-svelte"
import fs from "fs"
import path from "path"
import type { PluginConfig } from "../core/types"
export async function buildPanelsPlugin(dir: string): Promise<PluginConfig> {
  const generatedDir = path.resolve(dir, ".panels")
  const distDir = path.resolve(dir, "dist")
  const distWidgetsDir = path.resolve(dir, "dist/widgets")
  const distDocsDir = path.resolve(dir, "dist/docs")

  if (!fs.existsSync(generatedDir)) {
    fs.mkdirSync(generatedDir)
  }

  const configPath = path.resolve(dir, "config.ts")

  const module = await import(/* @vite-ignore */ configPath)

  const config = module.config as PluginConfig

  console.log(config)

  const widgetNames = config.widgets.map((w) => w.name)
  const duplicates = widgetNames.filter(
    (name, i, arr) => arr.indexOf(name) !== i
  )

  if (duplicates.length > 0) {
    throw new Error(
      `Duplicate widget names found in config: ${[...new Set(duplicates)].join(", ")}`
    )
  }

  const docsNames = []

  if (config.docs?.homepage) {
    docsNames.push(config.docs.homepage.name)
  }

  if (Array.isArray(config.docs?.chapters)) {
    docsNames.push(...config.docs.chapters.map((c) => c.name))
  }

  const docsDuplicates = docsNames.filter(
    (name, i, arr) => arr.indexOf(name) !== i
  )
  if (docsDuplicates.length > 0) {
    throw new Error(
      `Duplicate doc names found between homepage and chapters: ${[
        ...new Set(docsDuplicates),
      ].join(", ")}`
    )
  }

  function writeConfigJsonToDist(config: PluginConfig) {
    if (!fs.existsSync(distDir)) {
      fs.mkdirSync(distDir, { recursive: true })
    }

    const jsonPath = path.resolve(distDir, "config.json")
    fs.writeFileSync(jsonPath, JSON.stringify(config, null, 2), "utf-8")
  }

  function clearDist() {
    if (fs.existsSync(distDir)) {
      fs.readdirSync(distDir).forEach((file) => {
        const filePath = path.join(distDir, file)
        if (fs.lstatSync(filePath).isDirectory()) {
          fs.rmSync(filePath, { recursive: true, force: true })
        } else {
          fs.unlinkSync(filePath)
        }
      })
    }
  }

  function clearUdmDist() {
    const clearUmdFilesInDir = (dirPath: string) => {
      if (fs.existsSync(dirPath)) {
        fs.readdirSync(dirPath).forEach((file) => {
          const filePath = path.join(dirPath, file)
          if (
            !fs.lstatSync(filePath).isDirectory() &&
            file.endsWith(".umd.cjs")
          ) {
            fs.unlinkSync(filePath)
          }
        })
      }
    }

    clearUmdFilesInDir(distWidgetsDir)
    clearUmdFilesInDir(distDocsDir)
    clearUmdFilesInDir(distDir)
  }

  function createTsWrapper(name: string, filepath: string) {
    const tsFilename = `${name}.ts`
    const tsFilePath = path.resolve(generatedDir, tsFilename)
    const sanitizedName = name.replace(/ /g, "_")

    const tsContent = `import { mount } from "svelte"
import ${sanitizedName} from "${path
      .relative(generatedDir, path.resolve(dir, filepath))
      .replace(/\\/g, "/")}"

export default function load(target: HTMLElement, props: any) {
  return mount(${sanitizedName}, {
    target: target,
    props: props,
  })
}
`
    fs.writeFileSync(tsFilePath, tsContent, "utf-8")
  }

  async function buildAllComponents(names: string[], outputSubfolder: string) {
    for (const name of names) {
      const entryPath = path.resolve(generatedDir, `${name}.ts`)

      console.log(`Building component: ${name} into ${outputSubfolder}`)

      await build({
        plugins: [
          svelte({
            emitCss: false,
          }),
        ],
        build: {
          lib: {
            entry: entryPath,
            name: "Component",
            fileName: `${outputSubfolder}/${name}`,
          },
          rollupOptions: {
            external: [],
            output: {
              globals: {},
            },
          },
          minify: false,
          emptyOutDir: false,
        },
      })
    }
  }

  config.widgets.forEach(({ name, filepath }) => {
    createTsWrapper(name, filepath)
  })

  createTsWrapper(config.docs.homepage.name, config.docs.homepage.filepath)

  config.docs.chapters.forEach(({ name, filepath }) => {
    createTsWrapper(name, filepath)
  })

  try {
    clearDist()
    writeConfigJsonToDist(config)

    await buildAllComponents(
      config.widgets.map((w) => w.name),
      "widgets"
    )

    await buildAllComponents([config.docs.homepage.name], "docs")

    if (config.docs.chapters.length > 0) {
      await buildAllComponents(
        config.docs.chapters.map((c) => c.name),
        "docs"
      )
    }

    const managerEntry = config.manager
    await build({
      plugins: [
        svelte({
          emitCss: false,
        }),
      ],
      build: {
        lib: {
          entry: managerEntry.filepath,
          name: "Manager",
          fileName: `${managerEntry.name}`,
        },
        rollupOptions: {
          external: [],
          output: {
            globals: {},
          },
        },
        emptyOutDir: false,
      },
    })

    fs.readdirSync(generatedDir).forEach((file) => {
      fs.unlinkSync(path.resolve(generatedDir, file))
    })

    clearUdmDist()

    console.log("All components built!")
  } catch (err) {
    console.error(err)
    throw err
  }

  return config
}
