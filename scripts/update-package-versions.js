#!/usr/bin/env node

/**
 * This script updates the version numbers in all package.json files
 * based on the central version definitions in the root package.json.
 *
 * Usage: node scripts/update-package-versions.js
 */

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

// Read the root package.json
const rootPackageJsonPath = path.resolve(__dirname, '../package.json');
const rootPackageJson = JSON.parse(
  fs.readFileSync(rootPackageJsonPath, 'utf8'),
);

// Get the package versions from the root package.json
const packageVersions = rootPackageJson.packageVersions || {};
const dependencies = rootPackageJson.dependencies || {};

if (!packageVersions || Object.keys(packageVersions).length === 0) {
  console.error('No package versions defined in root package.json');
  process.exit(1);
}

console.log('Package versions from root package.json:');
console.table(packageVersions);

// Get all packages in the workspace
const packagesDir = path.resolve(__dirname, '../packages');
const packages = fs.readdirSync(packagesDir).filter((dir) => {
  const stats = fs.statSync(path.join(packagesDir, dir));
  return stats.isDirectory() && !dir.startsWith('.');
});

console.log(`Found ${packages.length} packages in workspace:`, packages);

// Update each package's package.json
let updatedCount = 0;
for (const pkg of packages) {
  const packageJsonPath = path.join(packagesDir, pkg, 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    console.warn(`No package.json found for ${pkg}, skipping...`);
    continue;
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const packageName = packageJson.name;

  // Update version if defined in root package.json
  if (packageVersions[packageName]) {
    const oldVersion = packageJson.version;
    const newVersion = packageVersions[packageName];

    if (oldVersion !== newVersion) {
      console.log(
        `Updating ${packageName} version from ${oldVersion} to ${newVersion}`,
      );
      packageJson.version = newVersion;
      updatedCount++;
    } else {
      console.log(
        `${packageName} version is already ${newVersion}, no update needed`,
      );
    }
  } else {
    console.warn(`No version defined for ${packageName} in root package.json`);
  }

  // Update dependencies from root package.json
  let depsUpdated = false;

  // Helper function to update dependencies
  const updateDependencies = (depsObject) => {
    if (!depsObject) return false;

    let updated = false;

    // First, manually check for specific packages that need to be updated
    const packagesToForceUpdate = [
      'misoai-android',
      'misoai-core',
      'misoai-shared',
      'misoai-web',
      'misoai-cli',
      'misoai-visualizer',
      'misoai-evaluation',
      'misoai-mcp',
    ];

    packagesToForceUpdate.forEach((pkg) => {
      if (depsObject[pkg] && packageVersions[pkg]) {
        if (depsObject[pkg] !== packageVersions[pkg]) {
          console.log(
            `  Updated ${pkg} from ${depsObject[pkg]} to ${packageVersions[pkg]}`,
          );
          depsObject[pkg] = packageVersions[pkg];
          updated = true;
        }
      }
    });

    // Update external dependencies from root
    Object.keys(dependencies).forEach((dep) => {
      if (
        depsObject[dep] &&
        depsObject[dep] !== dependencies[dep] &&
        !depsObject[dep].startsWith('workspace:') &&
        !packagesToForceUpdate.includes(dep)
      ) {
        console.log(
          `  Updated ${dep} from ${depsObject[dep]} to ${dependencies[dep]}`,
        );
        depsObject[dep] = dependencies[dep];
        updated = true;
      }
    });

    return updated;
  };

  // Update all dependency types
  depsUpdated = updateDependencies(packageJson.dependencies) || depsUpdated;
  depsUpdated = updateDependencies(packageJson.devDependencies) || depsUpdated;
  depsUpdated = updateDependencies(packageJson.peerDependencies) || depsUpdated;

  // Write the updated package.json
  if (depsUpdated) {
    updatedCount++;
  }

  if (depsUpdated || packageJson.version !== packageVersions[packageName]) {
    fs.writeFileSync(
      packageJsonPath,
      `${JSON.stringify(packageJson, null, 2)}\n`,
    );
    console.log(`Updated ${packageName} package.json`);
  }
}

console.log(`Updated ${updatedCount} package.json files`);

// Run pnpm install to update the lockfile
console.log('Running pnpm install to update lockfile...');
try {
  execSync('pnpm install', { stdio: 'inherit' });
  console.log('Successfully updated lockfile');
} catch (error) {
  console.error('Failed to update lockfile:', error.message);
  process.exit(1);
}

console.log('All package versions have been updated successfully!');
