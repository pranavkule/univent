import { useState } from 'react'

// Reusable site branding. Loads the logo from apps/web/public/ (served at
// the site root in dev and copied to dist/ in the production build).
// Proportions are preserved: fixed height, auto width, object-fit contain —
// never stretched, cropped, or recolored. If the file is missing, falls
// back to the text wordmark instead of showing a broken image.
export default function Logo({
  alt = 'UniVent — Discover, Register, Be Part',
  className = '',
}) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <span className={`brand-fallback ${className}`} aria-label={alt}>
        <span className="brand-mark" aria-hidden="true">U</span>
        <span>UniVent</span>
      </span>
    )
  }

  return (
    <img
      src="/univent-logo.png"
      alt={alt}
      className={`logo-img ${className}`}
      onError={() => setFailed(true)}
    />
  )
}
