// MediaSlider.js – fully functional, passes isActive to renderVideo
import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { FiPlay, FiVolume2, FiVolumeX } from 'react-icons/fi'

// ── Helper: normalize a post's images into an array of URLs ──────────────────
export function getImageUrls(post) {
  if (!post) return []
  const urls = []
  if (Array.isArray(post.images)) {
    post.images.forEach(img => {
      if (typeof img === 'string') urls.push(img)
      else if (img?.url) urls.push(img.url)
    })
  }
  if (Array.isArray(post.videos)) {
    post.videos.forEach(vid => {
      if (typeof vid === 'string') urls.push(vid)
      else if (vid?.url) urls.push(vid.url)
    })
  }
  if (Array.isArray(post.media)) {
    post.media.forEach(m => {
      const u = typeof m === 'string' ? m : m?.url
      if (u && !urls.includes(u)) urls.push(u)
    })
  }
  if (urls.length === 0) {
    if (post.image?.url) urls.push(post.image.url)
    else if (typeof post.image === 'string') urls.push(post.image)
    else if (post.imageUrl) urls.push(post.imageUrl)
    else if (post.thumbnail) urls.push(post.thumbnail)
  }
  return urls.filter(Boolean)
}

export function getMediaItems(post) {
  if (!post) return []
  const items = []
  if (Array.isArray(post.images)) {
    post.images.forEach(img => {
      const url = typeof img === 'string' ? img : img?.url
      if (url) items.push({ type: 'image', url })
    })
  }
  if (Array.isArray(post.videos)) {
    post.videos.forEach(vid => {
      if (typeof vid === 'string') items.push({ type: 'video', url: vid, thumbnail: null })
      else if (vid?.url) items.push({ type: 'video', url: vid.url, thumbnail: vid.thumbnail || null })
    })
  }
  if (items.length === 0 && Array.isArray(post.media)) {
    post.media.forEach(m => {
      const url = typeof m === 'string' ? m : m?.url
      const type = m?.type || (url && /\.(mp4|mov|webm|m4v)$/i.test(url) ? 'video' : 'image')
      if (url) items.push({ type, url, thumbnail: m?.thumbnail })
    })
  }
  if (items.length === 0) {
    if (post.image?.url) items.push({ type: 'image', url: post.image.url })
    else if (typeof post.image === 'string') items.push({ type: 'image', url: post.image })
    else if (post.imageUrl) items.push({ type: 'image', url: post.imageUrl })
    else if (post.thumbnail) items.push({ type: 'image', url: post.thumbnail })
  }
  return items
}

// ── NEW: measures the real aspect ratio of a post's first media item, the
// same way Instagram sizes a post's frame off its first photo/video, instead
// of forcing every post into a fixed square/4:5 box that crops content.
// Clamped to IG's own portrait/landscape bounds (4:5 .. 1.91:1) so a very
// tall or very wide file doesn't blow out the feed layout.
export function useMediaAspect(items, { min = 4 / 5, max = 1.91, fallback = 1 } = {}) {
  const [ratio, setRatio] = useState(fallback)
  const firstUrl = items?.[0]?.url
  const firstType = items?.[0]?.type

  useEffect(() => {
    if (!firstUrl) { setRatio(fallback); return }
    let cancelled = false

    if (firstType === 'video') {
      const v = document.createElement('video')
      v.preload = 'metadata'
      v.src = firstUrl
      v.onloadedmetadata = () => {
        if (cancelled) return
        if (v.videoWidth && v.videoHeight) {
          const r = v.videoWidth / v.videoHeight
          setRatio(Math.min(max, Math.max(min, r)))
        }
      }
    } else {
      const img = new window.Image()
      img.src = firstUrl
      img.onload = () => {
        if (cancelled) return
        if (img.naturalWidth && img.naturalHeight) {
          const r = img.naturalWidth / img.naturalHeight
          setRatio(Math.min(max, Math.max(min, r)))
        }
      }
    }
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstUrl, firstType])

  return ratio
}

