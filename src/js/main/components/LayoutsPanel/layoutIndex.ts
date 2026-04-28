import { fs, os, path } from "../../../lib/cep/node";
import { csi } from "../../../lib/utils/bolt";

export type LayoutIndexEntry = {
  folder: string;
  name: string;
  label: string;
  description: string;
  tags: string[];
  favorite: boolean;
  jsonPath: string;
  thumbnailPath: string;
  sourceResolution: string;
  cardCount: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
};

export type UpsertLayoutIndexInput = {
  folder: string;
  name: string;
  description?: string;
  tags?: string[];
  jsonPath: string;
  thumbnailPath: string;
  sourceResolution?: string;
  cardCount?: number;
};

const DB_FILE_NAME = "layouts.sqlite";
const SCHEMA_VERSION = 1;

let sqlJsPromise: Promise<any> | null = null;

const normalizePath = (value: string): string => String(value || "").replace(/\\/g, "/");

const nowIso = (): string => new Date().toISOString();

const getCurrentUserName = (): string => {
  try {
    const userInfo = os.userInfo && os.userInfo();
    if (userInfo && userInfo.username) return String(userInfo.username);
  } catch (_) { }

  try {
    const env = process.env || {};
    return String(env.USERNAME || env.USER || env.LOGNAME || "unknown");
  } catch (_) { }

  return "unknown";
};

const safeTrim = (value: any): string => String(value || "").replace(/^\s+|\s+$/g, "");

export const parseTags = (value: string | string[] | undefined): string[] => {
  const source = value instanceof Array ? value : String(value || "").split(",");
  const seen: Record<string, boolean> = {};
  const tags: string[] = [];

  for (let i = 0; i < source.length; i++) {
    const tag = safeTrim(source[i]).toLowerCase();
    if (!tag || seen[tag]) continue;
    seen[tag] = true;
    tags.push(tag);
  }

  return tags;
};

const getSqlJs = async (): Promise<any | null> => {
  if (!window.cep || !window.cep_node || !window.cep_node.require) return null;
  if (sqlJsPromise) return sqlJsPromise;

  sqlJsPromise = new Promise(async (resolve, reject) => {
    try {
      const runtimeRequire = window.cep_node.require;
      const initSqlJs = runtimeRequire("sql.js");
      let sqlJsRoot = "";

      try {
        sqlJsRoot = path.dirname(runtimeRequire.resolve("sql.js/package.json"));
      } catch (_) {
        sqlJsRoot = path.join(csi.getSystemPath("extension"), "node_modules", "sql.js");
      }

      const SQL = await initSqlJs({
        locateFile: (fileName: string) => normalizePath(path.join(sqlJsRoot, "dist", fileName))
      });

      resolve(SQL);
    } catch (error) {
      reject(error);
    }
  });

  return sqlJsPromise;
};

const getDbPath = (rootPath: string): string => normalizePath(path.join(rootPath, DB_FILE_NAME));

const ensureRootFolder = (rootPath: string): void => {
  if (!rootPath) throw new Error("Invalid layouts root path.");
  if (!fs.existsSync(rootPath)) fs.mkdirSync(rootPath, { recursive: true });
};

const openDatabase = async (rootPath: string): Promise<any | null> => {
  const SQL = await getSqlJs();
  if (!SQL) return null;

  ensureRootFolder(rootPath);
  const dbPath = getDbPath(rootPath);

  if (fs.existsSync(dbPath)) {
    const fileData = fs.readFileSync(dbPath) as Buffer;
    return new SQL.Database(new Uint8Array(fileData));
  }

  return new SQL.Database();
};

const saveDatabase = (db: any, rootPath: string): void => {
  const exported = db.export();
  fs.writeFileSync(getDbPath(rootPath), Buffer.from(exported));
};

