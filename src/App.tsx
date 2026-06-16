import { useState, useRef, useEffect } from 'react'
import { Camera, Rocket, Zap, Shield, Download, Users } from 'lucide-react'
import html2canvas from 'html2canvas'
import { useWebcam } from './hooks/useWebcam'
import { useFaceTracking } from './hooks/useFaceTracking'
import { useAudioWarping } from './hooks/useAudioWarping'
import { usePeerJS } from './hooks/usePeerJS'
import { SpacetimeCanvas } from './components/SpacetimeCanvas'
import { StarfieldCanvas } from './components/StarfieldCanvas'
import './App.css'

function App() {
  const [speed, setSpeed] = useState(0.0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const { isReady, error, stream } = useWebcam(videoRef);
  const { dopplerFactor, isFaceModelReady } = useFaceTracking(videoRef, isReady);
  const { audioError } = useAudioWarping(isReady, dopplerFactor, speed, stream);
  const { peerId, remoteStream, connectToPeer, disconnectPeer, peerError } = usePeerJS(stream);
  const [isCalibrating, setIsCalibrating] = useState(true);

  // Gamification state
  const [isChallengeMode, setIsChallengeMode] = useState(false);
  const [challengeScore, setChallengeScore] = useState(0);
  const [certificateUrl, setCertificateUrl] = useState<string | null>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const challengeTimerRef = useRef<number | null>(null);

  // Duet State
  const [isDuetMode, setIsDuetMode] = useState(false);
  const [remotePeerIdInput, setRemotePeerIdInput] = useState('');

  // Speed tier for CSS classes
  const speedTier = speed > 0.8 ? 'extreme' : speed > 0.5 ? 'high' : '';

  useEffect(() => {
    if (isReady && isFaceModelReady) {
      setTimeout(() => setIsCalibrating(false), 2500);
    }
  }, [isReady, isFaceModelReady]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(e => console.error("Remote video play error", e));
    }
  }, [remoteStream]);

  const handleSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setSpeed(val);
    if (navigator.vibrate && val > 0.5 && !isChallengeMode) {
      navigator.vibrate(Math.floor(val * 80));
    }
  };

  const startChallenge = () => {
    setIsChallengeMode(true);
    setSpeed(0.1);
    setCertificateUrl(null);
    setChallengeScore(0);
    let currentSpeed = 0.1;
    challengeTimerRef.current = window.setInterval(() => {
      currentSpeed += 0.05;
      if (currentSpeed >= 0.99) {
        currentSpeed = 0.99;
        setSpeed(currentSpeed);
        finishChallenge();
      } else {
        setSpeed(currentSpeed);
      }
    }, 500);
  };

  const finishChallenge = async () => {
    if (challengeTimerRef.current) clearInterval(challengeTimerRef.current);
    const finalScore = Math.max(0, 100 - Math.abs(dopplerFactor) * 100);
    setChallengeScore(finalScore);
    if (hudRef.current) {
      try {
        const canvas = await html2canvas(hudRef.current, { backgroundColor: '#000' });
        setCertificateUrl(canvas.toDataURL('image/png'));
      } catch (err) {
        console.error("Failed to generate certificate", err);
      }
    }
    setIsChallengeMode(false);
  };

  return (
    <div className="app-container">
      {/* === STARFIELD BACKGROUND === */}
      <StarfieldCanvas speed={speed} />

      {/* === SYSTEM STATUS === */}
      <div className="system-status">
        <p>SYSTEM: ONLINE</p>
        <p>AI CORE: ACTIVE</p>
        <p>GPU ACCEL: ENABLED</p>
        {isCalibrating && <p className="warning-text">CALIBRATING SPACETIME COORDINATES...</p>}
      </div>

      {/* === HUD FRAME === */}
      <div
        className={`hud-frame ${speedTier === 'extreme' ? 'speed-extreme' : speedTier === 'high' ? 'speed-high' : ''}`}
        ref={hudRef}
      >
        <div className="hud-corners"></div>
        <div className="hud-overlay"></div>
        <div className="reticle"></div>

        {/* GLITCH OVERLAY */}
        <div className={`glitch-overlay ${speed > 0.6 ? 'active' : ''}`}
          style={{
            background: `repeating-linear-gradient(
              0deg,
              transparent,
              transparent 2px,
              rgba(0, 255, 100, 0.03) 2px,
              rgba(0, 255, 100, 0.03) 4px
            )`
          }}
        />

        {/* CERTIFICATE OVERLAY */}
        {certificateUrl && (
          <div style={{
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.85)', zIndex: 20, display: 'flex', flexDirection: 'column',
            justifyContent: 'center', alignItems: 'center', padding: '20px', borderRadius: '24px'
          }}>
            <h2 style={{ fontFamily: 'Orbitron', color: 'var(--neon-green)', textShadow: '0 0 15px var(--neon-green)', marginBottom: '10px' }}>
              ✦ SPACETIME CERTIFICATE ✦
            </h2>
            <img src={certificateUrl} alt="Certificate" style={{ maxWidth: '80%', maxHeight: '50%', border: '2px solid var(--neon-green)', borderRadius: '12px' }} />
            <p style={{ marginTop: '15px', color: '#fff', textAlign: 'center', fontFamily: 'Share Tech Mono' }}>
              Score Stabilitas Wajah: <strong style={{ color: 'var(--neon-green)' }}>{challengeScore.toFixed(0)}%</strong><br />
              "Otak Anda lolos uji astronot Einstein pada kecepatan 0.99c!"
            </p>
            <a href={certificateUrl} download="warpface-certificate.png" className="hud-btn"
              style={{ marginTop: '20px', textDecoration: 'none', borderRadius: '8px', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Download size={18} /> Download & Share
            </a>
            <button className="hud-btn" style={{ marginTop: '10px', borderRadius: '8px', padding: '8px 20px' }} onClick={() => setCertificateUrl(null)}>
              Tutup
            </button>
          </div>
        )}

        {/* CHALLENGE MODE BANNER */}
        {isChallengeMode && (
          <div style={{ position: 'absolute', top: '20px', width: '100%', textAlign: 'center', zIndex: 10 }}>
            <h2 className="warning-text" style={{ fontFamily: 'Orbitron', fontSize: '1.6rem', letterSpacing: '3px' }}>
              ⚡ CHALLENGE MODE ACTIVE ⚡
            </h2>
            <p style={{ fontSize: '14px', marginTop: '5px' }}>Tahan wajah Anda! Kecepatan meningkat!</p>
          </div>
        )}

        {/* DUET MODE PANEL */}
        {isDuetMode && (
          <div style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 30, background: 'rgba(0,10,0,0.85)', padding: '15px', border: '1px solid rgba(0,255,0,0.3)', borderRadius: '12px' }}>
            <h3 style={{ fontFamily: 'Orbitron', color: 'var(--neon-green)', marginBottom: '10px', fontSize: '12px' }}>SPACETIME DUET</h3>
            <p style={{ fontSize: '11px', marginBottom: '10px' }}>Your ID: <strong style={{ color: 'var(--neon-blue)' }}>{peerId}</strong></p>
            <div style={{ display: 'flex', gap: '5px' }}>
              <input
                type="text" placeholder="Friend's ID"
                value={remotePeerIdInput}
                onChange={e => setRemotePeerIdInput(e.target.value)}
                style={{ background: 'transparent', border: '1px solid rgba(0,255,0,0.3)', color: 'var(--neon-green)', padding: '5px', borderRadius: '4px', fontSize: '11px', width: '120px' }}
              />
              <button onClick={() => connectToPeer(remotePeerIdInput)}
                style={{ background: 'var(--neon-green)', color: '#000', border: 'none', cursor: 'pointer', padding: '5px 10px', borderRadius: '4px', fontWeight: 'bold', fontSize: '11px' }}>
                Connect
              </button>
            </div>
            {peerError && <p className="warning-text" style={{ fontSize: '10px', marginTop: '5px' }}>{peerError}</p>}
            {remoteStream && (
              <button onClick={disconnectPeer}
                style={{ background: 'var(--neon-red)', color: '#fff', border: 'none', cursor: 'pointer', padding: '5px 10px', marginTop: '10px', width: '100%', borderRadius: '4px' }}>
                Disconnect
              </button>
            )}
          </div>
        )}

        {/* === CAMERA VIEWPORT === */}
        <div className="viewport" style={{ background: '#000', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--neon-green)' }}>
          {(error || audioError) ? (
            <div style={{ textAlign: 'center', fontFamily: 'Orbitron', zIndex: 10 }}>
              <h2 className="warning-text">SYSTEM ERROR</h2>
              <p style={{ fontSize: '12px', marginTop: '5px' }}>{error || audioError}</p>
            </div>
          ) : isCalibrating ? (
            <div style={{ textAlign: 'center', zIndex: 10 }}>
              <h2 className="warning-text" style={{ fontFamily: 'Orbitron', letterSpacing: '2px' }}>
                INITIALIZING SPACETIME ENGINE...
              </h2>
              <p style={{ marginTop: '8px', fontSize: '13px', opacity: 0.7 }}>Loading AI Model & Camera</p>
            </div>
          ) : null}

          {/* Hidden video for face tracking (useWebcam needs this ref) */}
          <video
            ref={videoRef}
            autoPlay playsInline muted
            style={{ position: 'absolute', width: 1, height: 1, opacity: 0.01, pointerEvents: 'none', zIndex: -1 }}
          />

          {/* SpacetimeCanvas creates its OWN video from the stream — no ref dependency */}
          <SpacetimeCanvas
            speed={speed}
            dopplerFactor={dopplerFactor}
            stream={stream}
          />

          {isDuetMode && remoteStream && (
            <div style={{ position: 'absolute', top: 0, right: 0, width: '30%', height: '30%', zIndex: 10, border: '2px solid rgba(0,255,0,0.4)', borderRadius: '12px', overflow: 'hidden' }}>
              <video
                ref={remoteVideoRef}
                autoPlay playsInline
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <div style={{ position: 'absolute', bottom: '4px', right: '4px', background: 'rgba(0,0,0,0.6)', padding: '2px 6px', color: 'var(--neon-green)', fontSize: '10px', fontFamily: 'Orbitron', borderRadius: '4px' }}>
                NORMAL TIME
              </div>
            </div>
          )}
        </div>

        {/* === BOTTOM CONTROLS === */}
        <div className="controls-container">
          <div className={`speed-display ${speedTier === 'extreme' ? 'speed-extreme' : speedTier === 'high' ? 'speed-high' : ''}`}>
            VELOCITY: {speed.toFixed(3)}c
            {speed > 0.8 && (
              <span className={`warning-text ${speed > 0.9 ? 'screen-shake-extreme' : 'screen-shake'}`}
                style={{ marginLeft: '15px', display: 'inline-block' }}>
                ⚠ HIGH G-FORCE
              </span>
            )}
          </div>
          <div className="slider-wrapper">
            <Zap size={20} color={speed > 0.5 ? "var(--neon-red)" : "var(--neon-green)"} />
            <input
              type="range" min="0" max="0.99" step="0.01"
              value={speed}
              onChange={handleSpeedChange}
              disabled={isChallengeMode}
              className="hyper-slider"
            />
            <Rocket size={20} color={speed > 0.8 ? "var(--neon-red)" : "var(--neon-green)"} />
          </div>
        </div>

        {/* === SIDE MODE BUTTONS === */}
        <div className="mode-buttons">
          <button className="hud-btn" title="Toggle Camera"><Camera size={18} /></button>
          <button
            className={`hud-btn ${isChallengeMode ? 'active' : ''}`}
            title="Challenge Mode"
            onClick={startChallenge}
            disabled={isChallengeMode || !isFaceModelReady}
          >
            <Shield size={18} />
          </button>
          <button
            className={`hud-btn ${isDuetMode ? 'active' : ''}`}
            title="Duet Mode"
            onClick={() => setIsDuetMode(!isDuetMode)}
          >
            <Users size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default App
