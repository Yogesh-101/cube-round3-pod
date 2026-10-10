import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import Landing from './Landing.jsx'
import Login from './components/Login.jsx'
import Register from './components/Register.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/app" element={<App />} />
        <Route path="/app/orchestrator" element={<App />} />
        <Route path="/app/agents" element={<App defaultMode="agents" />} />
        <Route path="/app/agents/:stage" element={<App defaultMode="agents" />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
