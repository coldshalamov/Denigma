// Public API surface of @denigma/cli for use by other packages (e.g. @denigma/mcp).
// The CLI binary (bin.ts) is the end-user entry point; this file exposes the
// programmatic internals.
export { detectRepoStore, denigmaSidecarPath, dngSidecarPath } from "./store.js";
export { doctorRepo, type DoctorReport } from "./doctor.js";
export { getRepoStatus, type RepoStatus, type TrackedFileStatus } from "./status.js";
export { trackFile } from "./track.js";
export { syncFile } from "./sync.js";
export { normalizeRepoRelativePath } from "./paths.js";
