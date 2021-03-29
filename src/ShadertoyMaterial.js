const THREE = require("three");

const { RenderPass } = require("./RenderPass");
const { AudioInput } = require("./AudioInput");
const { TextureInput } = require("./TextureInput");

class ShadertoyMaterial extends THREE.MeshBasicMaterial {
    constructor(shaderDefinition, opts = {}) {
        super(opts);

        this._info = shaderDefinition.info; // metadata from shadertoy

        this._width = ("width" in opts) ? opts.width : 512;
        this._height = ("height" in opts) ? opts.height : 512;

        this._renderPasses = [];
        this._outputPass = null;
        this._inputs = {};
        this._clock = new THREE.Clock();
        this._elapsed = 0;

        const outputs = {};
        // create renderpass objects
        for (let pass_definition of shaderDefinition.renderpass) {
            const pass = new RenderPass(pass_definition);
            pass.resize(this._width, this._height);

            switch (pass.type) {
                case "image":
                    this._outputPass = pass;
                    break;
                case "buffer":
                    this._renderPasses.push(pass);
                    break;
                default:
                    console.error("Unexpected RenderPass of type", pass.type);
                    break;
            }

            for (let inputId in pass.inputs) {
                this._inputs[inputId] = pass.inputs;
            }

            for (let output of pass.outputs) {
                outputs[output.id] = pass;
            }
        }

        // TODO: create audioinputs, textureinputs, etc

        console.log(outputs);

        // connect the pass outputs to the inputs
        for (let pass of this._renderPasses.concat([ this._outputPass ])) {
            for (let inputId in pass.inputs) {
                const inp = pass.inputs[inputId];

                if (!(inp.id in outputs)) {
                    console.error("No renderpass or input provides a stream with the id", inp.id);
                    continue;
                }

                pass.connectInputChannel(inp.meta.channel, outputs[inp.id].outputTexture);
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

        for (let pass of this._renderPasses) {
            pass.update(updateValues);
        }
        this._outputPass.update(updateValues);
    }
}

module.exports = { ShadertoyMaterial };