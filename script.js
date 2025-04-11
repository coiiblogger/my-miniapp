// Lấy thông số API và Sheet ID từ URL
const urlParams = new URLSearchParams(window.location.search);
const apiUrl = urlParams.get('api');
const sheetId = urlParams.get('sheetId');
const proxyUrl = 'https://miniapphmh.netlify.app/.netlify/functions/proxy?url=';

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

// Hiển thị popup loading
function showLoadingPopup() {
  const loadingPopup = document.getElementById('loadingPopup');
  if (loadingPopup) {
    loadingPopup.classList.add('show');
  }
}

// Ẩn popup loading
function hideLoadingPopup() {
  const loadingPopup = document.getElementById('loadingPopup');
  if (loadingPopup) {
    loadingPopup.classList.remove('show');
  }
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

// Định dạng số với dấu chấm ngăn cách hàng nghìn
function formatNumber(value) {
  if (!value) return '';
  const number = parseFloat(value.toString().replace(/[^0-9]/g, ''));
  if (isNaN(number)) return '';
  return number.toLocaleString('vi-VN', { minimumFractionDigits: 0 });
}

// Phân tích chuỗi định dạng (ví dụ: "500.000" thành 500000)
function parseFormattedNumber(value) {
  if (!value) return '';
  return parseFloat(value.replace(/\./g, '')) || 0;
}

// Mở tab
function openTab(tabId) {
  const tabs = document.querySelectorAll('.nav-item');
  const contents = document.querySelectorAll('.tab-content');
  tabs.forEach(tab => tab.classList.remove('active'));
  contents.forEach(content => content.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  document.querySelector(`.nav-item[data-tab="${tabId}"]`).classList.add('active');
}

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
  const summaryContainer = document.getElementById('dailySummary');
  const pageInfo = document.getElementById('pageInfo');
  const prevPageBtn = document.getElementById('prevPage');
  const nextPageBtn = document.getElementById('nextPage');
  container.innerHTML = '';

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

  const totalPages = Math.ceil(data.length / transactionsPerPage);
  currentPage = Math.min(currentPage, totalPages);
  currentPage = Math.max(currentPage, 1);

  const startIndex = (currentPage - 1) * transactionsPerPage;
  const endIndex = startIndex + transactionsPerPage;
  const paginatedData = data.slice(startIndex, endIndex);

  paginatedData.forEach((item, index) => {
    const transactionDiv = document.createElement('div');
    transactionDiv.className = 'transaction-box';
    transactionDiv.innerHTML = `
      <div class="id">ID: ${item.id}</div>
      <div class="number">Số thứ tự: ${startIndex + index + 1}</div>
      <div class="date">${formatDate(item.date)}</div>
      <div class="content">${item.content}</div>
      <div class="amount">${item.amount.toLocaleString('vi-VN')}đ</div>
      <div class="type ${item.type === 'Thu nhập' ? 'income' : 'expense'}">${item.type}</div>
      <div class="category">${item.category}</div>
      <div class="action-buttons">
        <button onclick="openEditForm(${JSON.stringify(item).replace(/"/g, '"')})">Sửa</button>
        <button onclick="deleteTransaction('${item.id}')">Xóa</button>
      </div>
    `;
    container.appendChild(transactionDiv);
  });

  pageInfo.textContent = `Trang ${currentPage}/${totalPages}`;
  prevPageBtn.disabled = currentPage === 1;
  nextPageBtn.disabled = currentPage === totalPages;
}

window.prevPage = function() {
  if (currentPage > 1) {
    currentPage--;
    displayTransactions(cachedTransactions.data);
  }
};

window.nextPage = function() {
  const totalPages = Math.ceil(cachedTransactions.data.length / transactionsPerPage);
  if (currentPage < totalPages) {
    currentPage++;
    displayTransactions(cachedTransactions.data);
  }
};

// Tab 2: Thống kê
window.fetchData = async function() {
  const startDate = document.getElementById('startDate').value;
  const endDate = document.getElementById('endDate').value;
  if (!startDate || !endDate) return showToast("Vui lòng chọn khoảng thời gian để xem thống kê!", "warning");
  if (new Date(startDate) > new Date(endDate)) return showToast("Ngày bắt đầu không được lớn hơn ngày kết thúc!", "warning");

  const cacheKey = `${startDate}-${endDate}`;
  if (cachedFinancialData && cachedFinancialData.cacheKey === cacheKey) {
    displayStats(cachedFinancialData.data);
    return;
  }

  showLoading(true, 'tab2');
  try {
    const targetUrl = `${apiUrl}?action=getFinancialData&startDate=${startDate}&endDate=${endDate}&sheetId=${sheetId}`;
    const finalUrl = proxyUrl + encodeURIComponent(targetUrl);
    const response = await fetch(finalUrl);
    const financialData = await response.json();
    if (financialData.error) throw new Error(financialData.error);
    cachedFinancialData = { cacheKey, data: financialData };
    displayStats(financialData);
  } catch (error) {
    showToast("Lỗi khi lấy dữ liệu thống kê: " + error.message, "error");
    displayStats({ error: true });
  } finally {
    showLoading(false, 'tab2');
  }
};

function displayStats(data) {
  const statsContainer = document.getElementById('statsContainer');
  const chartCanvas = document.getElementById('myChart');
  const customLegend = document.getElementById('customLegend');

  if (!data || data.error || !Array.isArray(data) || data.length === 0) {
    statsContainer.innerHTML = `
      <div class="stat-box income"><div class="title">Tổng thu nhập</div><div class="amount no-data">Không có<br>dữ liệu</div></div>
      <div class="stat-box expense"><div class="title">Tổng chi tiêu</div><div class="amount no-data">Không có<br>dữ liệu</div></div>
      <div class="stat-box balance"><div class="title">Số dư</div><div class="amount no-data">Không có<br>dữ liệu</div></div>
    `;
    chartCanvas.style.display = 'none';
    customLegend.innerHTML = '';
    return;
  }

  let totalIncome = 0, totalExpense = 0;
  const expenseByCategory = {};

  data.forEach(item => {
    if (item.type === 'Thu nhập') totalIncome += item.amount;
    else if (item.type === 'Chi tiêu') {
      totalExpense += item.amount;
      expenseByCategory[item.category] = (expenseByCategory[item.category] || 0) + item.amount;
    }
  });

  const balance = totalIncome - totalExpense;
  statsContainer.innerHTML = `
    <div class="stat-box income"><div class="title">Tổng thu nhập</div><div class="amount">${totalIncome.toLocaleString('vi-VN')}đ</div></div>
    <div class="stat-box expense"><div class="title">Tổng chi tiêu</div><div class="amount">${totalExpense.toLocaleString('vi-VN')}đ</div></div>
    <div class="stat-box balance"><div class="title">Số dư</div><div class="amount">${balance.toLocaleString('vi-VN')}đ</div></div>
  `;

  const labels = Object.keys(expenseByCategory);
  const amounts = Object.values(expenseByCategory);
  const backgroundColors = labels.map((_, index) => `hsl(${(index * 360 / labels.length) % 360}, 70%, 60%)`);

  if (window.myChart instanceof Chart) window.myChart.destroy();
  chartCanvas.style.display = 'block';

  window.myChart = new Chart(chartCanvas, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: amounts,
        backgroundColor: backgroundColors,
        borderWidth: 1,
        borderColor: '#FFFFFF'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        datalabels: {
          color: '#FFFFFF',
          font: { weight: 'bold', size: 12 },
          formatter: (value, context) => {
            const total = context.dataset.data.reduce((sum, val) => sum + val, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return percentage >= 5 ? `${percentage}%` : '';
          },
          anchor: 'center',
          align: 'center'
        }
      }
    },
    plugins: [ChartDataLabels]
  });

  customLegend.innerHTML = '';
  const midPoint = Math.ceil(labels.length / 2);
  const leftColumn = labels.slice(0, midPoint);
  const rightColumn = labels.slice(midPoint);

  const createLegendColumn = (labelsColumn, startIndex) => {
    const column = document.createElement('div');
    column.className = 'custom-legend-column';
    labelsColumn.forEach((label, index) => {
      const amount = amounts[startIndex + index];
      const percentage = ((amount / totalExpense) * 100).toFixed(1);
      const legendItem = document.createElement('div');
      legendItem.className = 'legend-item';
      legendItem.innerHTML = `
        <div class="legend-color" style="background-color: ${backgroundColors[startIndex + index]};"></div>
        <div class="legend-text">
          <span>${label}</span>
          <span class="legend-value">${amount.toLocaleString('vi-VN')}đ (${percentage}%)</span>
        </div>
      `;
      column.appendChild(legendItem);
    });
    return column;
  };

  customLegend.appendChild(createLegendColumn(leftColumn, 0));
  customLegend.appendChild(createLegendColumn(rightColumn, midPoint));
}

