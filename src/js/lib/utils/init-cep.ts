import { company, displayName, version } from "../../../shared/shared";
import { child_process, fs, path } from "../cep/node";
import { evalTS, openLinkInBrowser } from "./bolt";
import { loadCardsGameplayConfig } from "./cardsConfig";
import { keyRegisterOverride, dropDisable } from "./cep";

const VIDEO_TUTORIALS_RELATIVE_PATH = "Creative_Marketing_Assets/GENERAL-ASSETS/Plugins/Cards Gameplay/video-tutorials";
const EXTENSION_RELEASES_RELATIVE_PATH = VIDEO_TUTORIALS_RELATIVE_PATH.replace(/\/video-tutorials$/, "/extension-releases");
const VIDEO_FILE_PATTERN = /\.(mp4|mov|m4v)$/i;
const ZXP_FILE_PATTERN = /\.zxp$/i;
const TEXT_FILE_PATTERN = /\.txt$/i;
const VERSION_PATTERN = /v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/g;
export const FLYOUT_REFRESH_EVENT = "cards-gameplay.refreshFlyoutMenu";

type FlyoutMenuEvent = {
  data:
  | {
    menuId: string;
  }
  | string;
};

type ParsedVersion = {
  raw: string;
  major: number;
  minor: number;
  patch: number;
  prerelease: string;
};

type ReleasePackageInfo = {
  version: ParsedVersion;
  filePath: string;
  folderPath: string;
};

type ReleaseNotesInfo = {
  enabled: boolean;
  label: string;
  title: string;
  text: string;
};

let activeFlyoutHandler: ((event: FlyoutMenuEvent) => void) | null = null;
let flyoutRefreshListenerRegistered = false;

const normalizePath = (value: string): string => {
  return String(value || "")
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .replace(/\/$/g, "");
};

const joinPath = (...parts: string[]): string => {
  let output = "";

  for (let i = 0; i < parts.length; i++) {
    const part = normalizePath(parts[i]);
    if (!part) continue;

    if (!output) {
      output = part;
      continue;
    }

    output = `${output}/${part.replace(/^\/+/g, "")}`;
  }

  return output;
};

const escapeXmlAttribute = (value: string): string => {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
};

const loadConfig = loadCardsGameplayConfig;

const getVideoTutorialsPath = (): string => {
  const config = loadConfig();
  const tutorialsPath = normalizePath(config.tutorialsPath || "");
  if (tutorialsPath) return tutorialsPath;

  const assetEntryPoint = normalizePath(config.assetEntryPoint || "");
  return assetEntryPoint ? joinPath(assetEntryPoint, VIDEO_TUTORIALS_RELATIVE_PATH) : "";
};

const getExtensionReleasesPath = (): string => {
  const config = loadConfig();
  const assetEntryPoint = normalizePath(config.assetEntryPoint || "");
  return assetEntryPoint ? joinPath(assetEntryPoint, EXTENSION_RELEASES_RELATIVE_PATH) : "";
};

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
      const folderVersion = parseVersion(entries[i]);
      if (!folderVersion) continue;

      const entryPath = normalizePath(path.join(releasesRoot, entries[i]));
      let stat;

      try {
        stat = fs.statSync(entryPath);
      } catch (_) {
        continue;
      }

      if (stat.isDirectory()) folders.push({ version: folderVersion, folderPath: entryPath });
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

      const entryPath = normalizePath(path.join(folderPath, entries[i]));

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

const findLatestReleasePackage = (releasesRoot: string, currentVersion: ParsedVersion): ReleasePackageInfo | null => {
  const versionFolders = getVersionFolders(releasesRoot);
  let latest: ReleasePackageInfo | null = null;

  for (let i = 0; i < versionFolders.length; i++) {
    const release = versionFolders[i];
    if (compareVersions(release.version, currentVersion) <= 0) continue;

    const zxpFiles = getFilesInFolder(release.folderPath, ZXP_FILE_PATTERN);
    if (!zxpFiles.length) continue;

    if (!latest || compareVersions(release.version, latest.version) > 0) {
      latest = {
        version: release.version,
        filePath: zxpFiles[0],
        folderPath: release.folderPath,
      };
    }
  }

  return latest;
};

const getPreferredTextFile = (folderPath: string): string => {
  const textFiles = getFilesInFolder(folderPath, TEXT_FILE_PATTERN);
  if (!textFiles.length) return "";

  textFiles.sort((a, b) => {
    const nameA = path.basename(a).toLowerCase();
    const nameB = path.basename(b).toLowerCase();
    const scoreA = nameA === "release-notes.txt" ? 0 : nameA.indexOf("release") >= 0 ? 1 : 2;
    const scoreB = nameB === "release-notes.txt" ? 0 : nameB.indexOf("release") >= 0 ? 1 : 2;
    if (scoreA !== scoreB) return scoreA - scoreB;
    return a.toLowerCase() < b.toLowerCase() ? -1 : 1;
  });

  return textFiles[0];
};

