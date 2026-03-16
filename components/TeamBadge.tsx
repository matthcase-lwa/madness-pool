import Image from 'next/image'
import { getLogoUrl, getRecord } from '@/lib/teamData'

interface TeamBadgeProps {
  name: string
  seed: number
  showRecord?: boolean
  showSeed?: boolean
  size?: 'sm' | 'md' | 'lg'
  eliminated?: boolean
}

function SeedPill({ seed }: { seed: number }) {
  const cls = seed === 1
    ? 'bg-white text-blue-500 font-black ring-2 ring-maize-500'
    : seed <= 4
      ? 'bg-maize-500 text-blue-500 font-bold'
      : seed >= 9
        ? 'bg-emerald-500/80 text-white font-bold'
        : 'bg-white/20 text-chalk font-bold'
  return (
    <span className={`seed-badge ${cls} shrink-0`}>#{seed}</span>
  )
}

export default function TeamBadge({
  name,
  seed,
  showRecord = true,
  showSeed = true,
  size = 'md',
  eliminated = false,
}: TeamBadgeProps) {
  const logoUrl = getLogoUrl(name)
  const record = getRecord(name)

  const logoSize = size === 'lg' ? 36 : size === 'sm' ? 20 : 28

  return (
    <div className={`flex items-center gap-2 ${eliminated ? 'opacity-40' : ''}`}>
      {/* Logo */}
      {logoUrl ? (
        <div className="shrink-0 flex items-center justify-center" style={{ width: logoSize, height: logoSize }}>
          <Image
            src={logoUrl}
            alt={name}
            width={logoSize}
            height={logoSize}
            className={`object-contain ${eliminated ? 'grayscale' : ''}`}
            unoptimized
          />
        </div>
      ) : (
        <div
          className="shrink-0 rounded-full bg-white/10 flex items-center justify-center text-white/30 font-display"
          style={{ width: logoSize, height: logoSize, fontSize: logoSize * 0.4 }}
        >
          {name.charAt(0)}
        </div>
      )}

      {/* Name + record */}
      <div className="min-w-0">
        <div className={`font-body font-bold leading-tight truncate ${
          eliminated ? 'line-through text-white/40' : 'text-chalk'
        } ${size === 'lg' ? 'text-base' : size === 'sm' ? 'text-xs' : 'text-sm'}`}>
          {name}
        </div>
        {showRecord && record && (
          <div className="text-white/40 font-body leading-none" style={{ fontSize: '10px' }}>
            {record}
          </div>
        )}
      </div>

      {/* Seed */}
      {showSeed && <SeedPill seed={seed} />}
    </div>
  )
}
