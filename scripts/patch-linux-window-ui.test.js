#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  applyLinuxFileManagerPatch,
  applyLinuxMenuPatch,
  applyLinuxOpaqueBackgroundPatch,
  patchExtractedApp,
} = require("./patch-linux-window-ui.js");

const mainBundlePrefix =
  "let n=require(`electron`),i=require(`node:path`),o=require(`node:fs`);";

test("adds Linux file manager support without relying on exact minified variable names", () => {
  const source =
    `${mainBundlePrefix}var lu=jl({id:\`fileManager\`,label:\`Finder\`,icon:\`apps/finder.png\`,kind:\`fileManager\`,darwin:{detect:()=>\`open\`,args:e=>il(e)},win32:{label:\`File Explorer\`,icon:\`apps/file-explorer.png\`,detect:uu,args:e=>il(e),open:async({path:e})=>du(e)}});function uu(){}`;

  const patched = applyLinuxFileManagerPatch(source);

  assert.match(patched, /linux:\{label:`File Manager`/);
  assert.match(patched, /detect:\(\)=>`linux-file-manager`/);
  assert.match(patched, /n\.shell\.openPath\(__codexOpenTarget\)/);
  assert.equal(applyLinuxFileManagerPatch(patched), patched);
});

test("adds Linux menu hiding next to Windows removeMenu calls", () => {
  const source = "process.platform===`win32`&&k.removeMenu(),k.on(`closed`,()=>{})";
  const patched = applyLinuxMenuPatch(source);

  assert.equal(
    patched,
    "process.platform===`linux`&&k.setMenuBarVisibility(!1),process.platform===`win32`&&k.removeMenu(),k.on(`closed`,()=>{})",
  );
  assert.equal(applyLinuxMenuPatch(patched), patched);
});

test("recognizes already-applied Linux opaque background patch", () => {
  const source =
    "process.platform===`linux`?{backgroundColor:e?t:n,backgroundMaterial:null}:{backgroundColor:r,backgroundMaterial:null}";
  assert.equal(applyLinuxOpaqueBackgroundPatch(source), source);
});

test("missing icon asset skips only icon patches", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-patch-test-"));
  try {
    const buildDir = path.join(tempRoot, ".vite", "build");
    const assetsDir = path.join(tempRoot, "webview", "assets");
    fs.mkdirSync(buildDir, { recursive: true });
    fs.mkdirSync(assetsDir, { recursive: true });
    fs.writeFileSync(
      path.join(buildDir, "main.js"),
      `${mainBundlePrefix}var lu=jl({id:\`fileManager\`,label:\`Finder\`,icon:\`apps/finder.png\`,kind:\`fileManager\`,darwin:{detect:()=>\`open\`,args:e=>il(e)},win32:{label:\`File Explorer\`,icon:\`apps/file-explorer.png\`,detect:uu,args:e=>il(e),open:async({path:e})=>du(e)}});function uu(){}`,
    );
    fs.writeFileSync(
      path.join(assetsDir, "use-resolved-theme-variant-test.js"),
      "opaqueWindows:e?.opaqueWindows??n.opaqueWindows,semanticColors:",
    );
    fs.writeFileSync(path.join(tempRoot, "package.json"), JSON.stringify({ name: "codex" }));

    patchExtractedApp(tempRoot);

    const patchedMain = fs.readFileSync(path.join(buildDir, "main.js"), "utf8");
    const patchedTheme = fs.readFileSync(
      path.join(assetsDir, "use-resolved-theme-variant-test.js"),
      "utf8",
    );
    const patchedPackage = JSON.parse(fs.readFileSync(path.join(tempRoot, "package.json"), "utf8"));

    assert.match(patchedMain, /linux:\{label:`File Manager`/);
    assert.match(patchedTheme, /includes\(`linux`\)/);
    assert.equal(patchedPackage.desktopName, "codex-desktop.desktop");
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
