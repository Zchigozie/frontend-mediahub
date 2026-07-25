import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { FiSearch, FiX, FiGrid, FiLayers, FiBell, FiPlus, FiPlay } from 'react-icons/fi'
import { useAuthStore } from '../store'
import { EmptyState, Avatar } from '../components/ui'
import { getImageUrls } from '../components/PostMedia'
import { postsAPI, notificationsAPI } from '../api'

/* ─────────── Boomerang video: plays forward, then reverses back to start, on loop ─────────── */

function BoomerangVideo({ src, poster, className, style, onClick }) {
  const videoRef = useRef(null)
  const rafRef = useRef(null)
  const lastTimeRef = useRef(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video || !src) return

    let cancelled = false

    const stepReverse = (timestamp) => {
      if (cancelled || !videoRef.current) return
      const v = videoRef.current
      if (lastTimeRef.current == null) lastTimeRef.current = timestamp
      const delta = (timestamp - lastTimeRef.current) / 1000
      lastTimeRef.current = timestamp

      const next = v.currentTime - delta
      if (next <= 0) {
        v.currentTime = 0
        lastTimeRef.current = null
        v.play().catch(() => {})
      } else {
        v.currentTime = next
        rafRef.current = requestAnimationFrame(stepReverse)
      }
    }

    const handleEnded = () => {
      if (cancelled) return
      lastTimeRef.current = null
      rafRef.current = requestAnimationFrame(stepReverse)
    }

    video.addEventListener('ended', handleEnded)
    video.play().catch(() => {})

    return () => {
      cancelled = true
      video.removeEventListener('ended', handleEnded)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [src])

  return (
    <video
      ref={videoRef}
      src={src}
      poster={poster || undefined}
      className={className}
      style={style}
      muted
      playsInline
      autoPlay
      onClick={onClick}
      onError={(e) => { e.target.style.display = 'none' }}
    />
  )
}

/* ─────────── ExplorePage ─────────── */