const findVersionTextFile = (releasesRoot: string, targetVersion: ParsedVersion): string => {
  const versionFolders = getVersionFolders(releasesRoot);

  for (let i = 0; i < versionFolders.length; i++) {
    const release = versionFolders[i];
    if (compareVersions(release.version, targetVersion) === 0) {
      return getPreferredTextFile(release.folderPath);
    }
  }

  return "";
};

const readTextFile = (filePath: string): string => {
  try {
    if (!filePath || !fs.existsSync(filePath)) return "";
    return String(fs.readFileSync(filePath, "utf-8") || "");
  } catch (e) {
    console.error(e);
    return "";
  }
};

const buildReleaseNotesText = (
  currentVersion: ParsedVersion,
  currentText: string,
  update: ReleasePackageInfo | null,
  updateText: string
): string => {
  const lines: string[] = [];

  lines.push(displayName);
  if (update && updateText) {
    lines.push(`Current version: v${currentVersion.raw}`);
    lines.push(`Available version: v${update.version.raw}`);
  } else {
    lines.push(`Version: v${currentVersion.raw}`);
  }

  if (update && updateText) {
    lines.push("");
    lines.push(`Available v${update.version.raw}`);
    lines.push("======================");
    lines.push(updateText);
  }

  if (currentText) {
    lines.push("");
    lines.push(`Current v${currentVersion.raw}`);
    lines.push("======================");
    lines.push(currentText);
  }

  return lines.join("\n");
};

const getReleaseNotesInfo = (): ReleaseNotesInfo => {
  const defaultInfo = {
    enabled: false,
    label: `${displayName} ${version}`,
    title: `${displayName} ${version}`,
    text: "",
  };
  const releasesRoot = getExtensionReleasesPath();
  const currentVersion = parseVersion(version);

  if (!releasesRoot || !currentVersion) return defaultInfo;

  const update = findLatestReleasePackage(releasesRoot, currentVersion);
  const currentTextPath = findVersionTextFile(releasesRoot, currentVersion);
  const updateTextPath = update ? getPreferredTextFile(update.folderPath) || findVersionTextFile(releasesRoot, update.version) : "";
  const currentText = readTextFile(currentTextPath);
  const updateText = readTextFile(updateTextPath);

  if (update && updateText) {
    return {
      enabled: true,
      label: `${displayName} ${version} > ${update.version.raw}`,
      title: `${displayName} v${version} > v${update.version.raw}`,
      text: buildReleaseNotesText(currentVersion, currentText, update, updateText),
    };
  }

  if (currentText) {
    return {
      enabled: true,
      label: `${displayName} ${version}`,
      title: `${displayName} v${version}`,
      text: buildReleaseNotesText(currentVersion, currentText, null, ""),
    };
  }

  return defaultInfo;
};

const getTutorialSortNumber = (fileName: string): number => {
  const match = String(fileName || "").match(/^(\d+)[\s_-]+/);
  return match ? parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER;
};

const getTutorialLabel = (fileName: string): string => {
  const baseName = String(fileName || "")
    .replace(/\.[^.]+$/g, "")
    .replace(/^\d+[\s_-]+/g, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^\s+|\s+$/g, "");
  const words = baseName.split(" ");

  for (let i = 0; i < words.length; i++) {
    const word = words[i].toLowerCase();
    words[i] = word ? word.charAt(0).toUpperCase() + word.substring(1) : "";
  }

  return words.join(" ") || fileName;
};

const getTutorialFiles = (): { label: string; filePath: string }[] => {
  const tutorialsPath = getVideoTutorialsPath();
  if (!tutorialsPath) return [];

  try {
    if (!fs.existsSync(tutorialsPath) || !fs.statSync(tutorialsPath).isDirectory()) return [];

    const fileNames = (fs.readdirSync(tutorialsPath) as string[])
      .filter(fileName => VIDEO_FILE_PATTERN.test(fileName))
      .sort((a, b) => {
        const sortA = getTutorialSortNumber(a);
        const sortB = getTutorialSortNumber(b);
        if (sortA !== sortB) return sortA - sortB;
        return a.toLowerCase() < b.toLowerCase() ? -1 : 1;
      });

    return fileNames.map(fileName => ({
      label: getTutorialLabel(fileName),
      filePath: normalizePath(path.join(tutorialsPath, fileName)),
    }));
  } catch (e) {
    console.error(e);
    return [];
  }
};

