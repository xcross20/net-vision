# Visual QA

`tools/screenshot.mjs` captures every primary Net Vision route at the four
breakpoints called out in the design brief (390 / 768 / 1440 / 1920) and
writes them under `.qa/<viewport>/<route>.png`. Use it to diff the
production UI by hand before each release.

```bash
# local dev server
npm run dev --workspace=@net-vision/web &
BASE_URL=http://localhost:3000 node tools/screenshot.mjs

# live Railway deployment (waits for OpenSea cache to warm via the
# upstream curls; no extra orchestration required)
BASE_URL=https://web-production-38d29.up.railway.app node tools/screenshot.mjs
```

The script exits non-zero if any screenshot is suspiciously small
(< 5 KB), which usually means the page errored before any chrome
rendered.
