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
    if (scrollingPictures.has(this.url)) {
      this.__scrolling = true;
    }

    if (
      this.url.startsWith('img/pictures/Chara_') ||
      this.url.startsWith('img/pictures/System_target(')
    ) {
      this.__cacheTint = true;
    }
  };
})();
