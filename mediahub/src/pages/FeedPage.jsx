import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion'
import {
  FiImage, FiHeart, FiMessageCircle, FiPlusSquare, FiGrid, FiList,
  FiCopy, FiSend, FiSearch, FiX, FiDownload, FiLoader,
  FiCalendar, FiMapPin, FiVolume2, FiVolumeX, FiPlay,
  FiChevronLeft, FiChevronRight, FiExternalLink
} from 'react-icons/fi'
import { FaHeart } from 'react-icons/fa'
import api, { postsAPI, commentsAPI, getDownloadUrl } from '../api'
import { useAuthStore } from '../store'
import { Avatar } from '../components/ui'
import { getMediaItems, MediaSlider, useMediaAspect } from '../components/PostMedia'
import toast from 'react-hot-toast'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
dayjs.extend(relativeTime)

import CommentsSheet from './_CommentsSheet'

/* ─────────── Global sound state (only one video audible at a time) ─────────── */

const SoundBus = (() => {
  let currentId = null
  const listeners = new Set()
  return {
    setActive(id) {
      currentId = id
      listeners.forEach((l) => l(id))
    },
    getActive: () => currentId,
    subscribe(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
  }
})()

/* ─────────── Wedding Hero ─────────── */

const WEDDING_SLIDES = [
  { url: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=1600&q=80', caption: 'Two hearts, one journey' },
  { url: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=1600&q=80', caption: 'Where forever begins' },
  { url: 'https://i.pinimg.com/1200x/05/45/04/054504e4faceeb61c885dcb08e15e317.jpg', caption: 'Golden hour, golden vows' },
  { url: 'https://images.unsplash.com/photo-1519225421980-715cb0215aed?w=1600&q=80', caption: 'Dancing into forever' },
]

function WeddingHero() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setIndex((i) => (i + 1) % WEDDING_SLIDES.length), 5000)
    return () => clearInterval(t)
  }, [])

  const slide = WEDDING_SLIDES[index]

  return (
    <section className="relative w-full">
      <div className="relative overflow-hidden aspect-[16/9] sm:aspect-[21/9]">
        <AnimatePresence mode="sync">
          <motion.img
            key={slide.url}
            src={slide.url}
            alt={slide.caption}
            initial={{ opacity: 0, scale: 1.08 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            className="absolute inset-0 w-full h-full object-cover"
          />
        </AnimatePresence>

        <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/10 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/45 to-transparent pointer-events-none" />

        <div className="absolute inset-0 flex flex-col justify-end p-5 sm:p-10 md:p-14 pb-16 sm:pb-24 pt-24 sm:pt-28">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.7 }}
          >
            <span className="inline-block text-[10px] sm:text-xs tracking-[0.3em] uppercase text-amber-300 font-semibold mb-2 sm:mb-3">
              You're invited
            </span>
            <h1
              className="font-display text-white font-extrabold leading-[0.95] tracking-tight"
              style={{ fontSize: 'clamp(2rem, 6vw, 4.5rem)' }}
            >
              Paloma <span className="italic font-light text-amber-300">&</span> Kenneth
            </h1>

            <AnimatePresence mode="wait">
              <motion.p
                key={slide.caption}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.5 }}
                className="mt-2 sm:mt-3 text-white/85 text-sm sm:text-lg italic max-w-lg"
              >
                “{slide.caption}”
              </motion.p>
            </AnimatePresence>

            <div className="mt-4 sm:mt-6 flex flex-wrap items-center gap-3 sm:gap-5 text-white text-xs sm:text-sm">
              <span
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-md"
                style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.15)' }}
              >
                <FiCalendar size={14} /> November 14, 2026
              </span>
              <span
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-md"
                style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.15)' }}
              >
                <FiMapPin size={14} /> Amalfi Coast, Abuja
              </span>
            </div>
          </motion.div>
        </div>

        <div className="absolute bottom-8 sm:bottom-12 right-4 sm:right-8 flex gap-1.5 z-10">
          {WEDDING_SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              aria-label={`Slide ${i + 1}`}
              className="h-1.5 rounded-full transition-all duration-500"
              style={{
                width: i === index ? 28 : 8,
                background: i === index ? '#fbbf24' : 'rgba(255,255,255,0.5)',
              }}
            />
          ))}
        </div>

        <div
          className="absolute inset-x-0 bottom-0 h-1/2 pointer-events-none z-[5]"
          style={{ background: 'linear-gradient(to bottom, transparent 0%, var(--bg-primary) 100%)' }}
        />
      </div>
    </section>
  )
}

/* ─────────── shared media helpers ─────────── */

