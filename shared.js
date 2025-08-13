// shared.js: Inject header and footer into all pages
document.addEventListener('DOMContentLoaded', function() {
  // Detect if we're in /pages or root
  const base = location.pathname.includes('/pages/') ? '../' : '';
  // Header
  const headerDiv = document.getElementById('header');
  if (headerDiv) {
    fetch(base + 'header.html')
      .then(res => res.text())
      .then(html => {
        headerDiv.innerHTML = html;
        setupModalEvents();
      });
  } else {
    setupModalEvents(); // fallback if header not present
  }
  // Footer
  const footerDiv = document.getElementById('footer');
  if (footerDiv) {
    fetch(base + 'footer.html')
      .then(res => res.text())
      .then(html => { footerDiv.innerHTML = html; });
  }

  // Modal logic must be attached after header injection
  function setupModalEvents() {
    // Modal open/close logic
    function showModal() {
      const modal = document.getElementById('pricelist-modal');
      if (modal) modal.classList.remove('hidden');
    }
    function hideModal() {
      const modal = document.getElementById('pricelist-modal');
      if (modal) modal.classList.add('hidden');
    }
    // Open modal buttons
    const openBtns = [
      document.getElementById('open-pricelist-modal'),
      document.getElementById('open-pricelist-modal-mobile')
    ].filter(Boolean);
    openBtns.forEach(btn => btn.addEventListener('click', showModal));
    // Close modal button
    const closeBtn = document.getElementById('close-pricelist-modal');
    if (closeBtn) closeBtn.addEventListener('click', hideModal);
    // Close on backdrop click
    const modal = document.getElementById('pricelist-modal');
    if (modal) {
      modal.addEventListener('click', function(e) {
        if (e.target === modal) hideModal();
      });
    }

    // --- Pricelist logic ---
    let ITEMS = [];
    let FILTERED_ITEMS = [];
    let customItemCount = 1;
    const itemsContainer = document.getElementById('items-container');
    const searchInput = document.getElementById('pricelist-search');
    const userEmailInput = document.getElementById('user-email');
    const sendBtn = document.getElementById('send-request-btn');
    const addCustomBtn = document.getElementById('add-custom-item');
    // Success banner
    function showSuccessBanner() {
      const banner = document.getElementById('success-banner');
      if (!banner) return;
      banner.classList.remove('hidden');
      launchConfetti();
      setTimeout(() => {
        banner.classList.add('hidden');
        hideModal();
      }, 3500);
    }
    function launchConfetti() {
      const canvas = document.getElementById('confetti-canvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      let particles = [];
      for (let i = 0; i < 150; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          r: Math.random() * 6 + 4,
          d: Math.random() * 150,
          color: `hsl(${Math.random()*360},70%,60%)`,
          tilt: Math.random() * 10 - 10
        });
      }
      let angle = 0;
      function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        angle += 0.01;
        for (let i = 0; i < particles.length; i++) {
          let p = particles[i];
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI*2, false);
          ctx.fillStyle = p.color;
          ctx.fill();
          p.y += Math.cos(angle + p.d) + 1 + p.r/2;
          p.x += Math.sin(angle) * 2;
          if (p.y > canvas.height) {
            p.x = Math.random() * canvas.width;
            p.y = -10;
          }
        }
        requestAnimationFrame(draw);
      }
      draw();
    }

    // Load pricelist.xlsx from media/ directory
    async function loadPricelist() {
      try {
        const pricelistPath = location.pathname.includes('/pages/') ? '../media/pricelist.xlsx' : 'media/pricelist.xlsx';
        const response = await fetch(pricelistPath);
        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, {type: 'array'});
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet);
        ITEMS = json;
        FILTERED_ITEMS = ITEMS;
        renderProductTable();
        updateTotal();
        renderCustomItems();
      } catch (e) {
        if (itemsContainer) itemsContainer.innerHTML = '<div class="text-red-500">Failed to load pricelist.</div>';
      }
    }

    // Render product table
    function renderProductTable() {
      const tbody = document.getElementById('product-table-body');
      if (!tbody) return;
      tbody.innerHTML = '';
      const data = (typeof FILTERED_ITEMS !== 'undefined' && searchInput && searchInput.value) ? FILTERED_ITEMS : ITEMS;
      data.forEach((item, i) => {
        tbody.innerHTML += `
          <tr class="text-black">
            <td class="p-2 text-center">
              <input type="checkbox" class="item-checkbox" data-idx="${i}">
            </td>
            <td class="p-2">${item['PRODUCT DESCRIPTION'] || ''}</td>
            <td class="p-2">${item['UNIT'] || ''}</td>
            <td class="p-2">
              <input type="number" min="1" value="1" class="item-qty border rounded-md px-2 py-1 w-20" data-idx="${i}" disabled>
            </td>
            <td class="p-2 item-line-total" id="line-total-${i}">0 ${item['UNIT'] || ''}</td>
          </tr>
        `;
      });
      // Checkbox logic
      tbody.querySelectorAll('.item-checkbox').forEach(cb => {
        cb.onchange = function() {
          const idx = this.getAttribute('data-idx');
          const qtyInput = tbody.querySelector(`.item-qty[data-idx="${idx}"]`);
          qtyInput.disabled = !this.checked;
          updateTotal();
        };
      });
      // Quantity logic
      tbody.querySelectorAll('.item-qty').forEach(input => {
        input.oninput = updateTotal;
      });
      renderCustomItems();
    }

    // Custom items
    function renderCustomItems() {
      const customBody = document.getElementById('custom-items-body');
      if (!customBody) return;
      if (customBody.children.length === 0) addCustomItemRow(); // Always have at least one row
      // Update event listeners for all custom rows
      Array.from(customBody.children).forEach(row => {
        const cb = row.querySelector('.custom-item-checkbox');
        const desc = row.querySelector('.custom-item-desc');
        const unit = row.querySelector('.custom-item-unit');
        const qty = row.querySelector('.custom-item-qty');
        cb.onchange = function() {
          const enabled = cb.checked;
          desc.disabled = !enabled;
          unit.disabled = !enabled;
          qty.disabled = !enabled;
          updateTotal();
        };
        desc.oninput = updateTotal;
        unit.oninput = updateTotal;
        qty.oninput = updateTotal;
        // Remove row button
        const removeBtn = row.querySelector('.remove-custom-item');
        if (removeBtn) {
          removeBtn.onclick = function() {
            row.remove();
            updateTotal();
          };
        }
      });
    }
    function addCustomItemRow() {
      const customBody = document.getElementById('custom-items-body');
      if (!customBody) return;
      const rowId = `custom-${customItemCount++}`;
      const row = document.createElement('tr');
      row.classList.add('text-black');
      row.innerHTML = `
        <td class="p-2 text-center">
          <input type="checkbox" class="custom-item-checkbox" data-idx="${rowId}">
        </td>
        <td class="p-2">
          <input type="text" class="custom-item-desc border rounded-md px-2 py-1 w-full" placeholder="Other item (describe)" disabled>
        </td>
        <td class="p-2">
          <input type="text" class="custom-item-unit border rounded-md px-2 py-1 w-20" placeholder="Unit" disabled>
        </td>
        <td class="p-2">
          <input type="number" min="1" value="1" class="custom-item-qty border rounded-md px-2 py-1 w-20" disabled>
        </td>
        <td class="p-2 item-line-total" id="line-total-${rowId}">0</td>
        <td class="p-2">
          <button type="button" class="remove-custom-item text-red-500 hover:text-red-700 text-lg" title="Remove">&times;</button>
        </td>
      `;
      customBody.appendChild(row);
      renderCustomItems();
    }
    if (addCustomBtn) addCustomBtn.addEventListener('click', addCustomItemRow);

    // Update totals
    function updateTotal() {
      const tbody = document.getElementById('product-table-body');
      if (!tbody) return;
      tbody.querySelectorAll('.item-checkbox').forEach(cb => {
        const idx = cb.getAttribute('data-idx');
        const qtyInput = tbody.querySelector(`.item-qty[data-idx="${idx}"]`);
        const lineTotalCell = tbody.querySelector(`#line-total-${idx}`);
        let lineTotal = 0;
        let unit = ITEMS[idx] && ITEMS[idx]['UNIT'] ? ITEMS[idx]['UNIT'] : '';
        if (cb.checked) {
          const qty = parseInt(qtyInput.value) || 1;
          lineTotal = qty;
        }
        if (lineTotalCell) lineTotalCell.textContent = `${lineTotal} ${unit}`;
      });
      // Custom rows
      const customRows = document.querySelectorAll('#custom-items-body tr');
      customRows.forEach(row => {
        const cb = row.querySelector('.custom-item-checkbox');
        const unit = row.querySelector('.custom-item-unit');
        const qty = row.querySelector('.custom-item-qty');
        const lineTotalCell = row.querySelector('.item-line-total');
        if (cb && cb.checked) {
          const q = parseInt(qty.value) || 1;
          const u = unit.value || '';
          if (lineTotalCell) lineTotalCell.textContent = `${q} ${u}`;
        } else if (lineTotalCell) {
          lineTotalCell.textContent = '0';
        }
      });
    }

    // Email validation and button enable
    if (userEmailInput && sendBtn) {
      userEmailInput.addEventListener('input', function() {
        sendBtn.disabled = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.value);
      });
    }

    // Search/filter logic
    if (searchInput) {
      searchInput.addEventListener('input', function() {
        const q = this.value.trim().toLowerCase();
        FILTERED_ITEMS = ITEMS.filter(item =>
          (item['PRODUCT DESCRIPTION'] || '').toLowerCase().includes(q)
        );
        renderProductTable();
        updateTotal();
        renderCustomItems();
      });
    }

    // Pricelist Excel export using template.xlsx and send to Formspree
    const pricelistForm = document.getElementById('pricelist-form');
    if (pricelistForm) {
      pricelistForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const tbody = document.getElementById('product-table-body');
        const rows = [];
        if (tbody) {
          tbody.querySelectorAll('.item-checkbox').forEach(cb => {
            const idx = cb.getAttribute('data-idx');
            if (cb.checked) {
              const item = ITEMS[idx];
              const qty = parseInt(tbody.querySelector(`.item-qty[data-idx="${idx}"]`).value) || 1;
              rows.push({
                "PRODUCT DESCRIPTION": item['PRODUCT DESCRIPTION'],
                "UNIT": item['UNIT'],
                "QUANTITY": qty
              });
            }
          });
        }
        // Add all custom items if present
        const customRows = document.querySelectorAll('#custom-items-body tr');
        customRows.forEach(row => {
          const cb = row.querySelector('.custom-item-checkbox');
          const desc = row.querySelector('.custom-item-desc');
          const unit = row.querySelector('.custom-item-unit');
          const qty = row.querySelector('.custom-item-qty');
          if (cb && cb.checked && desc.value.trim() && unit.value.trim()) {
            rows.push({
              "PRODUCT DESCRIPTION": desc.value.trim() + " (Custom Request)",
              "UNIT": unit.value.trim(),
              "QUANTITY": parseInt(qty.value) || 1
            });
          }
        });
        if (rows.length === 0) {
          alert("Please select at least one item.");
          return;
        }
        const userEmail = userEmailInput.value.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail)) {
          alert("Please enter a valid email address.");
          return;
        }

        // Load template.xlsx and fill it
        try {
          const templatePath = location.pathname.includes('/pages/') ? '../media/template.xlsx' : 'media/template.xlsx';
          const response = await fetch(templatePath);
          const arrayBuffer = await response.arrayBuffer();
          const workbook = new ExcelJS.Workbook();
          await workbook.xlsx.load(arrayBuffer);
          const worksheet = workbook.worksheets[0];
          // Start filling from C20 (row 20, column 3)
          let startRow = 20;
          rows.forEach((row, i) => {
            worksheet.getCell(`C${startRow + i}`).value = row["PRODUCT DESCRIPTION"];
            worksheet.getCell(`D${startRow + i}`).value = row["UNIT"];
            worksheet.getCell(`F${startRow + i}`).value = row["QUANTITY"];
          });
          // Convert workbook to Blob
          const buf = await workbook.xlsx.writeBuffer();
          const file = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
          // Send to Formspree
          const formData = new FormData();
          formData.append('email', userEmail);
          formData.append('file', file, 'quotation.xlsx');
          formData.append('_subject', 'New Quotation Request');
          formData.append('message', 'Quotation request from website. Please see attached Excel file.');
          sendBtn.disabled = true;
          sendBtn.textContent = "Sending...";
          const res = await fetch('https://formspree.io/f/your-form-id', {
            method: 'POST',
            body: formData
          });
          if (res.ok) {
            showSuccessBanner();
          } else {
            alert('Failed to send request. Please try again later.');
          }
        } catch (err) {
          alert('Failed to send request. Please try again later.');
        }
        sendBtn.disabled = false;
        sendBtn.textContent = "Send Request";
      });
    }

    // Load pricelist on modal open (if not already loaded)
    let pricelistLoaded = false;
    openBtns.forEach(btn => btn.addEventListener('click', function() {
      if (!pricelistLoaded) {
        loadPricelist();
        pricelistLoaded = true;
      }
    }));
  }
});

