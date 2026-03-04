const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzByMLLdHFcDi3tPNQ3tfeNGpoKF0XtDTkj0MLxWrNpjweB-zRbjSG2KxdunwAzADiE/exec'; // <--- 請替換此處
let allIssues = [];
let dataConfig = {};
let userList = []; 
let currentUser = { id: "", name: "", role: "" };
let isMutating = false;

// 初始化
async function handleLogin() {
  const idInput = document.getElementById('login-user').value.trim();
  const pwdInput = document.getElementById('login-pwd').value.trim();
  
  // 先抓取一次基礎數據（含使用者清單）
  if (userList.length === 0) await fetchBaseData();

  const user = userList.find(u => u.id === idInput && u.pwd === pwdInput);
  
  if (user) {
    currentUser = { 
      id: user.id, 
      name: user.name, 
      role: (user.id === "G0006" ? "MANAGER" : "USER") 
    };
    
    document.getElementById('current-username').innerText = currentUser.name;
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('main-ui').style.display = 'block';
    
    if (currentUser.role === "MANAGER") {
      document.getElementById('btn-tab-main').style.display = 'block';
      document.getElementById('btn-tab-manager').style.display = 'block';
    }
    
    init();
  } else {
    alert("驗證錯誤：識別碼或密碼不存在於資料庫。");
  }
}

async function fetchBaseData() {
  const resp = await fetch(SCRIPT_URL + '?action=getData');
  const data = await resp.json();
  allIssues = data.issues || [];
  dataConfig = data.config || {};
  userList = data.users || [];
}

async function init() {
  await fetchBaseData();
  fillCheckboxes('items-owner', 'owners', 'renderIssues()');
  fillCheckboxes('items-status', 'statusList', 'renderIssues()');
  
  fillFormSelect('input-owner', 'owners');
  fillFormSelect('input-status', 'statusList');
  fillFormSelect('input-customer', 'customers');
  fillFormSelect('input-product', 'products'); // D欄
  fillFormSelect('input-project', 'projects'); // E欄

  renderIssues();
  renderManagerIssues();
  renderStats();
}

function switchTab(tabId) {
  document.querySelectorAll('.tab-section').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById(tabId).style.display = 'block';
  document.getElementById('btn-' + tabId).classList.add('active');
}

function fillFormSelect(id, listKey) {
  const el = document.getElementById(id);
  if(el && dataConfig[listKey]) {
    el.innerHTML = '<option value="" disabled selected>請選擇...</option>' + 
      dataConfig[listKey].map(t => `<option value="${t}">${t}</option>`).join('');
  }
}

function fillCheckboxes(id, listKey, onChangeCode) {
  const el = document.getElementById(id);
  if(el && dataConfig[listKey]) {
    el.innerHTML = dataConfig[listKey].map(t => 
      `<label class="checkbox-label" onclick="event.stopPropagation()">
        <input type="checkbox" value="${t}" onchange="${onChangeCode}"> ${t}
      </label>`).join('');
  }
}

function toggleDropdown(id, event) {
  event.stopPropagation();
  const el = document.getElementById(id);
  const isShown = el.style.display === 'block';
  document.querySelectorAll('.select-items').forEach(d => d.style.display = 'none');
  el.style.display = isShown ? 'none' : 'block';
}

// 渲染邏輯
function renderIssues() {
  const container = document.getElementById('issue-display');
  const search = document.getElementById('search-input').value.toLowerCase();
  
  let filtered = allIssues.filter(i => 
    (!i.id || !i.id.startsWith('MGR-')) &&
    String(i.issue).toLowerCase().includes(search)
  );

  container.innerHTML = filtered.map(i => `
    <div class="pebble" onclick="openEdit('${i.id}')">
      <div style="font-size:11px; color:var(--pixel-green); margin-bottom:5px;">[ ${i.status} ]</div>
      <div style="font-size:18px; margin-bottom:10px;">${i.issue}</div>
      <div style="font-size:12px; opacity:0.7;">
        負責: ${i.owner} | 客戶: ${i.customer}<br>
        產品: ${i.product} | 登錄者: ${i.creator}
      </div>
    </div>
  `).join('');
}

// 開啟 Modal
function openModal(type = 'TS') {
  document.getElementById('issueForm').reset();
  document.getElementById('edit-id').value = "";
  document.getElementById('input-creator').value = currentUser.name;
  document.getElementById('modal-overlay').style.display = 'flex';
  document.getElementById('btn-delete').style.display = 'none';
  window.currentType = type;
}

function openEdit(id) {
  const i = allIssues.find(x => x.id === id);
  if(!i) return;
  openModal(id.startsWith('MGR-') ? 'MGR' : 'TS');
  document.getElementById('edit-id').value = i.id;
  document.getElementById('input-issue').value = i.issue;
  document.getElementById('input-owner').value = i.owner;
  document.getElementById('input-status').value = i.status;
  document.getElementById('input-customer').value = i.customer;
  document.getElementById('input-product').value = i.product;
  document.getElementById('input-project').value = i.project;
  document.getElementById('input-deadline').value = i.deadline;
  document.getElementById('input-description').value = i.description;
  document.getElementById('input-records').value = i.records;
  document.getElementById('input-creator').value = i.creator || '系統記錄';
  document.getElementById('btn-delete').style.display = 'block';
}

function closeModal() { document.getElementById('modal-overlay').style.display = 'none'; }

// 提交資料
async function submitIssue() {
  const btn = document.getElementById('submit-btn');
  btn.innerText = "同步中..."; btn.disabled = true;
  
  const isEdit = document.getElementById('edit-id').value !== "";
  const issueId = document.getElementById('edit-id').value || (window.currentType === 'MGR' ? 'MGR-' : 'TS-') + Date.now();
  
  const payload = {
    action: isEdit ? "edit" : "add",
    id: issueId,
    issue: document.getElementById('input-issue').value,
    owner: document.getElementById('input-owner').value,
    status: document.getElementById('input-status').value,
    customer: document.getElementById('input-customer').value,
    product: document.getElementById('input-product').value,
    project: document.getElementById('input-project').value,
    deadline: document.getElementById('input-deadline').value,
    description: document.getElementById('input-description').value,
    records: document.getElementById('input-records').value,
    creator: document.getElementById('input-creator').value,
    date: new Date().toLocaleDateString()
  };

  try {
    await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(payload) });
    alert("數據同步成功");
    location.reload(); 
  } catch (e) {
    alert("同步失敗，請檢查網路");
  }
}
