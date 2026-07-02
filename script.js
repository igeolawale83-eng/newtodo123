(function () {
  "use strict";

  const STORAGE_KEY = "fieldLedgerTasks";

  const form = document.getElementById("todoForm");
  const editIdField = document.getElementById("editId");
  const titleField = document.getElementById("title");
  const descField = document.getElementById("description");
  const priorityField = document.getElementById("priority");
  const dueDateField = document.getElementById("dueDate");
  const dueTimeField = document.getElementById("dueTime");
  const formError = document.getElementById("formError");
  const submitBtn = document.getElementById("submitBtn");
  const cancelEditBtn = document.getElementById("cancelEdit");

  const ledgerBody = document.getElementById("ledgerBody");
  const emptyState = document.getElementById("emptyState");
  const ticketCount = document.getElementById("ticketCount");
  const sortSelect = document.getElementById("sortSelect");
  const hideCompleted = document.getElementById("hideCompleted");
  const todayStamp = document.getElementById("todayStamp");

  const PRIORITY_META = {
    "Very Important": { cls: "urgent", rank: 0, label: "Very Important" },
    "Important": { cls: "important", rank: 1, label: "Important" },
    "Less Important": { cls: "minor", rank: 2, label: "Less Important" }
  };

  let tasks = loadTasks();

  init();

  function init() {
    todayStamp.textContent = formatStampDate(new Date());
    form.addEventListener("submit", handleSubmit);
    cancelEditBtn.addEventListener("click", exitEditMode);
    sortSelect.addEventListener("change", render);
    hideCompleted.addEventListener("change", render);
    render();
  }

  function loadTasks() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error("Could not load saved tasks:", e);
      return [];
    }
  }

  function saveTasks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (e) {
      console.error("Could not save tasks:", e);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    formError.textContent = "";

    const title = titleField.value.trim();
    const description = descField.value.trim();
    const priority = priorityField.value;
    const dueDate = dueDateField.value;
    const dueTime = dueTimeField.value;

    if (!title) {
      formError.textContent = "Give the task a title before filing it.";
      titleField.focus();
      return;
    }
    if (!dueDate || !dueTime) {
      formError.textContent = "Set a due date and time.";
      return;
    }

    const editId = editIdField.value;

    if (editId) {
      const task = tasks.find((t) => t.id === editId);
      if (task) {
        task.title = title;
        task.description = description;
        task.priority = priority;
        task.dueDate = dueDate;
        task.dueTime = dueTime;
      }
      exitEditMode();
    } else {
      tasks.push({
        id: makeId(),
        title,
        description,
        priority,
        dueDate,
        dueTime,
        completed: false,
        createdAt: Date.now()
      });
      form.reset();
      priorityField.value = "Important";
      titleField.focus();
    }

    saveTasks();
    render();
  }

  function makeId() {
    return "t_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function enterEditMode(id) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    editIdField.value = task.id;
    titleField.value = task.title;
    descField.value = task.description;
    priorityField.value = task.priority;
    dueDateField.value = task.dueDate;
    dueTimeField.value = task.dueTime;

    submitBtn.textContent = "Save changes";
    cancelEditBtn.hidden = false;
    formError.textContent = "";

    form.scrollIntoView({ behavior: "smooth", block: "start" });
    titleField.focus();
  }

  function exitEditMode() {
    editIdField.value = "";
    form.reset();
    priorityField.value = "Important";
    submitBtn.textContent = "File task";
    cancelEditBtn.hidden = true;
    formError.textContent = "";
  }

  function deleteTask(id) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const confirmed = window.confirm('Delete "' + task.title + '" from the ledger? This can\'t be undone.');
    if (!confirmed) return;
    tasks = tasks.filter((t) => t.id !== id);
    if (editIdField.value === id) exitEditMode();
    saveTasks();
    render();
  }

  function toggleComplete(id) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    task.completed = !task.completed;
    saveTasks();
    render();
  }

  function getSortedTasks() {
    let list = tasks.slice();

    if (hideCompleted.checked) {
      list = list.filter((t) => !t.completed);
    }

    const mode = sortSelect.value;

    list.sort((a, b) => {
      if (mode === "due-asc" || mode === "due-desc") {
        const diff = dueTimestamp(a) - dueTimestamp(b);
        return mode === "due-asc" ? diff : -diff;
      }
      if (mode === "priority") {
        const diff = PRIORITY_META[a.priority].rank - PRIORITY_META[b.priority].rank;
        return diff !== 0 ? diff : dueTimestamp(a) - dueTimestamp(b);
      }
      // created
      return a.createdAt - b.createdAt;
    });

    return list;
  }

  function dueTimestamp(task) {
    return new Date(task.dueDate + "T" + (task.dueTime || "00:00")).getTime();
  }

  function isOverdue(task) {
    if (task.completed) return false;
    return dueTimestamp(task) < Date.now();
  }

  function render() {
    const list = getSortedTasks();
    ledgerBody.innerHTML = "";

    ticketCount.textContent = String(tasks.length).padStart(3, "0");

    if (list.length === 0) {
      emptyState.hidden = false;
      emptyState.querySelector(".empty-title").textContent =
        tasks.length === 0 ? "The ledger is clean." : "No tasks match this view.";
      emptyState.querySelector(".empty-copy").textContent =
        tasks.length === 0
          ? "File a task above to open your first entry."
          : "Adjust your sort or filter to see more.";
      return;
    }
    emptyState.hidden = true;

    const fragment = document.createDocumentFragment();

    list.forEach((task) => {
      const tr = document.createElement("tr");
      tr.dataset.priority = task.priority;
      if (isOverdue(task)) tr.classList.add("is-overdue");
      if (task.completed) tr.classList.add("is-complete");

      const meta = PRIORITY_META[task.priority] || PRIORITY_META["Important"];

      // Priority cell
      const priorityTd = document.createElement("td");
      const tag = document.createElement("span");
      tag.className = "priority-tag priority-tag--" + meta.cls;
      tag.textContent = meta.label;
      priorityTd.appendChild(tag);

      // Title cell
      const titleTd = document.createElement("td");
      const titleSpan = document.createElement("span");
      titleSpan.className = "task-title";
      titleSpan.textContent = task.title;
      titleTd.appendChild(titleSpan);

      // Description cell
      const descTd = document.createElement("td");
      const descSpan = document.createElement("span");
      descSpan.className = "task-desc";
      descSpan.textContent = task.description || "—";
      descTd.appendChild(descSpan);

      // Due cell
      const dueTd = document.createElement("td");
      dueTd.className = "due-cell";
      dueTd.appendChild(document.createTextNode(formatDue(task.dueDate, task.dueTime)));
      if (isOverdue(task)) {
        const flag = document.createElement("span");
        flag.className = "due-overdue-flag";
        flag.textContent = "Overdue";
        dueTd.appendChild(flag);
      }

      // Status cell
      const statusTd = document.createElement("td");
      const statusLabel = document.createElement("label");
      statusLabel.className = "status-check";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = task.completed;
      checkbox.setAttribute("aria-label", "Mark \"" + task.title + "\" as complete");
      checkbox.addEventListener("change", () => toggleComplete(task.id));
      statusLabel.appendChild(checkbox);
      statusLabel.appendChild(document.createTextNode(task.completed ? "Done" : "Open"));
      statusTd.appendChild(statusLabel);

      // Actions cell
      const actionsTd = document.createElement("td");
      const actionsWrap = document.createElement("div");
      actionsWrap.className = "row-actions";

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "icon-btn";
      editBtn.textContent = "Edit";
      editBtn.addEventListener("click", () => enterEditMode(task.id));

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "icon-btn danger";
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener("click", () => deleteTask(task.id));

      actionsWrap.appendChild(editBtn);
      actionsWrap.appendChild(deleteBtn);
      actionsTd.appendChild(actionsWrap);

      tr.appendChild(priorityTd);
      tr.appendChild(titleTd);
      tr.appendChild(descTd);
      tr.appendChild(dueTd);
      tr.appendChild(statusTd);
      tr.appendChild(actionsTd);

      fragment.appendChild(tr);
    });

    ledgerBody.appendChild(fragment);
  }

  function formatDue(dateStr, timeStr) {
    if (!dateStr) return "—";
    const d = new Date(dateStr + "T" + (timeStr || "00:00"));
    const datePart = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    const timePart = timeStr
      ? d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
      : "";
    return timePart ? datePart + " · " + timePart : datePart;
  }

  function formatStampDate(d) {
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  }
})();