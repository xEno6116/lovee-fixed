import { useRef, useState, type DragEvent, type PointerEvent } from "react";
import { Eye, EyeOff, Grip, Move, RotateCcw, Scaling } from "lucide-react";
import {
  createDefaultPageElementLayouts,
  PAGE_EDITOR_PREVIEW_SCALE,
  PAGE_ELEMENT_IDS,
  type PageElementId,
  type PageElementLayouts,
} from "@shared/site-layout";

type Props = {
  layouts: PageElementLayouts;
  onChange: (layouts: PageElementLayouts) => void;
  hiddenSections: PageElementId[];
  onHiddenSectionsChange: (sections: PageElementId[]) => void;
};

type Interaction = {
  pointerId: number;
  id: PageElementId;
  mode: "move" | "resize";
  startX: number;
  startY: number;
  startLayout: PageElementLayouts[PageElementId];
};

const labels: Record<PageElementId, { name: string; hint: string; icon: string; preview: string }> = {
  header: { name: "ชื่อเว็บไซต์", hint: "หัวเรื่องหลักของหน้า", icon: "♡", preview: "ชื่อเว็บไซต์" },
  clock: { name: "ตัวนับเวลา", hint: "วัน ชั่วโมง นาที และวินาที", icon: "◷", preview: "ตัวนับเวลาครบรอบ" },
  video: { name: "วิดีโอ", hint: "แกลเลอรีวิดีโอ 4 ช่อง", icon: "▣", preview: "วิดีโอความทรงจำ" },
  message: { name: "ข้อความหลัก", hint: "ข้อความความทรงจำ", icon: "✉", preview: "ข้อความของเรา" },
  secret: { name: "ข้อความลับ", hint: "แสดงหลังปลดล็อก", icon: "✦", preview: "ข้อความลับ" },
  gallery: { name: "แกลเลอรีรูปภาพ", hint: "รูปภาพและปุ่มเลื่อน", icon: "▧", preview: "รูปภาพของเรา" },
  letter: { name: "จดหมาย", hint: "ฟอร์มเขียนจดหมาย", icon: "♡", preview: "เขียนจดหมายถึงเรา" },
  footer: { name: "ท้ายเว็บไซต์", hint: "ข้อความปิดท้ายหน้า", icon: "❀", preview: "อยู่ด้วยกันตลอดไปนะ" },
};

const previewHeights: Record<PageElementId, number> = {
  header: 82,
  clock: 52,
  video: 68,
  message: 56,
  secret: 56,
  gallery: 68,
  letter: 68,
  footer: 48,
};

