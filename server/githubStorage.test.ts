import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GitHubStorageError, readJson, updateJson } from "./githubStorage";

describe("GitHub JSON storage", () => {
  beforeEach(() => {
    vi.stubEnv("GITHUB_DATA_TOKEN", "test-token");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("decodes a JSON document returned by the GitHub Contents API", async () => {
    const content = Buffer.from(JSON.stringify({ version: 1, sites: [] }), "utf8").toString("base64");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ content, encoding: "base64", sha: "abc123" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(readJson("data/sites.json", () => ({ version: 0, sites: ["fallback"] }))).resolves.toEqual({
      data: { version: 1, sites: [] },
      sha: "abc123",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.com/repos/xEno6116/lovee-data/contents/data/sites.json",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer test-token" }) }),
    );
  });

  it("creates a missing JSON document through the Contents API", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "Not Found" }), { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ content: { sha: "new-file" } }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      updateJson("data/sites.json", () => ({ sites: [] as string[] }), "create test data", (current) => {
        current.sites.push("first-site");
        return { data: current, result: current.sites.length };
      }),
    ).resolves.toBe(1);

    const [, writeRequest] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(writeRequest.method).toBe("PUT");
    expect(JSON.parse(String(writeRequest.body))).toMatchObject({ message: "create test data" });
  });

  it("reads from the commit returned by a preceding write before performing another update", async () => {
    const firstContent = Buffer.from(JSON.stringify({ sites: [] }), "utf8").toString("base64");
    const secondContent = Buffer.from(JSON.stringify({ sites: ["first-site"] }), "utf8").toString("base64");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ content: firstContent, encoding: "base64", sha: "base-sha" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ content: { sha: "first-file" }, commit: { sha: "commit-after-first-write" } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ content: secondContent, encoding: "base64", sha: "first-file" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ content: { sha: "second-file" }, commit: { sha: "commit-after-second-write" } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await updateJson("data/sequential.json", () => ({ sites: [] as string[] }), "first write", (current) => {
      current.sites.push("first-site");
      return { data: current, result: undefined };
    });
    await updateJson("data/sequential.json", () => ({ sites: [] as string[] }), "second write", (current) => {
      current.sites.push("second-site");
      return { data: current, result: undefined };
    });

    expect(fetchMock.mock.calls[2][0]).toBe(
      "https://api.github.com/repos/xEno6116/lovee-data/contents/data/sequential.json?ref=commit-after-first-write",
    );
  });

  it("keeps unexpected GitHub failures visible instead of treating them as empty data", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ message: "Bad credentials" }), { status: 401 })));
    await expect(readJson("data/sites.json", () => ({ sites: [] }))).rejects.toBeInstanceOf(GitHubStorageError);
  });
});
