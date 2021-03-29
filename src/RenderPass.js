const THREE = require("three");
const { vertexShader } = require("./shaders");

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

class RenderPass {
    constructor(definition) {
        this._inputs = {};
        this._outputs = [];

        for(let input of definition.inputs) {
            let type = null;

            switch (input.ctype) {
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
                case "webcam":
                default:
                    continue; // not supported
            }

            this._inputs[input.id] = new PassInterface(input, type);
        }

        for(let output of definition.outputs) {
            this._outputs.push(new PassInterface(output, output.type));
        }

        this._code = definition.code;
        this._type = definition.type;

        this._scene = new THREE.Scene();
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

        for (let inputId in this._inputs) {
            let gl_type = null;

            switch (this._inputs[inputId].type) {
                case "texture":
                case "audio":
                case "buffer":
                    gl_type = "sampler2D";
                    break;
                case "volume":
                    gl_type = "sampler3D";
                    break;
                case "cubemap":
                    gl_type = "samplerCube";
                    break;
            }

            uniforms[`iChannel${this._inputs[inputId].meta.channel}`] = { type: gl_type, value: null };
            uniformString += `uniform ${gl_type} iChannel${this._inputs[inputId].meta.channel}; `;
        }

        this._material = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader: `
                varying vec2 _three_shadertoy_vertexUV;

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
            ` + this._code,
            uniforms,
        });

        this._scene.add(new THREE.Mesh(
            new THREE.PlaneGeometry(2, 2),
            this._material
        ));

        this._renderTarget = new THREE.WebGLRenderTarget(512, 512, {
			minFilter: THREE.LinearFilter,
			magFilter: THREE.LinearFilter,
			format: THREE.RGBAFormat
		});
        this._renderTarget.texture.name = "RenderPass";

        if (this.type == "buffer") { // create double buffered output
            this._doubleBufferScene = new THREE.Scene();
            
            this._doubleBufferScene.add(new THREE.Mesh(
                new THREE.PlaneGeometry(2, 2),
                new THREE.MeshBasicMaterial({ map: this._renderTarget.texture })
            ));
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

    get type() {
        return this._type;
    }

    get inputs() {
        return Object.freeze(this._inputs);
    }

    get outputs() {
        return Object.freeze(this._outputs);
    }

    dispose() {
        this._renderTarget.dispose();
    }

    resize(width, height) {
        this._renderTarget.setSize(width, height);
        if (this._doubleBufferRenderTarget) {
            this._doubleBufferRenderTarget.setSize(width, height);
        }
        this._material.uniforms.iResolution.value = new THREE.Vector3(width, height, 1);
    }

    /**
     * 
     * @param {THREE.WebGLRenderer} renderer 
     */
    render(renderer) {
        
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
        this._material.uniforms.iChannelTime.value[0] = values.time;
        this._material.uniforms.iChannelTime.value[1] = values.time;
        this._material.uniforms.iChannelTime.value[2] = values.time;
        this._material.uniforms.iChannelTime.value[3] = values.time;

        this._material.uniforms.iMouse.value.set(values.mouseX, values.mouseY, values.mouseL ? 1 : 0, values.mouseR ? 1 : 0);
        this._material.uniforms.iDate.value.set(values.date.getFullYear(), values.date.getMonth() + 1, values.date.getDate(), values.date.getHours() * 60*60 + values.date.getMinutes() * 60 + values.date.getSeconds());
    }

    connectInputChannel(channel, texture) {
        this._material.uniforms[`iChannel${channel}`].value = texture;
    }
}

module.exports = { RenderPass };