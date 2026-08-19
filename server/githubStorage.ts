type GitHubContentFile = {
  content?: string;
  encoding?: string;
  sha?: string;
  message?: string;
  commit?: { sha?: string };
};

type JsonUpdate<T, R> = {
  data: T;
  result: R;
};

export class GitHubStorageError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "GitHubStorageError";
  }
}

const REPOSITORY_OWNER = "xEno6116";
const REPOSITORY_NAME = "lovee-data";
const API_ROOT = `https://api.github.com/repos/${REPOSITORY_OWNER}/${REPOSITORY_NAME}/contents`;
const latestCommitByPath = new Map<string, string>();

function requireToken() {
  const token = process.env.GITHUB_DATA_TOKEN;
  if (!token) {
    throw new Error("ยังไม่ได้กำหนด GITHUB_DATA_TOKEN สำหรับที่เก็บข้อมูลเว็บไซต์");
  }
  return token;
}

function apiUrl(path: string, ref?: string) {
  const url = new URL(`${API_ROOT}/${path.split("/").map(encodeURIComponent).join("/")}`);
  if (ref) url.searchParams.set("ref", ref);
  return url.toString();
}

async function request(path: string, init: RequestInit = {}, ref?: string) {
  const response = await fetch(apiUrl(path, ref), {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${requireToken()}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { message?: string };
    throw new GitHubStorageError(payload.message || "ไม่สามารถติดต่อ GitHub data repository ได้", response.status);
  }

  return (await response.json()) as GitHubContentFile;
}

export async function readJson<T>(path: string, makeDefault: () => T): Promise<{ data: T; sha?: string }> {
  try {
    const file = await request(path, {}, latestCommitByPath.get(path));
    if (!file.content || file.encoding !== "base64" || !file.sha) {
      throw new Error(`ไฟล์ข้อมูล ${path} มีรูปแบบไม่ถูกต้อง`);
    }
    const decoded = Buffer.from(file.content.replace(/\n/g, ""), "base64").toString("utf8");
    return { data: JSON.parse(decoded) as T, sha: file.sha };
  } catch (error) {
    if (error instanceof GitHubStorageError && error.status === 404) {
      return { data: makeDefault() };
    }
    throw error;
  }
}

async function writeJson<T>(path: string, data: T, message: string, sha?: string) {
  const content = Buffer.from(`${JSON.stringify(data, null, 2)}\n`, "utf8").toString("base64");
  const written = await request(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, content, ...(sha ? { sha } : {}) }),
  });
  if (written.commit?.sha) latestCommitByPath.set(path, written.commit.sha);
  return written;
}

/**
 * Updates one JSON file with optimistic concurrency. GitHub rejects conflicting
 * file writes; a bounded retry protects independent owner actions from losing data.
 */
export async function updateJson<T, R>(
  path: string,
  makeDefault: () => T,
  message: string,
  mutate: (current: T) => Promise<JsonUpdate<T, R>> | JsonUpdate<T, R>,
): Promise<R> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, sha } = await readJson(path, makeDefault);
    const updated = await mutate(data);

    try {
      await writeJson(path, updated.data, message, sha);
      return updated.result;
    } catch (error) {
      if (error instanceof GitHubStorageError && (error.status === 409 || error.status === 422) && attempt < 2) {
        lastError = error;
        continue;
      }
      throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("ไม่สามารถบันทึกข้อมูลหลังจากลองซ้ำแล้ว");
}
