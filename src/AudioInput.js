const THREE = require("three");
const { ShaderPassInput } = require("./ShaderPassInput");

class AudioInput extends ShaderPassInput {
    constructor(ctype, filter, wrap) {
        super("audio", ctype);

        this._time = 0;

        this._frequencyData = null;
        this._timeDomainData = null;

        this._textureData = new Uint8Array(512 * 2);
        this._dataTexture = new THREE.DataTexture(this._textureData, 512, 2, THREE.RedFormat, THREE.UnsignedByteType);
        this._dataTexture.wrapS = wrap;
        this._dataTexture.wrapT = wrap;
        this._dataTexture.minFilter = filter;
        this._dataTexture.magFilter = filter;
    }

    get outputTexture() {
        return this._dataTexture;
    }

    get outputSize() {
        return new THREE.Vector3(512, 2, 1);
    }

    get outputTime() {
        return this._time;
    }

    update(time) {
        this._time = time;
        this._dataTexture.needsUpdate = true;
    }

    updateData(audioFreqData = null, timeDomainData = null) {
        if (audioFreqData != null) {
            this._frequencyData = audioFreqData;
        }
        if (timeDomainData != null) {
            this._timeDomainData = timeDomainData;
        }

        this._textureData.set(this._frequencyData, 0);
        this._textureData.set(this._timeDomainData, 512);
    }
}

module.exports = { AudioInput };