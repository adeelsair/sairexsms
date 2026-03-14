const net = require("net");
const host = process.env.SMTP_HOST;
const port = Number(process.env.SMTP_PORT || 587);

if (!host || !port) {
  console.log("SMTP_PROBE_FAIL missing SMTP_HOST/SMTP_PORT");
  process.exit(1);
}

const s = net.createConnection({ host, port, timeout: 8000 }, () => {
  console.log(`SMTP_TCP_OK ${host}:${port}`);
  s.end();
  process.exit(0);
});

s.on("error", (e) => {
  console.log("SMTP_TCP_FAIL", e.message);
  process.exit(1);
});

s.on("timeout", () => {
  console.log("SMTP_TCP_TIMEOUT");
  s.destroy();
  process.exit(1);
});
