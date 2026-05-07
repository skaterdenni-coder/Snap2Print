import { Platform } from 'react-native';

export const SCALER_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Snap2XR GLB Scaler</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r152/three.min.js"></script>
  <script src="https://cdn.jsdelivr.net/gh/mrdoob/three.js@r152/examples/js/loaders/GLTFLoader.js"></script>
  <script src="https://cdn.jsdelivr.net/gh/mrdoob/three.js@r152/examples/js/exporters/GLTFExporter.js"></script>
</head>
<body>
  <script>
    // Robust Base64 conversion for large ArrayBuffers
    function arrayBufferToBase64(buffer) {
      let binary = '';
      const bytes = new Uint8Array(buffer);
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return window.btoa(binary);
    }

    async function scaleModel(url, targetL, targetW, targetH) {
      try {
        const loader = new THREE.GLTFLoader();
        const exporter = new THREE.GLTFExporter();

        loader.load(url, (gltf) => {
          const model = gltf.scene;

          // 1. Messen
          const bbox = new THREE.Box3().setFromObject(model);
          const size = new THREE.Vector3();
          bbox.getSize(size);

          // 2. Skalieren (cm -> meter)
          const scaleX = (targetW / 100) / size.x;
          const scaleY = (targetH / 100) / size.y;
          const scaleZ = (targetL / 100) / size.z;

          model.scale.set(scaleX, scaleY, scaleZ);
          model.updateMatrixWorld();

          // 3. Export
          exporter.parse(model, (result) => {
            // Wir nutzen einen Blob + FileReader für stabilen Base64 Export großer Dateien
            const blob = new Blob([result], { type: 'application/octet-stream' });
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64 = reader.result.split(',')[1];
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'SUCCESS',
                base64: base64
              }));
            };
            reader.readAsDataURL(blob);
          }, { binary: true });

        }, undefined, (err) => {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ERROR', message: 'Ladefehler: ' + err.message }));
        });
      } catch (e) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ERROR', message: 'Verarbeitungsfehler: ' + e.message }));
      }
    }

    window.addEventListener('message', (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'START') {
        scaleModel(data.url, data.l, data.w, data.h);
      }
    });
  </script>
</body>
</html>
`;
