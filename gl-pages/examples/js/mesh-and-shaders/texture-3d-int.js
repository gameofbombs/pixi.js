import * as PIXI from 'pixi.js';

const vertexSrc = `#version 300 es
in vec2 aPosition;
in vec3 aColor;
in vec2 aUV;

out vec3 vColor;
out vec2 vUV;

uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;

uniform mat3 uTransformMatrix;


void main() {

    mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
    gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);

    vColor = aColor;
    vUV = aUV;
}`;

const fragmentSrc = `#version 300 es
in vec3 vColor;
in vec2 vUV;

uniform mediump isampler3D uTexture;

out vec4 outColor;

void main() {
    ivec4 tst = texelFetch(uTexture, ivec3(0,0, round(vUV.y *2.0 - 0.5)), 0);
    outColor=vec4(tst)/255.0;
}`;


const wgsl = `
struct GlobalUniforms {
    projectionMatrix:mat3x3<f32>,
    worldTransformMatrix:mat3x3<f32>,
    worldColorAlpha: vec4<f32>,
    uResolution: vec2<f32>,
}

struct LocalUniforms {
    uTransformMatrix:mat3x3<f32>,
    uColor:vec4<f32>,
    uRound:f32,
}

@group(0) @binding(0) var<uniform> globalUniforms : GlobalUniforms;
@group(1) @binding(0) var<uniform> localUniforms : LocalUniforms;

@group(2) @binding(1) var uTexture : texture_3d<i32>;
@group(2) @binding(2) var uSampler : sampler;

struct VertexOutput {
    @builtin(position) position : vec4<f32>,
    @location(0) vColor : vec3<f32>,
    @location(1) vUV : vec2<f32>,
}

@vertex
fn mainVert(
    @location(0) aPosition : vec2<f32>,
    @location(1) aColor : vec3<f32>,
    @location(2) aUV : vec2<f32>,
) -> VertexOutput {
    var mvp = globalUniforms.projectionMatrix
        * globalUniforms.worldTransformMatrix
        * localUniforms.uTransformMatrix;

    return VertexOutput(
        vec4<f32>(mvp * vec3<f32>(aPosition, 1.0), 1.0),
        aColor,
        aUV
    );
};

@fragment
fn mainFrag(input: VertexOutput) -> @location(0) vec4<f32>{
    let sample1 = textureLoad(uTexture, vec3i(0,0, i32(round(input.vUV.y *2.0 - 0.5))), 0);
    // return sample1 * vec4f(input.vColor, 1.0);
    return vec4f(sample1)/255.0;
}`;

const usage = PIXI.BufferUsage.VERTEX | PIXI.BufferUsage.COPY_DST

const geometry = new PIXI.Geometry({
    attributes: {
        aPosition: { buffer: [
                -100,
                -100, // x, y
                100,
                -100, // x, y
                100,
                100,
            ],
            format: 'float32x2'
        }, // x, y,,
        aColor: {
            buffer: [1, 0, 0, 0, 1, 0, 0, 0, 1],
            format: 'float32x3'
        },
        aUV: {
            buffer: [0, 0, 1, 0, 1, 1],
            format: 'float32x2'
        },
    },
});

const tex3d = new PIXI.Buffer3DSource({
    format: 'rgba32sint',
    label: 'tex3d',
    width: 1, height: 1, depth: 1, useSubRegions: true, scaleMode: 'nearest', alphaMode: 0,
    copyOnResize: true});

const layout1 = { offset: { x: 0, y: 0, z: 0 }, size: { width: 1, height: 1, depth: 1}};
const tex_region1 = new PIXI.Texture3D({ source: tex3d, label: 'tex3d #1', layout: layout1})
const layout2 = { offset: { x: 0, y: 0, z: 1 }, size: { width: 1, height: 1, depth: 1}};
const tex_region2 = new PIXI.Texture3D({ source: tex3d, label: 'tex3d #2', layout: layout2});

(async () => {
    // Create a new application
    const app = new PIXI.Application();

    // Initialize the application
    await app.init({background: '#1099bb', resizeTo: window, preference: 'webgpu',});

    // Append the application canvas to the document body
    document.body.appendChild(app.canvas);

    const resources = {
        uTexture: tex3d.source,
        uSampler: tex3d.source.style,
    };

    const shader = PIXI.Shader.from({
        gl: { vertex: vertexSrc, fragment: fragmentSrc },
        gpu: {
            vertex: {
                entryPoint: 'mainVert',
                source: wgsl,
            },
            fragment: {
                entryPoint: 'mainFrag',
                source: wgsl,
            },
        }, resources});

    const triangle = new PIXI.Mesh({geometry, shader});

    triangle.position.set(400, 300);
    triangle.scale.set(2);

    app.stage.addChild(triangle);

    app.ticker.add((delta) => {
        triangle.rotation += 0.01;
    });

    let upload = 0;
    setInterval(() => {
        if (upload == 0) {
            tex_region1.update(new Int32Array([255, 0, 0, 255]));
            tex3d.checkUpdate();
            upload++;
        } else if (upload == 1) {
            tex3d.resize3D(1, 1, 2);
            tex_region2.update(new Int32Array([0, 255, 255, 255]));
            tex3d.checkUpdate();
            upload++;
        }
    }, 500);

})();
