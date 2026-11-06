/**
 * Glass-bead shader patch for THREE.MeshPhysicalMaterial.
 *
 * three.js `transmission` refracts the *scene behind* the bead. On a near-white
 * page that makes clear stones look flat white/grey. A real glass bead on a
 * studio background instead shows the *studio environment* bent through the
 * sphere (an inverted, contrasty image) plus crisp softbox reflections and the
 * string passing through the bore. This patch reproduces that:
 *
 *   1. two-surface sphere refraction of the environment map (enter, travel
 *      through the ball, exit) -> the "crystal ball" interior
 *   2. Fresnel reflection of the environment -> crisp softbox windows at the rim
 *   3. the elastic cord rendered as a pale band where the view ray crosses the
 *      bore axis
 *
 * Use with `transmission: 0` (the bead is rendered as a normal opaque mesh).
 * The mesh origin must be the bead centre and the bore must run along local Z.
 */

export const GLASS_BEAD_DEFAULTS = {
  ior: 1.5,
  /** Multiplier on environment light for the glass only (scene env is dim). */
  envGain: 3.8,
  /** Extra gain on the Fresnel reflection. */
  reflectionGain: 6.0,
  /** Mip blur of the refracted environment (0 = mirror sharp). */
  blur: 0.0,
  /** Cord colour seen through the glass and its visibility (0..1). */
  cordColor: [0.97, 0.96, 0.98],
  cordMix: 0.9,
  /** Cord half-width as a fraction of the bead radius. */
  cordRadius: 0.075,
  /** Stone average colour (r,g,b 0..1) — smooth body tint; null = no tint. */
  avgColor: null,
  /** How much of the stone *texture* (veins/clouds) shows on top of the smooth tint. */
  textureMix: 1.5,
  /** How much of the stone's hue tints the glass (0 = colourless, 1 = full). */
  tintSaturation: 1.0,
  /** Constant light added to the refracted image so the body never goes black. */
  lift: 0.26,
};