// ── Instagram-style video — autoplaying, muted, looping, no native browser
// controls (so no "paused" chrome flashes on refresh), tap toggles
// play/pause, small mute toggle bottom-right.
//
// `isActive` (passed down from MediaSlider when this is one slide among
// several) AND real viewport visibility both gate playback now. Previously
// this played on mount unconditionally, which meant every video inside a
// multi-media post's slider started decoding and playing at once — not just
// the one slide actually on screen. With several video posts in a feed that
// adds up fast and was the main cause of stuttery dragging/scrolling.
export function InstagramVideo({ src, poster, className, style, isActive = true }) {
  const videoRef = useRef(null)
  const wrapRef = useRef(null)
  const [muted, setMuted] = useState(true)
  const [paused, setPaused] = useState(false)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.2 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const shouldPlay = isActive && inView

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (shouldPlay) {
      v.play().catch(() => {})
    } else {
      v.pause()
    }
  }, [shouldPlay, src])

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible' && shouldPlay) videoRef.current?.play().catch(() => {}) }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [shouldPlay])

  const togglePlay = (e) => {
    e.stopPropagation()
    const v = videoRef.current
    if (!v) return
    if (v.paused) v.play().catch(() => {})
    else v.pause()
  }

  return (
    <div ref={wrapRef} className="relative w-full h-full" onClick={togglePlay}>
      <video
        ref={videoRef}
        src={src}
        poster={poster || undefined}
        className={className}
        style={style}
        muted={muted}
        loop
        playsInline
        preload={shouldPlay ? 'auto' : 'metadata'}
        onPlay={() => setPaused(false)}
        onPause={() => setPaused(true)}
        onError={(e) => { e.target.style.display = 'none' }}
      />
      {paused && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center backdrop-blur-md"
            style={{ background: 'rgba(0,0,0,0.45)' }}
          >
            <FiPlay size={22} color="white" fill="white" style={{ marginLeft: 3 }} />
          </div>
        </div>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); setMuted(m => !m) }}
        aria-label={muted ? 'Unmute' : 'Mute'}
        className="absolute bottom-3 right-3 z-10 w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-md"
        style={{ background: 'rgba(0,0,0,0.5)' }}
      >
        {muted ? <FiVolumeX size={15} color="white" /> : <FiVolume2 size={15} color="white" />}
      </button>
    </div>
  )
}

export function MultiImage({ urls, title, postId, onDoubleTap, tileRadius = 'rounded-xl', gapClass = 'gap-1.5', children }) {
  // ... (same as you pasted, no changes) — keep your existing implementation here
}

export function ImageSlider({ urls, title, postId, onDoubleTap, rounded = 'rounded-2xl', className = '', showCounter = true, hideDots = false, peek = false, tapToNavigate = true }) {
  // ... (same as you pasted, no changes) — keep your existing implementation here
}

