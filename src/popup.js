document.addEventListener("DOMContentLoaded", () => {
  const editor = document.getElementById("editor");
  const addBtn = document.getElementById("addBtn");
  const bbTodoList = document.getElementById("todoList");
  const searchBox = document.getElementById("searchBox");
  const STORAGE_KEY = "bb-todos";
  
  const undoToast = document.getElementById("undoToast");
  const undoBtn = document.getElementById("undoBtn");

  const settingsBtn = document.getElementById("settingsBtn");
  const settingsModal = document.getElementById("settingsModal");
  const closeSettings = document.getElementById("closeSettings");
  const themeSelect = document.getElementById("themeSelect");

  const STATUS = {
    waiting: { key: "W", label: "Waiting" },
    in_progress: { key: "I", label: "In Progress" },
    done: { key: "C", label: "Closed" }
  };

  let todos = [];
  let currentTab = "active";
  let lastDeletedTodo = null;
  let undoTimeout = null;


  /* ---------------- STORAGE ---------------- */

  function loadTodos() {
    if (!chrome?.storage?.local) {
      todos = [];
      render();
      return;
    }

    chrome.storage.local.get(STORAGE_KEY, result => {
      todos = Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
      render();
    });
  }

  function saveTodos() {
    if (!chrome?.storage?.local) return;
    chrome.storage.local.set({ [STORAGE_KEY]: todos });
  }

  /* ---------------- STATUS MENU ---------------- */

  let openMenu = null;

  function createStatusBadge(todo) {
    const badge = document.createElement("div");
    const meta = STATUS[todo.status];

    badge.className = `status-badge status-${meta.key}`;
    badge.textContent = meta.key;

    badge.onclick = e => {
      e.stopPropagation();
      closeMenu();

      const rect = badge.getBoundingClientRect();
      const menu = document.createElement("div");
      menu.className = "status-menu";

      Object.entries(STATUS).forEach(([status, m]) => {
        if (status === todo.status) return;
        const item = document.createElement("div");
        item.textContent = `${m.key} - ${m.label}`;
        item.onclick = () => {
          todo.status = status;
          saveTodos();
          render();
          closeMenu();
        };
        menu.appendChild(item);
      });

      menu.style.top = `${rect.bottom + 6}px`;
      menu.style.left = `${rect.left}px`;

      document.body.appendChild(menu);
      openMenu = menu;
    };

    return badge;
  }

  function closeMenu() {
    if (openMenu) {
      openMenu.remove();
      openMenu = null;
    }
  }

  document.addEventListener("click", closeMenu);

  /* ---------------- ADD TODO (💥 FIX HERE) ---------------- */

  addBtn.onclick = () => {
    const html = editor.innerHTML.trim();
    if (!html) return;

    todos.unshift({
      id: crypto.randomUUID(),
      content: html,
      status: "waiting",
      createdAt: Date.now()
    });

    editor.innerHTML = "";

    render();     // 🔑 HEMEN GÖRÜNTÜLE
    saveTodos();  // 🔑 ARKADA KAYDET
  };

  /* ---------------- RENDER ---------------- */

  function render() {
    const q = searchBox.value.toLowerCase();
    bbTodoList.innerHTML = "";

    
    todos.filter(t => {
        if (currentTab === "done" && t.status !== "done") return false;
        if (currentTab !== "done" && t.status === "done") return false;

        const tmp = document.createElement("div");
        tmp.innerHTML = t.content;
        return tmp.innerText.toLowerCase().includes(q);
      })
    .forEach(t => {
        const li = document.createElement("li");
        li.className = "todo-item";

        const badge = createStatusBadge(t);

        const content = document.createElement("div");
        content.className = "todo-content";
        content.innerHTML = '&nbsp;&nbsp;'+t.content;
        if (t.status === "done") content.classList.add("done");

        const del = document.createElement("button");
        del.className = "delete-btn";
        del.textContent = "🗑️";
        del.onclick = (e) => {
          e.stopPropagation();
          
          // const confirmed = confirm("Bu görevi silmek istediğinize emin misiniz?");
          // if (confirmed) {
            // Silinen öğeyi yedekle
            lastDeletedTodo = { ...t };

            todos = todos.filter(x => x.id !== t.id);
            render();
            saveTodos();

            // Geri al bildirimini göster
            showUndoToast();
          }
        //};

        li.appendChild(badge);
        li.appendChild(content);
        li.appendChild(del);

        bbTodoList.appendChild(li);
      });
  }

  function showUndoToast() {
    // Eğer hali hazırda bir zamanlayıcı varsa temizle
    clearTimeout(undoTimeout);
    
    undoToast.style.display = "flex";

    // 4 saniye sonra bildirimi gizle ve yedeği temizle
    undoTimeout = setTimeout(() => {
      undoToast.style.display = "none";
      lastDeletedTodo = null;
    }, 5000);
  }

  // Geri Al butonuna basıldığında
  undoBtn.onclick = () => {
    if (lastDeletedTodo) {
      // Öğeyi geri ekle (olduğu sıraya veya en başa)
      todos.unshift(lastDeletedTodo);
      
      // Temizlik
      lastDeletedTodo = null;
      undoToast.style.display = "none";
      clearTimeout(undoTimeout);
      
      // Güncelle
      render();
      saveTodos();
    }
  };

  /* ---------------- TABS & SEARCH ---------------- */

  document.querySelectorAll(".tabs button[data-tab]").forEach(btn => {
    btn.addEventListener("click", () => {
      currentTab = btn.dataset.tab;
      document.querySelectorAll(".tabs button[data-tab]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      render();
    });
  });

  searchBox.oninput = render;

  // 1. Ayarları Yükle
  chrome.storage.local.get("theme", (result) => {
    const savedTheme = result.theme || "system";
    themeSelect.value = savedTheme;
    applyTheme(savedTheme);
  });

  // 2. Çark butonuna basınca modalı aç
  settingsBtn.onclick = () => {
    settingsModal.style.display = "flex";
  };

  // 3. Kapat butonuna basınca modalı kapat
  closeSettings.onclick = () => {
    settingsModal.style.display = "none";
  };

  // 4. Seçim değişince kaydet ve uygula
  themeSelect.onchange = () => {
    const theme = themeSelect.value;
    chrome.storage.local.set({ theme: theme });
    applyTheme(theme);
  };

  function applyTheme(theme) {
    document.body.classList.remove("light-theme", "dark-theme");
    
    if (theme === "light") {
      document.body.classList.add("light-theme");
    } else if (theme === "dark") {
      document.body.classList.add("dark-theme");
    } else {
      // "system" seçiliyse tarayıcı ayarına bırak (CSS media query çalışır)
      // Eğer class yoksa CSS'deki @media (prefers-color-scheme) devreye girer.
    }
  }

  /* ---------------- EXPORT & IMPORT ---------------- */

// 1. Export (Dışa Aktar)
document.getElementById("exportBtn").onclick = () => {
  const dataStr = JSON.stringify(todos, null, 2);
  const dataBlob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(dataBlob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `bb-todo-export-${new Date().toISOString().slice(0,10)}.json`;
  link.click();

  URL.revokeObjectURL(url);
};

// 2. Import (İçe Aktar)
const importBtn = document.getElementById("importBtn");
const importFile = document.getElementById("importFile");

importBtn.onclick = () => importFile.click(); // Gizli dosya seçiciyi tetikle

importFile.onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const importedTodos = JSON.parse(event.target.result);
      
      if (Array.isArray(importedTodos)) {
        // Mevcut verilerle birleştir veya üzerine yaz (üzerine yazmayı tercih ettik)
        if (confirm("Mevcut yapılacaklar listeniz silinecek ve dosyadaki veriler yüklenecek. Onaylıyor musunuz?")) {
          todos = importedTodos;
          saveTodos();
          render();
          alert("Veriler başarıyla içe aktarıldı!");
        }
      } else {
        alert("Geçersiz dosya formatı!");
      }
    } catch (err) {
      alert("Dosya okunurken bir hata oluştu!");
      console.error(err);
    }
    // Aynı dosyayı tekrar seçebilmek için input'u sıfırla
    importFile.value = "";
  };
  reader.readAsText(file);
};

  /* ---------------- INIT ---------------- */

  loadTodos();   // 🔑 popup açılır açılmaz güvenli yükleme
});
