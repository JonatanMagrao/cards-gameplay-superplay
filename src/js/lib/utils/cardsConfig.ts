import { fs, os, path } from "../cep/node";

export const CONFIG_DIR_NAME = "Cards Gameplay";
export const CONFIG_FILE_NAME = "config.json";
export const LEGACY_CONFIG_FILE_NAME = ".cards-layout-config.json";

export type CardsGameplayConfig = {
  assetEntryPoint?: string;
  tutorialsPath?: string;
  [key: string]: any;
};

const normalizePath = (value: string): string => {
  return String(value || "")
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .replace(/\/$/g, "");
};

const hasFilesystemAccess = (): boolean => {
  return !!(
    fs &&
    typeof fs.existsSync === "function" &&
    typeof fs.readFileSync === "function" &&
    typeof fs.writeFileSync === "function" &&
    typeof fs.mkdirSync === "function" &&
    typeof fs.renameSync === "function" &&
    typeof fs.unlinkSync === "function"
  );
};

const getHomeDir = (): string => {
  try {
    return os.homedir();
  } catch (_) {
    return "";
  }
};

export const getCardsGameplayConfigDir = (): string => {
  try {
    const homeDir = getHomeDir();
    const env = typeof process !== "undefined" && process.env ? process.env : {};
    const platform = typeof process !== "undefined" ? process.platform : "";

    if (platform === "win32") {
      const localAppData = String(env.LOCALAPPDATA || path.join(homeDir, "AppData", "Local"));
      return normalizePath(path.join(localAppData, CONFIG_DIR_NAME));
    }

    if (platform === "darwin") {
      return normalizePath(path.join(homeDir, "Library", "Application Support", CONFIG_DIR_NAME));
    }

    const configHome = String(env.XDG_CONFIG_HOME || path.join(homeDir, ".config"));
    return normalizePath(path.join(configHome, "cards-gameplay"));
  } catch (_) {
    return CONFIG_DIR_NAME;
  }
};

export const getCardsGameplayConfigPath = (): string => {
  try {
    return normalizePath(path.join(getCardsGameplayConfigDir(), CONFIG_FILE_NAME));
  } catch (_) {
    return CONFIG_FILE_NAME;
  }
};

export const getLegacyCardsGameplayConfigPath = (): string => {
  try {
    return normalizePath(path.join(getHomeDir(), LEGACY_CONFIG_FILE_NAME));
  } catch (_) {
    return LEGACY_CONFIG_FILE_NAME;
  }
};

const ensureConfigDir = (): void => {
  if (!hasFilesystemAccess()) return;

  const configDir = getCardsGameplayConfigDir();
  if (configDir && !fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
};

const readConfigFile = (configPath: string): CardsGameplayConfig => {
  if (!configPath || !hasFilesystemAccess() || !fs.existsSync(configPath)) return {};
  return JSON.parse(fs.readFileSync(configPath, "utf-8")) as CardsGameplayConfig;
};

const writeConfigFile = (data: CardsGameplayConfig): void => {
  if (!hasFilesystemAccess()) return;

  ensureConfigDir();
  fs.writeFileSync(getCardsGameplayConfigPath(), JSON.stringify(data || {}, null, 2));
};

export const moveOrDeleteLegacyCardsGameplayConfig = (): void => {
  try {
    if (!hasFilesystemAccess()) return;

    const legacyConfigPath = getLegacyCardsGameplayConfigPath();
    if (!legacyConfigPath || !fs.existsSync(legacyConfigPath)) return;

    const configPath = getCardsGameplayConfigPath();
    if (!fs.existsSync(configPath)) {
      ensureConfigDir();

      try {
        fs.renameSync(legacyConfigPath, configPath);
        return;
      } catch (_) {
        const legacyConfig = readConfigFile(legacyConfigPath);
        writeConfigFile(legacyConfig);
      }
    }

    if (fs.existsSync(legacyConfigPath)) fs.unlinkSync(legacyConfigPath);
  } catch (e) {
    console.error(e);
  }
};

export const loadCardsGameplayConfig = (): CardsGameplayConfig => {
  try {
    if (!hasFilesystemAccess()) return {};
    moveOrDeleteLegacyCardsGameplayConfig();

    const configPath = getCardsGameplayConfigPath();
    if (fs.existsSync(configPath)) return readConfigFile(configPath);
    return {};
  } catch (e) {
    console.error(e);
    return {};
  }
};

export const saveCardsGameplayConfigPatch = (data: CardsGameplayConfig): void => {
  try {
    if (!hasFilesystemAccess()) return;
    moveOrDeleteLegacyCardsGameplayConfig();

    const current = loadCardsGameplayConfig();
    writeConfigFile({ ...current, ...data });
  } catch (e) {
    console.error(e);
  }
};
