import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FiArrowLeft, FiHeart, FiMessageCircle, FiTrash2, FiMoreHorizontal,
  FiX, FiShare2, FiDownload, FiLoader
} from 'react-icons/fi'
import { FaHeart } from 'react-icons/fa'
import api, { postsAPI, commentsAPI, getDownloadUrl } from '../api'
import { useAuthStore } from '../store'
import { Avatar } from '../components/ui'
import { getMediaItems, MediaSlider, useMediaAspect, InstagramVideo } from '../components/PostMedia'
import CommentsSheet from './_CommentsSheet'
import toast from 'react-hot-toast'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
dayjs.extend(relativeTime)

export default function PostDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [post, setPost] = useState(null)
  const [commentCount, setCommentCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [showMenu, setShowMenu] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [showHeartAnimation, setShowHeartAnimation] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [postVisible, setPostVisible] = useState(true)
  const [confirmDeletePost, setConfirmDeletePost] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const lastTapRef = useRef(0)
  const menuRef = useRef(null)

  const currentUserId = user?._id || user?.id
  const isCurrentUser = (author) => {
    if (!currentUserId || !author) return false
    const authorId = author._id || author.id || author
    return String(currentUserId) === String(authorId)
  }

  const goToProfile = (author) => {
    const authorId = author?._id || author?.id || author
    if (!authorId) return
    if (String(authorId) === String(currentUserId)) navigate('/profile')
    else navigate(`/users/${authorId}`)
  }

  const fetchPost = async () => {
    try {
      const response = await postsAPI.getOne(id)
      const p = response.data?.data || response.data?.post || response.data || response
      setPost(p)
      if (currentUserId && p.likes) setLiked(p.likes.includes(currentUserId))
      setLikeCount(p.likes?.length || 0)

      try {
        const cRes = await commentsAPI.getByPost(id)
        setCommentCount((cRes.data?.data || []).length)
      } catch { setCommentCount(0) }
    } catch {
      toast.error('Post not found')
      navigate('/')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchPost() }, [id])

  useEffect(() => {
    if (!showMenu) return
    const handleOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('touchstart', handleOutside)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('touchstart', handleOutside)
    }
  }, [showMenu])

  const handleLike = async () => {
    if (!user) {
      toast.error('Log in to like posts')
      navigate('/login')
      return
    }
    const wasLiked = liked
    setLiked(!wasLiked)
    setLikeCount(c => wasLiked ? c - 1 : c + 1)
    try { await postsAPI.like(id) } catch {
      setLiked(wasLiked)
      setLikeCount(c => wasLiked ? c + 1 : c - 1)
    }
  }

  const handleImageDoubleTap = (e) => {
    e.stopPropagation()
    const now = Date.now()
    if (now - lastTapRef.current < 300) {
      if (!liked) handleLike()
      setShowHeartAnimation(true)
      setTimeout(() => setShowHeartAnimation(false), 700)
      lastTapRef.current = 0
    } else {
      lastTapRef.current = now
    }
  }

  const handleShare = async () => {
    const url = window.location.href
    try {
      if (navigator.share) {
        await navigator.share({ title: post?.title || 'Post', url })
      } else {
        await navigator.clipboard.writeText(url)
        toast.success('Link copied')
      }
    } catch { /* user cancelled */ }
  }

  const requestDeletePost = () => {
    setShowMenu(false)
    setConfirmDeletePost(true)
  }

  const doDeletePost = async () => {
    setIsDeleting(true)
    try {
      await postsAPI.delete(id)
      toast.success('Post deleted')
      setConfirmDeletePost(false)
      setPostVisible(false)
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete post')
      setIsDeleting(false)
      setConfirmDeletePost(false)
    }
  }

  const handleDownload = async (url, filename) => {
    if (!url) return
    setDownloading(true)
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
      setDownloading(false)
    }
  }

  const mediaItems = getMediaItems(post)
  const mediaRatio = useMediaAspect(mediaItems)

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen" style={{ background: 'var(--bg-primary)' }}>
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-amber-500 border-t-transparent" />
      </div>
    )
  }

  if (!post) return null

  const hasMedia = mediaItems.length > 0
  const isOwner = isCurrentUser(post.author)
  const hasBody = post.content && post.content.trim() && post.content.trim() !== post.title?.trim()

  const firstMediaUrl = mediaItems[0]?.url || null
  const fileExt = firstMediaUrl ? firstMediaUrl.split('.').pop() || 'jpg' : 'jpg'
  const downloadFilename = post.title ? `${post.title}.${fileExt}` : `download.${fileExt}`

  return (
    <>
      <AnimatePresence onExitComplete={() => { if (!postVisible) navigate('/') }}>
        {postVisible && (
          <motion.div
            key="post-detail"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="min-h-screen"
            style={{ background: 'var(--bg-primary)' }}
          >
            <div className="max-w-2xl mx-auto pb-8">

              {/* Header */}
              <div
                className="sticky top-0 z-20 px-4 py-2.5 flex items-center justify-between"
                style={{
                  background: 'color-mix(in oklab, var(--bg-primary) 82%, transparent)',
                  backdropFilter: 'blur(14px) saturate(140%)',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <button
                  onClick={() => navigate(-1)}
                  aria-label="Go back"
                  className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[var(--bg-secondary)] active:scale-90 transition"
                >
                  <FiArrowLeft size={20} strokeWidth={2.5} style={{ color: 'var(--text-primary)' }} />
                </button>

                <span className="text-sm font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                  Post
                </span>

                <div className="flex items-center gap-1">
                  <button
                    onClick={handleShare}
                    aria-label="Share"
                    className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[var(--bg-secondary)] active:scale-90 transition"
                  >
                    <FiShare2 size={18} style={{ color: 'var(--text-primary)' }} />
                  </button>
                  {isOwner ? (
                    <div className="relative" ref={menuRef}>
                      <button
                        onClick={() => setShowMenu(v => !v)}
                        disabled={isDeleting}
                        aria-label="Post options"
                        className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[var(--bg-secondary)] active:scale-90 transition"
                      >
                        <FiMoreHorizontal size={18} style={{ color: 'var(--text-primary)' }} />
                      </button>
                      <AnimatePresence>
                        {showMenu && !isDeleting && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -4 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -4 }}
                            transition={{ duration: 0.15 }}
                            className="absolute right-0 top-11 rounded-xl shadow-xl border py-1 w-44 z-30"
                            style={{ background: 'var(--bg-primary)', borderColor: 'var(--border)' }}
                          >
                            <button
                              onClick={requestDeletePost}
                              className="w-full text-left px-4 py-2.5 text-sm font-bold text-red-500 hover:bg-[var(--bg-secondary)] transition flex items-center gap-2"
                            >
                              <FiTrash2 size={16} /> Delete post
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ) : (
                    <div className="w-10" />
                  )}
                </div>
              </div>

              {/* ── Media ── */}
              {hasMedia && (
                <div
                  className="w-full relative select-none overflow-hidden"
                  style={{
                    background: 'var(--bg-secondary)',
                    aspectRatio: mediaRatio,
                    maxHeight: '80vh',
                  }}
                >
                  <MediaSlider
                    items={mediaItems}
                    title={post.title}
                    postId={post._id}
                    onDoubleTap={handleImageDoubleTap}
                    rounded=""
                    className="w-full h-full"
                    fit="contain"
                    renderVideo={(item) => (
                      <InstagramVideo
                        src={item.url}
                        poster={item.thumbnail}
                        className="w-full h-full object-contain"
                        style={{ maxHeight: '80vh' }}
                      />
                    )}
                  />

                  <div
                    className="absolute inset-x-0 top-0 h-20 pointer-events-none"
                    style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.35), transparent)' }}
                  />

                  <button
                    onClick={() => goToProfile(post.author)}
                    className="absolute top-3 left-3 flex items-center gap-2 pl-1 pr-3 py-1 rounded-full backdrop-blur-md active:scale-95 transition z-10"
                    style={{ background: 'rgba(0,0,0,0.35)' }}
                  >
                    <Avatar
                      src={post.author?.avatar}
                      name={post.author?.name}
                      size={30}
                      className="ring-2 ring-white/70"
                    />
                    <span className="text-xs font-bold text-white truncate max-w-[140px]">
                      {post.author?.name || 'Unknown'}
                    </span>
                  </button>

                  {/* Download button — matches list-view style exactly */}
                  {firstMediaUrl && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDownload(firstMediaUrl, downloadFilename)
                      }}
                      disabled={downloading}
                      className="absolute top-3 right-3 z-10 h-9 w-9 rounded-full flex items-center justify-center bg-white/85 backdrop-blur-sm text-gray-900 hover:bg-white shadow-md transition disabled:opacity-50"
                      aria-label="Download media"
                    >
                      {downloading ? (
                        <FiLoader size={17} className="animate-spin" strokeWidth={2.5} />
                      ) : (
                        <FiDownload size={17} strokeWidth={2.5} />
                      )}
                    </button>
                  )}

                  <AnimatePresence>
                    {showHeartAnimation && (
                      <motion.div
                        className="absolute inset-0 flex items-center justify-center pointer-events-none"
                        initial={{ scale: 0.5, opacity: 1 }}
                        animate={{ scale: 1.4, opacity: 1 }}
                        exit={{ scale: 1.8, opacity: 0 }}
                        transition={{ duration: 0.35, ease: 'easeOut' }}
                      >
                        <FaHeart size={110} color="#ef4444" style={{ filter: 'drop-shadow(0 6px 20px rgba(0,0,0,0.35))' }} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Body */}
              <div className="px-4 pt-4">
                {!hasMedia && (
                  <button
                    onClick={() => goToProfile(post.author)}
                    className="flex items-center gap-3 mb-3"
                  >
                    <Avatar src={post.author?.avatar} name={post.author?.name} size={40} />
                    <div className="text-left">
                      <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                        {post.author?.name || 'Unknown'}
                      </p>
                      <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        {post.createdAt ? dayjs(post.createdAt).fromNow() : 'Just now'}
                      </p>
                    </div>
                  </button>
                )}

                {post.title && (
                  <h1
                    className="font-extrabold font-display tracking-tight leading-tight"
                    style={{ color: 'var(--text-primary)', fontSize: '1.35rem' }}
                  >
                    {post.title}
                  </h1>
                )}

                {hasBody && (
                  <p
                    className="text-[15px] leading-relaxed mt-2 whitespace-pre-wrap break-words"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {post.content}
                  </p>
                )}

                {post.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {post.tags.map(tag => (
                      <span
                        key={tag}
                        className="text-xs font-bold px-3 py-1 rounded-full"
                        style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                {hasMedia && (
                  <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
                    {post.createdAt ? dayjs(post.createdAt).fromNow() : 'Just now'}
                  </p>
                )}

                <div
                  className="mt-4 flex items-center gap-2 pt-3"
                  style={{ borderTop: '1px solid var(--border)' }}
                >
                  <motion.button
                    onClick={handleLike}
                    whileTap={{ scale: 0.92 }}
                    className="flex items-center gap-2 px-4 h-10 rounded-full hover:bg-[var(--bg-secondary)] transition"
                    style={{
                      background: liked ? 'rgba(239,68,68,0.10)' : 'transparent',
                    }}
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      {liked ? (
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
                    <span
                      className="text-sm font-bold"
                      style={{ color: liked ? '#ef4444' : 'var(--text-primary)' }}
                    >
                      {likeCount}
                    </span>
                  </motion.button>

                  <motion.button
                    onClick={() => setShowComments(true)}
                    whileTap={{ scale: 0.92 }}
                    className="flex items-center gap-2 px-4 h-10 rounded-full hover:bg-[var(--bg-secondary)] transition"
                  >
                    <FiMessageCircle size={20} strokeWidth={2} style={{ color: 'var(--text-muted)' }} />
                    <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                      {commentCount}
                    </span>
                  </motion.button>

                  <div className="flex-1" />

                  <button
                    onClick={handleShare}
                    aria-label="Share"
                    className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[var(--bg-secondary)] transition"
                  >
                    <FiShare2 size={18} style={{ color: 'var(--text-muted)' }} />
                  </button>
                </div>

                <button
                  onClick={() => setShowComments(true)}
                  className="mt-3 text-sm font-semibold hover:opacity-70 transition"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {commentCount === 0
                    ? 'Be the first to comment…'
                    : `View all ${commentCount} comment${commentCount !== 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <CommentsSheet
        postId={id}
        open={showComments}
        onClose={() => setShowComments(false)}
        user={user}
        onGoToProfile={goToProfile}
        postOwnerId={post?.author?._id || post?.author?.id || post?.author}
        onCountChange={setCommentCount}
      />

      <AnimatePresence>
        {confirmDeletePost && (
          <motion.div
            className="fixed inset-0 flex items-center justify-center px-4"
            style={{ zIndex: 10000, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => !isDeleting && setConfirmDeletePost(false)}
          >
            <motion.div
              className="relative w-full max-w-sm rounded-3xl px-6 py-7 flex flex-col items-center"
              style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border)',
                boxShadow: '0 24px 70px rgba(0,0,0,0.45)',
              }}
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 26, stiffness: 340 }}
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => !isDeleting && setConfirmDeletePost(false)}
                disabled={isDeleting}
                aria-label="Close"
                className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-full hover:bg-[var(--bg-secondary)] transition disabled:opacity-50"
                style={{ color: 'var(--text-muted)' }}
              >
                <FiX size={18} strokeWidth={2.5} />
              </button>

              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                style={{ background: 'rgba(239,68,68,0.12)' }}
              >
                <FiTrash2 size={28} color="#ef4444" strokeWidth={2.5} />
              </div>

              <h3 className="text-base font-extrabold text-center px-2" style={{ color: 'var(--text-primary)' }}>
                Delete this post?
              </h3>
              <p className="text-sm text-center mt-1.5" style={{ color: 'var(--text-muted)' }}>
                This action can't be undone.
              </p>

              <div className="flex items-center justify-center gap-3 mt-6 w-full">
                <button
                  onClick={() => setConfirmDeletePost(false)}
                  disabled={isDeleting}
                  className="flex-1 h-11 rounded-full font-bold text-sm border transition disabled:opacity-50"
                  style={{ background: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={doDeletePost}
                  disabled={isDeleting}
                  className="flex-1 h-11 rounded-full font-bold text-sm text-white bg-red-500 hover:bg-red-600 transition disabled:opacity-60"
                >
                  {isDeleting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
