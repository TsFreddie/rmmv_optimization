# Untendo Engine Optimization Plugins

This is a collection of plugins (both original and derivative) to optimize the performance of Untendo games (Polidog Patrol and Benki Wars). This repository is not affiliated with Untendo in any way.

## LICENSE NOTICE

The following files are derivative works of Triacontane:

- DTextPicture.js
- KMS_Minimap.js

Their respective licenses are included in the file headers.
Derivative works are marked with `// HACK: ` header at the bottom of each file. Derivative works are licensed the same as the original under this repository's license.

The following file is a protocol compatible rewrite and is licensed under this repository's license:

- PictureZIndex.js

The following files are original works and are licensed under this repository's license:

- BruteForceOptimization.js
- BruteForceOptimizationPolidog.js
- BruteForceOptimizationBenki.js
- DecryptionWorker.js

## Installation

Before installing, make sure you have a original copy of either Polidog Patrol or Benki Wars. You can purchase them from [Untendo](https://www.untendo.com/).

1. (Recommended) Download a copy of the latest (NW.js)[https://nwjs.io/], and replace the original files and uses `nw.exe` to launch the game.
2. Download this repository, copy or replace the files in the repositories in the `www/js/plugins` directory.
3. Open `www/js/plugins.js` and add the following lines before the last line:

For Polidog Patrol:

```
{"name":"BruteForceOptimization","status":true,"description":"","parameters":{}},
{"name":"BruteForceOptimizationPolidog","status":true,"description":"","parameters":{}},
```

For Benki Wars:

```
{"name":"BruteForceOptimization","status":true,"description":"","parameters":{}},
{"name":"BruteForceOptimizationBenki","status":true,"description":"","parameters":{}},
```
