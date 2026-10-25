import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vite-plus/test";

const script = resolve(__dirname, "../../scripts/retire-task-consumer.ts");

describe("task consumer retirement command", () => {
  function run(
    environment: string,
    token = "cli-token-fixture",
    denied = false,
  ): {
    status: number | null;
    stdout: string;
    stderr: string;
  } {
    const directory = mkdtempSync(join(tmpdir(), "oxytype-retire-consumer-"));
    const fixture = join(directory, "fetch.mjs");
    writeFileSync(
      fixture,
      `globalThis.fetch = async (url, init) => {
        console.log(JSON.stringify({url, method: init.method}));
        if (init.headers.Authorization !== 'Bearer cli-token-fixture') throw new Error('Wrong credentials');
        if (process.env.FIXTURE_DENIED === 'true') return new Response('denied', {status:403});
        if (init.method === 'DELETE') return Response.json({success:true,result:null});
        const staging = url.includes('oxytype-staging-tasks');
        return Response.json({success:true,result:[{
          queue_id:'queue-fixture',
          queue_name:staging?'oxytype-staging-tasks':'oxytype-production-tasks',
          consumers:[{consumer_id:'consumer-fixture',type:'worker',script:staging?'oxytype-api-staging':'oxytype'}]
        }]});
      };`,
    );
    try {
      return spawnSync("vpx", ["--import", fixture, script, environment], {
        cwd: directory,
        env: {
          ...process.env,
          CLOUDFLARE_API_TOKEN: token,
          FIXTURE_DENIED: String(denied),
        },
        encoding: "utf8",
        timeout: 30_000,
      });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }

  it.each(["production", "staging"])(
    "uses the %s account/Worker config from outside the workspace",
    (environment) => {
      const outcome = run(environment);
      expect(outcome.status, outcome.stderr).toBe(0);
      expect(outcome.stdout).toContain(
        `/accounts/eb2679ce4f23ae7db4e6c4e3fcf8c3c1/queues?name=oxytype-${environment}-tasks`,
      );
      expect(outcome.stdout).toContain(
        '/queues/queue-fixture/consumers/consumer-fixture","method":"DELETE"',
      );
      expect(outcome.stdout).toContain(
        `Retired 1 ${environment} task consumer(s)`,
      );
    },
  );

  it.each(["", "preview"])(
    "rejects unsupported targets (%s)",
    (environment) => {
      const outcome = run(environment);
      expect(outcome.status).toBe(1);
      expect(outcome.stdout).toBe("");
    },
  );

  it("rejects missing credentials without an API request", () => {
    const outcome = run("production", "");
    expect(outcome.status).toBe(1);
    expect(outcome.stdout).toBe("");
    expect(outcome.stderr).toContain("CLOUDFLARE_API_TOKEN is required");
  });

  it("returns a failing exit status when Cloudflare denies cleanup", () => {
    const outcome = run("production", "cli-token-fixture", true);
    expect(outcome.status).toBe(1);
    expect(outcome.stdout).not.toContain('"method":"DELETE"');
    expect(outcome.stderr).toContain("GET failed (HTTP 403)");
  });
});