const setupSchema = (db: any): void => {
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS levels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      folder TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      favorite INTEGER NOT NULL DEFAULT 0,
      json_path TEXT NOT NULL DEFAULT '',
      thumbnail_path TEXT NOT NULL DEFAULT '',
      source_width INTEGER NOT NULL DEFAULT 0,
      source_height INTEGER NOT NULL DEFAULT 0,
      card_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      created_by TEXT NOT NULL DEFAULT '',
      updated_by TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS level_tags (
      level_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (level_id, tag_id),
      FOREIGN KEY (level_id) REFERENCES levels(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );
    PRAGMA user_version = ${SCHEMA_VERSION};
  `);
};

const selectRows = (db: any, sql: string, params: any[] = []): any[] => {
  const rows: any[] = [];
  const statement = db.prepare(sql);

  try {
    statement.bind(params);
    while (statement.step()) rows.push(statement.getAsObject());
  } finally {
    statement.free();
  }

  return rows;
};

const selectOne = (db: any, sql: string, params: any[] = []): any | null => {
  const rows = selectRows(db, sql, params);
  return rows.length ? rows[0] : null;
};

const run = (db: any, sql: string, params: any[] = []): void => {
  db.run(sql, params);
};

const getLevelLabelFromFolderName = (levelFolder: string): string => {
  return String(levelFolder || "").replace(/^lvl_/, "");
};

const parseResolution = (value: any): [number, number] => {
  if (value && value instanceof Array && value.length >= 2) {
    const width = Number(value[0]) || 0;
    const height = Number(value[1]) || 0;
    return [width, height];
  }

  return [0, 0];
};

const getJsonLayoutInfo = (jsonPath: string): {
  name: string;
  description: string;
  tags: string[];
  sourceWidth: number;
  sourceHeight: number;
  cardCount: number;
} => {
  try {
    if (!jsonPath || !fs.existsSync(jsonPath)) {
      return { name: "", description: "", tags: [], sourceWidth: 0, sourceHeight: 0, cardCount: 0 };
    }

    const raw = fs.readFileSync(jsonPath, "utf-8");
    const data = JSON.parse(raw);
    const resolution = parseResolution(data.resolution);

    return {
      name: String(data.level || ""),
      description: String(data.description || ""),
      tags: parseTags(data.tags),
      sourceWidth: resolution[0],
      sourceHeight: resolution[1],
      cardCount: data.cards && data.cards.length ? data.cards.length : 0,
    };
  } catch (_) {
    return { name: "", description: "", tags: [], sourceWidth: 0, sourceHeight: 0, cardCount: 0 };
  }
};

const findFirstExisting = (paths: string[]): string => {
  for (let i = 0; i < paths.length; i++) {
    if (paths[i] && fs.existsSync(paths[i])) return normalizePath(paths[i]);
  }
  return "";
};

const getCanonicalJsonPath = (levelFolderPath: string): string => {
  const layoutJsonPath = normalizePath(path.join(levelFolderPath, "layout.json"));
  if (fs.existsSync(layoutJsonPath)) return layoutJsonPath;

  try {
    const entries = fs.readdirSync(levelFolderPath) as string[];
    const resolutionJsonFiles: string[] = [];
    const otherJsonFiles: string[] = [];

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (!/\.json$/i.test(entry)) continue;
      if (/^\d{2,5}x\d{2,5}\.json$/i.test(entry)) resolutionJsonFiles.push(entry);
      else otherJsonFiles.push(entry);
    }

    resolutionJsonFiles.sort();
    otherJsonFiles.sort();

    const selected = resolutionJsonFiles[0] || otherJsonFiles[0] || "";
    return selected ? normalizePath(path.join(levelFolderPath, selected)) : "";
  } catch (_) {
    return "";
  }
};

const getCanonicalThumbnailPath = (levelFolderPath: string): string => {
  const directThumbnail = findFirstExisting([
    path.join(levelFolderPath, "thumbnail.jpg"),
    path.join(levelFolderPath, "thumbnail.jpeg"),
    path.join(levelFolderPath, "thumbnail.png"),
    path.join(levelFolderPath, "layout.jpg"),
    path.join(levelFolderPath, "layout.jpeg"),
    path.join(levelFolderPath, "layout.png"),
  ]);
  if (directThumbnail) return directThumbnail;

  try {
    const entries = fs.readdirSync(levelFolderPath) as string[];
    const images: string[] = [];

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (/\.(jpe?g|png)$/i.test(entry)) images.push(entry);
    }

    images.sort();
    return images.length ? normalizePath(path.join(levelFolderPath, images[0])) : "";
  } catch (_) {
    return "";
  }
};

const getFolderNames = (rootPath: string): string[] => {
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

const getLevelId = (db: any, folder: string): number | null => {
  const row = selectOne(db, "SELECT id FROM levels WHERE folder = ?", [folder]);
  return row && typeof row.id === "number" ? row.id : null;
};

const setLevelTags = (db: any, levelId: number, tags: string[]): void => {
  run(db, "DELETE FROM level_tags WHERE level_id = ?", [levelId]);

  for (let i = 0; i < tags.length; i++) {
    run(db, "INSERT OR IGNORE INTO tags (name) VALUES (?)", [tags[i]]);
    const tagRow = selectOne(db, "SELECT id FROM tags WHERE name = ?", [tags[i]]);
    if (!tagRow) continue;
    run(db, "INSERT OR IGNORE INTO level_tags (level_id, tag_id) VALUES (?, ?)", [levelId, tagRow.id]);
  }
};

const ensureLevelFromFolder = (db: any, rootPath: string, folder: string): void => {
  const levelFolderPath = normalizePath(path.join(rootPath, folder));
  const jsonPath = getCanonicalJsonPath(levelFolderPath);
  const thumbnailPath = getCanonicalThumbnailPath(levelFolderPath);
  const info = getJsonLayoutInfo(jsonPath);
  const existing = selectOne(db, "SELECT * FROM levels WHERE folder = ?", [folder]);
  const fallbackName = getLevelLabelFromFolderName(folder);
  const userName = getCurrentUserName();
  const timestamp = nowIso();

  if (!existing) {
    run(
      db,
      `INSERT INTO levels (
        folder, name, description, favorite, json_path, thumbnail_path,
        source_width, source_height, card_count,
        created_at, updated_at, created_by, updated_by
      ) VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        folder,
        info.name || fallbackName,
        info.description,
        jsonPath,
        thumbnailPath,
        info.sourceWidth,
        info.sourceHeight,
        info.cardCount,
        timestamp,
        timestamp,
        userName,
        userName,
      ]
    );

    const levelId = getLevelId(db, folder);
    if (levelId !== null) setLevelTags(db, levelId, info.tags);
    return;
  }

  run(
    db,
    `UPDATE levels
      SET name = ?, description = ?, json_path = ?, thumbnail_path = ?, source_width = ?, source_height = ?, card_count = ?
      WHERE folder = ?`,
    [
      info.name || String(existing.name || "") || fallbackName,
      info.description,
      jsonPath,
      thumbnailPath,
      info.sourceWidth,
      info.sourceHeight,
      info.cardCount,
      folder
    ]
  );

  setLevelTags(db, existing.id, info.tags);
};

