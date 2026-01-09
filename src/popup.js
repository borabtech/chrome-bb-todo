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

  /* ---------------- ADD TODO ---------------- */

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

    render();
    saveTodos();
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

        li.onclick = (e) => {
          if (!e.target.classList.contains('delete-btn')) {
            openDetail(t);
          }
        };

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
          lastDeletedTodo = { ...t };
          todos = todos.filter(x => x.id !== t.id);
          render();
          saveTodos();
          showUndoToast();
        }
        
        li.appendChild(badge);
        li.appendChild(content);
        li.appendChild(del);

        bbTodoList.appendChild(li);
      });
  }

  function showUndoToast() {
    clearTimeout(undoTimeout);
    undoToast.style.display = "flex";

    undoTimeout = setTimeout(() => {
      undoToast.style.display = "none";
      lastDeletedTodo = null;
    }, 5000);
  }

  undoBtn.onclick = () => {
    if (lastDeletedTodo) {
      todos.unshift(lastDeletedTodo);
      
      lastDeletedTodo = null;
      undoToast.style.display = "none";
      clearTimeout(undoTimeout);
      
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

  chrome.storage.local.get("theme", (result) => {
    const savedTheme = result.theme || "system";
    themeSelect.value = savedTheme;
    applyTheme(savedTheme);
  });

  settingsBtn.onclick = () => {
    settingsModal.style.display = "flex";
  };

  closeSettings.onclick = () => {
    settingsModal.style.display = "none";
  };

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
    }
  }

  /* ---------------- EXPORT & IMPORT ---------------- */

document.getElementById("exportBtn").onclick = () => {
  const dataStr = JSON.stringify(todos, null, 2);
  const dataBlob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(dataBlob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `extendo-data-${new Date().toISOString().slice(0,10)}.json`;
  link.click();

  URL.revokeObjectURL(url);
};

const importBtn = document.getElementById("importBtn");
const importFile = document.getElementById("importFile");

importBtn.onclick = () => importFile.click();

importFile.onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const importedTodos = JSON.parse(event.target.result);
      
      if (Array.isArray(importedTodos)) {
        if (confirm("Existing items will be deleted. Are u sure?")) {
          todos = importedTodos;
          saveTodos();
          render();
          alert("Import successful!");
        }
      } else {
        alert("Bad format!");
      }
    } catch (err) {
      alert("An error occured while reading the data file!");
      console.error(err);
    }
    importFile.value = "";
  };
  reader.readAsText(file);
};



function openDetail(todo) {
  editingTodoId = todo.id;
  const panel = document.getElementById("detailPanel");
  
  document.getElementById("detailContentEditor").innerHTML = todo.content;
  document.getElementById("detailDescEditor").innerHTML = todo.description || ""; 
  
  const statusSelect = document.getElementById("detailStatusSelect");
  statusSelect.innerHTML = "";
  Object.entries(STATUS).forEach(([key, meta]) => {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = meta.label[0] + " - " + meta.label;
    if (key === todo.status) opt.selected = true;
    statusSelect.appendChild(opt);
  });

  panel.style.display = "flex";
}

document.getElementById("saveDetail").onclick = () => {
  const index = todos.findIndex(t => t.id === editingTodoId);
  if (index !== -1) {
    todos[index].content = document.getElementById("detailContentEditor").innerHTML;
    todos[index].description = document.getElementById("detailDescEditor").innerHTML;
    todos[index].status = document.getElementById("detailStatusSelect").value;
    
    saveTodos();
    render();
    document.getElementById("detailPanel").style.display = "none";
  }
};

document.querySelectorAll(".detail-toolbar button[data-command]").forEach(btn => {
  btn.onclick = () => {
    document.execCommand(btn.dataset.command, false, null);
  };
});

document.getElementById("detailImgBtn").onclick = () => {
  const url = prompt("Eneter an image URL:");
  if (url) document.execCommand("insertImage", false, url);
};

document.getElementById("closeDetail").onclick = () => {
  document.getElementById("detailPanel").style.display = "none";
};



  /* ---------------- INIT ---------------- */

  loadTodos();
});
