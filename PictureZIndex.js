// This is a reimplementation of PictureZIndex.js by 奏ねこま（おとぶきねこま）
// This script has protocol compatibility with PictureZIndex.js
// Sort pictures before render if dirty instead of on each z-index changes,
//   eliminating multiple sort calls per frame.

(function () {
  'use strict';

  let _sortedState = false;

  const _Game_Interpreter_pluginCommand = Game_Interpreter.prototype.pluginCommand;
  Game_Interpreter.prototype.pluginCommand = function (command, args) {
    _Game_Interpreter_pluginCommand.call(this, command, args);

    if (!$gameScreen._pictureIndexOverride) {
      $gameScreen._pictureIndexOverride = {};
    }

    const indexOverride = $gameScreen._pictureIndexOverride;

    if (command.toLowerCase() == 'picturezindex') {
      args = args.map(arg => {
        arg = arg.toLowerCase();
        if (arg.startsWith('\\v[')) arg = $gameVariables._data[arg.substring(3, arg.length - 1)];
        return arg;
      });

      if (args[0] !== 'reset') {
        const id = args[0];
        let value = args[1];
        if (typeof value === 'string') {
          value = parseInt(value);
        }
        if (id == value) {
          delete indexOverride[id];
        } else {
          indexOverride[id] = value;
        }
        _sortedState = false;
      } else {
        indexOverride.length = 0;
        _sortedState = false;
      }
    }
  };

  const _SceneManager_renderScene = SceneManager.renderScene;
  SceneManager.renderScene = function () {
    const indexOverride = $gameScreen && $gameScreen._pictureIndexOverride;

    if (_sortedState !== indexOverride) {
      _sortedState = indexOverride;

      const spriteset = SceneManager._scene._spriteset;
      let children;
      if (spriteset && spriteset._pictureContainer) {
        children = spriteset._pictureContainer.children;
      }

      if (!indexOverride || indexOverride.length == 0) {
        if (children) {
          children.sort((a, b) => {
            return a._pictureId - b._pictureId;
          });
        }
        return;
      }
      if (children) {
        children.sort((a, b) => {
          var az = indexOverride[a._pictureId] || a._pictureId;
          var bz = indexOverride[b._pictureId] || b._pictureId;
          return az - bz;
        });
      }
    }
    _SceneManager_renderScene.call(this);
  };
})();
