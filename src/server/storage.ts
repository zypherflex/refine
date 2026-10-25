import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

/**
 * Private object storage. Files never live under the public web root; they are only served through
 * route handlers that perform an authorisation check first. The local driver is used in development
 * and single-server deployments; the S3-compatible driver is for production (requires bucket credentials).
 */
export interface StorageDriver {
  put(prefix: string, data: Buffer, ext: string): Promise<string>;
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}

const KEY_RE = /^[a-z0-9_-]+\/[a-z0-9_-]+\/[0-9a-f-]{36}\.[a-z0-9]{1,5}$/;

function root() {
  return path.resolve(process.env.STORAGE_DIR ?? "./storage");
}

function newKey(prefix: string, ext: string) {
  const safePrefix = prefix.toLowerCase().replace(/[^a-z0-9_/-]/g, "");
  const key = `${safePrefix}/${randomUUID()}.${ext.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
  if (!KEY_RE.test(key)) throw new Error("Invalid storage key");
  return key;
}

function resolveKey(key: string): string {
  if (!KEY_RE.test(key)) throw new Error("Invalid storage key");
  const full = path.resolve(root(), key);
  if (!full.startsWith(root() + path.sep)) throw new Error("Invalid storage key");
  return full;
}

export const localStorageDriver: StorageDriver = {
  async put(prefix, data, ext) {
    const key = newKey(prefix, ext);
    const full = resolveKey(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data, { mode: 0o600 });
    return key;
  },
  async get(key) {
    return readFile(resolveKey(key));
  },
  async remove(key) {
    await unlink(resolveKey(key)).catch(() => undefined);
  },
};

/** Minimal client surface the S3 driver needs, so tests can supply a fake. */
export type S3Like = { send(command: PutObjectCommand | GetObjectCommand | DeleteObjectCommand): Promise<any> };

/**
 * S3-compatible driver (AWS S3, Cloudflare R2, MinIO and similar). Objects are private and server-side encrypted;
 * they are only ever streamed back through the same authorised route handlers as local files.
 */
export function s3StorageDriver(client: S3Like, bucket: string): StorageDriver {
  const checked = (key: string) => {
    if (!KEY_RE.test(key)) throw new Error("Invalid storage key");
    return key;
  };
  return {
    async put(prefix, data, ext) {
      const key = newKey(prefix, ext);
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: data, ServerSideEncryption: "AES256", ACL: "private" }));
      return key;
    },
    async get(key) {
      const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: checked(key) }));
      return Buffer.from(await res.Body.transformToByteArray());
    },
    async remove(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: checked(key) })).catch(() => undefined);
    },
  };
}

let s3Driver: StorageDriver | null = null;

export function storage(): StorageDriver {
  const driver = process.env.STORAGE_DRIVER ?? "local";
  if (driver === "local") return localStorageDriver;
  if (driver === "s3") {
    const { S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_ENDPOINT } = process.env;
    if (!S3_BUCKET || !S3_REGION || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) throw new Error("STORAGE_DRIVER=s3 needs S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.");
    s3Driver ??= s3StorageDriver(
      new S3Client({ region: S3_REGION, endpoint: S3_ENDPOINT || undefined, forcePathStyle: Boolean(S3_ENDPOINT), credentials: { accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY } }),
      S3_BUCKET,
    );
    return s3Driver;
  }
  throw new Error(`Unknown storage driver "${driver}". Use "local" or "s3".`);
}
