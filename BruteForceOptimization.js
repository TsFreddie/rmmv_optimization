/*:
 * @plugindesc A collection of optimizations for RPG Maker MV
 * @author TsFreddie
 * @version 1.0.0
 *
 * @help This plugin provides the following optimizations:
 *
 * 1. FAKEFRAMES™ - High refresh rate monitor support
 *    - This is performed by interpolating sprites. Please check this
 *    - plugin's source code on how to configure this feature to
 *    - eliminate interpolation visual artifacts.
 *
 *    - See: Bitmap Tags
 *
 *    - You can also control FAKEFRAMES™ features with script:
 *    - `$gameSystem.toggleFakeFrames()`
 *    - `$gameSystem.setFakeFrames(true)`
 *    - `$gameSystem.setFakeFrames(false)`
 *
 *    - You can get the current FAKEFRAMES™ status with script:
 *    - `$gameVariables.setValue(100, $gameSystem.isFakeFramesOn())`
 *
 * 2. Tint caching
 *    - Cache tinted pictures to reduce repeated tinting operations.
 *    - Please check this plugin's source code on how to configure this
 *    - feature to enable them.
 *
 *    - See: Bitmap Tags
 *
 * 3. Picture optimizations
 *    - Allows you to use `$gameScreen.showPicture` to assign
 *    - very high picture IDs without tanking performance.
 *
 * 4. Interpreter optimizations
 *    - Speed up the script execution speed by up to 20x.
 *
 * 5. Threaded decryption
 *    - Reduce main thread stalls by offloading decryption
 *    - work to a web worker. Only affect exported games.
 *
 * Other than FAKEFRAMES™ and tint caching, all other optimizations
 *     are not configurable and are always enabled.
 *
 * @param fakeframes
 * @text FAKEFRAMES™
 * @type boolean
 * @desc Enable FAKEFRAMES™ by default - High refresh rate monitor support
 * @default true
 *
 * @param fakeframes_toggle
 * @text FAKEFRAMES™ Keyboard Toggle
 * @type number
 * @desc Keycode to toggle FAKEFRAMES™ (0 to disable). Default to F6 (117).
 * @default 117
 */

