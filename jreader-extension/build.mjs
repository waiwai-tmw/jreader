import { build, context } from "esbuild";
import { config } from "dotenv";
import { readFileSync } from "fs";

// Load environment variables from .env.local
config({ path: '.env.local' });

// Validate BUILD environment
const BUILD = process.env.BUILD;
if (!BUILD || !['dev', 'prod'].includes(BUILD)) {
  console.error('❌ Error: BUILD environment variable must be set to either "dev" or "prod"');
  process.exit(1);
}

// Get environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const API_BASE_URL = process.env.API_BASE_URL;

if (!API_BASE_URL) {
  console.error('❌ Error: API_BASE_URL environment variable must be set');
  process.exit(1);
}

console.log('Environment variables loaded:');
console.log('SUPABASE_URL:', SUPABASE_URL ? '✓ Set' : '✗ Not set');
console.log('SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? '✓ Set' : '✗ Not set');
console.log('API_BASE_URL:', API_BASE_URL ? '✓ Set' : '✗ Not set');

const common = {
  bundle: true,
  sourcemap: false, // Disable to avoid eval issues in service workers
  target: "chrome120",
  format: "iife", // Use IIFE format for service workers (no ES6 modules)
  jsx: "automatic",
  jsxImportSource: "react",
  loader: {
    ".jsx": "jsx",
    ".tsx": "tsx",
  },
  external: [],
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
    'process.env.SUPABASE_URL': JSON.stringify(SUPABASE_URL),
    'process.env.SUPABASE_ANON_KEY': JSON.stringify(SUPABASE_ANON_KEY),
    'process.env.API_BASE_URL': JSON.stringify(process.env.API_BASE_URL)
  },
  alias: {
    '@': './src'
  },
  legalComments: "none" // Remove comments that might cause issues
};

const isWatch = process.argv.includes("--watch");
const buildTarget = process.argv.find(arg => arg.startsWith("--target="))?.split("=")[1];

// Require target to be specified
if (!buildTarget) {
  console.error("❌ Error: Target must be specified. Use --target=chrome or --target=firefox");
  console.error("Example: npm run build -- --target=chrome");
  console.error("Example: npm run dev -- --target=firefox");
  process.exit(1);
}

if (!["chrome", "firefox"].includes(buildTarget)) {
  console.error(`❌ Error: Invalid target '${buildTarget}'. Must be 'chrome' or 'firefox'`);
  process.exit(1);
}

// Determine output directory based on target and BUILD env
const distDir = `dist-${buildTarget}-${BUILD}`;
console.log(`Building ${buildTarget} extension (${BUILD}) to ${distDir}...`);

