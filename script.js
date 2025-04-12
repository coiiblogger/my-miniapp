// Lấy thông số API và Sheet ID từ URL
const urlParams = new URLSearchParams(window.location.search);
const apiUrl = urlParams.get('api');
const sheetId = urlParams.get('sheetId');
const proxyUrl = 'https://miniapphmh.netlify.app/.netlify/functions/proxy?url=';

if (!apiUrl || !sheetId) {
  showToast("Thiếu thông tin API hoặc Sheet ID. Vui lòng kiểm tra lại URL!", "error");
}

if (!apiUrl || !sheetId) {
  showToast("Thiếu thông tin API hoặc Sheet ID. Vui lòng kiểm tra lại URL!", "error");
}

// Biến toàn cục
let cachedFinancialData = null;
let cachedChartData = null;
let cachedTransactions = null;
let currentPage = 1;
const transactionsPerPage = 10;
let cachedMonthlyExpenses = null;
let currentPageMonthly = 1;
const expensesPerPage = 10;
let cachedSearchResults = null;
let currentPageSearch = 1;
const searchPerPage = 10;

// Hàm hiển thị Toast
function showToast(message, type = "info") {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add('show'), 100);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function showModalError(modalId, message) {
  const errorDiv = document.getElementById(`${modalId}Error`);
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(() => errorDiv.style.display = 'none', 5000);
  }
}

function showLoading(show, tabId) {
  const loadingElement = document.getElementById(`loading${tabId.charAt(0).toUpperCase() + tabId.slice(1)}`);
  if (loadingElement) loadingElement.style.display = show ? 'block' : 'none';
}

function formatDate(dateStr) {
  const parts = dateStr.split('/');
  if (parts.length !== 3) return dateStr;
  const [day, month, year] = parts;
  return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
}

