#!/usr/bin/env python3
"""
Repo Auditor Agent — scans all REZ repos for uncommitted changes,
creates branches, commits, pushes, and opens PRs for review.
"""

import json
import os
import re
import subprocess
import sys
import urllib.request
import urllib.error
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional

# Files to skip — these are noise, not real changes
NOISE_PATTERNS = [
    ".claude-flow/",
    "node_modules/",
    ".git/",
    "dist/",
    "__pycache__/",
    ".next/",
    "coverage/",
    ".turbo/",
    "build/",
]


def is_noise(filepath: str) -> bool:
    """True if this is a noise file (session data, build output, etc.)."""
    for p in NOISE_PATTERNS:
        if p in filepath:
            return True
    return False


@dataclass
class Repo:
    path: Path
    name: str
    remote_url: str
    branch: str
    uncommitted_files: list[str] = field(default_factory=list)
    untracked_files: list[str] = field(default_factory=list)
    modified_files: list[str] = field(default_factory=list)
    ahead_commits: int = 0
    status: str = "clean"
    error: Optional[str] = None


def run(cmd: list[str], cwd: str | Path = ".") -> tuple[int, str, str]:
    try:
        r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=30)
        return r.returncode, r.stdout, r.stderr
    except subprocess.TimeoutExpired:
        return -1, "", "timeout"
    except Exception as e:
        return -1, "", str(e)


def get_remote(repo: Path) -> tuple[str, str]:
    """Get remote URL and name."""
    code, out, _ = run(["git", "remote", "get-url", "origin"], cwd=repo)
    url = out.strip() if code == 0 else ""
    name = url.split("/")[-1].replace(".git", "") if url else repo.name
    return url, name


def get_branch(repo: Path) -> str:
    code, out, _ = run(["git", "rev-parse", "--abbrev-ref", "HEAD"], cwd=repo)
    return out.strip() if code == 0 else "unknown"


def get_status(repo: Path) -> tuple[list[str], list[str], list[str]]:
    """Get modified, untracked, and staged files — noise filtered."""
    code, out, _ = run(["git", "diff", "--name-only"], cwd=repo)
    modified = [f for f in out.strip().split("\n") if f and not is_noise(f)]

    code, out, _ = run(["git", "ls-files", "--others", "--exclude-standard"], cwd=repo)
    untracked = [f for f in out.strip().split("\n") if f and not is_noise(f)]

    code, out, _ = run(["git", "diff", "--cached", "--name-only"], cwd=repo)
    staged = [f for f in out.strip().split("\n") if f and not is_noise(f)]

    return modified, untracked, staged


def get_ahead(repo: Path) -> int:
    code, out, _ = run(
        ["git", "rev-list", "--count", "@{upstream}..HEAD"],
        cwd=repo
    )
    if code == 0:
        try:
            return int(out.strip())
        except ValueError:
            pass
    return 0


def analyze_repo(repo_path: Path) -> Repo:
    """Full analysis of a single repo."""
    remote_url, name = get_remote(repo_path)
    branch = get_branch(repo_path)

    try:
        modified, untracked, staged = get_status(repo_path)
        ahead = get_ahead(repo_path)
    except Exception as e:
        return Repo(path=repo_path, name=name, remote_url=remote_url, branch=branch, error=str(e))

    all_changes = modified + untracked + staged
    status = "dirty" if all_changes else "clean"

    repo = Repo(
        path=repo_path,
        name=name,
        remote_url=remote_url,
        branch=branch,
        uncommitted_files=all_changes,
        untracked_files=untracked,
        modified_files=modified,
        ahead_commits=ahead,
        status=status,
    )
    return repo


def scan_repos(base_path: Path) -> list[Repo]:
    """Scan all git repos under base path."""
    repos = []
    for item in sorted(base_path.iterdir()):
        if item.is_dir() and (item / ".git").exists():
            # Skip hidden dirs and non-repos
            if item.name.startswith(".") or item.name.startswith("__"):
                continue
            repo = analyze_repo(item)
            repos.append(repo)
    return repos


def get_changed_files_summary(repo: Repo) -> str:
    """Get a human-readable summary of changed files."""
    parts = []
    if repo.modified_files:
        parts.append(f"Modified: {len(repo.modified_files)}")
    if repo.untracked_files:
        parts.append(f"Untracked: {len(repo.untracked_files)}")
    return ", ".join(parts) if parts else "No changes"


