import { bootstrapDemoDataIfEmpty } from "../lib/bootstrap/demo-seed.service";

async function main() {
  const result = await bootstrapDemoDataIfEmpty("ORG-00001", { isDemoMode: true });
  console.log(JSON.stringify(result));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