export default function ExplorePage() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtered, setFiltered] = useState([])
  const [query, setQuery] = useState('')
  const [unreadCount, setUnreadCount] = useState(0)
  const navigate = useNavigate()
  const inputRef = useRef()
  const { user } = useAuthStore()

  const fetchPosts = async () => {
    try {
      const response = await postsAPI.getAll()
      const data = response.data
      let arr = []
      if (data?.data?.posts) arr = data.data.posts
      else if (data?.posts) arr = data.posts
      else if (Array.isArray(data?.data)) arr = data.data
      else if (Array.isArray(data)) arr = data
      setPosts(arr)
      setFiltered(arr)
    } catch (err) {
      console.error('Failed to fetch posts:', err)
      setPosts([])
      setFiltered([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchPosts() }, [])

  useEffect(() => {
    if (!user) return
    const fetchUnread = async () => {
      try {
        const res = await notificationsAPI.getAll(1, 1)
        setUnreadCount(res.data?.unreadCount || 0)
      } catch {}
    }
    fetchUnread()
    const interval = setInterval(fetchUnread, 30000)
    return () => clearInterval(interval)
  }, [user])

  useEffect(() => {
    if (posts.length === 0) { setFiltered([]); return }
    if (!query.trim()) { setFiltered(posts); return }
    const q = query.toLowerCase()
    setFiltered(posts.filter(p =>
      p.title?.toLowerCase().includes(q) ||
      p.content?.toLowerCase().includes(q) ||
      p.caption?.toLowerCase().includes(q) ||
      p.tags?.some(t => t.toLowerCase().includes(q)) ||
      p.author?.name?.toLowerCase().includes(q)
    ))
  }, [query, posts])

  const goToProfile = (e, author) => {
    e.stopPropagation()
    const authorId = author?._id || author?.id || author
    if (!authorId) return
    const myId = user?._id || user?.id
    navigate(String(authorId) === String(myId) ? '/profile' : `/users/${authorId}`)
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen" style={{ background: 'var(--bg-primary)' }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
          className="rounded-full h-8 w-8 border-2 border-amber-500 border-t-transparent"
        />
      </div>
    )
  }

  return (
    <div className="min-h-full pb-20 fade-in" style={{ background: 'var(--bg-primary)' }}>
      {/* Sticky header — Pinterest style */}
      <div
        className="sticky top-0 z-20 px-4 sm:px-6 py-3 backdrop-blur-xl"
        style={{ background: 'color-mix(in oklab, var(--bg-primary) 82%, transparent)' }}
      >
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          {/* ── Removed "Explore" heading ── */}

          {/* Inline search bar - Pinterest style */}
          <div className="relative flex-1 max-w-xl mx-auto">
            <FiSearch
              size={16}
              strokeWidth={2.25}
              className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: 'var(--text-muted)' }}
            />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search ideas"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-full text-sm outline-none border-0 transition-all focus:ring-2 focus:ring-amber-500/40"
              style={{
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                padding: '11px 40px 11px 42px',
                fontWeight: 500,
              }}
            />
            <AnimatePresence>
              {query && (
                <motion.button
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ color: 'var(--text-primary)', background: 'var(--bg-input)' }}
                  aria-label="Clear search"
                >
                  <FiX size={13} strokeWidth={2.5} />
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <motion.button
              onClick={() => navigate('/create')}
              whileTap={{ scale: 0.9 }}
              aria-label="Create"
              className="hidden sm:flex items-center justify-center h-10 w-10 rounded-full hover:bg-[var(--bg-secondary)] transition-colors"
              style={{ color: 'var(--text-primary)' }}
            >
              <FiPlus size={22} strokeWidth={2.25} />
            </motion.button>

            <motion.button
              onClick={() => navigate('/notifications')}
              whileTap={{ scale: 0.9 }}
              aria-label="Notifications"
              className="relative flex items-center justify-center h-10 w-10 rounded-full hover:bg-[var(--bg-secondary)] transition-colors"
              style={{ color: 'var(--text-primary)' }}
            >
              <FiBell size={20} strokeWidth={2.25} />
              <AnimatePresence>
                {unreadCount > 0 && (
                  <motion.span
                    key="badge"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                    className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                    style={{ background: '#ef4444' }}
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-2 sm:px-4 pt-4">
        {filtered.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="pt-20">
            <EmptyState
              icon={FiGrid}
              title={query ? 'No results' : 'Nothing here yet'}
              description={query ? `No matches for "${query}"` : 'Be the first to share something.'}
              action={
                !query && (
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => navigate('/create')}
                    className="text-sm font-bold px-5 py-3 rounded-full bg-amber-500 hover:bg-amber-400 text-white"
                  >
                    Create post
                  </motion.button>
                )
              }
            />
          </motion.div>
        ) : (
          <motion.div
            layout
            initial="hidden"
            animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.03 } } }}
            className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 xl:columns-6 gap-2 sm:gap-3 [&>*]:mb-2 sm:[&>*]:mb-3"
          >
            <AnimatePresence>
              {filtered.map((post) => {
                // ── Determine thumbnail and media info ──
                let thumbnailUrl = null
                let isVideo = false
                let mediaCount = 0
                let videoUrl = null
                let videoThumbnail = null

                // Check for videos first
                if (post.videos && post.videos.length > 0) {
                  const video = post.videos[0]
                  videoUrl = video.url
                  videoThumbnail = video.thumbnail || null
                  thumbnailUrl = videoThumbnail || videoUrl
                  isVideo = true
                  mediaCount = post.videos.length + (post.images?.length || 0)
                } else {
                  // No videos, use images
                  const imageUrls = getImageUrls(post)
                  thumbnailUrl = imageUrls[0] || null
                  mediaCount = imageUrls.length
                }

                const hasMultiple = mediaCount > 1
                const displayText = post.title || post.content || post.caption || 'Untitled'

                return (
                  <motion.div
                    key={post._id || post.id}
                    layout
                    variants={{
                      hidden: { opacity: 0, y: 12, scale: 0.98 },
                      show: { opacity: 1, y: 0, scale: 1 },
                    }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                    onClick={() => navigate(`/posts/${post._id || post.id}`)}
                    className="break-inside-avoid cursor-pointer group"
                  >
                    {thumbnailUrl ? (
                      <div
                        className="relative rounded-2xl overflow-hidden transition-all duration-300 group-hover:brightness-90"
                        style={{ background: 'var(--bg-secondary)' }}
                      >
                        {hasMultiple && !isVideo && (
                          <div
                            className="absolute top-2.5 right-2.5 z-10 text-white bg-black/50 backdrop-blur-md rounded-full p-1.5"
                            aria-label={`${mediaCount} photos`}
                          >
                            <FiLayers size={12} strokeWidth={2.5} />
                          </div>
                        )}

                        {/* ── Render video with Boomerang if video, else static image ── */}
                        {isVideo ? (
                          <BoomerangVideo
                            src={videoUrl}
                            poster={videoThumbnail}
                            className="w-full h-auto object-cover block"
                          />
                        ) : (
                          <img
                            src={thumbnailUrl}
                            alt={displayText}
                            className="w-full h-auto object-cover block"
                            loading="lazy"
                            onError={(e) => {
                              e.target.style.display = 'none'
                              const parent = e.target.parentElement
                              const fallback = document.createElement('div')
                              fallback.className = 'p-4 min-h-[140px] flex items-center justify-center'
                              fallback.innerHTML = `<p class="text-xs text-center line-clamp-4" style="color: var(--text-secondary)">${displayText}</p>`
                              parent.appendChild(fallback)
                            }}
                          />
                        )}

                        {/* Hover overlay - Pinterest style */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors duration-300 pointer-events-none" />
                      </div>
                    ) : (
                      <div
                        className="p-4 min-h-[140px] rounded-2xl flex items-center justify-center"
                        style={{ background: 'var(--bg-secondary)' }}
                      >
                        <p
                          className="text-[13px] leading-relaxed text-center line-clamp-5 font-medium"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          {displayText}
                        </p>
                      </div>
                    )}

                    {/* Title + author below card - Pinterest style */}
                    <div className="px-1.5 pt-2">
                      {(post.title || post.caption) && (
                        <p
                          className="text-[13px] font-bold line-clamp-2 leading-snug mb-1.5"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {post.title || post.caption}
                        </p>
                      )}
                      <div
                        onClick={(e) => goToProfile(e, post.author)}
                        className="flex items-center gap-1.5 min-w-0 cursor-pointer hover:opacity-70 transition-opacity"
                      >
                        <Avatar src={post.author?.avatar} name={post.author?.name} size={20} />
                        <span
                          className="text-[11px] font-medium truncate"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {post.author?.name || 'Unknown'}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  )
}