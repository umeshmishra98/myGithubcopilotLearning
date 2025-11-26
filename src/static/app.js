document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");

  // Global client-side activity store (array)
  let activitiesData = [];

  // Function to fetch activities from API and normalize to an array
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activitiesObj = await response.json();

      // transform the API object into an array of activity objects
      activitiesData = Object.entries(activitiesObj).map(([name, details]) => ({
        id: name, // use name as id since server keys are names
        name,
        description: details.description || '',
        schedule: details.schedule || '',
        capacity: details.max_participants ?? null,
        participants: Array.isArray(details.participants)
          ? details.participants.map(email => ({ email })) // normalize participants to objects
          : []
      }));

      // populate the <select>
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';
      activitiesData.forEach(act => {
        const opt = document.createElement("option");
        opt.value = act.id;
        opt.textContent = `${act.name} (${act.participants.length}/${act.capacity ?? '–'})`;
        activitySelect.appendChild(opt);
      });

      // Render activity cards using template and participants UI
      renderActivities(activitiesData);
    } catch (error) {
      activitiesList.innerHTML = "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Ensure activity rendering uses the card template and populates participants list.
  function renderActivities(activities) {
    const container = document.getElementById('activities-list');
    container.innerHTML = '';
    const tpl = document.getElementById('activity-card-template');

    activities.forEach(activity => {
      const node = tpl.content.cloneNode(true);
      const article = node.querySelector('article.activity-card');
      article.dataset.activityId = activity.id;

      node.querySelector('.activity-title').textContent = activity.name ?? 'Untitled';
      node.querySelector('.activity-desc').textContent = activity.description ?? '';

      // schedule + availability (restore original style)
      const scheduleEl = node.querySelector('.schedule-text');
      if (scheduleEl) scheduleEl.textContent = activity.schedule ?? '—';

      const participants = Array.isArray(activity.participants) ? activity.participants : [];
      const spots = (activity.capacity != null) ? Math.max(activity.capacity - participants.length, 0) : '—';
      const availEl = node.querySelector('.availability-text');
      if (availEl) availEl.textContent = `${spots} spots left`;

      // --- participants rendering ---
      const listEl = node.querySelector('.participants-list');
      listEl.innerHTML = '';
      if (participants.length === 0) {
        const li = document.createElement('li');
        li.className = 'no-participants';
        li.textContent = 'No participants yet';
        listEl.appendChild(li);
      } else {
        participants.forEach(p => {
          const li = document.createElement('li');

          const avatar = document.createElement('span');
          avatar.className = 'avatar';
          const display = (p.name || p.email || String(p));
          avatar.textContent = (display.trim()[0] || '?').toUpperCase();

          const txt = document.createElement('span');
          txt.className = 'participant-name';
          txt.textContent = display;

          li.appendChild(avatar);
          li.appendChild(txt);
          listEl.appendChild(li);
        });
      }
      // --- end participants ---

      container.appendChild(node);
    });
  }

  // Handle form submission (single source of truth)
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const activity = document.getElementById("activity").value;
    if (!activity || !email) {
      messageDiv.textContent = "Please provide an email and select an activity.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      return;
    }

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";

        // Update client-side data and UI for the specific activity
        const act = activitiesData.find(a => String(a.id) === String(activity));
        if (act) {
          // avoid duplicates
          if (!act.participants.some(p => (p.email || '') === email)) {
            act.participants.push({ email });
          }

          // update select display text to reflect new counts
          const opt = Array.from(activitySelect.options).find(o => o.value === act.id);
          if (opt) opt.textContent = `${act.name} (${act.participants.length}/${act.capacity ?? '–'})`;

          // update only the affected card in-place
          const card = document.querySelector(`.activity-card[data-activity-id="${act.id}"]`);
          if (card) {
            const listEl = card.querySelector('.participants-list');
            listEl.innerHTML = '';
            if (act.participants.length === 0) {
              const li = document.createElement('li');
              li.className = 'no-participants';
              li.textContent = 'No participants yet';
              listEl.appendChild(li);
            } else {
              act.participants.forEach(p => {
                const li = document.createElement('li');
                const avatar = document.createElement('span');
                avatar.className = 'avatar';
                const display = (p.name || p.email || String(p));
                avatar.textContent = (display.trim()[0] || '?').toUpperCase();
                const txt = document.createElement('span');
                txt.className = 'participant-name';
                txt.textContent = display;
                li.appendChild(avatar);
                li.appendChild(txt);
                listEl.appendChild(li);
              });
            }

            // refresh availability text instead of non-existent .spots-remaining
            const remaining = (act.capacity != null) ? Math.max(act.capacity - act.participants.length, 0) : '—';
            const availEl = card.querySelector('.availability-text');
            if (availEl) availEl.textContent = `${remaining} spots left`;
          }
        }

        signupForm.reset();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");
      setTimeout(() => messageDiv.classList.add("hidden"), 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to sign up. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error signing up:", error);
    }
  });

  // Initialize app
  fetchActivities();
});
