import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FiGrid, FiArrowLeft, FiHeart, FiMessageCircle, FiUser, FiEdit2,
  FiSettings, FiLayers, FiImage, FiCalendar, FiDownload, FiLoader, FiPlay
} from 'react-icons/fi'
import { useAuthStore, usePostStore } from '../store'
import { Avatar, EmptyState } from '../components/ui'
import { getImageUrls } from '../components/PostMedia'
import api, { authAPI, postsAPI, getDownloadUrl } from '../api'
import toast from 'react-hot-toast'
import dayjs from 'dayjs'

export default function ProfilePage() {
  const navigate = useNavigate()
  const { user, updateUser } = useAuthStore()
  const { posts, isLoading, fetchPosts } = usePostStore()
  const [userPosts, setUserPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [downloadingMap, setDownloadingMap] = useState({})

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await fetchPosts()
      setLoading(false)
    }
    loadData()
  }, [])

  useEffect(() => {
    if (!user) return
    const userId = user._id || user.id
    const filtered = posts.filter(p => {
      const authorId = p.author?._id || p.author?.id || p.author
      return authorId === userId
    })
    setUserPosts(filtered)
  }, [posts, user])

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploadingAvatar(true)
    try {
      const response = await authAPI.updateAvatar(file)
      updateUser(response.data.data)
      toast.success('Profile picture updated')
    } catch {
      toast.error('Failed to update profile picture')
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleDeletePost = async (postId, e) => {
    e.stopPropagation()
    if (!confirm('Delete this post?')) return
    try {
      await postsAPI.delete(postId)
      toast.success('Post deleted')
      await fetchPosts()
    } catch {
      toast.error('Failed to delete post')
    }
  }

  const handleDownload = async (postId, url, filename) => {
    if (!url) return
    setDownloadingMap(prev => ({ ...prev, [postId]: true }))
    const toastId = toast.loading('Downloading…')
    try {
      const proxyUrl = getDownloadUrl(url, filename)
      const response = await api.get(proxyUrl, { responseType: 'blob' })
      const blob = new Blob([response.data])
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(link.href)
      toast.success('Download complete', { id: toastId })
    } catch (err) {
      console.error('Download failed:', err)
      toast.error('Download failed', { id: toastId })
    } finally {
      setDownloadingMap(prev => ({ ...prev, [postId]: false }))
    }
  }

  const memberSince = user?.createdAt ? dayjs(user.createdAt).format('MMM YYYY') : '—'

  if (loading || isLoading) {
    return (
      <div className="flex justify-center items-center min-h-dvh" style={{ background: 'var(--bg-primary)' }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
          className="rounded-full h-10 w-10 border-4 border-amber-500 border-t-transparent"
        />
      </div>
    )
  }

  const stats = [
    { label: 'Posts', value: userPosts.length, icon: null, onClick: null },
    { label: 'Member since', value: memberSince, icon: null, onClick: null },
  ]

  return (
    <div className="min-h-dvh pb-20 fade-in" style={{ background: 'var(--bg-primary)' }}>
      <div className="max-w-3xl lg:max-w-5xl mx-auto px-5 pt-6">

        {/* Top bar */}
        <div className="flex items-center justify-between mb-10">
          <motion.button
            whileHover={{ x: -2 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className="p-2 -ml-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            style={{ color: 'var(--text-primary)' }}
          >
            <FiArrowLeft size={20} />
          </motion.button>
          <motion.button
            whileHover={{ rotate: 45 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate('/settings')}
            aria-label="Settings"
            className="p-2 -mr-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            style={{ color: 'var(--text-primary)' }}
          >
            <FiSettings size={20} />
          </motion.button>
        </div>

        {/* Avatar + name + stats */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-start gap-4"
        >
          <div className="relative shrink-0">
            <Avatar src={user?.avatar} name={user?.name} size={72} />
            <motion.label
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
              htmlFor="avatar-upload"
              className="absolute -bottom-1 -right-1 w-6 h-6 flex items-center justify-center rounded-full cursor-pointer text-white shadow-sm"
              style={{ background: '#f59e0b' }}
            >
              <AnimatePresence mode="wait" initial={false}>
                {uploadingAvatar ? (
                  <motion.span
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1, rotate: 360 }}
                    exit={{ opacity: 0 }}
                    transition={{ rotate: { repeat: Infinity, duration: 0.8, ease: 'linear' } }}
                  >
                    …
                  </motion.span>
                ) : (
                  <motion.span key="edit" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <FiEdit2 size={11} />
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.label>
            <input id="avatar-upload" type="file" accept="image/*" className="hidden" disabled={uploadingAvatar} onChange={handleAvatarChange} />
          </div>

          <div className="pt-1 flex-1">
            <h2 className="text-lg font-extrabold font-display" style={{ color: 'var(--text-primary)' }}>
              {user?.name || 'User'}
            </h2>
            <p className="text-xs mb-2.5" style={{ color: 'var(--text-muted)' }}>{user?.email}</p>
            {user?.bio && (
              <p className="text-sm mb-2.5 leading-snug" style={{ color: 'var(--text-secondary)' }}>
                {user.bio}
              </p>
            )}

            <div className="flex gap-5">
              {stats.map(({ label, value, onClick }, i) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.06 }}
                  whileHover={onClick ? { scale: 1.06 } : {}}
                  whileTap={onClick ? { scale: 0.94 } : {}}
                  onClick={onClick || undefined}
                  className={onClick ? 'cursor-pointer' : ''}
                >
                  <p className="text-base font-extrabold font-display leading-tight" style={{ color: 'var(--text-primary)' }}>{value}</p>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{label}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Posts */}
        <div className="mt-12">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FiGrid size={14} style={{ color: 'var(--text-muted)' }} />
              <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>My Posts</span>
            </div>
          </div>

          {userPosts.length === 0 ? (
            <EmptyState
              icon={FiUser}
              title="No posts yet"
              description="Share your first post with the community!"
              action={
                <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => navigate('/create')} className="text-sm font-semibold hover:text-amber-500" style={{ color: 'var(--text-primary)' }}>
                  Create Post
                </motion.button>
              }
            />
          ) : (
            <motion.div
              initial="hidden"
              animate="show"
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.03 } } }}
              className="grid grid-cols-3 gap-px"
              style={{ background: 'var(--border)' }}
            >
              <AnimatePresence>
                {userPosts.map(post => {
                  const urls = getImageUrls(post)
                  const mediaUrl = urls[0] || null
                  const hasMultiple = urls.length > 1
                  const hasVideos = post.videos && post.videos.length > 0
                  const isDownloading = downloadingMap[post._id] || false

                  const videoThumbnail = hasVideos ? post.videos[0].thumbnail : null
                  const videoUrl = hasVideos ? post.videos[0].url : null

                  const downloadUrl = mediaUrl || videoUrl
                  const fileExt = downloadUrl ? downloadUrl.split('.').pop() || 'jpg' : 'jpg'
                  const downloadFilename = post.title ? `${post.title}.${fileExt}` : `download.${fileExt}`

                  return (
                    <motion.div
                      key={post._id || post.id}
                      layout
                      variants={{ hidden: { opacity: 0, scale: 0.9 }, show: { opacity: 1, scale: 1 } }}
                      exit={{ opacity: 0, scale: 0.85 }}
                      whileHover={{ scale: 1.03, zIndex: 1 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                      onClick={() => navigate(`/posts/${post._id || post.id}`)}
                      className="cursor-pointer overflow-hidden group relative"
                      style={{ aspectRatio: '1/1', background: 'var(--bg-secondary)' }}
                    >
                      {/* Delete button */}
                      <motion.button
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.85 }}
                        onClick={e => handleDeletePost(post._id || post.id, e)}
                        className="absolute top-1.5 right-1.5 z-10 opacity-0 group-hover:opacity-100 text-white text-xs"
                        style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.6))' }}
                      >
                        ✕
                      </motion.button>

                      {/* Multiple media badge */}
                      {hasMultiple && !hasVideos && (
                        <div
                          className="absolute top-1.5 left-1.5 z-10 text-white"
                          style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.6))' }}
                          aria-label={`${urls.length} media items`}
                        >
                          <FiLayers size={15} strokeWidth={2.5} />
                        </div>
                      )}

                      {/* Play icon overlay for videos */}
                      {hasVideos && (
                        <div
                          className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
                          style={{ background: 'rgba(0,0,0,0.15)' }}
                        >
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-sm"
                            style={{ background: 'rgba(0,0,0,0.5)' }}
                          >
                            <FiPlay
                              size={18}
                              className="text-white"
                              style={{ marginLeft: 2 }}
                            />
                          </div>
                        </div>
                      )}

                      {/* ── FIXED: removed onClick from video ── */}
                      {hasVideos ? (
                        <video
                          src={videoUrl}
                          poster={videoThumbnail || undefined}
                          className="w-full h-full object-cover"
                          muted
                          playsInline
                          // 🔁 REMOVED onClick → now clicks bubble to parent and navigate
                          onError={(e) => e.target.style.display = 'none'}
                        />
                      ) : mediaUrl ? (
                        <img
                          src={mediaUrl}
                          alt={post.title || 'Post'}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                          onError={e => e.target.style.display = 'none'}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center p-2">
                          <p className="text-[11px] text-center line-clamp-3" style={{ color: 'var(--text-secondary)' }}>
                            {post.title || post.content || 'Untitled'}
                          </p>
                        </div>
                      )}

                      {/* Download button */}
                      {downloadUrl && (
                        <motion.button
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 0, scale: 0.8 }}
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDownload(post._id, downloadUrl, downloadFilename)
                          }}
                          disabled={isDownloading}
                          className="absolute bottom-1.5 right-1.5 z-10 p-1.5 rounded-full bg-white/80 backdrop-blur-sm text-gray-800 hover:bg-white shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed opacity-0 group-hover:opacity-100"
                          aria-label="Download media"
                        >
                          {isDownloading ? (
                            <FiLoader size={12} className="animate-spin" strokeWidth={2.5} />
                          ) : (
                            <FiDownload size={12} strokeWidth={2.5} />
                          )}
                        </motion.button>
                      )}
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}