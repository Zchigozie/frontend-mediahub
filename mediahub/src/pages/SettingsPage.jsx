import { useState, useId } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FiArrowLeft, FiUser, FiMoon, FiLock, FiTrash2,
  FiLogOut, FiChevronRight, FiX, FiEye, FiEyeOff, FiCheck, FiShield
} from 'react-icons/fi'
import { useAuthStore, useThemeStore } from '../store'
import { authAPI } from '../api'
import toast from 'react-hot-toast'

/* ---------- Primitives ---------- */

function SectionLabel({ children }) {
  return (
    <p
      className="text-[11px] font-semibold tracking-[0.14em] uppercase px-5 pt-6 pb-2"
      style={{ color: 'var(--text-muted)' }}
    >
      {children}
    </p>
  )
}

function Row({ icon: Icon, label, onClick, danger = false, trailing }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
    >
      <Icon
        size={20}
        strokeWidth={1.75}
        style={{ color: danger ? '#ef4444' : 'var(--text-primary)' }}
      />
      <span
        className="flex-1 text-left text-[15px] font-medium"
        style={{ color: danger ? '#ef4444' : 'var(--text-primary)' }}
      >
        {label}
      </span>
      {trailing !== undefined ? trailing : (
        <FiChevronRight size={18} style={{ color: 'var(--text-muted)' }} strokeWidth={1.75} />
      )}
    </button>
  )
}

function Group({ children }) {
  return (
    <div
      className="mx-4 rounded-2xl overflow-hidden divide-y"
      style={{
        background: 'var(--bg-primary)',
        borderColor: 'var(--border)',
      }}
    >
      {children}
    </div>
  )
}

/* ---------- Field primitives (used inside sheets) ---------- */

function FieldInput({ label, type = 'text', value, onChange, autoComplete, placeholder, trailing, id }) {
  const reactId = useId()
  const inputId = id || reactId
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={inputId}
        className="text-[11px] font-semibold tracking-[0.14em] uppercase px-1"
        style={{ color: 'var(--text-muted)' }}
      >
        {label}
      </label>
      <div
        className="flex items-center gap-2 rounded-full px-5"
        style={{ background: 'var(--bg-input)', minHeight: 50 }}
      >
        <input
          id={inputId}
          type={type}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          placeholder={placeholder}
          className="w-full bg-transparent outline-none text-sm py-3"
          style={{ color: 'var(--text-primary)' }}
        />
        {trailing}
      </div>
    </div>
  )
}

function PasswordInput(props) {
  const [show, setShow] = useState(false)
  return (
    <FieldInput
      {...props}
      type={show ? 'text' : 'password'}
      trailing={
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          tabIndex={-1}
          className="flex-shrink-0 rounded-md p-1 transition-colors hover:bg-black/10 dark:hover:bg-white/10"
          style={{ color: 'var(--text-muted)' }}
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <FiEyeOff size={16} /> : <FiEye size={16} />}
        </button>
      }
    />
  )
}

function Textarea({ label, value, onChange, rows = 3, placeholder }) {
  const reactId = useId()
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={reactId}
        className="text-[11px] font-semibold tracking-[0.14em] uppercase px-1"
        style={{ color: 'var(--text-muted)' }}
      >
        {label}
      </label>
      <textarea
        id={reactId}
        value={value}
        onChange={onChange}
        rows={rows}
        placeholder={placeholder}
        className="w-full bg-transparent outline-none text-sm resize-none rounded-2xl px-5 py-3"
        style={{ background: 'var(--bg-input)', color: 'var(--text-primary)' }}
      />
    </div>
  )
}

function PrimaryButton({ children, loading, icon: Icon, ...rest }) {
  return (
    <button
      {...rest}
      disabled={loading || rest.disabled}
      className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-sm text-white bg-amber-500 hover:bg-amber-600 active:bg-amber-700 shadow-lg shadow-amber-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {Icon && <Icon size={16} strokeWidth={2.5} />}
      {loading ? 'Please wait…' : children}
    </button>
  )
}

/* ---------- Bottom sheet ---------- */

