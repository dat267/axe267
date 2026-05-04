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
  if (msg.includes('EMAIL_EXISTS')) return 'Account already exists.'
  return 'An error occurred.'
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
  if (!context) throw new Error('useTheme error')
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

  useEffect(() => {
    if (token) {
      const payload = parseToken(token)
      if (payload && payload.exp * 1000 < Date.now()) {
        logout()
      } else if (payload) {
        setIsAdmin(!!payload.admin)
        setEmailVerified(!!payload.email_verified)
      }
    }
    setIsLoading(false)
  }, [token, parseToken, logout])

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
  if (!context) throw new Error('useAuth error')
  return context
}

const ProtectedRoute = ({ adminOnly = false, children }: { adminOnly?: boolean, children: React.ReactNode }) => {
  const { token, isAdmin, emailVerified, isLoading } = useAuth()
  if (isLoading) return null
  if (!token) return <Navigate to="/signin" replace />
  if (!emailVerified) return <Navigate to="/verify-email" replace />
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />
  return <>{children}</>
}

const IconSun = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
)

const IconMoon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
  </svg>
)

const IconMenu = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
  </svg>
)

const IconClose = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
)

const IconFolderPlus = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
  </svg>
)

const Navbar = () => {
  const { token, isAdmin, logout, emailVerified, isLoading } = useAuth()
  const { theme, setTheme } = useTheme()
  const [isOpen, setIsOpen] = useState(false)

  const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light')

  if (isLoading) return null

  return (
    <nav className="bg-white dark:bg-black border-b border-gray-100 dark:border-gray-900 sticky top-0 z-50">
      <div className="max-w-4xl mx-auto px-6">
        <div className="flex justify-between h-14 items-center">
          <Link to="/" className="opacity-60 hover:opacity-100 transition-opacity" aria-label="Aura Home">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 12l10 10 10-10L12 2z" />
              <path d="M12 2v20" />
              <path d="M2 12h20" />
            </svg>
          </Link>

          <div className="hidden sm:flex items-center space-x-6 text-sm">
            <button onClick={toggleTheme} className="text-gray-400 hover:text-black dark:hover:text-white transition-colors">
              {theme === 'dark' ? <IconSun /> : <IconMoon />}
            </button>
            <Link to="/" className="text-gray-500 hover:text-black dark:hover:text-white transition-colors">Home</Link>
            {token ? (
              <>
                {emailVerified && isAdmin && <Link to="/admin" className="text-gray-500 hover:text-black dark:hover:text-white transition-colors">Users</Link>}
                <Link to="/settings" className="text-gray-500 hover:text-black dark:hover:text-white transition-colors">Settings</Link>
                <button onClick={logout} className="text-red-500 hover:text-red-600 transition-colors">Logout</button>
              </>
            ) : (
              <>
                <Link to="/signin" className="font-bold">Sign In</Link>
                <Link to="/signup" className="font-bold">Sign Up</Link>
              </>
            )}
          </div>

          <div className="sm:hidden flex items-center space-x-4">
            <button onClick={toggleTheme} className="text-gray-400">
              {theme === 'dark' ? <IconSun /> : <IconMoon />}
            </button>
            <button onClick={() => setIsOpen(!isOpen)} className="text-gray-400">
              {isOpen ? <IconClose /> : <IconMenu />}
            </button>
          </div>
        </div>
      </div>
      {isOpen && (
        <div className="sm:hidden bg-white dark:bg-black p-6 space-y-4 flex flex-col text-sm border-b border-gray-100 dark:border-gray-900">
          <Link to="/" onClick={() => setIsOpen(false)}>Home</Link>
          {token ? (
            <>
              {emailVerified && isAdmin && <Link to="/admin" onClick={() => setIsOpen(false)}>Users</Link>}
              <Link to="/settings" onClick={() => setIsOpen(false)}>Settings</Link>
              <button onClick={() => { logout(); setIsOpen(false) }} className="text-left text-red-500">Logout</button>
            </>
          ) : (
            <>
              <Link to="/signin" onClick={() => setIsOpen(false)} className="font-bold">Sign In</Link>
              <Link to="/signup" onClick={() => setIsOpen(false)} className="font-bold">Sign Up</Link>
            </>
          )}
        </div>
      )}
    </nav>
  )
}

