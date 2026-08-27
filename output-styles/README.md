# Output styles

Custom, swappable system-prompt styles that change the agent's role, tone, and
default response format. Each is one Markdown file: YAML frontmatter for
metadata, then a body that becomes the personality / system-prompt slot.

These files are **portable across two harnesses** — the same source file links
into both:

| Harness | Destination | Selector |
| --- | --- | --- |
| Claude Code | `~/.claude/output-styles/<name>.md` | `/config` → Output style |
| pi ([`pi-output-styles`](https://pi.dev/packages/pi-output-styles)) | `~/.omp/agent/output-styles/<name>.md` | `/style <name>` |

`install.sh` symlinks every `output-styles/*.md` here (except this README) into
both locations, named by the frontmatter `name:` (falling back to the filename).

## Frontmatter

| Field | Used by | Purpose |
| --- | --- | --- |
| `name` | both | Style name (defaults to filename). |
| `description` | both | Shown in the Claude `/config` picker and pi `/style` list. |
| `keep-coding-instructions` | Claude only | Keep Claude Code's built-in software-engineering instructions (`false` by default). Ignored by pi. |
| `force-for-plugin` | Claude plugins only | Auto-apply when the plugin is enabled. Ignored by pi. |

Unknown fields are ignored by the other harness, so a single file works for both.

## Add your own

1. Add `output-styles/<name>.md` with `name`/`description` frontmatter and a body.
2. Run `bash install.sh` from the repo root to link it into both harnesses.
3. Select it:
   - Claude Code: `/config` → **Output style** (takes effect after `/clear` or a
     new session).
   - pi: `/style <name>` (live, mid-session); `/style <name> --save` to make it
     your default. Requires a new session only after first installing the
     `pi-output-styles` extension.