// Tab 3: Biểu đồ
window.fetchMonthlyData = async function() {
  const startMonth = document.getElementById('startMonth').value;
  const endMonth = document.getElementById('endMonth').value;

  const currentYear = new Date().getFullYear();
  const cacheKey = `${startMonth}-${endMonth}-${currentYear}`;
  if (cachedChartData && cachedChartData.cacheKey === cacheKey) {
    displayMonthlyChart(cachedChartData.data);
    return;
  }

  showLoading(true, 'tab3');
  try {
    const targetUrl = `${apiUrl}?action=getMonthlyData&startMonth=${startMonth}&endMonth=${endMonth}&year=${currentYear}&sheetId=${sheetId}`;
    const finalUrl = proxyUrl + encodeURIComponent(targetUrl);
    const response = await fetch(finalUrl);
    const monthlyData = await response.json();
    if (monthlyData.error) throw new Error(monthlyData.error);
    cachedChartData = { cacheKey, data: monthlyData };
    displayMonthlyChart(monthlyData);
  } catch (error) {
    showToast("Lỗi khi lấy dữ liệu biểu đồ: " + error.message, "error");
    displayMonthlyChart({ error: true });
  } finally {
    showLoading(false, 'tab3');
  }
};

function displayMonthlyChart(data) {
  const chartCanvas = document.getElementById('monthlyChart');
  const monthlyLegend = document.getElementById('monthlyLegend');

  if (!data || data.error || !Array.isArray(data) || data.length === 0) {
    chartCanvas.style.display = 'none';
    monthlyLegend.innerHTML = '<div>Không có dữ liệu để hiển thị biểu đồ</div>';
    return;
  }

  const labels = data.map(item => `Tháng ${item.month}`);
  const incomeData = data.map(item => item.totalIncome);
  const expenseData = data.map(item => item.totalExpense);

  if (window.monthlyChart instanceof Chart) window.monthlyChart.destroy();
  chartCanvas.style.display = 'block';

  window.monthlyChart = new Chart(chartCanvas, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Thu nhập',
          data: incomeData,
          backgroundColor: 'rgba(16, 185, 129, 0.6)',
          borderColor: 'rgba(16, 185, 129, 1)',
          borderWidth: 1
        },
        {
          label: 'Chi tiêu',
          data: expenseData,
          backgroundColor: 'rgba(239, 68, 68, 0.6)',
          borderColor: 'rgba(239, 68, 68, 1)',
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Số tiền (đ)' },
          ticks: {
            callback: function(value) {
              return value.toLocaleString('vi-VN');
            }
          }
        },
        x: {
          title: { display: true, text: 'Tháng' }
        }
      },
      plugins: {
        legend: { display: false },
        datalabels: {
          display: false
        }
      }
    }
  });

  monthlyLegend.innerHTML = '';
  const monthlyColumn = document.createElement('div');
  monthlyColumn.className = 'monthly-column';

  data.forEach(item => {
    const difference = item.totalIncome - item.totalExpense;
    const monthItem = document.createElement('div');
    monthItem.className = 'month-item';
    monthItem.innerHTML = `
      <h3>Tháng ${item.month}</h3>
      <p><span class="color-box" style="background-color: rgba(16, 185, 129, 0.6);"></span>Thu nhập: <span class="amount">${item.totalIncome.toLocaleString('vi-VN')}đ</span></p>
      <p><span class="color-box" style="background-color: rgba(239, 68, 68, 0.6);"></span>Chi tiêu: <span class="amount">${item.totalExpense.toLocaleString('vi-VN')}đ</span></p>
      <p>Số dư: <i class="fas fa-arrow-${difference >= 0 ? 'up' : 'down'} difference-icon ${difference >= 0 ? 'positive' : 'negative'}"></i><span class="difference ${difference >= 0 ? 'positive' : 'negative'}">${Math.abs(difference).toLocaleString('vi-VN')}đ</span></p>
    `;
    monthlyColumn.appendChild(monthItem);
  });

  monthlyLegend.appendChild(monthlyColumn);
}

