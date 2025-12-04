import React, { Suspense, useState, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { HeartParticleSystem } from './components/HeartParticleSystem';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      color: any;
    }
  }
}

const App: React.FC = () => {
  const [audioEnabled, setAudioEnabled] = useState(false);

  const toggleAudio = useCallback(() => {
    setAudioEnabled((prev) => !prev);
  }, []);

  return (
    <div className="w-full h-screen bg-black relative">
      {/* UI Overlay */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-20 flex flex-col justify-between p-8">
        {/* Top Controls */}
        <div className="flex justify-end pointer-events-auto">
          <button
            onClick={toggleAudio}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-full border border-pink-500/50 
              transition-all duration-300 backdrop-blur-md
              ${audioEnabled ? 'bg-pink-500/20 text-pink-100 shadow-[0_0_15px_rgba(236,72,153,0.5)]' : 'bg-black/40 text-pink-500/60 hover:bg-pink-900/20'}
            `}
          >
            <span className="text-lg">{audioEnabled ? '🔊' : '🔇'}</span>
            <span className="text-xs font-mono tracking-widest uppercase">
              {audioEnabled ? 'Sound On' : 'Sound Off'}
            </span>
          </button>
        </div>

        {/* Bottom Info */}
        <div className="text-pink-500/30 text-xs font-mono select-none text-center pointer-events-none">
          <div>RENDER MODE: WEBGL / THREE.JS</div>
          <div>EFFECT: UNREAL BLOOM + VOLUMETRIC PARTICLES + AUDIO SYNTH</div>
        </div>
      </div>

      <Canvas
        dpr={[1, 2]} // Support high-DPI screens
        camera={{ position: [0, 0, 100], fov: 35 }}
        gl={{ antialias: false, alpha: false }} // Disable default AA for better performance with post-processing
      >
        <color attach="background" args={['#000000']} />
        
        <Suspense fallback={null}>
          <HeartParticleSystem audioEnabled={audioEnabled} />
        </Suspense>

        <EffectComposer enableNormalPass={false}>
          {/* 
             Bloom: Creates the "glowing light" effect.
             luminanceThreshold: Only bright pixels glow
             intensity: Strength of the glow
             radius: How far the glow spreads
          */}
          <Bloom 
            luminanceThreshold={0.1} 
            mipmapBlur 
            intensity={1.5} 
            radius={0.6} 
            levels={8}
          />
        </EffectComposer>
      </Canvas>
    </div>
  );
};

export default App;