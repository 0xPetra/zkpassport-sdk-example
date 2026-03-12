"use client"

import { useState, useEffect, useRef, useCallback, type RefObject } from "react"
import { Swirl } from "@paper-design/shaders-react"
import ZkPassportVerify from "./ZkPassportVerify"

// --- Helpers ---

function useReveal(threshold = 0.15) {
  const ref = useRef<HTMLElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { threshold }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold])

  return { ref, isVisible }
}

function GrainOverlay() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-50 opacity-[0.055]"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        mixBlendMode: "overlay",
      }}
    />
  )
}

function CustomCursor() {
  const outerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const posRef = useRef({ x: 0, y: 0 })
  const targetRef = useRef({ x: 0, y: 0 })
  const isPointerRef = useRef(false)

  useEffect(() => {
    let rafId: number

    const tick = () => {
      posRef.current.x += (targetRef.current.x - posRef.current.x) * 0.15
      posRef.current.y += (targetRef.current.y - posRef.current.y) * 0.15

      const { x, y } = posRef.current
      const scale = isPointerRef.current ? 1.5 : 1
      const dotScale = isPointerRef.current ? 0.5 : 1

      if (outerRef.current)
        outerRef.current.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-50%) scale(${scale})`
      if (innerRef.current)
        innerRef.current.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-50%) scale(${dotScale})`

      rafId = requestAnimationFrame(tick)
    }

    const onMove = (e: MouseEvent) => {
      targetRef.current = { x: e.clientX, y: e.clientY }
      const t = e.target as HTMLElement
      isPointerRef.current =
        window.getComputedStyle(t).cursor === "pointer" || t.tagName === "BUTTON" || t.tagName === "A"
    }

    window.addEventListener("mousemove", onMove, { passive: true })
    rafId = requestAnimationFrame(tick)
    return () => {
      window.removeEventListener("mousemove", onMove)
      cancelAnimationFrame(rafId)
    }
  }, [])

  return (
    <>
      <div
        ref={outerRef}
        className="pointer-events-none fixed left-0 top-0 z-[9999] hidden mix-blend-difference will-change-transform md:block"
      >
        <div className="h-4 w-4 rounded-full border-2 border-white" />
      </div>
      <div
        ref={innerRef}
        className="pointer-events-none fixed left-0 top-0 z-[9999] hidden mix-blend-difference will-change-transform md:block"
      >
        <div className="h-2 w-2 rounded-full bg-white" />
      </div>
    </>
  )
}

// --- Types ---

interface LeaderboardEntry {
  rank: number
  address: string
  ens: string | null
  balance: number
}

// --- Sections ---

function HeroSection({ scrollToSection }: { scrollToSection: (i: number) => void }) {
  const { ref, isVisible } = useReveal(0.1)

  const stats = [
    { value: "100", label: "MATE / claim" },
    { value: "7d", label: "Cooldown" },
    { value: "Base", label: "Network" },
    { value: "ZK", label: "Privacy" },
  ]

  return (
    <section
      ref={ref as RefObject<HTMLElement>}
      className="relative flex h-screen w-screen shrink-0 flex-col justify-end px-6 pb-20 pt-24 md:px-12 md:pb-28"
    >
      <div
        className={`mb-8 flex flex-col items-center gap-6 transition-all duration-1000 md:flex-row md:items-end md:justify-between md:gap-10 ${isVisible ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"
          }`}
      >

        <p
          className={`mt-5 font-sans text-xl font-light leading-relaxed text-white/45 transition-all duration-1000 md:text-2xl md:mt-0 md:text-left ${isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
            }`}
          style={{ transitionDelay: "150ms" }}
        >
          One token.
          <br />
          To predict the future.
          <br />
          And shape the present.
          <span
            className="mt-3 block font-mono text-xs uppercase tracking-widest text-white/30 md:mt-5"
            style={{ letterSpacing: "0.12em" }}
          >
            Learn forecasting with Precog
          </span>
        </p>
      </div>

      <div
        className={`mb-10 flex flex-wrap gap-2.5 transition-all duration-1000 ${isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`}
        style={{ transitionDelay: "250ms" }}
      >
        {stats.map(s => (
          <div
            key={s.label}
            className="flex flex-col gap-1 rounded-xl border border-white/[0.07] bg-white/[0.03] px-5 py-4 backdrop-blur-sm"
          >
            <span className="font-mono text-lg font-light text-white md:text-xl">{s.value}</span>
            <span className="font-mono text-[10px] tracking-widest text-white/25 uppercase">{s.label}</span>
          </div>
        ))}
      </div>

      <div
        className={`flex flex-wrap items-center gap-3 transition-all duration-1000 ${isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`}
        style={{ transitionDelay: "350ms" }}
      >
        <button
          onClick={() => scrollToSection(1)}
          className="rounded-full bg-white px-8 py-3 font-mono text-[12px] font-semibold tracking-[0.15em] text-black uppercase transition-all duration-300 hover:bg-white/90 hover:shadow-[0_0_60px_rgba(255,255,255,0.12)]"
        >
          Claim MATE
        </button>
        <a
          href="https://discord.gg/frgXQfM3KZ"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-white/[0.1] px-8 py-3 font-mono text-[12px] tracking-[0.15em] text-white/45 uppercase transition-all duration-300 hover:border-white/20 hover:text-white/70"
        >
          Discord
        </a>
        <a
          href="https://core.precog.markets/"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-white/[0.1] px-8 py-3 font-mono text-[12px] tracking-[0.15em] text-white/45 uppercase transition-all duration-300 hover:border-white/20 hover:text-white/70"
        >
          Precog Core
        </a>
      </div>

      <div className="absolute bottom-8 right-8 hidden items-center gap-2.5 opacity-30 md:flex">
        <span className="font-mono text-[9px] tracking-[0.3em] uppercase">Scroll</span>
        <div className="flex h-5 w-9 items-center justify-center rounded-full border border-white/25">
          <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/60" />
        </div>
      </div>
    </section>
  )
}

