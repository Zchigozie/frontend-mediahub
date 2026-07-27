import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FiX, FiZap, FiImage, FiCheck, FiArrowLeft,
  FiPlay, FiRotateCw, FiCamera, FiVideo,
} from 'react-icons/fi'
import { postsAPI, uploadAPI, uploadMediaDirect } from '../api'
import toast from 'react-hot-toast'

const MAX_MEDIA = 5
const MAX_DIMENSION = 2048
const JPEG_QUALITY = 0.92
const MAX_IMAGE_SIZE = 10 * 1024 * 1024
const MAX_VIDEO_SIZE = 100 * 1024 * 1024
const SIGNATURE_TTL = 8 * 60 * 1000

let idSeq = 0
const nextId = () => `media_${Date.now()}_${idSeq++}`

/* ─────────────────────────── helpers ─────────────────────────── */

function compressImage(file) {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) return resolve(file)
    // Captures from our own in-app camera are already sized and encoded
    // once in capturePhoto() at full quality. Running them through a
    // second lossy resize/re-encode pass here was the main cause of soft,
    // muddy in-app photos — so skip this step for anything we captured
    // ourselves and only compress gallery-picked files.
    if (file.name.startsWith('capture_')) return resolve(file)
    const img = new window.Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width > height) {
          height = Math.round((height * MAX_DIMENSION) / width)
          width = MAX_DIMENSION
        } else {
          width = Math.round((width * MAX_DIMENSION) / height)
          height = MAX_DIMENSION
        }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)
      canvas.toBlob((blob) => {
        if (!blob || blob.size >= file.size) return resolve(file)
        resolve(new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }))
      }, 'image/jpeg', JPEG_QUALITY)
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}

// Video previews: unlike the old in-page MediaRecorder flow, videos now
// always arrive as a finished file handed back from the OS camera/gallery —
// never an in-progress recording — so it's safe to preview them client-side
// via a plain object URL. We render them the same boomerang (forward, then
// reverse) way the main feed grid does, so the composer and feed look and
// feel consistent.
function BoomerangVideo({ src, className, style }) {
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
      className={className}
      style={style}
      muted
      playsInline
      autoPlay
      loop={false}
      onError={(e) => { e.target.style.display = 'none' }}
    />
  )
}

/* ─────────────────────────── component ─────────────────────────── */