def create_branch_and_commit(repo: Repo, branch_name: str, message: str) -> bool:
    """Create branch, stage all changes, commit and push."""
    try:
        # Create branch (use -B to handle re-runs where branch already exists)
        code, _, err = run(["git", "checkout", "-b", branch_name], cwd=repo.path)
        if code != 0:
            # Branch already exists from a prior run — switch to it and re-stage
            code2, _, err2 = run(["git", "checkout", branch_name], cwd=repo.path)
            if code2 != 0:
                print(f"  Failed to create/switch branch: {err2}")
                return False
            print(f"  Re-using existing branch: {branch_name}")

        # Stage all changes
        run(["git", "add", "-A"], cwd=repo.path)

        # Check what was staged, then selectively un-stage only noise files
        code, staged_out, _ = run(["git", "diff", "--cached", "--name-only"], cwd=repo.path)
        noise_staged = [f for f in staged_out.strip().split("\n") if f and is_noise(f)]
        if noise_staged:
            # Only reset the noise files, not the real changes
            reset_cmd = ["git", "reset", "HEAD", "--quiet", "--"] + noise_staged
            run(reset_cmd, cwd=repo.path)

        # Check if anything is staged
        code, out, _ = run(["git", "diff", "--cached", "--name-only"], cwd=repo.path)
        if not out.strip():
            print("  Nothing to commit")
            return False

        # Commit
        code, _, err = run(
            ["git", "commit", "-m", message, "-m", "Co-Authored-By: Repo Auditor <repo-auditor@rez.money>"],
            cwd=repo.path
        )
        if code != 0:
            print(f"  Failed to commit: {err}")
            return False

        # Push
        code, _, err = run(
            ["git", "push", "-u", "origin", branch_name],
            cwd=repo.path
        )
        if code != 0:
            print(f"  Failed to push: {err}")
            return False

        return True
    except Exception as e:
        print(f"  Exception: {e}")
        return False


def create_pr(repo: Repo, branch_name: str, title: str, body: str) -> Optional[str]:
    """Create GitHub PR using gh CLI."""
    # Save body to temp file
    body_path = Path("/tmp/pr-body-auditor.md")
    body_path.write_text(body)

    code, out, err = run([
        "gh", "pr", "create",
        "--base", "main",
        "--head", branch_name,
        "--title", title,
        "--body-file", str(body_path),
    ], cwd=repo.path)

    if code == 0:
        # Extract PR URL
        match = re.search(r"https://github\.com/[\w-]+/[\w-]+/pull/\d+", out)
        return match.group(0) if match else out.strip()
    else:
        print(f"  PR creation failed: {err}")
        return None


def auto_merge_pr(repo: Repo) -> bool:
    """Auto-merge the PR after creation."""
    code, out, _ = run([
        "gh", "pr", "merge",
        "--admin", "--squash",
    ], cwd=repo.path)
    return code == 0


def gh_get_open_prs(repo: Repo) -> list[dict]:
    """Get list of open PRs for the branch."""
    code, out, _ = run([
        "gh", "pr", "list",
        "--state", "open",
        "--json", "number,title,headRefName,url",
    ], cwd=repo.path)
    if code == 0:
        try:
            return json.loads(out)
        except json.JSONDecodeError:
            return []
    return []


def generate_commit_message(repo: Repo) -> str:
    """Generate a good commit message from changed files."""
    files = repo.modified_files + repo.untracked_files
    if not files:
        return f"chore({repo.name}): sync local changes"

    # Categorize by prefix
    categories: dict[str, list[str]] = {}
    for f in files[:20]:  # Limit to 20 for message
        parts = Path(f).parts
        prefix = parts[0] if parts else "misc"
        categories.setdefault(prefix, []).append(f)

    parts = []
    for cat, files in sorted(categories.items()):
        if len(files) == 1:
            parts.append(f"{cat}: {files[0]}")
        else:
            parts.append(f"{cat}: {len(files)} files")

    summary = "; ".join(parts[:5])
    if len(files) > 20:
        summary += f" (+{len(files) - 20} more)"

    return f"chore({repo.name}): {summary}"