function isVideoItem(item) {
  if (!item) return false
  if (item.type === 'video') return true
  if (item.resourceType === 'video') return true
  return /\.(mp4|webm|mov|m4v|ogg)(\?|$)/i.test(item.url || '')
}

function MultiImageBadge({ count }) {
  if (!count || count < 2) return null
  return (
    <div className="absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-1 rounded-full bg-black/55 backdrop-blur-sm text-white text-[10px] font-bold leading-none shadow">
      <FiCopy size={11} strokeWidth={2.8} />
      {count}
    </div>
  )
}

function normalizeAuthor(u) {
  if (!u) return null
  return {
    _id: u._id || u.id,
    name: u.name || u.username || u.fullName || u.displayName || 'Unknown',
    avatar: u.avatar || u.avatarUrl || u.profileImage || u.photo || null,
  }
}

/* Deterministic rotation from post id so tiles don't jump on re-render */
function hashStr(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/* ─────────── Boomerang video (muted, ping-pong) ─────────── */

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
        v.play().catch(() => { })
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
    video.play().catch(() => { })

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
      loop={false}
      onClick={onClick}
      onError={(e) => { e.target.style.display = 'none' }}
    />
  )
}

/* ─────────── Scrapbook collage — MODAL ONLY, used for multi-media posts
   when the lightbox opens. Grid tiles keep the slider (unchanged). Photo
   items render as polaroids; video items render as a looping boomerang clip
   inside the same polaroid frame so videos actually play in the collage. */

