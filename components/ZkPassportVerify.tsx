"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { QRCodeSVG } from "qrcode.react"
import { ZKPassport } from "@zkpassport/sdk"
import { createPublicClient, http } from "viem"
import { mainnet } from "viem/chains"
import { normalize } from "viem/ens"

const publicClient = createPublicClient({ chain: mainnet, transport: http() })

type VerificationState = "idle" | "scanning" | "address_input" | "claiming" | "success" | "error"
type ScanStatus = "awaiting_scan" | "request_received" | "generating_proof"

interface ClaimResult {
  success: boolean
  message: string
  txHash?: string
}

interface MarketEmbedProps {
  marketId: number
}

function MarketEmbed({ marketId }: MarketEmbedProps) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const embedUrl = `https://embed.precog.market/market?network=8453&id=${marketId}&type=compact&theme=dark&source=chain`

  if (error) {
    return (
      <div className="flex h-[315px] w-[420px] max-w-full items-center justify-center rounded-xl border border-[#3d3228]/[0.08] bg-white/40 p-4">
        <div className="text-center">
          <p className="text-xs text-[#3d3228]/40">Failed to load market</p>
          <a
            href={`https://precog.market/market/${marketId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-[11px] text-[#b08247] underline transition-colors hover:text-[#8a6535]"
          >
            View on Precog
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-[#3d3228]/[0.08] bg-white/40">
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#3d3228]/10 border-t-[#3d3228]/40" />
        </div>
      )}
      <iframe
        src={embedUrl}
        width="420"
        height="315"
        frameBorder="0"
        allow="clipboard-write"
        loading="lazy"
        className={`block max-w-full transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
    </div>
  )
}

function MarketsSection({ marketIds }: { marketIds: number[] }) {
  if (marketIds.length === 0) return null
  return (
    <div className="mt-8 w-full space-y-5 border-t border-[#3d3228]/[0.08] pt-8">
      <div className="text-center">
        <h3 className="mb-1 font-mono text-[11px] tracking-widest text-[#3d3228]/35 uppercase">
          Active Markets
        </h3>
        <p className="text-xs text-[#3d3228]/45">
          Use your MATE tokens in prediction markets
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-4">
        {marketIds.map(id => (
          <MarketEmbed key={id} marketId={id} />
        ))}
      </div>
    </div>
  )
}

interface ZkPassportVerifyProps {
  marketIds?: number[]
}

function isValidEthAddress(input: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(input.trim())
}

function looksLikeEns(input: string): boolean {
  const trimmed = input.trim()
  return trimmed.includes(".") && !isValidEthAddress(trimmed) && trimmed.length > 3
}

export default function ZkPassportVerify({ marketIds = [] }: ZkPassportVerifyProps) {
  const [state, setState] = useState<VerificationState>("idle")
  const [scanStatus, setScanStatus] = useState<ScanStatus>("awaiting_scan")
  const [error, setError] = useState<string | null>(null)
  const [verificationUrl, setVerificationUrl] = useState<string | null>(null)
  const [walletInput, setWalletInput] = useState("")
  const [claimResult, setClaimResult] = useState<ClaimResult | null>(null)
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [resolvedEns, setResolvedEns] = useState<string | null>(null)
  const [ensLoading, setEnsLoading] = useState(false)
  const [ensError, setEnsError] = useState(false)

  const proofsRef = useRef<unknown[]>([])
  const queryResultRef = useRef<unknown>(null)

  const zkpassportRef = useRef<ZKPassport | null>(null)
  const requestIdRef = useRef<string | null>(null)

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!looksLikeEns(walletInput)) {
      setResolvedEns(null)
      setEnsLoading(false)
      setEnsError(false)
      return
    }
    setResolvedEns(null)
    setEnsError(false)
    setEnsLoading(true)
    const timer = setTimeout(async () => {
      try {
        const address = await publicClient.getEnsAddress({ name: normalize(walletInput.trim()) })
        if (address) {
          setResolvedEns(address)
          setEnsError(false)
        } else {
          setEnsError(true)
        }
      } catch {
        setEnsError(true)
      } finally {
        setEnsLoading(false)
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [walletInput])

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null }
    setTimeRemaining(null)
  }, [])

  const reset = useCallback(() => {
    clearTimers()
    if (requestIdRef.current && zkpassportRef.current) {
      try {
        zkpassportRef.current.cancelRequest(requestIdRef.current)
      } catch {
        // Ignore cancel errors
      }
    }
    zkpassportRef.current = null
    requestIdRef.current = null
    proofsRef.current = []
    queryResultRef.current = null
    setState("idle")
    setScanStatus("awaiting_scan")
    setError(null)
    setVerificationUrl(null)
    setWalletInput("")
    setClaimResult(null)
    setResolvedEns(null)
    setEnsLoading(false)
    setEnsError(false)
  }, [clearTimers])

  const startVerification = useCallback(async () => {
    setError(null)
    setScanStatus("awaiting_scan")
    setState("scanning")

    try {
      if (!zkpassportRef.current) {
        zkpassportRef.current = new ZKPassport()
      }

      const devMode = process.env.NODE_ENV === "development"
      const query = await zkpassportRef.current.request({
        name: "MATE Faucet",
        logo: "https://matetoken.xyz/favicon.ico",
        purpose: "Prove you are a unique human to claim 100 MATE tokens on Base",
        devMode,
      })

      const { url, requestId, onRequestReceived, onGeneratingProof, onProofGenerated, onResult, onReject, onError } =
        query.done()

      setVerificationUrl(url)
      requestIdRef.current = requestId
      proofsRef.current = []

      onRequestReceived(() => {
        setScanStatus("request_received")
      })

      onGeneratingProof(() => {
        setScanStatus("generating_proof")
      })

      onProofGenerated((proof: unknown) => {
        proofsRef.current.push(proof)
      })

      onResult(({ verified, result: queryResult }: { verified: boolean; result: unknown }) => {
        clearTimers()
        if (!verified) {
          setError("Proof verification failed. Please try again.")
          setState("error")
          return
        }
        queryResultRef.current = queryResult
        setState("address_input")
      })

      onReject(() => {
        clearTimers()
        setError("Verification was rejected.")
        setState("error")
      })

      onError((err: unknown) => {
        clearTimers()
        setError(typeof err === "string" ? err : "An error occurred during verification.")
        setState("error")
      })

      const SCAN_TIMEOUT_MS = 5 * 60 * 1000
      const startTime = Date.now()
      setTimeRemaining(Math.ceil(SCAN_TIMEOUT_MS / 1000))

      countdownRef.current = setInterval(() => {
        const remaining = Math.ceil((SCAN_TIMEOUT_MS - (Date.now() - startTime)) / 1000)
        setTimeRemaining(Math.max(0, remaining))
      }, 1000)

      timeoutRef.current = setTimeout(() => {
        clearTimers()
        try { zkpassportRef.current?.cancelRequest(requestIdRef.current!) } catch { }
        setError("Verification timed out. Please try again.")
        setState("error")
      }, SCAN_TIMEOUT_MS)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initialize verification.")
      setState("error")
    }
  }, [clearTimers])

  const claimTokens = useCallback(async () => {
    const input = walletInput.trim()
    const isEnsInput = looksLikeEns(input)
    if (!isValidEthAddress(input) && !(isEnsInput && resolvedEns)) return

    setState("claiming")
    setError(null)

    try {
    const response = await fetch("/api/faucet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        proofs: proofsRef.current,
        queryResult: queryResultRef.current,
        walletInput: input,
        domain: window.location.hostname,
      }),
    })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Claim failed")
        setState("address_input")
        return
      }

      setClaimResult(data)
      setState("success")
    } catch {
      setError("Failed to communicate with server")
      setState("address_input")
    }
  }, [walletInput, resolvedEns])

  // --- Idle state ---
  if (state === "idle") {
    return (
      <div className="flex flex-col items-center gap-5">
        <p className="max-w-xs text-center text-xs leading-relaxed text-[#3d3228]/40">
          Scan the QR code with the zkPassport app to prove you are a unique human.
          No personal data is disclosed.
        </p>
        <button
          onClick={startVerification}
          className="group relative overflow-hidden rounded-xl bg-[#2a1f14] px-8 py-3.5 font-mono text-[13px] font-semibold tracking-wide text-[#f5ece1] uppercase transition-all duration-300 hover:shadow-[0_8px_40px_rgba(42,31,20,0.2)]"
        >
          <span className="relative z-[1]">Begin Verification</span>
          <div className="absolute inset-0 bg-white/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        </button>
        <p className="font-mono text-[10px] tracking-widest text-[#3d3228]/25 uppercase">
          Requires zkPassport app
        </p>
      </div>
    )
  }

  // --- Scanning state ---
  if (state === "scanning") {
    const statusLabel =
      scanStatus === "awaiting_scan"
        ? "Waiting for scan"
        : scanStatus === "request_received"
          ? "Received — generating proof"
          : "Generating proof…"

    return (
      <div className="flex flex-col items-center gap-6">
        {verificationUrl && scanStatus === "awaiting_scan" && (
          <div className="relative">
            <div className="absolute -left-1.5 -top-1.5 h-4 w-4 rounded-tl-sm border-l-2 border-t-2 border-[#b08247]/30" />
            <div className="absolute -right-1.5 -top-1.5 h-4 w-4 rounded-tr-sm border-r-2 border-t-2 border-[#b08247]/30" />
            <div className="absolute -bottom-1.5 -left-1.5 h-4 w-4 rounded-bl-sm border-b-2 border-l-2 border-[#b08247]/30" />
            <div className="absolute -bottom-1.5 -right-1.5 h-4 w-4 rounded-br-sm border-b-2 border-r-2 border-[#b08247]/30" />
            <div className="rounded-xl bg-white p-4">
              <QRCodeSVG
                value={verificationUrl}
                size={200}
                level="M"
                includeMargin={false}
                bgColor="#ffffff"
                fgColor="#000000"
              />
            </div>
          </div>
        )}

        {(scanStatus === "request_received" || scanStatus === "generating_proof") && (
          <div className="flex h-[232px] w-[232px] items-center justify-center rounded-xl border border-[#3d3228]/[0.08] bg-white/30">
            <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[#3d3228]/10 border-t-[#b08247]/60" />
          </div>
        )}

        <div className="flex flex-col items-center gap-2">
          {verificationUrl && scanStatus === "awaiting_scan" && (
            <a
              href={verificationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[11px] tracking-wider text-[#b08247]/70 underline transition-colors hover:text-[#b08247]"
            >
              Open in app
            </a>
          )}
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#b08247]/40" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#b08247]/70" />
            </span>
            <span className="font-mono text-[11px] tracking-wider text-[#3d3228]/35">
              {statusLabel}
              {timeRemaining !== null && (
                <span className="ml-2 text-[#3d3228]/25">
                  {Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, "0")}
                </span>
              )}
            </span>
          </div>
        </div>

        <button
          onClick={reset}
          className="font-mono text-[11px] tracking-wider text-[#3d3228]/25 transition-colors hover:text-[#3d3228]/50"
        >
          Cancel
        </button>
      </div>
    )
  }

  // --- Address input state ---
  if (state === "address_input") {
    const isEns = looksLikeEns(walletInput)
    const valid = isValidEthAddress(walletInput) || (isEns && !!resolvedEns)
    return (
      <div className="flex w-full flex-col gap-6">
        <div className="flex flex-col items-center gap-3">
          <div className="relative flex h-12 w-12 items-center justify-center">
            <div className="absolute inset-0 rounded-full border border-[#3d3228]/10" />
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M5 10L9 14L15 6" stroke="#2a1f14" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="text-center">
            <p className="mb-1 font-mono text-sm font-semibold tracking-wide text-[#2a1f14] uppercase">
              Identity Verified
            </p>
            <p className="text-xs text-[#3d3228]/40">
              Enter the address where you want to receive 100 MATE
            </p>
          </div>
        </div>

        <div className="w-full space-y-3">
          <div className="relative w-full">
            <input
              type="text"
              value={walletInput}
              onChange={e => setWalletInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && valid && claimTokens()}
              placeholder="0x… or name.eth"
              className={`w-full rounded-xl border border-[#3d3228]/[0.12] bg-white/60 px-4 py-3 font-mono text-sm text-[#2a1f14] placeholder-[#3d3228]/25 outline-none transition-all focus:border-[#b08247]/40 focus:bg-white/80 focus:ring-2 focus:ring-[#b08247]/10${valid ? " pr-10" : ""}`}
              style={{ userSelect: "text", WebkitUserSelect: "text" }}
            />
            {valid && (
              <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8L7 12L13 4" stroke="#22c55e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            )}
          </div>

          {isEns && ensLoading && (
            <p className="flex items-center gap-1.5 font-mono text-[11px] text-[#3d3228]/40">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border border-[#3d3228]/20 border-t-[#3d3228]/60" />
              Resolving…
            </p>
          )}
          {resolvedEns && (
            <p className="font-mono text-[11px] text-[#3d3228]/50">
              → <span className="text-[#2a1f14]">{resolvedEns}</span>
            </p>
          )}
          {isEns && !ensLoading && ensError && (
            <p className="font-mono text-[11px] text-[#a0522d]/60">
              ENS name not found
            </p>
          )}
          {walletInput && !isEns && !isValidEthAddress(walletInput) && (
            <p className="font-mono text-[11px] text-[#a0522d]/60">
              Enter a valid 0x address or ENS name (e.g. name.eth)
            </p>
          )}

          {error && (
            <p className="text-center text-xs text-[#a0522d]/80">{error}</p>
          )}

          <button
            onClick={claimTokens}
            disabled={!valid}
            className="group relative w-full overflow-hidden rounded-xl bg-[#2a1f14] px-8 py-3.5 font-mono text-[13px] font-semibold tracking-wide text-[#f5ece1] uppercase transition-all duration-300 hover:shadow-[0_8px_40px_rgba(42,31,20,0.2)] disabled:cursor-not-allowed disabled:opacity-30"
          >
            <span className="relative z-[1]">Claim 100 MATE</span>
            <div className="absolute inset-0 bg-white/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          </button>
        </div>

        <MarketsSection marketIds={marketIds} />
      </div>
    )
  }

  // --- Claiming state ---
  if (state === "claiming") {
    return (
      <div className="flex flex-col items-center gap-5">
        <span className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-[#3d3228]/10 border-t-[#b08247]/60" />
        <p className="font-mono text-[11px] tracking-wider text-[#3d3228]/40">Sending tokens…</p>
      </div>
    )
  }

  // --- Success state ---
  if (state === "success" && claimResult) {
    return (
      <div className="flex flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-5">
          <div className="relative flex h-16 w-16 items-center justify-center">
            <div className="absolute inset-0 rounded-full border border-[#3d3228]/10" />
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M5 12L10 17L19 7" stroke="#2a1f14" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <div className="text-center">
            <p className="mb-1 font-mono text-sm font-semibold tracking-wide text-[#2a1f14] uppercase">
              Tokens Claimed
            </p>
            <p className="text-xs text-[#3d3228]/40">{claimResult.message}</p>
          </div>

          {claimResult.txHash && !claimResult.txHash.startsWith("0x_demo") && (
            <a
              href={`https://basescan.org/tx/${claimResult.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#3d3228]/[0.08] bg-white/30 px-4 py-2 font-mono text-[11px] tracking-wider text-[#3d3228]/50 transition-colors hover:border-[#3d3228]/15 hover:text-[#3d3228]/70"
            >
              View on Basescan
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M3 1H9V7M9 1L1 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          )}

          <button
            onClick={reset}
            className="font-mono text-[11px] tracking-wider text-[#3d3228]/25 transition-colors hover:text-[#3d3228]/50"
          >
            Done
          </button>
        </div>

        <MarketsSection marketIds={marketIds} />
      </div>
    )
  }

  // --- Error state ---
  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative flex h-16 w-16 items-center justify-center">
        <div className="absolute inset-0 rounded-full border border-[#3d3228]/10" />
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M6 6L14 14M14 6L6 14" stroke="#a0522d" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>

      <div className="text-center">
        <p className="mb-1 font-mono text-sm font-semibold tracking-wide text-[#a0522d] uppercase">
          Verification Failed
        </p>
        <p className="text-xs text-[#3d3228]/40">
          {error || "An error occurred"}
        </p>
      </div>

      <button
        onClick={reset}
        className="rounded-xl border border-[#3d3228]/[0.08] bg-white/30 px-6 py-2.5 font-mono text-[11px] tracking-wider text-[#3d3228]/50 uppercase transition-all duration-200 hover:border-[#3d3228]/15 hover:bg-white/50"
      >
        Try Again
      </button>
    </div>
  )
}
