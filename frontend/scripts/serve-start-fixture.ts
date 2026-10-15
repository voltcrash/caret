import { createWorkerd } from "../__tests__/start/workerd";

async function main(): Promise<void> {
  const mf = await createWorkerd(false, 4185);
  console.log(`Start fixture ready: ${await mf.ready}`);
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      void mf.dispose().finally(() => process.exit(0));
    });
  }
}

void main();