const openLocalFile = (filePath: string): void => {
  try {
    if (!filePath || !fs.existsSync(filePath)) return;

    if (process.platform === "win32") {
      child_process.execFile("explorer", [path.normalize(filePath)]);
      return;
    }

    if (process.platform === "darwin") {
      child_process.execFile("open", [filePath]);
      return;
    }

    child_process.execFile("xdg-open", [filePath]);
  } catch (e) {
    console.error(e);
  }
};

const showReleaseNotesDialog = (releaseNotes: ReleaseNotesInfo): void => {
  if (!releaseNotes.enabled || !releaseNotes.text) return;

  evalTS("handleShowTextDialog", releaseNotes.title, releaseNotes.text).catch((e) => {
    console.error(e);
    window.alert(releaseNotes.text);
  });
};

const buildFlyoutMenu = () => {
  const tutorialFiles = getTutorialFiles();
  const releaseNotes = getReleaseNotesInfo();
  const tutorialPathById: Record<string, string> = {};
  const tutorialItems = tutorialFiles.length
    ? tutorialFiles.map((tutorial, index) => {
      const id = `tutorial-${index}`;
      tutorialPathById[id] = tutorial.filePath;
      return `    <MenuItem Id="${id}" Label="${escapeXmlAttribute(tutorial.label)}"/>`;
    }).join("\n")
    : `    <MenuItem Id="tutorials-empty" Label="No Local Tutorials Found" Enabled="false" Checked="false"/>`;

  const menu = `<Menu>
  <MenuItem Id="website" Label="Website"/>
  <MenuItem Label="Tutorials">
${tutorialItems}
  </MenuItem>
  <MenuItem Id="info" Label="${escapeXmlAttribute(releaseNotes.label)}" Enabled="${releaseNotes.enabled ? "true" : "false"}" Checked="false"/>
  <MenuItem Id="website" Label="by ${company}" Enabled="false" Checked="false"/>
  <MenuItem Label="---" />
  <MenuItem Id="refresh" Label="Refresh" Enabled="true" Checked="false"/>
  </Menu>`;

  const flyoutHandler = (event: FlyoutMenuEvent) => {
    let menuId;
    if (typeof event.data === "string") {
      try {
        //? On build the events come in garbled string which requires some replacing and then parsing to get the data
        menuId = JSON.parse(
          event.data.replace(/\$/g, "").replace(/\=2/g, ":")
        ).menuId;
      } catch (e) {
        console.error(e);
      }
    } else {
      menuId = event.data.menuId;
    }
    if (menuId === "website") {
      openLinkInBrowser("https://www.superplay.co/");
    } else if (menuId === "info") {
      showReleaseNotesDialog(releaseNotes);
    } else if (menuId === "refresh") {
      location.reload();
    } else if (menuId && tutorialPathById[menuId]) {
      openLocalFile(tutorialPathById[menuId]);
    }
  };

  window.__adobe_cep__.invokeSync("setPanelFlyoutMenu", menu);
  if (activeFlyoutHandler && typeof window.__adobe_cep__.removeEventListener === "function") {
    window.__adobe_cep__.removeEventListener(
      "com.adobe.csxs.events.flyoutMenuClicked",
      activeFlyoutHandler
    );
  }
  activeFlyoutHandler = flyoutHandler;
  window.__adobe_cep__.addEventListener(
    "com.adobe.csxs.events.flyoutMenuClicked",
    flyoutHandler
  );
};

const buildContextMenu = () => {
  console.log("buildContextMenu");
  const menuObj = {
    menu: [
      {
        label: "Reload",
        enabled: true,
        checked: false,
        checkable: false,
        id: "c-0",
        callback: () => {
          location.reload();
        },
      },
      {
        label: "Force Reload",
        enabled: true,
        checked: false,
        checkable: false,
        id: "c-1",
        callback: () => {
          process.abort();
        },
      },
    ],
  };
  window.__adobe_cep__.invokeAsync(
    "setContextMenuByJSON",
    JSON.stringify(menuObj),
    (e: string) => {
      menuObj.menu.find((m) => m.id === e)?.callback();
    }
  );
};

export const initializeCEP = () => {
  buildFlyoutMenu();
  if (!flyoutRefreshListenerRegistered) {
    window.addEventListener(FLYOUT_REFRESH_EVENT, buildFlyoutMenu);
    flyoutRefreshListenerRegistered = true;
  }
  buildContextMenu();
  // keyRegisterOverride(); // Capture all Key Events Possible (many limitations on MacOS)
  dropDisable(); // to prevent drop files on panel and taking over
};
