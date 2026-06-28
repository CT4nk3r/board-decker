#!/usr/bin/env bash
#
# Rename the GitHub release assets for a tag so each filename carries an OS tag
# (macos / windows / linux). This makes the assets sort and group by platform in
# the Releases tab, e.g. "Deck_windows_0.1.0_x64-setup.exe".
#
# Tauri's bundlers hardcode their output filenames, so we fix them up after the
# release is published. The OS is inferred from the file extension and a
# "Deck_<os>_" prefix is injected. The script is idempotent: assets that are
# already tagged are skipped, so it is safe to re-run.
#
# Required env: REPO (owner/name), TAG (e.g. v0.1.0), GH_TOKEN.
# Optional env: DRY_RUN=1 to print planned renames without calling the API.
set -euo pipefail

repo="${REPO:?REPO is required (owner/name)}"
tag="${TAG:?TAG is required (e.g. v0.1.0)}"
dry="${DRY_RUN:-0}"

os_for() {
  case "$1" in
    *.dmg | *.app.tar.gz) printf 'macos' ;;
    *.exe | *.msi) printf 'windows' ;;
    *.deb | *.rpm | *.AppImage) printf 'linux' ;;
    *) printf '' ;;
  esac
}

renamed=0
while IFS=$'\t' read -r id name; do
  [ -n "$name" ] || continue

  if [[ "$name" =~ ^Deck_(macos|windows|linux)_ ]]; then
    echo "skip (already tagged): $name"
    continue
  fi

  os="$(os_for "$name")"
  if [ -z "$os" ]; then
    echo "skip (unrecognized type): $name"
    continue
  fi

  # Replace the leading "Deck_" or "Deck-" with "Deck_<os>_".
  newname="${name/#Deck[-_]/Deck_${os}_}"
  if [ "$newname" = "$name" ]; then
    echo "skip (no change): $name"
    continue
  fi

  if [ "$dry" = "1" ]; then
    echo "DRY: $name -> $newname"
  else
    echo "rename: $name -> $newname"
    gh api --method PATCH "repos/$repo/releases/assets/$id" -f name="$newname" >/dev/null
  fi
  renamed=$((renamed + 1))
done < <(gh api "repos/$repo/releases/tags/$tag" --jq '.assets[] | "\(.id)\t\(.name)"')

if [ "$dry" = "1" ]; then
  echo "done ($renamed asset(s) would be renamed)"
else
  echo "done ($renamed asset(s) renamed)"
fi