function Sheet({ open, onClose, title, children }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 flex items-end sm:items-center justify-center"
          style={{ zIndex: 10000, background: 'rgba(0,0,0,0.5)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          <motion.div
            className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6"
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                {title}
              </h3>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                style={{ color: 'var(--text-muted)' }}
              >
                <FiX size={18} strokeWidth={2.5} />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* ---------- Page ---------- */

export default function SettingsPage() {
  const navigate = useNavigate()
  const { user, updateUser, logout } = useAuthStore()
  const { theme, toggleTheme } = useThemeStore()
  const isDark = theme === 'dark'

  const [openSheet, setOpenSheet] = useState(null) // 'account' | 'password' | 'delete'

  const [name, setName] = useState(user?.name || '')
  const [bio, setBio] = useState(user?.bio || '')
  const [savingProfile, setSavingProfile] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  const [deleting, setDeleting] = useState(false)

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    setSavingProfile(true)
    try {
      const res = await authAPI.updateProfile({ name, bio })
      updateUser(res.data.data)
      toast.success('Profile updated')
      setOpenSheet(null)
    } catch {
      toast.error('Failed to update profile')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (!currentPassword || !newPassword) return toast.error('Fill in both password fields')
    if (newPassword !== confirmPassword) return toast.error('New passwords don’t match')
    if (newPassword.length < 6) return toast.error('New password must be at least 6 characters')

    setSavingPassword(true)
    try {
      await authAPI.changePassword({ currentPassword, newPassword })
      toast.success('Password updated')
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
      setOpenSheet(null)
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to update password')
    } finally {
      setSavingPassword(false)
    }
  }

  const handleDeleteAccount = async () => {
    setDeleting(true)
    try {
      await authAPI.deleteAccount()
      toast.success('Account deleted')
      setOpenSheet(null)
      logout()
      navigate('/login')
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to delete account')
      setDeleting(false)
      setOpenSheet(null)
    }
  }

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <>
      <div className="min-h-screen pb-16" style={{ background: 'var(--bg-primary)' }}>
        {/* Header — soft tinted band */}
        <header
          className="px-4 pt-5 pb-8"
          style={{ background: 'color-mix(in oklab, #f59e0b 8%, var(--bg-primary))' }}
        >
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors -ml-1"
            style={{ color: 'var(--text-primary)' }}
            aria-label="Go back"
          >
            <FiArrowLeft size={20} strokeWidth={2} />
          </button>
          <h1
            className="text-[28px] font-bold leading-tight mt-2"
            style={{ color: 'var(--text-primary)' }}
          >
            Settings
          </h1>
        </header>

        <main className="max-w-md mx-auto -mt-2">

          <SectionLabel>General</SectionLabel>
          <Group>
            <Row icon={FiUser} label="Account" onClick={() => setOpenSheet('account')} />
            <Row
              icon={FiMoon}
              label="Dark mode"
              onClick={toggleTheme}
              trailing={
                <span
                  role="switch"
                  aria-checked={isDark}
                  className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
                  style={{ background: isDark ? '#f59e0b' : 'var(--border)' }}
                >
                  <span
                    className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
                    style={{ left: isDark ? '22px' : '2px' }}
                  />
                </span>
              }
            />
            <Row icon={FiLock} label="Password" onClick={() => setOpenSheet('password')} />
            <Row icon={FiLogOut} label="Logout" onClick={handleLogout} />
            <Row icon={FiTrash2} label="Delete account" danger onClick={() => setOpenSheet('delete')} />
          </Group>

        </main>
      </div>

      {/* Account sheet */}
      <Sheet open={openSheet === 'account'} onClose={() => setOpenSheet(null)} title="Account">
        <form onSubmit={handleSaveProfile} className="flex flex-col gap-3.5">
          <FieldInput
            label="Display name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
          <Textarea
            label="Bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            placeholder="Tell people a bit about yourself"
          />
          <div className="flex justify-end mt-2">
            <PrimaryButton icon={FiCheck} loading={savingProfile}>Save changes</PrimaryButton>
          </div>
        </form>
      </Sheet>

      {/* Password sheet */}
      <Sheet open={openSheet === 'password'} onClose={() => setOpenSheet(null)} title="Change password">
        <form onSubmit={handleChangePassword} className="flex flex-col gap-3.5">
          <PasswordInput
            label="Current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
          />
          <PasswordInput
            label="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
          />
          <PasswordInput
            label="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />
          <div className="flex justify-end mt-2">
            <PrimaryButton icon={FiShield} loading={savingPassword}>Update password</PrimaryButton>
          </div>
        </form>
      </Sheet>

      {/* Delete confirmation */}
      <Sheet open={openSheet === 'delete'} onClose={() => !deleting && setOpenSheet(null)} title="Delete account">
        <div className="flex flex-col items-center text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
            style={{ background: 'rgba(239,68,68,0.12)' }}
          >
            <FiTrash2 size={28} color="#ef4444" strokeWidth={2.5} />
          </div>
          <h3 className="text-base font-extrabold" style={{ color: 'var(--text-primary)' }}>
            Delete your account?
          </h3>
          <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
            This permanently removes your profile and all your posts. This action cannot be undone.
          </p>
          <div className="flex items-center justify-center gap-3 mt-6">
            <button
              onClick={() => setOpenSheet(null)}
              disabled={deleting}
              className="px-6 py-2.5 rounded-full font-bold text-sm border transition-colors disabled:opacity-50"
              style={{ background: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteAccount}
              disabled={deleting}
              className="px-6 py-2.5 rounded-full font-bold text-sm text-white bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/25 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {deleting ? 'Deleting…' : 'Yes, delete'}
            </button>
          </div>
        </div>
      </Sheet>
    </>
  )
}
