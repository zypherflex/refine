import path from "node:path";
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://refinerylens:refinerylens@localhost:5432/refinerylens_test";
process.env.STORAGE_DIR = path.resolve(__dirname, "../storage-test");
process.env.SESSION_SECRET = "test-secret";
delete process.env.ANTHROPIC_API_KEY;
