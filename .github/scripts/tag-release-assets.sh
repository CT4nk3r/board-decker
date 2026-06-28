#!/usr/bin/env bash
#
# Rename the GitHub release assets for a tag so each filename carries an OS tag
# (macos / windows / linux), e.g. "BoardDecker_windows_0.1.0_x64-setup.exe". This makes
# the assets sort and group by platform in the Releases tab.
#
# Tauri's bundlers hardcode their output filenames, so we fix them up after the
# release is published. The OS is inferred from the file extension and a
# "BoardDecker_<os>_" prefix is injected. The ".sig" siblings are renamed to match.
#
# Because the in-app updater's "latest.json" points at some of these same files
# (the .app.tar.gz, .AppImage and NSIS -setup.exe), this also rewrites the URLs
# inside latest.json so updates keep resolving after the rename. The signature
# itself is embedded in latest.json (not fetched by URL), so renaming the binary
# does not invalidate it — only the URL needs to track the new name.
#
# Idempotent: assets already tagged are skipped, so it is safe to re-run.
#
# Required env: REPO (owner/name), TAG (e.g. v0.1.0), GH_TOKEN.
# Optional env: DRY_RUN=1 to print planned changes without calling the API.
#               SELFTEST=1 to run the pure string-transform tests and exit.
set -euo pipefail

# --- pure helpers (unit-tested via SELFTEST) --------------------------------

# Echo macos|windows|linux for a bundle filename, or "" if unrecognized.
# A trailing ".sig" is ignored so signatures map to the same OS as their bundle.
os_for() {
  local n="${1%.sig}"
  case "$n" in
    *.dmg | *.app.tar.gz) printf 'macos' ;;
    *.exe | *.msi) printf 'windows' ;;
    *.deb | *.rpm | *.AppImage) printf 'linux' ;;
    *) printf '' ;;
  esac
}

# Echo the OS-tagged filename for an asset, or the input unchanged when it is
# already tagged or not a recognized bundle (e.g. latest.json).
newname_for() {
  local name="$1" os
  case "$name" in
    BoardDecker_macos_* | BoardDecker_windows_* | BoardDecker_linux_*) printf '%s' "$name"; return ;;
  esac
  os="$(os_for "$name")"
  if [ -z "$os" ]; then printf '%s' "$name"; return; fi
  printf '%s' "${name/#BoardDecker[-_]/BoardDecker_${os}_}"
}

# Echo a download URL with its final path segment transformed by newname_for.
rewrite_url() {
  local url="$1" base new
  base="${url##*/}"
  new="$(newname_for "$base")"
  if [ "$new" = "$base" ]; then printf '%s' "$url"; else printf '%s/%s' "${url%/*}" "$new"; fi
}

# --- self-test --------------------------------------------------------------

if [ "${SELFTEST:-0}" = "1" ]; then
  fail=0
  check() { # expected actual label
    if [ "$1" = "$2" ]; then echo "ok   $3"; else echo "FAIL $3: want '$1' got '$2'"; fail=1; fi
  }
  check "BoardDecker_linux_0.1.0-1.x86_64.rpm"      "$(newname_for BoardDecker-0.1.0-1.x86_64.rpm)"     "rpm"
  check "BoardDecker_linux_0.1.0_aarch64.AppImage"  "$(newname_for BoardDecker_0.1.0_aarch64.AppImage)" "appimage"
  check "BoardDecker_linux_0.1.0_amd64.deb"         "$(newname_for BoardDecker_0.1.0_amd64.deb)"        "deb"
  check "BoardDecker_macos_0.1.0_universal.dmg"     "$(newname_for BoardDecker_0.1.0_universal.dmg)"    "dmg"
  check "BoardDecker_macos_universal.app.tar.gz"    "$(newname_for BoardDecker_universal.app.tar.gz)"   "app.tar.gz"
  check "BoardDecker_macos_universal.app.tar.gz.sig" "$(newname_for BoardDecker_universal.app.tar.gz.sig)" "sig"
  check "BoardDecker_windows_0.1.0_x64-setup.exe"   "$(newname_for BoardDecker_0.1.0_x64-setup.exe)"    "nsis"
  check "BoardDecker_windows_0.1.0_x64_en-US.msi"   "$(newname_for BoardDecker_0.1.0_x64_en-US.msi)"    "msi"
  check "latest.json"                        "$(newname_for latest.json)"                 "latest.json untouched"
  check "BoardDecker_linux_0.1.0_amd64.deb"         "$(newname_for BoardDecker_linux_0.1.0_amd64.deb)"  "idempotent"
  check "https://x/y/v0.1.0/BoardDecker_linux_0.1.0_aarch64.AppImage" \
        "$(rewrite_url https://x/y/v0.1.0/BoardDecker_0.1.0_aarch64.AppImage)" "url rewrite"
  check "https://x/y/v0.1.0/BoardDecker_macos_universal.app.tar.gz" \
        "$(rewrite_url https://x/y/v0.1.0/BoardDecker_universal.app.tar.gz)" "url rewrite mac"
  exit "$fail"
fi

# --- live run ---------------------------------------------------------------

repo="${REPO:?REPO is required (owner/name)}"
tag="${TAG:?TAG is required (e.g. v0.1.0)}"
dry="${DRY_RUN:-0}"

# 1) Rename the assets (installers, updater bundles and their .sig siblings).
renamed=0
while IFS=$'\t' read -r id name; do
  [ -n "$name" ] || continue
  newname="$(newname_for "$name")"
  if [ "$newname" = "$name" ]; then
    echo "skip: $name"
    continue
  fi
  if [ "$dry" = "1" ]; then
    echo "DRY rename: $name -> $newname"
  else
    echo "rename: $name -> $newname"
    gh api --method PATCH "repos/$repo/releases/assets/$id" -f name="$newname" >/dev/null
  fi
  renamed=$((renamed + 1))
done < <(gh api "repos/$repo/releases/tags/$tag" --jq '.assets[] | "\(.id)\t\(.name)"')

# 2) Rewrite latest.json URLs to match the renamed updater bundles.
lid="$(gh api "repos/$repo/releases/tags/$tag" --jq '.assets[] | select(.name=="latest.json") | .id')"
if [ -z "$lid" ]; then
  echo "no latest.json on release (updater not enabled?) — skipping URL rewrite"
else
  work="$(mktemp -d)"
  trap 'rm -rf "$work"' EXIT
  gh release download "$tag" --repo "$repo" --pattern latest.json --dir "$work" --clobber
  changed=0
  while IFS= read -r key; do
    url="$(jq -r --arg k "$key" '.platforms[$k].url' "$work/latest.json")"
    new="$(rewrite_url "$url")"
    if [ "$new" != "$url" ]; then
      echo "latest.json[$key]: $url -> $new"
      jq --arg k "$key" --arg u "$new" '.platforms[$k].url = $u' "$work/latest.json" >"$work/next" \
        && mv "$work/next" "$work/latest.json"
      changed=$((changed + 1))
    fi
  done < <(jq -r '.platforms | keys[]' "$work/latest.json")

  if [ "$changed" -gt 0 ] && [ "$dry" != "1" ]; then
    gh release upload "$tag" "$work/latest.json" --repo "$repo" --clobber
    echo "latest.json updated ($changed url(s))"
  else
    echo "latest.json: $changed url(s) ${dry:+would be }changed"
  fi
fi

if [ "$dry" = "1" ]; then
  echo "done ($renamed asset(s) would be renamed)"
else
  echo "done ($renamed asset(s) renamed)"
fi
