// This is a reimplementation of PictureZIndex.js by 奏ねこま（おとぶきねこま）
// This script has protocol compatibility with PictureZIndex.js
// Sort pictures before render if dirty instead of on each z-index changes,
//   eliminating multiple sort calls per frame.

(function () {
  'use strict';

  const indexOverride = [];
  let _sortDirty = false;

  const _Game_Interpreter_pluginCommand = Game_Interpreter.prototype.pluginCommand;
  Game_Interpreter.prototype.pluginCommand = function (command, args) {
    _Game_Interpreter_pluginCommand.call(this, command, args);

    if (command.toLowerCase() == 'picturezindex') {
      args = args.map(arg => {
        arg = arg.toLowerCase();
        if (arg.startsWith('\\v[')) arg = $gameVariables._data[arg.substring(3, arg.length - 1)];
        return arg;
      });

      if (args[0] !== 'reset') {
        if (typeof args[1] === 'string') {
          indexOverride[args[0]] = parseInt(args[1]);
        } else {
          indexOverride[args[0]] = args[1];
        }
        _sortDirty = true;
      } else {
        indexOverride.length = 0;
        _sortDirty = true;
      }
    }
  };

  const _SceneManager_renderScene = SceneManager.renderScene;
  SceneManager.renderScene = function () {
    if (_sortDirty) {
      _sortDirty = false;
      const spriteset = SceneManager._scene._spriteset;
      const children = spriteset?._pictureContainer?.children;

      if (indexOverride.length == 0) {
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
