const axios = require("axios");
const { ShadertoyMaterial } = require("./ShadertoyMaterial");

class ShadertoyLoader {
    constructor(appkey) {
        this._appkey = appkey;
    }

    load(shaderID, opts = {}) {
        return axios.get(`https://www.shadertoy.com/api/v1/shaders/${shaderID}?key=${this._appkey}`).then(resp => {
            if ("Error" in resp.data) {
                throw new Error(resp.data.Error);
            }

            return new ShadertoyMaterial(resp.data.Shader, opts);
        });
    }
}

module.exports = { ShadertoyLoader };