export default function CreatePostPage() {
  const navigate = useNavigate()
  const fileRef = useRef(null)
  const videoFileRef = useRef(null)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const abortControllerRef = useRef(null)
  const signatureRef = useRef(null)
  const videoUrlsRef = useRef(new Set())

  const [screen, setScreen] = useState('capture')
  const [mediaItems, setMediaItems] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState(false)
  const [facing, setFacing] = useState('environment')
  const [flashOn, setFlashOn] = useState(false)
  const [torchSupported, setTorchSupported] = useState(false)
  const [flashPulse, setFlashPulse] = useState(false)
  const [shutterClick, setShutterClick] = useState(false)
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadStage, setUploadStage] = useState('uploading')
  const [errors, setErrors] = useState({})

  const remainingSlots = MAX_MEDIA - mediaItems.length
  const anyCompressing = mediaItems.some((i) => i.compressing)
  const activeItem = useMemo(
    () => mediaItems.find((i) => i.id === activeId) || mediaItems[0] || null,
    [mediaItems, activeId]
  )

  // Hide the app's persistent bottom nav while this full-screen composer is
  // mounted. This page renders as a `fixed inset-0` overlay, but the bottom
  // nav lives elsewhere in the tree as its own fixed-position component, so
  // z-index on this page alone doesn't guarantee it's covered. Injecting the
  // rule directly here targets common bottom-nav markup conventions so this
  // works without editing another file. If your nav still shows through,
  // add its real class/id to the selector list below.
  useEffect(() => {
    const style = document.createElement('style')
    style.setAttribute('data-composer-nav-hide', 'true')
    style.textContent = `
      body.composer-open nav,
      body.composer-open [class*="bottom-nav" i],
      body.composer-open [class*="bottomnav" i],
      body.composer-open [class*="tab-bar" i],
      body.composer-open [class*="tabbar" i],
      body.composer-open [id*="bottom-nav" i],
      body.composer-open [data-bottom-nav] {
        display: none !important;
      }
    `
    document.head.appendChild(style)
    document.body.classList.add('composer-open')
    return () => {
      document.body.classList.remove('composer-open')
      style.remove()
    }
  }, [])

  const getCachedSignature = useCallback(() => {
    const now = Date.now()
    if (signatureRef.current && now - signatureRef.current.timestamp < SIGNATURE_TTL) {
      return signatureRef.current.promise
    }
    const promise = uploadAPI.getSignature().then((res) => res.data.data)
    signatureRef.current = { promise, timestamp: now }
    promise.catch(() => { if (signatureRef.current?.promise === promise) signatureRef.current = null })
    return promise
  }, [])

  /* camera — photos only. Video is handed off to the OS camera app so this
     page never holds the hardware for longer than a live photo preview.

     Resolution: we explicitly request a high `ideal` width/height instead
     of letting getUserMedia fall back to its own (often 640x480 or
     1280x720) default. Without this, the sensor stream itself is
     low-res and no amount of downstream JPEG quality tuning can recover
     detail that was never captured. `ideal` (not `min`/exact) so it still
     degrades gracefully on weaker devices instead of failing outright. */
  const startCamera = useCallback(async () => {
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      let stream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facing,
            width: { ideal: 1920 },
            height: { ideal: 1920 },
          },
          audio: false,
        })
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing },
        })
      }
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {})
      }
      setCameraReady(true); setCameraError(false)

      // Torch (hardware flashlight) support check. This is a real hardware
      // capability, not a bug we can work around: iOS (Safari, and every
      // other iOS browser, since they all run on WKWebView) never exposes
      // `torch` in getCapabilities() at all. Only Chromium-based browsers
      // on Android generally support it. That's why flash falls back to a
      // screen flash below whenever this comes back false.
      const track = stream.getVideoTracks()[0]
      const supportsTorch = !!track?.getCapabilities?.().torch
      setTorchSupported(supportsTorch)
      if (supportsTorch && flashOn) {
        track.applyConstraints({ advanced: [{ torch: true }] }).catch((err) => {
          console.error('Torch re-apply failed after camera restart', err)
        })
      }
    } catch {
      setCameraError(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facing])

  useEffect(() => {
    startCamera()
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      if (videoRef.current) videoRef.current.srcObject = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facing])

  useEffect(() => () => {
    abortControllerRef.current?.abort()
    videoUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
  }, [])

  const toggleFlash = async () => {
    const track = streamRef.current?.getVideoTracks()?.[0]
    const next = !flashOn
    if (torchSupported && track) {
      try {
        await track.applyConstraints({ advanced: [{ torch: next }] })
        setFlashOn(next)
      } catch (err) {
        console.error('Torch toggle failed', err)
        toast.error('Flash failed on this device')
      }
    } else {
      // No hardware torch on this device/browser (always true on iOS — see
      // note above). Screen-flash fallback: capturePhoto() below fires a
      // full-brightness pulse right before the shot instead.
      setFlashOn(next)
      if (next) toast('No hardware flash here — using a bright screen flash for photos instead', { icon: '💡' })
    }
  }

  const handleFiles = useCallback((fileListLike) => {
    const incoming = Array.from(fileListLike || [])
    if (!incoming.length) return
    if (remainingSlots <= 0) return toast.error(`You can add up to ${MAX_MEDIA} media items`)

    const accepted = []
    for (const f of incoming) {
      if (accepted.length >= remainingSlots) {
        toast.error(`Only ${remainingSlots} more allowed`); break
      }
      const isVideo = f.type.startsWith('video/')
      const isImage = f.type.startsWith('image/')
      if (!isImage && !isVideo) { toast.error(`${f.name} isn't an image or video`); continue }
      const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE
      if (f.size > maxSize) {
        toast.error(`${f.name} too large. Max ${maxSize / (1024 * 1024)}MB`); continue
      }
      accepted.push(f)
    }
    if (!accepted.length) return

    if (mediaItems.length === 0) getCachedSignature()
    setErrors((p) => ({ ...p, content: '' }))

    accepted.forEach((f) => {
      const id = nextId()
      const isVideo = f.type.startsWith('video/')
      if (isVideo) {
        // The file here is a finished recording (system camera or gallery
        // pick), so a plain object URL is safe and instant — no need to
        // wait on anything async the way the image compression path does.
        const url = URL.createObjectURL(f)
        videoUrlsRef.current.add(url)
        setMediaItems((prev) => [...prev, { id, file: f, preview: url, compressing: false, isVideo: true }])
      } else {
        setMediaItems((prev) => [...prev, { id, file: f, preview: null, compressing: true, isVideo: false }])
        ;(async () => {
          const compressed = await compressImage(f)
          const reader = new FileReader()
          reader.onloadend = () => {
            setMediaItems((prev) => prev.map((i) =>
              i.id === id ? { ...i, file: compressed, preview: reader.result, compressing: false } : i))
          }
          reader.readAsDataURL(compressed)
        })()
      }
    })
    // Deliberately NOT auto-selecting the newly captured/added item here.
    // The viewfinder always shows the live camera; captured shots land in
    // the thumbnail strip below so the next shot can be taken immediately.
    // `activeId` stays whatever it was (usually null), and `activeItem`
    // only matters once the user moves to the edit screen.
  }, [remainingSlots, mediaItems.length, getCachedSignature])

  /* Front camera ("selfie") capture must match what's on screen. The live
     preview is mirrored with CSS (scaleX(-1)) so it behaves like a real
     mirror while framing a shot — but that's purely a visual flip on the
     <video> element, it doesn't touch the underlying frames. If we draw
     those raw frames straight to canvas, the saved photo comes out
     un-mirrored: left/right ends up swapped compared to what you just saw
     and posed for. Snapchat (and every other selfie camera) avoids this by
     saving the mirrored version, not the raw sensor frame — so here we flip
     the canvas horizontally before drawing whenever we're on the front
     camera, to match. The rear camera is never mirrored, on screen or in
     the saved photo. */
  const capturePhoto = () => {
    const video = videoRef.current
    if (!video || !cameraReady || !video.videoWidth) return

    const doCapture = () => {
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      canvas.width = video.videoWidth; canvas.height = video.videoHeight
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      if (facing === 'user') {
        ctx.translate(canvas.width, 0)
        ctx.scale(-1, 1)
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      canvas.toBlob((blob) => {
        if (!blob) return
        handleFiles([new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' })])
      }, 'image/jpeg', 0.95)
    }

    if (flashOn && !torchSupported) {
      // Real screen-flash: full white, held a beat longer so it actually
      // lights the subject (and reads unmistakably as "flash fired", unlike
      // the quick shutter-click below).
      setFlashPulse(true)
      setTimeout(() => {
        doCapture()
        setTimeout(() => setFlashPulse(false), 180)
      }, 120)
    } else {
      // Either flash is off, or torch is already lighting the scene
      // continuously — just a quick, subtle click for shutter feedback.
      setShutterClick(true)
      setTimeout(() => setShutterClick(false), 90)
      doCapture()
    }
  }

  /* Video capture — handed off entirely to the OS camera/video app via a
     hidden file input. This in-page camera is photo-only; video always goes
     through the system camera app, triggered by its own button (not a
     gesture on the photo shutter).

     Stopping the tracks alone isn't always enough — on iOS Safari in
     particular, the <video> element's srcObject can keep holding a
     reference to the (now-stopped) stream, which keeps the session "open"
     from the OS's point of view and is exactly why the system camera then
     reports the camera as already in use on a call. So: stop every track,
     then explicitly null out srcObject, then pause() the element, and give
     it a beat before handing off — rather than firing the file input in the
     same tick as stopping the stream. */
  const releaseCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.srcObject = null
    }
    setCameraReady(false)
  }

  const openVideoCapture = () => {
    releaseCamera()
    // Give the browser/OS a moment to actually free the hardware before
    // asking the system camera app for it — doing this in the same tick as
    // stop() is the most common cause of the "still on a call" error.
    setTimeout(() => {
      videoFileRef.current?.click()
    }, 250)

    const resume = () => {
      window.removeEventListener('focus', resume)
      // give the OS camera app a beat to fully release the hardware on its
      // way back out, too, before we try to reclaim it
      setTimeout(() => startCamera(), 400)
    }
    window.addEventListener('focus', resume)
  }

  const removeMedia = (id, e) => {
    e?.stopPropagation()
    setMediaItems((prev) => {
      const removed = prev.find((i) => i.id === id)
      if (removed?.isVideo && removed.preview) {
        URL.revokeObjectURL(removed.preview)
        videoUrlsRef.current.delete(removed.preview)
      }
      const next = prev.filter((i) => i.id !== id)
      if (!next.length) signatureRef.current = null
      return next
    })
    setActiveId((prev) => {
      if (prev !== id) return prev
      const next = mediaItems.filter((i) => i.id !== id)
      return next[0]?.id || null
    })
    if (fileRef.current) fileRef.current.value = ''
  }

  const validate = () => {
    const e = {}
    if (mediaItems.length === 0 && !content.trim()) e.content = 'Add a photo/video or write something'
    setErrors(e)
    return !Object.keys(e).length
  }

  const canShare = Boolean((content.trim() || mediaItems.length > 0) && !loading && !anyCompressing)
  const canNext = mediaItems.length > 0 || content.trim().length > 0

  const handleCancel = () => {
    setUploadStage('cancelling')
    abortControllerRef.current?.abort()
  }

  const handleSubmit = async () => {
    if (!canShare || !validate()) return
    setLoading(true); setUploadProgress(0); setUploadStage('uploading')
    const controller = new AbortController()
    abortControllerRef.current = controller
    try {
      let images = [], videos = []
      if (mediaItems.length) {
        const signatureData = await getCachedSignature()
        const fp = new Array(mediaItems.length).fill(0)
        const update = () => setUploadProgress(Math.round(fp.reduce((a, b) => a + b, 0) / mediaItems.length))
        const results = await Promise.all(mediaItems.map(({ file }, i) =>
          uploadMediaDirect({
            file, signatureData, signal: controller.signal,
            onProgress: (pct) => { fp[i] = pct; update() },
          })
        ))
        mediaItems.forEach((it, i) => it.isVideo ? videos.push(results[i]) : images.push(results[i]))
      }
      setUploadStage('saving')
      const payload = { images, videos }
      if (content.trim()) payload.content = content.trim()
      else if (mediaItems.length) payload.content = ' '
      await postsAPI.create(payload, { signal: controller.signal })
      toast.success('Posted 🎉')
      navigate('/')
    } catch (err) {
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') toast('Upload cancelled')
      else { console.error(err); toast.error(err.response?.data?.message || 'Failed to create post') }
    } finally {
      setLoading(false); setUploadProgress(0); setUploadStage('uploading')
      abortControllerRef.current = null; signatureRef.current = null
    }
  }

  /* ─────────────────────────── UI ─────────────────────────── */

  return (
    <div className="fixed inset-0 z-[999] overflow-hidden select-none text-white"
      style={{ background: '#000', fontFamily: '-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter",sans-serif' }}>
      <canvas ref={canvasRef} className="hidden" />

      {/* ─── Capture layer ─── */}
      <div
        className="absolute inset-0 flex flex-col"
        style={{
          transform: screen === 'edit' ? 'scale(0.94)' : 'scale(1)',
          filter: screen === 'edit' ? 'brightness(0.3) blur(2px)' : 'none',
          transition: 'transform .35s cubic-bezier(.2,.8,.2,1), filter .3s ease',
          pointerEvents: screen === 'edit' ? 'none' : 'auto',
        }}
      >
        {/* Viewfinder — always shows the live camera. Captured shots are
            never overlaid here; they only appear in the thumbnail strip
            below, so the feed stays clear and ready for the next shot. */}
        <div className="relative flex-1" style={{ background: '#0a0a0a' }}>
          {!cameraError && (
            <video
              ref={videoRef}
              playsInline muted
              className="absolute inset-0 w-full h-full object-cover"
              style={{
                opacity: cameraReady ? 1 : 0,
                transition: 'opacity .5s ease',
                transform: facing === 'user' ? 'scaleX(-1)' : 'none',
              }}
            />
          )}

          {cameraError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-8 gap-3"
              style={{ background: 'radial-gradient(circle at center, #1a1a1a, #000)' }}>
              <div className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.06)' }}>
                <FiCamera size={22} color="rgba(255,255,255,0.5)" />
              </div>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Camera unavailable — use the gallery
              </p>
            </div>
          )}

          {/* Real flash: full-white, held a beat — this is the actual light
              source on devices with no hardware torch (see capturePhoto). */}
          <AnimatePresence>
            {flashPulse && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.08 }}
                className="absolute inset-0 pointer-events-none"
                style={{ background: '#fff' }}
              />
            )}
          </AnimatePresence>

          {/* Shutter click: quick, low-opacity — just feedback that a photo
              was taken, deliberately much weaker than the real flash above
              so the two are never confused for each other. */}
          <AnimatePresence>
            {shutterClick && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 0.22 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.06 }}
                className="absolute inset-0 pointer-events-none"
                style={{ background: '#fff' }}
              />
            )}
          </AnimatePresence>

          {/* Top header (over camera) */}
          <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-4"
            style={{
              paddingTop: 'max(env(safe-area-inset-top), 14px)',
              paddingBottom: 12,
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.55), transparent)',
            }}>
            <IconButton onClick={() => navigate(-1)} label="Close"><FiX size={20} /></IconButton>
            <h1 className="text-[15px] font-semibold tracking-tight">New post</h1>
            <div className="flex items-center gap-2">
              <IconButton
                onClick={toggleFlash}
                label="Flash"
                style={{ color: flashOn ? '#fbbf24' : '#fff' }}
              >
                <FiZap size={17} fill={flashOn ? '#fbbf24' : 'none'} />
              </IconButton>
              <IconButton
                onClick={() => setFacing((f) => f === 'user' ? 'environment' : 'user')}
                label="Flip camera"
              >
                <FiRotateCw size={16} />
              </IconButton>
              <IconButton onClick={openVideoCapture} label="Record video">
                <FiVideo size={17} />
              </IconButton>
              <IconButton onClick={() => fileRef.current?.click()} label="Gallery">
                <FiImage size={17} />
              </IconButton>
            </div>
          </div>

          {/* Bottom gradient */}
          <div className="absolute inset-x-0 bottom-0 h-52 pointer-events-none"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)' }} />
        </div>

        {/* Bottom control deck */}
        <div className="relative z-10" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 18px)' }}>
          {/* Gallery strip — every captured/picked item lands here, tap to
              mark it as the cover item for the edit screen. */}
          <div className="px-3 pb-3">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              {mediaItems.map((item) => {
                const isActive = item.id === activeItem?.id
                return (
                  <motion.button
                    key={item.id}
                    layout
                    onClick={() => setActiveId(item.id)}
                    className="relative flex-shrink-0 rounded-2xl overflow-hidden"
                    style={{
                      width: 62, height: 62,
                      boxShadow: isActive ? '0 0 0 2px #fff' : '0 0 0 1px rgba(255,255,255,0.12)',
                      transition: 'box-shadow .2s ease',
                    }}
                  >
                    {item.isVideo && item.preview ? (
                      <BoomerangVideo src={item.preview} className="w-full h-full object-cover" />
                    ) : item.preview ? (
                      <img src={item.preview} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full animate-pulse"
                        style={{ background: 'rgba(255,255,255,0.08)' }} />
                    )}
                    {item.isVideo && (
                      <span className="absolute bottom-1 left-1 flex items-center gap-0.5 px-1 rounded"
                        style={{ background: 'rgba(0,0,0,0.55)' }}>
                        <FiPlay size={9} fill="white" />
                      </span>
                    )}
                    <span
                      onClick={(e) => removeMedia(item.id, e)}
                      className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center"
                      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
                    >
                      <FiX size={9} />
                    </span>
                  </motion.button>
                )
              })}
              {remainingSlots > 0 && (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex-shrink-0 flex items-center justify-center rounded-2xl"
                  style={{
                    width: 62, height: 62,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px dashed rgba(255,255,255,0.18)',
                  }}
                >
                  <FiImage size={18} color="rgba(255,255,255,0.5)" />
                </button>
              )}
            </div>
          </div>

          {/* Shutter row — the shutter is centered via a flex wrapper (not a
              translate() transform) so Framer Motion's own transform
              (whileTap scale) never overwrites a manual centering offset.
              That was the cause of the button "jumping" on every tap.
              This shutter is photo-only — video is a separate button (top
              bar) that hands off entirely to the OS camera app, so this
              page's live preview never competes with it for the camera. */}
          <div className="relative flex items-center justify-between px-8 pb-2 min-h-[76px]">
            <button
              onClick={() => fileRef.current?.click()}
              className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)' }}
            >
              <FiImage size={18} />
            </button>

            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={capturePhoto}
                disabled={!cameraReady}
                aria-label="Take photo"
                className="pointer-events-auto rounded-full flex items-center justify-center disabled:opacity-40"
                style={{
                  width: 76, height: 76,
                  background: 'transparent',
                  boxShadow: '0 0 0 3px #fff, 0 0 0 6px rgba(0,0,0,0.4)',
                }}
              >
                <span style={{ width: 60, height: 60, borderRadius: '50%', background: '#fff', display: 'block' }} />
              </motion.button>
            </div>

            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={() => setScreen('edit')}
              disabled={!canNext}
              className="inline-flex items-center justify-center px-6 h-11 min-w-[84px] rounded-full text-sm font-semibold whitespace-nowrap disabled:opacity-30 flex-shrink-0"
              style={{
                background: canNext
                  ? 'linear-gradient(135deg, #3b82f6, #6366f1)'
                  : 'rgba(255,255,255,0.08)',
                color: '#fff',
                boxShadow: canNext ? '0 6px 20px rgba(59,130,246,0.45)' : 'none',
              }}
            >
              Next
            </motion.button>
          </div>
        </div>
      </div>

      {/* ─── Edit sheet ─── */}
      <AnimatePresence>
        {screen === 'edit' && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setScreen('capture')}
              className="absolute inset-0"
              style={{ background: 'rgba(0,0,0,0.5)' }}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 34, stiffness: 320 }}
              className="absolute bottom-0 inset-x-0 flex flex-col overflow-hidden"
              style={{
                height: '86%',
                background: 'linear-gradient(to bottom, #1c1c1e, #141416)',
                borderTopLeftRadius: 28, borderTopRightRadius: 28,
                boxShadow: '0 -24px 60px rgba(0,0,0,0.55)',
              }}
            >
              {/* grabber */}
              <div className="flex justify-center pt-2.5 pb-1">
                <span className="w-9 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }} />
              </div>

              {/* header */}
              <div className="flex items-center justify-between px-4 py-3 gap-3">
                <button
                  onClick={() => setScreen('capture')}
                  className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(255,255,255,0.06)' }}
                >
                  <FiArrowLeft size={18} />
                </button>
                <h2 className="text-[15px] font-semibold tracking-tight flex-1 text-center">New post</h2>
                <motion.button
                  whileTap={{ scale: 0.94 }}
                  onClick={handleSubmit}
                  disabled={!canShare}
                  className="inline-flex items-center justify-center px-5 h-9 min-w-[76px] rounded-full text-[13px] font-bold whitespace-nowrap disabled:opacity-30 flex-shrink-0"
                  style={{
                    background: canShare
                      ? 'linear-gradient(135deg, #3b82f6, #6366f1)'
                      : 'rgba(255,255,255,0.06)',
                    color: '#fff',
                    boxShadow: canShare ? '0 4px 14px rgba(59,130,246,0.4)' : 'none',
                  }}
                >
                  Share
                </motion.button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-3">
                {/* Caption */}
                <div className="flex gap-3 mb-4">
                  <div className="w-[76px] h-[76px] rounded-xl overflow-hidden flex-shrink-0 relative"
                    style={{ background: '#000', boxShadow: '0 0 0 1px rgba(255,255,255,0.06)' }}>
                    {activeItem?.isVideo && activeItem.preview ? (
                      <BoomerangVideo src={activeItem.preview} className="w-full h-full object-cover" />
                    ) : activeItem?.preview ? (
                      <img src={activeItem.preview} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"
                        style={{ color: 'rgba(255,255,255,0.3)' }}>
                        <FiImage size={20} />
                      </div>
                    )}
                    {mediaItems.length > 1 && (
                      <span className="absolute bottom-1 right-1 text-[10px] font-bold px-1.5 rounded"
                        style={{ background: 'rgba(0,0,0,0.7)' }}>
                        {mediaItems.length}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 rounded-xl px-3.5 py-3"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <textarea
                      value={content}
                      onChange={(e) => {
                        setContent(e.target.value)
                        if (errors.content) setErrors((p) => ({ ...p, content: '' }))
                      }}
                      placeholder="Write a caption…"
                      rows={3}
                      maxLength={2200}
                      className="w-full h-full bg-transparent outline-none text-[16px] resize-none leading-relaxed placeholder:text-white/30"
                    />
                  </div>
                </div>
                {errors.content && (
                  <p className="text-xs mb-4" style={{ color: '#ef4444' }}>{errors.content}</p>
                )}

                {/* Thumbs row */}
                {mediaItems.length > 1 && (
                  <div className="flex gap-2 mb-5 overflow-x-auto no-scrollbar">
                    {mediaItems.map((item) => {
                      const isActive = item.id === activeItem?.id
                      return (
                        <button
                          key={item.id}
                          onClick={() => setActiveId(item.id)}
                          className="relative flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden"
                          style={{
                            boxShadow: isActive
                              ? '0 0 0 2px #3b82f6'
                              : '0 0 0 1px rgba(255,255,255,0.08)',
                          }}
                        >
                          {item.isVideo && item.preview ? (
                            <BoomerangVideo src={item.preview} className="w-full h-full object-cover" />
                          ) : item.preview && (
                            <img src={item.preview} alt="" className="w-full h-full object-cover" />
                          )}
                          {isActive && (
                            <span className="absolute inset-0 flex items-center justify-center"
                              style={{ background: 'rgba(59,130,246,0.25)' }}>
                              <FiCheck size={14} strokeWidth={3} />
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* hidden gallery file input — images and videos, picked from library */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => { handleFiles(e.target.files); e.target.value = '' }}
      />

      {/* hidden video-capture input — opens the OS's own video recorder app.
          Kept separate from the gallery input above so it can be triggered
          on its own (long-press shutter) without also opening the picker. */}
      <input
        ref={videoFileRef}
        type="file"
        accept="video/*"
        capture="environment"
        className="hidden"
        onChange={(e) => { handleFiles(e.target.files); e.target.value = '' }}
      />

      {/* Upload overlay */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(14px)' }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-72 rounded-[28px] px-6 py-7 flex flex-col items-center gap-5"
              style={{
                background: 'linear-gradient(to bottom, #1e1e20, #17171a)',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
              }}
            >
              <div className="relative w-20 h-20">
                <svg width="80" height="80" viewBox="0 0 80 80" className="-rotate-90">
                  <defs>
                    <linearGradient id="progGrad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" />
                      <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>
                  </defs>
                  <circle cx="40" cy="40" r="34" fill="none"
                    stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
                  <motion.circle
                    cx="40" cy="40" r="34" fill="none"
                    stroke="url(#progGrad)" strokeWidth="5" strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 34}
                    initial={false}
                    animate={{ strokeDashoffset: 2 * Math.PI * 34 * (1 - uploadProgress / 100) }}
                    transition={{ ease: 'linear', duration: 0.15 }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-[15px] font-bold">
                  {uploadProgress}%
                </div>
              </div>

              <div className="text-center">
                <p className="text-[15px] font-semibold">
                  {uploadStage === 'cancelling' ? 'Cancelling…'
                    : uploadStage === 'saving' ? 'Publishing…'
                    : uploadProgress < 100 ? 'Uploading media…' : 'Almost done…'}
                </p>
                {mediaItems.length > 0 && (
                  <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    {mediaItems.length} item{mediaItems.length > 1 ? 's' : ''}
                  </p>
                )}
              </div>

              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={handleCancel}
                disabled={uploadStage === 'cancelling'}
                className="inline-flex items-center justify-center px-5 py-2 min-w-[92px] rounded-full text-xs font-semibold whitespace-nowrap disabled:opacity-40"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                {uploadStage === 'cancelling' ? 'Cancelling…' : 'Cancel'}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* small helper */
function IconButton({ children, onClick, label, style }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition flex-shrink-0"
      style={{
        background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.08)',
        ...style,
      }}
    >
      {children}
    </button>
  )
}