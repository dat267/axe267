import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { HashRouter, Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'

const getEnv = (key: string): string => {
  try {
    // @ts-ignore
    return import.meta.env[key] || ""
  } catch {
    return ""
  }
}

const apiKey = getEnv("VITE_FIREBASE_API_KEY")
const apiUrl = getEnv("VITE_API_URL")

const getAuthErrorMessage = (errorString: string): string => {
  const msg = errorString.toUpperCase()
  if (msg.includes('INVALID_LOGIN_CREDENTIALS')) return 'Invalid email or password.'
  if (msg.includes('EMAIL_EXISTS')) return 'An account with this email already exists.'
  if (msg.includes('USER_DISABLED')) return 'This account has been disabled.'
  if (msg.includes('WEAK_PASSWORD')) return 'Password must be at least 6 characters.'
  if (msg.includes('TOO_MANY_ATTEMPTS_TRY_LATER')) return 'Too many failed login attempts. Please try again later.'
  if (msg.includes('INVALID_EMAIL')) return 'Please enter a valid email address.'
  if (msg.includes('CREDENTIAL_TOO_OLD_LOGIN_AGAIN')) return 'Please sign in again to complete this action.'
  return errorString || 'An unexpected error occurred. Please try again.'
}

type Theme = 'light' | 'dark'

interface ThemeContextType {
  theme: Theme
  setTheme: (t: Theme) => void
  isDark: boolean
}

const ThemeContext = createContext<ThemeContextType | null>(null)

const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme') as Theme
    if (saved) return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    localStorage.setItem('theme', theme)
    if (theme === 'dark') document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDark: theme === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  )
}

const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}

