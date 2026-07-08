'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { buildSellerWorkspaceHref } from '../lib/seller-workspace-utils';

type SourceFile = {
  name: string;
  type: 'excel' | 'pdf' | 'image';
};

export function BatteryExchangeSell() {
  const [files] = useState<SourceFile[]>([
    { name: 'catl-inventory-apr.xlsx', type: 'excel' },
    { name: 'inspection-snaps.pdf', type: 'pdf' },
  ]);
  const [title, setTitle] = useState('CATL 280Ah 磷酸铁锂整托现货');
  const [brand, setBrand] = useState('CATL');
  const [model, setModel] = useState('LF280K');
  const [capacity, setCapacity] = useState('280');
  const [quantity, setQuantity] = useState('1280');
  const [city, setCity] = useState('苏州');
  const [price, setPrice] = useState('355');
  const [publishState, setPublishState] = useState<'idle' | 'published'>('idle');

  const missingFields = useMemo(() => {
    const fields: string[] = [];
    if (!brand.trim()) fields.push('品牌');
    if (!model.trim()) fields.push('型号');
    if (!capacity.trim()) fields.push('容量');
    if (!quantity.trim()) fields.push('数量');
    if (!city.trim()) fields.push('城市');
    return fields;
  }, [brand, model, capacity, quantity, city]);

  const conflictFields = useMemo(() => {
    const fields: string[] = [];
    if (Number(quantity) > 0 && Number(quantity) < 64) fields.push('数量低于默认起订步长 64');
    if (Number(price) > 380) fields.push('价格高于当前建议区间');
    return fields;
  }, [quantity, price]);

  return (
    <div className="relative min-h-full overflow-y-auto bg-[#111111] text-[#f3ead3]">
      <div
        className="absolute inset-0 opacity-70"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(circle at 15% 15%, rgba(214,126,52,0.18), transparent 22%), radial-gradient(circle at 82% 12%, rgba(244,199,91,0.12), transparent 28%), linear-gradient(180deg, #161210 0%, #111111 48%, #0a0a0a 100%)',
        }}
      />
      <div className="relative mx-auto max-w-[1480px] px-4 py-6 pb-10 sm:px-6 lg:px-8">
        <div className="mb-5 flex items-center gap-3 text-sm text-[#b69a77]">
          <Link href="/battery-exchange" className="hover:text-[#f0c27b]">
            电池现货台
          </Link>
          <span>/</span>
          <Link href="/battery-exchange/market" className="hover:text-[#f0c27b]">
            现货交易台
          </Link>
          <span>/</span>
          <span className="text-[#f0c27b]">卖家挂货台</span>
        </div>
        <section className="rounded-[30px] border border-[#3c2c20] bg-[#171311]/90 p-6">
          <div className="mb-4 flex flex-wrap gap-4 text-sm text-[#b99876]">
            <Link href={buildSellerWorkspaceHref('seller-1')} className="hover:text-[#f0c27b]">
              查看我的货盘
            </Link>
            <Link href="/battery-exchange/inquiries" className="hover:text-[#f0c27b]">
              查看买家询盘
            </Link>
          </div>
          <div className="text-[11px] uppercase tracking-[0.32em] text-[#bd8751]">Seller Upload</div>
          <h1 className="mt-3 text-[38px] font-semibold leading-tight text-[#f7ead1]" style={{ fontFamily: 'var(--font-serif)' }}>
            上传库存，生成标准货盘。
          </h1>
          <p className="mt-3 max-w-3xl text-[15px] leading-7 text-[#cfb493]">
            把 Excel、PDF、图片和聊天记录整理成买家看得懂、愿意谈的货盘。平台会先给出建议标题、建议价格区间和建议交易结构。
          </p>
        </section>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <Panel eyebrow="Upload Dropzone" title="上传源文件">
              <div className="rounded-[22px] border border-dashed border-[#6b4b2b] bg-[#120f0d] px-5 py-8 text-center text-sm leading-7 text-[#d1b594]">
                支持 Excel、PDF、图片。平台会自动提取参数、识别缺失字段并生成草稿。
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {files.map((file) => (
                  <span key={file.name} className="rounded-full border border-[#5f442b] bg-[#241a13] px-3 py-1 text-xs text-[#edc98f]">
                    {file.type.toUpperCase()} · {file.name}
                  </span>
                ))}
              </div>
            </Panel>

            <Panel eyebrow="Parse Result" title="Agent 解析结果">
              <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
                <div className="space-y-3">
                  <FlagCard title="缺失字段" items={missingFields.length > 0 ? missingFields : ['无']} />
                  <FlagCard title="冲突字段" items={conflictFields.length > 0 ? conflictFields : ['无']} />
                </div>
                <div className="rounded-[18px] border border-[#3f2e22] bg-[#120f0d] px-4 py-4">
                  <div className="text-sm font-semibold text-[#f6dfbc]">平台建议</div>
                  <div className="mt-3 space-y-3 text-sm leading-7 text-[#cfb08b]">
                    <div>建议标题：{title}</div>
                    <div>建议价格区间：¥348 - ¥362 / 颗</div>
                    <div>建议交易结构：30% 托管定金 + 验货后放款</div>
                    <div>推荐买家：储能集成商、pack 厂、项目型采购方</div>
                  </div>
                </div>
              </div>
            </Panel>

            <Panel eyebrow="Draft Editor" title="标准货盘草稿">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="标题" value={title} onChange={setTitle} />
                <Field label="品牌" value={brand} onChange={setBrand} />
                <Field label="型号" value={model} onChange={setModel} />
                <Field label="容量 Ah" value={capacity} onChange={setCapacity} />
                <Field label="数量" value={quantity} onChange={setQuantity} />
                <Field label="城市" value={city} onChange={setCity} />
                <Field label="建议挂牌价 / 颗" value={price} onChange={setPrice} />
              </div>
            </Panel>
          </div>

          <aside className="xl:sticky xl:top-6 xl:self-start">
            <Panel eyebrow="Publish Action" title="准备发布">
              <div className="space-y-3">
                <ActionItem
                  title="平台会这样展示"
                  body="标题、价格、城市、检测摘要、可买性和建议成交结构会一起对外展示。"
                />
                <ActionItem
                  title="发布前确认"
                  body="请确认批次、数量和交付条件，避免出现挂货后信息变更。"
                />
                <button
                  type="button"
                  onClick={() => setPublishState('published')}
                  className="w-full rounded-full bg-[#f0b76b] px-5 py-3 text-sm font-semibold text-[#20160f]"
                >
                  发布到现货池
                </button>
                {publishState === 'published' ? (
                  <div className="rounded-[18px] border border-[#3f2e22] bg-[#120f0d] px-4 py-4 text-sm leading-7 text-[#cfb08b]">
                    <div>货盘草稿已发布。下一步建议先补批次照片和检测附件，再推动第一批买家询盘。</div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <Link
                        href="/battery-exchange/market"
                        className="inline-flex rounded-full bg-[#f0b76b] px-4 py-2 text-sm font-semibold text-[#20160f]"
                      >
                        去现货交易台查看
                      </Link>
                      <Link
                        href="/battery-exchange/operators"
                        className="inline-flex rounded-full border border-[#3f2e22] px-4 py-2 text-sm text-[#d9bb97]"
                      >
                        去风控与处置台
                      </Link>
                      <Link
                        href={buildSellerWorkspaceHref('seller-1')}
                        className="inline-flex rounded-full border border-[#3f2e22] px-4 py-2 text-sm text-[#d9bb97]"
                      >
                        看我的货盘
                      </Link>
                      <Link
                        href="/battery-exchange"
                        className="inline-flex rounded-full border border-[#6d4d31] px-4 py-2 text-sm text-[#f3d0a1]"
                      >
                        回现货入口
                      </Link>
                    </div>
                  </div>
                ) : null}
              </div>
            </Panel>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Panel({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[28px] border border-[#2f2823] bg-[#151311]/88 p-5 sm:p-6">
      <div className="text-[11px] uppercase tracking-[0.3em] text-[#b47d44]">{eyebrow}</div>
      <h2 className="mt-2 text-2xl font-semibold text-[#f4ead1]">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function FlagCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-[18px] border border-[#3f2e22] bg-[#120f0d] px-4 py-4">
      <div className="text-sm font-semibold text-[#f6dfbc]">{title}</div>
      <div className="mt-3 space-y-2 text-sm leading-6 text-[#cfb08b]">
        {items.map((item) => (
          <div key={item}>• {item}</div>
        ))}
      </div>
    </div>
  );
}

function ActionItem({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[18px] border border-[#3f2e22] bg-[#120f0d] px-4 py-4">
      <div className="text-sm font-semibold text-[#f6dfbc]">{title}</div>
      <div className="mt-2 text-sm leading-7 text-[#cfb08b]">{body}</div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-[#d9bc99]">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-[18px] border border-[#3b312a] bg-[#0f0f0e] px-4 py-3 text-sm outline-none"
      />
    </label>
  );
}
