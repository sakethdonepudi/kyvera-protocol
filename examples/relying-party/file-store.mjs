/**
 * Minimal file-backed AuthRequestStore for the independent relying-party demo.
 *
 * This is deliberately a single-process demo store, not a production database.
 * Writes are atomic at the file level (temp file + rename), and `takeRequest`
 * removes the challenge before returning it so a concurrent caller in the same
 * process cannot consume it twice.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomBytes } from "node:crypto";

function empty() {
  return { requests: {}, sessions: {} };
}

export class FileAuthRequestStore {
  constructor(file) {
    this.file = file;
    mkdirSync(dirname(file), { recursive: true });
    if (!existsSync(file)) this.write(empty());
  }

  read() {
    const parsed = JSON.parse(readFileSync(this.file, "utf8"));
    if (!parsed || typeof parsed !== "object" || !parsed.requests || !parsed.sessions) {
      throw new Error("auth store is malformed; refusing to continue");
    }
    return parsed;
  }

  write(data) {
    const temp = join(dirname(this.file), `.${randomBytes(8).toString("hex")}.tmp`);
    writeFileSync(temp, JSON.stringify(data, null, 2));
    renameSync(temp, this.file);
  }

  putRequest(request) {
    const data = this.read();
    data.requests[request.challenge] = request;
    this.write(data);
  }

  takeRequest(challenge) {
    const data = this.read();
    const request = data.requests[challenge];
    if (!request) return undefined;
    delete data.requests[challenge];
    this.write(data);
    return request;
  }

  putSession(session) {
    const data = this.read();
    data.sessions[session.token] = session;
    this.write(data);
  }

  getSession(token) {
    return this.read().sessions[token];
  }

  deleteSession(token) {
    const data = this.read();
    if (!data.sessions[token]) return false;
    delete data.sessions[token];
    this.write(data);
    return true;
  }

  prune(now) {
    const data = this.read();
    let changed = false;
    for (const [key, request] of Object.entries(data.requests)) {
      if (now > request.expiresAt) {
        delete data.requests[key];
        changed = true;
      }
    }
    for (const [key, session] of Object.entries(data.sessions)) {
      if (now > session.expiresAt) {
        delete data.sessions[key];
        changed = true;
      }
    }
    if (changed) this.write(data);
  }
}
