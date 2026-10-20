#!/usr/bin/env bash
# Definitions only; initialized and called by main.sh.

# Config files are copied (not symlinked) because the harness may rewrite them
# locally (e.g. pi updates lastChangelogVersion). Copies the top-level files of
# src_dir into dest_dir, skipping dotfiles and subdirs. Reports ok|copy|update.
copy_one() {
  local dest="$1" src="$2"
  if [ -e "$dest" ] && cmp -s "$dest" "$src"; then echo ok
  elif [ -e "$dest" ]; then cp "$src" "$dest"; echo update
  else cp "$src" "$dest"; echo copy; fi
  # Keep the source's executable bit (cp leaves an existing dest's mode alone).
  if [ -x "$src" ]; then chmod +x "$dest"; fi
}

install_config() {
  local dest_dir="$1" src_dir="$2"
  if [ ! -d "$src_dir" ]; then echo "  [config] no source $src_dir, skipping"; return; fi
  mkdir -p "$dest_dir"
  local ok=0 copied=0 updated=0
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    case "$(copy_one "$dest_dir/$(basename "$f")" "$f")" in
      ok)     ok=$((ok+1)) ;;
      copy)   copied=$((copied+1)) ;;
      update) updated=$((updated+1)) ;;
    esac
  done < <(find "$src_dir" -maxdepth 1 -type f -not -name '.*' -not -name README.md)
  local summary="$ok ok"
  [ "$copied" -gt 0 ] && summary="$summary, $copied copied"
  [ "$updated" -gt 0 ] && summary="$summary, $updated updated"
  echo "  [config] -> $dest_dir ($summary)"
}
