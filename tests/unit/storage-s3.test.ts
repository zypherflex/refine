import { describe, expect, it } from "vitest";
import { s3StorageDriver, type S3Like } from "@/server/storage";

function fakeS3() {
  const objects = new Map<string, Buffer>();
  const calls: any[] = [];
  const client: S3Like = {
    async send(cmd: any) {
      const input = cmd.input;
      calls.push({ name: cmd.constructor.name, input });
      if (cmd.constructor.name === "PutObjectCommand") objects.set(input.Key, input.Body);
      if (cmd.constructor.name === "GetObjectCommand") {
        const b = objects.get(input.Key);
        if (!b) throw new Error("NoSuchKey");
        return { Body: { transformToByteArray: async () => new Uint8Array(b) } };
      }
      if (cmd.constructor.name === "DeleteObjectCommand") objects.delete(input.Key);
      return {};
    },
  };
  return { client, objects, calls };
}

describe("S3 storage driver", () => {
  it("stores private, encrypted objects under validated keys and reads them back", async () => {
    const s3 = fakeS3();
    const d = s3StorageDriver(s3.client, "bucket");
    const key = await d.put("private/user1", Buffer.from("hello"), "TXT");
    expect(key).toMatch(/^private\/user1\/[0-9a-f-]{36}\.txt$/);
    expect(s3.calls[0].input).toMatchObject({ Bucket: "bucket", ServerSideEncryption: "AES256", ACL: "private" });
    expect((await d.get(key)).toString()).toBe("hello");
    await d.remove(key);
    expect(s3.objects.size).toBe(0);
  });

  it("refuses keys that could escape the expected layout", async () => {
    const d = s3StorageDriver(fakeS3().client, "bucket");
    await expect(d.get("../../etc/passwd")).rejects.toThrow(/Invalid storage key/);
    await expect(d.get("private/user1/not-a-uuid.txt")).rejects.toThrow(/Invalid storage key/);
  });
});