const removeMissingFolders = (db: any, folders: string[]): void => {
  const existingRows = selectRows(db, "SELECT folder FROM levels");
  const present: Record<string, boolean> = {};
  for (let i = 0; i < folders.length; i++) present[folders[i]] = true;

  for (let i = 0; i < existingRows.length; i++) {
    const folder = String(existingRows[i].folder || "");
    if (!present[folder]) run(db, "DELETE FROM levels WHERE folder = ?", [folder]);
  }
};

const getEntries = (db: any): LayoutIndexEntry[] => {
  const levelRows = selectRows(db, "SELECT * FROM levels ORDER BY favorite DESC, folder ASC");
  const entries: LayoutIndexEntry[] = [];

  for (let i = 0; i < levelRows.length; i++) {
    const row = levelRows[i];
    const tagRows = selectRows(
      db,
      `SELECT tags.name
        FROM tags
        INNER JOIN level_tags ON level_tags.tag_id = tags.id
        WHERE level_tags.level_id = ?
        ORDER BY tags.name ASC`,
      [row.id]
    );
    const tags: string[] = [];
    for (let t = 0; t < tagRows.length; t++) tags.push(String(tagRows[t].name || ""));

    const width = Number(row.source_width) || 0;
    const height = Number(row.source_height) || 0;

    entries.push({
      folder: String(row.folder || ""),
      name: String(row.name || ""),
      label: getLevelLabelFromFolderName(String(row.folder || "")),
      description: String(row.description || ""),
      tags,
      favorite: Number(row.favorite) === 1,
      jsonPath: normalizePath(String(row.json_path || "")),
      thumbnailPath: normalizePath(String(row.thumbnail_path || "")),
      sourceResolution: width && height ? `${width}x${height}` : "",
      cardCount: Number(row.card_count) || 0,
      createdAt: String(row.created_at || ""),
      updatedAt: String(row.updated_at || ""),
      createdBy: String(row.created_by || ""),
      updatedBy: String(row.updated_by || ""),
    });
  }

  return entries;
};

