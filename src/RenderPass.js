const THREE = require("three");
const { vertexShader } = require("./assets");
const { ShaderPassInput } = require("./ShaderPassInput");

/**
 * shadertoy types:
 * - texture
 * - volume
 * - keyboard
 * - cubemap
 * - webcam
 * - video
 * - music
 * - musicstream
 * - mic
 * - buffer
 */
class PassInterface {
    constructor(meta, type) {
        this.id = meta.id;
        this.type = type;
        this.meta = meta;
    }

    equals(other) {
        return this.id == other.id;
    }
}

class RenderPass extends ShaderPassInput {
    constructor(definition) {
        super(definition.type, "renderpass");

        this._inputs = {};
        this._outputs = [];
        this._channelInputs = {};

        for(let input of definition.inputs) {
            let type = null;

            switch (input.ctype) {
                case "webcam": // webcam image is just turned into a video texture for now
                case "video":
                    type = "video";
                    break;
                case "texture":
                    type = "texture";
                    break;
                case "volume":
                    type = "volume";
                    break;
                case "cubemap":
                    type = "cubemap";
                    break;
                case "music":
                case "musicstream":
                case "mic":
                    type = "audio";
                    break;
                case "buffer":
                    type = "buffer";
                    break;
                case "keyboard":
                default:
                    continue; // not supported
            }

            this._inputs[input.id] = new PassInterface(input, type);
        }

        for(let output of definition.outputs) {
            this._outputs.push(new PassInterface(output, output.type));
        }

        this._code = definition.code;

        this._camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 2);
        this._camera.position.set(0, 0, 1);

        this._frame = 0;

        const uniforms = {
            iResolution: { type: "vec3", value: new THREE.Vector3(512, 512, 1) },
            iTime: { type: "float", value: 0 },
            iTimeDelta: { type: "float", value: 0 },
            iFrame: { type: "int", value: this._frame },
            iChannelTime: { type: "float", value: [ 0, 0, 0, 0] },
            iChannelResolution: { type: "vec3", value: [ new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3() ]},
            iMouse: { type: "vec4", value: new THREE.Vector4() },
            iDate: { type: "vec4", value: new THREE.Vector4() },
            iSampleRate: { type: "float", value: 0 },
        };

        let uniformString = "";

        const channelOccupied = new Array(4).fill(false);

        for (let inputId in this._inputs) {
            let gl_type = null;

            switch (this._inputs[inputId].type) {
                case "texture":
                case "audio":
                case "buffer":
                case "video":
                    gl_type = "sampler2D";
                    break;
                case "volume":
                    gl_type = "mediump sampler3D";
                    break;
                case "cubemap":
                    gl_type = "samplerCube";
                    break;
            }

            channelOccupied[this._inputs[inputId].meta.channel] = true;
            uniforms[`iChannel${this._inputs[inputId].meta.channel}`] = { type: gl_type, value: null };
            uniformString += `uniform ${gl_type} iChannel${this._inputs[inputId].meta.channel}; `;
        }

        // fill the rest of the channels with dummy sampler2D uniforms
        for (let i in channelOccupied) {
            if (!channelOccupied[i]) {
                uniforms[`iChannel${i}`] = { type: "sampler2D", value: null };
                uniformString += `uniform sampler2D iChannel${i}; `;
            }
        }