interface AuthContextType {
  token: string | null
  email: string | null
  isAdmin: boolean
  emailVerified: boolean
  isLoading: boolean
  login: (idToken: string, userEmail: string) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))
  const [email, setEmail] = useState<string | null>(localStorage.getItem('email'))
  const [isAdmin, setIsAdmin] = useState(false)
  const [emailVerified, setEmailVerified] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('email')
    setToken(null)
    setEmail(null)
    setIsAdmin(false)
    setEmailVerified(false)
    setIsLoading(false)
  }, [])

  const parseToken = useCallback((idToken: string | null) => {
    if (!idToken) return null
    try {
      return JSON.parse(atob(idToken.split('.')[1]))
    } catch {
      return null
    }
  }, [])

  const isTokenExpired = useCallback((idToken: string | null) => {
    const payload = parseToken(idToken)
    if (!payload) return true
    return payload.exp * 1000 < Date.now()
  }, [parseToken])

  useEffect(() => {
    const initAuth = () => {
      if (token) {
        if (isTokenExpired(token)) {
          logout()
        } else {
          const payload = parseToken(token)
          setIsAdmin(!!payload?.admin)
          setEmailVerified(!!payload?.email_verified)
        }
      }
      setIsLoading(false)
    }
    initAuth()
  }, [token, isTokenExpired, parseToken, logout])

  const login = (idToken: string, userEmail: string) => {
    localStorage.setItem('token', idToken)
    localStorage.setItem('email', userEmail)
    setToken(idToken)
    setEmail(userEmail)
    const payload = parseToken(idToken)
    setIsAdmin(!!payload?.admin)
    setEmailVerified(!!payload?.email_verified)
  }

  return (
    <AuthContext.Provider value={{ token, email, isAdmin, emailVerified, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}

const ProtectedRoute = ({ adminOnly = false, children }: { adminOnly?: boolean, children: React.ReactNode }) => {
  const { token, isAdmin, emailVerified, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900 transition-colors">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!token) return <Navigate to="/signin" replace />
  if (!emailVerified) return <Navigate to="/verify-email" replace />
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />
  return <>{children}</>
}

const ThemeToggle = () => {
  const { theme, setTheme } = useTheme()
  const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light')

  return (
    <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-300 flex items-center justify-center">
      {theme === 'dark' ? (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      ) : (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      )}
    </button>
  )
}

const Navbar = () => {
  const { token, isAdmin, logout, emailVerified, isLoading } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const toggle = () => setIsOpen(!isOpen)

  if (isLoading) return <nav className="h-16 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 transition-colors"></nav>

  return (
    <nav className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 sticky top-0 z-50 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="text-xl font-bold text-blue-600 dark:text-blue-500">Aura</Link>
          </div>

          <div className="hidden sm:flex sm:items-center sm:space-x-6">
            <ThemeToggle />
            <Link to="/" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors">Home</Link>
            {token ? (
              <>
                {emailVerified && isAdmin && <Link to="/admin" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors">Users</Link>}
                <Link to="/settings" title="settings" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors">Settings</Link>
                <button onClick={logout} className="text-red-500 hover:text-red-600 font-medium cursor-pointer transition-colors">Logout</button>
              </>
            ) : (
              <>
                <Link to="/signin" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors">Sign In</Link>
                <Link to="/signup" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all">Sign Up</Link>
              </>
            )}
          </div>

          <div className="flex items-center sm:hidden space-x-2">
            <ThemeToggle />
            <button onClick={toggle} className="text-gray-600 dark:text-gray-300 p-2">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={isOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="sm:hidden bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 pb-4 px-4 space-y-2 flex flex-col transition-colors">
          <Link to="/" onClick={toggle} className="text-gray-600 dark:text-gray-300 py-2">Home</Link>
          {token ? (
            <>
              {emailVerified && isAdmin && <Link to="/admin" onClick={toggle} className="text-gray-600 dark:text-gray-300 py-2">Users</Link>}
              <Link to="/settings" onClick={toggle} className="text-gray-600 dark:text-gray-300 py-2">Settings</Link>
              <button onClick={() => { logout(); toggle() }} className="text-left text-red-500 py-2">Logout</button>
            </>
          ) : (
            <>
              <Link to="/signin" onClick={toggle} className="text-gray-600 dark:text-gray-300 py-2">Sign In</Link>
              <Link to="/signup" onClick={toggle} className="text-blue-600 dark:text-blue-500 py-2 font-bold">Sign Up</Link>
            </>
          )}
        </div>
      )}
    </nav>
  )
}

const AuthForm = ({ title, subtitle, onSubmit, buttonText, loading, status, children }: any) => (
  <div className="flex items-center justify-center min-h-[calc(100vh-64px)] p-4">
    <div className="w-full max-w-md bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 text-left transition-colors">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">{title}</h1>
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">{subtitle}</p>
      {status.message && (
        <div className={`mb-6 p-4 rounded-lg text-sm text-center ${status.type === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
          {status.message}
        </div>
      )}
      <form onSubmit={onSubmit} className="space-y-5">
        {children}
        <button type="submit" disabled={loading} className={`w-full py-3 rounded-xl font-semibold text-white transition-all shadow-md ${loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 active:scale-95'}`}>
          {loading ? 'Processing...' : buttonText}
        </button>
      </form>
    </div>
  </div>
)

const FormInput = (props: any) => (
  <input
    {...props}
    className="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
  />
)

const SignIn = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState({ message: '', type: '' })
  const [unverifiedToken, setUnverifiedToken] = useState<string | null>(null)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    setUnverifiedToken(null)

    try {
      const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
        method: 'POST',
        body: JSON.stringify({ email, password, returnSecureToken: true })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error.message)

      const infoRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
        method: 'POST',
        body: JSON.stringify({ idToken: data.idToken })
      })
      const infoData = await infoRes.json()

      if (!infoData.users?.[0]?.emailVerified) {
        setUnverifiedToken(data.idToken)
        setStatus({ message: 'Email not verified. Please verify your account to log in.', type: 'error' })
        return
      }

      login(data.idToken, data.email)
      navigate('/')
    } catch (err: any) {
      setStatus({ message: getAuthErrorMessage(err.message), type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const resendVerification = async () => {
    if (!unverifiedToken || loading) return
    setLoading(true)
    try {
      const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`, {
        method: 'POST',
        body: JSON.stringify({ requestType: "VERIFY_EMAIL", idToken: unverifiedToken })
      })
      if (!res.ok) throw new Error('Failed to send verification email')
      setStatus({ message: 'Verification email resent! Please check your inbox.', type: 'success' })
      setUnverifiedToken(null)
    } catch (err: any) {
      setStatus({ message: getAuthErrorMessage(err.message), type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthForm title="Sign In" subtitle="Access your account" onSubmit={handleSubmit} buttonText="Login" loading={loading} status={status}>
      <FormInput type="email" required value={email} onChange={(e: any) => setEmail(e.target.value)} placeholder="Email" />
      <FormInput type="password" required value={password} onChange={(e: any) => setPassword(e.target.value)} placeholder="Password" />

      {unverifiedToken && status.type === 'error' && (
        <button type="button" onClick={resendVerification} disabled={loading} className="w-full py-2.5 bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-400 rounded-xl text-sm font-semibold hover:bg-yellow-200 dark:hover:bg-yellow-900/60 transition-colors disabled:opacity-50">
          Resend Verification Email
        </button>
      )}

      <div className="flex justify-between items-center px-1">
        <Link to="/signup" className="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400">Create account</Link>
        <Link to="/auth/action" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">Forgot password?</Link>
      </div>
    </AuthForm>
  )
}

const SignUp = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState({ message: '', type: '' })
  const navigate = useNavigate()

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    try {
      const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
        method: 'POST',
        body: JSON.stringify({ email, password, returnSecureToken: true })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error.message)

      await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`, {
        method: 'POST',
        body: JSON.stringify({ requestType: "VERIFY_EMAIL", idToken: data.idToken })
      })

      setStatus({ message: 'Account created! Check your email for verification.', type: 'success' })
      setTimeout(() => navigate('/signin'), 3000)
    } catch (err: any) {
      setStatus({ message: getAuthErrorMessage(err.message), type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthForm title="Sign Up" subtitle="Create a new account" onSubmit={handleSubmit} buttonText="Register" loading={loading} status={status}>
      <FormInput type="email" required value={email} onChange={(e: any) => setEmail(e.target.value)} placeholder="Email" />
      <FormInput type="password" required value={password} onChange={(e: any) => setPassword(e.target.value)} placeholder="Password (min 6 chars)" />
      <div className="text-center">
        <Link to="/signin" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">Already have an account? Sign In</Link>
      </div>
    </AuthForm>
  )
}

const VerifyEmail = () => {
  const { token, logout, emailVerified, isLoading } = useAuth()
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState({ message: '', type: '' })
  const navigate = useNavigate()

  useEffect(() => {
    if (!isLoading && emailVerified) navigate('/')
  }, [emailVerified, navigate, isLoading])

  const resendEmail = async () => {
    if (loading) return
    setLoading(true)
    try {
      const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`, {
        method: 'POST',
        body: JSON.stringify({ requestType: "VERIFY_EMAIL", idToken: token })
      })
      if (!res.ok) throw new Error('Failed to send email')
      setStatus({ message: 'Verification email resent.', type: 'success' })
    } catch (err: any) {
      setStatus({ message: getAuthErrorMessage(err.message), type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-64px)] p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 text-center transition-colors">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">Verify Your Email</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">Link sent to your inbox. Please verify to continue.</p>
        {status.message && (
          <div className={`mb-6 p-4 rounded-lg text-sm ${status.type === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
            {status.message}
          </div>
        )}
        <div className="space-y-4">
          <button onClick={resendEmail} disabled={loading} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all shadow-md active:scale-95 disabled:opacity-50">
            {loading ? 'Sending...' : 'Resend Email'}
          </button>
          <button onClick={logout} className="w-full py-3 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            Sign Out
          </button>
        </div>
      </div>
    </div>
  )
}

const Settings = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [emailStatus, setEmailStatus] = useState({ message: '', type: '' })
  const [passwordStatus, setPasswordStatus] = useState({ message: '', type: '' })
  const { token } = useAuth()

  const handleEmailSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    if (emailLoading) return
    setEmailLoading(true)
    setEmailStatus({ message: '', type: '' })

    try {
      const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`, {
        method: 'POST',
        body: JSON.stringify({ requestType: "VERIFY_AND_CHANGE_EMAIL", idToken: token, newEmail: email })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error.message)

      setEmailStatus({ message: 'Verification link sent to new email. Please verify to complete the update.', type: 'success' })
      setEmail('')
    } catch (err: any) {
      setEmailStatus({ message: getAuthErrorMessage(err.message), type: 'error' })
    } finally {
      setEmailLoading(false)
    }
  }

  const handlePasswordSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    if (passwordLoading) return
    setPasswordLoading(true)
    setPasswordStatus({ message: '', type: '' })

    try {
      const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:update?key=${apiKey}`, {
        method: 'POST',
        body: JSON.stringify({ idToken: token, password, returnSecureToken: true })
      })
      if (!res.ok) throw new Error('Update failed')
      setPasswordStatus({ message: 'Password updated successfully.', type: 'success' })
      setPassword('')
    } catch (err: any) {
      setPasswordStatus({ message: getAuthErrorMessage(err.message), type: 'error' })
    } finally {
      setPasswordLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 sm:p-8 text-left space-y-6">
      <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-white transition-colors">Account Settings</h1>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 transition-colors">
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">Change Email Address</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Update the email associated with your account. A verification link will be sent to the new address.</p>

        {emailStatus.message && (
          <div className={`mb-6 p-4 rounded-lg text-sm ${emailStatus.type === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
            {emailStatus.message}
          </div>
        )}

        <form onSubmit={handleEmailSubmit} className="max-w-md space-y-4">
          <FormInput type="email" required value={email} onChange={(e: any) => setEmail(e.target.value)} placeholder="New Email Address" />
          <button type="submit" disabled={emailLoading} className={`px-6 py-2.5 rounded-xl font-semibold text-white transition-all shadow-md ${emailLoading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 active:scale-95'}`}>
            {emailLoading ? 'Processing...' : 'Update Email'}
          </button>
        </form>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 transition-colors">
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">Change Password</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Ensure your account uses a long, random password to stay secure.</p>

        {passwordStatus.message && (
          <div className={`mb-6 p-4 rounded-lg text-sm ${passwordStatus.type === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
            {passwordStatus.message}
          </div>
        )}

        <form onSubmit={handlePasswordSubmit} className="max-w-md space-y-4">
          <FormInput type="password" required minLength={6} value={password} onChange={(e: any) => setPassword(e.target.value)} placeholder="New Password" />
          <button type="submit" disabled={passwordLoading} className={`px-6 py-2.5 rounded-xl font-semibold text-white transition-all shadow-md ${passwordLoading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 active:scale-95'}`}>
            {passwordLoading ? 'Processing...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  )
}

const ActionHandler = () => {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [status, setStatus] = useState({ message: '', type: '' })
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const query = new URLSearchParams(useLocation().search)
  const mode = query.get('mode')
  const oobCode = query.get('oobCode')

  const hasFired = useRef(false)

  useEffect(() => {
    if ((mode === 'verifyEmail' || mode === 'verifyAndChangeEmail') && oobCode && !hasFired.current) {
      hasFired.current = true
      handleVerifyEmail()
    }
  }, [mode, oobCode])

  const handleVerifyEmail = async () => {
    setLoading(true)
    try {
      const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:update?key=${apiKey}`, {
        method: 'POST',
        body: JSON.stringify({ oobCode })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message || 'Verification failed. Link may be expired.')

      setStatus({ message: 'Email verified successfully! Redirecting to login...', type: 'success' })
      setTimeout(() => navigate('/signin'), 3000)
    } catch (err: any) {
      setStatus({ message: getAuthErrorMessage(err.message), type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    if (loading) return
    if (password !== confirmPassword) { setStatus({ message: 'Passwords do not match.', type: 'error' }); return }
    setLoading(true)
    try {
      const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:resetPassword?key=${apiKey}`, {
        method: 'POST',
        body: JSON.stringify({ oobCode, newPassword: password }),
      })
      const data = await res.json()
      if (res.ok) {
        setStatus({ message: 'Success! Redirecting...', type: 'success' })
        setTimeout(() => navigate('/signin'), 3000)
      } else throw new Error(data.error?.message || 'Failed to reset')
    } catch (err: any) {
      setStatus({ message: getAuthErrorMessage(err.message), type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  if (mode === 'verifyEmail' || mode === 'verifyAndChangeEmail') {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-64px)] p-4">
        <div className="w-full max-w-md bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 text-center transition-colors">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">Verifying Email</h1>
          {status.message && (
            <div className={`p-4 rounded-lg text-sm ${status.type === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
              {status.message}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (mode === 'resetPassword' && oobCode) {
    return (
      <AuthForm title="New Password" subtitle="Enter your new password" onSubmit={handleReset} buttonText="Reset Password" loading={loading} status={status}>
        <FormInput type="password" required value={password} onChange={(e: any) => setPassword(e.target.value)} placeholder="New Password" />
        <FormInput type="password" required value={confirmPassword} onChange={(e: any) => setConfirmPassword(e.target.value)} placeholder="Confirm Password" />
      </AuthForm>
    )
  }

  return (
    <AuthForm title="Password Reset" subtitle="Request link via email" onSubmit={async (e: any) => {
      e.preventDefault()
      if (loading) return
      setLoading(true)
      try {
        const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`, {
          method: 'POST',
          body: JSON.stringify({ requestType: 'PASSWORD_RESET', email: e.target[0].value })
        })
        if (res.ok) setStatus({ message: 'Reset link sent! Check your inbox.', type: 'success' })
        else throw new Error('Failed to send link')
      } catch (err: any) {
        setStatus({ message: getAuthErrorMessage(err.message), type: 'error' })
      } finally {
        setLoading(false)
      }
    }} buttonText="Send Reset Link" loading={loading} status={status}>
      <FormInput type="email" required placeholder="Email Address" />
    </AuthForm>
  )
}

const Admin = () => {
  const [users, setUsers] = useState<any[]>([])
  const [error, setError] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const { token, email: currentEmail, isLoading } = useAuth()
  const lastFetchToken = useRef<string | null>(null)

  const fetchUsers = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch(`${apiUrl}/admin/users`, { headers: { 'Authorization': `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setUsers(data || [])
      else setError(data.error || 'Failed to fetch users')
    } catch (err) {
      setError('Network error. Check backend availability.')
    }
  }, [token])

  useEffect(() => {
    if (isLoading || !token || lastFetchToken.current === token) return
    lastFetchToken.current = token
    fetchUsers()
  }, [fetchUsers, token, isLoading])

  const toggleAdmin = async (uid: string, isAdmin: boolean) => {
    if (isProcessing) return
    setIsProcessing(true)
    setError('')
    try {
      const res = await fetch(`${apiUrl}/admin/users`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, admin: !isAdmin })
      })
      if (res.ok) await fetchUsers()
      else {
        const data = await res.json()
        setError(data.error || 'Action failed')
      }
    } catch (err) {
      setError('Network error')
    } finally {
      setIsProcessing(false)
    }
  }

  const deleteUser = async (uid: string) => {
    if (isProcessing) return
    setIsProcessing(true)
    setError('')
    try {
      const res = await fetch(`${apiUrl}/admin/users?uid=${uid}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        setUsers(users.filter(u => u.uid !== uid))
        setConfirmingDelete(null)
      } else {
        const data = await res.json()
        setError(data.error || 'Delete failed')
      }
    } catch (err) {
      setError('Network error')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-8 text-left">
      <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white transition-colors">User Management</h1>
      {error && <div className="mb-4 p-3 bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded-lg text-sm">{error}</div>}

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 text-sm transition-colors">
              <tr>
                <th className="px-6 py-4 font-semibold text-left">Email</th>
                <th className="px-6 py-4 font-semibold text-left">Verified</th>
                <th className="px-6 py-4 font-semibold text-left">Role</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {users.map(user => (
                <tr key={user.uid} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-6 py-4 text-gray-900 dark:text-gray-100">{user.email}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${user.emailVerified ? 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-50 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>
                      {user.emailVerified ? 'Verified' : 'Pending'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${user.admin ? 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                      {user.admin ? 'Admin' : 'User'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2 flex-wrap">
                      {user.email !== currentEmail && (
                        <>
                          <button onClick={() => toggleAdmin(user.uid, user.admin)} disabled={isProcessing} className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors cursor-pointer disabled:opacity-50">
                            Toggle Role
                          </button>
                          {confirmingDelete === user.uid ? (
                            <div className="inline-flex gap-2 items-center">
                              <button onClick={() => deleteUser(user.uid)} disabled={isProcessing} className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors shadow-sm cursor-pointer disabled:opacity-50">Confirm</button>
                              <button onClick={() => setConfirmingDelete(null)} disabled={isProcessing} className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors cursor-pointer disabled:opacity-50">Cancel</button>
                            </div>
                          ) : (
                            <button onClick={() => setConfirmingDelete(user.uid)} disabled={isProcessing} className="px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm font-medium hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors cursor-pointer disabled:opacity-50">
                              Delete
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

const Home = () => {
  const { token, email, emailVerified, isLoading } = useAuth()
  const [quote, setQuote] = useState({ text: '', author: '' })
  const quoteSet = useRef(false)

  const quotes = [
    { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
    { text: "Simplicity is the ultimate sophistication.", author: "Leonardo da Vinci" },
    { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" }
  ]

  useEffect(() => {
    if (quoteSet.current) return
    quoteSet.current = true
    setQuote(quotes[Math.floor(Math.random() * quotes.length)])
  }, [])

  if (isLoading) {
    return <div className="min-h-[calc(100vh-64px)] flex items-center justify-center"></div>
  }

  return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-2xl w-full">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-8 transition-colors break-words">
          Welcome {token ? <span>back, <span className="break-all text-blue-600 dark:text-blue-500">{email}</span></span> : 'to Aura'}
        </h1>
        {token && !emailVerified && (
          <div className="mb-8 p-4 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800/50 rounded-2xl text-yellow-800 dark:text-yellow-400 text-sm text-left">
            Email not verified. <Link to="/verify-email" className="font-bold underline">Verify now.</Link>
          </div>
        )}
        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-10 rounded-3xl shadow-sm mb-10 transition-colors">
          <p className="text-2xl italic text-gray-700 dark:text-gray-300 mb-4 font-serif">"{quote.text}"</p>
          <p className="text-gray-500 dark:text-gray-400 font-medium">— {quote.author}</p>
        </div>
        {!token && (
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/signin" className="px-8 py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-lg active:scale-95">
              Get Started
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

const AppContent = () => (
  <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-200 font-sans">
    <Navbar />
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/signin" element={<SignIn />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/auth/action" element={<ActionHandler />} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute adminOnly={true}><Admin /></ProtectedRoute>} />
    </Routes>
  </div>
)

const App = () => (
  <ThemeProvider>
    <HashRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </HashRouter>
  </ThemeProvider>
)

export default App