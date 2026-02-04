export function encodeRepoRelativePathToDngName(repoRelativePath: string): string {
  const normalized = repoRelativePath.replaceAll("\\", "/").replace(/^\.\/+/, "");
  return `${normalized.replaceAll("/", "__")}.dng.json`;
}

export function normalizeRepoRelativePath(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Invalid path: empty");
  if (trimmed.includes("\0")) throw new Error("Invalid path: contains null byte");
  if (trimmed.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(trimmed)) {
    throw new Error("Invalid path: must be repo-relative");
  }

  const posix = trimmed.replaceAll("\\", "/");
  const parts = posix.split("/");
  const normalizedParts: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") throw new Error("Invalid path: path traversal not allowed");
    normalizedParts.push(part);
  }
  if (normalizedParts.length === 0) throw new Error("Invalid path: empty after normalization");
  return normalizedParts.join("/");
}
