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

          // remove button
          const removeBtn = document.createElement('button');
          removeBtn.className = 'participant-remove';
          removeBtn.setAttribute('type', 'button');
          const email = (p.email || p.name || String(p || '')).trim();
          removeBtn.dataset.email = email;
          removeBtn.setAttribute('aria-label', `Remove ${email}`);
          removeBtn.textContent = '✕';

          // click handler will call unregister API and update UI
          removeBtn.addEventListener('click', async (ev) => {
            ev.stopPropagation();
            try {
              const resp = await fetch(
                `/activities/${encodeURIComponent(activity.id)}/unregister?email=${encodeURIComponent(email)}`,
                { method: 'DELETE' }
              );
              const res = await resp.json().catch(() => ({}));
              if (!resp.ok) {
                messageDiv.textContent = res.detail || res.message || 'Failed to remove participant';
                messageDiv.className = 'error';
                messageDiv.classList.remove('hidden');
                setTimeout(() => messageDiv.classList.add('hidden'), 4000);
                return;
              }

              // remove locally and update UI
              const act = activitiesData.find(a => String(a.id) === String(activity.id));
              if (act) {
                act.participants = act.participants.filter(pp => ((pp.email || pp.name || String(pp)) !== email));

                const opt = Array.from(activitySelect.options).find(o => o.value === act.id);
                if (opt) opt.textContent = `${act.name} (${act.participants.length}/${act.capacity ?? '–'})`;

                // update the card in-place
                const card = document.querySelector(`.activity-card[data-activity-id="${act.id}"]`);
                if (card) {
                  const listEl = card.querySelector('.participants-list');
                  // if no participants, show placeholder
                  if (act.participants.length === 0) {
                    listEl.innerHTML = '';
                    const li = document.createElement('li');
                    li.className = 'no-participants';
                    li.textContent = 'No participants yet';
                    listEl.appendChild(li);
                  } else {
                    // remove the li (we could re-render whole list for simplicity)
                    // simple approach: re-render participants for the card
                    listEl.innerHTML = '';
                    act.participants.forEach(pp => {
                      const newLi = document.createElement('li');
                      const avatar2 = document.createElement('span');
                      avatar2.className = 'avatar';
                      const display2 = (pp.name || pp.email || String(pp));
                      avatar2.textContent = (display2.trim()[0] || '?').toUpperCase();
                      const txt2 = document.createElement('span');
                      txt2.className = 'participant-name';
                      txt2.textContent = display2;
                      newLi.appendChild(avatar2);
                      newLi.appendChild(txt2);

                      const rm2 = document.createElement('button');
                      rm2.className = 'participant-remove';
                      rm2.setAttribute('type','button');
                      rm2.dataset.email = (pp.email || pp.name || String(pp || '')).trim();
                      rm2.setAttribute('aria-label', `Remove ${rm2.dataset.email}`);
                      rm2.textContent = '✕';
                      // attach same handler behavior to new button
                      rm2.addEventListener('click', async (e2) => {
                        e2.stopPropagation();
                        // reuse the same delete flow by triggering click on original element
                        removeBtn.click();
                      });
                      newLi.appendChild(rm2);
                      listEl.appendChild(newLi);
                    });
                  }
                  const remaining = (act.capacity != null) ? Math.max(act.capacity - act.participants.length, 0) : '—';
                  const availEl = card.querySelector('.availability-text');
                  if (availEl) availEl.textContent = `${remaining} spots left`;
                }
              }

              messageDiv.textContent = res.message || `${email} removed from ${activity.name || activity.id}`;
              messageDiv.className = 'success';
              messageDiv.classList.remove('hidden');
              setTimeout(() => messageDiv.classList.add('hidden'), 3500);
            } catch (err) {
              console.error('Error removing participant', err);
              messageDiv.textContent = 'Failed to remove participant. Try again.';
              messageDiv.className = 'error';
              messageDiv.classList.remove('hidden');
              setTimeout(() => messageDiv.classList.add('hidden'), 3500);
            }
          });

          li.appendChild(removeBtn);
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

                // delete/remove button
                const removeBtn = document.createElement('button');
                removeBtn.className = 'participant-remove';
                removeBtn.setAttribute('type', 'button');
                const emailToRemove = (p.email || p.name || String(p || '')).trim();
                removeBtn.dataset.email = emailToRemove;
                removeBtn.setAttribute('aria-label', `Remove ${emailToRemove}`);
                removeBtn.textContent = '✕';
                removeBtn.addEventListener('click', async (e) => {
                  e.stopPropagation();
                  try {
                    const resp = await fetch(
                      `/activities/${encodeURIComponent(act.id)}/unregister?email=${encodeURIComponent(emailToRemove)}`,
                      { method: 'DELETE' }
                    );
                    const res = await resp.json().catch(() => ({}));
                    if (!resp.ok) {
                      messageDiv.textContent = res.detail || res.message || 'Failed to remove participant';
                      messageDiv.className = 'error';
                      messageDiv.classList.remove('hidden');
                      setTimeout(() => messageDiv.classList.add('hidden'), 4000);
                      return;
                    }

                    // update client-side store
                    act.participants = act.participants.filter(pp => ((pp.email || pp.name || String(pp)) !== emailToRemove));

                    const opt = Array.from(activitySelect.options).find(o => o.value === act.id);
                    if (opt) opt.textContent = `${act.name} (${act.participants.length}/${act.capacity ?? '–'})`;

                    // re-render participants for the card
                    const newList = card.querySelector('.participants-list');
                    newList.innerHTML = '';
                    if (act.participants.length === 0) {
                      const liNo = document.createElement('li');
                      liNo.className = 'no-participants';
                      liNo.textContent = 'No participants yet';
                      newList.appendChild(liNo);
                    } else {
                      act.participants.forEach(pp => {
                        const nli = document.createElement('li');
                        const a2 = document.createElement('span');
                        a2.className = 'avatar';
                        const d2 = (pp.name || pp.email || String(pp));
                        a2.textContent = (d2.trim()[0] || '?').toUpperCase();
                        const t2 = document.createElement('span');
                        t2.className = 'participant-name';
                        t2.textContent = d2;
                        nli.appendChild(a2);
                        nli.appendChild(t2);
                        const rem = document.createElement('button');
                        rem.className = 'participant-remove';
                        rem.setAttribute('type', 'button');
                        rem.dataset.email = (pp.email || pp.name || String(pp || '')).trim();
                        rem.setAttribute('aria-label', `Remove ${rem.dataset.email}`);
                        rem.textContent = '✕';
                        // hook up the same behaviour recursively
                        rem.addEventListener('click', async () => removeBtn.click());
                        nli.appendChild(rem);
                        newList.appendChild(nli);
                      });
                    }

                    const remaining = (act.capacity != null) ? Math.max(act.capacity - act.participants.length, 0) : '—';
                    const availEl = card.querySelector('.availability-text');
                    if (availEl) availEl.textContent = `${remaining} spots left`;

                    messageDiv.textContent = res.message || `${emailToRemove} removed`;
                    messageDiv.className = 'success';
                    messageDiv.classList.remove('hidden');
                    setTimeout(() => messageDiv.classList.add('hidden'), 3500);
                  } catch (err) {
                    console.error('Error removing participant', err);
                    messageDiv.textContent = 'Failed to remove participant. Try again.';
                    messageDiv.className = 'error';
                    messageDiv.classList.remove('hidden');
                    setTimeout(() => messageDiv.classList.add('hidden'), 3500);
                  }
                });
                li.appendChild(removeBtn);
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