def main():
    base = Path(os.environ.get("SCAN_PATH", "/Users/rejaulkarim/Documents/ReZ Full App"))
    dry_run = "--dry-run" in sys.argv
    skip_clean = "--skip-clean" in sys.argv

    print(f"=== Repo Auditor ===")
    print(f"Scan path: {base}")
    print(f"Mode: {'DRY RUN' if dry_run else 'LIVE'}")
    print()

    repos = scan_repos(base)

    # Filter
    dirty = [r for r in repos if r.status == "dirty"]
    ahead = [r for r in repos if r.ahead_commits > 0]
    all_dirty = dirty + ahead

    print(f"Repos scanned: {len(repos)}")
    print(f"Clean: {len([r for r in repos if r.status == 'clean' and r.ahead_commits == 0])}")
    print(f"With uncommitted changes: {len(dirty)}")
    print(f"Ahead of remote: {len(ahead)}")
    print()

    if not all_dirty:
        print("All repos are clean and in sync. Nothing to do.")
        sys.exit(0)

    # Show details
    for repo in all_dirty:
        print(f"\n📁 {repo.name}")
        print(f"   Path: {repo.path}")
        print(f"   Branch: {repo.branch}")
        if repo.uncommitted_files:
            print(f"   Uncommitted ({len(repo.uncommitted_files)}):")
            for f in repo.uncommitted_files[:10]:
                print(f"     - {f}")
            if len(repo.uncommitted_files) > 10:
                print(f"     ... and {len(repo.uncommitted_files) - 10} more")
        if repo.ahead_commits > 0:
            print(f"   Ahead: {repo.ahead_commits} commits")

    print(f"\n{'='*60}")

    if dry_run:
        print(f"\nDRY RUN — no changes made. {len(all_dirty)} repos need attention.")
        sys.exit(0)

    # Process each dirty repo
    results: list[dict] = []
    for repo in all_dirty:
        print(f"\n{'='*60}")
        print(f"Processing: {repo.name}")

        all_changes = repo.modified_files + repo.untracked_files
        if not all_changes and repo.ahead_commits > 0:
            # Already have commits, just push
            print(f"  Pushing {repo.ahead_commits} commits to remote...")
            code, _, err = run(["git", "push"], cwd=repo.path)
            if code == 0:
                print(f"  ✓ Pushed successfully")
                results.append({"repo": repo.name, "action": "pushed", "status": "success"})
            else:
                print(f"  ✗ Push failed: {err}")
                results.append({"repo": repo.name, "action": "push", "status": "failed", "error": err})
            continue

        # Generate branch name and message
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        sanitized_name = re.sub(r"[^a-z0-9-]", "-", repo.name.lower())
        branch_name = f"audit/{sanitized_name}-{timestamp}"

        commit_msg = generate_commit_message(repo)

        # Check for existing open PRs
        existing_prs = gh_get_open_prs(repo)
        existing_for_branch = [p for p in existing_prs if sanitized_name in p.get("headRefName", "")]
        if existing_for_branch:
            print(f"  Already has open PR: {existing_for_branch[0]['url']}")
            results.append({
                "repo": repo.name, "action": "pr_exists",
                "status": "skipped", "pr": existing_for_branch[0]['url']
            })
            continue

        # Create branch + commit
        print(f"  Branch: {branch_name}")
        print(f"  Commit: {commit_msg}")

        ok = create_branch_and_commit(repo, branch_name, commit_msg)
        if not ok:
            results.append({"repo": repo.name, "action": "commit", "status": "failed"})
            continue

        # Create PR
        pr_body = f"""## Repo Auditor Auto-PR 🤖

This PR was automatically created by the Repo Auditor agent.

### Changes
{chr(10).join(f"- `{f}`" for f in all_changes[:30])}
{"\n- ..." if len(all_changes) > 30 else ""}

### Files summary
{get_changed_files_summary(repo)}

> **Please review before merging.**

🤖 *Auto-generated by Repo Auditor*
"""
        pr_title = commit_msg[:80]
        pr_url = create_pr(repo, branch_name, pr_title, pr_body)

        if pr_url:
            print(f"  ✓ PR created: {pr_url}")
            results.append({"repo": repo.name, "action": "pr_created", "status": "success", "pr": pr_url})

            # Auto-merge
            print(f"  Auto-merging...")
            merged = auto_merge_pr(repo)
            if merged:
                print(f"  ✓ Auto-merged!")
                results.append({"repo": repo.name, "action": "merged", "status": "success"})
            else:
                print(f"  ⚠ Auto-merge skipped (PR needs review)")
        else:
            results.append({"repo": repo.name, "action": "pr_create", "status": "failed"})

    # Summary
    print(f"\n{'='*60}")
    print("=== SUMMARY ===")
    success = [r for r in results if r["status"] == "success"]
    failed = [r for r in results if r["status"] == "failed"]
    skipped = [r for r in results if r["status"] == "skipped"]

    for r in results:
        icon = "✓" if r["status"] == "success" else "⚠" if r["status"] == "skipped" else "✗"
        pr = f" → {r.get('pr', '')}" if r.get('pr') else ""
        print(f"  {icon} {r['repo']}: {r['action']}{pr}")

    print(f"\nTotal: {len(all_dirty)} repos")
    print(f"Success: {len(success)} | Failed: {len(failed)} | Skipped: {len(skipped)}")

    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
