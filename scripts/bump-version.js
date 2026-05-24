#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');

function parseVersion(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-([a-z]+)\.(\d+))?$/);
  if (!match) {
    throw new Error(`Invalid version format: ${version}`);
  }

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4] || null,
    prereleaseVersion: match[5] ? parseInt(match[5], 10) : null
  };
}

function bumpVersion(version, releaseType, prereleaseTag) {
  const parsed = parseVersion(version);

  // If requesting a prerelease, always bump the base version
  // according to releaseType before appending the prerelease tag.
  //
  // This prevents silently ignoring releaseType when the current
  // version already uses the same prerelease tag.
  //
  // Example:
  //   1.2.3-beta.1 + major beta => 2.0.0-beta.1
  //
  // Instead of incorrectly producing:
  //   1.2.3-beta.2
  if (prereleaseTag) {
    let major = parsed.major;
    let minor = parsed.minor;
    let patch = parsed.patch;

    switch (releaseType) {
      case 'major':
        major++;
        minor = 0;
        patch = 0;
        break;
      case 'minor':
        minor++;
        patch = 0;
        break;
      case 'patch':
        patch++;
        break;
      default:
        throw new Error(`Invalid release type: ${releaseType}`);
    }

    // Start at .1 — if this version already exists on npm,
    // findNextAvailablePrereleaseVersion will auto-increment from here
    return `${major}.${minor}.${patch}-${prereleaseTag}.1`;
  }

  // If it's a stable release request and currently on a prerelease:
  // - patch => promote prerelease to stable without bumping (1.2.3-beta.1 => 1.2.3)
  // - minor => bump minor regardless of prerelease (1.2.3-beta.1 => 1.3.0)
  // - major => bump major regardless of prerelease (1.2.3-beta.1 => 2.0.0)
  if (parsed.prerelease) {
    switch (releaseType) {
      case 'patch':
        return `${parsed.major}.${parsed.minor}.${parsed.patch}`;
      case 'minor':
        return `${parsed.major}.${parsed.minor + 1}.0`;
      case 'major':
        return `${parsed.major + 1}.0.0`;
      default:
        throw new Error(`Invalid release type: ${releaseType}`);
    }
  }

  // Otherwise bump normally
  switch (releaseType) {
    case 'major':
      return `${parsed.major + 1}.0.0`;
    case 'minor':
      return `${parsed.major}.${parsed.minor + 1}.0`;
    case 'patch':
      return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
    default:
      throw new Error(`Invalid release type: ${releaseType}`);
  }
}

/**
 * Check if a version exists on npm registry
 * @param {string} packageName - npm package name
 * @param {string} version - version to check
 * @returns {Promise<boolean>} - true if version exists, false otherwise
 */