function ScrapbookCollage({ post, items }) {
  const shown = items.slice(0, Math.min(3, items.length))
  const seed = hashStr(post._id || 'x')

  // Preset layouts for 2 & 3 items: position %, size %, rotation deg
  const layouts = {
    2: [
      { top: '8%', left: '6%', w: '58%', rot: -6 },
      { top: '30%', left: '38%', w: '58%', rot: 5 },
    ],
    3: [
      { top: '4%', left: '4%', w: '52%', rot: -7 },
      { top: '10%', left: '48%', w: '48%', rot: 6 },
      { top: '48%', left: '20%', w: '58%', rot: -3 },
    ],
  }
  const layout = layouts[shown.length] || layouts[3]

  // Tape colors
  const tapes = ['#8FA5D9', '#F5C542', '#8FA5D9']

  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: '#fdfaf3' }}>
      {/* Yellow scribble decorations */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path d="M8 92 Q12 85 16 92 T24 92" stroke="#F5C542" strokeWidth="0.8" fill="none" strokeLinecap="round" />
        <path d="M82 12 L88 8 M85 6 L91 12" stroke="#F5C542" strokeWidth="0.8" fill="none" strokeLinecap="round" />
        <circle cx="90" cy="88" r="1.5" fill="none" stroke="#F5C542" strokeWidth="0.6" />
        <path d="M6 40 Q9 38 12 40" stroke="#F5C542" strokeWidth="0.7" fill="none" strokeLinecap="round" />
        <path d="M78 55 l3 -3 M78 52 l3 3" stroke="#F5C542" strokeWidth="0.7" strokeLinecap="round" />
      </svg>

      {shown.map((it, i) => {
        const l = layout[i]
        const rot = l.rot + ((seed >> (i * 3)) % 5) - 2
        const tape = tapes[i % tapes.length]
        const itemIsVideo = isVideoItem(it)
        return (
          <div
            key={i}
            className="absolute"
            style={{
              top: l.top,
              left: l.left,
              width: l.w,
              transform: `rotate(${rot}deg)`,
              zIndex: i + 1,
              filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.18))',
            }}
          >
            {/* Blue/gold tape strip */}
            <div
              className="absolute left-1/2 -translate-x-1/2 -top-2 z-10"
              style={{
                width: '38%',
                height: 10,
                background: tape,
                opacity: 0.75,
                boxShadow: 'inset 0 0 6px rgba(0,0,0,0.08)',
              }}
            />
            {/* Photo / video (polaroid) */}
            <div
              className="w-full bg-white p-[3px] pb-[10px]"
              style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.15)' }}
            >
              <div className="w-full aspect-square overflow-hidden bg-neutral-200 relative">
                {itemIsVideo ? (
                  <BoomerangVideo src={it.url} poster={it.thumbnail} className="w-full h-full object-cover" />
                ) : (
                  <img
                    src={it.url}
                    alt=""
                    className="w-full h-full object-cover"
                    draggable={false}
                    onError={(e) => { e.currentTarget.style.display = 'none' }}
                  />
                )}
                {itemIsVideo && (
                  <span className="absolute bottom-1 left-1 flex items-center gap-0.5 px-1 rounded"
                    style={{ background: 'rgba(0,0,0,0.55)' }}>
                    <FiPlay size={9} fill="white" color="white" />
                  </span>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ─────────── Fullscreen photo/video lightbox ─────────── */

function PhotoLightbox({ post, onClose, navigate }) {
  const items = post ? getMediaItems(post) : []
  const isMulti = items.length > 1
  const item = items[0]
  const videoMode = isVideoItem(item)

  useEffect(() => {
    if (!post) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [post, onClose])

  useEffect(() => {
    if (!post) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prevOverflow }
  }, [post])

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {post && (
        <motion.div
          className="fixed inset-0 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.92)', zIndex: 99999 }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 z-30 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
          >
            <FiX size={20} />
          </button>

          {isMulti ? (
            <motion.div
              key={`scrapbook-${post._id}`}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.18 }}
              className="relative z-0 rounded-2xl overflow-hidden shadow-2xl"
              style={{ width: 'min(92vw, 480px, 62vh)', aspectRatio: '4 / 5' }}
              onClick={(e) => e.stopPropagation()}
            >
              <ScrapbookCollage post={post} items={items} />
            </motion.div>
          ) : (
            <AnimatePresence mode="wait">
              {videoMode ? (
                <motion.video
                  key={item?.url}
                  src={item?.url}
                  poster={item?.thumbnail}
                  controls
                  autoPlay
                  playsInline
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.18 }}
                  className="max-w-[90vw] max-h-[80vh] object-contain rounded-lg"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <motion.img
                  key={item?.url}
                  src={item?.url}
                  alt={post.title || 'Photo'}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.18 }}
                  className="max-w-[90vw] max-h-[80vh] object-contain rounded-lg"
                  onClick={(e) => e.stopPropagation()}
                />
              )}
            </AnimatePresence>
          )}

          {/* ─── Bottom bar – plain orange text link ─── */}
          <div
            className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 max-w-[90vw]"
            onClick={(e) => e.stopPropagation()}
          >
            {post.title && (
              <span className="text-white/70 text-xs font-medium truncate max-w-[40vw]">{post.title}</span>
            )}
            <motion.button
              onClick={() => navigate(`/posts/${post._id}`)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-1.5 text-amber-400 font-bold text-sm hover:underline transition"
            >
              <FiExternalLink size={13} strokeWidth={2.5} /> View post
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}

/* ─────────── List video (SOUND enabled, one-at-a-time) ─────────── */

function FeedVideo({ src, poster, postId, className, style }) {
  const videoRef = useRef(null)
  const wrapRef = useRef(null)
  const [muted, setMuted] = useState(true)
  const [inView, setInView] = useState(false)
  const [needsTap, setNeedsTap] = useState(false)

  const isActive = SoundBus.getActive() === postId

  useEffect(() => {
    return SoundBus.subscribe((activeId) => {
      const v = videoRef.current
      if (!v) return
      if (activeId !== postId) {
        v.muted = true
        setMuted(true)
      }
    })
  }, [postId])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting && entry.intersectionRatio > 0.5),
      { threshold: [0, 0.5, 1] }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (inView) {
      v.play().catch(() => { })
    } else {
      v.pause()
      if (SoundBus.getActive() === postId) SoundBus.setActive(null)
    }
  }, [inView, postId])

  const toggleSound = (e) => {
    e.stopPropagation()
    const v = videoRef.current
    if (!v) return
    if (muted) {
      SoundBus.setActive(postId)
      v.muted = false
      setMuted(false)
      v.play()
        .then(() => setNeedsTap(false))
        .catch(() => {
          v.muted = true
          setMuted(true)
          setNeedsTap(true)
        })
    } else {
      v.muted = true
      setMuted(true)
      if (SoundBus.getActive() === postId) SoundBus.setActive(null)
    }
  }

  return (
    <div ref={wrapRef} className={`relative ${className || ''}`} style={style}>
      <video
        ref={videoRef}
        src={src}
        poster={poster || undefined}
        className="w-full h-full object-cover bg-black"
        muted
        playsInline
        loop
        autoPlay
      />

      <button
        onClick={toggleSound}
        aria-label={muted ? 'Unmute' : 'Mute'}
        className="absolute bottom-3 right-3 z-10 h-9 w-9 rounded-full flex items-center justify-center bg-black/60 backdrop-blur-md text-white hover:bg-black/80 transition"
      >
        {muted ? <FiVolumeX size={17} strokeWidth={2.4} /> : <FiVolume2 size={17} strokeWidth={2.4} />}
      </button>

      {needsTap && (
        <button
          onClick={toggleSound}
          className="absolute inset-0 z-[5] flex items-center justify-center bg-black/30"
        >
          <span className="h-14 w-14 rounded-full bg-white/90 text-black flex items-center justify-center shadow-xl">
            <FiPlay size={22} />
          </span>
        </button>
      )}

      {isActive && !muted && (
        <span className="absolute top-3 left-3 z-10 text-[10px] tracking-widest uppercase font-bold px-2 py-1 rounded-full bg-amber-500 text-white shadow">
          Live sound
        </span>
      )}
    </div>
  )
}

