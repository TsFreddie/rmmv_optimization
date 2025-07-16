(() => {
  // ================================================================
  // Preload - Preloading effects to reduce stutter during combat
  // ================================================================
  const EffectList = [
    'Effect_coin(500_01)',
    'Effect_coin(500_02)',
    'Effect_coin(500_03)',
    'Effect_coin(500_04)',
    'Effect_explosion(01)',
    'Effect_explosion(02)',
    'Effect_explosion(03)',
    'Effect_explosion(04)',
    'Effect_explosion(05)',
    'Effect_explosion(06)',
    'Effect_explosion(07)',
    'Effect_explosion(08)',
    'Effect_explosion(09)',
    'Effect_explosion(10)',
    'Effect_fukidasi(bikkuri)',
    'Effect_fukidasi(hatena)',
    'Effect_fukidasi(HEY)',
    'Effect_hahen(A)',
    'Effect_hahen(B)',
    'Effect_hahen(C)',
    'Effect_hahen(D)',
    'Effect_hit(A_01)',
    'Effect_hit(A_02)',
    'Effect_hit(A_03)',
    'Effect_hit(A_04)',
    'Effect_hit(B)',
    'Effect_hit(C)',
    'Effect_jusinchange(01)',
    'Effect_jusinchange(02)',
    'Effect_jusinchange(03)',
    'Effect_jusinchange(04)',
    'Effect_jusinchange(05)',
    'Effect_jusinchange(06)',
    'Effect_kill(A_01)',
    'Effect_kill(A_02)',
    'Effect_kill(A_03)',
    'Effect_kill(A_04)',
    'Effect_kill(B)',
    'Effect_kira',
    'Effect_mizusibuki',
    'Effect_object(iguasu_01_A)',
    'Effect_object(iguasu_01_B)',
    'Effect_object(kakadou_01)',
    'Effect_object(kakadou_ura03)',
    'Effect_object(kyanion_C3)',
    'Effect_object(marking)',
    'Effect_object(paradizo_C1)',
    'Effect_object(train)',
    'Effect_object(yu)',
    'Effect_oomozi',
    'Effect_sizuku(01)',
    'Effect_sizuku(02)',
    'Effect_smoke(dash_01)',
    'Effect_smoke(dash_02)',
    'Effect_smoke(dash_03)',
    'Effect_smoke(dash_04)',
    'Effect_smoke(dash_05)',
    'Effect_smoke(dash_06)',
    'Effect_smoke(kabekeri_01)',
    'Effect_smoke(kabekeri_02)',
    'Effect_smoke(kabekeri_03)',
    'Effect_smoke(kabekeri_04)',
    'Effect_smoke(kabekeri_05)',
    'Effect_smoke(kuutyuu)',
    'Effect_smoke(normal_01)',
    'Effect_smoke(normal_02)',
    'Effect_smoke(normal_03)',
    'Effect_smoke(normal_04)',
    'Effect_smoke(normal_05)',
    'Effect_smoke(yuge)',
    'Effect_sperm(Ground)',
    'Effect_sperm(shot)',
    'Effect_sperm(wall)',
    'Effect_tamakasu(assaultrifle)',
    'Effect_tamakasu(machinegun)',
    'Effect_tamakasu(pistol)',
    'Effect_tamakasu(shotgun)',
    'Effect_tamakasu(sniperrifle)',
    'Effect_ase',
    'Effect_coin(10_01)',
    'Effect_coin(10_02)',
    'Effect_coin(10_03)',
    'Effect_coin(10_04)',
    'Effect_coin(100_01)',
    'Effect_coin(100_02)',
    'Effect_coin(100_03)',
    'Effect_coin(100_04)',
  ];

  const _Scene_Boot_loadSystemImages = Scene_Boot.loadSystemImages;
  Scene_Boot.loadSystemImages = function () {
    _Scene_Boot_loadSystemImages.apply(this, arguments);
    for (const effect of EffectList) {
      ImageManager.reservePicture(effect);
    }
  };

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
      console.log(`Marking ${this.url} as scrolling picture`);
    }

    if (
      this.url.startsWith('img/pictures/Chara_') ||
      this.url.startsWith('img/pictures/System_target(')
    ) {
      this.__cacheTint = true;
      console.log(`Marking ${this.url} as cacheable tint picture`);
    }
  };
})();