export default function PageLayoutEditor({ layouts, onChange, hiddenSections, onHiddenSectionsChange }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const interaction = useRef<Interaction | null>(null);
  const [selected, setSelected] = useState<PageElementId>("header");
  const [snapToGrid, setSnapToGrid] = useState(false);
  const selectedLayout = layouts[selected];
  const canvasHeight = Math.max(860, ...PAGE_ELEMENT_IDS.map((id) => layouts[id].y * PAGE_EDITOR_PREVIEW_SCALE + 120));

  const beginInteraction = (id: PageElementId, mode: Interaction["mode"], event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setSelected(id);
    interaction.current = { pointerId: event.pointerId, id, mode, startX: event.clientX, startY: event.clientY, startLayout: { ...layouts[id] } };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveInteraction = (event: PointerEvent<HTMLDivElement>) => {
    const active = interaction.current;
    const canvas = canvasRef.current;
    if (!active || active.pointerId !== event.pointerId || !canvas) return;
    const deltaX = (event.clientX - active.startX) / canvas.clientWidth * 100;
    const deltaY = (event.clientY - active.startY) / PAGE_EDITOR_PREVIEW_SCALE;
    const start = active.startLayout;
    const snap = (value: number, step: number) => snapToGrid ? Math.round(value / step) * step : value;
    const next = active.mode === "move"
      ? { ...start, x: Math.max(0, Math.min(100 - start.width * (start.scale ?? 1), snap(start.x + deltaX, 100 / 24))), y: Math.max(0, Math.min(8000, snap(start.y + deltaY, 24 / PAGE_EDITOR_PREVIEW_SCALE))) }
      : { ...start, width: Math.max(20, Math.min((100 - start.x) / (start.scale ?? 1), start.width + deltaX)) };
    onChange({ ...layouts, [active.id]: next });
  };

  const dropFromPalette = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const id = event.dataTransfer.getData("application/x-loveoffice-element") as PageElementId;
    const canvas = canvasRef.current;
    if (!PAGE_ELEMENT_IDS.includes(id) || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const layout = layouts[id];
    const maxX = Math.max(0, 100 - layout.width * (layout.scale ?? 1));
    const x = Math.max(0, Math.min(maxX, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(8000, (event.clientY - rect.top) / PAGE_EDITOR_PREVIEW_SCALE));
    onChange({ ...layouts, [id]: { ...layout, x, y } });
    onHiddenSectionsChange(hiddenSections.filter((item) => item !== id));
    setSelected(id);
  };

  const finishInteraction = (event: PointerEvent<HTMLDivElement>) => {
    if (interaction.current?.pointerId === event.pointerId) interaction.current = null;
  };

  const updateSelected = (field: "x" | "y" | "width" | "scale", value: number) => {
    const current = layouts[selected];
    const next = { ...current, [field]: value };
    if (field === "x") next.width = Math.min(next.width, (100 - value) / (next.scale ?? 1));
    if (field === "width") next.x = Math.min(next.x, 100 - value * (next.scale ?? 1));
    if (field === "scale") { next.width = Math.min(next.width, 100 / value); next.x = Math.min(next.x, 100 - next.width * value); }
    onChange({ ...layouts, [selected]: next });
  };

  const changeLayer = (direction: -1 | 1) => {
    const sorted = [...PAGE_ELEMENT_IDS].sort((a, b) => (layouts[a].zIndex ?? 0) - (layouts[b].zIndex ?? 0));
    const index = sorted.indexOf(selected);
    const neighbor = sorted[index + direction];
    if (!neighbor) return;
    const selectedZ = layouts[selected].zIndex ?? 0;
    const neighborZ = layouts[neighbor].zIndex ?? 0;
    onChange({ ...layouts, [selected]: { ...layouts[selected], zIndex: neighborZ }, [neighbor]: { ...layouts[neighbor], zIndex: selectedZ } });
  };

  const reset = () => {
    onChange(createDefaultPageElementLayouts());
    setSelected("header");
  };

  return <section className="legacy-page-builder">
    <div className="legacy-builder-heading"><div><h4>ตกแต่งทุกส่วนบนหน้าเว็บ</h4><p>ลากบล็อกจากรายการมาวางบนหน้า หรือจับบล็อกในตัวอย่างเพื่อย้ายตำแหน่ง ลากมุม ↘ เพื่อปรับความกว้าง และเลือกบล็อกเพื่อปรับขนาด/ชั้นหน้า-หลัง</p></div><button type="button" className="legacy-builder-reset" onClick={reset}><RotateCcw size={14} /> คืนตำแหน่งเริ่มต้น</button></div>
    <div className="legacy-element-palette" aria-label="ลากบล็อกไปวางในตัวอย่างหน้าเว็บ">{PAGE_ELEMENT_IDS.map((id) => <button type="button" key={id} draggable onDragStart={(event) => { event.dataTransfer.setData("application/x-loveoffice-element", id); event.dataTransfer.effectAllowed = "move"; setSelected(id); }} className={selected === id ? "is-selected" : ""} onClick={() => setSelected(id)}><span>{labels[id].icon}</span><strong>{labels[id].name}</strong><Grip size={12} className="legacy-palette-grip" /></button>)}</div>
    <div className="legacy-element-visibility" aria-label="แสดงหรือซ่อนทุกส่วน">
      {PAGE_ELEMENT_IDS.map((id) => { const hidden = hiddenSections.includes(id); return <button type="button" key={id} className={hidden ? "is-hidden" : ""} onClick={() => onHiddenSectionsChange(hidden ? hiddenSections.filter((item) => item !== id) : [...hiddenSections, id])}><span>{hidden ? <EyeOff size={14} /> : <Eye size={14} />}</span>{labels[id].name}</button>; })}
    </div>
    <div className="legacy-page-canvas-viewport" onPointerMove={moveInteraction} onPointerUp={finishInteraction} onPointerCancel={finishInteraction} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }} onDrop={dropFromPalette}>
      <div ref={canvasRef} className="legacy-page-canvas" style={{ height: `${canvasHeight}px` }}>
        <div className="legacy-page-canvas-caption">ตัวอย่างหน้าเว็บ — ลากบล็อกได้</div>
        {PAGE_ELEMENT_IDS.map((id) => {
          const layout = layouts[id];
          const selectedClass = selected === id ? "is-selected" : "";
          const hidden = hiddenSections.includes(id);
          return <div key={id} className={`legacy-page-canvas-item ${selectedClass} ${hidden ? "is-hidden" : ""}`} style={{ left: `${layout.x}%`, top: `${layout.y * PAGE_EDITOR_PREVIEW_SCALE}px`, width: `${layout.width}%`, height: `${previewHeights[id]}px`, transform: `scale(${layout.scale ?? 1})`, transformOrigin: "top left", zIndex: layout.zIndex ?? 0 }}>
            <button type="button" className="legacy-page-canvas-move" onPointerDown={(event) => beginInteraction(id, "move", event)} aria-label={`ลากย้าย${labels[id].name}`} onClick={() => setSelected(id)}>
              <span className="legacy-page-canvas-icon">{labels[id].icon}</span><span><strong>{labels[id].preview}</strong><small>{labels[id].hint}</small></span><Move size={14} className="legacy-page-canvas-move-icon" />
            </button>
            <button type="button" className="legacy-page-canvas-resize" onPointerDown={(event) => beginInteraction(id, "resize", event)} aria-label={`ปรับขนาด${labels[id].name}`}><Scaling size={13} /></button>
          </div>;
        })}
      </div>
    </div>
    <div className="legacy-element-controls"><div className="legacy-element-controls-heading"><span>กำลังแก้ไข</span><strong>{labels[selected].name}</strong><span className="legacy-element-size">{Math.round(selectedLayout.width)}%</span></div>
      <div className="legacy-element-layer-controls"><button type="button" onClick={() => changeLayer(-1)}>ส่งไปด้านหลัง</button><button type="button" onClick={() => changeLayer(1)}>นำมาด้านหน้า</button></div>
      <label>แนวนอน <input type="range" min="0" max={Math.max(0, 100 - selectedLayout.width * (selectedLayout.scale ?? 1))} step="1" value={Math.round(selectedLayout.x)} onChange={(event) => updateSelected("x", Number(event.target.value))} /><input className="legacy-element-number" type="number" min="0" max={Math.max(0, 100 - selectedLayout.width * (selectedLayout.scale ?? 1))} step="1" value={Math.round(selectedLayout.x)} onChange={(event) => updateSelected("x", Number(event.target.value))} aria-label="ตำแหน่งแนวนอนเป็นเปอร์เซ็นต์" /></label>
      <label>แนวตั้ง <input type="range" min="0" max="7000" step="25" value={Math.round(selectedLayout.y)} onChange={(event) => updateSelected("y", Number(event.target.value))} /><input className="legacy-element-number" type="number" min="0" max="8000" step="10" value={Math.round(selectedLayout.y)} onChange={(event) => updateSelected("y", Number(event.target.value))} aria-label="ตำแหน่งแนวตั้งเป็นพิกเซล" /></label>
      <label>ความกว้าง <input type="range" min="20" max={Math.max(20, (100 - selectedLayout.x) / (selectedLayout.scale ?? 1))} step="1" value={Math.round(selectedLayout.width)} onChange={(event) => updateSelected("width", Number(event.target.value))} /><output>{Math.round(selectedLayout.width)}%</output></label>
      <label>ขนาดรวม <input type="range" min="0.7" max="1.3" step="0.05" value={selectedLayout.scale ?? 1} onChange={(event) => updateSelected("scale", Number(event.target.value))} /><output>{Math.round((selectedLayout.scale ?? 1) * 100)}%</output></label>
      <button type="button" className={`legacy-grid-snap ${snapToGrid ? "is-active" : ""}`} aria-pressed={snapToGrid} onClick={() => setSnapToGrid((value) => !value)}>{snapToGrid ? "ปิด" : "เปิด"} จัดตำแหน่งให้ตรงเส้นกริด</button>
    </div>
  </section>;
}
