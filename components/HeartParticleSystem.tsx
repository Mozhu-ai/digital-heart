import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      points: any;
      bufferGeometry: any;
      bufferAttribute: any;
      pointsMaterial: any;
    }
  }
}

const PARTICLE_COUNT = 12000; // Increased significantly for 3D volume
const HEART_COLOR = new THREE.Color('#FF0040'); // slightly redder pink for bloom

interface HeartParticleSystemProps {
  audioEnabled: boolean;
}

// Advanced Web Audio Synthesizer for "Golden Fairy Dust"
class HeartAudioSynth {
  ctx: AudioContext | null = null;
  masterGain: GainNode | null = null;
  noiseBuffer: AudioBuffer | null = null;

  constructor() {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);
        this.masterGain.gain.value = 0.4; // Slightly lower volume for high frequencies to prevent harshness

        // 1. Pre-generate White Noise Buffer
        const bufferSize = this.ctx.sampleRate; 
        this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
      }
    } catch (e) {
      console.warn("Web Audio API not supported");
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Play a single "sparkle" of sound
  private playGrain(startTime: number) {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;

    // Duration: Short & crisp for individual sparkles (0.1s - 0.4s)
    const dur = 0.1 + Math.random() * 0.3;

    // --- Layer 1: Highpass Noise (Shimmering Dust) ---
    const noiseSrc = this.ctx.createBufferSource();
    noiseSrc.buffer = this.noiseBuffer;
    noiseSrc.loop = true;
    noiseSrc.loopStart = Math.random();
    noiseSrc.loopEnd = noiseSrc.loopStart + 0.5;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'highpass'; // Only highs for "glitter"
    noiseFilter.frequency.value = 4000 + Math.random() * 3000; // Very high (4kHz-7kHz)

    const noiseGain = this.ctx.createGain();
    // Soft attack but quick fade
    noiseGain.gain.setValueAtTime(0, startTime);
    noiseGain.gain.linearRampToValueAtTime(0.08, startTime + 0.02); 
    noiseGain.gain.exponentialRampToValueAtTime(0.001, startTime + dur);

    noiseSrc.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    
    noiseSrc.start(startTime);
    noiseSrc.stop(startTime + dur + 0.1);

    // --- Layer 2: Crystal FM Bell (Magical Chime) ---
    const carrier = this.ctx.createOscillator();
    const modulator = this.ctx.createOscillator();
    const modGain = this.ctx.createGain();
    const carrierGain = this.ctx.createGain();
    const panner = this.ctx.createStereoPanner();

    // High Fundamental Frequencies (1500Hz - 4500Hz) for "Tinkerbell" sound
    const fundFreq = 1500 + Math.random() * 3000; 
    carrier.frequency.value = fundFreq;
    carrier.type = 'sine'; // Sine is purest for magic

    // Non-integer ratios create glassy/crystalline inharmonics
    const ratio = 1.5 + Math.random(); 
    modulator.frequency.value = fundFreq * ratio;
    modulator.type = 'sine';

    // Modulation Envelope: "Ping" effect
    modGain.gain.setValueAtTime(fundFreq * 0.5, startTime);
    modGain.gain.exponentialRampToValueAtTime(1, startTime + 0.1); 

    modulator.connect(modGain);
    modGain.connect(carrier.frequency);

    // Amplitude Envelope: Bell shape (Instant attack, exponential decay)
    carrierGain.gain.setValueAtTime(0, startTime);
    carrierGain.gain.linearRampToValueAtTime(0.05, startTime + 0.01); // Very fast attack
    carrierGain.gain.exponentialRampToValueAtTime(0.001, startTime + dur); // Ring out

    // Panning: Wide stereo spread
    panner.pan.value = (Math.random() * 2) - 1;

    carrier.connect(carrierGain);
    carrierGain.connect(panner);
    panner.connect(this.masterGain);

    carrier.start(startTime);
    modulator.start(startTime);
    carrier.stop(startTime + dur + 0.1);
    modulator.stop(startTime + dur + 0.1);

    // Cleanup nodes
    setTimeout(() => {
        noiseSrc.disconnect();
        noiseFilter.disconnect();
        noiseGain.disconnect();
        carrier.disconnect();
        modulator.disconnect();
        modGain.disconnect();
        carrierGain.disconnect();
        panner.disconnect();
    }, (dur + 0.2) * 1000);
  }

  // Trigger a "Magic Wand" Sweep
  playMagicBurst() {
    if (!this.ctx) return;
    
    const now = this.ctx.currentTime;
    // High density for "cloud" of sparkles
    const density = 40; 

    for (let i = 0; i < density; i++) {
        // Scatter grains over ~0.6s
        // Using a power function for offset to cluster more sparkles at the start (burst)
        const t = Math.random();
        const offset = t * 0.6; 
        
        this.playGrain(now + offset);
    }
  }
}

