import { describe, expect, it } from "vitest";

describe("GitHub data credential", () => {
  it("can read the configured repository without exposing the token", async () => {
    const token = process.env.GITHUB_DATA_TOKEN;
    expect(token).toBeTruthy();

    const response = await fetch("https://api.github.com/repos/xEno6116/lovee-data", {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    expect(response.ok).toBe(true);
    const payload = (await response.json()) as { full_name?: string; private?: boolean };
    expect(payload.full_name).toBe("xEno6116/lovee-data");
    expect(payload.private).toBe(true);
  });
});
