import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import CadastroPublico from './cadastro'

// Link de cadastro (?cadastro=TOKEN) abre o formulário público, sem login.
const token = new URLSearchParams(location.search).get('cadastro') ?? ''

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/^[0-9a-f]{32}$/.test(token) ? <CadastroPublico token={token} /> : <App />}
  </StrictMode>,
)
