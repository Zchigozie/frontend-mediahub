import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FiX, FiZap, FiImage, FiCheck, FiArrowLeft,
  FiPlay, FiRotateCw, FiCamera,
} from 'react-icons/fi'
import { postsAPI, uploadAPI, uploadMediaDirect } from '../api'
import toast from 'react-hot-toast'

const MAX_MEDIA = 5
const MAX_DIMENSION = 2048
const JPEG_QUALITY = 0.92
const MAX_IMAGE_SIZE = 10 * 1024 * 1024
const MAX_VIDEO_SIZE = 100 * 1024 * 1024
const SIGNATURE_TTL = 8 * 60 * 1000
const MAX_RECORD_SECONDS = 60
const VIDEO_BITRATE = 5_000_000 // 5 Mbps — noticeably sharper than typical browser defaults
const HOLD_THRESHOLD_MS = 300 // press-and-hold this long to start recording; shorter = photo

let idSeq = 0
const nextId = () => `media_${Date.now()}_${idSeq++}`

/* ─────────────────────────── helpers ─────────────────────────── */

function compressImage(file) {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) return resolve(file)
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

function getSupportedMimeType() {
  const candidates = [
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ]
  for (const type of candidates) {
    if (window.MediaRecorder?.isTypeSupported?.(type)) return type
  }
  return ''
}

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
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const audioStreamRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const recordedChunksRef = useRef([])
  const recordTimerRef = useRef(null)
  const abortControllerRef = useRef(null)
  const signatureRef = useRef(null)
  const videoUrlsRef = useRef(new Set())
  const holdTimerRef = useRef(null)
  const isHoldingRef = useRef(false)
  const isRecordingRef = useRef(false)

  const [screen, setScreen] = useState('capture')
  const [mediaItems, setMediaItems] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [previewId, setPreviewId] = useState(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState(false)
  const [facing, setFacing] = useState('environment')
  const [flashOn, setFlashOn] = useState(false)
  const [torchSupported, setTorchSupported] = useState(false)
  const [flashPulse, setFlashPulse] = useState(false)
  const [shutterClick, setShutterClick] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
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
  const previewIndex = mediaItems.findIndex((i) => i.id === previewId)
  const previewItem = previewIndex >= 0 ? mediaItems[previewIndex] : null

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

  const startCamera = useCallback(async () => {
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      let stream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facing,
            width: { ideal: 1920 },
            height: { ideal: 1080 },
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
    audioStreamRef.current?.getTracks().forEach((t) => t.stop())
    clearInterval(recordTimerRef.current)
    clearTimeout(holdTimerRef.current)
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
  }, [remainingSlots, mediaItems.length, getCachedSignature])

  const capturePhoto = () => {
    const video = videoRef.current
    if (!video || !cameraReady || !video.videoWidth || isRecordingRef.current) return

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
      setFlashPulse(true)
      setTimeout(() => {
        doCapture()
        setTimeout(() => setFlashPulse(false), 180)
      }, 120)
    } else {
      setShutterClick(true)
      setTimeout(() => setShutterClick(false), 90)
      doCapture()
    }
  }

  const startRecording = useCallback(async () => {
    if (!streamRef.current || isRecordingRef.current || !cameraReady) return
    try {
      if (!audioStreamRef.current) {
        audioStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true })
      }
      const combined = new MediaStream([
        ...streamRef.current.getVideoTracks(),
        ...audioStreamRef.current.getAudioTracks(),
      ])
      const mimeType = getSupportedMimeType()
      const recorder = new MediaRecorder(combined, {
        ...(mimeType ? { mimeType } : {}),
        videoBitsPerSecond: VIDEO_BITRATE,
      })
      recordedChunksRef.current = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data) }
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: mimeType || 'video/webm' })
        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm'
        handleFiles([new File([blob], `video_${Date.now()}.${ext}`, { type: blob.type })])
      }
      recorder.start()
      mediaRecorderRef.current = recorder
      isRecordingRef.current = true
      setIsRecording(true)
      setRecordSeconds(0)
      recordTimerRef.current = setInterval(() => {
        setRecordSeconds((s) => {
          if (s + 1 >= MAX_RECORD_SECONDS) {
            mediaRecorderRef.current?.stop()
            clearInterval(recordTimerRef.current)
            isRecordingRef.current = false
            isHoldingRef.current = false
            setIsRecording(false)
            return MAX_RECORD_SECONDS
          }
          return s + 1
        })
      }, 1000)
    } catch (err) {
      console.error('Could not start recording', err)
      isHoldingRef.current = false
      toast.error('Microphone access is needed to record video')
    }
  }, [cameraReady, handleFiles])

  const stopRecording = useCallback(() => {
    if (!isRecordingRef.current) return
    mediaRecorderRef.current?.stop()
    clearInterval(recordTimerRef.current)
    isRecordingRef.current = false
    setIsRecording(false)
  }, [])

  /* Press-and-hold shutter: a quick tap takes a photo, holding past
     HOLD_THRESHOLD_MS starts video recording (release to stop) — same
     gesture as Instagram/Snapchat/TikTok, so there's no separate video
     button. Pointer events so it works the same for touch and mouse. */
  const handleShutterDown = (e) => {
    e.preventDefault()
    if (!cameraReady || isRecordingRef.current) return
    isHoldingRef.current = false
    clearTimeout(holdTimerRef.current)
    holdTimerRef.current = setTimeout(() => {
      isHoldingRef.current = true
      startRecording()
    }, HOLD_THRESHOLD_MS)
  }

  const handleShutterUp = (e) => {
    e.preventDefault()
    clearTimeout(holdTimerRef.current)
    if (isHoldingRef.current) {
      isHoldingRef.current = false
      stopRecording()
    } else if (cameraReady && !isRecordingRef.current) {
      capturePhoto()
    }
  }

  const handleShutterCancel = () => {
    clearTimeout(holdTimerRef.current)
    if (isHoldingRef.current) {
      isHoldingRef.current = false
      stopRecording()
    }
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
    setPreviewId((prev) => {
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

          <AnimatePresence>
            {isRecording && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 pointer-events-none z-10"
                style={{ boxShadow: 'inset 0 0 0 3px #ef4444' }}
              />
            )}
          </AnimatePresence>

          <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-4"
            style={{
              paddingTop: 'max(env(safe-area-inset-top), 14px)',
              paddingBottom: 12,
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.55), transparent)',
            }}>
            <IconButton onClick={() => navigate(-1)} label="Close" disabled={isRecording}><FiX size={20} /></IconButton>
            {isRecording ? (
              <div className="flex items-center gap-2 px-3 h-8 rounded-full" style={{ background: 'rgba(239,68,68,0.18)' }}>
                <motion.span
                  className="w-2 h-2 rounded-full"
                  style={{ background: '#ef4444' }}
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
                <span className="text-[13px] font-bold tabular-nums">
                  0:{String(recordSeconds).padStart(2, '0')}
                </span>
              </div>
            ) : (
              <h1 className="text-[15px] font-semibold tracking-tight">New post</h1>
            )}
            <div className="flex items-center gap-2">
              <IconButton
                onClick={toggleFlash}
                label="Flash"
                disabled={isRecording}
                style={{ color: flashOn ? '#fbbf24' : '#fff' }}
              >
                <FiZap size={17} fill={flashOn ? '#fbbf24' : 'none'} />
              </IconButton>
              <IconButton
                onClick={() => setFacing((f) => f === 'user' ? 'environment' : 'user')}
                label="Flip camera"
                disabled={isRecording}
              >
                <FiRotateCw size={16} />
              </IconButton>
              <IconButton onClick={() => fileRef.current?.click()} label="Gallery" disabled={isRecording}>
                <FiImage size={17} />
              </IconButton>
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-0 h-52 pointer-events-none"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)' }} />
        </div>

        <div className="relative z-10" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 18px)' }}>
          <div className="px-3 pb-3">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              {mediaItems.map((item) => {
                const isActive = item.id === activeItem?.id
                return (
                  <motion.button
                    key={item.id}
                    layout
                    onClick={() => { setActiveId(item.id); setPreviewId(item.id) }}
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

          {/* Shutter row — tap = photo, press-and-hold = video (release to
              stop). One control, matching Instagram/Snapchat/TikTok's
              shutter gesture — no separate video button. */}
          <div className="relative flex items-center justify-between px-8 pb-2 min-h-[76px]">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={isRecording}
              className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 disabled:opacity-30"
              style={{ background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)' }}
            >
              <FiImage size={18} />
            </button>

            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <motion.button
                whileTap={{ scale: isRecording ? 1 : 0.88 }}
                animate={isRecording ? { scale: 1.12 } : { scale: 1 }}
                onPointerDown={handleShutterDown}
                onPointerUp={handleShutterUp}
                onPointerLeave={handleShutterCancel}
                onPointerCancel={handleShutterCancel}
                onContextMenu={(e) => e.preventDefault()}
                disabled={!cameraReady}
                aria-label={isRecording ? 'Recording — release to stop' : 'Tap for photo, hold for video'}
                className="pointer-events-auto rounded-full flex items-center justify-center disabled:opacity-40"
                style={{
                  width: 76, height: 76,
                  background: 'transparent',
                  touchAction: 'none',
                  boxShadow: isRecording
                    ? '0 0 0 3px #ef4444, 0 0 0 6px rgba(0,0,0,0.4)'
                    : '0 0 0 3px #fff, 0 0 0 6px rgba(0,0,0,0.4)',
                }}
              >
                {isRecording ? (
                  <span style={{ width: 28, height: 28, borderRadius: 8, background: '#ef4444', display: 'block' }} />
                ) : (
                  <span style={{ width: 60, height: 60, borderRadius: '50%', background: '#fff', display: 'block' }} />
                )}
              </motion.button>
            </div>

            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={() => setScreen('edit')}
              disabled={!canNext || isRecording}
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
              <div className="flex justify-center pt-2.5 pb-1">
                <span className="w-9 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }} />
              </div>

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
                <div className="flex gap-3 mb-4">
                  <div
                    className="w-[76px] h-[76px] rounded-xl overflow-hidden flex-shrink-0 relative cursor-pointer"
                    style={{ background: '#000', boxShadow: '0 0 0 1px rgba(255,255,255,0.06)' }}
                    onClick={() => activeItem && setPreviewId(activeItem.id)}
                  >
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

      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => { handleFiles(e.target.files); e.target.value = '' }}
      />

      <AnimatePresence>
        {previewItem && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex flex-col items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.94)' }}
            onClick={() => setPreviewId(null)}
          >
            <button
              onClick={() => setPreviewId(null)}
              aria-label="Close preview"
              className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.1)' }}
            >
              <FiX size={18} />
            </button>

            {mediaItems.length > 1 && (
              <span className="absolute top-5 left-5 text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(255,255,255,0.1)' }}>
                {previewIndex + 1} / {mediaItems.length}
              </span>
            )}

            <div className="relative w-full flex-1 flex items-center justify-center px-4" onClick={(e) => e.stopPropagation()}>
              {previewIndex > 0 && (
                <button
                  onClick={() => setPreviewId(mediaItems[previewIndex - 1].id)}
                  aria-label="Previous"
                  className="absolute left-2 z-10 w-9 h-9 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.1)' }}
                >
                  <FiArrowLeft size={16} />
                </button>
              )}

              {previewItem.isVideo ? (
                <video
                  key={previewItem.id}
                  src={previewItem.preview}
                  controls
                  autoPlay
                  playsInline
                  className="max-w-full max-h-[70vh] rounded-xl"
                />
              ) : (
                <img
                  key={previewItem.id}
                  src={previewItem.preview}
                  alt=""
                  className="max-w-full max-h-[70vh] rounded-xl object-contain"
                />
              )}

              {previewIndex < mediaItems.length - 1 && (
                <button
                  onClick={() => setPreviewId(mediaItems[previewIndex + 1].id)}
                  aria-label="Next"
                  className="absolute right-2 z-10 w-9 h-9 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.1)' }}
                >
                  <FiArrowLeft size={16} style={{ transform: 'rotate(180deg)' }} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 pb-8" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => removeMedia(previewItem.id)}
                className="px-5 h-10 rounded-full text-sm font-semibold"
                style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}
              >
                Remove
              </button>
              <button
                onClick={() => setPreviewId(null)}
                className="px-5 h-10 rounded-full text-sm font-semibold"
                style={{ background: 'rgba(255,255,255,0.1)' }}
              >
                Done
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-center justify-center"
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
function IconButton({ children, onClick, label, style, disabled }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
      className="w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition flex-shrink-0 disabled:opacity-30"
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