function FaucetSection() {
  const { ref, isVisible } = useReveal(0.15)

  const steps = [
    { n: "01", title: "Install zkPassport", desc: "Download on iOS or Android. Scan your passport via NFC." },
    { n: "02", title: "Scan the QR code", desc: "Generate a zero-knowledge proof without revealing personal data." },
    { n: "03", title: "Claim tokens", desc: "100 MATE sent to your wallet on Base. Repeat every 7 days." },
  ]

  return (
    <section
      ref={ref as RefObject<HTMLElement>}
      className="flex h-screen w-screen shrink-0 items-center px-6 pt-20 md:px-12"
    >
      <div className="grid w-full max-w-5xl gap-12 md:grid-cols-2 md:gap-16">
        {/* Left: info */}
        <div
          className={`flex flex-col justify-center transition-all duration-700 ${isVisible ? "translate-x-0 opacity-100" : "-translate-x-12 opacity-0"}`}
        >
          <p className="mb-3 font-mono text-[11px] tracking-[0.3em] text-white/30 uppercase">/ Get tokens</p>
          <h2 className="mb-6 font-sans text-5xl font-light tracking-tight text-white md:text-6xl">Faucet</h2>
          <p className="mb-10 max-w-xs text-sm leading-relaxed text-white/40">
            Verify your identity once with zkPassport. Claim 100 MATE every week — no personal data stored.
          </p>

          <ol className="space-y-6">
            {steps.map((step, i) => (
              <li
                key={step.n}
                className={`flex gap-4 transition-all duration-700 ${isVisible ? "translate-x-0 opacity-100" : "translate-x-8 opacity-0"}`}
                style={{ transitionDelay: `${200 + i * 100}ms` }}
              >
                <span className="mt-0.5 shrink-0 font-mono text-[10px] tracking-widest text-white/20">{step.n}</span>
                <div>
                  <p className="mb-0.5 text-sm font-medium text-white/70">{step.title}</p>
                  <p className="text-xs leading-relaxed text-white/30">{step.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Right: verification card */}
        <div
          className={`flex items-center transition-all duration-700 delay-200 ${isVisible ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"}`}
        >
          <div className="w-full rounded-2xl border border-white/[0.07] bg-[#fdf8f3] p-8 shadow-[0_0_80px_rgba(0,0,0,0.5)] md:p-10">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#3d3228]/10 bg-[#3d3228]/[0.05]">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M8 1L2 4.5V11.5L8 15L14 11.5V4.5L8 1Z"
                    stroke="#3d3228"
                    strokeOpacity="0.4"
                    strokeWidth="1.2"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M8 5.5V8.5M8 10.5H8.005"
                    stroke="#3d3228"
                    strokeOpacity="0.4"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-[#2a1f14]">Identity Verification</p>
                <p className="font-mono text-[10px] tracking-widest text-[#3d3228]/35 uppercase">Powered by zkPassport</p>
              </div>
            </div>
            <ZkPassportVerify marketIds={[]} />
          </div>
        </div>
      </div>
    </section>
  )
}

function LeaderboardSection({ scrollRef }: { scrollRef: React.RefObject<HTMLDivElement | null> }) {
  const { ref, isVisible } = useReveal(0.15)
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch("/api/leaderboard")
      .then(r => r.json())
      .then(data => {
        setEntries(data.leaderboard ?? [])
        setLoading(false)
      })
      .catch(() => {
        setError(true)
        setLoading(false)
      })
  }, [])

  const shortAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`
  const displayName = (e: LeaderboardEntry) => e.ens ?? shortAddress(e.address)

  const podium = entries.slice(0, 3)
  const rest = entries.slice(3)

  const podiumStyles = [
    { size: "text-4xl md:text-5xl", nameSize: "text-base", balanceSize: "text-sm", opacity: "text-white" },
    { size: "text-3xl md:text-4xl", nameSize: "text-sm", balanceSize: "text-xs", opacity: "text-white/80" },
    { size: "text-2xl md:text-3xl", nameSize: "text-sm", balanceSize: "text-xs", opacity: "text-white/65" },
  ]
  const medals = ["1st", "2nd", "3rd"]

  return (
    <section
      ref={ref as RefObject<HTMLElement>}
      className="flex h-screen w-screen shrink-0 flex-col overflow-hidden"
    >
      <div
        ref={scrollRef as React.RefObject<HTMLDivElement>}
        className="flex-1 overflow-y-auto px-6 pt-36 md:px-12 md:pt-44"
        style={{ scrollbarWidth: "none" }}
      >
      <div className="mx-auto w-full max-w-3xl pb-12">
        {/* Header */}
        <div
          className={`mb-10 transition-all duration-700 ${isVisible ? "translate-x-0 opacity-100" : "-translate-x-12 opacity-0"}`}
        >
          <p className="mb-3 font-mono text-[11px] tracking-[0.3em] text-white/30 uppercase">/ Top holders</p>
          <h2 className="font-sans text-5xl font-light tracking-tight text-white md:text-6xl">Leaderboard</h2>
        </div>

        {loading && (
          <div className="py-24 text-center">
            <div className="mx-auto h-4 w-4 animate-spin rounded-full border border-white/10 border-t-white/40" />
          </div>
        )}

        {!loading && error && (
          <div className="py-24 text-center">
            <p className="font-mono text-[11px] tracking-widest text-white/20 uppercase">Could not load holders</p>
          </div>
        )}

        {!loading && !error && entries.length === 0 && (
          <div className="py-24 text-center">
            <p className="font-mono text-[11px] tracking-widest text-white/20 uppercase">No holders found</p>
          </div>
        )}

        {/* Top 3 podium */}
        {!loading && !error && podium.length > 0 && (
          <div
            className={`mb-8 space-y-px transition-all duration-700 delay-100 ${isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`}
          >
            {podium.map((entry, i) => {
              const s = podiumStyles[i]
              return (
                <a
                  key={entry.address}
                  href={`https://basescan.org/address/${entry.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-selectable="true"
                  className={`group flex items-baseline justify-between border-b border-white/[0.06] py-5 transition-all duration-300 hover:border-white/[0.15] ${isVisible ? "opacity-100" : "opacity-0"}`}
                  style={{ transitionDelay: `${150 + i * 80}ms` }}
                >
                  <div className="flex items-baseline gap-5">
                    <span className={`${s.size} font-light leading-none tracking-tight ${s.opacity}`}>
                      {medals[i]}
                    </span>
                    <div>
                      <span
                        className={`block ${s.nameSize} font-mono tracking-wide ${s.opacity} transition-colors group-hover:text-white`}
                      >
                        {displayName(entry)}
                      </span>
                      {entry.ens && (
                        <span className="font-mono text-[10px] text-white/20">{shortAddress(entry.address)}</span>
                      )}
                    </div>
                  </div>
                  <span className={`font-mono ${s.balanceSize} text-[#e9a84c]/70 tabular-nums`}>
                    {entry.balance.toLocaleString()} MATE
                  </span>
                </a>
              )
            })}
          </div>
        )}

        {/* Remaining rows */}
        {!loading && !error && rest.length > 0 && (
          <div
            className={`transition-all duration-700 delay-300 ${isVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"}`}
          >
            {rest.map((entry, i) => (
              <a
                key={entry.address}
                href={`https://basescan.org/address/${entry.address}`}
                target="_blank"
                rel="noopener noreferrer"
                data-selectable="true"
                className={`group flex items-center justify-between border-b border-white/[0.03] py-3.5 transition-all duration-300 hover:border-white/[0.08] ${isVisible ? "opacity-100" : "opacity-0"}`}
                style={{ transitionDelay: `${350 + i * 40}ms` }}
              >
                <div className="flex items-center gap-4">
                  <span className="w-6 font-mono text-xs text-white/20 tabular-nums">{entry.rank}</span>
                  <div>
                    <span className="block font-mono text-sm text-white/50 transition-colors group-hover:text-white/80">
                      {displayName(entry)}
                    </span>
                    {entry.ens && (
                      <span className="font-mono text-[10px] text-white/15">{shortAddress(entry.address)}</span>
                    )}
                  </div>
                </div>
                <span className="font-mono text-xs text-[#e9a84c]/50 tabular-nums">
                  {entry.balance.toLocaleString()}
                </span>
              </a>
            ))}
          </div>
        )}

        {/* Footer stat */}
        {!loading && !error && entries.length > 0 && (
          <p
            className={`mt-8 font-mono text-[10px] tracking-widest text-white/15 uppercase transition-all duration-700 delay-[700ms] ${isVisible ? "opacity-100" : "opacity-0"}`}
          >
            {entries.length} holders — data from Base
          </p>
        )}
      </div>
      </div>
    </section>
  )
}

