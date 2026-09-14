import { buildForecast, runCalibration } from "./run.server.ts";

const cmd = process.argv[2] ?? "forecast";

async function main() {
  if (cmd === "calibrate") {
    const result = await runCalibration();
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  const bundle = await buildForecast({ forceRefresh: true });
  console.log(JSON.stringify(bundle.api, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
