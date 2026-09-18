// Reads branch/tag/commit info from the repo's .git metadata, which
// docker-compose bind-mounts read-only into this container (see
// docker-compose.yml) - the Docker build context is just backend/, so the
// image itself never contains .git. Computed once at startup rather than
// per-request, since none of this can change while the container is
// running; falls back to nulls (rather than crashing the server) if the
// mount isn't present, e.g. running the image some other way.
import { execFileSync } from 'child_process';

const GIT_DIR = '/app/.git';

function run(args) {
  try {
    return execFileSync('git', ['--git-dir', GIT_DIR, ...args], { encoding: 'utf8' }).trim() || null;
  } catch {
    return null;
  }
}

export const gitVersion = {
  branch: run(['rev-parse', '--abbrev-ref', 'HEAD']),
  // Only set if HEAD is exactly at a tag - most commits aren't tagged.
  tag: run(['describe', '--tags', '--exact-match', 'HEAD']),
  commit: run(['rev-parse', '--short', 'HEAD']),
};
