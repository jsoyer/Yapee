// build-manifests.js
// Generates manifest.json (Chrome) and manifest.firefox.json (Firefox)
// from build/manifest.base.json and build/hosters.json.
//
// Single source of truth for the hoster domain list: build/hosters.json
// Run: node scripts/build-manifests.js

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function read(rel) {
  return JSON.parse(readFileSync(resolve(root, rel), "utf8"));
}

function write(rel, obj) {
  writeFileSync(resolve(root, rel), JSON.stringify(obj, null, 2) + "\n", "utf8");
}

const hosters = read("build/hosters.json");
const base = read("build/manifest.base.json");

// ---------------------------------------------------------------------------
// Chrome manifest
// Key order must match the original manifest.json exactly.
// ---------------------------------------------------------------------------
const chrome = {
  name: base.name,
  version: base.version,
  description: base.description,
  default_locale: base.default_locale,
  permissions: ["storage", "contextMenus", "notifications", "alarms", "sidePanel", "scripting"],
  host_permissions: base.host_permissions,
  optional_host_permissions: base.optional_host_permissions,
  action: base.action,
  icons: base.icons,
  homepage_url: base.homepage_url,
  options_page: base.options_page,
  background: {
    service_worker: "background.js",
    type: "module",
  },
  content_scripts: [{
    matches: hosters,
    js: ["content-relay.js"],
    run_at: "document_idle",
  }],
  content_security_policy: base.content_security_policy,
  commands: base.commands,
  side_panel: {
    default_path: "popup.html",
  },
  externally_connectable: {
    matches: hosters,
  },
  manifest_version: base.manifest_version,
};

// ---------------------------------------------------------------------------
// Firefox manifest
// Key order must match the original manifest.firefox.json exactly.
// ---------------------------------------------------------------------------
const firefox = {
  name: base.name,
  version: base.version,
  description: base.description,
  default_locale: base.default_locale,
  permissions: ["storage", "contextMenus", "notifications", "alarms", "scripting"],
  host_permissions: base.host_permissions,
  optional_host_permissions: base.optional_host_permissions,
  action: base.action,
  icons: base.icons,
  homepage_url: base.homepage_url,
  options_page: base.options_page,
  background: {
    scripts: ["background.js"],
    service_worker: "background.js",
    type: "module",
  },
  content_scripts: [{
    matches: hosters,
    js: ["content-relay.js"],
    run_at: "document_idle",
  }],
  content_security_policy: base.content_security_policy,
  commands: base.commands,
  sidebar_action: {
    default_panel: "popup.html",
    default_title: "__MSG_extensionName__",
    default_icon: {
      "16": "images/icon_16.png",
      "32": "images/icon_32.png",
    },
  },
  browser_specific_settings: {
    gecko: {
      id: "yapee@jsoyer.github.io",
      strict_min_version: "128.0",
      data_collection_permissions: {
        required: ["none"],
        optional: [],
      },
    },
  },
  manifest_version: base.manifest_version,
};

write("manifest.json", chrome);
write("manifest.firefox.json", firefox);

console.log("Generated manifest.json (Chrome)");
console.log("Generated manifest.firefox.json (Firefox)");
console.log(`Hoster entries: ${hosters.length}`);
