import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes, createHmac } from "node:crypto";
const envPath = ".local/stack.env";
mkdirSync(".local", { recursive: true, mode: 0o700 });
if (!existsSync(envPath)) {
  const jwt = randomBytes(32).toString("base64url");
  const token = (role) => {
    const encode = (v) => Buffer.from(JSON.stringify(v)).toString("base64url");
    const payload = encode({
      role,
      iss: "supabase",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 315360000,
    });
    const message = `${encode({ alg: "HS256", typ: "JWT" })}.${payload}`;
    return `${message}.${createHmac("sha256", jwt).update(message).digest("base64url")}`;
  };
  writeFileSync(
    envPath,
    `LOCAL_UID=${process.getuid?.() ?? 1000}\nLOCAL_GID=${process.getgid?.() ?? 1000}\nPOSTGRES_PASSWORD=${randomBytes(24).toString("base64url")}\nJWT_SECRET=${jwt}\nANON_KEY=${token("anon")}\nSERVICE_ROLE_KEY=${token("service_role")}\nSEED_PASSWORD=${randomBytes(24).toString("base64url")}\n`,
    { mode: 0o600, flag: "wx" },
  );
}
const values = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .trim()
    .split("\n")
    .map((line) => {
      const split = line.indexOf("=");
      return [line.slice(0, split), line.slice(split + 1)];
    }),
);
if (existsSync(".env.local")) {
  const existing = readFileSync(".env.local", "utf8");
  if (
    !existing.includes("NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321\n") ||
    !existing.includes(`NEXT_PUBLIC_SUPABASE_ANON_KEY=${values.ANON_KEY}\n`)
  )
    throw new Error(
      "Existing .env.local differs from this test stack; leaving it unchanged.",
    );
} else
  writeFileSync(
    ".env.local",
    `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321\nNEXT_PUBLIC_SUPABASE_ANON_KEY=${values.ANON_KEY}\nSUPABASE_SERVICE_ROLE_KEY=${values.SERVICE_ROLE_KEY}\nGAMI_SEED_PASSWORD=${values.SEED_PASSWORD}\nGAMI_ALLOW_DEMO_SEED=yes\n`,
    { mode: 0o600, flag: "wx" },
  );
const gateway = `_format_version: '2.1'
consumers:
  - username: anon
    keyauth_credentials:
      - key: ${values.ANON_KEY}
  - username: service_role
    keyauth_credentials:
      - key: ${values.SERVICE_ROLE_KEY}
services:
  - name: auth
    url: http://auth:9999
    routes:
      - name: auth
        paths: ['/auth/v1']
        strip_path: true
    plugins:
      - name: key-auth
        config:
          hide_credentials: true
      - name: cors
  - name: rest
    url: http://rest:3000
    routes:
      - name: rest
        paths: ['/rest/v1']
        strip_path: true
    plugins:
      - name: key-auth
        config:
          hide_credentials: true
      - name: cors
  - name: storage
    url: http://storage:5000
    routes:
      - name: storage
        paths: ['/storage/v1']
        strip_path: true
    plugins:
      - name: cors
`;
writeFileSync(".local/kong.yml", gateway, { mode: 0o600 });
console.info("Local test stack configured. Secrets remain in ignored files.");