const FileBrowser = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const currentPath = location.pathname

  const [files, setFiles] = useState<any[]>([])
  const [error, setError] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [isLoadingFiles, setIsLoadingFiles] = useState(false)
  const [viewingFile, setViewingFile] = useState<{ name: string, type: 'text' | 'image' | 'other', content: string } | null>(null)

  const { token, isAdmin, emailVerified } = useAuth()

  useEffect(() => {
    const currentUrl = viewingFile?.type === 'image' ? viewingFile.content : null
    return () => {
      if (currentUrl) URL.revokeObjectURL(currentUrl)
    }
  }, [viewingFile])

  const sortFiles = (arr: any[]) => {
    return [...arr].sort((a, b) => {
      if (a.is_dir && !b.is_dir) return -1
      if (!a.is_dir && b.is_dir) return 1
      return a.name.localeCompare(b.name)
    })
  }

  const fetchFiles = useCallback(async () => {
    setIsLoadingFiles(true)
    setError('')
    setViewingFile(null)
    setFiles([])

    try {
      const encodedPath = currentPath.split('/').map(encodeURIComponent).join('/')
      const res = await fetch(`${apiUrl}${encodedPath}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Failed to fetch')
        return
      }

      const contentType = res.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        const data = await res.json()
        setFiles(sortFiles(data.files || []))
      } else if (contentType.startsWith('image/')) {
        const blob = await res.blob()
        setViewingFile({ name: currentPath.split('/').pop() || '', type: 'image', content: URL.createObjectURL(blob) })
      } else if (contentType.startsWith('text/') || currentPath.match(/\.(txt|md|js|ts|tsx|go|json|html|css|log)$/)) {
        const text = await res.text()
        setViewingFile({ name: currentPath.split('/').pop() || '', type: 'text', content: text })
      } else {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = currentPath.split('/').pop() || 'download'
        a.click()
        URL.revokeObjectURL(url)

        const parts = currentPath.split('/').filter(Boolean)
        parts.pop()
        navigate('/' + parts.join('/') + (parts.length ? '/' : ''), { replace: true })
      }
    } catch {
      setError('Connection error')
    } finally {
      setIsLoadingFiles(false)
    }
  }, [currentPath, token, navigate])

  const lastPathRef = useRef<string | null>(null)

  useEffect(() => {
    const key = `${currentPath}-${token}`
    if (lastPathRef.current === key) return
    lastPathRef.current = key
    fetchFiles()
  }, [fetchFiles, currentPath, token])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || isProcessing) return
    setIsProcessing(true)
    const formData = new FormData()
    formData.append('file', file)
    try {
      const encodedPath = currentPath.split('/').map(encodeURIComponent).join('/')
      const res = await fetch(`${apiUrl}${encodedPath}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      })
      if (res.ok) fetchFiles()
      else setError('Upload failed')
    } catch {
      setError('Upload error')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCreateFolder = async () => {
    const name = window.prompt('Folder name:')
    if (!name || isProcessing) return
    setIsProcessing(true)
    try {
      const encodedPath = currentPath.split('/').map(encodeURIComponent).join('/')
      const encodedName = encodeURIComponent(name)
      const target = currentPath.endsWith('/') ? `${encodedPath}${encodedName}/` : `${encodedPath}/${encodedName}/`
      const res = await fetch(`${apiUrl}${target}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) fetchFiles()
      else setError('Folder creation failed')
    } catch {
      setError('Error')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDelete = async (name: string) => {
    if (!window.confirm(`Delete ${name}?`)) return
    try {
      const encodedPath = currentPath.split('/').map(encodeURIComponent).join('/')
      const encodedName = encodeURIComponent(name)
      const target = currentPath.endsWith('/') ? `${encodedPath}${encodedName}` : `${encodedPath}/${encodedName}`
      const res = await fetch(`${apiUrl}${target}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) fetchFiles()
      else setError('Delete failed')
    } catch {
      setError('Delete error')
    }
  }

  const goUp = () => {
    const parts = currentPath.split('/').filter(Boolean)
    parts.pop()
    navigate('/' + parts.join('/') + (parts.length ? '/' : ''))
  }

  if (viewingFile) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-sm font-bold opacity-50 truncate">{viewingFile.name}</h2>
          <button onClick={goUp} className="text-sm font-bold">Back</button>
        </div>
        <div className="dark:bg-black">
          {viewingFile.type === 'image' ? (
            <img src={viewingFile.content} alt={viewingFile.name} className="w-full h-auto block" />
          ) : (
            <pre className="text-xs font-mono overflow-auto max-h-[80vh] whitespace-pre-wrap leading-relaxed">{viewingFile.content}</pre>
          )}
        </div>
      </div>
    )
  }

  const pathParts = currentPath.split('/').filter(Boolean)
  const displayBreadcrumbs = [{ name: '/', path: '/' }]

  if (pathParts.length <= 2) {
    displayBreadcrumbs.push(...pathParts.map((part, idx) => ({
      name: part,
      path: '/' + pathParts.slice(0, idx + 1).join('/') + '/'
    })))
  } else {
    displayBreadcrumbs.push(
      { name: '...', path: '/' + pathParts.slice(0, -1).join('/') + '/' },
      { name: pathParts[pathParts.length - 1], path: '/' + pathParts.join('/') + '/' }
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center mb-8 gap-4">
        <div className="flex overflow-x-auto items-center gap-2 text-lg font-bold min-w-0 flex-1 whitespace-nowrap [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {displayBreadcrumbs.map((bc, idx) => (
            <React.Fragment key={`${bc.path}-${idx}`}>
              {idx > 1 && <span className="opacity-30 shrink-0">/</span>}
              <button
                onClick={() => navigate(bc.path)}
                title={bc.name}
                className={`block truncate max-w-[120px] sm:max-w-[200px] md:max-w-xs hover:underline transition-opacity ${idx === displayBreadcrumbs.length - 1 ? '' : 'opacity-50 hover:opacity-100'}`}
              >
                {bc.name}
              </button>
            </React.Fragment>
          ))}
        </div>
        <div className="flex items-center space-x-4 shrink-0">
          {token && (
            <button onClick={handleCreateFolder} className="text-gray-400 hover:text-black dark:hover:text-white transition-colors">
              <IconFolderPlus />
            </button>
          )}
          {isAdmin && (
            <label className="text-xs font-bold cursor-pointer hover:underline">
              {isProcessing ? '...' : 'Upload'}
              <input type="file" className="hidden" onChange={handleUpload} disabled={isProcessing} />
            </label>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-8 p-4 border border-red-100 dark:border-red-900 bg-red-50 dark:bg-red-900/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <span className="text-xs text-red-500 font-bold uppercase tracking-widest">{error}</span>
          {token && !emailVerified && (
            <Link to="/verify-email" className="text-[10px] font-bold uppercase tracking-widest px-4 py-2 border border-black dark:border-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors whitespace-nowrap">
              Verify Account
            </Link>
          )}
        </div>
      )}

      <div className="divide-y divide-gray-100 dark:divide-gray-900 border-t border-gray-100 dark:border-gray-900">
        {isLoadingFiles ? (
          <div className="py-12 text-sm text-gray-400">Loading...</div>
        ) : (
          <>
            {currentPath !== '/' && (
              <div className="flex items-center justify-between py-4 group">
                <div className="flex items-center space-x-4 min-w-0 flex-1 cursor-pointer" onClick={goUp}>
                  <span className="text-lg opacity-40">📁</span>
                  <div className="min-w-0">
                    <p className="text-sm hover:underline truncate">..</p>
                  </div>
                </div>
              </div>
            )}
            {files.length === 0 && currentPath === '/' && (
              <div className="py-12 text-sm text-gray-400">Directory is empty</div>
            )}
            {files.map(f => (
              <div key={f.name} className="flex items-center justify-between py-4 group">
                <div className="flex items-center space-x-4 min-w-0 flex-1 cursor-pointer" onClick={() => {
                  const next = currentPath.endsWith('/') ? `${currentPath}${f.name}` : `${currentPath}/${f.name}`
                  navigate(f.is_dir ? `${next}/` : next)
                }}>
                  <span className="text-lg opacity-40">{f.is_dir ? '📁' : '📄'}</span>
                  <div className="min-w-0">
                    <p className="text-sm hover:underline truncate">{f.name}</p>
                    {!f.is_dir && <p className="text-[10px] opacity-40 uppercase">{(f.size / 1024).toFixed(0)} KB</p>}
                  </div>
                </div>
                {isAdmin && (
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(f.name) }} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity">
                    <IconClose />
                  </button>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

const SignIn = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
        method: 'POST',
        body: JSON.stringify({ email, password, returnSecureToken: true })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error.message)
      login(data.idToken, data.email)
      navigate('/')
    } catch (err: any) {
      setError(getAuthErrorMessage(err.message))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-20 px-6 animate-in slide-in-from-top-4 duration-500">
      <h2 className="text-2xl font-bold mb-8">Sign In</h2>
      {error && <div className="mb-6 text-xs text-red-500 font-bold uppercase">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-6">
        <input type="email" placeholder="EMAIL" required className="w-full py-3 bg-transparent border-b border-gray-200 dark:border-gray-800 text-sm outline-none focus:border-black dark:focus:border-white transition-colors" value={email} onChange={e => setEmail(e.target.value)} />
        <input type="password" placeholder="PASSWORD" required className="w-full py-3 bg-transparent border-b border-gray-200 dark:border-gray-800 text-sm outline-none focus:border-black dark:focus:border-white transition-colors" value={password} onChange={e => setPassword(e.target.value)} />
        <button disabled={loading} className="w-full py-4 text-xs font-bold uppercase tracking-widest border border-black dark:border-white hover:bg-black dark:hover:bg-white hover:text-white dark:hover:text-black transition-all disabled:opacity-50">
          {loading ? '...' : 'Access Account'}
        </button>
        <div className="flex flex-col space-y-4 text-center pt-4">
          <Link to="/auth/action" className="text-xs font-bold uppercase tracking-widest opacity-50 hover:opacity-100 transition-opacity">Forgot password?</Link>
          <Link to="/signup" className="text-xs font-bold uppercase tracking-widest opacity-50 hover:opacity-100 transition-opacity">Create an account</Link>
        </div>
      </form>
    </div>
  )
}

const SignUp = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState({ message: '', type: '' })
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
        method: 'POST',
        body: JSON.stringify({ email, password, returnSecureToken: true })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error.message)
      setStatus({ message: 'Account created! Redirecting...', type: 'success' })
      setTimeout(() => navigate('/signin'), 2000)
    } catch (err: any) {
      setStatus({ message: getAuthErrorMessage(err.message), type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-20 px-6 animate-in slide-in-from-top-4 duration-500">
      <h2 className="text-2xl font-bold mb-8">Sign Up</h2>
      {status.message && <div className={`mb-6 text-xs font-bold uppercase ${status.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>{status.message}</div>}
      <form onSubmit={handleSubmit} className="space-y-6">
        <input type="email" placeholder="EMAIL" required className="w-full py-3 bg-transparent border-b border-gray-200 dark:border-gray-800 text-sm outline-none focus:border-black dark:focus:border-white transition-colors" value={email} onChange={e => setEmail(e.target.value)} />
        <input type="password" placeholder="PASSWORD" required minLength={6} className="w-full py-3 bg-transparent border-b border-gray-200 dark:border-gray-800 text-sm outline-none focus:border-black dark:focus:border-white transition-colors" value={password} onChange={e => setPassword(e.target.value)} />
        <button disabled={loading} className="w-full py-4 text-xs font-bold uppercase tracking-widest border border-black dark:border-white hover:bg-black dark:hover:bg-white hover:text-white dark:hover:text-black transition-all disabled:opacity-50">
          {loading ? '...' : 'Create Account'}
        </button>
        <div className="text-center pt-4">
          <Link to="/signin" className="text-xs font-bold uppercase tracking-widest opacity-50 hover:opacity-100 transition-opacity">Already have an account?</Link>
        </div>
      </form>
    </div>
  )
}

const Admin = () => {
  const [users, setUsers] = useState<any[]>([])
  const [error, setError] = useState('')
  const { token } = useAuth()

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/admin/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) setUsers(data || [])
      else setError('Denied')
    } catch {
      setError('Connection error')
    }
  }, [token])

  const lastAdminRef = useRef<string | null>(null)

  useEffect(() => {
    if (lastAdminRef.current === token) return
    lastAdminRef.current = token || ''
    fetchUsers()
  }, [fetchUsers, token])

  const toggle = async (uid: string, isAdmin: boolean) => {
    try {
      const res = await fetch(`${apiUrl}/admin/users`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, admin: !isAdmin })
      })
      if (res.ok) {
        setUsers(prev => prev.map(u => u.uid === uid ? { ...u, admin: !isAdmin } : u))
      } else {
        const data = await res.json()
        setError(data.error || 'Toggle failed')
      }
    } catch {
      setError('Connection error')
    }
  }

  const remove = async (uid: string) => {
    if (!window.confirm('Delete user?')) return
    try {
      const res = await fetch(`${apiUrl}/admin/users?uid=${uid}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        setUsers(prev => prev.filter(u => u.uid !== uid))
      } else {
        const data = await res.json()
        setError(data.error || 'Delete failed')
      }
    } catch {
      setError('Connection error')
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 animate-in fade-in duration-300">
      <h1 className="text-lg font-bold mb-8">Users</h1>
      {error && <div className="mb-8 text-xs text-red-500 font-bold uppercase tracking-widest">{error}</div>}
      <div className="divide-y divide-gray-100 dark:divide-gray-900 border-t border-gray-100 dark:border-gray-900">
        {users.map(u => (
          <div key={u.uid} className="py-4 flex justify-between items-center group">
            <div className="min-w-0 flex-1">
              <p className="text-sm truncate">{u.email}</p>
              <p className="text-[10px] opacity-40 uppercase tracking-tighter">{u.admin ? 'Admin' : 'Standard'}</p>
            </div>
            <div className="flex items-center space-x-2">
              <button onClick={() => toggle(u.uid, u.admin)} className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 border border-gray-200 dark:border-gray-800 hover:bg-black dark:hover:bg-white hover:text-white dark:hover:text-black transition-colors">
                Role
              </button>
              <button onClick={() => remove(u.uid)} className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 border border-gray-200 dark:border-gray-800 hover:bg-red-500 hover:text-white hover:border-red-500 transition-colors">
                Delete
              </button>
            </div>
          </div>
        ))}
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

  const handleEmailSubmit = async (e: React.FormEvent) => {
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

      setEmailStatus({ message: 'Verification link sent to new email.', type: 'success' })
      setEmail('')
    } catch (err: any) {
      setEmailStatus({ message: getAuthErrorMessage(err.message), type: 'error' })
    } finally {
      setEmailLoading(false)
    }
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
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
    <div className="max-w-4xl mx-auto p-6 animate-in fade-in duration-300">
      <h1 className="text-lg font-bold mb-12">Settings</h1>

      <div className="max-w-md space-y-12">
        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest mb-6 opacity-50">Change Email</h2>
          {emailStatus.message && (
            <div className={`mb-6 text-xs font-bold uppercase ${emailStatus.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>
              {emailStatus.message}
            </div>
          )}
          <form onSubmit={handleEmailSubmit} className="space-y-6">
            <input type="email" placeholder="NEW EMAIL" required className="w-full py-3 bg-transparent border-b border-gray-200 dark:border-gray-800 text-sm outline-none focus:border-black dark:focus:border-white transition-colors" value={email} onChange={e => setEmail(e.target.value)} />
            <button type="submit" disabled={emailLoading} className="w-full py-4 text-xs font-bold uppercase tracking-widest border border-black dark:border-white hover:bg-black dark:hover:bg-white hover:text-white dark:hover:text-black transition-all disabled:opacity-50">
              {emailLoading ? '...' : 'Update Email'}
            </button>
          </form>
        </section>

        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest mb-6 opacity-50">Change Password</h2>
          {passwordStatus.message && (
            <div className={`mb-6 text-xs font-bold uppercase ${passwordStatus.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>
              {passwordStatus.message}
            </div>
          )}
          <form onSubmit={handlePasswordSubmit} className="space-y-6">
            <input type="password" placeholder="NEW PASSWORD" required minLength={6} className="w-full py-3 bg-transparent border-b border-gray-200 dark:border-gray-800 text-sm outline-none focus:border-black dark:focus:border-white transition-colors" value={password} onChange={e => setPassword(e.target.value)} />
            <button type="submit" disabled={passwordLoading} className="w-full py-4 text-xs font-bold uppercase tracking-widest border border-black dark:border-white hover:bg-black dark:hover:bg-white hover:text-white dark:hover:text-black transition-all disabled:opacity-50">
              {passwordLoading ? '...' : 'Update Password'}
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}

const VerifyEmail = () => {
  const { token, logout, emailVerified, isLoading } = useAuth()
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState({ message: '', type: '' })
  const [cooldown, setCooldown] = useState(0)
  const autoSent = useRef(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (!isLoading && emailVerified) navigate('/')
  }, [emailVerified, navigate, isLoading])

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(c => c - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [cooldown])

  const sendEmail = useCallback(async (isManual = false) => {
    if (loading || (isManual && cooldown > 0)) return
    setLoading(true)
    try {
      const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`, {
        method: 'POST',
        body: JSON.stringify({ requestType: "VERIFY_EMAIL", idToken: token })
      })
      if (!res.ok) throw new Error('Failed to send email')
      setStatus({ message: isManual ? 'Verification email resent.' : 'Verification email sent.', type: 'success' })
      if (isManual) setCooldown(60)
    } catch (err: any) {
      setStatus({ message: getAuthErrorMessage(err.message), type: 'error' })
    } finally {
      setLoading(false)
    }
  }, [cooldown, loading, token])

  useEffect(() => {
    if (token && !emailVerified && !isLoading && !autoSent.current) {
      autoSent.current = true
      sendEmail(false)
    }
  }, [token, emailVerified, isLoading, sendEmail])

  return (
    <div className="max-w-sm mx-auto mt-20 px-6 animate-in slide-in-from-top-4 duration-500 text-center">
      <h2 className="text-2xl font-bold mb-8">Verify Email</h2>
      <p className="text-xs uppercase tracking-widest opacity-50 mb-8">Link sent to your inbox.</p>
      {status.message && <div className={`mb-6 text-xs font-bold uppercase ${status.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>{status.message}</div>}
      <div className="space-y-4">
        <button onClick={() => sendEmail(true)} disabled={loading || cooldown > 0} className="w-full py-4 text-xs font-bold uppercase tracking-widest border border-black dark:border-white hover:bg-black dark:hover:bg-white hover:text-white dark:hover:text-black transition-all disabled:opacity-50">
          {loading ? '...' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Email'}
        </button>
        <button onClick={logout} className="w-full py-4 text-xs font-bold uppercase tracking-widest opacity-50 hover:opacity-100 transition-opacity">
          Sign Out
        </button>
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

  const handleVerifyEmail = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:update?key=${apiKey}`, {
        method: 'POST',
        body: JSON.stringify({ oobCode })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message || 'Verification failed. Link may be expired.')

      setStatus({ message: 'Email verified! Redirecting...', type: 'success' })
      setTimeout(() => navigate('/signin'), 3000)
    } catch (err: any) {
      setStatus({ message: getAuthErrorMessage(err.message), type: 'error' })
    } finally {
      setLoading(false)
    }
  }, [oobCode, navigate])

  useEffect(() => {
    if ((mode === 'verifyEmail' || mode === 'verifyAndChangeEmail') && oobCode && !hasFired.current) {
      hasFired.current = true
      handleVerifyEmail()
    }
  }, [mode, oobCode, handleVerifyEmail])

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    if (password !== confirmPassword) { setStatus({ message: 'Passwords mismatch.', type: 'error' }); return }
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
      <div className="max-w-sm mx-auto mt-20 px-6 animate-in slide-in-from-top-4 duration-500 text-center">
        <h2 className="text-2xl font-bold mb-8">Verifying Email</h2>
        {status.message && <div className={`text-xs font-bold uppercase ${status.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>{status.message}</div>}
      </div>
    )
  }

  if (mode === 'resetPassword' && oobCode) {
    return (
      <div className="max-w-sm mx-auto mt-20 px-6 animate-in slide-in-from-top-4 duration-500">
        <h2 className="text-2xl font-bold mb-8">New Password</h2>
        {status.message && <div className={`mb-6 text-xs font-bold uppercase ${status.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>{status.message}</div>}
        <form onSubmit={handleReset} className="space-y-6">
          <input type="password" placeholder="NEW PASSWORD" required value={password} onChange={e => setPassword(e.target.value)} className="w-full py-3 bg-transparent border-b border-gray-200 dark:border-gray-800 text-sm outline-none focus:border-black dark:focus:border-white transition-colors" />
          <input type="password" placeholder="CONFIRM PASSWORD" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full py-3 bg-transparent border-b border-gray-200 dark:border-gray-800 text-sm outline-none focus:border-black dark:focus:border-white transition-colors" />
          <button disabled={loading} className="w-full py-4 text-xs font-bold uppercase tracking-widest border border-black dark:border-white hover:bg-black dark:hover:bg-white hover:text-white dark:hover:text-black transition-all">
            {loading ? '...' : 'Reset Password'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="max-w-sm mx-auto mt-20 px-6 animate-in slide-in-from-top-4 duration-500">
      <h2 className="text-2xl font-bold mb-8">Password Reset</h2>
      {status.message && <div className={`mb-6 text-xs font-bold uppercase ${status.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>{status.message}</div>}
      <form onSubmit={async e => {
        e.preventDefault()
        if (loading) return
        setLoading(true)
        try {
          const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`, {
            method: 'POST',
            // @ts-ignore
            body: JSON.stringify({ requestType: 'PASSWORD_RESET', email: e.target[0].value })
          })
          if (res.ok) setStatus({ message: 'Reset link sent! Check your inbox.', type: 'success' })
          else throw new Error('Failed to send link')
        } catch (err: any) {
          setStatus({ message: getAuthErrorMessage(err.message), type: 'error' })
        } finally {
          setLoading(false)
        }
      }} className="space-y-6">
        <input type="email" placeholder="EMAIL ADDRESS" required className="w-full py-3 bg-transparent border-b border-gray-200 dark:border-gray-800 text-sm outline-none focus:border-black dark:focus:border-white transition-colors" />
        <button disabled={loading} className="w-full py-4 text-xs font-bold uppercase tracking-widest border border-black dark:border-white hover:bg-black dark:hover:bg-white hover:text-white dark:hover:text-black transition-all">
          {loading ? '...' : 'Send Reset Link'}
        </button>
      </form>
    </div>
  )
}

const AppContent = () => (
  <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white transition-colors duration-500 font-sans selection:bg-gray-100 dark:selection:bg-gray-900">
    <Navbar />
    <main className="pb-20">
      <Routes>
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/auth/action" element={<ActionHandler />} />
        <Route path="/admin" element={<ProtectedRoute adminOnly={true}><Admin /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/*" element={<FileBrowser />} />
      </Routes>
    </main>
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