const fs = require("fs");
const path = require("path");

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(p));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(p);
    }
  }
  return out;
}

const files = walk(path.join(__dirname, "..", "app", "api"));
const replacements = [
  {
    re: /const\s+orgId\s*=\s*isSuperAdmin\(guard\)\s*\?\s*\(searchParams\.get\("orgId"\)\s*\?\?\s*guard\.organizationId\)\s*:\s*guard\.organizationId;/g,
    to: "const orgId = guard.organizationId;",
  },
  {
    re: /const\s+orgId\s*=\s*isSuperAdmin\(guard\)\s*\?\s*\(\(body\.orgId\s+as\s+string\)\s*\?\?\s*guard\.organizationId\)\s*:\s*guard\.organizationId;/g,
    to: "const orgId = guard.organizationId;",
  },
  {
    re: /const\s+orgId\s*=\s*isSuperAdmin\(guard\)\s*\?\s*\(new URL\(request\.url\)\.searchParams\.get\("orgId"\)\s*\?\?\s*guard\.organizationId\)\s*:\s*guard\.organizationId;/g,
    to: "const orgId = guard.organizationId;",
  },
  {
    re: /const\s+orgId\s*=\s*isSuperAdmin\(guard\)\s*\?\s*\(new URL\(_request\.url\)\.searchParams\.get\("orgId"\)\s*\?\?\s*guard\.organizationId\)\s*:\s*guard\.organizationId;/g,
    to: "const orgId = guard.organizationId;",
  },
  {
    re: /const\s+organizationId\s*=\s*isSuperAdmin\(guard\)\s*&&\s*requestedOrgId\s*\?\s*requestedOrgId\s*:\s*guard\.organizationId;/g,
    to: "const organizationId = guard.organizationId;",
  },
];

for (const file of files) {
  const original = fs.readFileSync(file, "utf8");
  let next = original;
  for (const { re, to } of replacements) {
    next = next.replace(re, to);
  }
  if (next !== original) {
    fs.writeFileSync(file, next, "utf8");
    console.log(file);
  }
}
