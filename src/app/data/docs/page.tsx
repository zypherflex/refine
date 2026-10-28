import Link from "next/link";
import { dataPlans } from "@/lib/data-plans";
import { EVERYDAY_ITEMS } from "@/lib/everyday";

export const metadata = { title: "API documentation · RefineryLens Data" };

const base = (process.env.APP_URL ?? "https://app.refinerylens.ng").replace(/\/$/, "");
const Code = ({ children }: { children: string }) => <pre className="mt-2 overflow-x-auto rounded-xl bg-ink-950 p-4 text-xs leading-relaxed text-ink-100"><code>{children}</code></pre>;

export default function Docs() {
  const endpoints: [string, string, string][] = [
    ["GET /api/v1/meta", "Products, states and the two sources, with how each is calculated.", ""],
    ["GET /api/v1/latest", "The most recent figure for every state, product and source.", "item, state, source"],
    ["GET /api/v1/prices", "Daily history, newest first, up to 1,000 rows a page.", "item, state, source, from, to (YYYY-MM-DD), limit, offset"],
    ["GET /api/v1/national", "A daily national figure: the median of the state medians, with how many states contributed.", "item (required), source, from, to"],
  ];
  return (
    <article className="prose-sm max-w-3xl space-y-8">
      <header>
        <p className="eyebrow">RefineryLens Data</p>
        <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight">API documentation</h1>
        <p className="mt-2 text-ink-600">A JSON REST API over HTTPS. Create a key under <Link href="/account/data">Data &amp; API</Link>.</p>
      </header>
      <section><h2 className="h-section">Authentication</h2><p className="mt-1 text-sm text-ink-700">Send your key in the Authorization header. Keep it on your server; anyone with it can use your allowance.</p><Code>{`curl -H "Authorization: Bearer rl_live_..." "${base}/api/v1/meta"`}</Code></section>
      <section>
        <h2 className="h-section">Endpoints</h2>
        <div className="table-wrap mt-2"><table className="tbl"><thead><tr><th>Endpoint</th><th>Returns</th><th>Parameters</th></tr></thead><tbody>{endpoints.map(([e, r, p]) => <tr key={e}><td className="whitespace-nowrap font-mono text-xs">{e}</td><td className="text-sm">{r}</td><td className="font-mono text-xs">{p || "–"}</td></tr>)}</tbody></table></div>
        <p className="mt-2 text-sm text-ink-700">Items: <code className="text-xs">{EVERYDAY_ITEMS.join(", ")}</code>. Sources: <code className="text-xs">PUBLIC</code> (what people paid, 3-day window, at least 3 people) and <code className="text-xs">SELLER</code> (what sellers charged, 7-day window, at least 3 sellers). States use the names in <code className="text-xs">/api/v1/meta</code>, e.g. <code className="text-xs">FCT Abuja</code>.</p>
        <Code>{`curl -H "Authorization: Bearer rl_live_..." \\
  "${base}/api/v1/prices?item=pms_retail_litre&state=Lagos&source=PUBLIC&from=2026-10-01"`}</Code>
      </section>
      <section>
        <h2 className="h-section">Fields</h2>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink-700">
          <li><code>median</code>, <code>low</code>, <code>high</code>: naira, in the product&apos;s <code>unit</code> (per litre, per kg, per refill, per scm).</li>
          <li><code>reporters</code>: distinct people or sellers behind the figure.</li>
          <li><code>demo: true</code>: the figure includes demonstration data and is not market data. Production data never carries it.</li>
        </ul>
      </section>
      <section>
        <h2 className="h-section">Limits and errors</h2>
        <p className="mt-1 text-sm text-ink-700">Every response carries <code>X-RateLimit-Limit</code> and <code>X-RateLimit-Remaining</code>; allowances reset at 00:00 UTC. History is limited by plan.</p>
        <div className="table-wrap mt-2"><table className="tbl"><thead><tr><th>Plan</th><th className="text-right">Requests a day</th><th>History</th><th className="text-right">Keys</th></tr></thead><tbody>{dataPlans().map((p) => <tr key={p.id}><td>{p.name}</td><td className="num text-right">{p.requestsPerDay.toLocaleString("en-GB")}</td><td>{p.historyDays === null ? "All" : `${p.historyDays} days`}</td><td className="num text-right">{p.keys}</td></tr>)}</tbody></table></div>
        <Code>{`401 unauthorized      missing, invalid or revoked key
402 payment_required  the plan or trial has ended
400 bad_request       an unknown item, state, source or date
429 rate_limited      the day's allowance is used up`}</Code>
      </section>
      <section><h2 className="h-section">Licence</h2><p className="mt-1 text-sm text-ink-700">Starter and Professional are for use inside your organisation. Showing the data in your own products or reports for others needs an Enterprise licence. Cite &quot;Source: RefineryLens Data&quot;.</p></section>
    </article>
  );
}