// Function to copy static files
async function copyStaticFiles() {
  const { copyFileSync, existsSync, mkdirSync, writeFileSync } = await import("fs");
  const { execFileSync } = await import("child_process");
  const path = await import("path");
  const { fileURLToPath } = await import("url");
  const util = await import("util");
  
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const projectRoot = path.resolve(__dirname);
  
  const nodeBin = process.execPath; // exact Node used to run this build
  const tailwindCli = path.join(projectRoot, "node_modules", "tailwindcss", "lib", "cli.js");
  const inputCss = path.join(projectRoot, "src", "styles", "globals.css");
  const outputCss = path.join(projectRoot, distDir, "options.css");
  
  // Debug environment (can be removed in production)
  // console.log("=== Environment Debug ===");
  // console.log("node version:", process.version);
  // console.log("execPath:", process.execPath);
  // console.log("cwd:", process.cwd());
  // console.log("PATH:", process.env.PATH);
  // console.log("NODE_OPTIONS:", process.env.NODE_OPTIONS);
  // console.log("Project root:", projectRoot);
  // console.log("Tailwind CLI:", tailwindCli);
  // console.log("Input CSS:", inputCss);
  // console.log("Output CSS:", outputCss);
  // console.log("Tailwind CLI exists:", existsSync(tailwindCli));
  // console.log("Input CSS exists:", existsSync(inputCss));
  
  // Copy HTML files from root directory
  if (existsSync("popup.html")) {
    copyFileSync("popup.html", `${distDir}/popup.html`);
  }

  // Copy auth-callback.html (needed for Firefox OAuth only)
  if (buildTarget === "firefox" && existsSync("auth-callback.html")) {
    copyFileSync("auth-callback.html", `${distDir}/auth-callback.html`);
  }

  // Copy icons directory
  const iconsDir = path.join(projectRoot, "icons");
  const distIconsDir = path.join(projectRoot, distDir, "icons");
  if (existsSync(iconsDir)) {
    // Create icons directory in dist if it doesn't exist
    mkdirSync(distIconsDir, { recursive: true });
    
    // Copy all icon files
    const iconFiles = ["icon-16.png", "icon-32.png", "icon-48.png", "icon-64.png", "icon-96.png", "icon-128.png"];
    for (const iconFile of iconFiles) {
      const srcPath = path.join(iconsDir, iconFile);
      const destPath = path.join(distIconsDir, iconFile);
      if (existsSync(srcPath)) {
        copyFileSync(srcPath, destPath);
      }
    }
  }
  
  
  // Compile Tailwind CSS to a flat path
  if (existsSync("src/styles/globals.css")) {
    try {
      // Ensure output directory exists
      mkdirSync(path.dirname(outputCss), { recursive: true });
      
      const result = execFileSync(
        nodeBin,
        [tailwindCli, "-i", inputCss, "-o", outputCss, "--minify"],
        {
          cwd: projectRoot,
          // Capture output to avoid TTY quirks; increase buffer to avoid truncation errors
          stdio: ["ignore", "pipe", "pipe"],
          maxBuffer: 10 * 1024 * 1024,
          env: {
            ...process.env,
            // normalize color/TTY expectations
            FORCE_COLOR: "0",
            NO_COLOR: "1",
            // this avoids Tailwind's "touch" file optimization in some environments
            TAILWIND_DISABLE_TOUCH: "1",
            // ensure PATH exists even if parent stripped it
            PATH: process.env.PATH || "",
          },
        }
      );
      console.log("Tailwind CSS compiled successfully");
    } catch (error) {
      // Inspect *all* error fields, including signal vs status
      console.error("Tailwind compilation failed:", error?.message);
      console.error("Exit code:", error?.status);
      console.error("Signal:", error?.signal);
      if (error?.stderr?.toString) {
        console.error("stderr:", error.stderr.toString());
      }
      if (error?.stdout?.toString) {
        console.error("stdout:", error.stdout.toString());
      }
      
      console.log("Falling back to raw CSS copy");
      copyFileSync(inputCss, outputCss);
    }
  }
  
  // Create options.html with correct CSS path
  const optionsHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <link rel="stylesheet" href="./options.css" />
    <title>JReader Extension Settings</title>
  </head>
  <body class="min-h-screen bg-background font-sans antialiased">
    <div id="root"></div>
    <script src="./settings.js" defer></script>
  </body>
</html>`;
  
  writeFileSync(`${distDir}/options.html`, optionsHtml);
  
// Process and copy manifest.json based on target and environment
  const isProd = process.env.BUILD === "prod";
  const manifestFile = buildTarget === "firefox" ? "manifest.firefox.json" : "manifest.chrome.json";
  const manifestPath = path.join(projectRoot, manifestFile);

  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

    if (buildTarget === "chrome") {
      if (isProd) {
        // Remove development-only properties for production
        delete manifest.key;
        manifest.host_permissions = [
          "https://jreader.moe/*",
          "https://*.supabase.co/*"
        ];
        manifest.content_scripts[0].matches = [
          "https://jreader.moe/*"
        ];
      } else {
        // Keep development hosts
        manifest.host_permissions = [
          "https://waiwais-macbook-pro-2.unicorn-lime.ts.net/*",
          "https://*.supabase.co/*",
        ];
        manifest.content_scripts[0].matches = [
          "https://waiwais-macbook-pro-2.unicorn-lime.ts.net/*",
        ];
      }

      // Log the permissions being set
      console.log("\nSetting manifest permissions for Chrome", isProd ? "(production)" : "(development)");
      console.log("host_permissions:", JSON.stringify(manifest.host_permissions, null, 2));
      console.log("content_script matches:", JSON.stringify(manifest.content_scripts[0].matches, null, 2));
    }

    writeFileSync(
      path.join(projectRoot, distDir, "manifest.json"),
      JSON.stringify(manifest, null, 2)
    );
  }

  // Note: Firefox manifest points directly to background.firefox.js, no copying needed
}

try {
  if (isWatch) {
    // Watch mode - use context for better performance
    const ctx = await context({
      entryPoints: ["src/sw-main.ts", "src/content.ts", "src/content-debug.ts"],
      outdir: distDir,
      ...common
    });

    // Build popup separately with outfile
    await build({
      entryPoints: ["src/popup.tsx"],
      outfile: `${distDir}/popup.js`,
      ...common
    });

    // Build settings separately with outfile
    await build({
      entryPoints: ["src/settings.tsx"],
      outfile: `${distDir}/settings.js`,
      ...common
    });
    
    // Copy static files once
    await copyStaticFiles();
    
    await ctx.watch();
    console.log("Watching for changes...");
  } else {
    // Build mode - use single background file for both Chrome and Firefox
    await build({
      entryPoints: ["src/sw-main.ts"],
      outfile: `${distDir}/background.js`,
      ...common
    });

    // Also build Firefox-specific version if needed
    if (buildTarget === "firefox") {
      await build({
        entryPoints: ["src/sw-main.ts"],
        outfile: `${distDir}/background.firefox.js`,
        ...common
      });
    }

    await build({
      entryPoints: ["src/content.ts"],
      outdir: distDir,
      ...common
    });

    // Build popup
    await build({
      entryPoints: ["src/popup.tsx"],
      outfile: `${distDir}/popup.js`,
      ...common
    });

    // Build settings
    await build({
      entryPoints: ["src/settings.tsx"],
      outfile: `${distDir}/settings.js`,
      ...common
    });

    // Copy static files
    await copyStaticFiles();
  }

  console.log("Build complete!");
  
} catch (error) {
  console.error("Build failed:", error);
  process.exit(1);
}
