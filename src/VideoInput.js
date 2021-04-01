const THREE = require("three");
const { ShaderPassInput } = require("./ShaderPassInput");
const { notSupportedImage } = require("./assets");

class VideoInput extends ShaderPassInput {
    constructor(ctype, url, filter, wrap, yflip) {
        super("video", ctype);

        if (ctype == "video") {
            this.wantURL = url;
        } else {
            this.wantURL = null; // webcams do not "want" an url
        }

        this._videoElem = document.createElement("video");
        this._videoElem.loop = true;
        this._videoElem.autoplay = true;
        this._videoElem.muted = true;

        this._videoElem.addEventListener("canplay", evt => {
            evt.currentTarget.play();
        });

        this._texture = new THREE.VideoTexture(this._videoElem);
        this._texture.wrapS = wrap;
        this._texture.wrapT = wrap;
        this._texture.minFilter = filter;
        this._texture.flipY = yflip;
    }

    get outputTexture() {
        return this._texture;
    }

    get outputSize() {
        return new THREE.Vector3(this._videoElem.width, this._videoElem.height, 1);
    }

    get outputTime() {
        return 0;
    }

    update() {}

    updateData(url) {
        this._videoElem.src = url;
        this._videoElem.load();
    }
}

module.exports = { VideoInput };