/* ─────────── Inline comments ─────────── */

function InlineComments({ postId, user, onGoToProfile, onCountChange, onOpenAll }) {
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [posting, setPosting] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false
      ; (async () => {
        try {
          const res = await commentsAPI.getByPost(postId)
          const data = res.data
          const arr = data?.data?.comments || data?.comments || data?.data || data || []
          if (!cancelled) setComments(Array.isArray(arr) ? arr : [])
        } catch (err) {
          console.error('Load comments failed:', err)
        } finally {
          if (!cancelled) setLoading(false)
        }
      })()
    return () => { cancelled = true }
  }, [postId])

  const submit = async (e) => {
    e.preventDefault()
    const content = text.trim()
    if (!content) return
    if (!user) { toast.error('Log in to comment'); navigate('/login'); return }

    const optimisticAuthor = normalizeAuthor(user)
    const tempId = `temp-${Date.now()}`
    setComments((prev) => [...prev, { _id: tempId, content, author: optimisticAuthor }])
    setText('')
    onCountChange?.(1)
    setPosting(true)
    try {
      const res = await commentsAPI.create(postId, content)
      const newC = res.data?.data?.comment || res.data?.comment || res.data?.data || res.data
      if (newC && (newC._id || newC.id)) {
        setComments((prev) => prev.map((c) => (
          c._id === tempId
            ? { ...newC, author: (newC.author && typeof newC.author === 'object' ? newC.author : optimisticAuthor) }
            : c
        )))
      }
    } catch (err) {
      console.error('Comment failed:', err)
      toast.error('Could not post comment')
      setComments((prev) => prev.filter((c) => c._id !== tempId))
      onCountChange?.(-1)
    } finally {
      setPosting(false)
    }
  }

  const visible = comments.slice(-2)

  return (
    <div className="mt-2 px-3 md:px-0">
      {loading ? (
        <div className="text-xs py-2" style={{ color: 'var(--text-muted)' }}>Loading comments…</div>
      ) : (
        <>
          {comments.length > 2 && (
            <button onClick={() => onOpenAll?.(postId)}
              className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>
              View all {comments.length} comments
            </button>
          )}
          <ul className="space-y-1.5">
            {visible.map((c) => (
              <li key={c._id || c.id} className="flex items-start gap-2">
                <div className="cursor-pointer flex-shrink-0 mt-0.5"
                  onClick={(e) => onGoToProfile?.(e, c.author)}>
                  <Avatar src={c.author?.avatar} name={c.author?.name} size={22} />
                </div>
                <p className="text-sm leading-snug" style={{ color: 'var(--text-primary)' }}>
                  <span className="font-bold mr-1.5 cursor-pointer hover:underline"
                    onClick={(e) => onGoToProfile?.(e, c.author)}>
                    {c.author?.name || 'Unknown'}
                  </span>
                  <span style={{ color: 'var(--text-secondary)' }}>{c.content}</span>
                </p>
              </li>
            ))}
          </ul>
        </>
      )}

      <form onSubmit={submit} className="flex items-center gap-2 mt-2.5 pt-2.5 border-t"
        style={{ borderColor: 'var(--border)' }}>
        <Avatar src={user?.avatar} name={user?.name} size={24} />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a comment…"
          className="flex-1 bg-transparent outline-none text-sm placeholder:opacity-60"
          style={{ color: 'var(--text-primary)' }}
        />
        <button type="submit" disabled={!text.trim() || posting}
          className="flex items-center justify-center h-8 w-8 rounded-full text-amber-500 disabled:opacity-40">
          <FiSend size={16} strokeWidth={2.5} />
        </button>
      </form>
    </div>
  )
}

/* ─────────── Group posts by month ─────────── */

function groupPostsByMonth(posts) {
  const groups = new Map()
  posts.forEach((post) => {
    const d = post.createdAt ? new Date(post.createdAt) : new Date()
    const key = `${d.getFullYear()}-${d.getMonth()}`
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: d.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
        sortKey: d.getFullYear() * 12 + d.getMonth(),
        posts: [],
      })
    }
    groups.get(key).posts.push(post)
  })
  return Array.from(groups.values()).sort((a, b) => b.sortKey - a.sortKey)
}