// Auto-inject mobile sidebar menu for all pages
function injectMobileSidebarMenu() {
  if (document.getElementById('mobile-menu-btn')) return; // Prevent duplicate injection
  // Styles
  const style = document.createElement('style');
  style.innerHTML = `
    @media (min-width: 769px), (orientation: landscape) {
      #mobile-menu-btn, #mobile-sidebar-overlay, #mobile-sidebar-menu { display: none !important; }
    }
    @media (max-width: 768px) and (orientation: portrait) {
      #mobile-menu-btn { display: block !important; }
    }
    #mobile-menu-btn {
      position: fixed; top: 1.25rem; right: 1.25rem; z-index: 11000;
      background: transparent; border: none; color: #fff; font-size: 2.5rem; cursor: pointer; display: none;
    }
    #mobile-sidebar-overlay {
      position: fixed; inset: 0; background: rgba(44,62,80,0.5); z-index: 10999; display: none;
    }
    #mobile-sidebar-menu {
      position: fixed; top: 0; right: 0; width: 80vw; height: 100vh; background: #1A2634; color: #fff;
      z-index: 11000; box-shadow: -4px 0 32px rgba(44,62,80,0.18); display: flex; flex-direction: column;
      padding: 2rem 1.5rem 1.5rem 1.5rem; transform: translateX(100%);
      transition: transform 0.35s cubic-bezier(.4,2,.6,1);
    }
    #mobile-sidebar-menu.open { transform: translateX(0); }
    #mobile-sidebar-overlay.open { display: block; }
    .mobile-sidebar-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem; }
    .mobile-brand { display: flex; align-items: center; gap: 0.75rem; }
    .mobile-brand i { color: #F39C12; font-size: 2rem; }
    .mobile-brand span { font-size: 1.25rem; font-weight: bold; color: #fff; }
    #mobile-sidebar-close { background: none; border: none; color: #fff; font-size: 2.25rem; cursor: pointer; margin-left: auto; }
    .mobile-sidebar-nav { display: flex; flex-direction: column; gap: 1.5rem; margin-bottom: 2.5rem; }
    .mobile-sidebar-nav a { color: #fff; font-size: 1.1rem; font-weight: 500; text-decoration: none; transition: color 0.2s; }
    .mobile-sidebar-nav a:hover { color: #F39C12; }
    .mobile-sidebar-phone { display: flex; align-items: center; gap: 0.75rem; font-size: 1.1rem; margin-bottom: 2rem; color: #fff; }
    .mobile-sidebar-phone i { color: #F39C12; font-size: 1.25rem; }
    .mobile-sidebar-quote { display: flex; justify-content: center; margin-bottom: 2.5rem; }
    .mobile-sidebar-quote-btn { background: #F39C12; color: #2C3E50; font-weight: bold; font-size: 1.1rem; padding: 0.75rem 2rem; border-radius: 0.75rem; border: none; cursor: pointer; box-shadow: 0 2px 12px rgba(44,62,80,0.10); transition: background 0.2s, color 0.2s; }
    .mobile-sidebar-quote-btn:hover { background: #e08e0b; color: #fff; }
    .mobile-sidebar-bottom { margin-top: auto; display: flex; align-items: center; justify-content: flex-end; gap: 1.25rem; }
    .mobile-sidebar-bottom i { font-size: 1.5rem; color: #F39C12; cursor: pointer; transition: color 0.2s; }
    .mobile-sidebar-bottom i:hover { color: #fff; }
    #mobile-sidebar-search { background: none; border: none; color: #F39C12; font-size: 1.5rem; cursor: pointer; transition: color 0.2s; }
    #mobile-sidebar-search:hover { color: #fff; }
    .mobile-search-bar { position: absolute; left: 0; right: 0; bottom: 0; width: 100%; padding: 1.5rem; background: rgba(44,62,80,0.7); backdrop-filter: blur(12px); border-radius: 0 0 1rem 1rem; display: none; z-index: 11001; animation: fadeIn 0.3s; }
    .mobile-search-bar.open { display: flex; align-items: center; gap: 1rem; }
    .mobile-search-bar input { flex: 1; padding: 0.75rem 1rem; border-radius: 0.5rem; border: none; font-size: 1rem; background: rgba(255,255,255,0.15); color: #fff; outline: none; box-shadow: 0 2px 8px rgba(44,62,80,0.10); }
    .mobile-search-bar input::placeholder { color: #fff; opacity: 0.7; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  `;
  document.head.appendChild(style);
  // Markup
  document.body.insertAdjacentHTML('beforeend', `
    <button id="mobile-menu-btn" style="display:none;"><i class="fas fa-bars"></i></button>
    <div id="mobile-sidebar-overlay"></div>
    <aside id="mobile-sidebar-menu">
      <div class="mobile-sidebar-header">
        <div class="mobile-brand">
          <i class="fas fa-anchor"></i>
          <span>Mombasa Marine Supply</span>
        </div>
        <button id="mobile-sidebar-close"><i class="fas fa-times"></i></button>
      </div>
      <nav class="mobile-sidebar-nav">
        <a href="index.html">Home</a>
        <a href="index.html#services">Services</a>
        <a href="index.html#equipment">Equipment</a>
        <a href="index.html#port-services">Port Services</a>
        <a href="index.html#about">About</a>
        <a href="index.html#contact">Contact</a>
      </nav>
      <div class="mobile-sidebar-phone">
        <i class="fas fa-phone"></i>
        <span>+254 700 123 456</span>
      </div>
      <div class="mobile-sidebar-quote">
        <button class="mobile-sidebar-quote-btn" id="mobile-sidebar-quote-btn">Request Quote</button>
      </div>
      <div class="mobile-sidebar-bottom">
        <button id="mobile-sidebar-search"><i class="fas fa-search"></i></button>
        <a href="#"><i class="fab fa-twitter"></i></a>
        <a href="#"><i class="fab fa-instagram"></i></a>
        <a href="#"><i class="fab fa-linkedin-in"></i></a>
      </div>
      <div class="mobile-search-bar" id="mobile-search-bar">
        <input type="text" id="mobile-search-input" placeholder="Search the website...">
      </div>
    </aside>
  `);
  // Script
  function updateMobileMenuBtn() {
    const btn = document.getElementById('mobile-menu-btn');
    if (window.innerWidth <= 768 && window.matchMedia('(orientation: portrait)').matches) {
      btn.style.display = 'block';
    } else {
      btn.style.display = 'none';
    }
  }
  window.addEventListener('resize', updateMobileMenuBtn);
  document.addEventListener('DOMContentLoaded', updateMobileMenuBtn);
  // Sidebar open/close logic
  const menuBtn = document.getElementById('mobile-menu-btn');
  const sidebar = document.getElementById('mobile-sidebar-menu');
  const overlay = document.getElementById('mobile-sidebar-overlay');
  const closeBtn = document.getElementById('mobile-sidebar-close');
  menuBtn.addEventListener('click', function() {
    sidebar.classList.add('open');
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  });
  function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    document.getElementById('mobile-search-bar').classList.remove('open');
  }
  overlay.addEventListener('click', closeSidebar);
  closeBtn.addEventListener('click', closeSidebar);
  // Request Quote button opens pricelist modal
  const quoteBtn = document.getElementById('mobile-sidebar-quote-btn');
  if (quoteBtn) quoteBtn.addEventListener('click', function() {
    closeSidebar();
    const pricelistModal = document.getElementById('pricelist-modal');
    if (pricelistModal) pricelistModal.classList.remove('hidden');
  });
  // Search bar toggle
  const searchBtn = document.getElementById('mobile-sidebar-search');
  const searchBar = document.getElementById('mobile-search-bar');
  searchBtn.addEventListener('click', function() {
    searchBar.classList.toggle('open');
    if (searchBar.classList.contains('open')) {
      document.getElementById('mobile-search-input').focus();
    }
  });
  // Search bar blur effect
  searchBar.addEventListener('click', function(e) {
    e.stopPropagation();
  });
  // Search logic (simple site-wide search)
  document.getElementById('mobile-search-input').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      const q = this.value.trim().toLowerCase();
      if (q) {
        window.location.href = 'index.html#search?q=' + encodeURIComponent(q);
        closeSidebar();
      }
    }
  });
}
// Inject after header loads
// Responsive Navigation System (Hamburger & Sidebar)
function injectResponsiveNavbar() {
  if (document.getElementById('responsive-hamburger-btn')) return; // Prevent duplicate injection
  // Styles
  const style = document.createElement('style');
  style.innerHTML = `
    @media (min-width: 1251px) {
      #responsive-hamburger-btn, #responsive-sidebar-overlay, #responsive-sidebar-menu { display: none !important; }
      .responsive-navbar { display: flex !important; }
    }
    @media (max-width: 1250px) {
      #responsive-hamburger-btn { display: block !important; animation: fadeInRight 0.4s; }
      .responsive-navbar { display: none !important; }
    }
    #responsive-hamburger-btn {
      position: fixed; top: 1.5rem; right: 1.5rem; z-index: 1000;
      background: transparent; border: none; color: #fff; font-size: 2.5rem; cursor: pointer; display: none;
      transition: opacity 0.3s;
      opacity: 0;
      animation: fadeInRight 0.4s forwards;
    }
    @keyframes fadeInRight {
      from { opacity: 0; transform: translateX(40px); }
      to { opacity: 1; transform: translateX(0); }
    }
    #responsive-sidebar-overlay {
      position: fixed; inset: 0; background: rgba(44,62,80,0.5); z-index: 999; display: none;
      transition: opacity 0.3s;
      opacity: 0;
    }
    #responsive-sidebar-overlay.open {
      display: block;
      opacity: 1;
    }
    #responsive-sidebar-menu {
      position: fixed; top: 0; right: 0; width: 80vw; max-width: 400px; height: 100vh; background: #1A2634; color: #fff;
      z-index: 1000; box-shadow: -4px 0 32px rgba(44,62,80,0.18); display: flex; flex-direction: column;
      padding: 2rem 1.5rem 1.5rem 1.5rem; opacity: 0; pointer-events: none;
      transition: opacity 0.35s cubic-bezier(.4,2,.6,1);
    }
    #responsive-sidebar-menu.open {
      opacity: 1; pointer-events: auto;
      animation: fadeInSidebar 0.35s;
    }
    @keyframes fadeInSidebar {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    #responsive-sidebar-close {
      background: none; border: none; color: #fff; font-size: 2.25rem; cursor: pointer; margin-left: auto; }
    .responsive-sidebar-nav {
      display: flex; flex-direction: column; gap: 1.5rem; margin-bottom: 2.5rem;
      opacity: 0; transform: translateY(20px); transition: opacity 0.4s, transform 0.4s;
    }
    #responsive-sidebar-menu.open .responsive-sidebar-nav {
      opacity: 1; transform: translateY(0);
    }
    .responsive-sidebar-nav a {
      color: #fff; font-size: 1.8rem; font-weight: 500; text-decoration: none; transition: color 0.2s;
    }
    .responsive-sidebar-nav a:hover { color: #F39C12; }
    .responsive-sidebar-phone { display: flex; align-items: center; gap: 0.75rem; font-size: 1.1rem; margin-bottom: 2rem; color: #fff; }
    .responsive-sidebar-phone i { color: #F39C12; font-size: 1.25rem; }
    .responsive-sidebar-quote { display: flex; justify-content: center; margin-bottom: 2.5rem; }
    .responsive-sidebar-quote-btn { background: #F39C12; color: #2C3E50; font-weight: bold; font-size: 1.1rem; padding: 0.75rem 2rem; border-radius: 0.75rem; border: none; cursor: pointer; box-shadow: 0 2px 12px rgba(44,62,80,0.10); transition: background 0.2s, color 0.2s; }
    .responsive-sidebar-quote-btn:hover { background: #e08e0b; color: #fff; }
    .responsive-sidebar-bottom { margin-top: auto; display: flex; align-items: center; justify-content: flex-end; gap: 1.25rem; }
    .responsive-sidebar-bottom i { font-size: 1.5rem; color: #F39C12; cursor: pointer; transition: color 0.2s; }
    .responsive-sidebar-bottom i:hover { color: #fff; }
    #responsive-sidebar-search { background: none; border: none; color: #F39C12; font-size: 1.5rem; cursor: pointer; transition: color 0.2s; }
    #responsive-sidebar-search:hover { color: #fff; }
    .responsive-search-bar { position: absolute; left: 0; right: 0; bottom: 0; width: 100%; padding: 1.5rem; background: rgba(44,62,80,0.7); backdrop-filter: blur(12px); border-radius: 0 0 1rem 1rem; display: none; z-index: 1001; animation: fadeIn 0.3s; }
    .responsive-search-bar.open { display: flex; align-items: center; gap: 1rem; }
    .responsive-search-bar input { flex: 1; padding: 0.75rem 1rem; border-radius: 0.5rem; border: none; font-size: 1rem; background: rgba(255,255,255,0.15); color: #fff; outline: none; box-shadow: 0 2px 8px rgba(44,62,80,0.10); }
    .responsive-search-bar input::placeholder { color: #fff; opacity: 0.7; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    /* Hamburger/Close icon animation */
    .hamburger-icon, .close-icon {
      position: absolute; top: 0; right: 0; width: 2.5rem; height: 2.5rem; display: flex; align-items: center; justify-content: center;
      transition: opacity 0.3s;
    }
    .hamburger-icon { opacity: 1; }
    .close-icon { opacity: 0; }
    #responsive-sidebar-menu.open ~ #responsive-hamburger-btn .hamburger-icon { opacity: 0; }
    #responsive-sidebar-menu.open ~ #responsive-hamburger-btn .close-icon { opacity: 1; }
  `;
  document.head.appendChild(style);
  // Markup
  document.body.insertAdjacentHTML('beforeend', `
    <button id="responsive-hamburger-btn" style="display:none;">
      <span class="hamburger-icon"><i class="fas fa-bars"></i></span>
      <span class="close-icon"><i class="fas fa-times"></i></span>
    </button>
    <div id="responsive-sidebar-overlay"></div>
    <aside id="responsive-sidebar-menu">
      <div class="responsive-sidebar-header" style="display: flex; align-items: center; justify-content: space-between;">
        <div class="mobile-brand" style="display: flex; align-items: center; gap: 0.75rem;">
          <i class="fas fa-anchor" style="color: #F39C12; font-size: 2rem;"></i>
        </div>
        <button id="responsive-sidebar-close" style="background: none; border: none; color: #fff; font-size: 2.25rem; cursor: pointer; margin-left: auto;"><i class="fas fa-times"></i></button>
      </div>
      <div class="responsive-sidebar-content" style="display: flex; flex-direction: column; align-items: center; width: 100%; gap: 1.5rem; margin-top: 2rem;">
        <nav class="responsive-sidebar-nav" style="display: flex; flex-direction: column; align-items: center; gap: 1.5rem; margin-bottom: 2.5rem; padding-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.08); width: 100%;">
          <a href="index.html">Home</a>
          <a href="index.html#services">Services</a>
          <a href="index.html#equipment">Equipment</a>
          <a href="index.html#port-services">Port Services</a>
          <a href="index.html#about">About</a>
          <a href="index.html#contact">Contact</a>
        </nav>
        <div class="responsive-sidebar-phone" style="display: flex; flex-direction: column; align-items: center; gap: 0.75rem; font-size: 1.1rem; margin-bottom: 2rem; color: #fff; padding-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.08); width: 100%;">
          <i class="fas fa-phone"></i>
          <span>+254 700 123 456</span>
        </div>
        <div class="responsive-sidebar-quote" style="display: flex; flex-direction: column; align-items: center; justify-content: center; margin-bottom: 2.5rem; width: 100%; padding-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.08);">
          <button class="responsive-sidebar-quote-btn" id="responsive-sidebar-quote-btn">Request Quote</button>
        </div>
        <div class="responsive-sidebar-bottom" style="margin-top: 2rem; display: flex; align-items: center; justify-content: center; gap: 2.5rem; width: 100%;">
          <button id="responsive-sidebar-search"><i class="fas fa-search"></i></button>
          <a href="#"><i class="fab fa-twitter"></i></a>
          <a href="#"><i class="fab fa-instagram"></i></a>
          <a href="#"><i class="fab fa-linkedin-in"></i></a>
        </div>
        <div class="responsive-search-bar" id="responsive-search-bar">
          <input type="text" id="responsive-search-input" placeholder="Search the website...">
        </div>
      </div>
    </aside>
  `);
  // Script
  function updateHamburgerBtn() {
    const btn = document.getElementById('responsive-hamburger-btn');
    if (window.innerWidth <= 1250) {
      btn.style.display = 'block';
      btn.style.opacity = '1';
    } else {
      btn.style.display = 'none';
      btn.style.opacity = '0';
    }
  }
  window.addEventListener('resize', updateHamburgerBtn);
  document.addEventListener('DOMContentLoaded', updateHamburgerBtn);
  // Sidebar open/close logic
  const menuBtn = document.getElementById('responsive-hamburger-btn');
  const sidebar = document.getElementById('responsive-sidebar-menu');
  const overlay = document.getElementById('responsive-sidebar-overlay');
  const closeBtn = document.getElementById('responsive-sidebar-close');
  menuBtn.addEventListener('click', function() {
    sidebar.classList.add('open');
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    // Animate hamburger/close icon
    menuBtn.querySelector('.hamburger-icon').style.opacity = '0';
    menuBtn.querySelector('.close-icon').style.opacity = '1';
    // Always close search bar when sidebar opens
    document.getElementById('responsive-search-bar').classList.remove('open');
  });
  function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    menuBtn.querySelector('.hamburger-icon').style.opacity = '1';
    menuBtn.querySelector('.close-icon').style.opacity = '0';
    document.getElementById('responsive-search-bar').classList.remove('open');
  }
  overlay.addEventListener('click', closeSidebar);
  closeBtn.addEventListener('click', closeSidebar);
  // Clicking anywhere in sidebar closes search bar
  sidebar.addEventListener('click', function(e) {
    if (!e.target.closest('#responsive-sidebar-search') && !e.target.closest('#responsive-search-bar')) {
      document.getElementById('responsive-search-bar').classList.remove('open');
    }
  });
    // Ensure sidebar closes every time a link is clicked (nav, phone, socials)
    sidebar.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', closeSidebar);
    });
  // Request Quote button opens pricelist modal
  const quoteBtn = document.getElementById('responsive-sidebar-quote-btn');
  if (quoteBtn) quoteBtn.addEventListener('click', function() {
    closeSidebar();
    const pricelistModal = document.getElementById('pricelist-modal');
    if (pricelistModal) pricelistModal.classList.remove('hidden');
  });
  // Search bar toggle
  const searchBtn = document.getElementById('responsive-sidebar-search');
  const searchBar = document.getElementById('responsive-search-bar');
  searchBtn.addEventListener('click', function() {
    searchBar.classList.toggle('open');
    if (searchBar.classList.contains('open')) {
      document.getElementById('responsive-search-input').focus();
    }
  });
  // Search bar blur effect
  searchBar.addEventListener('click', function(e) { e.stopPropagation(); });
  // Search logic (simple site-wide search)
  document.getElementById('responsive-search-input').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      const q = this.value.trim().toLowerCase();
      if (q) {
        window.location.href = 'index.html#search?q=' + encodeURIComponent(q);
        closeSidebar();
      }
    }
  });
  // Ensure hamburger stays behind modals/overlays
  menuBtn.style.zIndex = '1000';
  overlay.style.zIndex = '999';
  sidebar.style.zIndex = '1000';
}

window.addEventListener('DOMContentLoaded', injectResponsiveNavbar);