export function MediaSlider({
  items, title, postId, onDoubleTap, rounded = 'rounded-2xl', className = '',
  showCounter = true, hideDots = false, peek = false, tapToNavigate = true,
  renderVideo, fit = 'cover', // ← 'cover' (default, unchanged for grid) or 'contain' (full media visible)
}) {
  const [index, setIndex] = useState(0)
  const containerRef = useRef(null)
  const dragInfo = useRef({ dragged: false })

  if (!items || items.length === 0) return null

  const fitClass = fit === 'contain' ? 'object-contain' : 'object-cover'

  const renderSlide = (item, isActive) => (
    item.type === 'video'
      ? (renderVideo
          ? renderVideo(item, isActive)
          : <InstagramVideo src={item.url} poster={item.thumbnail} className={`w-full h-full ${fitClass}`} isActive={isActive} />)
      : (
        <img
          src={item.url}
          alt={title || 'Post'}
          className={`w-full h-full ${fitClass}`}
          loading="lazy"
          draggable={false}
          onError={(e) => (e.target.style.display = 'none')}
        />
      )
  )

  if (items.length === 1) {
    return (
      <div className={`relative w-full h-full overflow-hidden ${rounded} ${className}`} onClick={onDoubleTap}>
        {renderSlide(items[0], true)}
      </div>
    )
  }

  const hasNext = index < items.length - 1
  const hasNextNext = index < items.length - 2
  const clampIndex = (i) => Math.max(0, Math.min(items.length - 1, i))

  const goTo = (i, e) => { e?.stopPropagation(); setIndex(clampIndex(i)) }

  const handleTap = (e) => {
    if (dragInfo.current.dragged) { dragInfo.current.dragged = false; return }
    if (tapToNavigate) {
      const rect = containerRef.current.getBoundingClientRect()
      const ratio = (e.clientX - rect.left) / rect.width
      if (ratio < 0.25) {
        if (index > 0) goTo(index - 1, e); else e.stopPropagation()
        return
      }
      if (ratio > 0.75) {
        if (index < items.length - 1) goTo(index + 1, e); else e.stopPropagation()
        return
      }
    }
    onDoubleTap?.(e)
  }

  const handleDragEnd = (e, info) => {
    const threshold = 40
    if (Math.abs(info.offset.x) > threshold) {
      dragInfo.current.dragged = true
      if (info.offset.x < 0) setIndex((i) => clampIndex(i + 1))
      else setIndex((i) => clampIndex(i - 1))
    }
  }

  const stackImg = (item) => item.thumbnail || (item.type === 'image' ? item.url : null)
  const showStack = peek && hasNext
  const showStack2 = peek && hasNextNext

  return (
    <div ref={containerRef} className={`relative w-full h-full overflow-hidden ${rounded} ${className}`} style={{ touchAction: 'pan-y' }} onClick={handleTap}>
      {showStack2 && stackImg(items[index + 2]) && (
        <div
          className="absolute inset-0 overflow-hidden rounded-[20%] pointer-events-none"
          style={{ transform: 'rotate(22deg) scale(0.86) translate(9%, -7%)', filter: 'brightness(0.55)' }}
        >
          <img src={stackImg(items[index + 2])} alt="" className="w-full h-full object-cover" draggable={false} />
        </div>
      )}

      {showStack && stackImg(items[index + 1]) && (
        <div
          className="absolute inset-0 overflow-hidden rounded-[20%] pointer-events-none"
          style={{ transform: 'rotate(16deg) scale(0.91) translate(4.5%, -3.5%)', filter: 'brightness(0.75)' }}
        >
          <img src={stackImg(items[index + 1])} alt="" className="w-full h-full object-cover" draggable={false} />
        </div>
      )}

      <div
        className={`absolute inset-0 overflow-hidden ${showStack ? 'rounded-[20%]' : ''}`}
        style={showStack ? { transform: 'rotate(-10deg)', boxShadow: '0 6px 20px rgba(0,0,0,0.35)' } : undefined}
      >
        <motion.div
          className="flex h-full"
          // will-change hints the browser to promote this to its own GPU
          // compositor layer up front, instead of deciding mid-drag — that
          // "deciding" moment was part of what made the first swipe of a
          // session feel janky compared to the second.
          style={{ width: `${items.length * 100}%`, willChange: 'transform' }}
          drag="x"
          dragConstraints={containerRef}
          dragElastic={0.06}
          dragMomentum={false}
          onDragEnd={handleDragEnd}
          animate={{ x: `-${index * (100 / items.length)}%` }}
          transition={{ type: 'spring', stiffness: 380, damping: 38 }}
        >
          {items.map((item, i) => {
            const isActive = i === index
            // Only the active slide should be interactive, and only when
            // it's a video (so its play/pause + mute controls can receive
            // taps).
            const interactive = item.type === 'video' && isActive
            return (
              <div
                key={`${postId}-${i}`}
                className={`h-full flex-shrink-0 ${interactive ? '' : 'pointer-events-none'}`}
                style={{ width: `${100 / items.length}%` }}
              >
                {renderSlide(item, isActive)}
              </div>
            )
          })}
        </motion.div>
      </div>

      {showCounter && (
        <div
          className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[11px] font-bold text-white z-20 pointer-events-none"
          style={{ background: 'rgba(0,0,0,0.55)' }}
        >
          {index + 1}/{items.length}
        </div>
      )}
      {!hideDots && (
        <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5 z-20 pointer-events-none">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={(e) => goTo(i, e)}
              aria-label={`Go to item ${i + 1}`}
              className="h-1.5 rounded-full transition-all pointer-events-auto"
              style={{ width: i === index ? 14 : 6, background: i === index ? '#fff' : 'rgba(255,255,255,0.55)' }}
            />
          ))}
        </div>
      )}
    </div>
  )
}