// Tab 5: Chi tiêu trong tháng
window.fetchMonthlyExpenses = async function() {
  const expenseMonth = document.getElementById('expenseMonth').value;
  if (!expenseMonth) return showToast("Vui lòng chọn tháng để xem chi tiêu!", "warning");

  const currentYear = new Date().getFullYear();
  const cacheKey = `${expenseMonth}-${currentYear}`;
  if (cachedMonthlyExpenses && cachedMonthlyExpenses.cacheKey === cacheKey) {
    displayMonthlyExpenses(cachedMonthlyExpenses.data);
    return;
  }

  showLoading(true, 'tab5');
  try {
    const targetUrl = `${apiUrl}?action=getMonthlyExpenses&month=${expenseMonth}&year=${currentYear}&sheetId=${sheetId}`;
    const finalUrl = proxyUrl + encodeURIComponent(targetUrl);
    const response = await fetch(finalUrl);
    const monthlyExpenses = await response.json();
    if (monthlyExpenses.error) throw new Error(monthlyExpenses.error);
    cachedMonthlyExpenses = { cacheKey, data: monthlyExpenses };
    displayMonthlyExpenses(monthlyExpenses);
  } catch (error) {
    showToast("Lỗi khi lấy dữ liệu chi tiêu: " + error.message, "error");
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
    container.innerHTML = '<div>Không có giao dịch nào trong tháng này</div>';
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

  const totalPages = Math.ceil(data.length / expensesPerPage);
  currentPageMonthly = Math.min(currentPageMonthly, totalPages);
  currentPageMonthly = Math.max(currentPageMonthly, 1);

  const startIndex = (currentPageMonthly - 1) * expensesPerPage;
  const endIndex = startIndex + expensesPerPage;
  const paginatedData = data.slice(startIndex, endIndex);

  paginatedData.forEach((item, index) => {
    const transactionDiv = document.createElement('div');
    transactionDiv.className = 'transaction-box';
    transactionDiv.innerHTML = `
      <div class="id">ID: ${item.id}</div>
      <div class="number">Số thứ tự: ${startIndex + index + 1}</div>
      <div class="date">${formatDate(item.date)}</div>
      <div class="content">${item.content}</div>
      <div class="amount">${item.amount.toLocaleString('vi-VN')}đ</div>
      <div class="type ${item.type === 'Thu nhập' ? 'income' : 'expense'}">${item.type}</div>
      <div class="category">${item.category}</div>
      <div class="action-buttons">
        <button onclick="openEditForm(${JSON.stringify(item).replace(/"/g, '"')})">Sửa</button>
        <button onclick="deleteTransaction('${item.id}')">Xóa</button>
      </div>
    `;
    container.appendChild(transactionDiv);
  });

  pageInfo.textContent = `Trang ${currentPageMonthly}/${totalPages}`;
  prevPageBtn.disabled = currentPageMonthly === 1;
  nextPageBtn.disabled = currentPageMonthly === totalPages;
}

window.prevPageMonthly = function() {
  if (currentPageMonthly > 1) {
    currentPageMonthly--;
    displayMonthlyExpenses(cachedMonthlyExpenses.data);
  }
};

window.nextPageMonthly = function() {
  const totalPages = Math.ceil(cachedMonthlyExpenses.data.length / expensesPerPage);
  if (currentPageMonthly < totalPages) {
    currentPageMonthly++;
    displayMonthlyExpenses(cachedMonthlyExpenses.data);
  }
};

// Tab 6: Tìm kiếm
async function populateSearchCategories() {
  const searchCategory = document.getElementById('searchCategory');
  const searchAmount = document.getElementById('searchAmount');
  const searchContent = document.getElementById('searchContent');
  const categories = await fetchCategories();
  searchCategory.innerHTML = '<option value="">Tất cả</option>';
  categories.forEach(category => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    searchCategory.appendChild(option);
  });
}