(() => {
  /**
   * Bitmap Tags
   *
   * You can modify the `_customImageTag` function to add custom tags to images.
   * You can also create another plugin just to override this function.
   *
   * Supported tags:
   *  this.__scrolling : Scrolling sprites, prevent jitter when the sprite teleports.
   *  this.__noInterp : Disable interpolation for this image.
   *  this.__interpId : Disable interpolation from or to different interpolation id.
   *  this.__cacheTint : Cache tint textures, optimize flickering sprites.
   *     - Please make sure the tint switches between only a few colors.
   *     - Smooth tinting or random tinting will create one texture for each color, which is not recommended.
   */

  if (!Bitmap.prototype._customImageTag) {
    Bitmap.prototype._customImageTag = function () {
      // Example:
      // if (this.url == "img/pictures/Weather.png") {
      //   this.__scrolling = true;
      // }
    };
  }

  var pluginName = 'BruteForceOptimization';
  const parameters = PluginManager.parameters(pluginName);
  const CONFIG = {
    interpDefault:
      parameters['fakeframes'] == 'true' || typeof parameters['fakeframes'] == 'undefined',
    interpToggle: parseInt(
      typeof parameters['fakeframes_toggle'] == 'undefined' ? 117 : parameters['fakeframes_toggle']
    ),
  };

  // ================================================================
  // Interpolation - High refresh rate monitor support
  // ================================================================
  const ActivePictures = new Set();
  const RemovingPictures = new Set();

  const TARGET_INTERVAL = 1000.0 / 60.0;
  const INTERP_TELEPORT_THRESHOLD = 6 * TARGET_INTERVAL;
  const hfrModeThreshold = 64.5;
  const frameTimes = [];
  let detectedRefreshRate = 0;
  let interFrame = 0;

  const customKeyHandler = event => {
    if (!event.ctrlKey && !event.altKey) {
      if (event.keyCode === 117) {
        event.preventDefault();
        if ($gameSystem) $gameSystem.toggleFakeFrames();
        return;
      }
    }
  };

  document.addEventListener('keydown', customKeyHandler);

  Game_System.prototype.isFakeFramesOn = function () {
    if (this.__interp == null) return !!CONFIG.interpDefault;
    return this.__interp;
  };

  Game_System.prototype.setFakeFrames = function (value) {
    value = !!value;
    if (this.isFakeFramesOn() === value) return;
    this.__interp = value;
    resetInterp();
    showBanner();
  };

  Game_System.prototype.toggleFakeFrames = function () {
    this.__interp = !this.isFakeFramesOn();
    resetInterp();
    showBanner();
  };

  const showBanner = async text => {
    const enabled = $gameSystem && $gameSystem.isFakeFramesOn();
    const banner = document.createElement('div');
    banner.style.position = 'fixed';
    banner.style.top = '5vh';
    banner.style.right = '0';
    banner.style.backgroundColor = !enabled && !text ? '#000000dd' : '#2e7ceadd';
    banner.style.color = '#ffffff';
    banner.style.padding = '1vh';
    banner.style.paddingLeft = '3vh';
    banner.style.paddingRight = '5vh';
    banner.style.fontSize = '2.5vh';
    banner.style.fontWeight = 'bold';
    banner.style.zIndex = '1000';
    banner.style.fontFamily = 'sans-serif';
    banner.style.transform = 'translateX(5%) skewX(-15deg)';
    banner.style.opacity = '0';
    banner.style.transition = 'all 0.2s ease-in-out';
    banner.style.transform = 'translateX(100%) skewX(-15deg)';
    banner.style.backdropFilter = 'blur(0.5vh)';

    banner.textContent = text || `FAKEFRAMES™ - フェイクフレーム™ - ${!enabled ? 'OFF' : 'ON'}`;

    document.body.appendChild(banner);
    await new Promise(resolve => setTimeout(resolve, 200));
    banner.style.opacity = '1';
    banner.style.transform = 'translateX(5%) skewX(-15deg)';
    await new Promise(resolve => setTimeout(resolve, 1600));
    banner.style.opacity = '0';
    banner.style.transform = 'translateX(100%) skewX(-15deg)';
    await new Promise(resolve => setTimeout(resolve, 200));
    document.body.removeChild(banner);
  };

  const resetInterp = () => {
    const spriteset = SceneManager._scene && SceneManager._scene._spriteset;
    if (spriteset) {
      spriteset._ilpx = null;
      spriteset._ipx = null;
      spriteset._ilppx = null;
      spriteset._ippx = null;

      for (const sprite of spriteset._characterSprites) {
        sprite._ilpx = null;
        sprite._ipx = null;
      }

      const pictures = spriteset.__unsortedPictures;
      if (pictures) {
        for (const picture of pictures) {
          picture._ilpx = null;
          picture._ipx = null;
        }
      }
    }
  };

  const restoreSceneCollection = () => {
    const spriteset = SceneManager._scene && SceneManager._scene._spriteset;
    if (spriteset) {
      spriteset._interpRestore();
      for (const sprite of spriteset._characterSprites) {
        sprite._interpRestore();
      }

      const pictures = spriteset.__unsortedPictures;
      for (const id of ActivePictures) {
        pictures[id]._interpRestore();
      }
    }
  };

  const stepSceneCollection = () => {
    const spriteset = SceneManager._scene && SceneManager._scene._spriteset;
    if (spriteset) {
      spriteset._interpStep();
      for (const sprite of spriteset._characterSprites) {
        sprite._interpStep();
      }

      const pictures = spriteset.__unsortedPictures;
      for (const id of ActivePictures) {
        pictures[id]._interpStep();
      }
    }
  };

  const updateSceneCollection = () => {
    if (!$gameSystem || !$gameSystem.isFakeFramesOn()) return;

    const spriteset = SceneManager._scene && SceneManager._scene._spriteset;
    if (spriteset) {
      spriteset._interpUpdate();
      for (const sprite of spriteset._characterSprites) {
        sprite._interpUpdate();
      }

      const pictures = spriteset.__unsortedPictures;
      for (const id of ActivePictures) {
        pictures[id]._interpUpdate();
      }
    }
  };

  Sprite.prototype._interpRestore = function () {
    if (this._ipx != null) {
      const position = this.transform.position;
      position.x = this._ipx;
      position.y = this._ipy;
      const scale = this.transform.scale;
      scale.x = this._isx;
      scale.y = this._isy;
      this.transform.rotation = this._ir;
    }
  };

  // Mark scrolling pictures
  const _Bitmap_onLoad = Bitmap.prototype._onLoad;
  Bitmap.prototype._onLoad = function () {
    if (!this._isDText && this.url) {
      this._customImageTag();
    }
    _Bitmap_onLoad.apply(this, arguments);
  };

  Sprite.prototype._interpStep = function () {
    this._ilpx = this._ipx;
    this._ilpy = this._ipy;
    this._ilsx = this._isx;
    this._ilsy = this._isy;
    this._ilr = this._ir;
    const position = this.transform.position;
    this._ipx = position.x;
    this._ipy = position.y;
    const scale = this.transform.scale;
    this._isx = scale.x;
    this._isy = scale.y;
    this._ir = this.transform.rotation;
    this._idpx = this._ipx - this._ilpx;
    this._idpy = this._ipy - this._ilpy;
    this._idsx = this._isx - this._ilsx;
    this._idsy = this._isy - this._ilsy;
    this._idr = this._ir - this._ilr;

    const interpId = (this.bitmap && this.bitmap.__interpId) || undefined;

    if (
      !this.bitmap || // no bitmap
      this.bitmap.__noInterp || // bitmap with no interp tag should not be interpolated
      this._ildti != this.dTextInfo || // make sure text changes are not interpolated
      this._iliid != interpId || // if interp id changed, jump to current position immediately
      Math.abs(this._idpx) > INTERP_TELEPORT_THRESHOLD ||
      Math.abs(this._idpy) > INTERP_TELEPORT_THRESHOLD ||
      Math.abs(this._isx) <= 0.005 ||
      Math.abs(this._isy) <= 0.005 ||
      Math.sign(this._isx) !== Math.sign(this._ilsx) ||
      Math.sign(this._isy) !== Math.sign(this._ilsy)
    ) {
      if (this.bitmap && this.bitmap.__scrolling) {
        // This is a scrolling sprite, pretend the last frame was already teleported back to keep it smooth.
        this._ilpx = this._ipx - this._ildpx;
        this._ilpy = this._ipy - this._ildpy;
        this._idpx = this._ildpx;
        this._idpy = this._ildpy;
        return;
      }
      this._ilpx = this._ipx;
      this._ilpy = this._ipy;
      this._ilsx = this._isx;
      this._ilsy = this._isy;
      this._ilr = this._ir;
      this._idpx = 0;
      this._idpy = 0;
      this._idsx = 0;
      this._idsy = 0;
      this._idr = 0;
    }
    this._ildpx = this._idpx;
    this._ildpy = this._idpy;
    this._ildti = this.dTextInfo;
    this._iliid = interpId;
  };

  Sprite.prototype._interpUpdate = function () {
    if (this._ilpx != null) {
      const position = this.transform.position;
      const scale = this.transform.scale;
      position.x = this._ilpx + this._idpx * interFrame;
      position.y = this._ilpy + this._idpy * interFrame;
      scale.x = this._ilsx + this._idsx * interFrame;
      scale.y = this._ilsy + this._idsy * interFrame;
      this.transform.rotation = this._ilr + this._idr * interFrame;
    }
  };

  Spriteset_Map.prototype._interpRestore = function () {
    if (this._ipx != null) {
      this._tilemap.origin.x = this._ipx;
      this._tilemap.origin.y = this._ipy;
    }

    if (this._parallax && this._ippx != null) {
      this._parallax.origin.x = this._ippx;
      this._parallax.origin.y = this._ippy;
    }
  };

  Spriteset_Map.prototype._interpStep = function () {
    this._ilpx = this._ipx;
    this._ilpy = this._ipy;
    this._ipx = this._tilemap.origin.x;
    this._ipy = this._tilemap.origin.y;
    this._idpx = this._ipx - this._ilpx;
    this._idpy = this._ipy - this._ilpy;

    if (this._parallax) {
      this._ilppx = this._ippx;
      this._ilppy = this._ippy;
      this._ippx = this._parallax.origin.x;
      this._ippy = this._parallax.origin.y;
      this._idppx = this._ippx - this._ilppx;
      this._idppy = this._ippy - this._ilppy;
    }
  };

  Spriteset_Map.prototype._interpUpdate = function () {
    if (this._ilpx != null) {
      this._tilemap.origin.x = this._ilpx + this._idpx * interFrame;
      this._tilemap.origin.y = this._ilpy + this._idpy * interFrame;
    }

    if (this._parallax && this._ilppx != null) {
      this._parallax.origin.x = this._ilppx + this._idppx * interFrame;
      this._parallax.origin.y = this._ilppy + this._idppy * interFrame;
    }
  };

  // ================================================================
  // Frame time optimization - Try to match 60fps
  // ================================================================

  SceneManager.lastFrame = 0;
  SceneManager.lastUpdate = 0;
  SceneManager.gameInterval = TARGET_INTERVAL;
  SceneManager.updateMainDefault = SceneManager.updateMain;
  let updateCount = 0;

  SceneManager.____updateInternal = function () {
    this.updateInputData();
    this.changeScene();
    this.updateScene();

    let deletedCache = 0;
    Array.from(dataMapKeepAlive)
      .filter(([list, aliveUpdate]) => updateCount - aliveUpdate >= 5)
      .forEach(([list, aliveUpdate]) => {
        compileCache.delete(list);
        dataMapKeepAlive.delete(list);
        deletedCache++;
      });
    if (deletedCache > 0) {
      console.log(`Disposed ${deletedCache} cached scripts`);
    }

    // Expire audio cache that is not used for 1 minute
    let deletedAudioCache = 0;
    Array.from(audioCache)
      .filter(([url, audio]) => updateCount - audio.aliveFrame >= 3600)
      .forEach(([url, audio]) => {
        audioCache.delete(url);
        deletedAudioCache++;
      });
    if (deletedAudioCache > 0) {
      console.log(`Disposed ${deletedAudioCache} cached audio`);
    }

    updateCount++;
  };

  SceneManager.updateOptimized = function () {
    this.requestUpdate();

    if (this.lastUpdate == 0) {
      this.lastUpdate = window.performance.now();
      this.lastRender = this.lastUpdate;
      restoreSceneCollection();
      this.____updateInternal();
      stepSceneCollection();
      this.renderScene();
      return;
    }

    const now = performance.now();
    let frameTime = now - this.lastUpdate;
    if (isNaN(frameTime)) frameTime = this.gameInterval;

    frameTimes.unshift(now);
    if (frameTimes.length > 10) {
      const t0 = frameTimes.pop();
      const delta = now - t0;
      if (delta > 1) {
        detectedRefreshRate = (1000 * 10) / delta;
      }
    }

    let lagCounter = 0;
    const isHfr = detectedRefreshRate > hfrModeThreshold;

    while (frameTime >= this.gameInterval) {
      this.lastUpdate += this.gameInterval;

      restoreSceneCollection();
      this.____updateInternal();
      stepSceneCollection();

      lagCounter++;
      if (lagCounter >= 2 || isNaN(this.lastUpdate)) {
        this.lastUpdate = now;
        break;
      }
      frameTime -= this.gameInterval;
    }

    interFrame = Math.min(Math.max((now - this.lastUpdate) / this.gameInterval, 0), 1);
    if (isHfr) updateSceneCollection();
    this.renderScene();
    this.lastRender = now;
  };

  SceneManager.updateMain = function () {
    this.updateOptimized();
  };

  // ================================================================
  // Command Cache - Reduce string operations when executing commands
  // ================================================================

  // Interpreter optimization
  // Game_Interpreter path is VERY HOT, avoid calls at all cost
  Game_Interpreter.prototype.update = function () {
    let count = 0;
    while (this._list) {
      if (this._childInterpreter) {
        this._childInterpreter.update();
        if (this._childInterpreter._list) {
          break;
        } else {
          this._childInterpreter = null;
        }
      }

      if (this._waitCount > 0) {
        this._waitCount--;
        break;
      }

      if (this._waitMode && this.updateWaitMode()) {
        break;
      }

      if (SceneManager.isSceneChanging()) {
        break;
      }

      const command = this._list[this._index];
      if (command) {
        if (command.executable) {
          this._params = command.parameters;
          this._indent = command.indent;
          if (!NO_BIND_COMMANDS[command.code](this)) break;
          this._index++;
        } else {
          this._index++;
        }
      } else {
        this._list = null;
      }

      if (count++ >= 100000) {
        break;
      }
    }
  };

  // ================================================================
  // Script Cache - Precompile all eval scripts
  // Jump Cache - Precompute all jumps
  // ================================================================

  const compileCache = new Map();
  const dataMapKeepAlive = new Map();

  const findCorrespondingBracket = (script, index, openBracket, closeBracket) => {
    let depth = 1;
    for (let i = index; i < script.length; i++) {
      const c = script[i];
      if (c === openBracket) depth++;
      if (c === closeBracket) depth--;
      if (depth === 0) return i;
    }
    return -1;
  };

  window.__scriptProcessing = null;

  const transformScript = scriptLine => {
    const script = scriptLine.replace(/this\./g, '__.');
    const segments = [];
    let lastProcessed = 0;
    for (let i = 0; i < script.length; i++) {
      const c = script[i];
      if (c === '$') {
        if (script.substring(i, i + 21) === '$gameVariables.value(') {
          const end = findCorrespondingBracket(script, i + 21, '(', ')');
          segments.push(script.substring(lastProcessed, i));
          segments.push('($gameVariables._data[');
          segments.push(transformScript(script.substring(i + 21, end)));
          segments.push('] || 0)');
          i = end + 1;
          lastProcessed = i;
        } else if (script.substring(i, i + 20) === '$gameSwitches.value(') {
          const end = findCorrespondingBracket(script, i + 20, '(', ')');
          segments.push(script.substring(lastProcessed, i));
          segments.push('!!$gameSwitches._data[');
          segments.push(transformScript(script.substring(i + 20, end)));
          segments.push(']');
          i = end + 1;
          lastProcessed = i;
        } else if (script.substring(i, i + 24) === '$gameSelfSwitches.value(') {
          const end = findCorrespondingBracket(script, i + 24, '(', ')');
          segments.push(script.substring(lastProcessed, i));
          segments.push('!!$gameSelfSwitches._data[');
          segments.push(transformScript(script.substring(i + 24, end)));
          segments.push(']');
          i = end + 1;
          lastProcessed = i;
        }
      }
    }
    segments.push(script.substring(lastProcessed));
    if (window.__scriptProcessing) {
      return window.__scriptProcessing(segments.join(''));
    } else {
      return segments.join('');
    }
  };

  const compile = list => {
    const scriptCache = [];
    const jumpCache = Int32Array.from(list.map(() => -1));

    const branchIndent = [];
    const repeatIndent = [];

    // Record branch indent
    for (var i = 0; i < list.length; i++) {
      const command = list[i];

      const indent = command.indent;
      let nextIndent = list[i + 1] && list[i + 1].indent;
      if (nextIndent == null) {
        nextIndent = -1;
      }

      if (nextIndent > indent) {
        branchIndent[indent] = i;
      } else {
        for (let j = nextIndent; j < indent; j++) {
          if (branchIndent[j] != null) {
            jumpCache[branchIndent[j]] = i;
            branchIndent[j] = null;
          }
        }
      }

      if (repeatIndent[indent] == null) {
        repeatIndent[indent] = i;
      } else {
        if (command.code == 413) jumpCache[i] = repeatIndent[indent];
        repeatIndent[indent] = i;
      }
    }

    // Compile script command
    for (var i = 0; i < list.length; i++) {
      const command = list[i];
      const index = i;
      let cur = i;

      if (command.code == 355) {
        const scriptLines = [];
        let line = transformScript(command.parameters[0]);
        if (line[0] != '/' && line[1] != '/') {
          scriptLines.push(line);
        }
        while (list[cur + 1] && list[cur + 1].code == 655) {
          cur++;
          line = transformScript(list[cur].parameters[0]);
          if (line[0] != '/' && line[1] != '/') {
            scriptLines.push(line);
          }
        }

        if (scriptLines.length > 0) {
          const script = scriptLines.join('\n');
          const funcWrap = `(__)=>{\n${script}\n}`;
          const func = eval(funcWrap);
          scriptCache[index] = { func, i: cur };
        }
      }

      if (command.code == 108) {
        while (list[cur + 1] && list[cur + 1].code == 408) {
          cur++;
        }
        jumpCache[index] = cur;
      }

      if (command.code == 111 && command.parameters[0] === 12) {
        const script = transformScript(command.parameters[1]);
        const funcWrap = `()=>{return ${script};}`;
        const func = eval(funcWrap);
        scriptCache[index] = { func, i: cur };
      }

      if (command.code == 122 && command.parameters[3] === 4) {
        const script = transformScript(command.parameters[4]);
        const funcWrap = `()=>{return ${script};}`;
        const func = eval(funcWrap);
        scriptCache[index] = { func, i: cur };
      }

      // Cache loop break
      if (command.code === 113) {
        let break_cur = i;
        let break_indent = command.indent;
        let depth = 0;
        while (break_cur < list.length - 1) {
          break_cur++;
          let break_cur_command = list[break_cur];
          if (break_cur_command.code === 112) depth++;
          if (break_cur_command.code === 413 && break_cur_command.indent < break_indent) {
            if (depth > 0) depth--;
            else break;
          }
        }
        jumpCache[index] = break_cur;
      }

      // nullify invalid commands
      command.executable =
        typeof Game_Interpreter.prototype[`command${command.code}`] === 'function';
    }

    return {
      scriptCache,
      jumpCache,
    };
  };

  const preCompileEvents = list => {
    if (compileCache.get(list) != null) return;

    compileCache.set(list, compile(list));
  };

  const _DataManager_loadMapData = DataManager.loadMapData;
  DataManager.loadMapData = function (mapId) {
    _DataManager_loadMapData.apply(this, arguments);
    _mapId = mapId;
  };

  const _DataManager_onLoad = DataManager.onLoad;
  DataManager.onLoad = function (object) {
    _DataManager_onLoad.apply(this, arguments);

    if (object == $dataCommonEvents) {
      for (e of object) {
        const list = e && e.list;
        if (!list) continue;
        preCompileEvents(list);
      }
    }

    if (object == $dataMap) {
      for (e of (object.events || [])) {
        const pages = (e && e.pages) || [];
        for (let p = 0; p < pages.length; p++) {
          const page = pages[p];
          const list = page && page.list;
          if (!list) continue;
          preCompileEvents(list);
          dataMapKeepAlive.set(list, updateCount);
        }
      }
    }
  };

  const _Game_CommonEvent_update = Game_CommonEvent.prototype.update;
  Game_CommonEvent.prototype.update = function () {
    const interpreterList = this._interpreter && this._interpreter._list;
    if (interpreterList) {
      const cache = compileCache.get(interpreterList);
      if (cache != null) {
        this._interpreter.__s = cache.scriptCache;
        this._interpreter.__j = cache.jumpCache;
      } else {
        console.log('On the fly compiling during common event update');
        const compiled = compile(interpreterList);
        compileCache.set(interpreterList, compiled);
        this._interpreter.__s = compiled.scriptCache;
        this._interpreter.__j = compiled.jumpCache;
      }
    }
    _Game_CommonEvent_update.apply(this, arguments);
  };

  // Keep event alive during update
  const _Game_Event_update = Game_Event.prototype.update;
  Game_Event.prototype.update = function () {
    const interpreterList = this._interpreter && this._interpreter._list;
    if (interpreterList) {
      const cache = compileCache.get(interpreterList);
      if (cache != null) {
        this._interpreter.__s = cache.scriptCache;
        this._interpreter.__j = cache.jumpCache;
      } else {
        console.log('On the fly compiling during event update');
        const compiled = compile(interpreterList);
        compileCache.set(interpreterList, compiled);
        this._interpreter.__s = compiled.scriptCache;
        this._interpreter.__j = compiled.jumpCache;
      }
    }
    _Game_Event_update.apply(this, arguments);

    if ($dataMap.events[this._eventId] && $dataMap.events[this._eventId].pages && $dataMap.events[this._eventId].pages[this._pageIndex]) {
      const list = $dataMap.events[this._eventId].pages[this._pageIndex].list;
      if (list) {
        dataMapKeepAlive.set(list, updateCount);
      }
    }
  };

  // Make sure we recompile events when loading from a save file
  const _Game_Event_refresh = Game_Event.prototype.refresh;
  Game_Event.prototype.refresh = function () {
    _Game_Event_refresh.apply(this, arguments);
    const list = this._interpreter && this._interpreter._list;
    if (list) {
      if (compileCache.get(list) != null) return;
      console.log('On the fly compiling non setup');
      const compiled = compile(list);
      compileCache.set(list, compiled);
      this._interpreter.__s = compiled.scriptCache;
      this._interpreter.__j = compiled.jumpCache;
    }
  };

  const NO_BIND_COMMANDS = [];
  // prettier-ignore
  {
    NO_BIND_COMMANDS[603] = c => c.command603();
    NO_BIND_COMMANDS[602] = c => c.command602();
    NO_BIND_COMMANDS[601] = c => c.command601();
    NO_BIND_COMMANDS[413] = c => { c._index = c.__j[c._index]; return true; };
    NO_BIND_COMMANDS[411] = c => { if (c._branch[c._indent] !== false) c._index = c.__j[c._index]; return true; }
    NO_BIND_COMMANDS[403] = c => { if (c._branch[c._indent] >= 0) c._index = c.__j[c._index]; return true; }
    NO_BIND_COMMANDS[402] = c => { if (c._branch[c._indent] !== c._params[0]) c._index = c.__j[c._index]; return true; }
    NO_BIND_COMMANDS[356] = c => { const args = c._params[0].split(" "); const cmd = args.shift(); c.pluginCommand(cmd, args); return true; }
    NO_BIND_COMMANDS[355] = c => { const j = c.__s[c._index]; j.func(c); c._index = j.i; return true; };
    NO_BIND_COMMANDS[354] = c => c.command354();
    NO_BIND_COMMANDS[353] = c => c.command353();
    NO_BIND_COMMANDS[352] = c => c.command352();
    NO_BIND_COMMANDS[351] = c => c.command351();
    NO_BIND_COMMANDS[342] = c => c.command342();
    NO_BIND_COMMANDS[340] = c => c.command340();
    NO_BIND_COMMANDS[339] = c => c.command339();
    NO_BIND_COMMANDS[337] = c => c.command337();
    NO_BIND_COMMANDS[336] = c => c.command336();
    NO_BIND_COMMANDS[335] = c => c.command335();
    NO_BIND_COMMANDS[334] = c => c.command334();
    NO_BIND_COMMANDS[333] = c => c.command333();
    NO_BIND_COMMANDS[332] = c => c.command332();
    NO_BIND_COMMANDS[331] = c => c.command331();
    NO_BIND_COMMANDS[326] = c => c.command326();
    NO_BIND_COMMANDS[325] = c => c.command325();
    NO_BIND_COMMANDS[324] = c => c.command324();
    NO_BIND_COMMANDS[323] = c => c.command323();
    NO_BIND_COMMANDS[322] = c => c.command322();
    NO_BIND_COMMANDS[321] = c => c.command321();
    NO_BIND_COMMANDS[320] = c => c.command320();
    NO_BIND_COMMANDS[319] = c => c.command319();
    NO_BIND_COMMANDS[318] = c => c.command318();
    NO_BIND_COMMANDS[317] = c => c.command317();
    NO_BIND_COMMANDS[316] = c => c.command316();
    NO_BIND_COMMANDS[315] = c => c.command315();
    NO_BIND_COMMANDS[314] = c => c.command314();
    NO_BIND_COMMANDS[313] = c => c.command313();
    NO_BIND_COMMANDS[312] = c => c.command312();
    NO_BIND_COMMANDS[311] = c => c.command311();
    NO_BIND_COMMANDS[303] = c => c.command303();
    NO_BIND_COMMANDS[302] = c => c.command302();
    NO_BIND_COMMANDS[301] = c => c.command301();
    NO_BIND_COMMANDS[285] = c => c.command285();
    NO_BIND_COMMANDS[284] = c => c.command284();
    NO_BIND_COMMANDS[283] = c => c.command283();
    NO_BIND_COMMANDS[282] = c => c.command282();
    NO_BIND_COMMANDS[281] = c => c.command281();
    NO_BIND_COMMANDS[261] = c => c.command261();
    NO_BIND_COMMANDS[251] = c => { AudioManager.stopSe(); return true; };
    NO_BIND_COMMANDS[250] = c => { AudioManager.playSe(c._params[0]); return true; };
    NO_BIND_COMMANDS[249] = c => c.command249();
    NO_BIND_COMMANDS[246] = c => c.command246();
    NO_BIND_COMMANDS[245] = c => c.command245();
    NO_BIND_COMMANDS[244] = c => c.command244();
    NO_BIND_COMMANDS[243] = c => c.command243();
    NO_BIND_COMMANDS[242] = c => c.command242();
    NO_BIND_COMMANDS[241] = c => c.command241();
    NO_BIND_COMMANDS[236] = c => c.command236();
    NO_BIND_COMMANDS[235] = c => { $gameScreen.erasePicture(c._params[0]); return true; };
    NO_BIND_COMMANDS[234] = c => { const p = c._params; $gameScreen.tintPicture(p[0], p[1], p[2]); if (p[3]) { c._waitCount = p[2]; } return true; };
    NO_BIND_COMMANDS[233] = c => { const p = c._params; $gameScreen.rotatePicture(p[0], p[1]); return true; };
    NO_BIND_COMMANDS[232] = c => { let x, y; const p = c._params; if (p[3] === 0) { x = p[4]; y = p[5]; } else { x = $gameVariables._data[p[4]] || 0; y = $gameVariables._data[p[5]] || 0; } $gameScreen.movePicture(p[0], p[2], x, y, p[6], p[7], p[8], p[9], p[10]); if (p[11]) { c._waitCount = p[10]; } return true; };
    NO_BIND_COMMANDS[231] = c => { let x, y; const p = c._params; if (p[3] === 0) { x = p[4]; y = p[5]; } else { x = $gameVariables._data[p[4]] || 0; y = $gameVariables._data[p[5]] || 0; } $gameScreen.showPicture(p[0], p[1], p[2], x, y, p[6], p[7], p[8], p[9]); return true; };
    NO_BIND_COMMANDS[230] = c => { c._waitCount = c._params[0]; return true; };
    NO_BIND_COMMANDS[225] = c => c.command225();
    NO_BIND_COMMANDS[224] = c => c.command224();
    NO_BIND_COMMANDS[223] = c => c.command223();
    NO_BIND_COMMANDS[222] = c => c.command222();
    NO_BIND_COMMANDS[221] = c => c.command221();
    NO_BIND_COMMANDS[217] = c => c.command217();
    NO_BIND_COMMANDS[216] = c => c.command216();
    NO_BIND_COMMANDS[214] = c => c.command214();
    NO_BIND_COMMANDS[213] = c => c.command213();
    NO_BIND_COMMANDS[212] = c => c.command212();
    NO_BIND_COMMANDS[211] = c => c.command211();
    NO_BIND_COMMANDS[206] = c => c.command206();
    NO_BIND_COMMANDS[205] = c => c.command205();
    NO_BIND_COMMANDS[204] = c => c.command204();
    NO_BIND_COMMANDS[203] = c => c.command203();
    NO_BIND_COMMANDS[202] = c => c.command202();
    NO_BIND_COMMANDS[201] = c => c.command201();
    NO_BIND_COMMANDS[140] = c => c.command140();
    NO_BIND_COMMANDS[139] = c => c.command139();
    NO_BIND_COMMANDS[138] = c => c.command138();
    NO_BIND_COMMANDS[137] = c => c.command137();
    NO_BIND_COMMANDS[136] = c => c.command136();
    NO_BIND_COMMANDS[135] = c => c.command135();
    NO_BIND_COMMANDS[134] = c => c.command134();
    NO_BIND_COMMANDS[133] = c => c.command133();
    NO_BIND_COMMANDS[132] = c => c.command132();
    NO_BIND_COMMANDS[129] = c => c.command129();
    NO_BIND_COMMANDS[128] = c => c.command128();
    NO_BIND_COMMANDS[127] = c => c.command127();
    NO_BIND_COMMANDS[126] = c => c.command126();
    NO_BIND_COMMANDS[125] = c => c.command125();
    NO_BIND_COMMANDS[124] = c => c.command124();
    NO_BIND_COMMANDS[123] = c => c.command123();
    NO_BIND_COMMANDS[122] = c => { const p = c._params; c122[p[3]](c, p[0], p[1], p[2], p[4], p); return true; };
    NO_BIND_COMMANDS[121] = c => { const p = c._params; for (let i = p[0]; i <= p[1]; i++) { $gameSwitches.setValue(i, p[2] === 0); } return true; };
    NO_BIND_COMMANDS[119] = c => c.command119();
    NO_BIND_COMMANDS[118] = c => true;
    NO_BIND_COMMANDS[117] = c => { const ce = $dataCommonEvents[c._params[0]]; if (ce) { const e = (c._mapId === $gameMap._mapId) ? this._eventId : 0; c._childInterpreter = new Game_Interpreter(c._depth + 1); c._childInterpreter.setup(ce.list, e); } return true; }
    NO_BIND_COMMANDS[115] = c => { c._index = c._list.length; return true; };
    NO_BIND_COMMANDS[113] = c => { c._index = c.__j[c._index]; return true; };
    NO_BIND_COMMANDS[112] = c => true;
    NO_BIND_COMMANDS[111] = c => { const p = c._params; const b = c111[p[0]](c, p); if (b === false) { c._index = c.__j[c._index]; } c._branch[c._indent] = b; return true; };
    NO_BIND_COMMANDS[108] = c => { c._index = c.__j[c._index]; return true; };
    NO_BIND_COMMANDS[105] = c => c.command105();
    NO_BIND_COMMANDS[104] = c => c.command104();
    NO_BIND_COMMANDS[103] = c => c.command103();
    NO_BIND_COMMANDS[102] = c => c.command102();
    NO_BIND_COMMANDS[101] = c => c.command101();
  }

  // Cache list setup
  const _Game_Interpreter_setup = Game_Interpreter.prototype.setup;
  Game_Interpreter.prototype.setup = function (list) {
    _Game_Interpreter_setup.apply(this, arguments);
    let compiled = compileCache.get(list);
    if (!compiled) {
      console.log('On the fly compiling with setup');
      compiled = compile(list);
      compileCache.set(list, compiled);
    }
    this.__s = compiled.scriptCache;
    this.__j = compiled.jumpCache;
  };

  // Faster branch
  const _Game_Interpreter_initialize = Game_Interpreter.prototype.initialize;
  Game_Interpreter.prototype.initialize = function () {
    _Game_Interpreter_initialize.apply(this, arguments);
    this._branch = [];
  };

  // Running Check (skip converting to boolean which is actually slower)
  Game_Interpreter.prototype.isRunning = function () {
    return this._list != null;
  };

  const c122Operate = [
    // 0 - Set
    (i, value) => $gameVariables.setValue(i, value),
    // 1 - Add
    (i, value) => $gameVariables.setValue(i, $gameVariables._data[i] + value),
    // 2 - Sub
    (i, value) => $gameVariables.setValue(i, $gameVariables._data[i] - value),
    // 3 - Mul
    (i, value) => $gameVariables.setValue(i, $gameVariables._data[i] * value),
    // 4 - Div
    (i, value) => $gameVariables.setValue(i, $gameVariables._data[i] / value),
    // 5 - Mod
    (i, value) => $gameVariables.setValue(i, $gameVariables._data[i] % value),
  ];

  const c122 = [
    // 0 - Constant
    (c, b, e, op, v, p) => {
      for (let i = b; i <= e; i++) {
        c122Operate[op](i, v);
      }
    },
    // 1 - Variable
    (c, b, e, op, v, p) => {
      for (let i = b; i <= e; i++) {
        c122Operate[op](i, $gameVariables._data[v] || 0);
      }
    },
    // 2 - Random
    (c, b, e, op, v, p) => {
      const upper = p[5] - v + 1;
      for (let i = b; i <= e; i++) {
        c122Operate[op](i, v + Math.randomInt(upper));
      }
    },
    // 3 - Game Data
    (c, b, e, op, v, p) => {
      const value = c.gameDataOperand(v, p[5], p[6]);
      for (let i = b; i <= e; i++) {
        c122Operate[op](i, value);
      }
    },
    // 4 - Script
    (c, b, e, op, v, p) => {
      const value = c.__s[c._index].func();
      for (let i = b; i <= e; i++) {
        c122Operate[op](i, value);
      }
    },
  ];

  const c111Actor = [
    // 0 - Actor
    (actor, n) => $gameParty.members().contains(actor),
    // 1 - Name
    (actor, n) => actor.name() === n,
    // 2 - Class
    (actor, n) => actor.isClass($dataClasses[n]),
    // 3 - Skill
    (actor, n) => actor.hasSkill(n),
    // 4 - Weapon
    (actor, n) => actor.hasWeapon($dataWeapons[n]),
    // 5 - Armor
    (actor, n) => actor.hasArmor($dataArmors[n]),
    // 6 - State
    (actor, n) => actor.isStateAffected(n),
  ];

  const c111Condition = [
    // 0 - Equal to
    (value1, value2) => value1 === value2,
    // 1 - Greater than or Equal to
    (value1, value2) => value1 >= value2,
    // 2 - Less than or Equal to
    (value1, value2) => value1 <= value2,
    // 3 - Greater than
    (value1, value2) => value1 > value2,
    // 4 - Less than
    (value1, value2) => value1 < value2,
    // 5 - Not Equal to
    (value1, value2) => value1 !== value2,
  ];

  const c111 = [
    // 0 - Switch
    (command, params) => !!$gameSwitches._data[params[1]] === (params[2] === 0),
    // 1 - Variable
    (command, params) => {
      const value1 = $gameVariables._data[params[1]] || 0;
      let value2;
      if (params[2] === 0) {
        value2 = params[3];
      } else {
        value2 = $gameVariables._data[params[3]] || 0;
      }
      return c111Condition[params[4]](value1, value2);
    },
    // 2 - Self Switch
    (command, params) => {
      if (command._eventId > 0) {
        const key = [command._mapId, command._eventId, params[1]];
        return !!$gameSelfSwitches._data[key] === (params[2] === 0);
      }
      return false;
    },
    // 3 - Timer
    (command, params) => {
      if ($gameTimer.isWorking()) {
        if (params[2] === 0) {
          return $gameTimer.seconds() >= params[1];
        } else {
          return $gameTimer.seconds() <= params[1];
        }
      }
      return false;
    },
    // 4 - Actor
    (command, params) => {
      const actor = $gameActors.actor(params[1]);
      if (actor) {
        return c111Actor[params[2]](actor, params[3]);
      }
      return false;
    },
    // 5 - Event
    (command, params) => {
      var enemy = $gameTroop.members()[params[1]];
      if (enemy) {
        switch (params[2]) {
          case 0: // Appeared
            return enemy.isAlive();
          case 1: // State
            return enemy.isStateAffected(params[3]);
        }
      }
      return false;
    },
    // 6 - Character
    (command, params) => {
      const character = command.character(params[1]);
      if (character) {
        return character.direction() === params[2];
      }
      return false;
    },
    // 7 - Gold
    (command, params) => {
      switch (params[2]) {
        case 0: // Greater than or equal to
          result = $gameParty.gold() >= params[1];
          break;
        case 1: // Less than or equal to
          result = $gameParty.gold() <= params[1];
          break;
        case 2: // Less than
          result = $gameParty.gold() < params[1];
          break;
      }
      return result;
    },
    // 8 - Item
    (command, params) => $gameParty.hasItem($dataItems[params[1]]),
    // 9 - Weapon
    (command, params) => $gameParty.hasItem($dataWeapons[params[1]], params[2]),
    // 10 - Armor
    (command, params) => $gameParty.hasItem($dataArmors[params[1]], params[2]),
    // 11 - Button
    (command, params) => Input.isPressed(params[1]),
    // 12 - Script
    (command, params) => !!command.__s[command._index].func(),
    // 13 - Vehicle
    (command, params) => $gamePlayer.vehicle() === $gameMap.vehicle(params[1]),
  ];

  // ================================================================
  // Faster value set, ignore range safety
  // ================================================================
  Game_Variables.prototype.setValue = function (variableId, value) {
    if (typeof value === 'number') {
      this._data[variableId] = Math.floor(value);
    } else {
      this._data[variableId] = value;
    }
    $gameMap._needsRefresh = true;
  };

  Game_Switches.prototype.setValue = function (switchId, value) {
    this._data[switchId] = value;
    $gameMap._needsRefresh = true;
  };

  Game_SelfSwitches.prototype.setValue = function (key, value) {
    if (value) {
      this._data[key] = true;
    } else {
      delete this._data[key];
    }
    $gameMap._needsRefresh = true;
  };

  // ================================================================
  // Faster iteration & Picture Management
  // ================================================================
  const _DataManager_extractSaveContents = DataManager.extractSaveContents;
  DataManager.extractSaveContents = function () {
    _DataManager_extractSaveContents.apply(this, arguments);
    for (let i = 0; i < $gameScreen._pictures.length; i++) {
      if ($gameScreen._pictures[i]) {
        RemovingPictures.delete(i - 1);
        ActivePictures.add(i - 1);
      } else {
        if (ActivePictures.delete(i - 1)) {
          RemovingPictures.add(i - 1);
        }
      }
    }
  };

  const _Game_Screen_showPicture = Game_Screen.prototype.showPicture;
  Game_Screen.prototype.showPicture = function (pictureId) {
    _Game_Screen_showPicture.apply(this, arguments);
    const index = pictureId - 1;
    RemovingPictures.delete(index);
    ActivePictures.add(index);
  };

  const _Game_Screen_erasePicture = Game_Screen.prototype.erasePicture;
  Game_Screen.prototype.erasePicture = function (pictureId) {
    _Game_Screen_erasePicture.apply(this, arguments);
    const index = pictureId - 1;
    ActivePictures.delete(index);
    RemovingPictures.add(index);

    // reset interp for erased pictures
    const unsortedPictures = SceneManager._scene && SceneManager._scene._spriteset && SceneManager._scene._spriteset.__unsortedPictures;
    if (unsortedPictures) {
      unsortedPictures[index]._ilpx = null;
      unsortedPictures[index]._ipx = null;
    }
  };

  const _Game_Screen_clearPictures = Game_Screen.prototype.clearPictures;
  Game_Screen.prototype.clearPictures = function () {
    _Game_Screen_clearPictures.apply(this, arguments);
    for (const pictureId of ActivePictures) {
      RemovingPictures.add(pictureId);
    }
    ActivePictures.clear();
  };

  Game_Screen.prototype.updatePictures = function () {
    for (const id of ActivePictures) {
      this._pictures[id + 1].update();
    }
  };

  Game_Map.prototype.updateEvents = function () {
    for (const event of this._events) {
      if (event) event.update();
    }

    for (const event of this._commonEvents) {
      event.update();
    }
  };

  const _Spriteset_Base_createPictures = Spriteset_Base.prototype.createPictures;
  Spriteset_Base.prototype.createPictures = function () {
    _Spriteset_Base_createPictures.apply(this, arguments);
    this.__unsortedPictures = [];
    for (const picture of this._pictureContainer.children) {
      this.__unsortedPictures.push(picture);
    }
    this.__unsortedPictures.sort((a, b) => a._pictureId - b._pictureId);
  };

  Spriteset_Map.prototype.update = function () {
    for (const child of this.children) {
      if (child && child.update && child != this._pictureContainer) {
        child.update();
      }
    }
    const pictures = this.__unsortedPictures;
    for (const id of ActivePictures) {
      if (pictures[id] && pictures[id].update) pictures[id].update();
    }
    for (const id of RemovingPictures) {
      if (pictures[id] && pictures[id].update) pictures[id].update();
    }

    RemovingPictures.clear();

    this.updateScreenSprites();
    this.updateToneChanger();
    this.updatePosition();
    this.updateTileset();
    this.updateParallax();
    this.updateTilemap();
    this.updateShadow();
    this.updateWeather();
  };

  Sprite.prototype.update = function () {
    for (const child of this.children) {
      if (child && child.update) {
        child.update();
      }
    }
  };

  Tilemap.prototype.update = function () {
    this.animationCount++;
    this.animationFrame = Math.floor(this.animationCount / 30);
    for (const child of this.children) {
      if (child && child.update) {
        child.update();
      }
    }
    for (const bitmap of this.bitmaps) {
      if (bitmap) {
        bitmap.touch();
      }
    }
  };

  TilingSprite.prototype.update = function () {
    for (const child of this.children) {
      if (child && child.update) {
        child.update();
      }
    }
  };

  Window.prototype.update = function () {
    if (this.active) {
      this._animationCount++;
    }
    for (const child of this.children) {
      if (child && child.update) {
        child.update();
      }
    }
  };

  WindowLayer.prototype.update = function () {
    for (const child of this.children) {
      if (child && child.update) {
        child.update();
      }
    }
  };

  Weather.prototype._updateAllSprites = function () {
    var maxSprites = Math.floor(this.power * 10);
    while (this._sprites.length < maxSprites) {
      this._addSprite();
    }
    while (this._sprites.length > maxSprites) {
      this._removeSprite();
    }
    for (const sprite of this._sprites) {
      this._updateSprite(sprite);
      sprite.x = sprite.ax - this.origin.x;
      sprite.y = sprite.ay - this.origin.y;
    }
  };

  Scene_Base.prototype.updateChildren = function () {
    for (const child of this.children) {
      if (child && child.update) {
        child.update();
      }
    }
  };

  Scene_ItemBase.prototype.applyItem = function () {
    var action = new Game_Action(this.user());
    action.setItemObject(this.item());
    var repeats = action.numRepeats();
    for (const target of this.itemTargetActors()) {
      for (var i = 0; i < repeats; i++) {
        action.apply(target);
      }
    }
    action.applyGlobal();
  };

  Sprite_Animation.prototype.updateFrame = function () {
    if (this._duration > 0) {
      var frameIndex = this.currentFrameIndex();
      this.updateAllCellSprites(this._animation.frames[frameIndex]);
      for (const timing of this._animation.timings) {
        if (timing.frame === frameIndex) {
          this.processTimingData(timing);
        }
      }
    }
  };

  Spriteset_Map.prototype.createCharacters = function () {
    this._characterSprites = [];
    var events = $gameMap.events();
    for (var i = 0; i < events.length; i++) {
      var event = events[i];
      this._characterSprites.push(new Sprite_Character(event));
    }
    var vehicles = $gameMap.vehicles();
    for (var i = 0; i < vehicles.length; i++) {
      var vehicle = vehicles[i];
      this._characterSprites.push(new Sprite_Character(vehicle));
    }
    var followers = $gamePlayer.followers()._data;
    for (var i = followers.length - 1; i >= 0; i--) {
      var follower = followers[i];
      this._characterSprites.push(new Sprite_Character(follower));
    }
    this._characterSprites.push(new Sprite_Character($gamePlayer));
    for (var i = 0; i < this._characterSprites.length; i++) {
      this._tilemap.addChild(this._characterSprites[i]);
    }
  };

  // ================================================================
  // Cache some hot path
  // ================================================================
  const _Utils_isMobileDevice = Utils.isMobileDevice;
  let isMobileDevice = null;
  Utils.isMobileDevice = function () {
    if (isMobileDevice == null) {
      isMobileDevice = _Utils_isMobileDevice.apply(this, arguments);
    }
    return isMobileDevice;
  };

  // ================================================================
  // File system - Case sensitivity handler
  // ================================================================
  let _directories = null;
  let _fs = null;
  let _path = null;
  if (typeof nw != 'undefined' && nw.require) {
    _fs = nw.require('fs');
    _path = nw.require('path');
    _directories = new Map();
  }

  const transformPath = path => {
    // only transform if we are in nw.js
    if (!_fs || !_path || !_directories) return path;

    const dirname = _path.dirname(path);
    const basename = _path.basename(path);

    if (!_directories.has(dirname)) {
      console.log(`Scanning ${dirname}`);
      const www = _path.dirname(nw.App.manifest.main.replace(/^file:\/\//, ''));
      const files = _fs.readdirSync(_path.resolve(nw.App.startPath, www, dirname));
      const fileMap = {};
      for (const file of files) {
        fileMap[file.toLowerCase()] = file;
      }
      _directories.set(dirname, fileMap);
    }

    const files = _directories.get(dirname);
    const found = files[basename.toLowerCase()];
    if (found) {
      if (found != basename) {
        console.log(`Transformed ${basename} to ${found}`);
        return _path.join(dirname, found);
      }
    }
    return path;
  };

  // pre-scan
  transformPath('img/system/null');
  transformPath('img/pictures/null');
  transformPath('img/tilesets/null');
  transformPath('img/characters/null');
  transformPath('img/parallaxes/null');
  transformPath('audio/bgm/null');
  transformPath('audio/bgs/null');
  transformPath('audio/me/null');
  transformPath('audio/se/null');

  // ================================================================
  // Decryption Worker - Threaded decryption
  // ================================================================
  const WorkerCode = () => {
    const _headerlength = 16;
    const SIGNATURE = '5250474d56000000';
    const VER = '000301';
    const REMAIN = '0000000000';

    const cutArrayHeader = (arrayBuffer, length) => {
      return arrayBuffer.slice(length);
    };

    const _readFourCharacters = (array, index) => {
      var string = '';
      for (var i = 0; i < 4; i++) {
        string += String.fromCharCode(array[index + i]);
      }
      return string;
    };

    const _readLittleEndian = (array, index) => {
      return (
        array[index + 3] * 0x1000000 +
        array[index + 2] * 0x10000 +
        array[index + 1] * 0x100 +
        array[index + 0]
      );
    };

    const _readBigEndian = (array, index) => {
      return (
        array[index + 0] * 0x1000000 +
        array[index + 1] * 0x10000 +
        array[index + 2] * 0x100 +
        array[index + 3]
      );
    };

    const _readMetaData = (array, index, size, info) => {
      for (var i = index; i < index + size - 10; i++) {
        if (_readFourCharacters(array, i) === 'LOOP') {
          var text = '';
          while (array[i] > 0) {
            text += String.fromCharCode(array[i++]);
          }
          if (text.match(/LOOPSTART=([0-9]+)/)) {
            info._loopStart = parseInt(RegExp.$1);
          }
          if (text.match(/LOOPLENGTH=([0-9]+)/)) {
            info._loopLength = parseInt(RegExp.$1);
          }
          if (text == 'LOOPSTART' || text == 'LOOPLENGTH') {
            var text2 = '';
            i += 16;
            while (array[i] > 0) {
              text2 += String.fromCharCode(array[i++]);
            }
            if (text == 'LOOPSTART') {
              info._loopStart = parseInt(text2);
            } else {
              info._loopLength = parseInt(text2);
            }
          }
        }
      }
    };

    const _readOgg = (array, info) => {
      var index = 0;
      while (index < array.length) {
        if (_readFourCharacters(array, index) === 'OggS') {
          index += 26;
          var vorbisHeaderFound = false;
          var numSegments = array[index++];
          var segments = [];
          for (var i = 0; i < numSegments; i++) {
            segments.push(array[index++]);
          }
          for (i = 0; i < numSegments; i++) {
            if (_readFourCharacters(array, index + 1) === 'vorb') {
              var headerType = array[index];
              if (headerType === 1) {
                info._sampleRate = _readLittleEndian(array, index + 12);
              } else if (headerType === 3) {
                _readMetaData(array, index, segments[i], info);
              }
              vorbisHeaderFound = true;
            }
            index += segments[i];
          }
          if (!vorbisHeaderFound) {
            break;
          }
        } else {
          break;
        }
      }
    };

    const _readMp4 = (array, info) => {
      if (_readFourCharacters(array, 4) === 'ftyp') {
        var index = 0;
        while (index < array.length) {
          var size = _readBigEndian(array, index);
          var name = _readFourCharacters(array, index + 4);
          if (name === 'moov') {
            index += 8;
          } else {
            if (name === 'mvhd') {
              info._sampleRate = _readBigEndian(array, index + 20);
            }
            if (name === 'udta' || name === 'meta') {
              _readMetaData(array, index, size, info);
            }
            index += size;
            if (size <= 1) {
              break;
            }
          }
        }
      }
    };

    const decryptArrayBuffer = (arrayBuffer, encryptionKey) => {
      if (!arrayBuffer) return null;

      const key = encryptionKey.split(/(.{2})/).filter(Boolean);
      var header = new Uint8Array(arrayBuffer, 0, _headerlength);

      var i;
      var ref = SIGNATURE + VER + REMAIN;
      var refBytes = new Uint8Array(16);
      for (i = 0; i < _headerlength; i++) {
        refBytes[i] = parseInt('0x' + ref.substr(i * 2, 2), 16);
      }
      for (i = 0; i < _headerlength; i++) {
        if (header[i] !== refBytes[i]) {
          throw new Error('Header is wrong');
        }
      }

      arrayBuffer = cutArrayHeader(arrayBuffer, _headerlength);
      var view = new DataView(arrayBuffer);

      if (arrayBuffer) {
        var byteArray = new Uint8Array(arrayBuffer);
        for (i = 0; i < _headerlength; i++) {
          byteArray[i] = byteArray[i] ^ parseInt(key[i], 16);
          view.setUint8(i, byteArray[i]);
        }
      }

      return arrayBuffer;
    };

    onmessage = e => {
      const data = e.data;
      if (data.mode == 0) {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', data.url);
        xhr.responseType = 'arraybuffer';
        xhr.send();
        xhr.addEventListener('load', () => {
          if (xhr.status < 400) {
            const workerResult = {
              id: data.id,
              arrayBuffer: decryptArrayBuffer(xhr.response, data.key),
            };
            postMessage(workerResult);
          } else {
            postMessage({ id: data.id, error: true });
          }
        });
        xhr.addEventListener('error', info => {
          postMessage({ id: data.id, error: true });
        });
      }
      if (data.mode == 1) {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', data.url);
        xhr.responseType = 'arraybuffer';
        xhr.send();
        xhr.addEventListener('load', () => {
          if (xhr.status < 400) {
            const decryptedAudioBuffer = decryptArrayBuffer(xhr.response, data.key);
            const info = {};
            const audioBufferView = new Uint8Array(decryptedAudioBuffer);
            _readOgg(audioBufferView, info);
            _readMp4(audioBufferView, info);

            const workerResult = {
              id: data.id,
              arrayBuffer: decryptedAudioBuffer,
              info: info,
            };
            postMessage(workerResult);
          } else {
            postMessage({ id: data.id, error: true });
          }
        });
        xhr.addEventListener('error', info => {
          postMessage({ id: data.id, error: true });
        });
      }
    };
  };

  const DecryptionWorker = new Worker(
    URL.createObjectURL(
      new Blob([`(${WorkerCode.toString()})()`], {
        type: 'application/javascript',
      })
    )
  );

  DecryptionWorker.onmessage = e => {
    const data = e.data;
    const callback = Callbacks.get(data.id);
    if (callback) {
      callback(data);
      Callbacks.delete(data.id);
    }
  };

  let _decryptionWorkId = 0;
  const Callbacks = new Map();
  const QueueDecryptionWorker = (mode, url, key, callback) => {
    const id = _decryptionWorkId++;
    Callbacks.set(id, callback);
    DecryptionWorker.postMessage({ mode, id, url, key });
  };

  Decrypter.decryptImg = function (url, bitmap) {
    url = this.extToEncryptExt(url);
    url = transformPath(url);

    QueueDecryptionWorker(0, new URL(url, location.href).href, $dataSystem.encryptionKey, data => {
      if (data.error) {
        if (bitmap._loader) {
          bitmap._loader();
        } else {
          bitmap._onError();
        }
        return;
      }

      bitmap._image.src = Decrypter.createBlobUrl(data.arrayBuffer);
      bitmap._image.addEventListener(
        'load',
        (bitmap._loadListener = Bitmap.prototype._onLoad.bind(bitmap))
      );
      bitmap._image.addEventListener(
        'error',
        (bitmap._errorListener = bitmap._loader || Bitmap.prototype._onError.bind(bitmap))
      );
    });
  };

  // ================================================================
  // Audio Cache - Remove audio decryption overhead
  // ================================================================
  const audioCache = new Map();

  function copy(src) {
    var dst = new ArrayBuffer(src.byteLength);
    new Uint8Array(dst).set(new Uint8Array(src));
    return dst;
  }

  const _WebAudio_load = WebAudio.prototype._load;
  WebAudio.prototype._load = function (url) {
    // fallback to original method if not encrypted
    if (!Decrypter.hasEncryptedAudio) return _WebAudio_load.call(this, url);

    if (WebAudio._context) {
      const cachedAudio = audioCache.get(url);

      if (!cachedAudio) {
        if (Decrypter.hasEncryptedAudio) url = Decrypter.extToEncryptExt(url);
        url = transformPath(url);

        QueueDecryptionWorker(
          1,
          new URL(url, location.href).href,
          $dataSystem.encryptionKey,
          data => {
            if (data.error) {
              if (this._loader) {
                this._loader();
              } else {
                this._hasError = true;
              }
              return;
            }
            audioCache.set(this._url, {
              arrayBuffer: data.arrayBuffer,
              info: data.info,
              aliveFrame: updateCount,
            });
            this.__processAudio(data);
          }
        );
      } else {
        cachedAudio.aliveFrame = updateCount;
        this.__processAudio(cachedAudio);
      }
    }
  };

  WebAudio.prototype.__processAudio = function (data) {
    for (const key in data.info) {
      this[key] = data.info[key];
    }

    WebAudio._context.decodeAudioData(
      copy(data.arrayBuffer),
      function (buffer) {
        this._buffer = buffer;
        this._totalTime = buffer.duration;
        if (this._loopLength > 0 && this._sampleRate > 0) {
          this._loopStart /= this._sampleRate;
          this._loopLength /= this._sampleRate;
        } else {
          this._loopStart = 0;
          this._loopLength = this._totalTime;
        }
        this._onLoad();
      }.bind(this)
    );
  };

  // ================================================================
  // Tint Caching
  // ================================================================
  const COLOR_KEY_SEP = ',';
  const getColorKey = function (tone, color, x, y, w, h) {
    return (
      '' +
      tone[0] +
      COLOR_KEY_SEP +
      tone[1] +
      COLOR_KEY_SEP +
      tone[2] +
      COLOR_KEY_SEP +
      tone[3] +
      COLOR_KEY_SEP +
      color[0] +
      COLOR_KEY_SEP +
      color[1] +
      COLOR_KEY_SEP +
      color[2] +
      COLOR_KEY_SEP +
      color[3] +
      COLOR_KEY_SEP +
      x +
      COLOR_KEY_SEP +
      y +
      COLOR_KEY_SEP +
      w +
      COLOR_KEY_SEP +
      h
    );
  };

  Bitmap.prototype.__getOrCreateTintCache = function (tone, color, x, y, w, h) {
    const key = getColorKey(tone, color, x, y, w, h);
    let cache = this.__tintCache && this.__tintCache.get(key);
    if (cache) {
      return cache;
    }
    cache = {};
    cache._canvas = document.createElement('canvas');
    cache._context = cache._canvas.getContext('2d');
    cache._canvas.width = w;
    cache._canvas.height = h;
    cache._tintTexture = new PIXI.BaseTexture(cache._canvas);
    cache._tintTexture.width = w;
    cache._tintTexture.height = h;
    cache._tintTexture.scaleMode = this.baseTexture.scaleMode;

    const context = cache._context;
    context.globalCompositeOperation = 'copy';
    context.drawImage(this.canvas, x, y, w, h, 0, 0, w, h);

    if (Graphics.canUseSaturationBlend()) {
      var gray = Math.max(0, tone[3]);
      context.globalCompositeOperation = 'saturation';
      context.fillStyle = 'rgba(255,255,255,' + gray / 255 + ')';
      context.fillRect(0, 0, w, h);
    }

    var r1 = Math.max(0, tone[0]);
    var g1 = Math.max(0, tone[1]);
    var b1 = Math.max(0, tone[2]);
    context.globalCompositeOperation = 'lighter';
    context.fillStyle = Utils.rgbToCssColor(r1, g1, b1);
    context.fillRect(0, 0, w, h);

    if (Graphics.canUseDifferenceBlend()) {
      context.globalCompositeOperation = 'difference';
      context.fillStyle = 'white';
      context.fillRect(0, 0, w, h);

      var r2 = Math.max(0, -tone[0]);
      var g2 = Math.max(0, -tone[1]);
      var b2 = Math.max(0, -tone[2]);
      context.globalCompositeOperation = 'lighter';
      context.fillStyle = Utils.rgbToCssColor(r2, g2, b2);
      context.fillRect(0, 0, w, h);

      context.globalCompositeOperation = 'difference';
      context.fillStyle = 'white';
      context.fillRect(0, 0, w, h);
    }

    var r3 = Math.max(0, color[0]);
    var g3 = Math.max(0, color[1]);
    var b3 = Math.max(0, color[2]);
    var a3 = Math.max(0, color[3]);
    context.globalCompositeOperation = 'source-atop';
    context.fillStyle = Utils.rgbToCssColor(r3, g3, b3);
    context.globalAlpha = a3 / 255;
    context.fillRect(0, 0, w, h);

    context.globalCompositeOperation = 'destination-in';
    context.globalAlpha = 1;
    context.drawImage(this.canvas, x, y, w, h, 0, 0, w, h);
    cache._tintTexture.update();

    if (!this.__tintCache) {
      this.__tintCache = new Map();
    }
    console.log(`Tint cache created: ${this._url}(${key})`);
    this.__tintCache.set(key, cache);
    return cache;
  };

  Sprite.prototype._refresh = function () {
    var frameX = Math.floor(this._frame.x);
    var frameY = Math.floor(this._frame.y);
    var frameW = Math.floor(this._frame.width);
    var frameH = Math.floor(this._frame.height);
    var bitmapW = this._bitmap ? this._bitmap.width : 0;
    var bitmapH = this._bitmap ? this._bitmap.height : 0;
    var realX = frameX.clamp(0, bitmapW);
    var realY = frameY.clamp(0, bitmapH);
    var realW = (frameW - realX + frameX).clamp(0, bitmapW - realX);
    var realH = (frameH - realY + frameY).clamp(0, bitmapH - realY);

    this._realFrame.x = realX;
    this._realFrame.y = realY;
    this._realFrame.width = realW;
    this._realFrame.height = realH;
    this.pivot.x = frameX - realX;
    this.pivot.y = frameY - realY;

    if (realW > 0 && realH > 0) {
      if (this._needsTint()) {
        if (this._bitmap && this._bitmap.__cacheTint) {
          const cache = this._bitmap.__getOrCreateTintCache(
            this._colorTone,
            this._blendColor,
            realX,
            realY,
            realW,
            realH
          );
          this.texture.baseTexture = cache._tintTexture;
          this.texture.frame = new Rectangle(0, 0, realW, realH);
        } else {
          this._createTinter(realW, realH);
          this._executeTint(realX, realY, realW, realH);
          this._tintTexture.update();
          this.texture.baseTexture = this._tintTexture;
          this.texture.frame = new Rectangle(0, 0, realW, realH);
        }
      } else {
        if (this._bitmap) {
          this.texture.baseTexture = this._bitmap.baseTexture;
        }
        this.texture.frame = this._realFrame;
      }
    } else if (this._bitmap) {
      this.texture.frame = Rectangle.emptyRectangle;
    } else {
      this.texture.baseTexture.width = Math.max(
        this.texture.baseTexture.width,
        this._frame.x + this._frame.width
      );
      this.texture.baseTexture.height = Math.max(
        this.texture.baseTexture.height,
        this._frame.y + this._frame.height
      );
      this.texture.frame = this._frame;
    }
    this.texture._updateID++;
  };

  // ================================================================
  // Allow read frequently so tinting and reading back can be faster
  // ================================================================
  const _HTMLCanvasElement_getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function __ll(type, options) {
    const opt = options || {};
    opt.willReadFrequently = true;
    return _HTMLCanvasElement_getContext.call(this, type, opt);
  };

  // ================================================================
  // Remove caches when saving
  // ================================================================
  const _DataManager_makeSaveContents = DataManager.makeSaveContents;
  const deleteInterpreterCache = interpreter => {
    delete interpreter.__s;
    delete interpreter.__j;
    if (interpreter._childInterpreter) {
      deleteInterpreterCache(interpreter._childInterpreter);
    }
  };

  DataManager.makeSaveContents = function () {
    if ($gameMap._interpreter) {
      deleteInterpreterCache($gameMap._interpreter);
    }

    if ($gameMap._events) {
      for (const event of $gameMap._events) {
        if (event && event._interpreter) {
          deleteInterpreterCache(event._interpreter);
        }
      }
    }

    if ($gameMap._commonEvents) {
      for (const commonEvent of $gameMap._commonEvents) {
        if (commonEvent && commonEvent._interpreter) {
          deleteInterpreterCache(commonEvent._interpreter);
        }
      }
    }

    return _DataManager_makeSaveContents.call(this);
  };
})();
