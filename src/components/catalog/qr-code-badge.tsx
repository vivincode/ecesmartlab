"use client";

import React, { useEffect, useState } from "react";
import QRCode from "qrcode";

export function QrCodeBadge({
  value,
  label,
  size = 112,
}: {
  value: string;
  label?: string;
  size?: number;
}) {
  const [dataUrl, setDataUrl] = useState<string>("");

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      color: { dark: "#0f172a", light: "#ffffff" },
    })
      .then((url) => {
        if (active) setDataUrl(url);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [value, size]);

  if (!dataUrl) {
    return (
      <div
        style={{ width: size, height: size }}
        className="flex items-center justify-center border-2 border-slate-900 bg-slate-100 font-mono text-[9px] text-slate-500"
      >
        QR...
      </div>
    );
  }

  return (
    <div className="inline-flex flex-col items-center border-2 border-slate-900 bg-white p-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={dataUrl} alt={`QR code for ${value}`} width={size} height={size} />
      {label && (
        <span className="mt-1 font-mono text-[9px] font-black tracking-wider text-slate-900 uppercase">
          {label}
        </span>
      )}
    </div>
  );
}