// --- Root ---

export default function HomePage() {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const shaderContainerRef = useRef<HTMLDivElement>(null)
  const leaderboardScrollRef = useRef<HTMLDivElement>(null)
  const isSnappedRef = useRef(true)
  const snapTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [currentSection, setCurrentSection] = useState(0)
  const [isLoaded, setIsLoaded] = useState(false)
  const scrollThrottleRef = useRef<number | undefined>(undefined)
  const touchStartY = useRef(0)
  const touchStartX = useRef(0)

  // Hide native cursor on this page (desktop only)
  useEffect(() => {
    const mediaQuery = window.matchMedia("(pointer: fine)")
    if (mediaQuery.matches) {
      document.body.style.cursor = "none"
    }
    return () => { document.body.style.cursor = "" }
  }, [])

  // Fade in once the WebGL canvas is ready
  useEffect(() => {
    const check = () => {
      const canvas = shaderContainerRef.current?.querySelector("canvas")
      if (canvas && canvas.width > 0) { setIsLoaded(true); return true }
      return false
    }
    if (check()) return
    const interval = setInterval(() => { if (check()) clearInterval(interval) }, 100)
    const fallback = setTimeout(() => setIsLoaded(true), 1500)
    return () => { clearInterval(interval); clearTimeout(fallback) }
  }, [])

  const scrollToSection = useCallback((index: number) => {
    if (!scrollContainerRef.current) return
    const w = scrollContainerRef.current.offsetWidth
    scrollContainerRef.current.scrollTo({ left: w * index, behavior: "smooth" })
    setCurrentSection(index)
  }, [])

  // Vertical wheel → horizontal scroll
  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return

      if (currentSection === 2 && isSnappedRef.current && leaderboardScrollRef.current) {
        const lb = leaderboardScrollRef.current
        const atTop = lb.scrollTop <= 0
        const atBottom = lb.scrollTop + lb.clientHeight >= lb.scrollHeight - 1
        if (!(atTop && e.deltaY < 0) && !(atBottom && e.deltaY > 0)) {
          e.preventDefault()
          lb.scrollBy({ top: e.deltaY, behavior: "instant" as ScrollBehavior })
          return
        }
      }

      e.preventDefault()
      el.scrollBy({ left: e.deltaY, behavior: "instant" as ScrollBehavior })
      const next = Math.round(el.scrollLeft / el.offsetWidth)
      if (next !== currentSection) setCurrentSection(next)
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [currentSection])

  // Track scroll position + detect when horizontal scroll has fully snapped
  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const onScroll = () => {
      isSnappedRef.current = false
      clearTimeout(snapTimerRef.current)
      snapTimerRef.current = setTimeout(() => {
        const rem = el.scrollLeft % el.offsetWidth
        isSnappedRef.current = rem < 8 || rem > el.offsetWidth - 8
      }, 120)

      if (scrollThrottleRef.current) return
      scrollThrottleRef.current = requestAnimationFrame(() => {
        const next = Math.round(el.scrollLeft / el.offsetWidth)
        if (next !== currentSection && next >= 0 && next <= 2) setCurrentSection(next)
        scrollThrottleRef.current = undefined
      })
    }
    el.addEventListener("scroll", onScroll, { passive: true })
    return () => el.removeEventListener("scroll", onScroll)
  }, [currentSection])

  // Touch swipe (vertical → next section)
  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const onStart = (e: TouchEvent) => {
      touchStartY.current = e.touches[0].clientY
      touchStartX.current = e.touches[0].clientX
    }
    const onEnd = (e: TouchEvent) => {
      const dy = touchStartY.current - e.changedTouches[0].clientY
      const dx = touchStartX.current - e.changedTouches[0].clientX
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 50) {
        if (dy > 0 && currentSection < 2) scrollToSection(currentSection + 1)
        else if (dy < 0 && currentSection > 0) scrollToSection(currentSection - 1)
      }
    }
    el.addEventListener("touchstart", onStart, { passive: true })
    el.addEventListener("touchend", onEnd, { passive: true })
    return () => {
      el.removeEventListener("touchstart", onStart)
      el.removeEventListener("touchend", onEnd)
    }
  }, [currentSection, scrollToSection])

  const sections = ["MATE", "Faucet", "Leaderboard"]

  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#060504]">
      <CustomCursor />
      <GrainOverlay />

      {/* WebGL shader background */}
      <div
        ref={shaderContainerRef}
        className={`fixed inset-0 z-0 transition-opacity duration-700 ${isLoaded ? "opacity-100" : "opacity-0"}`}
        style={{ contain: "strict" }}
      >
        <Swirl
          style={{ width: "100%", height: "100%" }}
          colors={["#1275d8", "#e19136", "#0066ff", "#d1d1d1"]}
          colorBack="#0a0a0a"
          bandCount={4}
          twist={0.3}
          center={0.2}
          proportion={0.5}
          softness={0.4}
          noise={0.2}
          noiseFrequency={0.4}
          speed={0.3}
        />
        <div className="absolute inset-0 bg-black/20" />
      </div>

      {/* Nav */}
      <nav className="pointer-events-none fixed left-0 right-0 top-0 z-50 flex items-center justify-between px-6 py-6 md:px-12">
        <button
          className="pointer-events-auto flex items-center gap-3 transition-opacity duration-300 hover:opacity-60"
          onClick={() => scrollToSection(0)}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-md border border-white/[0.1] bg-white/[0.05] backdrop-blur-md">
            <span className="font-mono text-[10px] font-semibold tracking-widest text-white/70">M</span>
          </div>
          <span className="font-mono text-[11px] tracking-[0.2em] text-white/50 uppercase">MATE Token</span>
        </button>

        {/* Section nav */}
        <div className="pointer-events-auto hidden items-center gap-8 md:flex">
          {sections.map((s, i) => (
            <button
              key={s}
              onClick={() => scrollToSection(i)}
              className={`group relative font-mono text-[11px] tracking-[0.2em] uppercase transition-colors duration-300 ${currentSection === i ? "text-white" : "text-white/30 hover:text-white/60"
                }`}
            >
              {s}
              <span
                className={`absolute -bottom-1 left-0 h-px bg-white/50 transition-all duration-500 ${currentSection === i ? "w-full" : "w-0"
                  }`}
              />
            </button>
          ))}
        </div>

        <a
          href="https://basescan.org/token/0xc139c86de76df41c041a30853c3958427fa7cebd"
          target="_blank"
          rel="noopener noreferrer"
          className="pointer-events-auto hidden rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-1.5 font-mono text-[11px] tracking-[0.15em] text-white/40 uppercase backdrop-blur-md transition-all duration-300 hover:border-white/15 hover:text-white/70 md:inline-flex"
        >
          Contracts
        </a>
      </nav>

      {/* Horizontal scroll container */}
      <div
        ref={scrollContainerRef}
        className="relative z-10 flex h-screen overflow-x-auto overflow-y-hidden"
        style={{ scrollbarWidth: "none" }}
      >
        <HeroSection scrollToSection={scrollToSection} />
        <FaucetSection />
        <LeaderboardSection scrollRef={leaderboardScrollRef} />
      </div>

      {/* Mobile section dots */}
      <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 md:hidden">
        {sections.map((_, i) => (
          <div
            key={i}
            className={`h-px rounded-full transition-all duration-300 ${currentSection === i ? "w-6 bg-white/50" : "w-1 bg-white/15"
              }`}
          />
        ))}
      </div>
    </div>
  )
}
