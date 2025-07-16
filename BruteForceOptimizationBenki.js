(() => {
  // ================================================================
  // Custom tags
  // ================================================================
  let customInterpId = 1;
  Bitmap.prototype._customImageTag = function () {
    // No interpolation for SerifBar
    if (this.url.startsWith('img/pictures/SerifBar')) {
      this.__noInterp = true;
      console.log(`No interp picture marked: ${this.url}`);
    }

    // Don't interpolate for face changes
    if (this.url.startsWith('img/pictures/Character')) {
      this.__interpId = customInterpId++;
      console.log(`Interp picture marked (${this.__interpId}): ${this.url}`);
    }

    // Custom tag to cache tint textures
    if (this.url.startsWith('img/pictures/UNKO')) {
      this.__cacheTint = true;
      console.log(`Tint cache marked: ${this.url}`);
    }
  };

  // ================================================================
  // Recalculate SerifBar position during movePicture
  // This fixes rare text clipping in certain situation
  // ================================================================
  const Game_Screen_movePicture = Game_Screen.prototype.movePicture;
  let line1State = {
    last: 0,
    detectedWidth: 0,
    start: 0,
  };
  let line2State = {
    last: 0,
    detectedWidth: 0,
    start: 0,
  };

  const processLineStep = (varId, textId, state, x) => {
    const widthVar = $gameVariables._data[varId];
    if (state.last < widthVar) {
      state.detectedWidth = widthVar;
      state.start = x;
    }
    state.last = widthVar;

    const realWidth =
      (SceneManager._scene?._spriteset.__unsortedPictures[textId].width || state.detectedWidth) +
      16;
    const realStepSize = realWidth / (state.detectedWidth / 16);

    const currentStep = (x - state.start) / 16;
    return state.start + currentStep * realStepSize;
  };

  Game_Screen.prototype.movePicture = function (
    pictureId,
    origin,
    x,
    y,
    scaleX,
    scaleY,
    opacity,
    blendMode,
    duration
  ) {
    if (pictureId == 26) {
      x = processLineStep(93, 21, line1State, x);
    } else if (pictureId == 27) {
      x = processLineStep(94, 23, line2State, x);
    }

    Game_Screen_movePicture.call(
      this,
      pictureId,
      origin,
      x,
      y,
      scaleX,
      scaleY,
      opacity,
      blendMode,
      duration
    );
  };
})();
