const THREE = require("three");
const { ShaderPassInput } = require("./ShaderPassInput");
const { notSupportedImage } = require("./assets");

class TextureInput extends ShaderPassInput {
    constructor(url, filter, wrap, yflip) {
        super();

        this.wantURL = url;

        this._texture = new THREE.TextureLoader().load(notSupportedImage);
        this._texture.wrapS = wrap;
        this._texture.wrapT = wrap;
        this._texture.minFilter = filter;
        this._texture.flipY = yflip;
    }

    get outputTexture() {
        return this._texture;
    }

    get outputSize() {
        // return new THREE.Vector2(this._renderTarget.width, this._renderTarget.height);
        throw new Error("not implemented");
    }

    get outputTime() {
        return 0;
    }

    update() {}

    updateData(url) {
        const loader = new THREE.ImageLoader();
        
        return loader.loadAsync(url).then(image => {
            this._texture.image = image;
            this._texture.needsUpdate = true;
        });
    }
}

module.exports = { TextureInput };