export const HeartParticleSystem: React.FC<HeartParticleSystemProps> = ({ audioEnabled }) => {
  const pointsRef = useRef<THREE.Points>(null);
  
  // Audio System Ref
  const audioRef = useRef<HeartAudioSynth | null>(null);
  const beatTriggered = useRef(false);

  // Initialize Audio Synth once
  useEffect(() => {
    audioRef.current = new HeartAudioSynth();
    return () => {
      if (audioRef.current?.ctx) {
        audioRef.current.ctx.close();
      }
    };
  }, []);

  // Handle Audio Enable/Resume
  useEffect(() => {
    if (audioEnabled && audioRef.current) {
      audioRef.current.resume();
    }
  }, [audioEnabled]);

  // Store simulation state in a ref to avoid re-renders
  const simData = useRef<{
    velocities: Float32Array;
    basePositions: Float32Array;
    frictions: Float32Array;
    eases: Float32Array;
    phases: Float32Array; 
  }>({
    velocities: new Float32Array(PARTICLE_COUNT * 3),
    basePositions: new Float32Array(PARTICLE_COUNT * 3),
    frictions: new Float32Array(PARTICLE_COUNT),
    eases: new Float32Array(PARTICLE_COUNT),
    phases: new Float32Array(PARTICLE_COUNT),
  });

  // Initialize geometry data once
  const { positions, colors, sizes } = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const sizes = new Float32Array(PARTICLE_COUNT);

    const getHeartPoint = (t: number) => {
      const x = 16 * Math.pow(Math.sin(t), 3);
      // Tip pointing down
      const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      return { x, y };
    };

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      const t = Math.random() * Math.PI * 2;
      const { x, y } = getHeartPoint(t);

      // 3D Distribution Logic
      let spreadAmount = 0;
      let zThickness = 0;
      const r = Math.random();

      if (r > 0.95) {
        spreadAmount = 6.0;
        zThickness = 6.0;
      } else if (r > 0.7) {
        spreadAmount = 2.5;
        zThickness = 3.0;
      } else {
        spreadAmount = 0.4;
        zThickness = 0.8; 
      }

      const ux = (Math.random() - 0.5) * 2;
      const uy = (Math.random() - 0.5) * 2;
      const uz = (Math.random() - 0.5) * 2;
      
      const mag = Math.sqrt(ux*ux + uy*uy + uz*uz) || 1;
      const dist = Math.random() * spreadAmount;
      
      const offsetX = (ux / mag) * dist;
      const offsetY = (uy / mag) * dist;
      const offsetZ = (uz / mag) * zThickness * (Math.random() * 4);

      const baseX = x + offsetX;
      const baseY = y + offsetY;
      const baseZ = offsetZ;

      positions[i3] = (Math.random() - 0.5) * 50;
      positions[i3 + 1] = (Math.random() - 0.5) * 50;
      positions[i3 + 2] = (Math.random() - 0.5) * 50;

      simData.current.basePositions[i3] = baseX;
      simData.current.basePositions[i3 + 1] = baseY;
      simData.current.basePositions[i3 + 2] = baseZ;

      simData.current.velocities[i3] = 0;
      simData.current.velocities[i3+1] = 0;
      simData.current.velocities[i3+2] = 0;

      simData.current.frictions[i] = 0.85 + Math.random() * 0.05; 
      simData.current.eases[i] = 0.12 + Math.random() * 0.15; 
      simData.current.phases[i] = Math.random() * Math.PI * 2;

      const colorVar = new THREE.Color(HEART_COLOR);
      if (spreadAmount < 1.0) {
        colorVar.setHSL(0.92, 1.0, 0.6 + Math.random() * 0.4); 
        sizes[i] = Math.random() * 1.5 + 0.5;
      } else {
        colorVar.setHSL(0.9, 0.8, 0.2 + Math.random() * 0.3); 
        sizes[i] = Math.random() * 1.0 + 0.1;
      }
      
      colors[i3] = colorVar.r;
      colors[i3 + 1] = colorVar.g;
      colors[i3 + 2] = colorVar.b;
    }

    return { positions, colors, sizes };
  }, []);

  // Frame Loop: Animation Logic
  useFrame((state) => {
    if (!pointsRef.current) return;

    const time = state.clock.getElapsedTime();
    const positions = pointsRef.current.geometry.attributes.position.array as Float32Array;
    const { velocities, basePositions, frictions, eases } = simData.current;

    const cycleLength = 2.0; 
    const tCycle = time % cycleLength;
    const expandDuration = 0.16;
    const contractDuration = 0.16;

    let beatScale = 1.0;
    let energyBurst = 0;

    // --- HEARTBEAT & AUDIO TRIGGER ---
    if (tCycle < expandDuration) {
        // Trigger sound at the very beginning of the beat
        if (audioEnabled && !beatTriggered.current) {
            audioRef.current?.playMagicBurst();
            beatTriggered.current = true;
        }
        
        const p = tCycle / expandDuration;
        beatScale = 1 + 0.15 * (1 - Math.pow(1 - p, 3)); 
        energyBurst = 0.8; 
    } else if (tCycle < (expandDuration + contractDuration)) {
        const p = (tCycle - expandDuration) / contractDuration;
        const dropAmount = 0.25; 
        beatScale = 1.15 - dropAmount * (p * p * p); 
        beatTriggered.current = false; 
    } else {
        const p = (tCycle - (expandDuration + contractDuration)) / (cycleLength - (expandDuration + contractDuration));
        beatScale = 0.90 + 0.10 * (1 - Math.exp(-p * 5)) + 0.01 * Math.sin(p * Math.PI * 6);
        beatTriggered.current = false; 
    }

    pointsRef.current.rotation.y = Math.sin(time * 0.2) * 0.3;
    pointsRef.current.rotation.z = Math.cos(time * 0.15) * 0.05;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;

      const diffusion = 1 + (energyBurst * 0.4); 
      const currentScale = beatScale;

      const tx = basePositions[i3] * currentScale * diffusion;
      const ty = basePositions[i3+1] * currentScale * diffusion;
      const tz = basePositions[i3+2] * currentScale * diffusion;

      const x = positions[i3];
      const y = positions[i3+1];
      const z = positions[i3+2];

      const dx = tx - x;
      const dy = ty - y;
      const dz = tz - z;

      velocities[i3] += dx * eases[i];
      velocities[i3+1] += dy * eases[i];
      velocities[i3+2] += dz * eases[i];

      if (energyBurst > 0.1 && Math.random() < 0.01) {
         velocities[i3] += (Math.random() - 0.5) * energyBurst * 4;
         velocities[i3+1] += (Math.random() - 0.5) * energyBurst * 4;
         velocities[i3+2] += (Math.random() - 0.5) * energyBurst * 4;
      }

      velocities[i3] *= frictions[i];
      velocities[i3+1] *= frictions[i];
      velocities[i3+2] *= frictions[i];

      positions[i3] += velocities[i3];
      positions[i3+1] += velocities[i3+1];
      positions[i3+2] += velocities[i3+2];
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={colors.length / 3}
          array={colors}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-size"
          count={sizes.length}
          array={sizes}
          itemSize={1}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.15} 
        vertexColors
        transparent
        opacity={0.8}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation={true}
      />
    </points>
  );
};