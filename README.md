# Optimization Plugins for RPG Maker MV

**Other Languages:** [日本語](README_ja.md)

This is a collection of plugins (both original and derivative) designed to optimize the performance of Untendo games (Polidog Patrol and Benki Wars). This repository is not affiliated with Untendo in any way.

https://github.com/user-attachments/assets/3e4afcd1-4064-4af8-9e27-70129219b8c9

## LICENSE NOTICE

The following files are derivative works of Triacontane:

- DTextPicture.js
- KMS_Minimap.js

Their respective licenses are included in the file headers.
Derivative works are marked with a `// HACK: ` header at the bottom of each file. Derivative works are licensed the same as the original under this repository's license.

The following file is a protocol compatible rewrite and is licensed under this repository's license:

- PictureZIndex.js

The following files are original works and are licensed under this repository's license:

- BruteForceOptimization.js
- BruteForceOptimizationPolidog.js
- BruteForceOptimizationBenki.js

## Installation

Before installing, make sure you have an original copy of either Polidog Patrol or Benki Wars. You can purchase them from [Untendo](https://www.untendo.com/).

1. (Recommended) Download a copy of the latest [NW.js](https://nwjs.io/), replace the original files, and use `nw.exe` to launch the game.
2. Download this repository and copy all the files from this repository to the `www/js/plugins` directory. Overwrite any existing files if prompted.
3. Open `www/js/plugins.js` and add the following lines at the end of the file:

For Polidog Patrol:

```js
$plugins.push(
  { name: "BruteForceOptimization", status: true, description: "", parameters: {"fakeframes": "true"} },
  { name: "BruteForceOptimizationPolidog", status: true, description: "", parameters: {} }
);
```

For Benki Wars:

```js
$plugins.push(
  { name: "BruteForceOptimization", status: true, description: "", parameters: {"fakeframes": "true"} },
  { name: "BruteForceOptimizationBenki", status: true, description: "", parameters: {} }
);
```

## High Refresh Rate Monitor Support

This plugin adds high refresh rate monitor support by interpolating sprites (dubbed FAKEFRAMES™). The feature is enabled by default, but you can toggle this feature by pressing F6. Note that FAKEFRAMES™ is not frame interpolation or image generation. This feature interpolates sprites' positions, rotations, and scales and has zero visual artifacts; therefore, it is recommended to keep it enabled.

## Other RPG Maker MV Games

The `BruteForceOptimization.js` plugin is set up to be a generic RPG Maker MV plugin; however, I have not tested it on any other games. If you are interested in using it for your own game, I recommend reading the plugin source code to understand what it does.

## Optimization Write-Up

The following is a brief summary of the optimization techniques used in this repository:

- A rewrite of RPG Maker MV's interpreter:
  - Manually inlined hot paths
  - Pre-executed all `eval`-wrapped function calls to eliminate runtime interpretation and JIT overhead
  - Pre-computed all jump branching targets
  - Replaced most array access function calls with direct array access, bypassing bounds checks
- Cached audio files to reduce repeated decryption
- Offloaded decryption work to a web worker to reduce main thread stalls
- Cached tinted pictures to reduce repeated tinting
- Modified `DTextPicture.js`:
  - Cached bitmaps of the same size
  - Reduced excessive DOM element creation
- Modified `KMS_Minimap.js`:
  - Added double buffering to preserve already-rendered minimaps and blit unchanged areas
  - Used custom dirty flags to update only changed pixels
- Rewrote `PictureZIndex.js`:
  - Sorted pictures before each render if marked dirty
  - Removed heavy and redundant sorting multiple times per frame
- Implemented a custom FAKEFRAMES™ (sprite interpolation) framework to support high refresh rate monitors
  - FAKEFRAMES™ is not a trademark. The ™ symbol is part of the feature name for comedic effect.

For a detailed explanation of the optimization techniques, see: [The Brutal Optimization of RPG Maker MV](https://tsdo.in/blog/optimizing-rmmv/)
