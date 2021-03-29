module.exports = {
    vertexShader: `
varying vec2 _three_shadertoy_vertexUV;

void main()
{
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

    _three_shadertoy_vertexUV = uv;
}
            `
};