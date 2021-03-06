const THREE = require("three");
const { ShaderPassInput } = require("./ShaderPassInput");
const { notSupportedImage } = require("./assets");

class CubemapInput extends ShaderPassInput {
    constructor(ctype, url, filter, wrap, yflip) {
        super("cubemap", ctype);

        this.wantURL = url;

        this._texture = new THREE.CubeTextureLoader().load(new Array(6).fill(notSupportedImage));
        this._texture.wrapS = wrap;
        this._texture.wrapT = wrap;
        this._texture.minFilter = filter;
        this._texture.flipY = yflip;
    }

    get outputTexture() {
        return this._texture;
    }

    get outputSize() {
        return new THREE.Vector3(this._texture.images[0].width, this._texture.images[0].height, 1);
    }

    get outputTime() {
        return 0;
    }

    update() {}

    updateData(urls) {
        const loader = new THREE.ImageLoader();
        
        if (!(urls instanceof Array) || urls.length != 6) return Promise.reject(new Error("Invalid urls parameter, must be an Array of 6 URLs"));

        return Promise.all(urls.map(url => loader.loadAsync(url))).then(images => {
            this._texture.images = images;
            this._texture.needsUpdate = true;
        });
    }
}

module.exports = { CubemapInput };