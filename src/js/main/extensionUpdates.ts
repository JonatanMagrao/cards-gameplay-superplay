import { child_process, fs, path } from "../lib/cep/node";
import { getDefaultExtensionReleasesPath, normalizeAssetPath } from "./assetPaths";

type ParsedVersion = {
  raw: string;
  major: number;
  minor: number;
  patch: number;
  prerelease: string;
};

export type ExtensionUpdateInfo = {
  currentVersion: string;
  version: string;
  zxpPath: string;
  releaseFolder: string;
  releasesRoot: string;
};

const ZXP_PATTERN = /\.zxp$/i;
const VERSION_PATTERN = /v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/g;

const parseVersion = (value: string): ParsedVersion | null => {
  VERSION_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null = null;
  let selected: RegExpExecArray | null = null;

  while ((match = VERSION_PATTERN.exec(String(value || ""))) !== null) {
    selected = match;
  }

  if (!selected) return null;

  return {
    raw: selected[0].replace(/^v/i, ""),
    major: parseInt(selected[1], 10),
    minor: parseInt(selected[2], 10),
    patch: parseInt(selected[3], 10),
    prerelease: selected[4] || "",
  };
};

const compareVersions = (a: ParsedVersion, b: ParsedVersion): number => {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  if (a.patch !== b.patch) return a.patch - b.patch;
  if (a.prerelease === b.prerelease) return 0;
  if (!a.prerelease) return 1;
  if (!b.prerelease) return -1;
  return a.prerelease < b.prerelease ? -1 : 1;
};

const getVersionFolders = (releasesRoot: string): { version: ParsedVersion; folderPath: string }[] => {
  if (!releasesRoot) return [];

  try {
    if (!fs.existsSync(releasesRoot) || !fs.statSync(releasesRoot).isDirectory()) return [];

    const entries = fs.readdirSync(releasesRoot) as string[];
    const folders: { version: ParsedVersion; folderPath: string }[] = [];

    for (let i = 0; i < entries.length; i++) {
      const version = parseVersion(entries[i]);
      if (!version) continue;

      const entryPath = normalizeAssetPath(path.join(releasesRoot, entries[i]));
      let stat;

      try {
        stat = fs.statSync(entryPath);
      } catch (_) {
        continue;
      }

      if (stat.isDirectory()) folders.push({ version, folderPath: entryPath });
    }

    return folders;
  } catch (e) {
    console.error(e);
    return [];
  }
};

const getFilesInFolder = (folderPath: string, pattern: RegExp): string[] => {
  if (!folderPath) return [];

  try {
    if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) return [];

    const entries = fs.readdirSync(folderPath) as string[];
    const files: string[] = [];

    for (let i = 0; i < entries.length; i++) {
      if (!pattern.test(entries[i])) continue;

      const entryPath = normalizeAssetPath(path.join(folderPath, entries[i]));

      try {
        if (fs.statSync(entryPath).isFile()) files.push(entryPath);
      } catch (_) { }
    }

    files.sort((a, b) => a.toLowerCase() < b.toLowerCase() ? -1 : 1);
    return files;
  } catch (e) {
    console.error(e);
    return [];
  }
};

export const getAvailableExtensionUpdate = (
  assetEntryPoint: string,
  currentVersion: string
): ExtensionUpdateInfo | null => {
  const releasesRoot = getDefaultExtensionReleasesPath(assetEntryPoint);
  const current = parseVersion(currentVersion);
  if (!releasesRoot || !current) return null;

  const versionFolders = getVersionFolders(releasesRoot);
  let latest: { version: ParsedVersion; zxpPath: string } | null = null;

  for (let i = 0; i < versionFolders.length; i++) {
    const release = versionFolders[i];
    if (compareVersions(release.version, current) <= 0) continue;

    const zxpFiles = getFilesInFolder(release.folderPath, ZXP_PATTERN);
    if (!zxpFiles.length) continue;

    if (!latest || compareVersions(release.version, latest.version) > 0) {
      latest = { version: release.version, zxpPath: zxpFiles[0] };
    }
  }

  if (!latest || compareVersions(latest.version, current) <= 0) return null;

  return {
    currentVersion,
    version: latest.version.raw,
    zxpPath: latest.zxpPath,
    releaseFolder: normalizeAssetPath(path.dirname(latest.zxpPath)),
    releasesRoot: normalizeAssetPath(releasesRoot),
  };
};

export const openExtensionUpdate = (update: ExtensionUpdateInfo): void => {
  if (!update || !update.zxpPath) return;

  try {
    const releaseFolder = path.normalize(update.releaseFolder || path.dirname(update.zxpPath));

    if (process.platform === "win32") {
      child_process.execFile("explorer", [releaseFolder]);
      return;
    }

    if (process.platform === "darwin") {
      child_process.execFile("open", [releaseFolder]);
      return;
    }

    child_process.execFile("xdg-open", [releaseFolder]);
  } catch (e) {
    console.error(e);
  }
};
