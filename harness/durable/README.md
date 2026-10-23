# Durable harness support

`install.sh` optionally installs the pinned public durable CLI when Pi is present
and Node.js is at least 22.19. Set `DURABLE_SKIP=1` to skip it.

| Repository path | Install destination | Purpose |
| --- | --- | --- |
| `harness/durable/vendor/nanstey-durable.txt` | `$DURABLE_HOME/vendor/github.com/nanstey/durable` (default `$HOME/.pi/durable/vendor/github.com/nanstey/durable`) | Exact public durable source pin consumed by `install.sh`. |
| `harness/durable/bump-pin.sh` | Not installed | Resolves a durable branch, tag, or SHA and rewrites the source pin for a skills-repo PR. |

Update flow: merge and verify durable first, run `harness/durable/bump-pin.sh <ref>`,
then open and merge this repository's pin-bump PR. The next `install.sh` updates the
local clone.
