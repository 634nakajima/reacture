window.electronAPI.onQRData((data) => {
  document.getElementById('qrImage').src = data.qrDataUrl;
  document.getElementById('roomCode').textContent = data.roomId;
  document.getElementById('joinUrl').textContent = data.joinUrl;
});
