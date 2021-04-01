const THREE = require("three");
const { ShaderPassInput } = require("./ShaderPassInput");

class VolumeInput extends ShaderPassInput {
    constructor(ctype, url, filter, wrap) {
        super("volume", ctype);

        this.wantURL = url;

        this._texture = new THREE.DataTexture3D(new Uint8Array(4), 1, 1, 1);
        this._texture.wrapS = wrap;
        this._texture.wrapT = wrap;
        this._texture.wrapR = wrap;
        this._texture.minFilter = filter;
        this._texture.magFilter = filter;

        if (filter == THREE.LinearMipMapLinearFilter) {
            this._texture.minFilter = THREE.LinearFilter;
            this._texture.magFilter = THREE.LinearFilter;
        }
    }

    get outputTexture() {
        return this._texture;
    }

    get outputSize() {
        return new THREE.Vector3(this._texture.image.width, this._texture.image.height, this._texture.image.depth);
    }

    get outputTime() {
        return 0;
    }

    update() {}

    updateData(url) {
        const loader = new THREE.FileLoader();
        loader.setResponseType("arraybuffer");

        return loader.loadAsync(url).then(file => {
            const data = new DataView(file);
            const xRes = data.getUint32(4, true);
            const yRes = data.getUint32(8, true);
            const zRes = data.getUint32(12, true);
            const binNumChannels = data.getUint8(16);
            const binLayout = data.getUint8(17);
            const binFormat = data.getUint16(18, true);

            let format = THREE.RGBAFormat;
            let type = THREE.UnsignedByteType;
            let textureData = new Uint8Array(file, 20);
            let unpackAlignment = 4;

            switch(binNumChannels) {
                case 1:
                    format = THREE.RedFormat;
                    unpackAlignment = 1;
                    break;
                case 2:
                    format = THREE.RGFormat;
                    unpackAlignment = 2;
                    break;
                case 3:
                    format = THREE.RGBFormat;
                    unpackAlignment = 3;
                    break;
                case 4:
                    format = THREE.RGBAFormat;
                    unpackAlignment = 4;
                    break;
            }

            switch(binFormat) {
                case 0:
                    type = THREE.UnsignedByteType;
                    textureData = new Uint8Array(file, 20);
                    break;
                case 10:
                    type = THREE.FloatType;
                    textureData = new Float32Array(file, 20);
                    break;
            }

            this._texture.image.data = textureData;
            this._texture.image.width = xRes;
            this._texture.image.height = yRes;
            this._texture.image.depth = zRes;
            this._texture.format = format;
            this._texture.type = type;
            this._texture.unpackAlignment = unpackAlignment;
            this._texture.needsUpdate = true;
        });
    }
}

module.exports = { VolumeInput };