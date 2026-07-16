import { fetchHealth } from "@/lib/backendClient";

export default async function Home() {
  const result = await fetchHealth();

  return (
    <main>
      <h1>chaotang-os</h1>
      <p>最小前端入口：仅用于验证前端骨架与后端健康检查的联通，不承载业务 UI。</p>
      <section>
        <h2>后端健康检查</h2>
        {result.ok ? (
          <p data-testid="backend-status" data-backend-ok="true">
            后端状态：{result.data.status}（{result.data.service} v{result.data.version}）
          </p>
        ) : (
          <p data-testid="backend-status" data-backend-ok="false">
            后端不可用：{result.error}
          </p>
        )}
      </section>
    </main>
  );
}