export function applyGlassBeadShader(shader, { sphereRadius, ...overrides }) {
  const o = { ...GLASS_BEAD_DEFAULTS, ...overrides };
  shader.uniforms.uGlassR = { value: sphereRadius };
  shader.uniforms.uGlassIOR = { value: o.ior };
  shader.uniforms.uGlassGain = { value: o.envGain };
  shader.uniforms.uGlassReflGain = { value: o.reflectionGain };
  shader.uniforms.uGlassBlur = { value: o.blur };
  shader.uniforms.uGlassCordColor = { value: o.cordColor };
  shader.uniforms.uGlassCordMix = { value: o.cordMix };
  shader.uniforms.uGlassCordR = { value: o.cordRadius };
  shader.uniforms.uGlassAvg = { value: o.avgColor ?? [1, 1, 1] };
  shader.uniforms.uGlassTexMix = { value: o.textureMix };
  shader.uniforms.uGlassLift = { value: o.lift };
  shader.uniforms.uGlassTintSat = { value: o.tintSaturation };

  shader.vertexShader = shader.vertexShader
    .replace(
      "#include <common>",
      `#include <common>
       uniform float uGlassR;
       varying vec3 vGlassC;
       varying vec3 vGlassA;
       varying float vGlassRadius;`
    )
    .replace(
      "vViewPosition = - mvPosition.xyz;",
      `vViewPosition = - mvPosition.xyz;
       vGlassC = ( modelViewMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz;
       vGlassA = normalize( ( modelViewMatrix * vec4( 0.0, 0.0, 1.0, 0.0 ) ).xyz );
       vGlassRadius = length( modelViewMatrix[ 0 ].xyz ) * uGlassR;`
    );

  shader.fragmentShader = shader.fragmentShader
    .replace(
      "#include <common>",
      `#include <common>
       uniform float uGlassIOR;
       uniform float uGlassGain;
       uniform float uGlassReflGain;
       uniform float uGlassBlur;
       uniform vec3 uGlassCordColor;
       uniform float uGlassCordMix;
       uniform float uGlassCordR;
       uniform vec3 uGlassAvg;
       uniform float uGlassTexMix;
       uniform float uGlassLift;
       uniform float uGlassTintSat;
       varying vec3 vGlassC;
       varying vec3 vGlassA;
       varying float vGlassRadius;`
    )
    .replace(
      "#include <opaque_fragment>",
      `
      #if defined( ENVMAP_TYPE_CUBE_UV )
      {
        vec3 gV = normalize( vViewPosition );          // surface -> camera (view space)
        vec3 gN = normalize( normal );
        vec3 gP = - vViewPosition;                      // surface point (view space)
        float gR = vGlassRadius;

        // --- 1. refract into the ball, find the exit point, refract out -----
        vec3 rd = refract( - gV, gN, 1.0 / uGlassIOR );
        vec3 oc = gP - vGlassC;
        float bq = dot( oc, rd );
        float cq = dot( oc, oc ) - gR * gR;
        float tt = max( - bq + sqrt( max( bq * bq - cq, 0.0 ) ), 0.0 );
        vec3 gQ = gP + rd * tt;
        vec3 gN2 = normalize( gQ - vGlassC );
        vec3 rd2 = refract( rd, - gN2, uGlassIOR );
        if ( dot( rd2, rd2 ) < 1e-4 ) rd2 = reflect( rd, - gN2 );   // total internal reflection
        rd2 = normalize( rd2 );
        vec3 dirW = inverseTransformDirection( rd2, viewMatrix );
        vec3 refr = textureCubeUV( envMap, envMapRotation * dirW, uGlassBlur ).rgb * envMapIntensity * uGlassGain;

        // --- 2. the string running through the bore, seen through the glass --
        {
          float b = dot( rd, vGlassA );
          float d = dot( rd, oc );
          float e = dot( vGlassA, oc );
          float den = 1.0 - b * b;
          if ( den > 1e-4 ) {
            float s = ( b * e - d ) / den;           // along the view ray
            float u = ( e - b * d ) / den;           // along the bore axis
            vec3 cp = ( gP + rd * s ) - ( vGlassC + vGlassA * u );
            float dist = length( cp ) / gR;
            float inside = step( 0.0, s ) * step( s, tt ) * step( abs( u ), 1.0 );
            float band = ( 1.0 - smoothstep( uGlassCordR * 0.6, uGlassCordR * 1.4, dist ) ) * inside;
            vec3 cord = uGlassCordColor * ( 0.7 + 0.3 * clamp( dot( normalize( cp ), gV ) * 0.5 + 0.5, 0.0, 1.0 ) );
            refr = mix( refr, cord, band * uGlassCordMix );
          }
        }

        // --- 3. stone colour tints the light that passed through ------------
        // smooth body colour from the stone's average tone (hue kept, brightness not lost)
        float avgMax = max( max( uGlassAvg.r, uGlassAvg.g ), max( uGlassAvg.b, 1e-3 ) );
        vec3 bodyTint = mix( vec3( 1.0 ), uGlassAvg / avgMax, uGlassTintSat );
        vec3 texTint = diffuseColor.rgb / max( max( diffuseColor.r, diffuseColor.g ), max( diffuseColor.b, 1e-3 ) );
        vec3 tint = mix( bodyTint, mix( vec3( 1.0 ), texTint, uGlassTintSat ), uGlassTexMix );
        refr = ( refr + vec3( uGlassLift ) ) * tint;

        // --- 4. Fresnel reflection of the environment ------------------------
        float NdV = clamp( dot( gN, gV ), 0.0, 1.0 );
        float F = 0.04 + 0.96 * pow( 1.0 - NdV, 5.0 );
        vec3 rv = inverseTransformDirection( reflect( - gV, gN ), viewMatrix );
        vec3 refl = textureCubeUV( envMap, envMapRotation * rv, 0.0 ).rgb * envMapIntensity * uGlassGain * uGlassReflGain;

        outgoingLight = refr * ( 1.0 - F ) + refl * F + reflectedLight.directSpecular;
      }
      #endif
      #include <opaque_fragment>`
    );
}
