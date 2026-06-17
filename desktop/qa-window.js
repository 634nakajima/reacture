let questions = [];

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function render(highlightId) {
  const listEl = document.getElementById('questionList');
  const emptyEl = document.getElementById('emptyState');
  const countEl = document.getElementById('headerCount');

  const unresolvedCount = questions.filter(q => !q.resolved).length;
  const totalCount = questions.length;

  if (totalCount === 0) {
    listEl.style.display = 'none';
    emptyEl.style.display = 'flex';
    countEl.textContent = '';
    return;
  }

  listEl.style.display = 'block';
  emptyEl.style.display = 'none';

  if (unresolvedCount > 0) {
    countEl.innerHTML = `<span class="active">${unresolvedCount}件</span>` +
      (totalCount > unresolvedCount ? ` / ${totalCount}件` : '');
  } else {
    countEl.textContent = `${totalCount}件（すべて回答済み）`;
  }

  // ソート: 未回答→回答済み、いいね数降順
  const sorted = [...questions].sort((a, b) => {
    if (a.resolved !== b.resolved) return a.resolved ? 1 : -1;
    return b.votes - a.votes;
  });

  listEl.innerHTML = '';
  sorted.forEach(q => {
    const item = document.createElement('div');
    item.className = 'question-item' + (q.resolved ? ' resolved' : '') + (q.id === highlightId ? ' new-highlight' : '');
    item.innerHTML = `
      <div class="vote-section">
        <span class="vote-emoji">👍</span>
        <span class="vote-count">${q.votes}</span>
      </div>
      <div class="question-text${q.resolved ? ' resolved-text' : ''}">${escapeHtml(q.text)}</div>
      <div class="question-actions">
        <button class="action-btn resolve-btn${q.resolved ? ' resolved' : ''}" data-id="${q.id}">
          ${q.resolved ? '✓ 済' : '回答済み'}
        </button>
        <button class="delete-btn" data-id="${q.id}"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM8 9h8v10H8V9zm7.5-5l-1-1h-5l-1 1H5v2h14V4h-3.5z"/></svg></button>
      </div>
    `;
    listEl.appendChild(item);
  });

  // イベントリスナー
  listEl.querySelectorAll('.resolve-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      window.electronAPI.sendQAResolve(btn.dataset.id);
    });
  });
  listEl.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      window.electronAPI.sendQADelete(btn.dataset.id);
    });
  });
}

// 既存質問リスト
window.electronAPI.onQAList((list) => {
  questions = list;
  render();
});

// 新着質問
window.electronAPI.onQANew((q) => {
  questions.push(q);
  render(q.id);
});

// いいね更新
window.electronAPI.onQAUpdated((data) => {
  const q = questions.find(q => q.id === data.questionId);
  if (q) q.votes = data.votes;
  render();
});

// 回答済み
window.electronAPI.onQAResolved((data) => {
  const q = questions.find(q => q.id === data.questionId);
  if (q) q.resolved = data.resolved;
  render();
});

// 削除
window.electronAPI.onQADeleted((data) => {
  questions = questions.filter(q => q.id !== data.questionId);
  render();
});

render();