export const scanLayoutEntries = (rootPathInput: string): LayoutIndexEntry[] => {
  const rootPath = normalizePath(rootPathInput);
  const folders = getFolderNames(rootPath);
  const entries: LayoutIndexEntry[] = [];
  const userName = getCurrentUserName();

  for (let i = 0; i < folders.length; i++) {
    const folder = folders[i];
    const levelFolderPath = normalizePath(path.join(rootPath, folder));
    const jsonPath = getCanonicalJsonPath(levelFolderPath);
    const thumbnailPath = getCanonicalThumbnailPath(levelFolderPath);
    const info = getJsonLayoutInfo(jsonPath);
    const timestamp = nowIso();
    let updatedAt = timestamp;

    try {
      if (jsonPath && fs.existsSync(jsonPath)) {
        updatedAt = fs.statSync(jsonPath).mtime.toISOString();
      }
    } catch (_) { }

    entries.push({
      folder,
      name: info.name || getLevelLabelFromFolderName(folder),
      label: getLevelLabelFromFolderName(folder),
      description: info.description,
      tags: info.tags,
      favorite: false,
      jsonPath,
      thumbnailPath,
      sourceResolution: info.sourceWidth && info.sourceHeight ? `${info.sourceWidth}x${info.sourceHeight}` : "",
      cardCount: info.cardCount,
      createdAt: updatedAt,
      updatedAt,
      createdBy: userName,
      updatedBy: userName,
    });
  }

  return entries;
};

export const syncLayoutIndex = async (rootPathInput: string): Promise<LayoutIndexEntry[]> => {
  const rootPath = normalizePath(rootPathInput);
  let db: any | null = null;

  try {
    db = await openDatabase(rootPath);
  } catch (error) {
    console.error(error);
    return scanLayoutEntries(rootPath);
  }

  if (!db) return scanLayoutEntries(rootPath);

  try {
    setupSchema(db);
    const folders = getFolderNames(rootPath);
    removeMissingFolders(db, folders);

    for (let i = 0; i < folders.length; i++) {
      ensureLevelFromFolder(db, rootPath, folders[i]);
    }

    const entries = getEntries(db);
    saveDatabase(db, rootPath);
    return entries;
  } finally {
    db.close();
  }
};

export const upsertLayoutIndexEntry = async (
  rootPathInput: string,
  input: UpsertLayoutIndexInput
): Promise<void> => {
  const rootPath = normalizePath(rootPathInput);
  const db = await openDatabase(rootPath);
  if (!db) return;

  try {
    setupSchema(db);
    const existing = selectOne(db, "SELECT * FROM levels WHERE folder = ?", [input.folder]);
    const timestamp = nowIso();
    const userName = getCurrentUserName();
    const tags = parseTags(input.tags);
    const resolution = String(input.sourceResolution || "").match(/(\d{2,5})x(\d{2,5})/i);
    const sourceWidth = resolution ? Number(resolution[1]) || 0 : 0;
    const sourceHeight = resolution ? Number(resolution[2]) || 0 : 0;

    if (existing) {
      run(
        db,
        `UPDATE levels
          SET name = ?, description = ?, json_path = ?, thumbnail_path = ?,
              source_width = ?, source_height = ?, card_count = ?,
              updated_at = ?, updated_by = ?
          WHERE folder = ?`,
        [
          input.name,
          input.description || "",
          normalizePath(input.jsonPath),
          normalizePath(input.thumbnailPath),
          sourceWidth,
          sourceHeight,
          Number(input.cardCount) || 0,
          timestamp,
          userName,
          input.folder,
        ]
      );
      setLevelTags(db, existing.id, tags);
    } else {
      run(
        db,
        `INSERT INTO levels (
          folder, name, description, favorite, json_path, thumbnail_path,
          source_width, source_height, card_count,
          created_at, updated_at, created_by, updated_by
        ) VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          input.folder,
          input.name,
          input.description || "",
          normalizePath(input.jsonPath),
          normalizePath(input.thumbnailPath),
          sourceWidth,
          sourceHeight,
          Number(input.cardCount) || 0,
          timestamp,
          timestamp,
          userName,
          userName,
        ]
      );

      const levelId = getLevelId(db, input.folder);
      if (levelId !== null) setLevelTags(db, levelId, tags);
    }

    saveDatabase(db, rootPath);
  } finally {
    db.close();
  }
};

export const setLayoutFavorite = async (
  rootPathInput: string,
  folder: string,
  favorite: boolean
): Promise<void> => {
  const rootPath = normalizePath(rootPathInput);
  const db = await openDatabase(rootPath);
  if (!db) return;

  try {
    setupSchema(db);
    run(db, "UPDATE levels SET favorite = ? WHERE folder = ?", [favorite ? 1 : 0, folder]);
    saveDatabase(db, rootPath);
  } finally {
    db.close();
  }
};
