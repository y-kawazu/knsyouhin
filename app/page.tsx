"use client";

import QRCode from "qrcode";
import { FormEvent, useRef, useState } from "react";

type ProductCode = { code: string; name: string; price: number };

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image failed"));
    image.src = src;
  });
}

function wrapLabel(context: CanvasRenderingContext2D, label: string, maxWidth: number) {
  const lines: string[] = [];
  let line = "";
  for (const character of label) {
    const next = line + character;
    if (line && context.measureText(next).width > maxWidth) {
      lines.push(line);
      line = character;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

async function createProductQrImage(product: ProductCode) {
  const qrDataUrl = await QRCode.toDataURL(JSON.stringify(product), {
    width: 720, margin: 2, errorCorrectionLevel: "M",
    color: { dark: "#000000", light: "#ffffff" },
  });
  const qr = await loadImage(qrDataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 720;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas failed");

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(qr, 0, 0, 720, 720);
  context.fillStyle = "#000000";
  context.textAlign = "center";
  context.textBaseline = "middle";

  let fontSize = 87;
  let lines: string[] = [];
  while (fontSize >= 39) {
    context.font = `800 ${fontSize}px sans-serif`;
    lines = wrapLabel(context, product.name, 400);
    if (lines.length <= 4 && lines.length * fontSize * 1.16 <= 350) break;
    fontSize -= 3;
  }
  const lineHeight = fontSize * 1.16;
  const firstLineY = 285 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, index) => context.fillText(line, 960, firstLineY + index * lineHeight));

  context.font = "800 108px sans-serif";
  context.fillText(`¥${product.price.toLocaleString("ja-JP")}`, 960, 535);

  return canvas.toDataURL("image/jpeg", 1);
}

function makeProductCode() {
  const now = new Date();
  const digits = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"), String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"), String(now.getSeconds()).padStart(2, "0")].join("");
  return `KN${digits}${Math.floor(Math.random() * 90 + 10)}`;
}

export default function Home() {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [product, setProduct] = useState<ProductCode | null>(null);
  const [qrImage, setQrImage] = useState("");
  const [message, setMessage] = useState("商品名と金額を入力してください。");
  const [creating, setCreating] = useState(false);
  const generation = useRef(0);
  const changed = !!product && (name.trim() !== product.name || price === "" || Number(price) !== product.price);
  const canSave = !!product && !!qrImage && !changed && !creating;
  const filename = `${product?.name.replace(/[\\/:*?"<>|]/g, "_").trim() || "KN商品"}.jpg`;

  async function createQr(event: FormEvent) {
    event.preventDefault();
    const cleanName = name.trim();
    const numericPrice = Math.round(Number(price));
    if (!cleanName || price === "" || !Number.isFinite(numericPrice) || numericPrice < 0) {
      setMessage("商品名と0円以上の金額を入力してください。");
      return;
    }
    const nextProduct = { code: makeProductCode(), name: cleanName, price: numericPrice };
    const request = ++generation.current;
    setCreating(true);
    try {
      const dataUrl = await createProductQrImage(nextProduct);
      if (request !== generation.current) return;
      setProduct(nextProduct);
      setQrImage(dataUrl);
      setMessage("KNレジ用QRコードができました。");
    } catch {
      if (request === generation.current) setMessage("QRコードを作成できませんでした。もう一度お試しください。");
    } finally {
      if (request === generation.current) setCreating(false);
    }
  }

  function reset() {
    generation.current += 1;
    setCreating(false);
    setName(""); setPrice(""); setProduct(null); setQrImage("");
    setMessage("新しい商品名と金額を入力してください。");
  }

  async function saveQrToFiles() {
    if (!canSave) return;

    try {
      const blob = await (await fetch(qrImage)).blob();
      const file = new File([blob], filename, { type: "image/jpeg" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
        setMessage(`「${filename}」の共有が完了しました。`);
        return;
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }

    const link = document.createElement("a");
    link.href = qrImage;
    link.download = filename;
    link.click();
    setMessage(`「${filename}」を保存しました。`);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <img src="/kn-logo.png" alt="KN" className="brand-mark" />
          <div><p>KN PRODUCT MAKER</p><h1>KN商品</h1></div>
        </div>
        <span className="register-badge">KNレジ対応</span>
      </header>

      <div className="workspace">
        <form className="editor-card" onSubmit={createQr}>
          <div className="section-heading"><span>01</span><div><p>DETAILS</p><h2>商品情報を入力</h2></div></div>
          <div className="fields">
            <label>商品名<input value={name} onChange={(event) => setName(event.target.value)} placeholder="例：りんごジュース" maxLength={50} /></label>
            <label>金額（税込）<span className="price-field"><b>¥</b><input value={price}
              onChange={(event) => setPrice(event.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" placeholder="500" /></span></label>
          </div>
          <p className="status" aria-live="polite"><i />{changed ? "商品情報が変更されました。「QRコードを作る」を押してください。" : message}</p>
          <button className="create-button" type="submit" disabled={creating}><span className="mini-qr" />{creating ? "作成中…" : "QRコードを作る"}</button>
        </form>

        <section className={`result-card ${product ? "is-ready" : ""}`} aria-live="polite">
          <div className="result-header"><div><p>02 / QR CODE</p><h2>QRコード</h2></div>{product && <span>{changed ? "再作成が必要" : "完成"}</span>}</div>
          {product && qrImage ? <>
            <article className="qr-output">
              <img className="qr-image" src={qrImage} alt={`${product.name}、${product.price.toLocaleString("ja-JP")}円の商品QRコード`} />
            </article>
            <div className="result-actions">
              <button type="button" className="save-button" onClick={saveQrToFiles} disabled={!canSave}>Appleのファイルに保存</button>
              <button type="button" className="next-button" onClick={reset}>次の商品を作る</button>
            </div>
            <p className="file-save-note">{changed ? "商品情報を反映するには、QRコードを作り直してください。" : `保存ファイル名：${filename}`}<br />Appleでは共有画面から「“ファイル”に保存」を選んでください。</p>
            <button type="button" className="print-button" disabled={!canSave} onClick={() => window.print()}>QRコードを印刷</button>
          </> : <div className="empty-result">
            <div className="empty-qr" aria-hidden="true"><i /><i /><i /></div>
            <h3>QRコードはここに表示されます</h3>
            <p>商品名と金額を入力して<br />「QRコードを作る」を押してください。</p>
          </div>}
        </section>
      </div>
      <footer>KN商品で作ったQRコードは、KNレジのカメラから読み取れます。</footer>
    </main>
  );
}
