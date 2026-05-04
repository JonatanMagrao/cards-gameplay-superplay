import { fs, os, path } from "../../../lib/cep/node";
import { LayoutIndexEntry, scanLayoutEntries, syncLayoutIndex } from "./layoutIndex";

export type LayoutCacheSyncResult = {
  cacheRootPath: string;
  remoteRootPath: string;
  entries: LayoutIndexEntry[];
  copiedFiles: number;
  removedFolders: number;
  syncedAt: string;
};

export type LayoutCacheSyncProgress = {
  completedFolders: number;
  totalFolders: number;
  currentFolder: string;
};

export type LayoutCacheSyncOptions = {
  batchSize?: number;
  onProgress?: (progress: LayoutCacheSyncProgress) => void;
};

const CACHE_INFO_FILE_NAME = "cache-info.json";
const DB_FILE_NAME = "layouts.sqlite";
const DEFAULT_SYNC_BATCH_SIZE = 8;

const normalizePath = (value: string): string => String(value || "").replace(/\\/g, "/");

const safeTrim = (value: any): string => String(value || "").replace(/^\s+|\s+$/g, "");

const waitForUi = (ms: number = 0): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

const ensureFolder = (folderPath: string): void => {
  if (folderPath && !fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });
};

const sanitizeToken = (value: string): string => {
  const baseName = safeTrim(value)
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .pop() || "layouts";

  return baseName
    .replace(/[<>:"/|?*\x00-\x1F]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/_+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "layouts";
};

const hashString = (value: string): string => {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(i);
  }

  return (hash >>> 0).toString(16);
};

const getCacheBasePath = (): string => {
  const env = process.env || {};

  if (process.platform === "win32") {
    return normalizePath(path.join(
      String(env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local")),
      "Cards Gameplay",
      "cache",
      "layouts"
    ));
  }

  if (process.platform === "darwin") {
    return normalizePath(path.join(os.homedir(), "Library", "Caches", "Cards Gameplay", "layouts"));
  }

  return normalizePath(path.join(
    String(env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache")),
    "cards-gameplay",
    "layouts"
  ));
};

export const getLayoutCacheRootPath = (remoteRootPathInput: string, cacheRootPathInput?: string): string => {
  const customCacheRootPath = normalizePath(cacheRootPathInput || "");
  if (customCacheRootPath) return customCacheRootPath;

  const remoteRootPath = normalizePath(remoteRootPathInput);
  if (!remoteRootPath) return "";

  const libraryId = `${hashString(remoteRootPath.toLowerCase())}-${sanitizeToken(remoteRootPath)}`;
  return normalizePath(path.join(getCacheBasePath(), libraryId));
};

const getLevelFolderNames = (rootPath: string): string[] => {
  if (!rootPath || !fs.existsSync(rootPath)) return [];

  try {
    const entries = fs.readdirSync(rootPath) as string[];
    const folders: string[] = [];

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (!/^lvl_/.test(entry)) continue;

      const fullPath = normalizePath(path.join(rootPath, entry));
      try {
        if (fs.statSync(fullPath).isDirectory()) folders.push(entry);
      } catch (_) { }
    }

    folders.sort();
    return folders;
  } catch (_) {
    return [];
  }
};

const readCacheEntries = async (cacheRootPath: string): Promise<LayoutIndexEntry[]> => {
  if (!cacheRootPath || !fs.existsSync(cacheRootPath)) return [];

  try {
    return await syncLayoutIndex(cacheRootPath);
  } catch (error) {
    console.error(error);
    return scanLayoutEntries(cacheRootPath);
  }
};

export const readLayoutCacheEntries = async (remoteRootPath: string, cacheRootPath?: string): Promise<LayoutIndexEntry[]> => {
  return readCacheEntries(getLayoutCacheRootPath(remoteRootPath, cacheRootPath));
};

const shouldCopyFile = (sourcePath: string, targetPath: string): boolean => {
  if (!fs.existsSync(targetPath)) return true;

  try {
    const sourceStat = fs.statSync(sourcePath);
    const targetStat = fs.statSync(targetPath);
    return sourceStat.size !== targetStat.size || sourceStat.mtimeMs > targetStat.mtimeMs;
  } catch (_) {
    return true;
  }
};

const copyFileIfChanged = (sourcePath: string, targetPath: string): boolean => {
  if (!sourcePath || !fs.existsSync(sourcePath)) return false;
  if (!shouldCopyFile(sourcePath, targetPath)) return false;

  ensureFolder(normalizePath(path.dirname(targetPath)));
  fs.copyFileSync(sourcePath, targetPath);

  try {
    const sourceStat = fs.statSync(sourcePath);
    fs.utimesSync(targetPath, sourceStat.atime, sourceStat.mtime);
  } catch (_) { }

  return true;
};

const removeFolderRecursive = (folderPath: string): void => {
  if (!folderPath || !fs.existsSync(folderPath)) return;

  const entries = fs.readdirSync(folderPath) as string[];
  for (let i = 0; i < entries.length; i++) {
    const entryPath = normalizePath(path.join(folderPath, entries[i]));
    const stat = fs.statSync(entryPath);
    if (stat.isDirectory()) removeFolderRecursive(entryPath);
    else fs.unlinkSync(entryPath);
  }

  fs.rmdirSync(folderPath);
};

const copyLevelFilesToCache = (remoteLevelFolderPath: string, cacheLevelFolderPath: string): number => {
  if (!remoteLevelFolderPath || !fs.existsSync(remoteLevelFolderPath)) return 0;

  ensureFolder(cacheLevelFolderPath);

  const copiedNames: Record<string, boolean> = {};
  let copiedFiles = 0;
  const entries = fs.readdirSync(remoteLevelFolderPath) as string[];

  for (let i = 0; i < entries.length; i++) {
    const entryName = entries[i];
    if (!/\.(json|jpe?g|png)$/i.test(entryName)) continue;

    const sourcePath = normalizePath(path.join(remoteLevelFolderPath, entryName));
    const targetPath = normalizePath(path.join(cacheLevelFolderPath, entryName));

    try {
      if (!fs.statSync(sourcePath).isFile()) continue;
      copiedNames[entryName.toLowerCase()] = true;
      if (copyFileIfChanged(sourcePath, targetPath)) copiedFiles += 1;
    } catch (_) { }
  }

  const cachedEntries = fs.readdirSync(cacheLevelFolderPath) as string[];
  for (let i = 0; i < cachedEntries.length; i++) {
    const cachedName = cachedEntries[i];
    if (!/\.(json|jpe?g|png)$/i.test(cachedName)) continue;
    if (copiedNames[cachedName.toLowerCase()]) continue;

    try {
      fs.unlinkSync(normalizePath(path.join(cacheLevelFolderPath, cachedName)));
    } catch (_) { }
  }

  return copiedFiles;
};

const removeMissingCacheFolders = (cacheRootPath: string, remoteFolders: string[]): number => {
  if (!remoteFolders.length || !cacheRootPath || !fs.existsSync(cacheRootPath)) return 0;

  const remoteFolderMap: Record<string, boolean> = {};
  for (let i = 0; i < remoteFolders.length; i++) remoteFolderMap[remoteFolders[i]] = true;

  const localFolders = getLevelFolderNames(cacheRootPath);
  let removedFolders = 0;

  for (let i = 0; i < localFolders.length; i++) {
    const folder = localFolders[i];
    if (remoteFolderMap[folder]) continue;

    try {
      removeFolderRecursive(normalizePath(path.join(cacheRootPath, folder)));
      removedFolders += 1;
    } catch (error) {
      console.error(error);
    }
  }

  return removedFolders;
};

export const clearLayoutCache = (cacheRootPathInput: string): number => {
  const cacheRootPath = normalizePath(cacheRootPathInput);
  if (!cacheRootPath || !fs.existsSync(cacheRootPath)) return 0;

  let removedItems = 0;

  try {
    const entries = fs.readdirSync(cacheRootPath) as string[];

    for (let i = 0; i < entries.length; i++) {
      const entryName = entries[i];
      const entryPath = normalizePath(path.join(cacheRootPath, entryName));

      try {
        const stat = fs.statSync(entryPath);

        if (stat.isDirectory() && /^lvl_/.test(entryName)) {
          removeFolderRecursive(entryPath);
          removedItems += 1;
          continue;
        }

        if (stat.isFile() && (entryName === CACHE_INFO_FILE_NAME || entryName === DB_FILE_NAME)) {
          fs.unlinkSync(entryPath);
          removedItems += 1;
        }
      } catch (error) {
        console.error(error);
      }
    }
  } catch (error) {
    console.error(error);
  }

  return removedItems;
};

const writeCacheInfo = (cacheRootPath: string, remoteRootPath: string, syncedAt: string): void => {
  try {
    ensureFolder(cacheRootPath);
    fs.writeFileSync(
      normalizePath(path.join(cacheRootPath, CACHE_INFO_FILE_NAME)),
      JSON.stringify({ remoteRootPath, cacheRootPath, syncedAt }, null, 2),
      "utf-8"
    );
  } catch (error) {
    console.error(error);
  }
};

export const syncSingleLayoutToCache = async (
  remoteRootPathInput: string,
  levelFolderName: string,
  cacheRootPathInput?: string,
  options?: LayoutCacheSyncOptions
): Promise<LayoutCacheSyncResult> => {
  const remoteRootPath = normalizePath(remoteRootPathInput);
  const cacheRootPath = getLayoutCacheRootPath(remoteRootPath, cacheRootPathInput);
  const syncedAt = new Date().toISOString();

  if (!remoteRootPath || !fs.existsSync(remoteRootPath)) {
    throw new Error("Layouts folder not found.");
  }

  ensureFolder(cacheRootPath);

  const remoteLevelFolderPath = normalizePath(path.join(remoteRootPath, levelFolderName));
  const cacheLevelFolderPath = normalizePath(path.join(cacheRootPath, levelFolderName));
  if (options && options.onProgress) options.onProgress({ completedFolders: 0, totalFolders: 1, currentFolder: levelFolderName });
  await waitForUi();
  const copiedFiles = copyLevelFilesToCache(remoteLevelFolderPath, cacheLevelFolderPath);
  if (options && options.onProgress) options.onProgress({ completedFolders: 1, totalFolders: 1, currentFolder: levelFolderName });
  await waitForUi();
  const entries = await readCacheEntries(cacheRootPath);

  writeCacheInfo(cacheRootPath, remoteRootPath, syncedAt);

  return {
    cacheRootPath,
    remoteRootPath,
    entries,
    copiedFiles,
    removedFolders: 0,
    syncedAt
  };
};

export const syncLayoutCacheFromRemote = async (
  remoteRootPathInput: string,
  cacheRootPathInput?: string,
  options?: LayoutCacheSyncOptions
): Promise<LayoutCacheSyncResult> => {
  const remoteRootPath = normalizePath(remoteRootPathInput);
  const cacheRootPath = getLayoutCacheRootPath(remoteRootPath, cacheRootPathInput);
  const syncedAt = new Date().toISOString();

  if (!remoteRootPath || !fs.existsSync(remoteRootPath)) {
    throw new Error("Layouts folder not found.");
  }

  ensureFolder(cacheRootPath);

  const remoteFolders = getLevelFolderNames(remoteRootPath);
  let copiedFiles = 0;
  const batchSize = Math.max(1, Number(options && options.batchSize) || DEFAULT_SYNC_BATCH_SIZE);

  if (options && options.onProgress) {
    options.onProgress({ completedFolders: 0, totalFolders: remoteFolders.length, currentFolder: "" });
  }

  await waitForUi();

  for (let i = 0; i < remoteFolders.length; i++) {
    const folder = remoteFolders[i];
    copiedFiles += copyLevelFilesToCache(
      normalizePath(path.join(remoteRootPath, folder)),
      normalizePath(path.join(cacheRootPath, folder))
    );

    if (options && options.onProgress) {
      options.onProgress({
        completedFolders: i + 1,
        totalFolders: remoteFolders.length,
        currentFolder: folder
      });
    }

    if ((i + 1) % batchSize === 0) await waitForUi();
  }

  await waitForUi();

  const removedFolders = removeMissingCacheFolders(cacheRootPath, remoteFolders);
  await waitForUi();

  const entries = await readCacheEntries(cacheRootPath);

  writeCacheInfo(cacheRootPath, remoteRootPath, syncedAt);

  return {
    cacheRootPath,
    remoteRootPath,
    entries,
    copiedFiles,
    removedFolders,
    syncedAt
  };
};
