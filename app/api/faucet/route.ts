export const config = {
  runtime: "edge",
};

import { createWalletClient, createPublicClient, http, parseUnits } from "viem"
import { base, mainnet } from "viem/chains"
import { privateKeyToAccount } from "viem/accounts"
import { normalize } from "viem/ens"
import { ZKPassport } from "@zkpassport/sdk"
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"
import { getStore } from "~/lib/claim-store"

type FaucetErrorCode = "INVALID_PROOF" | "RATE_LIMITED" | "TRANSFER_FAILED" | "INVALID_REQUEST" | "SERVER_ERROR"

interface FaucetError {
  error: string
  code: FaucetErrorCode
  details?: Record<string, unknown>
}

const MATE_TOKEN_ADDRESS = process.env.MATE_TOKEN_ADDRESS || "0xc139c86de76df41c041a30853c3958427fa7cebd"
const FAUCET_PRIVATE_KEY = process.env.FAUCET_PRIVATE_KEY
const BASE_RPC_URL = process.env.BASE_RPC_URL || "https://mainnet.base.org"



function getRatelimiter(): Ratelimit | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(5, "10 m"),
    prefix: "rl:faucet",
  })
}

const ratelimiter = getRatelimiter()
const CLAIM_AMOUNT = "100"
const CLAIM_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000

const ERC20_ABI = [
  {
    name: "transfer",
    type: "function",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const

function isProductionMode(): boolean {
  if (!process.env.FAUCET_PRIVATE_KEY) {
    console.warn("[Faucet] FAUCET_PRIVATE_KEY not set — running in demo mode")
    return false
  }
  return true
}

const IS_PRODUCTION = isProductionMode()

function jsonResponse(data: object, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function errorResponse(
  error: string,
  code: FaucetErrorCode,
  status: number,
  details?: Record<string, unknown>
): Response {
  const body: FaucetError = { error, code }
  if (details) body.details = details
  return jsonResponse(body, status)
}

async function resolveWalletAddress(input: string): Promise<string | null> {
  const trimmed = input.trim()

  if (/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
    return trimmed
  }

  if (trimmed.includes(".") && !trimmed.startsWith("0x")) {
    try {
      const ethClient = createPublicClient({ chain: mainnet, transport: http() })
      const address = await ethClient.getEnsAddress({ name: normalize(trimmed) })
      return address ?? null
    } catch {
      return null
    }
  }

  return null
}

async function sendMateTokens(toAddress: string, amount: string): Promise<string | null> {
  if (!IS_PRODUCTION) {
    console.log(`[Faucet] Demo mode: Would send ${amount} MATE to ${toAddress}`)
    return "0x_demo_tx_hash_" + Date.now().toString(16)
  }

  try {
    const account = privateKeyToAccount(FAUCET_PRIVATE_KEY as `0x${string}`)
    const client = createWalletClient({
      account,
      chain: base,
      transport: http(BASE_RPC_URL),
    })
    return await client.writeContract({
      address: MATE_TOKEN_ADDRESS as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "transfer",
      args: [toAddress as `0x${string}`, parseUnits(amount, 18)],
    })
  } catch (err) {
    console.error("[Faucet] sendMateTokens error:", err)
    return null
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const clientAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      request.headers.get("x-real-ip") ??
      "unknown"

    if (ratelimiter) {
      const { success, limit, remaining, reset } = await ratelimiter.limit(clientAddress)
      if (!success) {
        return errorResponse("Too many requests — try again later", "RATE_LIMITED", 429, {
          limit,
          remaining,
          resetAt: new Date(reset).toISOString(),
        })
      }
    }

    const body = await request.json()
    const { proofs, queryResult, walletInput, domain } = body

    if (!proofs || !queryResult || !walletInput || !domain) {
      return errorResponse("Missing required fields: proofs, queryResult, walletInput, domain", "INVALID_REQUEST", 400)
    }

    const walletAddress = await resolveWalletAddress(walletInput)
    if (!walletAddress) {
      return errorResponse(
        "Invalid wallet address or unresolvable ENS name",
        "INVALID_REQUEST",
        400,
        { input: walletInput }
      )
    }

    let uniqueIdentifier: string
    try {
      const devMode = process.env.NODE_ENV === "development"
      console.log("[Faucet] devMode:", devMode, "domain:", domain)

      const zkPassport = new ZKPassport(domain)
      const result = await zkPassport.verify({ proofs, queryResult, devMode })

      console.log("[Faucet] Verification result:", result)

      if (!result.verified) {
        console.error("[Faucet] zkPassport verification failed:", result.queryResultErrors)
        return errorResponse("Identity proof verification failed", "INVALID_PROOF", 400)
      }

      if (!result.uniqueIdentifier) {
        return errorResponse("Could not extract unique identifier from proof", "INVALID_PROOF", 400)
      }

      uniqueIdentifier = result.uniqueIdentifier
      console.log(`[Faucet] Verified — uniqueIdentifier: ${uniqueIdentifier.slice(0, 16)}… wallet: ${walletAddress} devMode: ${devMode}`)
    } catch (err) {
      console.error("[Faucet] zkPassport verify error:", err)
      return errorResponse("Proof verification error", "INVALID_PROOF", 400)
    }

    const store = getStore()
    const lastClaim = await store.getLastClaim(uniqueIdentifier)
    const now = Date.now()

    if (lastClaim && now - lastClaim < CLAIM_COOLDOWN_MS) {
      const nextClaimTime = new Date(lastClaim + CLAIM_COOLDOWN_MS)
      const hoursRemaining = Math.ceil((lastClaim + CLAIM_COOLDOWN_MS - now) / (60 * 60 * 1000))
      return errorResponse("Already claimed this week", "RATE_LIMITED", 429, {
        nextClaimAvailable: nextClaimTime.toISOString(),
        hoursRemaining,
      })
    }

    const txHash = await sendMateTokens(walletAddress, CLAIM_AMOUNT)
    if (!txHash) {
      return errorResponse("Token transfer failed", "TRANSFER_FAILED", 500)
    }

    await store.recordClaim(uniqueIdentifier, now, walletAddress)

    return jsonResponse({
      success: true,
      message: `Successfully claimed ${CLAIM_AMOUNT} MATE tokens!`,
      txHash,
      demoMode: !IS_PRODUCTION,
    })
  } catch (error) {
    console.error("[Faucet] Error:", error)
    return errorResponse("Internal server error", "SERVER_ERROR", 500)
  }
}
