const AvatarRuntime = (() => {
  const CDN = {
    three: 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js',
    loader: 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js',
    vrm: 'https://cdn.jsdelivr.net/npm/@pixiv/three-vrm@3.4.0/lib/three-vrm.module.js'
  };
  async function mount(canvas, modelUrl) {
    if (!canvas || !modelUrl) return { ok: false, reason: 'missing_canvas_or_model' };
    const [{ default: THREE }, { GLTFLoader }, { VRMLoaderPlugin }] = await Promise.all([import(CDN.three), import(CDN.loader), import(CDN.vrm)]);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
    camera.position.set(0, 1.35, 3.4);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x303050, 2.2));
    const fill = new THREE.DirectionalLight(0xffffff, 2.0); fill.position.set(2, 3, 2); scene.add(fill);
    const loader = new GLTFLoader(); loader.register(parser => new VRMLoaderPlugin(parser));
    const gltf = await loader.loadAsync(modelUrl); const vrm = gltf.userData.vrm;
    if (!vrm) throw new Error('VRM model did not expose a VRM instance');
    scene.add(vrm.scene);
    const resize = () => { const w = canvas.clientWidth || 320, h = canvas.clientHeight || 420; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
    window.addEventListener('resize', resize, { passive: true }); resize();
    const clock = new THREE.Clock();
    const frame = () => { const delta = clock.getDelta(); if (vrm.update) vrm.update(delta); renderer.render(scene, camera); requestAnimationFrame(frame); };
    frame(); return { ok: true, renderer, scene, camera, vrm };
  }
  return { mount };
})();
window.AvatarRuntime = AvatarRuntime;
