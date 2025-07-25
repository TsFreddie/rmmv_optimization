(() => {
  // ================================================================
  // Custom tags
  // ================================================================
  const scrollingPictures = new Set();
  scrollingPictures
    .add('img/pictures/Weather_yuki(oku).png')
    .add('img/pictures/Weather_yuki(temae).png')
    .add('img/pictures/Weather_kiri(oku).png')
    .add('img/pictures/Weather_kiri(temae).png')
    .add('img/pictures/Weather_fubuki(oku).png')
    .add('img/pictures/Weather_fubuki(temae).png')
    .add('img/pictures/Weather_ame.png')
    .add('img/pictures/System_keepout(up).png')
    .add('img/pictures/System_keepout(down).png');

  Bitmap.prototype._customImageTag = function () {
    // These sprites are scrolling sprites
    if (scrollingPictures.has(this.url)) {
      this.__scrolling = true;
    }

    // These sprites are likely to tint flash
    if (
      this.url.startsWith('img/pictures/Chara_') ||
      this.url.startsWith('img/pictures/System_target(')
    ) {
      this.__cacheTint = true;
    }
  };

  // ================================================================
  // Disable AUTO FPS mode
  // AUTO FPS mode uses a internal counter variable to decide when
  // to drop frames
  //
  // Since the RMMV's script engine is now optimized, it's very
  // unlikely you would want a AUTO FPS mode (which is the default)
  //
  // You can still change it to 30FPS if you want to.
  //
  // This is also the only code that alters the game's behaviour
  // ================================================================
  const _SceneManager_updateScene = SceneManager.updateScene;
  SceneManager.updateScene = function () {
    if ($gameSwitches && $gameSwitches._data)
      $gameSwitches._data[506] = $gameVariables._data[412] == 549 && $gameSwitches._data[501];
    _SceneManager_updateScene.call(this);
  };
})();
