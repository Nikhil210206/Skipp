const fs = require('fs');
let code = fs.readFileSync('frontend/src/lib/api.ts', 'utf8');

// Find the line: const detail: string | undefined = typeof parsed?.detail === "string" ? parsed.detail : undefined;
const old_detail = `const detail: string | undefined = typeof parsed?.detail === "string" ? parsed.detail : undefined;`;

// We want to handle both string and object.
const new_detail = `let detail: string | undefined = undefined;
  if (typeof parsed?.detail === "string") {
    detail = parsed.detail;
  } else if (parsed?.detail && typeof parsed.detail.message === "string") {
    detail = parsed.detail.message;
  }`;

code = code.replace(old_detail, new_detail);
fs.writeFileSync('frontend/src/lib/api.ts', code);
