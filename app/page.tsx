"use client";

import QRCode from "qrcode";
import { FormEvent, useRef, useState } from "react";

type ProductCode = { code: string; name: string; manufacturer: string; productName: string; model: string; price: number };

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

  function drawDetail(label: string, centerY: number) {
    let fontSize = 87;
    let lines: string[] = [];
    while (fontSize >= 12) {
      context!.font = `800 ${fontSize}px sans-serif`;
      lines = wrapLabel(context!, label, 400);
      if (lines.length * fontSize * 1.16 <= 130) break;
      fontSize -= 3;
    }
    const lineHeight = fontSize * 1.16;
    const firstLineY = centerY - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((line, index) => context!.fillText(line, 960, firstLineY + index * lineHeight));
  }
  const details = [product.manufacturer, product.productName, product.model].filter(Boolean);
  const positions = details.length === 1 ? [275] : details.length === 2 ? [195, 365] : [120, 275, 425];
  details.forEach((detail, index) => drawDetail(detail, positions[index]));

  context.font = "800 108px sans-serif";
  context.fillText(`¥${product.price.toLocaleString("ja-JP")}`, 960, 590);

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
  const [manufacturer, setManufacturer] = useState("");
  const [productName, setProductName] = useState("");
  const [model, setModel] = useState("");
  const [price, setPrice] = useState("");
  const [product, setProduct] = useState<ProductCode | null>(null);
  const [qrImage, setQrImage] = useState("");
  const [message, setMessage] = useState("メーカー名・商品名・品番・金額を入力してください。");
  const [creating, setCreating] = useState(false);
  const generation = useRef(0);
  const changed = !!product && (manufacturer.trim() !== product.manufacturer || productName.trim() !== product.productName || model.trim() !== product.model || price === "" || Number(price) !== product.price);
  const canSave = !!product && !!qrImage && !changed && !creating;
  const filename = `${(product?.name || "KN商品").replace(/[\\/:*?"<>|]/g, "_").trim()}.jpg`;

  async function createQr(event: FormEvent) {
    event.preventDefault();
    const cleanManufacturer = manufacturer.trim();
    const cleanProductName = productName.trim();
    const cleanModel = model.trim();
    const numericPrice = Math.round(Number(price));
    const displayName = [cleanManufacturer, cleanProductName, cleanModel].filter(Boolean).join(" ");
    if (!displayName || price === "" || !Number.isFinite(numericPrice) || numericPrice < 0) {
      setMessage("メーカー名・商品名・品番のいずれかと、0円以上の金額を入力してください。");
      return;
    }
    // KNレジで表示するnameにも商品情報をまとめて渡す。
    const nextProduct = { code: makeProductCode(), name: displayName, manufacturer: cleanManufacturer, productName: cleanProductName, model: cleanModel, price: numericPrice };
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
    setManufacturer(""); setProductName(""); setModel(""); setPrice(""); setProduct(null); setQrImage("");
    setMessage("新しいメーカー名・商品名・品番・金額を入力してください。");
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
            <p className="file-save-note">メーカー名・商品名・品番は、わかる項目だけ入力してください。</p>
            <label>メーカー名<input value={manufacturer} onChange={(event) => setManufacturer(event.target.value)} placeholder="例：パナソニック" maxLength={50} /></label>
            <label>商品名<input value={productName} onChange={(event) => setProductName(event.target.value)} placeholder="例：照明器具" maxLength={50} /></label>
            <label>品番<input value={model} onChange={(event) => setModel(event.target.value)} placeholder="例：ABC-123" maxLength={50} /></label>
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
            <p>メーカー名・商品名・品番・金額を入力して<br />「QRコードを作る」を押してください。</p>
          </div>}
        </section>
      </div>
      <footer>KN商品で作ったQRコードは、KNレジのカメラから読み取れます。</footer>
    </main>
  );
}
