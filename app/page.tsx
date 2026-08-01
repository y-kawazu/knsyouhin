"use client";

import QRCode from "qrcode";
import { ChangeEvent, FormEvent, useRef, useState } from "react";

type ProductCode = { code: string; name: string; price: number };

function yen(value: number) {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency", currency: "JPY", maximumFractionDigits: 0,
  }).format(value);
}

function makeProductCode() {
  const now = new Date();
  const digits = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"), String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"), String(now.getSeconds()).padStart(2, "0")].join("");
  return `KN${digits}${Math.floor(Math.random() * 90 + 10)}`;
}

function resizePhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("image failed"));
      image.onload = () => {
        const scale = Math.min(1, 1400 / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.86));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export default function Home() {
  const [photo, setPhoto] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [product, setProduct] = useState<ProductCode | null>(null);
  const [qrImage, setQrImage] = useState("");
  const [message, setMessage] = useState("写真を撮って、商品情報を入力してください。");
  const fileInput = useRef<HTMLInputElement>(null);

  async function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return setMessage("画像ファイルを選んでください。");
    try {
      setPhoto(await resizePhoto(file));
      setMessage("写真をセットしました。商品名と金額を入力してください。");
    } catch {
      setMessage("写真を読み込めませんでした。もう一度お試しください。");
    }
  }

  async function createQr(event: FormEvent) {
    event.preventDefault();
    const cleanName = name.trim();
    const numericPrice = Math.round(Number(price));
    if (!photo) {
      setMessage("最初に商品の写真を撮ってください。");
      fileInput.current?.click();
      return;
    }
    if (!cleanName || price === "" || !Number.isFinite(numericPrice) || numericPrice < 0) {
      setMessage("商品名と0円以上の金額を入力してください。");
      return;
    }
    const nextProduct = { code: makeProductCode(), name: cleanName, price: numericPrice };
    const dataUrl = await QRCode.toDataURL(JSON.stringify(nextProduct), {
      width: 720, margin: 2, errorCorrectionLevel: "M",
      color: { dark: "#0c382f", light: "#ffffff" },
    });
    setProduct(nextProduct);
    setQrImage(dataUrl);
    setMessage("KNレジ用QRコードができました。");
  }

  function reset() {
    setPhoto(""); setName(""); setPrice(""); setProduct(null); setQrImage("");
    setMessage("新しい商品の写真を撮ってください。");
    if (fileInput.current) fileInput.current.value = "";
  }

  function downloadQr() {
    if (!qrImage || !product) return;
    const link = document.createElement("a");
    link.href = qrImage;
    link.download = `KN商品_${product.name}_${product.price}円.png`;
    link.click();
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
          <div className="section-heading"><span>01</span><div><p>PHOTO</p><h2>商品を撮影</h2></div></div>
          <input ref={fileInput} className="visually-hidden" id="product-photo" type="file"
            accept="image/*" capture="environment" onChange={handlePhoto} />
          <button className={`photo-picker ${photo ? "has-photo" : ""}`} type="button" onClick={() => fileInput.current?.click()}>
            {photo ? <><img src={photo} alt="撮影した商品" /><span>写真を撮り直す</span></> :
              <><span className="camera-icon" aria-hidden="true" /><strong>カメラで商品を撮る</strong><small>または写真を選択</small></>}
          </button>

          <div className="section-heading form-heading"><span>02</span><div><p>DETAILS</p><h2>商品情報を入力</h2></div></div>
          <div className="fields">
            <label>商品名<input value={name} onChange={(event) => setName(event.target.value)} placeholder="例：りんごジュース" maxLength={50} /></label>
            <label>金額（税込）<span className="price-field"><b>¥</b><input value={price}
              onChange={(event) => setPrice(event.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" placeholder="500" /></span></label>
          </div>
          <p className="status" aria-live="polite"><i />{message}</p>
          <button className="create-button" type="submit"><span className="mini-qr" />QRコードを作る</button>
        </form>

        <section className={`result-card ${product ? "is-ready" : ""}`} aria-live="polite">
          <div className="result-header"><div><p>03 / QR CODE</p><h2>商品ラベル</h2></div>{product && <span>完成</span>}</div>
          {product && qrImage ? <>
            <article className="product-label">
              <div className="label-photo"><img src={photo} alt={product.name} /><img className="label-logo" src="/kn-logo.png" alt="KN" /></div>
              <div className="label-copy">
                <div><small>KN PRODUCT</small><h3>{product.name}</h3><strong>{yen(product.price)}</strong></div>
                <img className="qr-image" src={qrImage} alt={`${product.name}のQRコード`} />
              </div>
              <p className="product-code">{product.code}</p>
            </article>
            <div className="result-actions">
              <button type="button" className="save-button" onClick={downloadQr}>QR画像を保存</button>
              <button type="button" className="print-button" onClick={() => window.print()}>ラベルを印刷</button>
            </div>
            <button type="button" className="reset-button" onClick={reset}>次の商品を作る</button>
          </> : <div className="empty-result">
            <div className="empty-qr" aria-hidden="true"><i /><i /><i /></div>
            <h3>QRコードはここに表示されます</h3>
            <p>写真・商品名・金額を入力して<br />「QRコードを作る」を押してください。</p>
          </div>}
        </section>
      </div>
      <footer>KN商品で作ったQRコードは、KNレジのカメラから読み取れます。</footer>
    </main>
  );
}