function formatDateToYYYYMMDD(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateToDDMM(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}

// Mở tab
window.openTab = function(tabId) {
  const tabs = document.querySelectorAll('.nav-item');
  const contents = document.querySelectorAll('.tab-content');
  tabs.forEach(tab => tab.classList.remove('active'));
  contents.forEach(content => content.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  document.querySelector(`.nav-item[data-tab="${tabId}"]`).classList.add('active');
};

// Tab 1: Giao dịch
window.fetchTransactions = async function() {
  const transactionDate = document.getElementById('transactionDate').value;
  if (!transactionDate) return showToast("Vui lòng chọn ngày để xem giao dịch!", "warning");
  const dateForApi = transactionDate;
  const [year, month, day] = transactionDate.split('-');
  const formattedDateForDisplay = `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
  const cacheKey = `${formattedDateForDisplay}`;

  if (cachedTransactions && cachedTransactions.cacheKey === cacheKey) {
    displayTransactions(cachedTransactions.data);
    return;
  }

  showLoading(true, 'tab1');
  try {
    const targetUrl = `${apiUrl}?action=getTransactionsByDate&date=${encodeURIComponent(dateForApi)}&sheetId=${sheetId}`;
    const finalUrl = proxyUrl + encodeURIComponent(targetUrl);
    const response = await fetch(finalUrl);
    const transactionData = await response.json();
    if (transactionData.error) throw new Error(transactionData.error);
    cachedTransactions = { cacheKey, data: transactionData };
    displayTransactions(transactionData);
  } catch (error) {
    showToast("Lỗi khi lấy dữ liệu giao dịch: " + error.message, "error");
    displayTransactions({ error: true });
  } finally {
    showLoading(false, 'tab1');
  }
};

function displayTransactions(data) {
  const container = document.getElementById('transactionsContainer');
  const summaryContainer = document.getElementById('dailySummary'); // Sửa từ transactionSummary thành dailySummary
  const pageInfo = document.getElementById('pageInfo');
  const prevPageBtn = document.getElementById('prevPage');
  const nextPageBtn = document.getElementById('nextPage');
  container.innerHTML = '';

  // Kiểm tra dữ liệu và hiển thị thống kê
  if (!data || data.error || !Array.isArray(data) || data.length === 0) {
    container.innerHTML = '<div>Không có giao dịch nào trong ngày này</div>';
    summaryContainer.innerHTML = `
      <div class="stat-box income"><div class="title">Tổng thu nhập</div><div class="amount no-data">Không có<br>dữ liệu</div></div>
      <div class="stat-box expense"><div class="title">Tổng chi tiêu</div><div class="amount no-data">Không có<br>dữ liệu</div></div>
      <div class="stat-box balance"><div class="title">Số dư</div><div class="amount no-data">Không có<br>dữ liệu</div></div>
    `;
    pageInfo.textContent = '';
    prevPageBtn.disabled = true;
    nextPageBtn.disabled = true;
    return;
  }

  // Tính toán tổng thu nhập, tổng chi tiêu, số dư
  let totalIncome = 0, totalExpense = 0;
  data.forEach(item => {
    if (item.type === 'Thu nhập') totalIncome += item.amount;
    else if (item.type === 'Chi tiêu') totalExpense += item.amount;
  });
  const balance = totalIncome - totalExpense;

  // Cập nhật thống kê
  summaryContainer.innerHTML = `
    <div class="stat-box income"><div class="title">Tổng thu nhập</div><div class="amount">${totalIncome.toLocaleString('vi-VN')}đ</div></div>
    <div class="stat-box expense"><div class="title">Tổng chi tiêu</div><div class="amount">${totalExpense.toLocaleString('vi-VN')}đ</div></div>
    <div class="stat-box balance"><div class="title">Số dư</div><div class="amount">${balance.toLocaleString('vi-VN')}đ</div></div>
  `;

  // Hiển thị danh sách giao dịch
  const totalPages = Math.ceil(data.length / transactionsPerPage);
  const startIndex = (currentPage - 1) * transactionsPerPage;
  const endIndex = startIndex + transactionsPerPage;
  const paginatedData = data.slice(startIndex, endIndex);

  paginatedData.forEach((item, index) => {
    const transactionBox = document.createElement('div');
    transactionBox.className = 'transaction-box';
    const amountColor = item.type === 'Thu nhập' ? '#10B981' : '#EF4444';
    const typeClass = item.type === 'Thu nhập' ? 'income' : 'expense';
    const transactionNumber = startIndex + index + 1;
    transactionBox.innerHTML = `
      <div style="display: flex; justify-content: space-between; width: 100%;">
        <div style="flex: 1;">
          <div class="date">${formatDate(item.date)}</div>
          <div class="amount" style="color: ${amountColor}">${item.amount.toLocaleString('vi-VN')}đ</div>
          <div class="content">Nội dung: ${item.content}${item.note ? ` (${item.note})` : ''}</div>
          <div class="number">STT của giao dịch: ${transactionNumber}</div>
          <div class="id">ID của giao dịch: ${item.id}</div>
        </div>
        <div style="flex: 1; text-align: right;">
          <div class="type ${typeClass}">Phân loại: ${item.type}</div>
          <div class="category">Phân loại chi tiết: ${item.category}</div>
        </div>
      </div>
      <div style="margin-top: 0.5rem;">
        <button class="edit-btn" data-id="${item.id}" style="background: #FFA500; color: white; padding: 0.3rem 0.8rem; border-radius: 8px;">Sửa</button>
        <button class="delete-btn" data-id="${item.id}" style="background: #EF4444; color: white; padding: 0.3rem 0.8rem; border-radius: 8px; margin-left: 0.5rem;">Xóa</button>
      </div>
    `;
    container.appendChild(transactionBox);
  });

  pageInfo.textContent = `Trang ${currentPage} / ${totalPages}`;
  prevPageBtn.disabled = currentPage === 1;
  nextPageBtn.disabled = currentPage === totalPages;

  document.querySelectorAll('.edit-btn').forEach(button => {
    const transactionId = button.getAttribute('data-id');
    const transaction = data.find(item => String(item.id) === String(transactionId));
    if (!transaction) return console.error(`Không tìm thấy giao dịch với ID: ${transactionId}`);
    button.addEventListener('click', () => openEditForm(transaction));
  });

  document.querySelectorAll('.delete-btn').forEach(button => {
    button.addEventListener('click', () => deleteTransaction(button.getAttribute('data-id')));
  });
}

async function fetchCategories() {
  try {
    const targetUrl = `${apiUrl}?action=getCategories&sheetId=${sheetId}`;
    const finalUrl = proxyUrl + encodeURIComponent(targetUrl);
    const response = await fetch(finalUrl);
    const categoriesData = await response.json();
    if (categoriesData.error) throw new Error(categoriesData.error);
    return categoriesData;
  } catch (error) {
    showToast("Lỗi khi lấy danh sách phân loại: " + error.message, "error");
    return [];
  }
}

async function openEditForm(transaction) {
  if (!transaction) return showToast('Dữ liệu giao dịch không hợp lệ!', "error");
  const modal = document.getElementById('editModal');
  const form = document.getElementById('editForm');
  const categorySelect = document.getElementById('editCategory');
  const amountInput = document.getElementById('editAmount');

  document.getElementById('editTransactionId').value = transaction.id || '';
  document.getElementById('editContent').value = transaction.content || '';
  amountInput.value = formatNumberWithCommas(transaction.amount.toString());
  document.getElementById('editType').value = transaction.type || 'Thu nhập';
  document.getElementById('editNote').value = transaction.note || '';

  // Chuyển đổi định dạng ngày từ DD/MM/YYYY sang YYYY-MM-DD để hiển thị trong date picker
  let dateValue = '';
  if (transaction.date && transaction.date.includes('/')) {
    const [day, month, year] = transaction.date.split('/');
    dateValue = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  document.getElementById('editDate').value = dateValue;

  const categories = await fetchCategories();
  categorySelect.innerHTML = '';
  categories.forEach(category => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    if (category === transaction.category) option.selected = true;
    categorySelect.appendChild(option);
  });

  // Xử lý định dạng số tiền khi nhập
  amountInput.addEventListener('input', function() {
    const cursorPosition = this.selectionStart;
    const oldLength = this.value.length;
    this.value = formatNumberWithCommas(this.value);
    const newLength = this.value.length;
    // Điều chỉnh vị trí con trỏ
    this.selectionStart = this.selectionEnd = cursorPosition + (newLength - oldLength);
  });

  // Ngăn nhập ký tự không phải số
  amountInput.addEventListener('keypress', function(e) {
    if (!/[0-9]/.test(e.key)) {
      e.preventDefault();
    }
  });

  modal.style.display = 'flex';
  form.onsubmit = async function(e) {
    e.preventDefault();
    const dateInput = document.getElementById('editDate').value; // Dạng YYYY-MM-DD
    if (!dateInput) return showModalError('edit', 'Vui lòng chọn ngày!');
    const inputDate = new Date(dateInput);
    const today = new Date();
    if (inputDate > today) return showModalError('edit', 'Không thể chọn ngày trong tương lai!');
    const amount = parseNumber(document.getElementById('editAmount').value);
    if (amount <= 0) return showModalError('edit', 'Số tiền phải lớn hơn 0!');
    // Chuyển đổi định dạng ngày từ YYYY-MM-DD sang DD/MM/YYYY để gửi API
    const [year, month, day] = dateInput.split('-');
    const formattedDate = `${day}/${month}/${year}`;
    const updatedTransaction = {
      id: document.getElementById('editTransactionId').value,
      content: document.getElementById('editContent').value,
      amount: amount,
      type: document.getElementById('editType').value,
      category: document.getElementById('editCategory').value,
      note: document.getElementById('editNote').value || '',
      date: formattedDate,
      action: 'updateTransaction'
    };
    await saveTransaction(updatedTransaction);
  };
}

async function openAddForm() {
  const modal = document.getElementById('addModal');
  const form = document.getElementById('addForm');
  const categorySelect = document.getElementById('addCategory');
  const currentYear = new Date().getFullYear();

  // Điền ngày hiện tại dạng YYYY-MM-DD
  document.getElementById('addDate').value = formatDateToYYYYMMDD(new Date());
  document.getElementById('addContent').value = '';
  document.getElementById('addAmount').value = '';
  document.getElementById('addType').value = 'Thu nhập';
  document.getElementById('addNote').value = '';

  const categories = await fetchCategories();
  categorySelect.innerHTML = '';
  categories.forEach(category => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    categorySelect.appendChild(option);
  });

  modal.style.display = 'flex';
  form.onsubmit = async function(e) {
    e.preventDefault();
    const dateInput = document.getElementById('addDate').value; // Dạng YYYY-MM-DD
    const [year, month, day] = dateInput.split('-');
    const formattedDate = `${day}/${month}/${year}`; // Chuyển thành DD/MM/YYYY
    const today = new Date();
    const inputDate = new Date(year, month - 1, day);
    if (inputDate > today) return showModalError('add', 'Không thể chọn ngày trong tương lai!');
    const amount = parseFloat(document.getElementById('addAmount').value);
    if (amount <= 0) return showModalError('add', 'Số tiền phải lớn hơn 0!');
    const newTransaction = {
      content: document.getElementById('addContent').value,
      amount: amount,
      type: document.getElementById('addType').value,
      category: document.getElementById('addCategory').value,
      note: document.getElementById('addNote').value || '',
      date: formattedDate, // Gửi dạng DD/MM/YYYY
      action: 'addTransaction'
    };
    await addTransaction(newTransaction);
  };
}

function closeEditForm() { document.getElementById('editModal').style.display = 'none'; }
function closeAddForm() { document.getElementById('addModal').style.display = 'none'; }

async function saveTransaction(updatedTransaction) {
  // Xác định tab hiện tại
  const activeTab = document.querySelector('.tab-content.active').id;
  let loadingTabId = '';
  
  if (activeTab === 'tab1') {
    loadingTabId = 'tab1';
  } else if (activeTab === 'tab5') {
    loadingTabId = 'tab5';
  } else if (activeTab === 'tab6') {
    loadingTabId = 'tab6';
  }

  showLoading(true, loadingTabId);
  try {
    const finalUrl = proxyUrl + encodeURIComponent(apiUrl);
    const response = await fetch(finalUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedTransaction)
    });
    const result = await response.json();
    if (result.error) throw new Error(result.error);
    showToast("Cập nhật giao dịch thành công!", "success");
    closeEditForm();

    // Cập nhật lại dữ liệu dựa trên tab hiện tại
    if (activeTab === 'tab1') {
      window.fetchTransactions();
    } else if (activeTab === 'tab5') {
      window.fetchMonthlyExpenses();
    } else if (activeTab === 'tab6') {
      window.searchTransactions();
    }
  } catch (error) {
    showToast("Lỗi khi cập nhật giao dịch: " + error.message, "error");
  } finally {
    showLoading(false, loadingTabId);
  }
}
async function addTransaction(newTransaction) {
  showLoading(true, 'tab1');
  try {
    const finalUrl = proxyUrl + encodeURIComponent(apiUrl);
    const response = await fetch(finalUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTransaction)
    });
    const result = await response.json();
    if (result.error) throw new Error(result.error);
    showToast("Thêm giao dịch thành công!", "success");
    closeAddForm();
    window.fetchTransactions();
  } catch (error) {
    showToast("Lỗi khi thêm giao dịch: " + error.message, "error");
  } finally {
    showLoading(false, 'tab1');
  }
}

async function deleteTransaction(transactionId) {
  if (!confirm("Bạn có chắc chắn muốn xóa giao dịch này?")) return;

  // Xác định tab hiện tại
  const activeTab = document.querySelector('.tab-content.active').id;
  let cacheData = null;
  let loadingTabId = '';

  if (activeTab === 'tab1') {
    cacheData = cachedTransactions;
    loadingTabId = 'tab1';
  } else if (activeTab === 'tab5') {
    cacheData = cachedMonthlyExpenses;
    loadingTabId = 'tab5';
  } else if (activeTab === 'tab6') {
    cacheData = cachedSearchResults;
    loadingTabId = 'tab6';
  }

  if (!cacheData) {
    showToast("Không tìm thấy dữ liệu giao dịch!", "error");
    return;
  }

  showLoading(true, loadingTabId);
  try {
    const transaction = cacheData.data ? cacheData.data.find(item => String(item.id) === String(transactionId)) : 
                       cacheData.transactions ? cacheData.transactions.find(item => String(item.id) === String(transactionId)) : null;
    if (!transaction) throw new Error("Không tìm thấy giao dịch để xóa!");

    // Trích xuất tháng từ transaction.date (định dạng: DD/MM/YYYY)
    const dateParts = transaction.date.split('/');
    if (dateParts.length !== 3) throw new Error("Định dạng ngày không hợp lệ!");
    const transactionMonth = dateParts[1]; // Lấy phần tháng (VD: "04")

    const finalUrl = proxyUrl + encodeURIComponent(apiUrl);
    const response = await fetch(finalUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        action: 'deleteTransaction', 
        id: transactionId, 
        month: transactionMonth
      })
    });
    const result = await response.json();
    if (result.error) throw new Error(result.error);
    showToast("Xóa giao dịch thành công!", "success");

    // Cập nhật lại dữ liệu dựa trên tab hiện tại
    if (activeTab === 'tab1') {
      window.fetchTransactions();
    } else if (activeTab === 'tab5') {
      window.fetchMonthlyExpenses();
    } else if (activeTab === 'tab6') {
      window.searchTransactions();
    }
  } catch (error) {
    showToast("Lỗi khi xóa giao dịch: " + error.message, "error");
  } finally {
    showLoading(false, loadingTabId);
  }
}

// Tab 2: Thống kê
window.fetchData = async function() {
  const startDateInput = document.getElementById('startDate').value;
  const endDateInput = document.getElementById('endDate').value;
  if (!startDateInput || !endDateInput) {
    showToast("Vui lòng chọn khoảng thời gian!", "warning");
    return;
  }
  const startDate = new Date(startDateInput);
  const endDate = new Date(endDateInput);
  if (startDate > endDate) {
    showToast("Ngày bắt đầu không thể lớn hơn ngày kết thúc!", "warning");
    return;
  }

  showLoading(true, 'tab2');
  try {
    const financialUrl = `${apiUrl}?action=getFinancialSummary&startDate=${startDateInput}&endDate=${endDateInput}&sheetId=${sheetId}`;
    const finalFinancialUrl = proxyUrl + encodeURIComponent(financialUrl);
    const financialResponse = await fetch(finalFinancialUrl);
    if (!financialResponse.ok) throw new Error(`HTTP error! Status: ${financialResponse.status}`);
    const financialData = await financialResponse.json();
    if (financialData.error) throw new Error(financialData.error);
    updateFinancialData(financialData);

    const chartUrl = `${apiUrl}?action=getChartData&startDate=${startDateInput}&endDate=${endDateInput}&sheetId=${sheetId}`;
    const finalChartUrl = proxyUrl + encodeURIComponent(chartUrl);
    const chartResponse = await fetch(finalChartUrl);
    if (!chartResponse.ok) throw new Error(`HTTP error! Status: ${chartResponse.status}`);
    const chartData = await chartResponse.json();
    if (chartData.error) throw new Error(chartData.error);
    updateChartData(chartData);
  } catch (error) {
    showToast("Lỗi khi lấy dữ liệu: " + error.message, "error");
    updateFinancialData({ error: true });
  } finally {
    showLoading(false, 'tab2');
  }
};

function updateFinancialData(data) {
  const container = document.getElementById('statsContainer');
  if (!data || data.error) {
    container.innerHTML = `
      <div class="stat-box income">
        <div class="title">Tổng thu nhập</div>
        <div class="amount no-data">Không có<br>dữ liệu</div>
      </div>
      <div class="stat-box expense">
        <div class="title">Tổng chi tiêu</div>
        <div class="amount no-data">Không có<br>dữ liệu</div>
      </div>
      <div class="stat-box balance">
        <div class="title">Số dư</div>
        <div class="amount no-data">Không có<br>dữ liệu</div>
      </div>
    `;
    return;
  }

  const totalIncome = Number(data.income) || 0;
  const totalExpense = Number(data.expense) || 0;
  if (totalIncome === 0 && totalExpense === 0) {
    container.innerHTML = `
      <div class="stat-box income">
        <div class="title">Tổng thu nhập</div>
        <div class="amount no-data">Không có<br>dữ liệu</div>
      </div>
      <div class="stat-box expense">
        <div class="title">Tổng chi tiêu</div>
        <div class="amount no-data">Không có<br>dữ liệu</div>
      </div>
      <div class="stat-box balance">
        <div class="title">Số dư</div>
        <div class="amount no-data">Không có<br>dữ liệu</div>
      </div>
    `;
    return;
  }

  const balance = totalIncome - totalExpense;
  container.innerHTML = `
    <div class="stat-box income">
      <div class="title">Tổng thu nhập</div>
      <div class="amount">${totalIncome.toLocaleString('vi-VN')}đ</div>
    </div>
    <div class="stat-box expense">
      <div class="title">Tổng chi tiêu</div>
      <div class="amount">${totalExpense.toLocaleString('vi-VN')}đ</div>
    </div>
    <div class="stat-box balance">
      <div class="title">Số dư</div>
      <div class="amount">${balance.toLocaleString('vi-VN')}đ</div>
    </div>
  `;
}

function updateChartData(response) {
  const ctx = document.getElementById('myChart').getContext('2d');
  if (window.myChart && typeof window.myChart.destroy === 'function') {
    window.myChart.destroy();
  }

  if (response.error) {
    showToast(response.error, "error");
    return;
  }

  const chartData = response.chartData;
  const categories = response.categories;
  const totalAmount = chartData.reduce((sum, item) => sum + item.amount, 0);
  const backgroundColors = [
    '#FF6B6B', '#FF9F45', '#FFE156', '#7DC95E', '#40C4FF',
    '#5A92FF', '#9B5DE5', '#FF66C4', '#FF7D7D', '#F88F70',
    '#54A0FF', '#C084FC', '#FF82A9', '#6DCFF6', '#FFACC5',
    '#E4C1F9', '#FF928B', '#FDCB98', '#B5E2FA', '#91E8BC',
    '#FFD166', '#FF8E72', '#E57373', '#74D3AE', '#43BCCD',
    '#D1B3E0', '#F78F8F', '#F6B17A', '#F4A261', '#FF6392',
    '#66D9E8', '#FF85A1', '#6A0572', '#FC7A57', '#A29BFE'
  ];

  const customLegend = document.getElementById('customLegend');
  customLegend.innerHTML = '';
  const leftColumn = document.createElement('div');
  leftColumn.className = 'custom-legend-column';
  const rightColumn = document.createElement('div');
  rightColumn.className = 'custom-legend-column';

  chartData.forEach((item, i) => {
    const index = categories.indexOf(item.category);
    const color = backgroundColors[index % backgroundColors.length];
    const percentage = ((item.amount / totalAmount) * 100).toFixed(1);
    const legendItem = document.createElement('div');
    legendItem.className = 'legend-item';
    legendItem.innerHTML = `
      <span class="legend-color" style="background-color: ${color};"></span>
      <span class="legend-text">
        ${item.category}:
        <span class="legend-value">${item.amount.toLocaleString('vi-VN')}đ (${percentage}%)</span>
      </span>
    `;
    if (i % 2 === 0) leftColumn.appendChild(legendItem);
    else rightColumn.appendChild(legendItem);
  });

  customLegend.appendChild(leftColumn);
  customLegend.appendChild(rightColumn);

  window.myChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: chartData.map(item => item.category),
      datasets: [{
        data: chartData.map(item => item.amount),
        backgroundColor: chartData.map(item => {
          const index = categories.indexOf(item.category);
          return backgroundColors[index % backgroundColors.length];
        })
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 1,
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: function(tooltipItem) {
              const category = tooltipItem.label;
              const amount = tooltipItem.raw;
              const percentage = ((amount / totalAmount) * 100).toFixed(1);
              return `${category}: ${amount.toLocaleString('vi-VN')}đ (${percentage}%)`;
            }
          },
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleFont: { size: 12 },
          bodyFont: { size: 10 },
          titleColor: '#fff',
          bodyColor: '#fff',
          padding: 8,
          displayColors: true,
        },
        datalabels: {
          formatter: (value, context) => {
            const percentage = ((value / totalAmount) * 100).toFixed(1);
            return percentage >= 1 ? `${value.toLocaleString('vi-VN')}đ (${percentage}%)` : '';
          },
          color: '#fff',
          font: { weight: 'bold', size: 12 },
          anchor: 'end',
          align: 'end',
          clamp: true
        }
      }
    }
  });
}

// Tab 3: Biểu đồ
window.fetchMonthlyData = async function() {
  const startMonth = parseInt(document.getElementById('startMonth').value);
  const endMonth = parseInt(document.getElementById('endMonth').value);
  const year = new Date().getFullYear();
  if (startMonth > endMonth) {
    showToast("Tháng bắt đầu không thể lớn hơn tháng kết thúc!", "warning");
    return;
  }

  showLoading(true, 'tab3');
  try {
    const targetUrl = `${apiUrl}?action=getMonthlyData&year=${year}&sheetId=${sheetId}`;
    const finalUrl = proxyUrl + encodeURIComponent(targetUrl);
    const response = await fetch(finalUrl);
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    const monthlyData = await response.json();
    if (monthlyData.error) throw new Error(monthlyData.error);

    const fullYearData = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const existingData = monthlyData.find(item => item.month === month);
      return existingData || { month, income: 0, expense: 0 };
    });

    const filteredData = Array.from({ length: endMonth - startMonth + 1 }, (_, i) => {
      const month = startMonth + i;
      const existingData = fullYearData.find(item => item.month === month);
      return existingData || { month, income: 0, expense: 0 };
    });

    updateMonthlyChart(filteredData);
  } catch (error) {
    showToast("Lỗi khi lấy dữ liệu biểu đồ tháng: " + error.message, "error");
    const filteredData = Array.from({ length: endMonth - startMonth + 1 }, (_, i) => ({
      month: startMonth + i,
      income: 0,
      expense: 0
    }));
    updateMonthlyChart(filteredData);
  } finally {
    showLoading(false, 'tab3');
  }
};

function updateMonthlyChart(filteredData) {
  const ctx = document.getElementById('monthlyChart').getContext('2d');
  if (window.monthlyChart && typeof window.monthlyChart.destroy === 'function') {
    window.monthlyChart.destroy();
  }

  if (!filteredData || filteredData.length === 0) {
    window.monthlyChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Không có dữ liệu'],
        datasets: [
          { label: 'Thu nhập', data: [0], backgroundColor: '#10B981' },
          { label: 'Chi tiêu', data: [0], backgroundColor: '#EF4444' }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 1,
        scales: {
          y: { 
            beginAtZero: true, 
            title: { display: true, text: 'Số tiền (đ)', font: { size: 14 } }, 
            ticks: { font: { size: 12 } } 
          },
          x: { 
            title: { display: true, text: 'Tháng', font: { size: 14 } }, 
            ticks: { font: { size: 12 } } 
          }
        },
        plugins: {
          legend: { display: true, labels: { font: { size: 12 } } },
          tooltip: {
            titleFont: { size: 12 },
            bodyFont: { size: 12 },
            callbacks: {
              label: function(tooltipItem) {
                return `${tooltipItem.dataset.label}: ${tooltipItem.raw.toLocaleString('vi-VN')}đ`;
              }
            }
          },
          datalabels: { display: false }
        }
      }
    });
    document.getElementById('monthlyLegend').innerHTML = '<div>Không có dữ liệu</div>';
    return;
  }

  const labels = filteredData.map(item => `Tháng ${item.month}`);
  const incomes = filteredData.map(item => item.income || 0);
  const expenses = filteredData.map(item => item.expense || 0);

  window.monthlyChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        { label: 'Thu nhập', data: incomes, backgroundColor: '#10B981', borderColor: '#10B981', borderWidth: 1 },
        { label: 'Chi tiêu', data: expenses, backgroundColor: '#EF4444', borderColor: '#EF4444', borderWidth: 1 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 1,
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Số tiền (đ)', font: { size: 14 } },
          ticks: {
            callback: function(value) { return value.toLocaleString('vi-VN') + 'đ'; },
            font: { size: 12 }
          }
        },
        x: {
          title: { display: true, text: 'Tháng', font: { size: 14 } },
          ticks: {
            font: { size: 10 },
            maxRotation: 45,
            minRotation: 45,
            autoSkip: false
          }
        }
      },
      plugins: {
        legend: { display: true, labels: { font: { size: 12 } } },
        tooltip: {
          titleFont: { size: 12 },
          bodyFont: { size: 12 },
          callbacks: {
            label: function(tooltipItem) {
              return `${tooltipItem.dataset.label}: ${tooltipItem.raw.toLocaleString('vi-VN')}đ`;
            }
          }
        },
        datalabels: {
          display: true,
          align: 'end',
          anchor: 'end',
          formatter: (value) => value.toLocaleString('vi-VN') + 'đ',
          color: '#1F2A44',
          font: { weight: 'bold', size: 12 }
        }
      }
    }
  });

  const monthlyLegend = document.getElementById('monthlyLegend');
  monthlyLegend.innerHTML = '';
  const column = document.createElement('div');
  column.className = 'monthly-column';

  filteredData.forEach(item => {
    const difference = (item.income || 0) - (item.expense || 0);
    const diffClass = difference >= 0 ? 'positive' : 'negative';
    const diffIcon = difference >= 0 ? 'fa-arrow-up' : 'fa-arrow-down';
    const monthItem = document.createElement('div');
    monthItem.className = 'month-item';
    monthItem.innerHTML = `
      <h3>Tháng ${item.month}:</h3>
      <p><span class="color-box" style="background-color: #10B981;"></span>Tổng thu nhập: <strong>${(item.income || 0).toLocaleString('vi-VN')}đ</strong></p>
      <p><span class="color-box" style="background-color: #EF4444;"></span>Tổng chi tiêu: <strong>${(item.expense || 0).toLocaleString('vi-VN')}đ</strong></p>
      <p><i class="fas ${diffIcon} difference-icon ${diffClass}"></i>Chênh lệch: <span class="difference ${diffClass}"><strong>${difference.toLocaleString('vi-VN')}đ</strong></span></p>
    `;
    column.appendChild(monthItem);
  });

  monthlyLegend.appendChild(column);
}

// Tab 5: Chi tiêu trong tháng
window.fetchMonthlyExpenses = async function() {
  const month = document.getElementById('expenseMonth').value;
  if (!month) return showToast("Vui lòng chọn tháng để xem giao dịch!", "warning");
  const year = new Date().getFullYear();
  const cacheKey = `${year}-${month}`;

  if (cachedMonthlyExpenses && cachedMonthlyExpenses.cacheKey === cacheKey) {
    displayMonthlyExpenses(cachedMonthlyExpenses.data);
    return;
  }

  showLoading(true, 'tab5');
  try {
    const targetUrl = `${apiUrl}?action=getTransactionsByMonth&month=${month}&year=${year}&sheetId=${sheetId}`;
    const finalUrl = proxyUrl + encodeURIComponent(targetUrl);
    const response = await fetch(finalUrl);
    const transactionData = await response.json();
    if (transactionData.error) throw new Error(transactionData.error);
    cachedMonthlyExpenses = { cacheKey, data: transactionData };
    displayMonthlyExpenses(transactionData);
  } catch (error) {
    showToast("Lỗi khi lấy dữ liệu giao dịch: " + error.message, "error");
    displayMonthlyExpenses({ error: true });
  } finally {
    showLoading(false, 'tab5');
  }
};

function displayMonthlyExpenses(data) {
  const container = document.getElementById('monthlyExpensesContainer');
  const summaryContainer = document.getElementById('monthlyExpenseSummary');
  const pageInfo = document.getElementById('pageInfoMonthly');
  const prevPageBtn = document.getElementById('prevPageMonthly');
  const nextPageBtn = document.getElementById('nextPageMonthly');
  container.innerHTML = '';

  if (!data || data.error || !Array.isArray(data) || data.length === 0) {
    container.innerHTML = '<div>Không có giao dịch trong tháng này</div>';
    summaryContainer.innerHTML = `
      <div class="stat-box income"><div class="title">Tổng thu nhập</div><div class="amount no-data">Không có<br>dữ liệu</div></div>
      <div class="stat-box expense"><div class="title">Tổng chi tiêu</div><div class="amount no-data">Không có<br>dữ liệu</div></div>
      <div class="stat-box balance"><div class="title">Số dư</div><div class="amount no-data">Không có<br>dữ liệu</div></div>
    `;
    pageInfo.textContent = '';
    prevPageBtn.disabled = true;
    nextPageBtn.disabled = true;
    return;
  }

  let totalIncome = 0, totalExpense = 0;
  data.forEach(item => {
    if (item.type === 'Thu nhập') totalIncome += item.amount;
    else if (item.type === 'Chi tiêu') totalExpense += item.amount;
  });
  const balance = totalIncome - totalExpense;

  summaryContainer.innerHTML = `
    <div class="stat-box income"><div class="title">Tổng thu nhập</div><div class="amount">${totalIncome.toLocaleString('vi-VN')}đ</div></div>
    <div class="stat-box expense"><div class="title">Tổng chi tiêu</div><div class="amount">${totalExpense.toLocaleString('vi-VN')}đ</div></div>
    <div class="stat-box balance"><div class="title">Số dư</div><div class="amount">${balance.toLocaleString('vi-VN')}đ</div></div>
  `;

  const totalTransactions = data.length;
  container.innerHTML = `<div class="notification">Bạn có ${totalTransactions} giao dịch trong tháng</div>`;

  const totalPages = Math.ceil(data.length / expensesPerPage);
  const startIndex = (currentPageMonthly - 1) * expensesPerPage;
  const endIndex = startIndex + expensesPerPage;
  const paginatedData = data.slice(startIndex, endIndex);

  paginatedData.forEach((item, index) => {
    const transactionBox = document.createElement('div');
    transactionBox.className = 'transaction-box';
    const amountColor = item.type === 'Thu nhập' ? '#10B981' : '#EF4444';
    const typeClass = item.type === 'Thu nhập' ? 'income' : 'expense';
    const transactionNumber = startIndex + index + 1;
    transactionBox.innerHTML = `
      <div style="display: flex; justify-content: space-between; width: 100%;">
        <div style="flex: 1;">
          <div class="date">${formatDate(item.date)}</div>
          <div class="amount" style="color: ${amountColor}">${item.amount.toLocaleString('vi-VN')}đ</div>
          <div class="content">Nội dung: ${item.content}${item.note ? ` (${item.note})` : ''}</div>
          <div class="number">STT của giao dịch: ${transactionNumber}</div>
          <div class="id">ID của giao dịch: ${item.id}</div>
        </div>
        <div style="flex: 1; text-align: right;">
          <div class="type ${typeClass}">Phân loại: ${item.type}</div>
          <div class="category">Phân loại chi tiết: ${item.category}</div>
        </div>
      </div>
      <div style="margin-top: 0.5rem;">
        <button class="edit-btn" data-id="${item.id}" style="background: #FFA500; color: white; padding: 0.3rem 0.8rem; border-radius: 8px;">Sửa</button>
        <button class="delete-btn" data-id="${item.id}" style="background: #EF4444; color: white; padding: 0.3rem 0.8rem; border-radius: 8px; margin-left: 0.5rem;">Xóa</button>
      </div>
    `;
    container.appendChild(transactionBox);
  });

  pageInfo.textContent = `Trang ${currentPageMonthly} / ${totalPages}`;
  prevPageBtn.disabled = currentPageMonthly === 1;
  nextPageBtn.disabled = currentPageMonthly === totalPages;

  document.querySelectorAll('.edit-btn').forEach(button => {
    const transactionId = button.getAttribute('data-id');
    const transaction = data.find(item => String(item.id) === String(transactionId));
    if (!transaction) return console.error(`Không tìm thấy giao dịch với ID: ${transactionId}`);
    button.addEventListener('click', () => openEditForm(transaction));
  });

  document.querySelectorAll('.delete-btn').forEach(button => {
    button.addEventListener('click', () => deleteTransaction(button.getAttribute('data-id')));
  });
}

// Tab 6: Tìm kiếm giao dịch
async function populateSearchCategories() {
  const categorySelect = document.getElementById('searchCategory');
  const categories = await fetchCategories();
  categorySelect.innerHTML = '<option value="">Tất cả</option>';
  categories.forEach(category => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    categorySelect.appendChild(option);
  });
}

window.searchTransactions = async function() {
  const month = document.getElementById('searchMonth').value;
  const content = document.getElementById('searchContent').value.trim();
  let amount = document.getElementById('searchAmount').value;
  amount = amount ? parseNumber(amount).toString() : '';
  const category = document.getElementById('searchCategory').value;
  const year = new Date().getFullYear();

  if (!content && !amount && !category) {
    return showToast("Vui lòng nhập ít nhất một tiêu chí: nội dung, số tiền, hoặc phân loại chi tiết!", "warning");
  }

  showLoading(true, 'tab6');
  try {
    let targetUrl = `${apiUrl}?action=searchTransactions&sheetId=${sheetId}`;
    if (month) targetUrl += `&month=${month}&year=${year}`;
    if (content) targetUrl += `&content=${encodeURIComponent(content)}`;
    if (amount) targetUrl += `&amount=${encodeURIComponent(amount)}`;
    if (category) targetUrl += `&category=${encodeURIComponent(category)}`;

    const finalUrl = proxyUrl + encodeURIComponent(targetUrl);
    const response = await fetch(finalUrl);
    const searchData = await response.json();
    if (searchData.error) throw new Error(searchData.error);

    cachedSearchResults = {
      transactions: searchData.transactions,
      totalTransactions: searchData.totalTransactions,
      totalPages: searchData.totalPages,
      currentPage: searchData.currentPage
    };
    currentPageSearch = searchData.currentPage || 1;

    displaySearchResults(searchData.transactions);
  } catch (error) {
    showToast("Lỗi khi tìm kiếm giao dịch: " + error.message, "error");
    displaySearchResults({ error: true });
  } finally {
    showLoading(false, 'tab6');
  }
};

function displaySearchResults(data) {
  const container = document.getElementById('searchResultsContainer');
  const pageInfo = document.getElementById('pageInfoSearch');
  const prevPageBtn = document.getElementById('prevPageSearch');
  const nextPageBtn = document.getElementById('nextPageSearch');
  container.innerHTML = '';

  if (!data || data.error || !Array.isArray(data) || data.length === 0) {
    container.innerHTML = '<div>Không tìm thấy giao dịch nào phù hợp</div>';
    pageInfo.textContent = '';
    prevPageBtn.disabled = true;
    nextPageBtn.disabled = true;
    return;
  }

  container.innerHTML = `<div class="notification">Tìm thấy ${data.length} giao dịch phù hợp</div>`;

  const totalPages = Math.ceil(data.length / searchPerPage);
  const startIndex = (currentPageSearch - 1) * searchPerPage;
  const endIndex = startIndex + searchPerPage;
  const paginatedData = data.slice(startIndex, endIndex);

  paginatedData.forEach((item, index) => {
    const transactionBox = document.createElement('div');
    transactionBox.className = 'transaction-box';
    const amountColor = item.type === 'Thu nhập' ? '#10B981' : '#EF4444';
    const typeClass = item.type === 'Thu nhập' ? 'income' : 'expense';
    const transactionNumber = startIndex + index + 1;
    transactionBox.innerHTML = `
      <div style="display: flex; justify-content: space-between; width: 100%;">
        <div style="flex: 1;">
          <div class="date">${formatDate(item.date)}</div>
          <div class="amount" style="color: ${amountColor}">${item.amount.toLocaleString('vi-VN')}đ</div>
          <div class="content">Nội dung: ${item.content}${item.note ? ` (${item.note})` : ''}</div>
          <div class="number">STT của giao dịch: ${transactionNumber}</div>
          <div class="id">ID của giao dịch: ${item.id}</div>
        </div>
        <div style="flex: 1; text-align: right;">
          <div class="type ${typeClass}">Phân loại: ${item.type}</div>
          <div class="category">Phân loại chi tiết: ${item.category}</div>
        </div>
      </div>
      <div style="margin-top: 0.5rem;">
        <button class="edit-btn" data-id="${item.id}" style="background: #FFA500; color: white; padding: 0.3rem 0.8rem; border-radius: 8px;">Sửa</button>
        <button class="delete-btn" data-id="${item.id}" style="background: #EF4444; color: white; padding: 0.3rem 0.8rem; border-radius: 8px; margin-left: 0.5rem;">Xóa</button>
      </div>
    `;
    container.appendChild(transactionBox);
  });

  pageInfo.textContent = `Trang ${currentPageSearch} / ${totalPages}`;
  prevPageBtn.disabled = currentPageSearch === 1;
  nextPageBtn.disabled = currentPageSearch === totalPages;

  document.querySelectorAll('.edit-btn').forEach(button => {
    const transactionId = button.getAttribute('data-id');
    const transaction = data.find(item => String(item.id) === String(transactionId));
    if (!transaction) return console.error(`Không tìm thấy giao dịch với ID: ${transactionId}`);
    button.addEventListener('click', () => openEditForm(transaction));
  });

  document.querySelectorAll('.delete-btn').forEach(button => {
    button.addEventListener('click', () => deleteTransaction(button.getAttribute('data-id')));
  });
}

// Khởi tạo
document.addEventListener('DOMContentLoaded', function() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => window.openTab(item.getAttribute('data-tab')));
  });

  document.getElementById('fetchDataBtn').addEventListener('click', window.fetchData);
  document.getElementById('fetchMonthlyDataBtn').addEventListener('click', window.fetchMonthlyData);
  document.getElementById('fetchTransactionsBtn').addEventListener('click', window.fetchTransactions);
  document.getElementById('addTransactionBtn').addEventListener('click', openAddForm);
  document.getElementById('fetchMonthlyExpensesBtn').addEventListener('click', window.fetchMonthlyExpenses);
  document.getElementById('searchTransactionsBtn').addEventListener('click', window.searchTransactions);
  
  const currentMonth = new Date().getMonth() + 1; // Lấy tháng hiện tại (1-12)
  // Tab 3: Biểu đồ - Tháng 1 đến tháng hiện tại
  const startMonthInput = document.getElementById('startMonth');
  const endMonthInput = document.getElementById('endMonth');
  if (startMonthInput && endMonthInput) {
    startMonthInput.value = 1; // Tháng 1
    endMonthInput.value = currentMonth; // Tháng hiện tại
  }
  // Tab 5: Liệt kê - Đặt tháng hiện tại
  const expenseMonthInput = document.getElementById('expenseMonth');
  if (expenseMonthInput) {
    expenseMonthInput.value = currentMonth; // Đặt tháng hiện tại
  }
  document.getElementById('prevPage').addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      window.fetchTransactions();
    }
  });
  document.getElementById('nextPage').addEventListener('click', () => {
    const totalPages = Math.ceil((cachedTransactions?.data.length || 0) / transactionsPerPage);
    if (currentPage < totalPages) {
      currentPage++;
      window.fetchTransactions();
    }
  });

  document.getElementById('prevPageMonthly').addEventListener('click', () => {
    if (currentPageMonthly > 1) {
      currentPageMonthly--;
      window.fetchMonthlyExpenses();
    }
  });
  document.getElementById('nextPageMonthly').addEventListener('click', () => {
    const totalPages = Math.ceil((cachedMonthlyExpenses?.data.length || 0) / expensesPerPage);
    if (currentPageMonthly < totalPages) {
      currentPageMonthly++;
      window.fetchMonthlyExpenses();
    }
  });

  document.getElementById('prevPageSearch').addEventListener('click', () => {
    if (currentPageSearch > 1) {
      currentPageSearch--;
      window.searchTransactions();
    }
  });
  document.getElementById('nextPageSearch').addEventListener('click', () => {
    const totalPages = Math.ceil((cachedSearchResults?.transactions.length || 0) / searchPerPage);
    if (currentPageSearch < totalPages) {
      currentPageSearch++;
      window.searchTransactions();
    }
  });
  const searchAmountInput = document.getElementById('searchAmount');
if (searchAmountInput) {
  searchAmountInput.addEventListener('input', function() {
    const cursorPosition = this.selectionStart;
    const oldLength = this.value.length;
    this.value = formatNumberWithCommas(this.value);
    const newLength = this.value.length;
    this.selectionStart = this.selectionEnd = cursorPosition + (newLength - oldLength);
  });

  searchAmountInput.addEventListener('keypress', function(e) {
    if (!/[0-9]/.test(e.key)) {
      e.preventDefault();
    }
  });
}

  // Điền ngày hiện tại và khoảng thời gian mặc định khi mở Mini App
  const today = new Date();
  const formattedToday = formatDateToYYYYMMDD(today); // Ngày hiện tại: YYYY-MM-DD
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1); // Ngày đầu tháng
  const formattedFirstDay = formatDateToYYYYMMDD(firstDayOfMonth);

  // Tab 1: Điền ngày hiện tại vào transactionDate
  const transactionDateInput = document.getElementById('transactionDate');
  if (transactionDateInput) {
    transactionDateInput.value = formattedToday;
    // window.fetchTransactions(); // Tự động tải dữ liệu (tuỳ chọn)
  }

  // Tab 2: Điền ngày đầu tháng vào startDate và ngày hiện tại vào endDate
  const startDateInput = document.getElementById('startDate');
  const endDateInput = document.getElementById('endDate');
  if (startDateInput && endDateInput) {
    startDateInput.value = formattedFirstDay;
    endDateInput.value = formattedToday;
    // window.fetchData(); // Tự động tải dữ liệu thống kê (tuỳ chọn)
  }

  populateSearchCategories();
  window.openTab('tab1'); // Mặc định mở tab Giao dịch
});
// Xử lý định dạng tiền (Ví dụ 5.000 hoặc 50.000)
// Hàm định dạng số với dấu chấm phân cách
function formatNumberWithCommas(value) {
  if (!value) return '';
  // Chỉ giữ các chữ số
  const digitsOnly = value.replace(/[^0-9]/g, '');
  // Định dạng với dấu chấm
  return digitsOnly.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// Hàm loại bỏ dấu chấm để lấy số nguyên
function parseNumber(value) {
  return parseInt(value.replace(/[^0-9]/g, '')) || 0;
}

// Cập nhật hàm openAddForm
async function openAddForm() {
  const modal = document.getElementById('addModal');
  const form = document.getElementById('addForm');
  const categorySelect = document.getElementById('addCategory');
  const amountInput = document.getElementById('addAmount');

  // Điền ngày hiện tại dạng YYYY-MM-DD
  document.getElementById('addDate').value = formatDateToYYYYMMDD(new Date());
  document.getElementById('addContent').value = '';
  amountInput.value = '';
  document.getElementById('addType').value = 'Thu nhập';
  document.getElementById('addNote').value = '';

  const categories = await fetchCategories();
  categorySelect.innerHTML = '';
  categories.forEach(category => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    categorySelect.appendChild(option);
  });

  // Xử lý định dạng số tiền khi nhập
  amountInput.addEventListener('input', function() {
    const cursorPosition = this.selectionStart;
    const oldLength = this.value.length;
    this.value = formatNumberWithCommas(this.value);
    const newLength = this.value.length;
    // Điều chỉnh vị trí con trỏ
    this.selectionStart = this.selectionEnd = cursorPosition + (newLength - oldLength);
  });

  // Ngăn nhập ký tự không phải số
  amountInput.addEventListener('keypress', function(e) {
    if (!/[0-9]/.test(e.key)) {
      e.preventDefault();
    }
  });

  modal.style.display = 'flex';
  form.onsubmit = async function(e) {
    e.preventDefault();
    const dateInput = document.getElementById('addDate').value; // Dạng YYYY-MM-DD
    const [year, month, day] = dateInput.split('-');
    const formattedDate = `${day}/${month}/${year}`; // Chuyển thành DD/MM/YYYY
    const today = new Date();
    const inputDate = new Date(year, month - 1, day);
    if (inputDate > today) return showModalError('add', 'Không thể chọn ngày trong tương lai!');
    const amount = parseNumber(document.getElementById('addAmount').value);
    if (amount <= 0) return showModalError('add', 'Số tiền phải lớn hơn 0!');
    const newTransaction = {
      content: document.getElementById('addContent').value,
      amount: amount,
      type: document.getElementById('addType').value,
      category: document.getElementById('addCategory').value,
      note: document.getElementById('addNote').value || '',
      date: formattedDate, // Gửi dạng DD/MM/YYYY
      action: 'addTransaction'
    };
    await addTransaction(newTransaction);
  };
}
