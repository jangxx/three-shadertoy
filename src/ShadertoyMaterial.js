const THREE = require("three");

const { RenderPass } = require("./RenderPass");
const { AudioInput } = require("./AudioInput");
const { TextureInput } = require("./TextureInput");
const { CubemapInput } = require("./CubemapInput");
const { VolumeInput } = require("./VolumeInput");

class ShadertoyMaterial extends THREE.MeshBasicMaterial {
    constructor(shaderDefinition, opts = {}) {
        super(opts);

        this._info = shaderDefinition.info; // metadata from shadertoy

        this._width = ("width" in opts) ? opts.width : 512;
        this._height = ("height" in opts) ? opts.height : 512;

        this._renderPasses = [];
        this._outputPass = null;

        this._audioInputs = [];
        this._textureInputs = [];
        this._cubemapInputs = [];
        this._volumeInputs = [];
        
        this._clock = new THREE.Clock();
        this._elapsed = 0;

        const outputs = {};
        const inputs = {};
        let commonShaderCode = "";
        // create renderpass objects
        for (let pass_definition of shaderDefinition.renderpass) {
            if (pass_definition.type == "common") {
                commonShaderCode = pass_definition.code;
                continue;
            }

            const pass = new RenderPass(pass_definition);
            pass.resize(this._width, this._height);

            switch (pass.type) {
                case "image":
                    this._outputPass = pass;
                    break;
                case "cubemap":
                    console.error("CubemapA is not supported yet");
                    continue;
                case "buffer":
                    this._renderPasses.push(pass);
                    break;
                default:
                    console.error("Unexpected RenderPass of type", pass.type);
                    break;
            }

            for (let inputId in pass.inputs) {
                if (inputId in inputs) continue;

                inputs[inputId] = pass.inputs[inputId];
            }

            for (let output of pass.outputs) {
                outputs[output.id] = pass;
            }
        }

        console.log(inputs);

        // create output object for all the inputs. they are connected in the next step
        for (let inputId in inputs) {
            if (inputId in outputs) continue; // we have already created that output

            const input = inputs[inputId];

            // console.log(input);

            const filter = { "mipmap": THREE.LinearMipMapLinearFilter, "nearest": THREE.NearestFilter, "linear": THREE.LinearFilter }[input.meta.sampler.filter];
            const wrap = { "repeat": THREE.RepeatWrapping, "clamp": THREE.ClampToEdgeWrapping }[input.meta.sampler.wrap];
            const yflip = input.meta.sampler.vflip == "true";

            switch(input.type) {
                case "volume":
                    outputs[inputId] = new VolumeInput(`https://www.shadertoy.com${input.meta.src}`, filter, wrap);
                    this._volumeInputs.push(outputs[inputId]);
                    break;
                case "cubemap":
                    outputs[inputId] = new CubemapInput(`https://www.shadertoy.com${input.meta.src}`, filter, wrap, yflip);
                    this._cubemapInputs.push(outputs[inputId]);
                    break;
                case "texture":
                    outputs[inputId] = new TextureInput(`https://www.shadertoy.com${input.meta.src}`, filter, wrap, yflip);
                    this._textureInputs.push(outputs[inputId]);
                    break;
                case "audio":
                    outputs[inputId] = new AudioInput(filter, wrap);
                    this._audioInputs.push(outputs[inputId]);
                    break;
                case "buffer":
                    continue; // do nothing, since this will be added further down
            }
        }

        // connect the pass outputs to the inputs
        for (let pass of this._renderPasses.concat([ this._outputPass ])) {
            pass.addCommonShader(commonShaderCode);

            for (let inputId in pass.inputs) {
                const inp = pass.inputs[inputId];

                if (!(inp.id in outputs)) {
                    console.error("No renderpass or input provides a stream with the id", inp.id);
                    continue;
                }

                pass.connectInputChannel(inp.meta.channel, outputs[inp.id]);
            }
        }

        if (this._outputPass === null) {
            throw new Error("Shader definition did not contain an output image");
        }

        this.map = this._outputPass.outputTexture;
    }

    get meta() {
        return Object.freeze(this._info);
    }

    get width() {
        return this._width;
    }

    get height() {
        return this._height;
    }

    get audioInputs() {
        return this._audioInputs;
    }

    get textureInputs() {
        return this._textureInputs;
    }

    get cubemapInputs() {
        return this._cubemapInputs;
    }

    get volumeInputs() {
        return this._volumeInputs;
    }

    resize(width, height) {
        for (let pass of this._renderPasses) {
            pass.resize(width, height);
        }
        this._outputPass.resize(width, height);
    }

    render(renderer) {
        this.needsUpdate = true;

        // render renderpasses first
        for (let pass of this._renderPasses) {
            pass.render(renderer);
        }

        // finally render the output image
        this._outputPass.render(renderer);

        renderer.setRenderTarget(null); // set to canvas again
    }

    update(values = {}) {
        const delta = this._clock.getDelta();
        this._elapsed += delta;

        const updateValues = {
            delta,
            time: this._elapsed,
            mouseX: 0,
            mouseY: 0,
            mouseL: false,
            mouseR: false,
            date: new Date(),
        };

        for (let audioInput of this._audioInputs) {
            audioInput.update(this._elapsed);
        }
        for (let textureInput of this._textureInputs) {
            textureInput.update(this._elapsed);
        }
        for (let cubemapInput of this._cubemapInputs) {
            cubemapInput.update(this._elapsed);
        }
        for (let volumeInput of this._volumeInputs) {
            volumeInput.update(this._elapsed);
        }

        for (let pass of this._renderPasses) {
            pass.update(updateValues);
        }
        this._outputPass.update(updateValues);
    }
}

module.exports = { ShadertoyMaterial };