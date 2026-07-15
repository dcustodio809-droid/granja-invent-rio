import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { error } = await signIn(email, password)
      if (error) throw error
      navigate('/')
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

          <button className="btn btn-primary" style={{ width: '100%', height: 50 }} disabled={loading}>
            {loading ? 'Aguarde...' : 'Entrar'}
          </button>
        </form>

        <div className="login-switch">
          Não tem uma conta? Peça ao gestor para cadastrar seu acesso.
        </div>
      </div>
    </div>
  )
}
