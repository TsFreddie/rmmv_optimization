(() => {
  // ================================================================
  // Custom tags
  // ================================================================
  let customInterpId = 1;
  Bitmap.prototype._customImageTag = function () {
    // No interpolation for SerifBar
    if (this.url.startsWith('img/pictures/SerifBar')) {
      this.__noInterp = true;
    }

    // Face changes are not interpolated
    if (this.url.startsWith('img/pictures/Character')) {
      this.__interpId = customInterpId++;
    }

    // Custom tag to cache tint textures
    if (this.url.startsWith('img/pictures/UNKO')) {
      this.__cacheTint = true;
    }
  };
})();