        this._material = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader: `
                varying vec2 _three_shadertoy_vertexUV;
                uniform float opacity;

                uniform vec3      iResolution;           // viewport resolution (in pixels)
                uniform float     iTime;                 // shader playback time (in seconds)
                uniform float     iTimeDelta;            // render time (in seconds)
                uniform int       iFrame;                // shader playback frame
                uniform float     iChannelTime[4];       // channel playback time (in seconds)
                uniform vec3      iChannelResolution[4]; // channel resolution (in pixels)
                uniform vec4      iMouse;                // mouse pixel coords. xy: current (if MLB down), zw: click
                //uniform samplerXX iChannel0..3;          // input channel. XX = 2D/Cube
                uniform vec4      iDate;                 // (year, month, day, time in seconds)
                uniform float     iSampleRate;           // sound sample rate (i.e., 44100)
                ${uniformString}

                void mainImage(out vec4 fragColor, in vec2 fragCoord);

                void main() {
                    vec2 fragCoord = _three_shadertoy_vertexUV * iResolution.xy;

                    mainImage(gl_FragColor, fragCoord);
                }
            `, // preliminary header of the shader
            uniforms,
        });
        this._shaderMaterialFinished = false;

        this._scene = new THREE.Mesh(
            new THREE.PlaneGeometry(2, 2),
            this._material
        );

        this._renderTarget = new THREE.WebGLRenderTarget(512, 512, {
			minFilter: THREE.LinearFilter,
			magFilter: THREE.LinearFilter,
			format: THREE.RGBAFormat
		});
        this._renderTarget.texture.name = "RenderPass";

        if (this.type == "buffer") { // create double buffered output
            this._doubleBufferScene = new THREE.Mesh(
                new THREE.PlaneGeometry(2, 2),
                new THREE.MeshBasicMaterial({ map: this._renderTarget.texture })
            );
            this._doubleBufferRenderTarget = new THREE.WebGLRenderTarget(512, 512, {
                minFilter: THREE.LinearFilter,
                magFilter: THREE.LinearFilter,
                format: THREE.RGBAFormat
            });
            this._doubleBufferRenderTarget.texture.name = "DoubleBufferRenderPass";
        }
    }

    get outputTexture() {
        if (this._doubleBufferRenderTarget) {
            return this._doubleBufferRenderTarget.texture;
        } else {
            return this._renderTarget.texture;
        }
    }

    get outputSize() {
        return new THREE.Vector3(this._renderTarget.width, this._renderTarget.height, 1);
    }

    get outputTime() {
        return this._material.uniforms.iTime.value;
    }

    get inputs() {
        return Object.freeze(this._inputs);
    }

    get outputs() {
        return Object.freeze(this._outputs);
    }

    dispose() {
        this._renderTarget.dispose();
        if (this._doubleBufferRenderTarget) {
            this._doubleBufferRenderTarget.dispose();
        }
    }

    resize(width, height) {
        this._renderTarget.setSize(width, height);
        if (this._doubleBufferRenderTarget) {
            this._doubleBufferRenderTarget.setSize(width, height);
        }
        this._material.uniforms.iResolution.value = new THREE.Vector3(width, height, 1);
    }

    addCommonShader(code) {
        this._material.fragmentShader += code + "\n";
    }

    /**
     * 
     * @param {THREE.WebGLRenderer} renderer 
     */
    render(renderer) {
        // assume that the common code is added by this point and finish the shader on the first render attempt
        if (!this._shaderMaterialFinished) {
            this._material.fragmentShader += this._code;
            this._shaderMaterialFinished = true;
        }

        this._material.uniforms.iFrame.value = this._frame++;

        // console.log(this._frame);

        renderer.setRenderTarget(this._renderTarget);
        // renderer.clear();
        renderer.render(this._scene, this._camera);

        if (this._doubleBufferRenderTarget) {
            renderer.setRenderTarget(this._doubleBufferRenderTarget);
            renderer.render(this._doubleBufferScene, this._camera);
        }
    }

    update(values) {
        this._material.uniforms.iTimeDelta.value = values.delta;
        this._material.uniforms.iTime.value = values.time;

        const empty = new THREE.Vector3();
        for (let i = 0; i < 4; i++) {
            this._material.uniforms.iChannelTime.value[i] = values.time;
            this._material.uniforms.iChannelResolution.value[i] = (i in this._channelInputs) ? this._channelInputs[i].outputSize : empty;
        }

        this._material.uniforms.iMouse.value.set(values.mouseX, values.mouseY, values.mouseL ? 1 : 0, values.mouseR ? 1 : 0);
        this._material.uniforms.iDate.value.set(values.date.getFullYear(), values.date.getMonth() + 1, values.date.getDate(), values.date.getHours() * 60*60 + values.date.getMinutes() * 60 + values.date.getSeconds());
    }

    connectInputChannel(channel, input) {
        this._material.uniforms[`iChannel${channel}`].value = input.outputTexture;
        this._channelInputs[channel] = input;
    }
}

module.exports = { RenderPass };