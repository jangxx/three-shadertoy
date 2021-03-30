class ShaderPassInput {
    get outputTexture() { throw new Error("Not implemented"); }

    get outputSize() { throw new Error("Not implemented"); }

    get outputTime() { throw new Error("Not implemented"); }

    update() {
        throw new Error("Not implemented");
    }
}

module.exports = { ShaderPassInput };