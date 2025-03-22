uniform vec3 sunPosition;

varying vec2 vUv;

void main() {
    vec2 center = vec2(0.5, 0.5);
    float dist = length(vUv - center);
    
    float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
    alpha = pow(alpha, 2.0);
    alpha *= 0.3;
    
    vec3 color = vec3(1.0, 0.8, 0.6);
    float edgeFade = 1.0 - smoothstep(0.0, 0.5, dist);
    
    gl_FragColor = vec4(color, alpha * edgeFade);
} 