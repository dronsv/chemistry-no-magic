import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Recursively collect all file paths under a directory, sorted for deterministic hashing.
 */
async function collectFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files.sort();
}

/**
 * Compute a SHA-256 content hash (12-char hex prefix) from all files in data-src/.
 * @param {string} dataSrcDir - Path to data-src directory
 * @returns {Promise<string>} 12-character hex hash
 */
export async function computeBundleHash(dataSrcDir) {
  const files = await collectFiles(dataSrcDir);
  const hash = createHash('sha256');

  for (const filePath of files) {
    const content = await readFile(filePath);
    hash.update(filePath.slice(dataSrcDir.length));
    hash.update(content);
  }

  return hash.digest('hex').slice(0, 12);
}
