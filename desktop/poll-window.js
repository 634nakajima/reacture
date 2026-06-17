const badgeEl = document.getElementById('badge');
const questionEl = document.getElementById('question');
const optionsEl = document.getElementById('options');
const totalVotesEl = document.getElementById('totalVotes');
const endBtn = document.getElementById('endBtn');

let currentPollId = null;

function renderPoll(data, showResults) {
  questionEl.textContent = data.question;
  const totalVotes = data.options.reduce((sum, o) => sum + o.votes, 0);

  optionsEl.innerHTML = '';
  data.options.forEach((opt) => {
    const pct = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
    const div = document.createElement('div');
    div.className = 'option';
    div.innerHTML = `
      <div class="option-header">
        <span class="option-text">${escapeHtml(opt.text)}</span>
        ${showResults ? `<span class="option-votes">${opt.votes}票 (${pct}%)</span>` : ''}
      </div>
      ${showResults ? `
      <div class="option-bar-bg">
        <div class="option-bar" style="width: ${pct}%"></div>
      </div>` : ''}
    `;
    optionsEl.appendChild(div);
  });

  if (showResults) {
    totalVotesEl.textContent = `合計 ${totalVotes} 票`;
  } else {
    totalVotesEl.textContent = '';
  }
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// アンケート開始
window.electronAPI.onPollStarted((data) => {
  currentPollId = data.id;
  badgeEl.textContent = '投票受付中';
  badgeEl.className = 'badge voting';
  endBtn.classList.remove('hidden');
  renderPoll(data, false);
});

// アンケート更新（投票が入った）
window.electronAPI.onPollUpdated((data) => {
  renderPoll(data, false);
});

// アンケート終了 → 結果表示
window.electronAPI.onPollEnded((data) => {
  currentPollId = null;
  badgeEl.textContent = '結果';
  badgeEl.className = 'badge ended';
  endBtn.classList.add('hidden');
  renderPoll(data, true);
});

endBtn.addEventListener('click', () => {
  if (currentPollId) {
    window.electronAPI.sendPollEnd(currentPollId);
  }
});
