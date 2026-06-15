import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// NOTE: StrictMode removed intentionally.
// StrictMode double-mounts components in dev, which destroys
// the Three.js WebGL renderer and causes frozen video.
createRoot(document.getElementById('root')!).render(
  <App />,
)
