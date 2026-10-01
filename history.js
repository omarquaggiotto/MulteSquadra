function renderOnlineHistorySettings() {
 return `<details class="card data-section settings-collapse"><summary><span class="settings-menu-icon" aria-hidden="true">↶</span><span class="settings-menu-label"><strong>Cronologia e backup online</strong><small>Ultime modifiche e copie automatiche</small></span><span class="settings-chevron" aria-hidden="true">⌄</span></summary><div class="data-section-heading"><p>Conserva le ultime 50 modifiche e 30 copie giornaliere. Il ripristino crea prima una copia di sicurezza dello stato corrente.</p></div><div class="data-action-row"><div><strong>Versioni disponibili</strong><div class="small muted">Solo l’Admin può consultare o ripristinare una versione.</div></div><button class="btn secondary" id="openOnlineHistory" type="button">Apri cronologia</button></div></details>`;
}

function historyDate(value) {
 try { return new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',dateStyle:'medium',timeStyle:'short'}).format(new Date(value)); }
 catch { return String(value || ''); }
}

async function openOnlineHistory() {
 if (!requireOnlineAdmin() || !supabaseClient) return;
 openModal('Cronologia e backup online','<div class="history-loading">Caricamento…</div>');
 const {data,error}=await supabaseClient.rpc('list_app_state_history');
 if(error){
  document.querySelector('#modalRoot .modal')?.insertAdjacentHTML('beforeend','<p class="empty">La funzione sarà disponibile dopo l’installazione della nuova migrazione database.</p>');
  document.querySelector('#modalRoot .history-loading')?.remove();
  return;
 }
 const items=Array.isArray(data)?data:[];
 const root=document.querySelector('#modalRoot .history-loading');
 if(!root)return;
 root.outerHTML=`<div class="online-history-list">${items.map(item=>`<article class="online-history-item"><div><small>${item.kind==='daily'?'BACKUP GIORNALIERO':item.kind==='restore_safety'?'COPIA DI SICUREZZA':'MODIFICA'}</small><strong>${escapeHtml(item.summary||'Versione salvata')}</strong><span>${escapeHtml(historyDate(item.createdAt))}</span><span>${Number(item.players)||0} persone · ${Number(item.fines)||0} multe · ${Number(item.paymentMonths)||0} mesi</span></div><button class="btn secondary" type="button" data-restore-history="${Number(item.id)}">Ripristina</button></article>`).join('')||'<p class="empty">La cronologia è vuota. Verrà popolata dalla prossima modifica Admin.</p>'}</div>`;
 document.querySelectorAll('[data-restore-history]').forEach(button=>button.onclick=()=>confirmOnlineHistoryRestore(Number(button.dataset.restoreHistory)));
}

async function confirmOnlineHistoryRestore(id) {
 if(!requireOnlineAdmin() || !Number.isSafeInteger(id))return;
 if(!confirm('Ripristinare questa versione? Prima verrà salvata automaticamente una copia dello stato attuale.'))return;
 const button=document.querySelector(`[data-restore-history="${id}"]`);if(button){button.disabled=true;button.textContent='Ripristino…';}
 const {data,error}=await supabaseClient.rpc('restore_app_state_history',{p_history_id:id});
 if(error){if(button){button.disabled=false;button.textContent='Ripristina';}showToast('Ripristino non riuscito.');return;}
 state=normalizeIncomingState(data);saveLocalState();closeModal();render();showToast('Versione ripristinata. Copia di sicurezza creata.');
}

function bindOnlineHistoryEvents(){document.getElementById('openOnlineHistory')?.addEventListener('click',openOnlineHistory);}
async function ensureOnlineDailyBackup(){if(isAdmin&&navigator.onLine&&supabaseClient)await supabaseClient.rpc('ensure_daily_app_state_backup');}
