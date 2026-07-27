import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FiEye, FiEyeOff } from 'react-icons/fi'
import { authAPI } from '../api'
import { useAuthStore } from '../store'
import toast from 'react-hot-toast'

export default function RegisterPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' })
  const [showPw, setShowPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})

  const validate = () => {
    const e = {}
    if (!form.name.trim() || form.name.trim().length < 2) e.name = 'Name must be at least 2 characters'
    if (!form.email.trim()) {
      e.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      e.email = 'Enter a valid email address'
    }
    if (!form.password) {
      e.password = 'Password is required'
    } else if (form.password.length < 6) {
      e.password = 'Password must be at least 6 characters'
    }
    if (!form.confirmPassword) {
      e.confirmPassword = 'Please confirm your password'
    } else if (form.password && form.confirmPassword !== form.password) {
      e.confirmPassword = 'Passwords do not match'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const { name, email, password } = form
      const { data } = await authAPI.register({ name, email, password })
      setAuth(data.user, data.token)
      toast.success(`Welcome to MediaHub, ${data.user.name}!`)
      navigate('/')
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Registration failed'
      
      // Check for duplicate email error from backend
      if (errorMessage.toLowerCase().includes('email already exists') || 
          errorMessage.toLowerCase().includes('email already in use') ||
          errorMessage.toLowerCase().includes('duplicate key') ||
          errorMessage.toLowerCase().includes('already registered')) {
        setErrors({ email: 'This email is already registered. Please login or use another email.' })
      } else {
        toast.error(errorMessage)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full relative flex items-center justify-end overflow-hidden">
      {/* Full-bleed background image */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?q=80&w=1600&auto=format&fit=crop')",
        }}
      />
      {/* Dark overlay so the form stays readable everywhere on the image */}
      <div className="absolute inset-0" style={{ background: 'rgba(10, 16, 12, 0.55)' }} />
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(8,12,9,0.35) 55%, rgba(8,12,9,0.55) 100%)' }}
      />

      {/* Transparent glass form panel — spans full height, flush to the right edge */}
      <div
        className="relative z-10 w-full md:w-[560px] min-h-screen flex items-center justify-center px-6 sm:px-10 md:px-14"
        style={{
          background: 'rgba(20, 28, 22, 0.35)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <style>{`
          input:-webkit-autofill,
          input:-webkit-autofill:hover,
          input:-webkit-autofill:focus {
            -webkit-text-fill-color: #fff;
            caret-color: #fff;
            transition: background-color 9999s ease-in-out 0s;
          }
        `}</style>
        <div className="w-full max-w-sm mx-auto text-center">
          {/* Logo mark */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2 L13.5 9.5 L21 11 L13.5 12.5 L12 20 L10.5 12.5 L3 11 L10.5 9.5 Z"
                fill="#f59e0b"
              />
            </svg>
            <span className="text-sm font-extrabold font-display tracking-wide text-white/90">
              Eventpulse
            </span>
          </div>

          <h1 className="text-4xl font-extrabold font-display mb-2 text-white">
            Get started
          </h1>
          <p className="text-sm mb-8 text-white/60">
            Create your account — it only takes a minute.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-7 text-left">
            {/* Name */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-white/85">
                Full name
              </label>
              <input
                type="text"
                placeholder="Enter your full name"
                value={form.name}
                onChange={(e) => {
                  setForm({ ...form, name: e.target.value })
                  if (errors.name) setErrors({ ...errors, name: '' })
                }}
                className="w-full bg-transparent text-base outline-none border-b pb-2.5 transition-colors text-white placeholder-white/40 focus:border-amber-400"
                style={{ borderColor: errors.name ? '#f87171' : 'rgba(255,255,255,0.3)' }}
              />
              {errors.name && <p className="text-xs text-red-300">{errors.name}</p>}
            </div>

            {/* Email */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-white/85">
                E-mail
              </label>
              <input
                type="email"
                placeholder="Enter your e-mail"
                value={form.email}
                onChange={(e) => {
                  setForm({ ...form, email: e.target.value })
                  if (errors.email) setErrors({ ...errors, email: '' })
                }}
                className="w-full bg-transparent text-base outline-none border-b pb-2.5 transition-colors text-white placeholder-white/40 focus:border-amber-400"
                style={{ borderColor: errors.email ? '#f87171' : 'rgba(255,255,255,0.3)' }}
              />
              {errors.email && <p className="text-xs text-red-300">{errors.email}</p>}
            </div>

            {/* Password */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-white/85">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  placeholder="Min. 6 characters"
                  value={form.password}
                  onChange={(e) => {
                    setForm({ ...form, password: e.target.value })
                    if (errors.password) setErrors({ ...errors, password: '' })
                    if (errors.confirmPassword && form.confirmPassword && e.target.value === form.confirmPassword) {
                      setErrors((prev) => ({ ...prev, confirmPassword: '' }))
                    }
                  }}
                  className="w-full bg-transparent text-base outline-none border-b pb-2.5 pr-9 transition-colors text-white placeholder-white/40 focus:border-amber-400"
                  style={{ borderColor: errors.password ? '#f87171' : 'rgba(255,255,255,0.3)' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-0 top-0 hover:opacity-70 transition-opacity text-white/60"
                >
                  {showPw ? <FiEyeOff size={17} /> : <FiEye size={17} />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-300">{errors.password}</p>}
            </div>

            {/* Confirm Password */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-white/85">
                Confirm password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPw ? 'text' : 'password'}
                  placeholder="Re-enter your password"
                  value={form.confirmPassword}
                  onChange={(e) => {
                    setForm({ ...form, confirmPassword: e.target.value })
                    if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: '' })
                  }}
                  className="w-full bg-transparent text-base outline-none border-b pb-2.5 pr-9 transition-colors text-white placeholder-white/40 focus:border-amber-400"
                  style={{ borderColor: errors.confirmPassword ? '#f87171' : 'rgba(255,255,255,0.3)' }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPw(!showConfirmPw)}
                  className="absolute right-0 top-0 hover:opacity-70 transition-opacity text-white/60"
                >
                  {showConfirmPw ? <FiEyeOff size={17} /> : <FiEye size={17} />}
                </button>
              </div>
              {errors.confirmPassword && <p className="text-xs text-red-300">{errors.confirmPassword}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl font-bold text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2 bg-black/80 hover:bg-black text-white"
              style={{ padding: '16px' }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Creating account...
                </span>
              ) : 'Create account'}
            </button>
          </form>

          <p className="text-center text-sm mt-6 text-white/60">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-white hover:text-amber-400 transition-colors">
              Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}