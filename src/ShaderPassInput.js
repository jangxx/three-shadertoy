class ShaderPassInput {
    constructor(type, ctype) {
        this._type = type;
        this._ctype = ctype;
    }

    get type() {
        return this._type;
    }

    get actualType() {
        return this._ctype;
    }

    get outputTexture() { throw new Error("Not implemented"); }

    get outputSize() { throw new Error("Not implemented"); }

    get outputTime() { throw new Error("Not implemented"); }

    update() {
        throw new Error("Not implemented");
    }
}

module.exports = { ShaderPassInput };