function checkVersionExists(packageName, version) {
  return new Promise((resolve) => {
    const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}/${encodeURIComponent(version)}`;

    const req = https.get(url, (res) => {
      // Consume response body to prevent hanging
      res.resume();

      // Determine the result based on status code
      let result;
      if (res.statusCode === 200) {
        result = true;
      } else if (res.statusCode === 404) {
        result = false;
      } else {
        console.warn(`Warning: Unable to verify version existence (status ${res.statusCode})`);
        result = false;
      }

      // Wait for response to finish, then close request and resolve
      res.on('end', () => {
        req.destroy(); // Immediately close the connection
        resolve(result);
      });
    });

    // Set timeout to prevent hanging (30 seconds)
    req.setTimeout(30000, () => {
      req.destroy();
      console.warn('Warning: Request timeout after 30s');
      resolve(false);
    });

    req.on('error', (err) => {
      // Only log if this wasn't caused by our own destroy()
      if (err.code !== 'ECONNRESET' || !req.destroyed) {
        console.warn(`Warning: Network error checking version: ${err.message}`);
      }
      resolve(false);
    });
  });
}

/**
 * Find next available prerelease version
 * @param {string} packageName - npm package name
 * @param {object} parsed - parsed version object
 * @param {string} prereleaseTag - prerelease tag (beta, alpha, rc)
 * @returns {Promise<string>} - next available version
 */
async function findNextAvailablePrereleaseVersion(packageName, parsed, prereleaseTag) {
  const maxAttempts = 10;
  let prereleaseVersion = parsed.prereleaseVersion || 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidateVersion = `${parsed.major}.${parsed.minor}.${parsed.patch}-${prereleaseTag}.${prereleaseVersion}`;

    console.log(`Checking if version ${candidateVersion} exists on npm...`);
    const exists = await checkVersionExists(packageName, candidateVersion);

    if (!exists) {
      if (attempt > 0) {
        console.log(`✓ Found available version after ${attempt + 1} attempts: ${candidateVersion}`);
      }
      return candidateVersion;
    }

    console.log(`✗ Version ${candidateVersion} already exists, trying next...`);
    prereleaseVersion++;
  }

  throw new Error(`Unable to find available prerelease version after ${maxAttempts} attempts`);
}

async function main() {
  const [, , packageName, releaseType, prereleaseTag = ''] = process.argv;

  if (!packageName || !releaseType) {
    console.error('Usage: node bump-version.js <package> <release-type> [prerelease-tag]');
    process.exit(1);
  }

  const allowedPackages = ['cli', 'js'];
  const allowedReleaseTypes = ['patch', 'minor', 'major'];
  const allowedPrereleaseTags = ['beta', 'alpha', 'rc', ''];

  if (!allowedPackages.includes(packageName)) {
    console.error(`Invalid package: ${packageName}. Must be one of: ${allowedPackages.join(', ')}`);
    process.exit(1);
  }

  if (!allowedReleaseTypes.includes(releaseType)) {
    console.error(`Invalid release type: ${releaseType}. Must be one of: ${allowedReleaseTypes.join(', ')}`);
    process.exit(1);
  }

  if (!allowedPrereleaseTags.includes(prereleaseTag)) {
    console.error(`Invalid prerelease tag: ${prereleaseTag}. Must be one of: ${allowedPrereleaseTags.join(', ')}`);
    process.exit(1);
  }

  const packageJsonPath = path.join(process.cwd(), packageName, 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    console.error(`package.json not found at: ${packageJsonPath}`);
    process.exit(1);
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const oldVersion = packageJson.version;
  const npmPackageName = packageJson.name;

  let newVersion = bumpVersion(oldVersion, releaseType, prereleaseTag);

  // Check for version conflicts and auto-increment if needed
  console.log(`Checking if version ${newVersion} exists on npm...`);
  const versionExists = await checkVersionExists(npmPackageName, newVersion);

  if (versionExists) {
    console.log(`⚠️  Version ${newVersion} already exists on npm`);

    if (prereleaseTag) {
      // Auto-increment prerelease version
      console.log('Auto-incrementing prerelease version...');
      const parsed = parseVersion(newVersion);
      newVersion = await findNextAvailablePrereleaseVersion(npmPackageName, parsed, prereleaseTag);
      console.log(`✓ Using version: ${newVersion}`);
    } else {
      // Cannot auto-increment stable releases
      console.error('❌ Error: Version conflict detected.');
      console.error(`   Version ${newVersion} already exists on npm for ${npmPackageName}.`);
      console.error('');
      console.error('   This can happen when:');
      console.error('   - A release was made from another branch with the same version');
      console.error('   - The local package.json version is out of sync with npm');
      console.error('');
      console.error('   Possible solutions:');
      console.error('   1. Use a higher release type (e.g., minor instead of patch)');
      console.error('   2. Use a prerelease tag (e.g., !release cli patch beta)');
      console.error('   3. Manually update the version in package.json before releasing');
      process.exit(1);
    }
  } else {
    console.log(`✓ Version ${newVersion} is available`);
  }

  packageJson.version = newVersion;

  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, '\t') + '\n', 'utf8');

  const releaseLabel = prereleaseTag ? `${releaseType} (${prereleaseTag})` : releaseType;
  console.log(`Bumped ${packageName} from ${oldVersion} to ${newVersion} [${releaseLabel}]`);

  // Output for GitHub Actions
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `version=${newVersion}\n`);
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
