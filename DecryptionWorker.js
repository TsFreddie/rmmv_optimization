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
