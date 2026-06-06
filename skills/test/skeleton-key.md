---
name: skeleton-key
description: Give an agent access to a website that has no API by building an MCP server or Playwright script to read or act on it. Use when you need data or actions from a site with no official API. Triggers - "no API", "scrape this site", "build an MCP for", "skeleton key".
---

# The Skeleton Key

No API? No problem. This builds a bridge so your agent can reach into any site.

## Steps

1. Clarify the need: read data, or take an action? Which site, which pages,
   which fields?
2. Choose the bridge:
   - **One-off / simple** → a Playwright script that logs in (if needed),
     navigates, and extracts the fields to JSON.
   - **Reusable / agent-callable** → a small MCP server exposing tools like
     `get_<thing>()` that wrap the Playwright calls.
3. Generate the script/server with real selectors, sensible waits, and error
   handling. Respect the site's terms and rate limits; never bypass auth you
     don't own.
4. Test on one page, show the extracted data, then wire it in.

Prefer an MCP when the agent needs the data repeatedly; a script for a
one-time pull.