/* ─────────── List-view post card ─────────── */

function PostListItem({
  post, user, gridItem, navigate,
  handleLike, handleDoubleTap, goToProfile, HeartAnimation,
  downloadingMap, handleDownload,
  commentDeltas, setCommentDeltas, setActiveCommentPostId,
}) {
  const mediaItems = getMediaItems(post)
  const mediaRatio = useMediaAspect(mediaItems)
  const isLiked = post.likes?.includes(user?._id)
  const baseCount = post.commentCount ?? 0
  const commentCount = baseCount + (commentDeltas[post._id] || 0)
  const isDownloading = downloadingMap[post._id] || false
  const downloadTarget = mediaItems[0]?.url

  return (
    <motion.article
      layoutId={`post-${post._id}`}
      variants={gridItem}
      className="group relative"
      style={{
        borderBottom: '1px solid var(--border)',
        paddingBottom: '2.5rem',
      }}
    >
      {mediaItems.length > 0 && (
        <div className="relative w-full cursor-pointer overflow-hidden"
          style={{ background: '#000', aspectRatio: mediaRatio, maxHeight: 560 }}>
          <MediaSlider
            items={mediaItems}
            title={post.title}
            postId={post._id}
            onDoubleTap={(e) => handleDoubleTap(e, post._id, () => navigate(`/posts/${post._id}`))}
            rounded=""
            className="w-full h-full"
            hideDots
            tapToNavigate
            fit="cover"
            renderVideo={(item) => (
              <FeedVideo
                src={item.url}
                poster={item.thumbnail}
                postId={post._id}
                className="w-full h-full"
              />
            )}
          />
          <MultiImageBadge count={mediaItems.length} />
          <HeartAnimation postId={post._id} />

          <div
            className="absolute top-3 left-3 z-10 flex items-center gap-2 pl-1 pr-3 py-1 rounded-full backdrop-blur-md cursor-pointer"
            style={{ background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.15)' }}
            onClick={(e) => goToProfile(e, post.author)}
          >
            <Avatar src={post.author?.avatar} name={post.author?.name} size={26} />
            <div className="text-white leading-tight">
              <p className="text-xs font-bold truncate max-w-[140px]">{post.author?.name || 'Unknown'}</p>
              <p className="text-[10px] opacity-80">{post.createdAt ? dayjs(post.createdAt).fromNow() : 'Just now'}</p>
            </div>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation()
              if (!downloadTarget) return
              const ext = downloadTarget.split('.').pop() || 'jpg'
              const filename = post.title ? `${post.title}.${ext}` : `download.${ext}`
              handleDownload(post._id, downloadTarget, filename)
            }}
            disabled={isDownloading}
            className="absolute top-3 right-3 z-10 h-9 w-9 rounded-full flex items-center justify-center bg-white/85 backdrop-blur-sm text-gray-900 hover:bg-white shadow-md transition disabled:opacity-50"
            aria-label="Download media"
          >
            {isDownloading
              ? <FiLoader size={17} className="animate-spin" strokeWidth={2.5} />
              : <FiDownload size={17} strokeWidth={2.5} />}
          </button>
        </div>
      )}

      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 cursor-pointer" onClick={() => navigate(`/posts/${post._id}`)}>
            {post.title && (
              <h3 className="font-extrabold font-display text-lg leading-tight tracking-tight"
                style={{ color: 'var(--text-primary)' }}>
                {post.title}
              </h3>
            )}
            {post.content && post.content.trim() !== '' && post.content !== post.title && (
              <p className="text-sm mt-1 line-clamp-3" style={{ color: 'var(--text-secondary)' }}>
                {post.content}
              </p>
            )}
            {post.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {post.tags.slice(0, 4).map(tag => (
                  <span key={tag}
                    className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                    style={{
                      background: 'linear-gradient(135deg, rgba(251,191,36,0.12), rgba(251,191,36,0.04))',
                      color: '#b45309',
                      border: '1px solid rgba(251,191,36,0.25)'
                    }}>
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <motion.button
            onClick={e => handleLike(e, post._id)}
            whileTap={{ scale: 0.92 }}
            className="flex items-center gap-2 px-4 h-10 rounded-full hover:bg-[var(--bg-secondary)] transition"
            style={{ background: isLiked ? 'rgba(239,68,68,0.10)' : 'transparent' }}
          >
            <AnimatePresence mode="wait" initial={false}>
              {isLiked ? (
                <motion.span
                  key="liked"
                  initial={{ scale: 0.6 }} animate={{ scale: 1 }} exit={{ scale: 0.6, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                >
                  <FaHeart size={20} color="#ef4444" />
                </motion.span>
              ) : (
                <motion.span
                  key="unliked"
                  initial={{ scale: 0.6 }} animate={{ scale: 1 }} exit={{ scale: 0.6, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <FiHeart size={20} strokeWidth={2} style={{ color: 'var(--text-muted)' }} />
                </motion.span>
              )}
            </AnimatePresence>
            <span className="text-sm font-bold" style={{ color: isLiked ? '#ef4444' : 'var(--text-primary)' }}>
              {post.likes?.length || 0}
            </span>
          </motion.button>

          <motion.button
            onClick={(e) => { e.stopPropagation(); setActiveCommentPostId(post._id) }}
            whileTap={{ scale: 0.92 }}
            className="flex items-center gap-2 px-4 h-10 rounded-full hover:bg-[var(--bg-secondary)] transition"
          >
            <FiMessageCircle size={20} strokeWidth={2} style={{ color: 'var(--text-muted)' }} />
            <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              {commentCount}
            </span>
          </motion.button>
        </div>

        <InlineComments
          postId={post._id}
          user={user}
          onGoToProfile={(e, author) => goToProfile(e, author)}
          onOpenAll={(id) => setActiveCommentPostId(id)}
          onCountChange={(delta) =>
            setCommentDeltas((s) => ({ ...s, [post._id]: (s[post._id] || 0) + delta }))
          }
        />
      </div>
    </motion.article>
  )
}

/* ─────────── Main FeedPage ─────────── */

export default function FeedPage() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState('grid')
  const [query, setQuery] = useState('')
  const [activeCommentPostId, setActiveCommentPostId] = useState(null)
  const [commentDeltas, setCommentDeltas] = useState({})
  const [gridCommentCounts, setGridCommentCounts] = useState({})
  const [showHeartAnimation, setShowHeartAnimation] = useState(null)
  const [downloadingMap, setDownloadingMap] = useState({})
  const [scrolled, setScrolled] = useState(false)
  const [lightboxPost, setLightboxPost] = useState(null)
  const lastTapRef = useRef({})
  const navigate = useNavigate()
  const { user } = useAuthStore()

  useEffect(() => { fetchPosts() }, [])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

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
    } catch (err) {
      console.error('Failed to fetch posts:', err)
      setPosts([])
    } finally { setLoading(false) }
  }

  const handleLike = async (e, postId) => {
    e?.stopPropagation()
    if (!user) { toast.error('Log in to like posts'); navigate('/login'); return }
    try { await postsAPI.like(postId); fetchPosts() }
    catch (err) { console.error('Like failed:', err) }
  }

  const openLightbox = (post) => {
    setLightboxPost(post)
  }

  const handleDoubleTap = (e, postId, onSingleTap) => {
    e.stopPropagation()
    const now = Date.now()
    const lastTap = lastTapRef.current[postId] || 0
    if (now - lastTap < 300) {
      handleLike(e, postId)
      setShowHeartAnimation(postId)
      setTimeout(() => setShowHeartAnimation(null), 800)
      lastTapRef.current[postId] = 0
    } else {
      lastTapRef.current[postId] = now
      if (typeof onSingleTap === 'function') {
        setTimeout(() => {
          if (lastTapRef.current[postId] === now) onSingleTap()
        }, 300)
      }
    }
  }

  const goToProfile = (e, author) => {
    e?.stopPropagation()
    const authorId = author?._id || author?.id || author
    if (!authorId) return
    const myId = user?._id || user?.id
    if (String(authorId) === String(myId)) navigate('/profile')
    else navigate(`/users/${authorId}`)
  }

  const HeartAnimation = ({ postId }) => (
    <AnimatePresence>
      {showHeartAnimation === postId && (
        <motion.div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
          initial={{ scale: 0.5, opacity: 1 }} animate={{ scale: 1.4, opacity: 1 }}
          exit={{ scale: 1.8, opacity: 0 }} transition={{ duration: 0.5, ease: 'easeOut' }}>
          <FaHeart size={80} color="#ef4444" />
        </motion.div>
      )}
    </AnimatePresence>
  )

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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen" style={{ background: 'var(--bg-primary)' }}>
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-amber-500 border-t-transparent" />
      </div>
    )
  }

  if (posts.length === 0) {
    return (
      <motion.div className="flex flex-col items-center justify-center h-screen text-center px-4"
        style={{ background: 'var(--bg-primary)' }}
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <div className="w-24 h-24 rounded-full flex items-center justify-center mb-5" style={{ background: 'var(--bg-secondary)' }}>
          <FiImage size={40} strokeWidth={2} style={{ color: 'var(--text-muted)' }} />
        </div>
        <h3 className="text-2xl font-extrabold font-display" style={{ color: 'var(--text-primary)' }}>No posts yet</h3>
        <p className="text-sm mt-2 mb-6" style={{ color: 'var(--text-muted)' }}>Share something with the world</p>
        <motion.button onClick={() => navigate('/create')} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          className="flex items-center gap-2 px-7 py-3.5 bg-amber-500 hover:bg-amber-400 text-white font-bold rounded-full text-sm shadow-lg shadow-amber-500/30">
          <FiPlusSquare size={20} strokeWidth={2.5} /> Create Post
        </motion.button>
      </motion.div>
    )
  }

  const q = query.trim().toLowerCase()
  const visiblePosts = q
    ? posts.filter(p =>
      p.title?.toLowerCase().includes(q) ||
      p.content?.toLowerCase().includes(q) ||
      p.caption?.toLowerCase().includes(q) ||
      p.tags?.some(t => t.toLowerCase().includes(q)) ||
      p.author?.name?.toLowerCase().includes(q)
    )
    : posts

  const gridContainer = { animate: { transition: { staggerChildren: 0.03 } } }
  const gridItem = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0, transition: { duration: 0.22 } } }
  const monthGroups = groupPostsByMonth(visiblePosts)

  const renderGridTile = (post) => {
    const mediaItems = getMediaItems(post)
    return (
      <motion.div
        key={post._id}
        layoutId={`post-${post._id}`}
        variants={gridItem}
        whileHover={{ scale: 1.02 }}
        transition={{ layout: { type: 'spring', stiffness: 350, damping: 32 } }}
        className="relative group cursor-pointer rounded-[20%] overflow-hidden aspect-[4/5] shadow-sm"
        style={{ background: 'var(--bg-secondary)' }}
      >
        {mediaItems.length > 0 ? (
          <MediaSlider
            items={mediaItems}
            title={post.title}
            postId={post._id}
            onDoubleTap={(e) => handleDoubleTap(e, post._id, () => openLightbox(post))}
            rounded=""
            className="w-full h-full"
            hideDots
            peek
            renderVideo={(item) => (
              <BoomerangVideo src={item.url} poster={item.thumbnail} className="w-full h-full object-cover" />
            )}
          />
        ) : (
          <div onClick={(e) => handleDoubleTap(e, post._id, () => openLightbox(post))} className="w-full h-full flex items-center justify-center">
            <FiImage size={22} strokeWidth={2} style={{ color: 'var(--text-muted)' }} />
          </div>
        )}

        <MultiImageBadge count={mediaItems.length} />

        <div onClick={(e) => goToProfile(e, post.author)} className="absolute top-1.5 left-1.5 cursor-pointer z-10">
          <Avatar src={post.author?.avatar} name={post.author?.name} size={22} className="ring-2 ring-white/70 shadow" />
        </div>

        <HeartAnimation postId={post._id} />
      </motion.div>
    )
  }

  return (
    <>
      <div className="min-h-screen pb-10" style={{ background: 'var(--bg-primary)' }}>

        {/* Floating header */}
        <div
          className="fixed top-0 inset-x-0 z-30 px-3 sm:px-6 py-3 transition-all duration-300"
          style={{
            background: scrolled ? 'var(--bg-primary)' : 'transparent',
            boxShadow: scrolled ? '0 1px 0 rgba(0,0,0,0.06)' : 'none',
            backdropFilter: scrolled ? 'saturate(180%) blur(12px)' : 'none',
          }}
        >
          <div className="max-w-7xl mx-auto flex items-center gap-2 sm:gap-3">
            <div
              className="relative grid grid-cols-2 rounded-full p-1 w-[84px] flex-shrink-0"
              style={{
                background: scrolled ? 'var(--bg-secondary)' : 'rgba(255,255,255,0.18)',
                backdropFilter: 'blur(8px)',
              }}
            >
              <motion.div className="absolute top-1 bottom-1 rounded-full bg-amber-500"
                style={{ left: 4, width: 'calc(50% - 4px)' }}
                animate={{ x: viewMode === 'grid' ? 0 : '100%' }}
                transition={{ type: 'spring', stiffness: 400, damping: 28 }} />
              <button onClick={() => setViewMode('grid')} aria-label="Grid view"
                className="relative z-10 h-9 flex items-center justify-center rounded-full"
                style={{ color: viewMode === 'grid' ? '#fff' : (scrolled ? 'var(--text-muted)' : 'rgba(255,255,255,0.9)') }}>
                <FiGrid size={18} strokeWidth={2.5} />
              </button>
              <button onClick={() => setViewMode('list')} aria-label="List view"
                className="relative z-10 h-9 flex items-center justify-center rounded-full"
                style={{ color: viewMode === 'list' ? '#fff' : (scrolled ? 'var(--text-muted)' : 'rgba(255,255,255,0.9)') }}>
                <FiList size={18} strokeWidth={2.5} />
              </button>
            </div>

            <div className="relative flex-1 min-w-0 max-w-xl mx-auto">
              <FiSearch
                size={16}
                strokeWidth={2.25}
                className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: scrolled ? 'var(--text-muted)' : 'rgba(255,255,255,0.9)' }}
              />
              <input
                type="text"
                placeholder="Search posts"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded-full text-sm outline-none border-0 transition-all focus:ring-2 focus:ring-amber-500/40 placeholder:opacity-80"
                style={{
                  background: scrolled ? 'var(--bg-secondary)' : 'rgba(255,255,255,0.18)',
                  color: scrolled ? 'var(--text-primary)' : '#fff',
                  padding: '11px 40px 11px 42px',
                  fontWeight: 500,
                  backdropFilter: 'blur(8px)',
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
                    style={{
                      color: scrolled ? 'var(--text-primary)' : '#fff',
                      background: scrolled ? 'var(--bg-input)' : 'rgba(255,255,255,0.25)',
                    }}
                    aria-label="Clear search"
                  >
                    <FiX size={13} strokeWidth={2.5} />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

            <button onClick={() => navigate('/create')} aria-label="Create post"
              className="flex items-center justify-center h-10 w-10 rounded-full bg-amber-500 hover:bg-amber-400 text-white shadow-lg shadow-amber-500/30 transition-colors flex-shrink-0">
              <FiPlusSquare size={20} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        <WeddingHero />

        <div className="max-w-7xl mx-auto px-2 sm:px-4 pt-3">
          {monthGroups.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}
              className="flex flex-col items-center justify-center text-center px-4 pt-20">
              <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4" style={{ background: 'var(--bg-secondary)' }}>
                <FiSearch size={28} strokeWidth={2} style={{ color: 'var(--text-muted)' }} />
              </div>
              <h3 className="text-lg font-extrabold font-display" style={{ color: 'var(--text-primary)' }}>No results</h3>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>No posts match "{query}"</p>
            </motion.div>
          ) : (
            <LayoutGroup>
              {monthGroups.map((group) => (
                <div key={group.key} className="mb-10">
                  <div className="flex items-center gap-3 mb-4 px-1">
                    <h2 className="text-lg font-extrabold font-display tracking-tight"
                      style={{ color: 'var(--text-primary)' }}>
                      {group.label}
                    </h2>
                    <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                  </div>

                  {viewMode === 'grid' ? (
                    <motion.div
                      className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-3"
                      variants={gridContainer} initial="initial" animate="animate"
                    >
                      {group.posts.map((post) => renderGridTile(post))}
                    </motion.div>
                  ) : (
                    <motion.div
                      className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-10"
                      variants={gridContainer} initial="initial" animate="animate"
                    >
                      {group.posts.map((post) => (
                        <PostListItem
                          key={post._id}
                          post={post}
                          user={user}
                          gridItem={gridItem}
                          navigate={navigate}
                          handleLike={handleLike}
                          handleDoubleTap={handleDoubleTap}
                          goToProfile={goToProfile}
                          HeartAnimation={HeartAnimation}
                          downloadingMap={downloadingMap}
                          handleDownload={handleDownload}
                          commentDeltas={commentDeltas}
                          setCommentDeltas={setCommentDeltas}
                          setActiveCommentPostId={setActiveCommentPostId}
                        />
                      ))}
                    </motion.div>
                  )}
                </div>
              ))}
            </LayoutGroup>
          )}
        </div>
      </div>

      <CommentsSheet
        postId={activeCommentPostId}
        open={!!activeCommentPostId}
        onClose={() => setActiveCommentPostId(null)}
        user={user}
        onGoToProfile={(author) => goToProfile(null, author)}
        onCountChange={(count) =>
          setGridCommentCounts((s) => ({ ...s, [activeCommentPostId]: count }))
        }
      />

      <PhotoLightbox
        post={lightboxPost}
        onClose={() => setLightboxPost(null)}
        navigate={navigate}
      />
    </>
  )
}