window.searchTransactions = async function() {
  const searchMonth = document.getElementById('searchMonth').value;
  const searchContent = document.getElementById('searchContent').value.trim();
  const searchAmountInput = document.getElementById('searchAmount').value;
  const searchCategory = document.getElementById('searchCategory').value;
  const currentYear = new Date().getFullYear();

  const searchAmount = searchAmountInput ? parseFormattedNumber(searchAmountInput) : '';

  if (!searchContent && !searchAmount && !searchCategory) {
    return showToast("Vui lòng nhập ít nhất một tiêu chí tìm kiếm (nội dung, số tiền, hoặc phân loại chi tiết)!", "warning");
  }

  const cacheKey = `${searchMonth || 'all'}-${searchContent || 'none'}-${searchAmount || 'none'}-${searchCategory || 'none'}-${currentYear}`;
  if (cachedSearchResults && cachedSearchResults.cacheKey === cacheKey) {
    displaySearchResults(cachedSearchResults.data);
    return;
  }

  showLoading(true, 'tab6');
  try {
    const targetUrl = `${apiUrl}?action=searchTransactions${searchMonth ? `&month=${searchMonth}` : ''}${searchContent ? `&content=${encodeURIComponent(searchContent)}` : ''}${searchAmount ? `&amount=${searchAmount}` : ''}${searchCategory ? `&category=${encodeURIComponent(searchCategory)}` : ''}&year=${currentYear}&sheetId=${sheetId}`;
    const finalUrl = proxyUrl + encodeURIComponent(targetUrl);
    const response = await fetch(finalUrl);
    const searchData = await response.json();
    if (searchData.error) throw new Error(searchData.error);
    cachedSearchResults = { cacheKey, data: searchData };
    displaySearchResults(searchData);
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

  const totalPages = Math.ceil(data.length / searchPerPage);
  currentPageSearch = Math.min(currentPageSearch, totalPages);
  currentPageSearch = Math.max(currentPageSearch, 1);

  const startIndex = (currentPageSearch - 1) * searchPerPage;
  const endIndex = startIndex + searchPerPage;
  const paginatedData = data.slice(startIndex, endIndex);

  paginatedData.forEach((item, index) => {
    const transactionDiv = document.createElement('div');
    transactionDiv.className = 'transaction-box';
    transactionDiv.innerHTML = `
      <div class="id">ID: ${item.id}</div>
      <div class="number">Số thứ tự: ${startIndex + index + 1}</div>
      <div class="date">${formatDate(item.date)}</div>
      <div class="content">${item.content}</div>
      <div class="amount">${item.amount.toLocaleString('vi-VN')}đ</div>
      <div class="type ${item.type === 'Thu nhập' ? 'income' : 'expense'}">${item.type}</div>
      <div class="category">${item.category}</div>
      <div class="action-buttons">
        <button onclick="openEditForm(${JSON.stringify(item).replace(/"/g, '"')})">Sửa</button>
        <button onclick="deleteTransaction('${item.id}')">Xóa</button>
      </div>
    `;
    container.appendChild(transactionDiv);
  });

  pageInfo.textContent = `Trang ${currentPageSearch}/${totalPages}`;
  prevPageBtn.disabled = currentPageSearch === 1;
  nextPageBtn.disabled = currentPageSearch === totalPages;
}

window.prevPageSearch = function() {
  if (currentPageSearch > 1) {
    currentPageSearch--;
    displaySearchResults(cachedSearchResults.data);
  }
};

window.nextPageSearch = function() {
  const totalPages = Math.ceil(cachedSearchResults.data.length / searchPerPage);
  if (currentPageSearch < totalPages) {
    currentPageSearch++;
    displaySearchResults(cachedSearchResults.data);
  }
};

// Form chỉnh sửa giao dịch
async function fetchCategories() {
  try {
    const targetUrl = `${apiUrl}?action=getCategories&sheetId=${sheetId}`;
    const finalUrl = proxyUrl + encodeURIComponent(targetUrl);
    const response = await fetch(finalUrl);
    const categories = await response.json();
    if (categories.error) throw new Error(categories.error);
    return categories;
  } catch (error) {
    showToast("Lỗi khi lấy danh sách phân loại: " + error.message, "error");
    return [];
  }
}

window.openEditForm = async function(transaction) {
  if (!transaction) return showToast('Dữ liệu giao dịch không hợp lệ!', "error");
  const modal = document.getElementById('editModal');
  const form = document.getElementById('editForm');
  const categorySelect = document.getElementById('editCategory');
  const amountInput = document.getElementById('editAmount');
  const contentInput = document.getElementById('editContent');

  document.getElementById('editTransactionId').value = transaction.id || '';
  contentInput.value = transaction.content || '';
  amountInput.value = formatNumber(transaction.amount || 0);
  document.getElementById('editType').value = transaction.type || 'Thu nhập';
  document.getElementById('editNote').value = transaction.note || '';

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

  modal.style.display = 'flex';
  form.onsubmit = async function(e) {
    e.preventDefault();
    const dateInput = document.getElementById('editDate').value;
    if (!dateInput) return showModalError('edit', 'Vui lòng chọn ngày!');
    const inputDate = new Date(dateInput);
    const today = new Date();
    if (inputDate > today) return showModalError('edit', 'Không thể chọn ngày trong tương lai!');
    const amount = parseFormattedNumber(document.getElementById('editAmount').value);
    if (amount <= 0) return showModalError('edit', 'Số tiền phải lớn hơn 0!');
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
};

window.closeEditForm = function() {
  document.getElementById('editModal').style.display = 'none';
  document.getElementById('editError').style.display = 'none';
};

// Form thêm giao dịch
window.openAddForm = async function() {
  const modal = document.getElementById('addModal');
  const form = document.getElementById('addForm');
  const categorySelect = document.getElementById('addCategory');
  const amountInput = document.getElementById('addAmount');
  const contentInput = document.getElementById('addContent');

  document.getElementById('addDate').value = formatDateToYYYYMMDD(new Date());
  contentInput.value = '';
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

  modal.style.display = 'flex';
  form.onsubmit = async function(e) {
    e.preventDefault();
    const dateInput = document.getElementById('addDate').value;
    const [year, month, day] = dateInput.split('-');
    const formattedDate = `${day}/${month}/${year}`;
    const today = new Date();
    const inputDate = new Date(year, month - 1, day);
    if (inputDate > today) return showModalError('add', 'Không thể chọn ngày trong tương lai!');
    const amount = parseFormattedNumber(document.getElementById('addAmount').value);
    if (amount <= 0) return showModalError('add', 'Số tiền phải lớn hơn 0!');
    const newTransaction = {
      content: document.getElementById('addContent').value,
      amount: amount,
      type: document.getElementById('addType').value,
      category: document.getElementById('addCategory').value,
      note: document.getElementById('addNote').value || '',
      date: formattedDate,
      action: 'addTransaction'
    };
    await addTransaction(newTransaction);
  };
};

window.closeAddForm = function() {
  document.getElementById('addModal').style.display = 'none';
  document.getElementById('addError').style.display = 'none';
};

// Lưu giao dịch
async function saveTransaction(transaction) {
  showLoadingPopup();
  try {
    const targetUrl = `${apiUrl}?action=updateTransaction&id=${transaction.id}&content=${encodeURIComponent(transaction.content)}&amount=${transaction.amount}&type=${encodeURIComponent(transaction.type)}&category=${encodeURIComponent(transaction.category)}¬e=${encodeURIComponent(transaction.note)}&date=${encodeURIComponent(transaction.date)}&sheetId=${sheetId}`;
    const finalUrl = proxyUrl + encodeURIComponent(targetUrl);
    const response = await fetch(finalUrl, { method: 'POST' });
    const result = await response.json();
    if (result.error) throw new Error(result.error);
    showToast("Cập nhật giao dịch thành công!", "success");
    closeEditForm();
    cachedTransactions = null;
    cachedMonthlyExpenses = null;
    cachedSearchResults = null;
    cachedFinancialData = null;
    cachedChartData = null;
    await fetchTransactions();
  } catch (error) {
    showToast("Lỗi khi cập nhật giao dịch: " + error.message, "error");
  } finally {
    hideLoadingPopup();
  }
}

async function addTransaction(transaction) {
  showLoadingPopup();
  try {
    const targetUrl = `${apiUrl}?action=addTransaction&content=${encodeURIComponent(transaction.content)}&amount=${transaction.amount}&type=${encodeURIComponent(transaction.type)}&category=${encodeURIComponent(transaction.category)}¬e=${encodeURIComponent(transaction.note)}&date=${encodeURIComponent(transaction.date)}&sheetId=${sheetId}`;
    const finalUrl = proxyUrl + encodeURIComponent(targetUrl);
    const response = await fetch(finalUrl, { method: 'POST' });
    const result = await response.json();
    if (result.error) throw new Error(result.error);
    showToast("Thêm giao dịch thành công!", "success");
    closeAddForm();
    cachedTransactions = null;
    cachedMonthlyExpenses = null;
    cachedSearchResults = null;
    cachedFinancialData = null;
    cachedChartData = null;
    await fetchTransactions();
  } catch (error) {
    showToast("Lỗi khi thêm giao dịch: " + error.message, "error");
  } finally {
    hideLoadingPopup();
  }
}

window.deleteTransaction = async function(id) {
  if (!confirm('Bạn có chắc chắn muốn xóa giao dịch này?')) return;
  showLoadingPopup();
  try {
    const targetUrl = `${apiUrl}?action=deleteTransaction&id=${id}&sheetId=${sheetId}`;
    const finalUrl = proxyUrl + encodeURIComponent(targetUrl);
    const response = await fetch(finalUrl, { method: 'POST' });
    const result = await response.json();
    if (result.error) throw new Error(result.error);
    showToast("Xóa giao dịch thành công!", "success");
    cachedTransactions = null;
    cachedMonthlyExpenses = null;
    cachedSearchResults = null;
    cachedFinancialData = null;
    cachedChartData = null;
    await fetchTransactions();
  } catch (error) {
    showToast("Lỗi khi xóa giao dịch: " + error.message, "error");
  } finally {
    hideLoadingPopup();
  }
};

// Khởi tạo
document.addEventListener('DOMContentLoaded', () => {
  // Gắn sự kiện click cho các tab
  const tabs = document.querySelectorAll('.nav-item');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.getAttribute('data-tab');
      openTab(tabId);
    });
  });

  // Gắn sự kiện cho các nút
  document.getElementById('fetchTransactionsBtn').addEventListener('click', fetchTransactions);
  document.getElementById('addTransactionBtn').addEventListener('click', openAddForm);
  document.getElementById('fetchDataBtn').addEventListener('click', fetchData);
  document.getElementById('fetchMonthlyDataBtn').addEventListener('click', fetchMonthlyData); // Thêm lại sự kiện cho nút "Xem biểu đồ"
  document.getElementById('fetchMonthlyExpensesBtn').addEventListener('click', fetchMonthlyExpenses);
  document.getElementById('searchTransactionsBtn').addEventListener('click', searchTransactions);
  document.getElementById('prevPage').addEventListener('click', prevPage);
  document.getElementById('nextPage').addEventListener('click', nextPage);
  document.getElementById('prevPageMonthly').addEventListener('click', prevPageMonthly);
  document.getElementById('nextPageMonthly').addEventListener('click', nextPageMonthly);
  document.getElementById('prevPageSearch').addEventListener('click', prevPageSearch);
  document.getElementById('nextPageSearch').addEventListener('click', nextPageSearch);

  // Đặt ngày mặc định
  const today = new Date();
  document.getElementById('transactionDate').value = formatDateToYYYYMMDD(today);
  document.getElementById('startDate').value = formatDateToYYYYMMDD(new Date(today.getFullYear(), today.getMonth(), 1));
  document.getElementById('endDate').value = formatDateToYYYYMMDD(today);

  // Thiết lập mặc định cho Tab Biểu đồ: từ tháng 1 đến tháng hiện tại
  const currentMonth = today.getMonth() + 1; // Tháng hiện tại (1-12)
  document.getElementById('startMonth').value = 1; // Tháng 1
  document.getElementById('endMonth').value = currentMonth; // Tháng hiện tại
  document.getElementById('expenseMonth').value = currentMonth;
  document.getElementById('searchMonth').value = currentMonth;

  // Khởi tạo danh mục tìm kiếm
  populateSearchCategories();

  // Thêm sự kiện định dạng số tiền và xử lý placeholder cho các trường
  const editAmount = document.getElementById('editAmount');
  const addAmount = document.getElementById('addAmount');
  const searchAmount = document.getElementById('searchAmount');
  const editContent = document.getElementById('editContent');
  const addContent = document.getElementById('addContent');
  const searchContent = document.getElementById('searchContent');

  [editAmount, addAmount, searchAmount].forEach(input => {
    if (input) {
      input.addEventListener('input', function(e) {
        let cursorPosition = e.target.selectionStart;
        const originalLength = e.target.value.length;
        e.target.value = formatNumber(e.target.value);
        const newLength = e.target.value.length;
        cursorPosition += newLength - originalLength;
        e.target.setSelectionRange(cursorPosition, cursorPosition);
      });
    }
  });

  [editContent, addContent, searchContent].forEach(input => {
    if (input) {
      input.addEventListener('input', function(e) {
        if (e.target.value) {
          e.target.placeholder = '';
        } else {
          e.target.placeholder = 'Nhập nội dung';
        }
      });
    }
  });
});
