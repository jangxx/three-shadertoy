const THREE = require("three");
const { ShaderPassInput } = require("./ShaderPassInput");
const { notSupportedImage } = require("./assets");

class TextureInput extends ShaderPassInput {
    constructor(ctype, url, filter, wrap, yflip) {
        super("texture", ctype);

        this.wantURL = url;

        this._texture = new THREE.TextureLoader().load(notSupportedImage);
        this._texture.wrapS = wrap;
        this._texture.wrapT = wrap;
        this._texture.minFilter = filter;
        this._texture.flipY = yflip;

        this._width = 512;
        this._height = 512;
    }

    get outputTexture() {
        return this._texture;
    }

    get outputSize() {
        return new THREE.Vector3(this._width, this._height, 1);
    }

    get outputTime() {
        return 0;
    }

    update() {}

    updateData(url) {
        const loader = new THREE.ImageLoader();
        
        return loader.loadAsync(url).then(image => {
            this._width = image.width;
            this._height = image.height;

            this._texture.image = image;
            this._texture.needsUpdate = true;
        });
    }
}

module.exports = { TextureInput };