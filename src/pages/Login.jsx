import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [info, setInfo] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setInfo('')
    setLoading(true)
    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password)
        if (error) throw error
        navigate('/')
      } else {
        const { error } = await signUp(email, password, fullName)
        if (error) throw error
        setInfo('Conta criada! Verifique seu e-mail para confirmar o cadastro, depois faça login.')
        setMode('login')
      }
    } catch (err) {
      setError(err.message || 'Erro ao autenticar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-box">
        <img src="/logo.png" alt="logo" width={64} height={64} style={{ borderRadius: 14 }} />
        <div className="login-title">Granja Lucyara Dumont</div>
        <div className="login-subtitle">Controle de Inventário</div>

        <form onSubmit={handleSubmit} className="login-form">
          {mode === 'signup' && (
            <input
              className="input"
              placeholder="Seu nome completo"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          )}
          <input
            className="input"
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="input"
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />

          {error && <div className="login-error">{error}</div>}
          {info && <div className="login-info">{info}</div>}

          <button className="btn btn-primary" style={{ width: '100%', height: 50 }} disabled={loading}>
            {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        <div className="login-switch">
          {mode === 'login' ? (
            <>Ainda não tem conta? <a href="#" onClick={(e) => { e.preventDefault(); setMode('signup') }}>Criar conta</a></>
          ) : (
            <>Já tem conta? <a href="#" onClick={(e) => { e.preventDefault(); setMode('login') }}>Entrar</a></>
          )}
        </div>
      </div>
    </div>
  )
}
