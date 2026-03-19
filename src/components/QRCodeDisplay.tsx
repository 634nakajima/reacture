'use client';

import { QRCodeSVG } from 'qrcode.react';

export default function QRCodeDisplay({
  roomId,
  show,
  onToggle,
}: {
  roomId: string;
  show: boolean;
  onToggle: () => void;
}) {
  const joinUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/room/${roomId}`
    : '';

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center" onClick={onToggle}>
      <div className="bg-white rounded-3xl p-8 text-center" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Reacture に参加</h2>
        <p className="text-gray-500 mb-4">QRコードをスキャンするか、コードを入力</p>
        <QRCodeSVG value={joinUrl} size={250} level="M" />
        <p className="mt-4 text-5xl font-mono font-bold tracking-widest text-gray-800">
          {roomId}
        </p>
        <p className="mt-2 text-sm text-gray-400 break-all">{joinUrl}</p>
        <button
          onClick={onToggle}
          className="mt-4 px-6 py-2 bg-gray-200 rounded-lg text-gray-600 hover:bg-gray-300"
        >
          閉じる
        </button>
      </div>
    </div>
  );
}
