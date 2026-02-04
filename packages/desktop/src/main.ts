import { app, BrowserWindow, clipboard, dialog, Menu, shell } from "electron";
import Store from "electron-store";
import { createDenigmaServer } from "@denigma/server";
import { basename, resolve } from "node:path";
import { existsSync } from "node:fs";
import type { Server } from "node:http";

type StoredState = {
  lastRepoRoot?: string;
};

const store = new Store<StoredState>({ name: "denigma-desktop" });

let mainWindow: BrowserWindow | null = null;
let server: Server | null = null;
let serverPort: number | null = null;
let currentRepoRoot: string | null = null;

function isDev(): boolean {
  return Boolean(process.env.DENIGMA_DESKTOP_DEV_UI_URL);
}

function uiDistDir(): string | undefined {
  if (isDev()) return undefined;
  const p = resolve(__dirname, "../../ui/dist");
  return existsSync(p) ? p : undefined;
}

async function chooseRepoRoot(): Promise<string | null> {
  const res = await dialog.showOpenDialog({
    title: "Select a repository folder",
    properties: ["openDirectory"],
  });
  if (res.canceled) return null;
  const dir = res.filePaths[0];
  return dir ? resolve(dir) : null;
}

async function startServer(repoRoot: string): Promise<void> {
  await stopServer();
  currentRepoRoot = repoRoot;
  if (mainWindow) mainWindow.setTitle(`Denigma — ${basename(repoRoot)}`);

  const dev = isDev();
  const uiDist = uiDistDir();
  const appServer = uiDist ? createDenigmaServer({ repoRoot, uiDistDir: uiDist }) : createDenigmaServer({ repoRoot });

  const listenPort = dev ? 8787 : 0;
  server = appServer.listen(listenPort, "127.0.0.1");

  await new Promise<void>((resolvePromise, reject) => {
    if (!server) return reject(new Error("Server failed to start"));
    server.on("listening", () => {
      const addr = server?.address();
      if (addr && typeof addr === "object") serverPort = addr.port;
      resolvePromise();
    });
    server.on("error", reject);
  });

  buildMenu();
}

async function stopServer(): Promise<void> {
  if (!server) return;
  await new Promise<void>((resolvePromise) => server?.close(() => resolvePromise()));
  server = null;
  serverPort = null;
}

function currentUiUrl(): string | null {
  if (isDev()) return process.env.DENIGMA_DESKTOP_DEV_UI_URL ?? null;
  if (!serverPort) return null;
  return `http://127.0.0.1:${serverPort}/`;
}

async function loadMainWindow(): Promise<void> {
  if (!mainWindow) return;
  if (isDev()) {
    const url = process.env.DENIGMA_DESKTOP_DEV_UI_URL!;
    await mainWindow.loadURL(url);
    mainWindow.webContents.openDevTools({ mode: "detach" });
    return;
  }

  if (!serverPort) throw new Error("Missing server port");
  await mainWindow.loadURL(`http://127.0.0.1:${serverPort}/`);
}

function buildMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: "File",
      submenu: [
        {
          label: "Open Repo…",
          click: async () => {
            const next = await chooseRepoRoot();
            if (!next) return;
            store.set("lastRepoRoot", next);
            await startServer(next);
            await loadMainWindow();
          },
        },
        {
          label: "Reveal Repo Folder",
          click: () => {
            const repoRoot = currentRepoRoot ?? store.get("lastRepoRoot") ?? null;
            if (!repoRoot) return;
            void shell.openPath(repoRoot);
          },
        },
        {
          label: "Copy App URL",
          click: () => {
            const url = currentUiUrl();
            if (!url) return;
            clipboard.writeText(url);
          },
        },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    { role: "viewMenu" },
    { role: "windowMenu" },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: "#0F172A",
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on("ready-to-show", () => mainWindow?.show());
  mainWindow.on("closed", async () => {
    mainWindow = null;
    await stopServer();
  });

  buildMenu();

  const preferred = store.get("lastRepoRoot");
  const repoRoot = preferred ?? (await chooseRepoRoot());
  if (!repoRoot) {
    app.quit();
    return;
  }

  store.set("lastRepoRoot", repoRoot);
  await startServer(repoRoot);
  await loadMainWindow();
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow();
});

void app.whenReady().then(createWindow);
