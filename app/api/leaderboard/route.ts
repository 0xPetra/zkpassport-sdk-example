const TOKEN_ADDRESS = "0xc139c86de76df41c041a30853c3958427fa7cebd"

const EXCLUDED = new Set(
  [
    "0x72e9BF4d0aDEd11c026163E90D6A6A0ee0a9AFC3",
    "0xb97214755c216B482A298Aec26075dcd7bCEFB86",
    "0x1B2De84298c854Aa9892CdDeEB543a4115855206",
    "0x9FC3B33884e1D056a8CA979833d686abD267f9f8",
    "0x53ca6FA1aeF60D2DE31585a879CA5631Ee4A7c9D",
    "0xffCd1574F50C10B94E7C0632114e4A7c0b5f9f0F",
    "0x358430f53673D5b6949E8d63A74beC795aEC7bb5",
    "0x61712316ddd871bE2ff1fe851a5AF14bf254604f",
    "0x9475A4C1BF5Fc80aE079303f14B523da19619c16",
    "0x5D45B7d8e517eF6b7085175ed395D9c8562b952f",
    "0x683f11bc4C7EfD6B3A154eC2CCab05D80174D9a7",
  ].map(a => a.toLowerCase())
)

interface HolderEntry {
  rank: number
  address: string
  ens: string | null
  balance: number
}

async function resolveEns(address: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.ensideas.com/ens/resolve/${address}`, {
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) return null
    const data = await res.json()
    return (data as { name?: string }).name ?? null
  } catch {
    return null
  }
}

async function fetchHolders(): Promise<{ address: string; ens: string | null; balance: number }[]> {
  const url = `https://base.blockscout.com/api/v2/tokens/${TOKEN_ADDRESS}/holders`

  const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`Blockscout HTTP ${res.status}`)

  const data = await res.json()
  if (!Array.isArray(data.items)) throw new Error("Unexpected Blockscout response")

  return data.items
    .map((item: { address: { hash: string; ens_domain_name?: string | null }; value: string }) => ({
      address: item.address.hash,
      ens: item.address.ens_domain_name ?? null,
      balance: Math.round(Number(item.value) / 1e18),
    }))
    .filter((h: { address: string; balance: number }) => !EXCLUDED.has(h.address.toLowerCase()) && h.balance > 0)
}

// In-memory cache (persists for the lifetime of the serverless function instance)
let cache: { data: HolderEntry[]; ts: number } | null = null
const CACHE_TTL = 5 * 60 * 1000

function json(data: object, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
    },
  })
}

export async function GET(): Promise<Response> {
  try {
    if (cache && Date.now() - cache.ts < CACHE_TTL) {
      return json({ leaderboard: cache.data })
    }

    const holders = await fetchHolders()
    const top20 = holders.slice(0, 20)

    const ensResults = await Promise.allSettled(
      top20.map(h => h.ens !== null ? Promise.resolve(h.ens) : resolveEns(h.address))
    )

    const leaderboard: HolderEntry[] = top20.map((h, i) => ({
      rank: i + 1,
      address: h.address,
      ens: ensResults[i].status === "fulfilled" ? ensResults[i].value : h.ens,
      balance: h.balance,
    }))

    cache = { data: leaderboard, ts: Date.now() }
    return json({ leaderboard })
  } catch (err) {
    console.error("[Leaderboard]", err)
    if (cache) return json({ leaderboard: cache.data, stale: true })
    return json({ leaderboard: [], error: "Failed to fetch holders" }, 500)
  }
}
