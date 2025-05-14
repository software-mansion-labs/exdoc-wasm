const path = require("node:path");
const process = require("node:process");
const cp = require("node:child_process");
const esbuild = require("esbuild");
const fsExtra = require("fs-extra");
const fs = require("node:fs/promises");
const handlebars = require("handlebars");
const util = require("node:util");

const exec = util.promisify(cp.exec);

const watchMode = Boolean(process.env.npm_config_watch);

/** @type {import('esbuild').BuildOptions[]} */
const formatters = [
  {
    formatter: "epub",
    outdir: path.resolve("../formatters/epub/dist"),
    entryPoints: [
      "js/entry/epub.js",
      "css/entry/epub-elixir.css",
      "css/entry/epub-erlang.css",
    ],
  },
  {
    formatter: "html",
    outdir: path.resolve("../formatters/html/dist"),
    entryPoints: [
      "js/entry/inline_html.js",
      "js/entry/html.js",
      "css/entry/html-elixir.css",
      "css/entry/html-erlang.css",
    ],
    loader: {
      ".woff2": "file",
      // TODO: Remove when @fontsource/* removes legacy .woff
      ".woff": "file",
    },
  },
];

Promise.all(
  formatters.map(async ({ formatter, ...options }) => {
    // Clean outdir.
    await fsExtra.emptyDir(options.outdir);
    try {
      await fs.mkdir(path.resolve("../formatters/html/wasm/"));
    } catch (_e) {}
    const htmlOutdir = path.resolve("../formatters/html/wasm/");
    for (const file of [
      "js/wasm/AtomVM.mjs",
      "js/wasm/AtomVM.wasm",
      "js/wasm/popcorn.js",
      "js/wasm/popcorn_iframe.js",
      "js/wasm/eval.avm",
    ]) {
      await fs.copyFile(
        path.resolve(file),
        path.resolve(htmlOutdir, path.basename(file)),
      );
    }

    await esbuild.build({
      entryNames: watchMode ? "[name]-dev" : "[name]-[hash]",
      bundle: true,
      minify: !watchMode,
      logLevel: watchMode ? "warning" : "info",
      watch: watchMode,
      ...options,
      plugins: [
        {
          name: "ex_doc",
          setup(build) {
            // Pre-compile handlebars templates.
            build.onLoad(
              {
                filter: /\.handlebars$/,
              },
              async ({ path: filename }) => {
                try {
                  const source = await fs.readFile(filename, "utf-8");
                  const template = handlebars.precompile(source);
                  const contents = [
                    "import * as Handlebars from 'handlebars/runtime'",
                    "import '../helpers'",
                    `export default Handlebars.template(${template})`,
                  ].join("\n");
                  return { contents };
                } catch (error) {
                  return { errors: [{ text: error.message }] };
                }
              },
            );

            // Load html templates.
            build.onLoad(
              {
                filter: /\.html$/,
              },
              async ({ path: filename }) => {
                try {
                  const source = await fs.readFile(filename, "utf-8");
                  // Remove newlines and leading whitespace.
                  // Shouldn't have any effect on content.
                  const compressed = source.replace(/\n\s*/g, "");
                  const contents = `export default ${JSON.stringify(compressed)}`;
                  return { contents };
                } catch (error) {
                  return { errors: [{ text: error.message }] };
                }
              },
            );

            // build.onLoad({ filter: /AtomVM\.js$/ }, async (args) => {
            //   const script = await fs.readFile(args.path, "utf8");
            //   const pattern =
            //     'var Module=typeof Module!="undefined"?Module:{};';
            //   const replacement =
            //     'var Module=typeof window.Module!="undefined"?window.Module:{};';

            //   return { contents: script.replace(pattern, replacement) };
            // });

            // Generate docs with new assets (watch mode only).
            if (watchMode) {
              build.onEnd(async (result) => {
                if (result.errors.length) return;
                console.log(`${formatter} assets built`);
                await exec(`mix docs --formatter ${formatter}`, { cwd: "../" });
                console.log(`${formatter} docs built`);
              });
            }
          },
        },
      ],
    });
  }),
).catch((error) => {
  console.error(error);
  process.exit(1);
});
